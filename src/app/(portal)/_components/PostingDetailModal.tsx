"use client";

import Link from "next/link";
import { useMyPostingQuery, useMyApplicationMutation } from "@/api/my/getMyRecruit";
import { APPLICATION_STATUS_TONE } from "@/constants/recruitOptions";
import {
  Calendar,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  Package,
  UserCheck,
  Warning,
} from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { cn, formatCurrency } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { useStaffSessionStore } from "@/store/useStaffSessionStore";
import {
  GENDER_PREFERENCE_LABEL,
  WAGE_TYPE_LABEL,
  formatTimeRange,
} from "@/type/event";
import type { MyPosting, MyPostingPosition } from "@/type/my";
import { APPLICATION_STATUS_LABEL } from "@/type/recruit";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";

interface PostingDetailModalProps {
  postingId: number;
  onClose: () => void;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

const DetailRow = ({ icon, label, children }: DetailRowProps) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 shrink-0 text-font-disabled">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] text-font-2">{label}</p>
      <div className="mt-0.5 text-[14px] text-font-1">{children}</div>
    </div>
  </div>
);

interface PositionRowProps {
  posting: MyPosting;
  position: MyPostingPosition;
  isGuest: boolean;
  isBusy: boolean;
  onApply: (position: MyPostingPosition) => void;
  onCancel: (position: MyPostingPosition) => void;
}

/**
 * 포지션 한 줄 = **지원 단위.**
 *
 * 버튼을 모달 아래에 하나만 두면 "어느 시간대로 지원한 건지"가 화면에 남지 않는다.
 * 줄마다 제 버튼과 제 사정(지원함 · 못 하는 이유)을 붙인다.
 * 못 하는 이유는 서버가 판단한 한 줄(`blockReason`)을 그대로 쓴다 — 버튼만 잠가 두면
 * 고장인 줄 알고 담당자에게 전화한다.
 */
