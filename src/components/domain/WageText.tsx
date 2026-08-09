import { WAGE_TYPE_LABEL, type WageType } from "@/type/event";
import { cn, formatCurrency } from "@/lib/utils";

interface WageTextProps {
  wageType: WageType;
  wage: number;
  /** 금액을 굵게 키운다. 그 화면의 주인공이 금액일 때만 켠다. */
  isEmphasized?: boolean;
  className?: string;
}

/**
 * 지급 기준 + 금액 표기.
 *
 * 금액만 적으면 12,000원이 시급인지 일급인지 알 수 없다.
 * 자릿수로 짐작하게 두면 반나절 일급(9만원)과 고급 인력 시급(9만원)이 구분되지 않는다.
 * 그래서 금액이 나가는 모든 자리에서 기준을 함께 적는다.
 *
 * 기준과 금액은 **한 줄에 가로로** 놓는다.
 * 두 줄로 쌓으면 표의 행 높이가 값마다 들쭉날쭉해지고, 무엇보다
 * 눈이 금액을 먼저 잡은 뒤 기준을 찾아 아래로 한 번 더 내려가야 한다.
 * 읽는 순서가 곧 뜻이므로 "일급 130,000원"처럼 말하는 순서대로 적는다.
 */
const WageText = ({
  wageType,
  wage,
  isEmphasized = false,
  className,
}: WageTextProps) => {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {/*
        기준은 금액에 딸린 라벨이다. 칩으로 묶어 두면 숫자와 뒤섞이지 않고,
        시급 · 일급이 섞인 표에서 두 종류를 한눈에 갈라 볼 수 있다.
      */}
      <span className="shrink-0 rounded-[5px] bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-font-2">
        {WAGE_TYPE_LABEL[wageType]}
      </span>

      <span
        className={cn(
          "tabular-nums",
          isEmphasized
            ? "text-[14px] font-semibold text-font-0"
            : "text-[13px] text-font-1",
        )}
      >
        {formatCurrency(wage)}
      </span>
    </span>
  );
};

export default WageText;
