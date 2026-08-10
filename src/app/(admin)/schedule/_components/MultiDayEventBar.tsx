import { EVENT_STATUS_TONE } from "@/constants/eventOptions";
import { cn } from "@/lib/utils";
import {
  EVENT_STATUS_LABEL,
  describeRecurrence,
  formatTimeRange,
  type CalendarEvent,
} from "@/type/event";
import Badge from "@/components/ui/Badge";
import Tooltip from "@/components/ui/Tooltip";

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

/** 말풍선 한 줄. 라벨을 왼쪽에 세워 값이 세로로 정렬되게 한다. */
const TooltipRow = ({ label, value }: { label: string; value: string }) => (
  <span className="flex gap-2 text-[12px]">
    <span className="w-14 shrink-0 text-font-2">{label}</span>
    <span className="min-w-0 flex-1 text-font-1">{value}</span>
  </span>
);

/**
 * 여러 날 이어지는 행사를 한 덩어리로 보여 주는 막대.
 *
 * 이어지는 날을 날짜별로 쪼개 그리면 같은 행사가 캘린더에 여러 번 나타나
 * "며칠짜리 하나"라는 사실이 사라진다.
 *
 * 다만 "매주 주말만" 같은 행사는 토·일 두 칸씩 끊어 그려야 실제 일정과 맞는다.
 * 그래서 막대는 **이어지는 구간 단위**로 그리고, 뱃지에는 행사 전체의
 * 반복 규칙을 적어 이 막대가 더 큰 일정의 일부라는 것을 알린다.
 *
 * ## 막대 하나에 담기는 것은 제목뿐이다
 *
 * 22px 높이에 들어가는 것은 일수 · 제목 · 충원 수가 전부다. 정작 캘린더에서
 * 알고 싶은 것 — 어느 거래처인지, 몇 시에 모이는지, 담당자가 누구인지 — 는
 * 담을 자리가 없다.
 *
 * 그래서 말풍선으로 뗀다. 브라우저 기본 `title`을 쓰지 않는 이유는 여러 줄로
 * 정리할 수 없고, 뜨기까지 1초 넘게 걸리며, 글꼴 · 색이 화면과 따로 놀기
 * 때문이다.
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

  const tooltip = (
    <span className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5">
        <Badge
          tone={EVENT_STATUS_TONE[event.status]}
          className="px-1.5 py-0 text-[11px]"
        >
          {EVENT_STATUS_LABEL[event.status]}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-font-0">
          {event.title}
        </span>
      </span>

      <TooltipRow label="거래처" value={event.clientName} />
      <TooltipRow
        label="기간"
        value={`${event.startDate} ~ ${event.endDate} · ${describeRecurrence(
          event.recurrence,
          event.dayCount,
        )}`}
      />
      <TooltipRow
        label="시간"
        value={formatTimeRange(
          event.startTime,
          event.endTime,
          event.endDayOffset,
        )}
      />
      <TooltipRow label="장소" value={event.venue} />
      <TooltipRow label="담당자" value={event.managerName} />
      <TooltipRow
        label="충원"
        value={`${event.totalAssigned} / ${event.totalRequired}명${
          isUnderstaffed ? " · 미충원" : ""
        }`}
      />
    </span>
  );

  return (
    <Tooltip content={tooltip} className="w-full">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex h-[22px] w-full items-center gap-1.5 border px-2 text-left transition",
          "hover:border-brand hover:bg-brand-opacity-3 active:scale-[0.99]",
          isUnderstaffed
            ? "border-danger/30 bg-danger-bg"
            : "border-border-main bg-surface-selected",
          event.status === "CANCELED" && "opacity-50",
          isContinuedFromPrevWeek
            ? "rounded-l-none border-l-0"
            : "rounded-l-full",
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
    </Tooltip>
  );
};

export default MultiDayEventBar;