const PositionRow = ({
  posting,
  position,
  isGuest,
  isBusy,
  onApply,
  onCancel,
}: PositionRowProps) => {
  const jobRoleLabel = useJobRoleLabel();
  /* 지원은 자리마다 따로 있다. 한 행사의 여러 자리에 걸어 둘 수 있다. */
  const status = position.myApplicationStatus;
  const isMine = status !== undefined;
  /** 행사 근무일을 다 서지 않는 자리. 이때만 날짜를 펼친다 */
  const isPartial = position.workDates.length !== posting.workDates.length;
  const needsHealthCert =
    !isGuest && Boolean(position.blockReason?.includes("보건증"));

  /*
    지원할 수 없는 자리는 **꺼진 것처럼 보여야 한다.**
    이유를 한 줄 적어 두는 것만으로는 눈에 걸리지 않아서, 사람들은 줄을 다 읽고
    버튼을 찾다가 없다는 걸 알게 된다. 자리 자체를 흐리게 두고 이유만 또렷하게
    남기면, 훑는 동안 지원할 수 있는 자리만 눈에 들어온다.
  */
  const isBlocked = !isMine && !position.canApply;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-card border p-4",
        isMine
          ? "border-brand bg-surface-selected"
          : isBlocked
            ? "border-border-main bg-subtle"
            : "border-border-main",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          isBlocked && "opacity-45",
        )}
      >
        {/*
          직무 배지는 **이름과 다를 때만** 단다. 대부분의 자리는 이름이 곧 직무라
          ('스태프' 자리의 직무는 스태프) 배지를 늘 달면 같은 낱말이 두 번 적힌다.
          'A타임'처럼 우리 말로 지은 이름일 때만 직무가 알려 주는 것이 있다.
        */}
        <p className="min-w-0 text-[15px] font-semibold text-font-0">
          {position.name}
        </p>

        {/*
          **단가만 적는다.** (시급 · 일급) 하루 얼마는 근무시간 · 휴게에 따라
          흔들리는 값이라 자리끼리 비교가 되지 않는다. 사람들이 실제로 비교하는 것은 시급이다.
        */}
        <div className="shrink-0 text-right">
          <p className="text-[12px] text-font-2">
            {WAGE_TYPE_LABEL[position.wageType]}
          </p>
          <p className="text-[17px] font-bold text-font-0 tabular-nums">
            {formatCurrency(position.wage)}
          </p>
        </div>
      </div>

      {/* 근무시간 · 휴게는 지원 여부를 가르는 값이라 배지보다 위에 온다. */}
      <div className={cn("flex flex-col gap-1.5", isBlocked && "opacity-45")}>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[14px] font-medium text-font-1 tabular-nums">
          <Clock size={15} className="shrink-0 text-font-disabled" />
          {formatTimeRange(position.startTime, position.endTime, position.endDayOffset)}
          <span className="text-[13px] font-normal text-font-2">
            실근무 {position.workHours.toFixed(1)}시간
            {position.breakMinutes > 0 && ` · 휴게 ${position.breakMinutes}분`}
          </span>
        </p>

        {/*
          이 자리가 **실제로 서는 날.**

          행사 근무일을 그대로 서는 자리가 대부분이라, 그때는 날짜를 다시 적지
          않는다 — 위에 이미 있고, 열흘짜리 행사에서 줄마다 열 개를 반복하면
          정작 다른 자리(설치/철거처럼 첫날과 마지막 날만 서는 자리)가 묻힌다.
          **다를 때만** 날짜를 펼쳐서 그 차이가 눈에 걸리게 한다.

          연일 근무는 하루치가 아니라 전체 금액을 봐야 무엇에 지원하는지 가늠이 된다.
        */}
        {position.workDates.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[14px] font-medium text-font-2">
            <Calendar size={15} className="shrink-0 text-font-disabled" />
            아직 발주가 없는 자리예요
          </p>
        ) : (
          (isPartial || position.workDates.length > 1) && (
            <p className="flex flex-wrap items-center gap-x-1.5 text-[14px] font-medium text-font-1 tabular-nums">
              <Calendar size={15} className="shrink-0 text-font-disabled" />
              {isPartial
                ? position.workDates.map((date) => formatDate(date)).join(" · ")
                : `${position.workDates.length}일 근무`}
              {position.workDates.length > 1 && (
                <span className="text-[13px] font-normal text-font-2">
                  {isPartial && `${position.workDates.length}일 · `}예상{" "}
                  {formatCurrency(position.totalPay)}
                </span>
              )}
            </p>
          )
        )}
      </div>

      {(position.name !== jobRoleLabel(position.jobRole) ||
        position.genderPreference !== "ANY" ||
        position.requiresHealthCert) && (
        <div
          className={cn("flex flex-wrap gap-1.5", isBlocked && "opacity-45")}
        >
          {position.name !== jobRoleLabel(position.jobRole) && (
            <Badge tone="neutral">{jobRoleLabel(position.jobRole)}</Badge>
          )}
          {position.genderPreference !== "ANY" && (
            <Badge tone="info">
              {GENDER_PREFERENCE_LABEL[position.genderPreference]}
            </Badge>
          )}
          {position.requiresHealthCert && <Badge tone="warning">보건증 필요</Badge>}
        </div>
      )}

      {isMine && status ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-main pt-3">
          <Badge tone={APPLICATION_STATUS_TONE[status]}>
            지원함 · {APPLICATION_STATUS_LABEL[status]}
          </Badge>

          {/*
            검토 대기일 때만 무를 수 있다. 확정된 뒤에 화면에서 혼자 빠질 수 있으면
            담당자는 전날에야 사람이 사라진 것을 알게 된다.
          */}
          {status === "PENDING" ? (
            <Button
              size="sm"
              variant="dangerSoft"
              disabled={isBusy}
              onClick={() => onCancel(position)}
            >
              지원 취소
            </Button>
          ) : (
            <span className="text-[12px] text-font-2">
              처리된 지원은 담당자에게 문의해 주세요
            </span>
          )}
        </div>
      ) : position.canApply ? (
        <Button
          variant="secondary"
          fullWidth
          disabled={isBusy}
          onClick={() => onApply(position)}
        >
          이 포지션에 지원하기
        </Button>
      ) : (
        <div className="flex flex-col gap-1.5 border-t border-border-main pt-3">
          {/* 흐려 둔 자리에서 **이 줄만 또렷하다.** 왜 못 하는지는 읽혀야 한다. */}
          <p className="flex items-start gap-1.5 text-[13px] font-medium text-font-1">
            <Warning size={14} className="mt-0.5 shrink-0 text-warning" />
            {position.blockReason ?? "지금은 지원할 수 없어요."}
          </p>
          {needsHealthCert && (
            <Link
              href="/my/profile/documents?focus=health-cert"
              className="flex items-center gap-0.5 self-start text-[13px] font-medium text-brand transition hover:opacity-80"
            >
              보건증 등록하러 가기
              <ChevronRight size={14} />
            </Link>
          )}
        </div>
      )}
    </li>
  );
};

