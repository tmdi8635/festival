import { EVENT_STATUS_TONE } from "@/constants/eventOptions";
import { cn } from "@/lib/utils";
import {
  EVENT_STATUS_LABEL,
  describeRecurrence,
  type CalendarEvent,
} from "@/type/event";
import Badge from "@/components/ui/Badge";

interface MultiDayEventBarProps {
  event: CalendarEvent;
  /** 이 구간의 근무일 수. 반복 행사는 전체 일수와 다를 수 있다. */
  segmentDayCount: number;
  /** 이 주에서 잘린 구간이 앞쪽으로 이어지는지 */
  isContinuedFromPrevWeek: boolean;
  /** 이 주에서 잘린 구간이 뒤쪽으로 이어지는지 */
  isContinuedToNextWeek: boolean;
  onClick: () => void;
}

/**
 * 여러 날 이어지는 행사를 한 덩어리로 보여 주는 막대.
 *
 * 이어지는 날을 날짜별로 쪼개 그리면 같은 행사가 캘린더에 여러 번 나타나
 * "며칠짜리 하나"라는 사실이 사라진다.
 *
 * 다만 "매주 주말만" 같은 행사는 토·일 두 칸씩 끊어 그려야 실제 일정과 맞는다.
 * 그래서 막대는 **이어지는 구간 단위**로 그리고, 뱃지에는 행사 전체의
 * 반복 규칙을 적어 이 막대가 더 큰 일정의 일부라는 것을 알린다.
 */
const MultiDayEventBar = ({
  event,
  segmentDayCount,
  isContinuedFromPrevWeek,
  isContinuedToNextWeek,
  onClick,
}: MultiDayEventBarProps) => {
  const isUnderstaffed = event.totalAssigned < event.totalRequired;
  const isRecurring = event.recurrence.type === "WEEKLY";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${event.title} · ${describeRecurrence(event.recurrence, event.dayCount)} (${event.startDate} ~ ${event.endDate})`}
      className={cn(
        "flex h-[22px] w-full items-center gap-1.5 border px-2 text-left transition",
        "hover:border-brand hover:bg-brand-opacity-3 active:scale-[0.99]",
        isUnderstaffed
          ? "border-danger/30 bg-danger-bg"
          : "border-border-main bg-surface-selected",
        event.status === "CANCELED" && "opacity-50",
        isContinuedFromPrevWeek ? "rounded-l-none border-l-0" : "rounded-l-full",
        isContinuedToNextWeek ? "rounded-r-none border-r-0" : "rounded-r-full",
      )}
    >
      {!isContinuedFromPrevWeek && (
        <Badge
          tone={EVENT_STATUS_TONE[event.status]}
          className="px-1.5 py-0 text-[11px]"
        >
          {/* 반복 행사는 이 구간이 아니라 전체가 며칠인지가 중요하다. */}
          {isRecurring ? `총 ${event.dayCount}일` : `${segmentDayCount}일`}
        </Badge>
      )}

      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-font-1">
        {event.title}
      </span>

      <span
        className={cn(
          "shrink-0 text-[11px] font-medium tabular-nums",
          isUnderstaffed ? "text-danger" : "text-success",
        )}
      >
        {event.totalAssigned}/{event.totalRequired}
      </span>

      {!isContinuedToNextWeek && event.status === "CANCELED" && (
        <span className="shrink-0 text-[11px] text-font-2">
          {EVENT_STATUS_LABEL.CANCELED}
        </span>
      )}
    </button>
  );
};

export default MultiDayEventBar;
