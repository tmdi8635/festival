"use client";

import { useMemo, useState } from "react";
import {
  RECURRENCE_INTERVAL_OPTIONS,
  RECURRENCE_PRESETS,
} from "@/constants/eventOptions";
import { ChevronLeft, ChevronRight } from "@/icons";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  buildRecurrenceFromPreset,
  describeRecurrence,
  resolveEventDates,
  resolvePresetFromRecurrence,
  type EventRecurrence,
} from "@/type/event";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";

interface RecurrenceFieldProps {
  startDate: string;
  endDate: string;
  value: EventRecurrence;
  onChange: (recurrence: EventRecurrence) => void;
  /** 프리셋을 바꾸면 종료일도 함께 손봐야 하는 경우가 있어 폼에 알려 준다. */
  onRequestEndDate?: (endDate: string) => void;
  error?: string;
}

/**
 * 행사 반복 일정 입력.
 *
 * 현장 일정은 하루짜리보다 이어지는 쪽이 오히려 흔한데, 그중에도
 * "쭉 이어서"와 "매주 주말만"은 성격이 전혀 다르다.
 * 기간만 받아서는 후자를 담을 수 없어 반복 규칙을 따로 입력받는다.
 *
 * 규칙만 고르게 하면 결과를 예측하기 어려우므로,
 * **실제로 며칠 나가는지를 달력으로 즉시 보여 주는 것**을 이 컴포넌트의 핵심으로 둔다.
 * 저장하고 나서야 근무일이 이상하다는 것을 알게 되면 배치를 전부 다시 해야 한다.
 */
