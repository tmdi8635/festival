"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Building,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  Star,
} from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { cn, formatCurrency, formatWithCommas } from "@/lib/utils";
import { useJobRoleComparator, useJobRoleLabel } from "@/store/useOrgStore";
import {
  WAGE_TYPE_LABEL,
  byMainSupervisorFirst,
  describeRecurrence,
  formatTimeRange,
  groupConsecutiveDates,
  summarizeEventCost,
  type EventDetail,
} from "@/type/event";
import { formatPhoneNumber, type JobRole } from "@/type/staff";
import { useEventMutation } from "@/api/event/mutateEvent";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import { useHasPermission } from "@/store/useAdminStore";

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
  /** 부족한 직무에서 바로 배치 모달을 연다. */
  onFillRole: (role?: JobRole) => void;
}

/**
 * 개요 탭.
 *
 * 거래처에 다시 물어보지 않아도 되도록 발주 조건을 전부 한 화면에 둔다.
 * 집합 장소 · 복장 · 준비물은 안내 문구로 그대로 나가므로 여기서 확인한다.
 */
const EventOverviewPanel = ({ event, onFillRole }: EventOverviewPanelProps) => {
  const canAssign = useHasPermission("assignment:write");
  const canEditEvent = useHasPermission("event:write");
  const { mainSupervisorMutation } = useEventMutation();

  /* 한 번에 하나만 펼친다. 전부 펼치면 발주 현황을 훑는다는 목적이 사라진다. */
  const [openRole, setOpenRole] = useState<JobRole | null>(null);

  const jobRoleLabel = useJobRoleLabel();
  // 발주 목록도 기준 설정에서 정한 직무 순서로 세운다.
  const compareRoles = useJobRoleComparator();
  const sortedRoles = [...event.roles].sort((a, b) =>
    compareRoles(a.role, b.role),
  );
  const { dailyWorkHours, laborCost, revenue, margin } =
    summarizeEventCost(event);

  /*
    메인팀장 후보는 **확정 배치된 사람**뿐이다.
    배치되지도 않은 사람을 메인으로 적어 두면 캘린더에는 이름이 뜨는데
    현장에는 그 사람이 없다. 팀장 직무를 위로 세우되 다른 직무도 고를 수 있게 둔다.
    (설치 팀장이 메인을 맡는 현장이 실제로 있다)
  */
  const candidates = [
    ...new Map(
      event.assignments
        .filter((assignment) => assignment.status === "CONFIRMED")
        .map((assignment) => [assignment.staffId, assignment]),
    ).values(),
  ].sort(
    (a, b) =>
      compareRoles(a.role, b.role) || a.staffName.localeCompare(b.staffName),
  );

  const mainSupervisorOptions = [
    { label: "지정 전", value: "0" },
    ...candidates.map((assignment) => ({
      label: `${assignment.staffName} (${jobRoleLabel(assignment.role)})`,
      value: String(assignment.staffId),
    })),
  ];

  /*
    직무 하나에 실제로 서는 사람들.

    발주 숫자(`16/20명`)만 보고 "그래서 누가 오는데"를 확인하려면 일별 근무자 탭까지
    가야 했다. 개요에서 얼굴 · 이름 · 번호까지는 보여야 그 자리에서 전화를 건다.
    같은 사람이 여러 날 나와도 한 줄이다. 사람을 세는 자리이지 배치를 세는 자리가 아니다.
  */
  const membersOf = (role: JobRole) =>
    [
      ...new Map(
        event.assignments
          .filter(
            (assignment) =>
              assignment.role === role && assignment.status === "CONFIRMED",
          )
          .map((assignment) => [assignment.staffId, assignment]),
      ).values(),
    ].sort(
      (a, b) =>
        byMainSupervisorFirst(event.mainSupervisorStaffId)(a, b) ||
        a.staffName.localeCompare(b.staffName),
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card
        title="발주 조건"
        className="sm:col-span-2"
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
        <DetailRow
          label="근무 시간"
          value={
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-font-2" />
              {formatTimeRange(
                event.startTime,
                event.endTime,
                event.endDayOffset,
              )}{" "}
              (하루 실근무 {dailyWorkHours}시간 · 휴게 {event.breakMinutes}분)
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
              {event.clientName} · 청구 시급{" "}
              {formatCurrency(event.clientBillingRate)}
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
        {/*
          메인팀장.

          **직무가 아니라 자리다.** 팀장 여럿 중 이 행사를 끌고 가는 한 사람이고,
          현장 문의는 담당 매니저가 아니라 이 사람에게 먼저 간다.
          직무로 만들면 "팀장 3명 중 누가 메인인가"를 표현할 수 없어서 여기서 정한다.
        */}
        <DetailRow
          label="메인팀장"
          value={
            <div className="flex flex-wrap items-center gap-2">
              {canEditEvent ? (
                <Select
                  aria-label="메인팀장"
                  options={mainSupervisorOptions}
                  value={String(event.mainSupervisorStaffId ?? 0)}
                  disabled={mainSupervisorMutation.isPending}
                  onChange={(changeEvent) =>
                    mainSupervisorMutation.mutate({
                      eventId: event.eventId,
                      staffId: Number(changeEvent.target.value) || null,
                    })
                  }
                  selectBoxClassName="w-full sm:w-56"
                />
              ) : (
                <span>{event.mainSupervisorName ?? "지정 전"}</span>
              )}

              {event.mainSupervisorPhone && (
                <span className="flex items-center gap-1 text-[13px] text-font-2 tabular-nums">
                  <Phone size={13} />
                  {formatPhoneNumber(event.mainSupervisorPhone)}
                </span>
              )}

              {candidates.length === 0 && (
                <span className="text-[12px] text-font-2">
                  확정 배치된 인력이 있어야 지정할 수 있습니다.
                </span>
              )}
            </div>
          }
        />
        <DetailRow label="설명" value={event.description || "-"} />
        <DetailRow label="내부 메모" value={event.memo || "-"} />
      </Card>

      <div className="flex flex-col gap-4">
        <Card
          title="직무별 발주"
          description="전체 근무일을 합친 인원입니다."
          bodyClassName="flex flex-col gap-2"
        >
          {sortedRoles.map((slot) => {
            const isShort = slot.assignedCount < slot.requiredCount;
            const isOpen = openRole === slot.role;
            const members = membersOf(slot.role);

            return (
              <div
                key={slot.role}
                className="rounded-field border border-border-main"
              >
                {/*
                  줄 전체가 펼침 버튼이다.
                  숫자만 보고 "그래서 누구인데"를 확인하려면 일별 근무자 탭으로
                  넘어가야 했다. 개요에서 이름과 번호까지는 보여야 전화를 걸 수 있다.
                */}
                <button
                  type="button"
                  onClick={() => setOpenRole(isOpen ? null : slot.role)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-surface-hover"
                >
                  <ChevronRight
                    size={14}
                    className={cn(
                      "shrink-0 text-font-2 transition-transform",
                      isOpen && "rotate-90",
                      members.length === 0 && "opacity-0",
                    )}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-font-1">
                      {jobRoleLabel(slot.role)}
                    </p>
                    <p className="text-[12px] text-font-2 tabular-nums">
                      {WAGE_TYPE_LABEL[slot.wageType]}{" "}
                      {formatWithCommas(slot.wage)}원
                    </p>
                  </div>

                  <span
                    className={`shrink-0 text-[14px] font-medium tabular-nums ${
                      isShort ? "text-danger" : "text-success"
                    }`}
                  >
                    {slot.assignedCount}/{slot.requiredCount}명
                  </span>

                  {/* 부족한 직무는 여기서 바로 채운다. 배치 화면으로 나갈 이유가 없다. */}
                  {canAssign && isShort && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onFillRole(slot.role);
                      }}
                    >
                      채우기
                    </Button>
                  )}
                </button>

                {/*
                  펼쳤을 때 보이는 것은 **얼굴 · 이름 · 번호** 셋뿐이다.
                  여기서 하려는 일은 "누가 오는지 확인하고 필요하면 전화하기"라
                  근태 · 금액까지 늘어놓으면 그 두 가지가 오히려 안 보인다.
                */}
                {isOpen && members.length > 0 && (
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
                            {member.staffId === event.mainSupervisorStaffId && (
                              <Star size={11} className="shrink-0 text-brand" />
                            )}
                            {member.staffName}
                          </p>
                          <p className="truncate text-[12px] text-font-2 tabular-nums">
                            {formatPhoneNumber(member.staffPhone)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </Card>

        {/*
          금액은 배치 건(=사람×날짜) 단위로 쌓인다.
          여러 날 하는 행사에서 하루치로만 보면 마진 판단이 어긋난다.
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
              className={`text-[18px] font-bold tabular-nums ${
                margin >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatCurrency(margin)}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EventOverviewPanel;
