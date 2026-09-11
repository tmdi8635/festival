"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useEventMutation } from "@/api/event/mutateEvent";
import {
  Building,
  Calendar,
  ChevronRight,
  Clock,
  Edit,
  MapPin,
  Phone,
  Plus,
  Trash,
} from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { cn, formatCurrency, formatWithCommas } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  GENDER_PREFERENCE_LABEL,
  WAGE_TYPE_LABEL,
  calculateScheduledWorkHours,
  comparePositionOrder,
  describeRecurrence,
  findPosition,
  formatTimeRange,
  groupConsecutiveDates,
  resolveBillingRate,
  summarizeEventCost,
  type EventDetail,
  type EventPosition,
} from "@/type/event";
import { formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import IconButton from "@/components/ui/IconButton";
import GenderMark from "@/components/domain/GenderMark";
import WageText from "@/components/domain/WageText";
import { useHasPermission } from "@/store/useAdminStore";
import PositionFormModal from "./PositionFormModal";

/** 라벨 · 값 한 줄. 개요에서만 쓴다. */
const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  /*
    좁은 화면에서는 라벨을 값 위에 올린다.
    96px짜리 라벨 칸을 그대로 두면 값에 남는 자리가 240px뿐이라
    장소 · 거래처처럼 긴 값이 서너 줄로 접혀 오히려 읽기 어렵다.
  */
  <div className="flex flex-col gap-0.5 border-b border-border-main py-2.5 last:border-b-0 sm:flex-row sm:gap-3">
    <p className="text-[13px] text-font-2 sm:w-24 sm:shrink-0">{label}</p>
    <div className="min-w-0 text-[14px] text-font-1 sm:flex-1">{value}</div>
  </div>
);

interface EventOverviewPanelProps {
  event: EventDetail;
  /** 부족한 포지션에서 바로 배치 모달을 연다. */
  onFillPosition: (positionId: number) => void;
}

/**
 * 개요 탭.
 *
 * 거래처에 다시 물어보지 않아도 되도록 발주 조건을 전부 한 화면에 둔다.
 * 집합 장소 · 복장 · 준비물은 안내 문구로 그대로 나가므로 여기서 확인한다.
 *
 * **포지션을 고치는 자리도 여기다.** 행사 수정 폼은 포지션을 받지 않는다 —
 * 배치 · 공고 · 계약서가 가리키는 포지션을 통째로 다시 보내면 지우는 요청이
 * 아무렇지 않게 만들어진다. 여기서 하나씩 추가 · 수정 · 삭제한다.
 */
