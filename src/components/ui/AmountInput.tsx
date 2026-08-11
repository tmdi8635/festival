"use client";

import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { formatWithCommas } from "@/lib/utils";
import Input from "./Input";

interface AmountInputProps
  extends Omit<
    ComponentPropsWithoutRef<"input">,
    "value" | "onChange" | "type" | "inputMode"
  > {
  value: number;
  onValueChange: (value: number) => void;
  rightSlot?: ReactNode;
  hasError?: boolean;
  inputBoxClassName?: string;
}

/**
 * 금액 입력칸. **세 자리마다 쉼표를 찍어 보여 준다.**
 *
 * `type="number"`로는 쉼표를 찍을 수 없다. 브라우저가 값을 숫자로만 받기 때문이다.
 * 그런데 단가는 자릿수를 눈으로 세어야 하는 값이다. `130000`과 `1300000`은
 * 쉼표가 없으면 훑어볼 때 구분되지 않고, 0을 하나 더 찍은 실수가 그대로 저장된다.
 *
 * 그래서 화면에는 글자로 두고 숫자만 남겨 밖으로 넘긴다.
 * (`inputMode="numeric"`이라 휴대폰에서도 숫자 자판이 뜬다)
 */
const AmountInput = ({
  value,
  onValueChange,
  onBlur,
  ...props
}: AmountInputProps) => {
  /*
    입력 중에는 draft가 화면을 담당한다.

    값을 지우면 숫자로는 0인데, 그때 화면에 "0"을 도로 그려 넣으면
    새 금액을 적으려던 사람이 `018000`을 얻는다. 비운 상태를 잠깐 그대로 두고
    칸을 떠날 때 서버 값(=숫자)으로 다시 맞춘다.
  */
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      {...props}
      inputMode="numeric"
      value={draft ?? formatWithCommas(value)}
      onChange={(event) => {
        // 쉼표를 지우고 숫자만 남긴다. 붙여넣기로 들어온 "18,000원"도 받아 준다.
        const digits = event.target.value.replace(/[^\d]/g, "");

        setDraft(digits === "" ? "" : formatWithCommas(Number(digits)));
        onValueChange(digits === "" ? 0 : Number(digits));
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
};

export default AmountInput;