const RecurrenceField = ({
  startDate,
  endDate,
  value,
  onChange,
  onRequestEndDate,
  error,
}: RecurrenceFieldProps) => {
  const preset = resolvePresetFromRecurrence(value);

  /*
    달력은 시작일이 있으면 그 달을, 없으면 이번 달을 연다.
    시작일은 아직 안 고른 상태에서 빈 문자열로 들어오므로
    `??`가 아니라 값이 있는지를 직접 확인해야 한다. (빈 문자열도 dayjs에는 유효하지 않다)
  */
  const [monthCursor, setMonthCursor] = useState<string | null>(null);
  const activeMonth =
    monthCursor || startDate || dayjs().format("YYYY-MM-DD");

  /** 규칙에서 뽑아낸 실제 근무일 */
  const resolvedDates = useMemo(
    () => resolveEventDates(startDate, endDate, value),
    [startDate, endDate, value],
  );

  const resolvedSet = useMemo(() => new Set(resolvedDates), [resolvedDates]);
  const excludedSet = useMemo(
    () => new Set(value.excludeDates),
    [value.excludeDates],
  );

  /** 달력 격자 (앞뒤 달의 잘린 주까지 그려야 격자가 깨지지 않는다) */
  const calendarDays = useMemo(() => {
    const monthStart = dayjs(activeMonth).startOf("month");
    const gridStart = monthStart.startOf("week");
    const gridEnd = monthStart.endOf("month").endOf("week");
    const count = gridEnd.diff(gridStart, "day") + 1;

    return Array.from({ length: count }, (_, index) =>
      gridStart.add(index, "day"),
    );
  }, [activeMonth]);

  const handlePreset = (nextPreset: (typeof RECURRENCE_PRESETS)[number]) => {
    const next = buildRecurrenceFromPreset(nextPreset.value, value);

    onChange(next);

    /*
      "하루만"으로 되돌리면 종료일이 과거에 남아 근무일이 0일이 되는 일이 잦다.
      프리셋을 고르는 순간 종료일도 말이 되게 맞춰 준다.
    */
    if (nextPreset.value === "SINGLE" && startDate) {
      onRequestEndDate?.(startDate);
    }

    if (
      nextPreset.value !== "SINGLE" &&
      startDate &&
      (!endDate || endDate <= startDate)
    ) {
      const suggestedSpan =
        nextPreset.value === "CONSECUTIVE"
          ? 2
          : nextPreset.value === "WEEKLY"
            ? 28
            : 13;

      onRequestEndDate?.(
        dayjs(startDate).add(suggestedSpan, "day").format("YYYY-MM-DD"),
      );
    }
  };

  const toggleWeekday = (weekday: number) => {
    const weekdays = value.weekdays.includes(weekday)
      ? value.weekdays.filter((item) => item !== weekday)
      : [...value.weekdays, weekday].sort((a, b) => a - b);

    onChange({ ...value, type: "WEEKLY", weekdays });
  };

  /**
   * 달력에서 날짜를 누를 때의 동작.
   *
   * 직접 선택 모드에서는 근무일을 찍고 빼는 것이고,
   * 규칙 모드에서는 "규칙상 나가는 날인데 이날만 쉰다"를 표시하는 것이다.
   * 두 경우가 섞이면 헷갈리므로 모드에 따라 다르게 처리한다.
   */
  const handleDateClick = (date: string) => {
    if (!startDate) return;

    if (value.type === "CUSTOM") {
      const dates = value.dates.includes(date)
        ? value.dates.filter((item) => item !== date)
        : [...value.dates, date].sort();

      onChange({ ...value, dates });
      return;
    }

    if (excludedSet.has(date)) {
      onChange({
        ...value,
        excludeDates: value.excludeDates.filter((item) => item !== date),
      });
      return;
    }

    // 규칙상 근무일이 아닌 날은 제외해 봐야 의미가 없다.
    if (!resolvedSet.has(date)) return;

    onChange({ ...value, excludeDates: [...value.excludeDates, date].sort() });
  };

  const isWithinRange = (date: string) =>
    Boolean(startDate) && date >= startDate && (!endDate || date <= endDate);

  return (
    <div className="flex flex-col gap-3">
      {/* 1. 반복 방식 프리셋 */}
      <div className="flex flex-wrap gap-1.5">
        {RECURRENCE_PRESETS.map((item) => (
          <button
            key={item.value}
            type="button"
            title={item.hint}
            onClick={() => handlePreset(item)}
            className={cn(
              "rounded-field border px-3 py-1.5 text-[13px] transition",
              preset === item.value
                ? "border-brand bg-brand-opacity font-medium text-brand"
                : "border-border-main text-font-2 hover:border-brand hover:text-font-1",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-font-2">
        {RECURRENCE_PRESETS.find((item) => item.value === preset)?.hint}
      </p>

      {/* 2. 매주 반복의 세부 조건 */}
      {value.type === "WEEKLY" && (
        <div className="flex flex-wrap items-center gap-3 rounded-field border border-border-main bg-subtle px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            {WEEKDAY_LABELS.map((label, weekday) => (
              <button
                key={label}
                type="button"
                aria-pressed={value.weekdays.includes(weekday)}
                onClick={() => toggleWeekday(weekday)}
                className={cn(
                  "size-8 rounded-full text-[13px] transition",
                  value.weekdays.includes(weekday)
                    ? "bg-brand font-semibold text-font-4"
                    : "text-font-2 hover:bg-surface-hover hover:text-font-1",
                  !value.weekdays.includes(weekday) &&
                    weekday === 0 &&
                    "text-danger",
                  !value.weekdays.includes(weekday) &&
                    weekday === 6 &&
                    "text-info",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Select
            aria-label="반복 간격"
            options={RECURRENCE_INTERVAL_OPTIONS}
            value={String(value.intervalWeeks)}
            onChange={(changeEvent) =>
              onChange({
                ...value,
                intervalWeeks: Number(changeEvent.target.value),
              })
            }
            selectBoxClassName="w-32"
          />
        </div>
      )}

      {/* 3. 실제 근무일 미리보기 */}
      <div className="rounded-field border border-border-main">
        <div className="flex items-center justify-between border-b border-border-main px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() =>
                setMonthCursor(
                  dayjs(activeMonth).subtract(1, "month").format("YYYY-MM-DD"),
                )
              }
              className="flex size-7 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover hover:text-font-1"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[13px] font-medium text-font-1 tabular-nums">
              {dayjs(activeMonth).format("YYYY년 M월")}
            </span>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() =>
                setMonthCursor(
                  dayjs(activeMonth).add(1, "month").format("YYYY-MM-DD"),
                )
              }
              className="flex size-7 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover hover:text-font-1"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={resolvedDates.length > 0 ? "info" : "danger"}>
              {describeRecurrence(value, resolvedDates.length)}
            </Badge>
            <span className="text-[12px] text-font-2 tabular-nums">
              총 {resolvedDates.length}일
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 px-2 pt-2">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={cn(
                "pb-1 text-center text-[11px]",
                index === 0 && "text-danger",
                index === 6 && "text-info",
                index !== 0 && index !== 6 && "text-font-2",
              )}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
          {calendarDays.map((day) => {
            const date = day.format("YYYY-MM-DD");
            const isCurrentMonth = day.isSame(dayjs(activeMonth), "month");
            const isWorkDay = resolvedSet.has(date);
            const isExcluded = excludedSet.has(date);
            const inRange = isWithinRange(date);

            return (
              <button
                key={date}
                type="button"
                disabled={!startDate}
                onClick={() => handleDateClick(date)}
                title={
                  isExcluded
                    ? "제외한 날입니다. 다시 누르면 근무일로 돌아옵니다."
                    : isWorkDay
                      ? "근무일입니다. 누르면 이 날만 제외합니다."
                      : undefined
                }
                className={cn(
                  "flex h-8 items-center justify-center rounded-field text-[12px] transition tabular-nums",
                  !isCurrentMonth && "opacity-35",
                  isWorkDay && "bg-brand font-semibold text-font-4",
                  isExcluded &&
                    "bg-danger-bg text-danger line-through decoration-danger",
                  !isWorkDay &&
                    !isExcluded &&
                    inRange &&
                    "text-font-1 hover:bg-surface-hover",
                  !isWorkDay &&
                    !isExcluded &&
                    !inRange &&
                    "text-font-disabled hover:bg-surface-hover",
                )}
              >
                {day.date()}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[12px] text-font-2">
        {value.type === "CUSTOM"
          ? "달력에서 근무일을 직접 눌러 지정하세요. 기간 밖의 날짜는 저장되지 않습니다."
          : "규칙대로 잡힌 날 중 쉬는 날이 있으면 달력에서 눌러 제외하세요."}
      </p>

      {error && <p className="text-[12px] text-font-error">{error}</p>}
    </div>
  );
};

export default RecurrenceField;