/**
 * 공고 상세 — 행사 한 건과 그 안의 포지션들.
 *
 * 지원은 **포지션을 골라서** 한다. 같은 행사라도 A타임(09~18)과 B타임(21~06)은
 * 전혀 다른 일이고 금액도 다르다. 행사당 한 포지션에만 지원할 수 있으므로,
 * 다른 포지션으로 바꾸려면 지금 지원을 취소하고 다시 낸다. (서버가 막는다)
 *
 * **화면이 아니라 모달인 이유**는 포털이 정적으로 내보내지기 때문이다.
 * 공고 번호마다 페이지를 미리 찍을 수 없다.
 *
 * 공고 목록과 일정의 '신청'에서 같은 모달을 연다. 볼 수 있는 화면이 둘이면
 * 두 곳의 내용이 조금씩 어긋나기 시작한다.
 *
 * 지원한 뒤에도 닫지 않는다. 방금 누른 줄이 '지원함'으로 바뀌는 것을 그 자리에서
 * 봐야 제대로 들어갔는지 안다.
 */
const PostingDetailModal = ({ postingId, onClose }: PostingDetailModalProps) => {
  const staffId = useStaffSessionStore((state) => state.staffId);
  const { data: posting, isLoading } = useMyPostingQuery(postingId);
  const { applyMutation, cancelMutation } = useMyApplicationMutation();

  const isGuest = staffId === null;
  const isBusy = applyMutation.isPending || cancelMutation.isPending;

  /* 행사 근무일을 다 서지 않는 자리가 섞여 있으면 위에서 미리 알린다. */
  const hasPartialPosition = Boolean(
    posting?.positions.some(
      (position) => position.workDates.length !== posting.workDates.length,
    ),
  );

  const handleApply = (target: MyPosting, position: MyPostingPosition) => {
    openConfirm({
      title: `'${position.name}'에 지원할까요?`,
      description: `${target.title} · ${formatTimeRange(
        position.startTime,
        position.endTime,
        position.endDayOffset,
      )}`,
      /* 지원이 확정이 아니라는 것을 누르기 전에 말해 둔다. */
      /*
        확정이 아니라는 것을 누르기 전에 말해 둔다.
        여러 자리에 걸어 둘 수 있게 된 만큼, 하나가 확정되면 같은 날 나머지가
        사라진다는 것도 함께 알린다 — 모르면 없어진 지원을 고장으로 읽는다.
      */
      warning:
        "지원한다고 근무가 확정되는 것은 아닙니다. 담당자가 확인한 뒤 연락드립니다. 여러 자리에 지원해 두어도 되고, 한 자리가 확정되면 같은 날의 다른 지원은 사라집니다.",
      confirmText: "지원하기",
      onConfirm: () =>
        applyMutation.mutate({
          postingId: target.postingId,
          positionId: position.positionId,
        }),
    });
  };

  const handleCancel = (target: MyPosting, position: MyPostingPosition) => {
    const applicationId = position.myApplicationId;

    if (!applicationId) return;

    openConfirm({
      title: "지원을 취소할까요?",
      description: `${target.title} · ${position.name}`,
      confirmText: "지원 취소",
      tone: "danger",
      onConfirm: () => cancelMutation.mutate(applicationId),
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={posting?.title ?? "공고"}
      description={posting ? posting.clientName : undefined}
      size="md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
      }
    >
      {isLoading || !posting ? (
        <Skeleton className="h-72 w-full rounded-card" />
      ) : (
        <div className="flex flex-col gap-5">
          {isGuest && (
            <Alert tone="info" title="로그인하면 지원할 수 있어요.">
              공고는 로그인하지 않아도 볼 수 있습니다. 지원은 담당자가 계정을 만들어 드린
              뒤에 할 수 있습니다.
            </Alert>
          )}

          {!isGuest && !posting.isApplied && posting.conflictEventTitle && (
            <Alert tone="warning" title="같은 기간에 확정된 근무가 있어요.">
              &lsquo;{posting.conflictEventTitle}&rsquo;와 날짜가 겹칩니다. 겹치는 날에
              서는 포지션에는 지원할 수 없어요.
            </Alert>
          )}

          <div className="flex flex-col gap-3.5">
            <DetailRow
              icon={<Calendar size={16} />}
              label={`근무일 ${posting.workDates.length}일`}
            >
              {/*
                다일 행사는 날짜를 **전부** 적는다. "09.12 외 2일"로 줄인 채로
                지원하면, 나머지 이틀이 언제인지 모르고 다른 일을 잡는다.
                며칠을 비워야 하는지가 지원 여부를 가르는 값이라 작게 적지 않는다.
              */}
              <ul className="flex flex-wrap gap-1.5">
                {posting.workDates.map((date) => (
                  <li
                    key={date}
                    className="rounded-field bg-subtle px-2.5 py-1 text-[15px] font-semibold tabular-nums"
                  >
                    {formatDate(date)}
                  </li>
                ))}
              </ul>
              {hasPartialPosition && (
                <p className="mt-1.5 text-[12px] text-font-2">
                  자리마다 서는 날이 다릅니다. 아래에서 확인해 주세요.
                </p>
              )}
            </DetailRow>

            <DetailRow icon={<MapPin size={16} />} label="장소">
              {posting.venue}
              {posting.address && (
                <span className="block text-[13px] text-font-2">{posting.address}</span>
              )}
            </DetailRow>

            {/*
              업체가 전하는 말은 **장소에서 떼어 낸다.**

              집합 장소는 행사장 주소와 다른 값인데(후문 · 지하 주차장이 흔하다)
              장소 칸 아래에 붙여 두면 주소의 부연으로 읽힌다. 그리고 현장마다
              칸으로 정해지지 않는 당부가 늘 하나씩 있어서, 담당자는 그것마저
              집합 칸에 이어 붙이게 된다. 안내는 안내끼리 한 자리에 모은다.
            */}
            {(posting.meetingPoint || posting.description) && (
              <DetailRow icon={<Info size={16} />} label="안내">
                <div className="flex flex-col gap-1.5">
                  {posting.meetingPoint && (
                    <span className="block rounded-field bg-brand-opacity px-2.5 py-1.5 text-[14px] font-medium text-brand">
                      집합 {posting.meetingPoint}
                    </span>
                  )}
                  {posting.description && (
                    <span className="block whitespace-pre-line text-[14px] text-font-1">
                      {posting.description}
                    </span>
                  )}
                </div>
              </DetailRow>
            )}
          </div>

          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-font-0">
                포지션 {posting.positions.length}개
              </h3>
              <p className="text-[12px] text-font-2">
                여러 자리에 지원해도 돼요
              </p>
            </div>

            <ul className="flex flex-col gap-2">
              {posting.positions.map((position) => (
                <PositionRow
                  key={position.positionId}
                  posting={posting}
                  position={position}
                  isGuest={isGuest}
                  isBusy={isBusy}
                  onApply={(target) => handleApply(posting, target)}
                  onCancel={(target) => handleCancel(posting, target)}
                />
              ))}
            </ul>
          </section>

          {(posting.dressCode || posting.belongings) && (
            <div className="flex flex-col gap-3.5 border-t border-border-main pt-4">
              {posting.dressCode && (
                <DetailRow icon={<UserCheck size={16} />} label="복장">
                  {posting.dressCode}
                </DetailRow>
              )}

              {posting.belongings && (
                <DetailRow icon={<Package size={16} />} label="준비물">
                  {posting.belongings}
                </DetailRow>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default PostingDetailModal;
