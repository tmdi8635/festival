"use client";

import { cn } from "@/lib/utils";
import {
  DAY_OFFSET_CHIP_LABEL,
  DAY_OFFSET_LABEL,
  DAY_OFFSET_VALUES,
  type DayOffset,
} from "@/type/event";

interface DayOffsetFieldProps {
  value: DayOffset;
  onChange: (dayOffset: DayOffset) => void;
  /** 기준이 되는 날. "05.03 기준"처럼 어디서부터 세는지 알려 준다. */
  baseLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 종료가 며칠 뒤인지 고르는 버튼.
 *
 * 행사 종료 시각과 실제 퇴근 시각이 **같은 문제**를 갖는다.
 * `13:00~14:00`이 한 시간짜리인지 25시간짜리인지 시각만으로는 알 수 없다.
 * 방송 현장은 24시간을 통으로 넘기는 근무가 드물지 않고, 이틀을 넘기는 일도
 * 아예 없다고는 할 수 없어서 D+2까지 열어 둔다.
 *
 * 체크박스 하나("자정 넘김")로 두면 D+2를 표현할 수 없고,
 * 숫자 입력으로 두면 무엇을 넣어야 하는지 아무도 모른다.
 * 그래서 **누르면 끝나는 버튼 세 개**로 둔다.
 *
 * 이 컴포넌트가 유일한 원본이다. 화면마다 따로 만들면 어떤 화면은 D+1까지만
 * 되고 어떤 화면은 D+2까지 되는 상태가 되고, 그 차이는 정산 금액으로 나타난다.
 */
const DayOffsetField = ({
  value,
  onChange,
  baseLabel,
  disabled = false,
  className,
}: DayOffsetFieldProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="inline-flex rounded-field border border-border-main p-0.5">
        {DAY_OFFSET_VALUES.map((dayOffset) => (
          <button
            key={dayOffset}
            type="button"
            disabled={disabled}
            aria-pressed={value === dayOffset}
            title={`종료가 ${DAY_OFFSET_LABEL[dayOffset]}입니다.`}
            onClick={() => onChange(dayOffset)}
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-[12px] font-medium transition",
              "disabled:cursor-not-allowed disabled:opacity-50",
              value === dayOffset
                ? "bg-brand text-font-4"
                : "text-font-2 hover:bg-surface-hover hover:text-font-1",
            )}
          >
            {DAY_OFFSET_CHIP_LABEL[dayOffset]}
          </button>
        ))}
      </div>

      {/*
        고른 값이 무슨 뜻인지 말로 한 번 더 적는다.
        D+1이 "다음 날"이라는 것은 만든 사람에게만 자명하다.
      */}
      <span
        className={cn(
          "text-[12px]",
          value > 0 ? "font-medium text-warning" : "text-font-2",
        )}
      >
        {DAY_OFFSET_LABEL[value]}에 종료
        {baseLabel && value > 0 ? ` · ${baseLabel} 기준` : ""}
      </span>
    </div>
  );
};

export default DayOffsetField;
