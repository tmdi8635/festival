"use client";

import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS } from "@/type/event";

interface DateChipsProps {
  dates: readonly string[];
  selected: readonly string[];
  /** 없으면 보기 전용이다. (고른 날만 칠해 보여 준다) */
  onToggle?: (date: string) => void;
  /** 고를 수 없는 날. 잠그고 줄을 그어 둔다 */
  disabledDates?: readonly string[];
  /** 잠근 날에 마우스를 올리면 보이는 이유 */
  disabledReason?: string;
  /** 포털(손가락)은 `md`, 관리자 표 안은 `sm` */
  size?: "sm" | "md";
}

/** `09.12 (금)` */
const formatChipLabel = (date: string): string =>
  `${date.slice(5).replace("-", ".")} (${WEEKDAY_LABELS[new Date(`${date}T00:00:00`).getDay()]})`;

/**
 * 근무일 칩 묶음.
 *
 * 공고의 분할 줄 · 지원 확정 · 수기 지원 · 포털 날짜 선택이 **같은 모양**으로 날을 고른다.
 * 날짜를 고르는 곳마다 생김새가 다르면, 같은 "09.13"이 어떤 화면에서는 고른 날이고
 * 어떤 화면에서는 막힌 날로 읽힌다.
 */
const DateChips = ({
  dates,
  selected,
  onToggle,
  disabledDates,
  disabledReason,
  size = "sm",
}: DateChipsProps) => (
  <div className="flex flex-wrap gap-1.5">
    {dates.map((date) => {
      const isPicked = selected.includes(date);
      const isDisabled = disabledDates?.includes(date) ?? false;

      return (
        <button
          key={date}
          type="button"
          aria-pressed={isPicked}
          disabled={isDisabled || !onToggle}
          title={isDisabled ? disabledReason : undefined}
          onClick={() => onToggle?.(date)}
          className={cn(
            "rounded-field border tabular-nums transition",
            size === "md" ? "px-3 py-2 text-[14px]" : "px-2.5 py-1 text-[12px]",
            isDisabled
              ? "cursor-not-allowed border-border-main bg-subtle text-font-disabled line-through"
              : isPicked
                ? "border-brand bg-brand text-font-4"
                : "border-border-main text-font-2",
            !isDisabled && onToggle && !isPicked && "hover:border-brand hover:text-font-1",
            !onToggle && "cursor-default",
          )}
        >
          {formatChipLabel(date)}
        </button>
      );
    })}
  </div>
);

export default DateChips;