const EventOverviewPanel = ({
  event,
  onFillPosition,
}: EventOverviewPanelProps) => {
  const canAssign = useHasPermission("assignment:write");
  const canWriteEvent = useHasPermission("event:write");
  const { deletePositionMutation } = useEventMutation();

  /*
    펼친 포지션들.

    **여럿을 한꺼번에 열 수 있어야 한다.** 담당자가 여기서 하는 일이
    "팀장 명단과 스태프 명단을 나란히 놓고 보는 것"이라, 하나를 열 때
    보던 것이 닫히면 눈으로 대조할 방법이 사라진다.
  */
  const [openPositionIds, setOpenPositionIds] = useState<number[]>([]);
  /** 포지션 모달. `null`이면 닫힘, `position: null`이면 추가 */
  const [positionForm, setPositionForm] = useState<{
    position: EventPosition | null;
  } | null>(null);

  const togglePosition = (positionId: number) =>
    setOpenPositionIds((prev) =>
      prev.includes(positionId)
        ? prev.filter((item) => item !== positionId)
        : [...prev, positionId],
    );

  const jobRoleLabel = useJobRoleLabel();
  // 발주 목록도 포지션 순서(= 등록한 순서)로 세운다.
  const sortedRoles = useMemo(
    () => [...event.roles].sort(comparePositionOrder(event.positions)),
    [event.roles, event.positions],
  );
  const { dailyWorkHours, laborCost, revenue, margin } =
    summarizeEventCost(event);

  /*
    포지션 하나에 실제로 서는 사람들.

    발주 숫자(`16/20명`)만 보고 "그래서 누가 오는데"를 확인하려면 일별 근무자 탭까지
    가야 했다. 개요에서 얼굴 · 이름 · 번호까지는 보여야 그 자리에서 전화를 건다.
    같은 사람이 여러 날 나와도 한 줄이다. 사람을 세는 자리이지 배치를 세는 자리가 아니다.
  */
  const membersOf = (positionId: number) =>
    [
      ...new Map(
        event.assignments
          .filter(
            (assignment) =>
              assignment.positionId === positionId &&
              assignment.status === "CONFIRMED",
          )
          .map((assignment) => [assignment.staffId, assignment]),
      ).values(),
    ].sort((a, b) => a.staffName.localeCompare(b.staffName));

  /** 취소를 뺀 배치 건수. 삭제할 수 있는지를 미리 알려 주는 데 쓴다. */
  const activeAssignmentCountOf = (positionId: number) =>
    event.assignments.filter(
      (assignment) =>
        assignment.positionId === positionId &&
        assignment.status !== "CANCELED",
    ).length;

  /**
   * 포지션 삭제.
   *
   * 배치가 걸린 포지션 · 마지막 포지션 · 지원이 걸린 포지션은 **서버가 막는다.**
   * 화면에서는 배치가 있으면 버튼을 먼저 꺼서, 눌러 보고 거부당하는 일을 줄인다.
   */
  const handleDeletePosition = (position: EventPosition) => {
    openConfirm({
      title: `'${position.name}' 포지션을 삭제할까요?`,
      description: "모든 근무일의 이 포지션 발주가 함께 사라집니다.",
      warning:
        "공고에 올라가 있으면 공고에서도 빠집니다. 지원이 걸려 있으면 삭제되지 않으니, 지원을 먼저 처리해 주세요.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: () =>
        deletePositionMutation.mutateAsync({
          eventId: event.eventId,
          positionId: position.positionId,
        }),
    });
  };

  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="flex min-w-0 flex-col gap-4 sm:col-span-2">
      <Card
        title="발주 조건"
        bodyClassName="px-4 py-1 sm:px-5"
      >
        <DetailRow
          label="반복"
          value={
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-font-2" />
              {describeRecurrence(event.recurrence, event.dayCount)} ·{" "}
              {formatDate(event.startDate)} ~ {formatDate(event.endDate)} (
              {groupConsecutiveDates(event.dates).length}개 구간)
            </span>
          }
        />
        {/*
          행사의 시각은 **기본 근무시간**이다. 실제 시각은 아래 포지션마다 있다.
          "근무 시간"이라고만 적어 두면 야간 포지션까지 이 시각에 오는 줄 안다.
        */}
        <DetailRow
          label="기본 근무시간"
          value={
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-font-2" />
              {formatTimeRange(
                event.startTime,
                event.endTime,
                event.endDayOffset,
              )}{" "}
              (실근무 {dailyWorkHours}시간 · 휴게 {event.breakMinutes}분
              {event.positions.length > 1 && " · 포지션마다 다름"})
            </span>
          }
        />
        <DetailRow
          label="장소"
          value={
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-font-2" />
              {event.venue} · {event.address}
            </span>
          }
        />
        <DetailRow label="집합" value={event.meetingPoint} />
        <DetailRow label="복장" value={event.dressCode} />
        <DetailRow label="준비물" value={event.belongings || "-"} />
        <DetailRow
          label="거래처"
          value={
            <span className="flex items-center gap-1.5">
              <Building size={14} className="text-font-2" />
              {event.clientName}
            </span>
          }
        />
        <DetailRow
          label="담당 매니저"
          value={
            <span className="flex flex-wrap items-center gap-1.5">
              {event.managerName}
              <span className="flex items-center gap-1 text-[13px] text-font-2 tabular-nums">
                <Phone size={13} />
                {formatPhoneNumber(event.managerPhone)}
              </span>
            </span>
          }
        />
        {/* 이 글은 모집 공고와 포털 상세에 그대로 실린다. 내부 메모가 아니다. */}
        <DetailRow label="공고 안내 문구" value={event.description || "-"} />
        <DetailRow label="내부 메모" value={event.memo || "-"} />
      </Card>

      {/*
        포지션 카드.

        같은 행사 안의 "A타임 09–18 시급 11,000 / B타임 21–06 시급 14,000"처럼
        시각 · 단가 · 조건이 다른 자리를 여기서 정한다. 발주 · 배치 · 공고 · 계약서가
        모두 이 목록을 가리킨다.
      */}
      <Card
        title="포지션"
        description="자리마다 시각 · 금액 · 지원 조건이 다릅니다. 이미 배치된 사람의 금액은 포지션을 고쳐도 그대로입니다."
        action={
          canWriteEvent && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus size={14} />}
              onClick={() => setPositionForm({ position: null })}
            >
              포지션 추가
            </Button>
          )
        }
        bodyClassName="flex flex-col gap-2"
      >
        {event.positions.length === 0 && (
          <p className="py-4 text-center text-[13px] text-font-2">
            포지션이 없습니다. 포지션을 추가해야 발주 · 배치를 할 수 있습니다.
          </p>
        )}

        {event.positions.map((position) => {
          const assignedCount = activeAssignmentCountOf(position.positionId);
          /* 마지막 포지션과 배치가 걸린 포지션은 지울 수 없다. (서버도 막는다) */
          const cannotDelete =
            assignedCount > 0 || event.positions.length <= 1;

          return (
            <div
              key={position.positionId}
              className="flex flex-col gap-2 rounded-field border border-border-main px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[14px] font-medium text-font-1">
                    {position.name}
                  </p>
                  <Badge tone="neutral">{jobRoleLabel(position.jobRole)}</Badge>
                  {/* 조건은 걸린 것만 적는다. '무관'까지 적으면 조건 있는 자리가 묻힌다. */}
                  {position.genderPreference !== "ANY" && (
                    <Badge tone="info">
                      {GENDER_PREFERENCE_LABEL[position.genderPreference]}
                    </Badge>
                  )}
                  {position.requiresHealthCert && (
                    <Badge tone="warning">보건증 필요</Badge>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-font-2 tabular-nums">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatTimeRange(
                      position.startTime,
                      position.endTime,
                      position.endDayOffset,
                    )}{" "}
                    · 실근무 {calculateScheduledWorkHours(position)}시간
                  </span>
                  <WageText wageType={position.wageType} wage={position.wage} />
                  {/*
                    지급 옆에 청구를 둔다. 두 숫자의 차이가 한 명당 마진이라,
                    떨어뜨려 놓으면 밑지는 자리를 알아채지 못한다.
                  */}
                  <span>
                    청구{" "}
                    {position.billingRate > 0
                      ? `${formatWithCommas(position.billingRate)}원/시간`
                      : "미설정"}
                  </span>
                </div>
              </div>

              {canWriteEvent && (
                <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                  <IconButton
                    label={`${position.name} 수정`}
                    icon={<Edit size={15} />}
                    onClick={() => setPositionForm({ position })}
                  />
                  <IconButton
                    label={`${position.name} 삭제`}
                    icon={<Trash size={15} />}
                    tone="danger"
                    disabled={cannotDelete || deletePositionMutation.isPending}
                    title={
                      assignedCount > 0
                        ? `배치 ${assignedCount}건이 있어 삭제할 수 없습니다. 배치를 먼저 해제하거나 다른 포지션으로 옮겨 주세요.`
                        : event.positions.length <= 1
                          ? "행사에는 포지션이 하나 이상 있어야 합니다."
                          : "포지션을 삭제합니다."
                    }
                    onClick={() => handleDeletePosition(position)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card
          title="포지션별 발주"
          description="전체 근무일을 합친 인원입니다."
          bodyClassName="flex flex-col gap-2"
        >
          {sortedRoles.map((slot) => {
            const position = findPosition(event, slot.positionId);
            const isShort = slot.assignedCount < slot.requiredCount;
            /* 포지션마다 따로 접고 편다. 하나를 열었다고 보던 것이 닫히면 대조가 안 된다. */
            const isOpen = openPositionIds.includes(slot.positionId);
            const members = membersOf(slot.positionId);
            const billingRate = resolveBillingRate(
              event.positions,
              slot.positionId,
            );

            return (
              <div
                key={slot.positionId}
                className="rounded-field border border-border-main"
              >
                {/*
                  펼침 버튼과 '채우기'는 **형제**다.
                  버튼 안의 버튼은 유효하지 않은 HTML이라 하이드레이션이 깨진다.
                  hover는 바깥 줄에 건다. 어디에 커서를 올려도 줄 전체가 한 덩어리로 반응한다.
                */}
                <div className="group flex items-center gap-1 rounded-field transition-colors hover:bg-surface-hover">
                  <button
                    type="button"
                    onClick={() => togglePosition(slot.positionId)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-field px-3 py-2 text-left"
                  >
                    <ChevronRight
                      size={14}
                      className={cn(
                        "shrink-0 text-font-2 transition-transform",
                        isOpen && "rotate-90",
                        members.length === 0 && "opacity-0",
                      )}
                    />

                    {/*
                      인원수를 포지션명과 **같은 줄에** 둔다.
                      바깥으로 빼면 아래 금액 줄이 그만큼 좁아져서 금액이 잘린다.
                    */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="min-w-0 flex-1 truncate text-[14px] text-font-1">
                          {position?.name ?? jobRoleLabel(slot.role)}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 text-[14px] font-medium whitespace-nowrap tabular-nums",
                            isShort ? "text-danger" : "text-success",
                          )}
                        >
                          {slot.assignedCount}/{slot.requiredCount}명
                        </span>
                      </div>

                      <p className="truncate text-[12px] text-font-2 tabular-nums">
                        {WAGE_TYPE_LABEL[slot.wageType]}{" "}
                        {formatWithCommas(slot.wage)}원
                        {billingRate > 0 && (
                          <span className="ml-1.5">
                            · 청구 {formatWithCommas(billingRate)}원
                          </span>
                        )}
                        {position && position.genderPreference !== "ANY" && (
                          <span className="ml-1.5">
                            · {GENDER_PREFERENCE_LABEL[position.genderPreference]}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>

                  {/* 부족한 자리는 여기서 바로 채운다. 배치 화면으로 나갈 이유가 없다. */}
                  {canAssign && isShort && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="relative mr-2 shrink-0"
                      onClick={() => onFillPosition(slot.positionId)}
                    >
                      채우기
                    </Button>
                  )}
                </div>

                {/*
                  펼쳤을 때 보이는 것은 **얼굴 · 이름 · 번호** 셋뿐이다.
                  접힘은 높이를 재지 않고 grid 1fr↔0fr로 굴린다. (`.collapsible`)
                */}
                {members.length > 0 && (
                  <div className="collapsible" data-folded={!isOpen}>
                    <div>
                      <ul className="flex flex-col gap-2 border-t border-border-main px-3 py-2.5">
                        {members.map((member) => (
                          <li
                            key={member.staffId}
                            className="flex items-center gap-2.5"
                          >
                            <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-subtle">
                              {member.staffProfileImageUrl && (
                                <Image
                                  src={member.staffProfileImageUrl}
                                  alt=""
                                  fill
                                  sizes="32px"
                                  className="object-cover"
                                  unoptimized
                                />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="flex items-center gap-1 truncate text-[13px] text-font-1">
                                {member.staffName}
                                <GenderMark gender={member.staffGender} size={11} />
                              </p>
                              <p className="truncate text-[12px] text-font-2 tabular-nums">
                                {formatPhoneNumber(member.staffPhone)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        {/*
          금액은 배치 건(=사람×날짜) 단위로 쌓인다. 시간은 배치마다 그 포지션의
          예정 시간으로, 매출은 포지션의 청구 단가로 잡는다. (`summarizeEventCost`)
        */}
        <Card title="예상 금액" bodyClassName="flex flex-col gap-1">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-font-2">예상 매출</span>
            <span className="text-[14px] text-font-1 tabular-nums">
              {formatCurrency(revenue)}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-border-main py-1.5">
            <span className="text-[13px] text-font-2">예상 인건비</span>
            <span className="text-[14px] text-font-1 tabular-nums">
              -{formatCurrency(laborCost)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-font-2">예상 마진</span>
            <span
              className={cn(
                "text-[18px] font-bold tabular-nums",
                margin >= 0 ? "text-success" : "text-danger",
              )}
            >
              {formatCurrency(margin)}
            </span>
          </div>
          {event.positions.some((position) => position.billingRate === 0) && (
            <p className="text-[12px] text-font-2">
              청구 단가가 미설정인 포지션은 매출에서 빠집니다.
            </p>
          )}
        </Card>
      </div>
    </div>

      <PositionFormModal
        event={event}
        isOpen={canWriteEvent && positionForm !== null}
        position={positionForm?.position ?? null}
        onClose={() => setPositionForm(null)}
      />
    </>
  );
};

export default EventOverviewPanel;
