"use client";

import { EVENT_STATUS_TONE } from "@/constants/eventOptions";
import { Star } from "@/icons";
import { useJobRoleShortLabel } from "@/store/useOrgStore";
import { cn } from "@/lib/utils";
import {
  EVENT_STATUS_LABEL,
  describeRecurrence,
  type CalendarEvent,
} from "@/type/event";
import Badge from "@/components/ui/Badge";
import RoleSlotChips from "@/components/domain/RoleSlotChips";

interface CalendarEventChipProps {
  event: CalendarEvent;
  onClick: () => void;
  /** 자세히 보기에서는 장소 · 담당자 · 배치 명단까지 펼친다. */
  isDetailed?: boolean;
  /** 이 칩이 놓인 날짜. 자세히 보기에서 그날 나오는 사람만 추린다. */
  date?: string;
  /** 인력 이름을 눌렀을 때. 인력 상세로 넘어간다. */
  onStaffClick?: (staffId: number) => void;
}

/**
 * 캘린더 한 칸에 들어가는 행사 카드.
 *
 * 대표가 캘린더에서 가장 먼저 찾는 정보는 "어디가 비었나"다.
 * 그래서 제목보다 직무별 충원 칩을 더 눈에 띄게 배치한다.
 *
 * 자세히 보기에서는 그날 나오는 사람 명단까지 펼친다.
 * "누가 나오는지"를 확인하려고 행사를 하나씩 열어 보던 일을 없애는 것이 목적이다.
 */
const CalendarEventChip = ({
  event,
  onClick,
  isDetailed = false,
  date,
  onStaffClick,
}: CalendarEventChipProps) => {
  const jobRoleShortLabel = useJobRoleShortLabel();


  /** 이 날짜에 배치된 인력. 날짜를 안 주면 전체를 본다. */
  const dayStaff = event.assignedStaff.filter(
    (assignment) => !date || assignment.workDate === date,
  );

  /*
    캘린더의 한 칸은 '하루'다.
    반복 행사의 전체 합계를 칸에 그리면 주말만 하는 한 달짜리 행사가
    하루에 80명 필요한 것처럼 보인다. 그날의 계획을 찾아 그린다.
  */
  const dayPlan = date
    ? event.days.find((day) => day.date === date)
    : undefined;
  const roles = dayPlan?.roles ?? event.roles;
  const dayRequired = roles.reduce((sum, slot) => sum + slot.requiredCount, 0);
  const dayAssigned = roles.reduce((sum, slot) => sum + slot.assignedCount, 0);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1 rounded-field border px-2 py-1.5 text-left transition hover:-translate-y-px hover:shadow-card",
        "hover:border-brand hover:bg-brand-opacity-3",
        dayAssigned < dayRequired
          ? "border-danger/30 bg-danger-bg/40"
          : "border-border-main bg-surface",
        event.status === "CANCELED" && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col gap-1 text-left transition active:scale-[0.99]"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[11px] font-medium text-font-2 tabular-nums">
            {event.startTime}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-font-1">
            {event.title}
          </span>
        </div>

        {/*
          메인팀장은 '간략히'에서도 남긴다.

          달력에서 제일 먼저 확인하는 것이 "이 날은 누가 메인으로 들어가나"다.
          그것이 안 보이면 결국 행사를 하나씩 열어 봐야 하고,
          그러면 달력을 접어 둔 뜻이 사라진다. 이름 하나면 알 수 있는 일이다.
        */}
        {event.mainSupervisorName && (
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-font-2">
            <Star size={10} className="shrink-0 text-brand" />
            <span className="truncate">{event.mainSupervisorName}</span>
          </span>
        )}

        {isDetailed && (
          <div className="flex min-w-0 flex-wrap items-center gap-1 overflow-hidden">
            <Badge tone={EVENT_STATUS_TONE[event.status]}>
              {EVENT_STATUS_LABEL[event.status]}
            </Badge>
            {event.dayCount > 1 && (
              <Badge tone="info">
                {describeRecurrence(event.recurrence, event.dayCount)}
              </Badge>
            )}
            <span className="truncate text-[11px] text-font-2">
              {event.venue} · {event.managerName}
            </span>
            {/* 반복 행사는 이 칸의 숫자가 전체가 아니라는 것을 알려 준다. */}
            {event.dayCount > 1 && (
              <span className="text-[11px] text-font-disabled tabular-nums">
                전체 {event.totalAssigned}/{event.totalRequired}명
              </span>
            )}
          </div>
        )}

        <RoleSlotChips roles={roles} isCompact />
      </button>

      {/* 자세히 보기: 그날 나오는 명단을 캘린더에서 바로 확인한다. */}
      {isDetailed && dayStaff.length > 0 && (
        <ul className="flex flex-wrap gap-1 border-t border-border-main pt-1.5">
          {dayStaff.map((assignment) => (
            <li key={assignment.assignmentId}>
              <button
                type="button"
                onClick={() => onStaffClick?.(assignment.staffId)}
                title={`${assignment.staffName} · ${jobRoleShortLabel(assignment.role)}`}
                className={cn(
                  "rounded-full border border-border-main px-1.5 py-0.5 text-[11px] text-font-2 transition",
                  "hover:border-brand hover:text-brand",
                  assignment.status === "WAITLIST" && "border-dashed opacity-70",
                )}
              >
                {assignment.staffName}
                <span className="ml-1 text-font-disabled">
                  {jobRoleShortLabel(assignment.role)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {isDetailed && dayStaff.length === 0 && (
        <p className="border-t border-border-main pt-1.5 text-[11px] text-font-disabled">
          배치된 인력이 없습니다.
        </p>
      )}
    </div>
  );
};

export default CalendarEventChip;
