"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@/icons";
import { cn } from "@/lib/utils";
import {
  formatMonthLabel,
  monthKey,
  monthOf,
  shiftMonth,
  toMonthKey,
  yearOf,
} from "@/type/employee";

interface MonthPickerProps {
  /** `YYYY-MM` */
  value: string;
  onChange: (month: string) => void;
  /** 이 달보다 뒤로는 못 간다. 기본값은 이번 달이다. */
  maxMonth?: string;
  /** 이 달보다 앞으로는 못 간다. */
  minMonth?: string;
  className?: string;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/**
 * 달 고르기.
 *
 * **화살표만 두면 안 된다.** 근무 기록은 몇 년씩 쌓이고, "3년 전 4월"을 보려면
 * 화살표를 마흔 번 눌러야 한다. 그래서 가운데 라벨을 누르면 열리는 판에
 * **연도 이동과 12개월 격자**를 함께 둔다. 두 번 눌러 어느 달이든 간다.
 *
 * 화살표도 남긴다. 실제로 제일 많이 하는 조작이 "지난달과 비교"라서,
 * 그것까지 판을 열게 하면 오히려 손이 많이 간다.
 *
 * 앞으로 오지 않은 달은 막는다. 미래는 배치만 있고 근무는 없어서
 * 열어 봐야 전부 0이고, 0을 보고 "이 사람이 안 뛰었다"고 읽는 사고가 난다.
 */
const MonthPicker = ({
  value,
  onChange,
  maxMonth = monthKey(),
  minMonth,
  className,
}: MonthPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  /**
   * 판에서 넘겨 보고 있는 연도. 고르기 전까지는 `value`를 바꾸지 않는다.
   *
   * 열 때마다 지금 고른 달의 연도로 맞춘다. 효과로 하지 않고 여는 자리에서
   * 직접 맞추는 이유는, 효과로 하면 열린 뒤 한 번 더 그려지면서
   * 지난 연도가 잠깐 스쳐 보이기 때문이다.
   */
  const [viewYear, setViewYear] = useState(() => yearOf(value));

  const toggle = () => {
    if (!isOpen) setViewYear(yearOf(value));

    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const isBlocked = (month: string) =>
    (maxMonth !== undefined && month > maxMonth) ||
    (minMonth !== undefined && month < minMonth);

  const step = (offset: number) => {
    const next = shiftMonth(value, offset);

    if (!isBlocked(next)) onChange(next);
  };

  const maxYear = yearOf(maxMonth);
  const minYear = minMonth ? yearOf(minMonth) : maxYear - 20;

  return (
    <div
      ref={containerRef}
      className={cn("relative flex items-center gap-1", className)}
    >
      <button
        type="button"
        aria-label="지난달"
        disabled={isBlocked(shiftMonth(value, -1))}
        onClick={() => step(-1)}
        className="flex size-8 shrink-0 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover hover:text-font-1 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className={cn(
          "min-w-30 rounded-field px-2.5 py-1.5 text-[15px] font-semibold text-font-0 tabular-nums transition hover:bg-surface-hover",
          isOpen && "bg-surface-hover",
        )}
      >
        {formatMonthLabel(value)}
      </button>

      <button
        type="button"
        aria-label="다음달"
        disabled={isBlocked(shiftMonth(value, 1))}
        onClick={() => step(1)}
        className="flex size-8 shrink-0 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover hover:text-font-1 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight size={16} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-30 mt-1.5 w-64 rounded-card border border-border-main bg-surface p-3 shadow-card">
          {/* 연도 이동. 몇 년 전 기록을 보려면 이쪽이 먼저다. */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="이전 연도"
              disabled={viewYear - 1 < minYear}
              onClick={() => setViewYear((prev) => prev - 1)}
              className="flex size-7 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover hover:text-font-1 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="text-[14px] font-semibold text-font-0 tabular-nums">
              {viewYear}년
            </span>

            <button
              type="button"
              aria-label="다음 연도"
              disabled={viewYear + 1 > maxYear}
              onClick={() => setViewYear((prev) => prev + 1)}
              className="flex size-7 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover hover:text-font-1 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1">
            {MONTHS.map((month) => {
              const key = toMonthKey(viewYear, month);
              const isSelected = key === value;
              const blocked = isBlocked(key);

              return (
                <button
                  key={month}
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    onChange(key);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "rounded-field py-1.5 text-[13px] tabular-nums transition",
                    isSelected
                      ? "bg-brand font-semibold text-white"
                      : "text-font-1 hover:bg-surface-hover",
                    blocked && "pointer-events-none text-font-disabled",
                  )}
                >
                  {month}월
                </button>
              );
            })}
          </div>

          {/*
            이번 달로 한 번에 돌아온다.
            몇 년 전을 뒤지다 보면 되돌아오는 길이 멀다.
          */}
          <button
            type="button"
            disabled={value === maxMonth}
            onClick={() => {
              onChange(maxMonth);
              setIsOpen(false);
            }}
            className="mt-2 w-full rounded-field border border-border-main py-1.5 text-[12px] text-font-2 transition hover:border-brand hover:text-brand disabled:pointer-events-none disabled:opacity-40"
          >
            이번 달 ({formatMonthLabel(maxMonth)})
          </button>
        </div>
      )}
    </div>
  );
};

export default MonthPicker;

/** 달 라벨만 필요할 때. (`2026년 8월`) */
export { formatMonthLabel, monthOf, yearOf };
