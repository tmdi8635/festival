"use client";

import Image from "next/image";
import { useState } from "react";
import { useStaffDetailQuery } from "@/api/staff/getStaffDetail";
import { useStaffHistoryQuery } from "@/api/staff/getStaffHistories";
import { useStaffReputationQuery } from "@/api/staff/getStaffReputations";
import { useStaffMutation } from "@/api/staff/mutateStaff";
import { CONTRACT_STATUS_TONE } from "@/constants/contractOptions";
import {
  ATTENDANCE_STATUS_TONE,
  STAFF_STATUS_HINT,
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
} from "@/constants/staffOptions";
import { Ban, Edit, EyeOff, Trash, Warning } from "@/icons";
import { formatDate, formatDateTime } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { useHasPermission } from "@/store/useAdminStore";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleComparator, useJobRoleLabel } from "@/store/useOrgStore";
import { CONTRACT_STATUS_LABEL } from "@/type/contract";
import {
  ATTENDANCE_STATUS_LABEL,
  GENDER_LABEL,
  RATER_TYPE_LABEL,
  REPUTATION_BASE_SCORE,
  REPUTATION_VERDICT_LABEL,
  calculateAge,
  formatPhoneNumber,
  formatRegion,
  formatReputationDelta,
  resolveTagVerdict,
  summarizeAttendance,
  type StaffDetail,
} from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import Tabs, { type TabItem } from "@/components/ui/Tabs";
import Textarea from "@/components/ui/Textarea";
import FavoriteToggle from "./FavoriteToggle";
import ContractDetailModal, {
  type ContractDetailTarget,
} from "./ContractDetailModal";
import RatingStat from "./RatingStat";

type StaffTab = "PROFILE" | "HISTORY" | "RATING" | "MEMO";

/**
 * 근무 기간을 **두 줄로** 나눈다.
 *
 * `2026.07.21 ~ 2026.07.31`은 한 줄로 두면 스물세 자다. 표에서 이 칸 하나가
 * 그만큼 넓어지고, 그 폭은 행사명 · 직무에서 빼앗아 온 것이다.
 * 시작일과 종료일을 위아래로 쌓으면 칸은 절반이 되고 읽는 데는 지장이 없다.
 */
const resolveWorkPeriod = (
  workDates: string[],
): { start: string; end?: string } => {
  if (workDates.length === 0) return { start: "-" };
  if (workDates.length === 1) return { start: formatDate(workDates[0]) };

  return {
    start: formatDate(workDates[0]),
    end: formatDate(workDates[workDates.length - 1]),
  };
};

interface StaffDetailModalProps {
  staffId: number | null;
  onClose: () => void;
  onEdit?: (staff: StaffDetail) => void;
  /** 블랙리스트 지정 모달을 여는 콜백. 호출부가 모달을 갖고 있다. */
  onBlacklist?: (staff: StaffDetail) => void;
}

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex gap-3 border-b border-border-main py-2.5 last:border-b-0">
    <p className="w-24 shrink-0 text-[13px] text-font-2">{label}</p>
    <div className="min-w-0 flex-1 text-[14px] text-font-1">{value}</div>
  </div>
);

