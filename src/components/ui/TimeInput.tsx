"use client";

import { ComponentPropsWithoutRef, useState } from "react";
import { Clock } from "@/icons";
import Input from "./Input";

type TimeInputProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "value" | "onChange"
> & {
  /** `HH:mm` 또는 빈 문자열 */
  value: string;
  /** 항상 `HH:mm` 또는 빈 문자열로만 올라간다. 입력 중인 반쪽 값은 올리지 않는다. */
  onChange: (value: string) => void;
  hasError?: boolean;
  inputBoxClassName?: string;
};

/**
 * 시각 입력. **언제나 24시간제다.**
 *
 * `<input type="time">`을 쓰지 않는다. 오전/오후로 그릴지 `18:00`으로 그릴지를
 * **브라우저(OS) 언어가 정하고**, 한국어 환경에서는 오전/오후가 된다.
 * 요소에 `lang`을 박아도 크롬은 따르지 않는다.
 *
 * 현장 시간은 `18:00~04:00`처럼 자정을 넘기는 일이 잦다.
 * 오전/오후로 읽으면 "04:00이 다음 날인가"를 한 번 더 따져야 하고,
 * 그 한 번이 근무시간과 정산 금액을 통째로 어긋나게 한다.
 *
 * 그래서 네이티브 피커를 버리고 **숫자만 받는다.**
 * `1830`처럼 네 자리를 이어 치면 되고, `9`만 쳐도 `09:00`이 된다.
 * 저장되는 값은 예전과 같은 `HH:mm`이라 이 컴포넌트 밖은 아무것도 달라지지 않는다.
 */

/** 자릿수에 따라 사람이 뜻한 시각으로 읽는다. (`9`→09:00, `930`→09:30, `1830`→18:30) */
const parseDigits = (digits: string): string => {
  if (!digits) return "";

  const [hour, minute] =
    digits.length <= 2
      ? [Number(digits), 0]
      : [Number(digits.slice(0, digits.length - 2)), Number(digits.slice(-2))];

  const safeHour = Math.min(23, Math.max(0, hour));
  const safeMinute = Math.min(59, Math.max(0, minute));

  return `${String(safeHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`;
};

/** 위/아래 화살표로 5분씩 옮긴다. 현장 시각은 5분 단위로 정하는 일이 많다. */
const shiftMinutes = (value: string, delta: number): string => {
  const [hour, minute] = value ? value.split(":").map(Number) : [0, 0];
  const total = (hour * 60 + minute + delta + 24 * 60) % (24 * 60);

  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const TimeInput = ({
  value,
  onChange,
  hasError,
  inputBoxClassName,
  ...props
}: TimeInputProps) => {
  /*
    입력 중에는 숫자만 그대로 보여 준다. (`1830`)
    치는 동안 콜론을 끼워 넣으면 `9`, `3`을 이어 쳤을 때 `93:`이 되어
    사람이 자기가 뭘 쳤는지 놓친다. 콜론은 다 치고 나서 붙인다.
  */
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (digits: string) => {
    setDraft(null);
    onChange(parseDigits(digits));
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      hasError={hasError}
      inputBoxClassName={inputBoxClassName}
      placeholder={props.placeholder ?? "18:00"}
      value={draft ?? value}
      rightSlot={<Clock size={15} className="text-font-disabled" />}
      /* 고쳐 넣을 때 앞자리에 이어 붙지 않도록 통째로 잡아 준다. */
      onFocus={(event) => {
        event.target.select();
        props.onFocus?.(event);
      }}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 4);

        setDraft(digits);

        // 네 자리를 다 치면 곧바로 반영한다. 흐릿한 상태로 두지 않는다.
        if (digits.length === 4) commit(digits);
      }}
      onBlur={(event) => {
        commit(event.target.value.replace(/\D/g, "").slice(0, 4));
        props.onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          setDraft(null);
          onChange(shiftMinutes(value, event.key === "ArrowUp" ? 5 : -5));
        }

        props.onKeyDown?.(event);
      }}
    />
  );
};

export default TimeInput;
