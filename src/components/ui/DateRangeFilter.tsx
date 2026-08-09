"use client";

import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import Input from "./Input";

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

interface RangePreset {
  label: string;
  /** 오늘 기준 며칠 전부터인지. 0이면 오늘 하루. */
  days: number;
}

/** 운영에서 가장 자주 쓰는 조회 구간 */
const PRESETS: RangePreset[] = [
  { label: "오늘", days: 0 },
  { label: "7일", days: 6 },
  { label: "30일", days: 29 },
  { label: "90일", days: 89 },
];

const toRange = ({ days }: RangePreset): DateRange => ({
  startDate: dayjs().subtract(days, "day").format("YYYY-MM-DD"),
  endDate: dayjs().format("YYYY-MM-DD"),
});

/**
 * 기간 필터.
 *
 * 프리셋으로 대부분의 조회를 끝내고, 필요할 때만 직접 날짜를 고른다.
 * 시작일이 종료일보다 뒤로 갈 수 없도록 min/max로 서로 제한한다.
 */
const DateRangeFilter = ({
  value,
  onChange,
  className,
}: DateRangeFilterProps) => {
  const activePreset = PRESETS.find((preset) => {
    const range = toRange(preset);

    return (
      range.startDate === value.startDate && range.endDate === value.endDate
    );
  });

  const isEmpty = !value.startDate && !value.endDate;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center rounded-field border border-border-main p-0.5">
        <button
          type="button"
          onClick={() => onChange({ startDate: "", endDate: "" })}
          className={cn(
            "rounded-[7px] px-2.5 py-1 text-[13px] transition",
            isEmpty
              ? "bg-surface-selected font-medium text-brand"
              : "text-font-2 hover:bg-surface-hover hover:text-font-1",
          )}
        >
          전체
        </button>

        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(toRange(preset))}
            className={cn(
              "rounded-[7px] px-2.5 py-1 text-[13px] transition",
              activePreset?.label === preset.label
                ? "bg-surface-selected font-medium text-brand"
                : "text-font-2 hover:bg-surface-hover hover:text-font-1",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Input
        type="date"
        aria-label="조회 시작일"
        value={value.startDate}
        max={value.endDate || undefined}
        onChange={(event) =>
          onChange({ ...value, startDate: event.target.value })
        }
        inputBoxClassName="w-38"
      />

      <span className="text-font-disabled">~</span>

      <Input
        type="date"
        aria-label="조회 종료일"
        value={value.endDate}
        min={value.startDate || undefined}
        onChange={(event) => onChange({ ...value, endDate: event.target.value })}
        inputBoxClassName="w-38"
      />
    </div>
  );
};

export default DateRangeFilter;