/** 개인정보 이미지. 기본은 가려 두고 눌러야 보이게 한다. */
const SecureImage = ({ label, url }: { label: string; url: string }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      {/*
        '보기' 버튼이 있는 쪽과 없는 쪽(미제출)의 헤더 높이가 달라지면
        두 이미지의 윗줄이 어긋난다. 버튼 높이만큼을 항상 확보해 둔다.
      */}
      <div className="flex h-8 items-center justify-between">
        <p className="text-[13px] font-medium text-font-1">{label}</p>
        {url && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<EyeOff size={14} />}
            onClick={() => setIsVisible((prev) => !prev)}
          >
            {isVisible ? "가리기" : "보기"}
          </Button>
        )}
      </div>

      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-field border border-border-main bg-subtle">
        {!url && (
          <div className="flex h-full items-center justify-center text-[13px] text-font-disabled">
            미제출
          </div>
        )}

        {url && isVisible && (
          <Image
            src={url}
            alt={label}
            fill
            sizes="320px"
            className="object-cover"
            unoptimized
          />
        )}

        {url && !isVisible && (
          <div className="flex h-full items-center justify-center text-[13px] text-font-2">
            개인정보 보호를 위해 가려져 있습니다.
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 인력 상세 모달.
 *
 * "이 사람 예전에 어땠지"를 확인하려고 엑셀과 카톡을 오가던 일을 없애는 화면이다.
 *
 * 계약서 탭은 따로 두지 않는다. 계약서는 결국 "어느 행사에 대한 계약"이라
 * 참여 이력과 같은 줄에서 봐야 판단이 된다. 이력 한 줄에 계약 상태를 붙였다.
 */
const StaffDetailModal = ({
  staffId,
  onClose,
  onEdit,
  onBlacklist,
}: StaffDetailModalProps) => {
  const [tab, setTab] = useState<StaffTab>("PROFILE");
  const [memoContent, setMemoContent] = useState("");
  const [isWarningMemo, setIsWarningMemo] = useState(false);
  /*
    계약서 상세는 계약서 번호가 아니라 **사람 × 행사**로 연다.
    아직 등록 전이라 계약서 기록이 없는 행사에서도 문서를 내려받아야 하기 때문이다.
  */
  const [contractTarget, setContractTarget] =
    useState<ContractDetailTarget | null>(null);
  /** 날짜별 근태를 펼쳐 볼 행사. 여러 날 행사만 펼칠 수 있다. */
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );
  /*
    한 창 안에 성격이 다른 자료가 섞여 있어 권한도 나눠서 본다.

    - 계좌 · 누적 지급액  → `payroll:read` (이체에 쓰는 금전 정보)
    - 신분증 · 통장 사본  → `staffDocument:read` (개인정보 사본)
    - 메모 · 즐겨찾기     → `staff:write`
    - 블랙리스트 지정·해제 → `blacklist:write`

    서버도 같은 기준으로 응답에서 값을 덜어 낸다(`mocks/handlers/staff.ts`).
    화면에서만 가리면 개발자도구에 그대로 남는다.
  */
  const canViewAccount = useHasPermission("payroll:read");
  const canViewDocument = useHasPermission("staffDocument:read");
  const canWrite = useHasPermission("staff:write");
  const canBlacklist = useHasPermission("blacklist:write");

  const jobRoleLabel = useJobRoleLabel();

  // 직무는 기준 설정에서 정한 순서로 나열한다.

  const compareRoles = useJobRoleComparator();

  const { data: staff, isLoading } = useStaffDetailQuery(staffId);
  const { data: historyData } = useStaffHistoryQuery(staffId);
  const { data: reputationData } = useStaffReputationQuery(staffId);

  const { memoMutation, memoDeleteMutation, statusMutation } =
    useStaffMutation();

  const histories = historyData?.items ?? [];
  const reputations = reputationData?.items ?? [];
  const tagCounts = reputationData?.tagCounts ?? [];
  const warningMemos = staff?.memos.filter((memo) => memo.isWarning) ?? [];
  const reputationScore = staff?.reputationScore ?? REPUTATION_BASE_SCORE;

  const handleClose = () => {
    setTab("PROFILE");
    setMemoContent("");
    setIsWarningMemo(false);
    onClose();
  };

  const handleAddMemo = () => {
    if (!staff || memoContent.trim().length < 2) return;

    memoMutation.mutate(
      {
        staffId: staff.staffId,
        content: memoContent.trim(),
        isWarning: isWarningMemo,
      },
      {
        onSuccess: () => {
          setMemoContent("");
          setIsWarningMemo(false);
        },
      },
    );
  };

  const handleUnblacklist = () => {
    if (!staff) return;

    openConfirm({
      title: "블랙리스트를 해제할까요?",
      description: `'${staff.name}'님을 다시 배치 대상으로 되돌립니다.`,
      confirmText: "해제",
      onConfirm: () =>
        statusMutation.mutateAsync({
          staffId: staff.staffId,
          body: { status: "ACTIVE" },
        }),
    });
  };

  const historyColumns: TableColumn<(typeof histories)[number]>[] = [
    {
      /*
        배치는 "사람 × 날짜"라 3일 나온 행사는 배치가 3건이다.
        그대로 나열하면 같은 행사가 하루짜리 세 줄로 흩어져
        "며칠 일했는지"가 사라진다. 행사 단위로 묶고 기간으로 보여 준다.
      */
      key: "workDate",
      header: "근무일",
      numeric: true,
      render: (history) => {
        const period = resolveWorkPeriod(history.workDates);

        return (
        <div>
          {/* 연일이면 시작일 · 종료일을 위아래로 쌓아 칸이 넓어지지 않게 한다. */}
          <p className="text-font-1 whitespace-nowrap">{period.start}</p>
          {period.end && (
            <p className="text-font-1 whitespace-nowrap">~ {period.end}</p>
          )}
          {history.dayCount > 1 && (
            <button
              type="button"
              onClick={() =>
                setExpandedHistoryId((prev) =>
                  prev === history.historyId ? null : history.historyId,
                )
              }
              className="mt-0.5 text-[12px] text-brand transition hover:opacity-70"
            >
              {history.dayCount}일 근무
              {expandedHistoryId === history.historyId ? " 접기" : " 펼치기"}
            </button>
          )}
        </div>
        );
      },
    },
    {
      /*
        행사는 **새 탭**으로 연다.

        이 표는 인력 상세 모달 안에 있다. 같은 탭에서 행사로 넘어가면
        보고 있던 사람의 이력이 통째로 사라지고, 돌아오려면 인력을 다시 찾아
        모달을 열고 탭을 골라야 한다. 이력을 훑다가 "이 행사 뭐였지"를
        확인하는 동작이라 원래 화면이 남아 있어야 한다.
      */
      key: "event",
      header: "행사",
      render: (history) => (
        <a
          href={`/schedule/events/${history.eventId}`}
          target="_blank"
          rel="noreferrer"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          title="새 탭에서 행사 상세를 엽니다."
          className="block min-w-0 text-left transition hover:text-brand"
        >
          <p className="truncate text-font-1">{history.eventTitle}</p>
          <p className="mt-0.5 truncate text-[12px] text-font-2">
            {history.clientName}
          </p>
        </a>
      ),
    },
    {
      key: "role",
      header: "직무",
      render: (history) => (
        <Badge tone="neutral">{jobRoleLabel(history.role)}</Badge>
      ),
    },
    {
      key: "attendance",
      header: "근태",
      render: (history) => {
        const summary = summarizeAttendance(history.days);

        return (
          <div className="flex flex-col items-start gap-1">
            <Badge tone={ATTENDANCE_STATUS_TONE[summary.status]}>
              {summary.label}
            </Badge>

            {/* 펼치면 어느 날 무슨 일이 있었는지 그대로 보여 준다. */}
            {expandedHistoryId === history.historyId && (
              <ul className="flex flex-col gap-0.5">
                {history.days.map((day) => (
                  <li
                    key={day.assignmentId}
                    className="text-[11px] text-font-2 tabular-nums"
                  >
                    {formatDate(day.date)}{" "}
                    <span
                      className={
                        day.attendance === "PRESENT"
                          ? "text-font-2"
                          : "font-medium text-danger"
                      }
                    >
                      {ATTENDANCE_STATUS_LABEL[day.attendance]}
                      {day.lateMinutes > 0 && ` ${day.lateMinutes}분`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      },
    },
    {
      /*
        계약서를 별도 탭에 두면 "이 행사 때 계약서가 나갔나"를 확인하려고
        탭을 오가야 한다. 상태와 계약번호를 이력 한 줄에 함께 둔다.
      */
      key: "contract",
      header: "근로계약서",
      /*
        아직 등록 전인 행사도 눌러서 열 수 있어야 한다.
        거기서 문서를 내려받아 배부하는 것이 다음에 할 일이기 때문이다.
        예전에는 계약서가 있는 줄만 눌렸고, 정작 급한 줄은 눌러도 아무 일이 없었다.
      */
      render: (history) => (
        <button
          type="button"
          onClick={() =>
            staff &&
            setContractTarget({
              eventId: history.eventId,
              staffId: staff.staffId,
            })
          }
          className="text-left transition hover:opacity-80"
          title="계약서 상세를 엽니다."
        >
          {history.contractStatus ? (
            <>
              <Badge tone={CONTRACT_STATUS_TONE[history.contractStatus]}>
                {CONTRACT_STATUS_LABEL[history.contractStatus]}
              </Badge>
              {history.contractNumber && (
                <p className="mt-0.5 text-[11px] text-font-2 tabular-nums">
                  {history.contractNumber}
                </p>
              )}
            </>
          ) : (
            <Badge tone="danger">발급 전</Badge>
          )}
        </button>
      ),
    },
    {
      key: "payAmount",
      header: "지급액",
      align: "right",
      numeric: true,
      render: (history) => (
        <div>
          <p className="text-font-1">{formatCurrency(history.payAmount)}</p>
          {history.dayCount > 1 && (
            <p className="mt-0.5 text-[11px] text-font-2 tabular-nums">
              {history.totalWorkHours}시간
            </p>
          )}
        </div>
      ),
    },
  ];

  const reputationColumns: TableColumn<(typeof reputations)[number]>[] = [
    {
      key: "workDate",
      header: "근무일",
      numeric: true,
      render: (item) => formatDate(item.workDate),
    },
    {
      key: "event",
      header: "행사",
      render: (item) => (
        <a
          href={`/schedule/events/${item.eventId}`}
          target="_blank"
          rel="noreferrer"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          title="새 탭에서 행사 상세를 엽니다."
          className="block min-w-0 text-left transition hover:text-brand"
        >
          <p className="truncate text-font-1">{item.eventTitle}</p>
          <p className="mt-0.5 truncate text-[12px] text-font-2">
            {item.clientName}
          </p>
        </a>
      ),
    },
    {
      key: "role",
      header: "직무",
      render: (item) => <Badge tone="neutral">{jobRoleLabel(item.role)}</Badge>,
    },
    {
      /*
        고른 항목이 곧 평가다.

        옆에 '좋아요/별로예요' 칸을 따로 두지 않는다. `지시 이해가 빠름`이
        이미 좋아요이고 `복장 규정 미준수`가 이미 별로예요라, 요약 배지를
        하나 더 두면 같은 말이 두 번 적힌 칸이 된다.

        색은 **항목 자체**가 정한다. 한 평가에 좋아요와 별로예요가 함께
        담기므로, 평가 하나의 방향으로 칠하면 섞인 항목이 통째로 한 색이 된다.
      */
      key: "tags",
      header: "평가 항목",
      render: (item) =>
        item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <Badge
                key={tag}
                tone={resolveTagVerdict(tag) === "BAD" ? "danger" : "success"}
              >
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-[13px] text-font-2">
            {REPUTATION_VERDICT_LABEL[item.verdict]}만 남김
          </span>
        ),
    },
    {
      /* 이 평가가 점수를 얼마나 움직였는지. 목록의 총점이 어디서 왔는지 설명한다. */
      key: "points",
      header: "점수",
      align: "right",
      numeric: true,
      render: (item) => (
        <span
          className={
            item.points > 0
              ? "font-medium text-success tabular-nums"
              : item.points < 0
                ? "font-medium text-danger tabular-nums"
                : "text-font-2 tabular-nums"
          }
        >
          {formatReputationDelta(item.points)}
        </span>
      ),
    },
    {
      key: "comment",
      header: "코멘트",
      render: (item) =>
        item.comment ? (
          <span className="text-[13px] text-font-1">{item.comment}</span>
        ) : (
          <span className="text-[13px] text-font-disabled">남긴 의견 없음</span>
        ),
    },
    {
      /*
        누가 남긴 평가인지 함께 적는다.
        상호평가를 열면 에이전시가 본 모습과 동료가 겪은 모습이 한 표에 섞이는데,
        그 둘은 자주 다르고 그 차이 자체가 봐야 할 정보다.
      */
      key: "ratedBy",
      header: "평가자",
      render: (item) => (
        /*
          이름 아래에 주체를 작게 쌓는다.
          `김도윤(에이전시)`처럼 한 줄로 붙이면 이름이 어디서 끝나는지
          매번 괄호를 찾아 읽어야 하고, 주체가 길어질수록 칸이 넓어진다.
        */
        <TableCellStack
          primary={<span className="text-[13px]">{item.ratedBy}</span>}
          secondary={RATER_TYPE_LABEL[item.raterType]}
        />
      ),
    },
  ];

  const tabs: TabItem<StaffTab>[] = [
    { label: "인적사항", value: "PROFILE" },
    { label: "참여 이력", value: "HISTORY", count: histories.length },
    { label: "평판", value: "RATING", count: reputations.length },
    { label: "메모", value: "MEMO", count: staff?.memos.length ?? 0 },
  ];

  return (
    <>
      <Modal
        isOpen={staffId !== null}
        onClose={handleClose}
        title={staff?.name ?? "인력 상세"}
        description={
          staff
            ? `${formatPhoneNumber(staff.phoneNumber)} · ${formatRegion(staff.region, staff.district)}`
            : undefined
        }
        size="xl"
        headerAction={
          /*
            즐겨찾기는 이 창을 끝내는 동작이 아니라 제목 옆에 붙는 표시다.
            푸터의 저장 · 블랙리스트와 나란히 두면 무게가 같아 보여
            "눌러도 되는 것"인지 매번 판단하게 된다. 별 하나로 충분하다.
          */
          staff &&
          canWrite && (
            <FavoriteToggle
              staffId={staff.staffId}
              isFavorite={staff.isFavorite}
              size={20}
            />
          )
        }
        footer={
          staff && (
            <>
              {staff.status === "BLACKLIST" ? (
                canBlacklist && (
                  <Button variant="secondary" onClick={handleUnblacklist}>
                    블랙리스트 해제
                  </Button>
                )
              ) : (
                canBlacklist &&
                onBlacklist && (
                  <Button
                    variant="danger"
                    leftIcon={<Ban size={15} />}
                    onClick={() => onBlacklist(staff)}
                  >
                    블랙리스트
                  </Button>
                )
              )}

              {canWrite && onEdit && (
                <Button
                  variant="primary"
                  leftIcon={<Edit size={15} />}
                  onClick={() => onEdit(staff)}
                >
                  정보 수정
                </Button>
              )}
            </>
          )
        }
      >
        {isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
        )}

        {staff && (
          <div className="flex flex-col gap-4">
            {staff.status === "BLACKLIST" && (
              <Alert tone="danger" title="블랙리스트 인력입니다.">
                {staff.blacklistReason} ({formatDate(staff.blacklistedAt)} 지정)
              </Alert>
            )}

            {staff.status !== "BLACKLIST" && warningMemos.length > 0 && (
              <Alert tone="warning" title="주의 메모가 있습니다.">
                {warningMemos[0].content}
              </Alert>
            )}

            {!staff.isDocumentComplete && (
              <Alert tone="warning" title="서류가 아직 없습니다.">
                신분증 또는 통장사본이 없어 정산 계좌를 확정할 수 없습니다.
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-4 rounded-card border border-border-main bg-subtle p-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-surface">
                {staff.profileImageUrl && (
                  <Image
                    src={staff.profileImageUrl}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                )}
              </div>

              {/*
                상태 옆에 그 뜻을 함께 적는다.

                '대기중'만 보고는 무엇을 해야 하는지 알 수 없다. 서류를 받아야
                한다는 것이 배지 하나에서 바로 읽혀야, 배치하려다 확정 단계에서
                막히는 일이 생기지 않는다.
              */}
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <Badge tone={STAFF_STATUS_TONE[staff.status]}>
                  {STAFF_STATUS_LABEL[staff.status]}
                </Badge>
                <span className="text-[12px] text-font-2">
                  {STAFF_STATUS_HINT[staff.status]}
                </span>
              </div>

              <div className="grid w-full shrink-0 grid-cols-2 gap-4 text-center sm:w-auto sm:grid-cols-4">
                <div>
                  <p className="text-[12px] text-font-2">누적 근무</p>
                  <p className="text-[16px] font-bold text-font-0 tabular-nums">
                    {staff.workCount}회
                  </p>
                </div>
                <div>
                  {/* 무엇을 받아서 이 점수가 됐는지는 아래 평판 탭이 답한다. */}
                  <p className="text-[12px] text-font-2">평판</p>
                  <RatingStat reputationScore={staff.reputationScore} />
                </div>
                <div>
                  <p className="text-[12px] text-font-2">지각</p>
                  <p className="text-[16px] font-bold text-warning tabular-nums">
                    {staff.lateCount}회
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-font-2">노쇼</p>
                  <p className="text-[16px] font-bold text-danger tabular-nums">
                    {staff.noShowCount}회
                  </p>
                </div>
              </div>
            </div>

            <Tabs items={tabs} value={tab} onChange={setTab} />

            {tab === "PROFILE" && (
              <div className="flex flex-col gap-4">
                <div className="rounded-card border border-border-main px-4 py-1">
                  <DetailRow
                    label="생년월일"
                    value={`${staff.birthDate} (만 ${calculateAge(staff.birthDate)}세) · ${GENDER_LABEL[staff.gender]}`}
                  />
                  <DetailRow
                    label="연락처"
                    value={formatPhoneNumber(staff.phoneNumber)}
                  />
                  <DetailRow
                    label="비상 연락처"
                    value={formatPhoneNumber(staff.emergencyContact)}
                  />
                  <DetailRow
                    label="활동 지역"
                    value={formatRegion(staff.region, staff.district)}
                  />
                  <DetailRow label="주소" value={staff.address || "-"} />
                  <DetailRow
                    label="가능 직무"
                    value={
                      <div className="flex flex-wrap gap-1">
                        {[...staff.roles].sort(compareRoles).map((role) => (
                          <Badge key={role} tone="neutral">
                            {jobRoleLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    }
                  />
                  <DetailRow
                    label="신체 정보"
                    value={`${staff.height ?? "-"}cm · 의상 ${staff.clothingSize || "-"}`}
                  />
                  <DetailRow
                    label="누적 지급액"
                    value={
                      canViewAccount
                        ? formatCurrency(staff.totalPaidAmount)
                        : "***"
                    }
                  />
                  <DetailRow
                    label="계좌"
                    value={
                      canViewAccount ? (
                        staff.accountNumber ? (
                          `${staff.bankName} ${staff.accountNumber} (${staff.accountHolder})`
                        ) : (
                          "미등록"
                        )
                      ) : (
                        <span className="text-font-disabled">
                          &lsquo;정산 &gt; 조회&rsquo; 권한이 필요합니다.
                        </span>
                      )
                    }
                  />
                  <DetailRow
                    label="최근 근무"
                    value={
                      staff.lastWorkedAt ? formatDate(staff.lastWorkedAt) : "없음"
                    }
                  />
                  <DetailRow label="등록일" value={formatDate(staff.createdAt)} />
                </div>

                {canViewDocument && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SecureImage label="신분증 사본" url={staff.idCardImageUrl} />
                    <SecureImage label="통장 사본" url={staff.bankBookImageUrl} />
                  </div>
                )}
              </div>
            )}

            {tab === "HISTORY" && (
              <div className="overflow-hidden rounded-card border border-border-main">
                <Table
                  columns={historyColumns}
                  rows={histories}
                  getRowKey={(history) => history.historyId}
                  emptyTitle="참여한 행사가 없습니다."
                  emptyDescription="행사에 배치하면 이력과 계약서 상태가 여기에 쌓입니다."
                />
              </div>
            )}

            {tab === "RATING" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-6 rounded-card border border-border-main bg-subtle px-5 py-4">
                  {/*
                    크게 띄우는 숫자는 **누적 평판 점수**다.
                    모두가 1000점에서 시작해 평가가 쌓인 만큼만 오르내리므로,
                    숫자 하나로 "얼마나 쌓아 온 사람인가"가 읽힌다.
                    그 숫자가 어떤 평가에서 왔는지는 아래 표가 항목째로 보여 준다.
                  */}
                  <div>
                    <p className="text-[12px] text-font-2">평판 점수</p>
                    <span className="mt-1 block text-[28px] font-bold text-font-0 tabular-nums">
                      {reputationScore}
                    </span>
                  </div>

                  {/* 좋아요 · 별로예요 비율. 점수 하나보다 "몇 명이 어떻게 봤나"가 더 많은 것을 말한다. */}
                  <div className="flex flex-1 flex-col gap-1.5">
                    {(
                      [
                        { verdict: "GOOD" as const, count: staff.goodCount },
                        { verdict: "BAD" as const, count: staff.badCount },
                      ]
                    ).map(({ verdict, count }) => {
                      const total = staff.goodCount + staff.badCount;
                      const ratio = total > 0 ? (count / total) * 100 : 0;

                      return (
                        <div key={verdict} className="flex items-center gap-2">
                          <span className="w-14 text-[12px] text-font-2">
                            {REPUTATION_VERDICT_LABEL[verdict]}
                          </span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                            <div
                              style={{ width: `${ratio}%` }}
                              className={
                                verdict === "GOOD"
                                  ? "h-full rounded-full bg-success"
                                  : "h-full rounded-full bg-danger"
                              }
                            />
                          </div>
                          <span className="w-16 text-right text-[12px] text-font-2 tabular-nums">
                            {count}건 · {Math.round(ratio)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/*
                  항목별 집계.
                  "별로예요 12건"만으로는 무엇이 문제인지 알 수 없다.
                  그중 8건이 '지각이 잦음'이면 태도가 아니라 시간 문제이고, 대응도 달라진다.
                */}
                {tagCounts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-card border border-border-main px-5 py-4">
                    <span className="mr-1 text-[12px] text-font-2">
                      많이 받은 항목
                    </span>
                    {tagCounts.map(({ tag, count, verdict }) => (
                      <Badge
                        key={tag}
                        tone={verdict === "GOOD" ? "success" : "danger"}
                      >
                        {tag} {count}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="overflow-hidden rounded-card border border-border-main">
                  <Table
                    columns={reputationColumns}
                    rows={reputations}
                    getRowKey={(item) => String(item.assignmentId)}
                    emptyTitle="받은 평가가 없습니다."
                    emptyDescription="행사가 끝난 뒤 배치 화면에서 평가를 남기면 여기에 쌓입니다."
                  />
                </div>
              </div>
            )}

            {tab === "MEMO" && (
              <div className="flex flex-col gap-4">
                {staff.memos.length === 0 ? (
                  <EmptyState
                    title="남긴 메모가 없습니다."
                    description="현장 피드백을 기록해 두면 다음 배치 판단이 쉬워집니다."
                  />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {staff.memos.map((memo) => (
                      <li
                        key={memo.memoId}
                        className="flex items-start gap-3 rounded-field border border-border-main px-4 py-3"
                      >
                        {memo.isWarning && (
                          <Warning
                            size={16}
                            className="mt-0.5 shrink-0 text-warning"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] text-font-1">
                            {memo.content}
                          </p>
                          <p className="mt-1 text-[12px] text-font-2">
                            {memo.author} · {formatDateTime(memo.createdAt)}
                          </p>
                        </div>

                        {canWrite && (
                          <IconButton
                            label="메모 삭제"
                            icon={<Trash size={15} />}
                            tone="danger"
                            size="sm"
                            onClick={() =>
                              memoDeleteMutation.mutate({
                                staffId: staff.staffId,
                                memoId: memo.memoId,
                              })
                            }
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/*
                  입력창을 목록 아래에 둔다.
                  메모는 댓글처럼 읽고 이어 쓰는 것이라, 입력창이 위에 있으면
                  기존 메모를 읽기 전에 쓰게 되고 같은 이야기가 반복된다.
                */}
                {canWrite && (
                <div className="flex flex-col gap-2 rounded-card border border-border-main p-4">
                  <Textarea
                    value={memoContent}
                    onChange={(event) => setMemoContent(event.target.value)}
                    rows={3}
                    placeholder="예) 05.12 성수 팝업 지각 20분. 다음 배치 전에 한 번 더 공지할 것."
                  />

                  <div className="flex items-center justify-between">
                    <Checkbox
                      label="주의 메모로 표시 (상세 상단에 경고로 뜹니다)"
                      checked={isWarningMemo}
                      onChange={(event) =>
                        setIsWarningMemo(event.target.checked)
                      }
                    />

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddMemo}
                      disabled={memoContent.trim().length < 2}
                      isLoading={memoMutation.isPending}
                    >
                      메모 남기기
                    </Button>
                  </div>
                </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ContractDetailModal
        target={contractTarget}
        onClose={() => setContractTarget(null)}
      />
    </>
  );
};

export default StaffDetailModal;
