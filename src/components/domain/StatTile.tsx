import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: ReactNode;
  /** 값 아래 보조 설명 */
  description?: string;
  icon?: ReactNode;
  /** 주의가 필요한 숫자는 색으로 먼저 알린다. */
  tone?: "default" | "warning" | "danger";
  className?: string;
}

const TONE_CLASS = {
  default: "text-font-0",
  warning: "text-warning",
  danger: "text-danger",
} as const;

/** 대시보드 · 목록 상단에서 쓰는 지표 타일. */
const StatTile = ({
  label,
  value,
  description,
  icon,
  tone = "default",
  className,
}: StatTileProps) => {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-card border border-border-main bg-surface p-4 shadow-card lg:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] text-font-2">{label}</p>
        {icon && <span className="shrink-0 text-font-disabled">{icon}</span>}
      </div>

      <p
        className={cn(
          /*
            좁은 화면에서 26px를 고집하면 "573,300,000원"이 칸을 넘어 잘린다.
            잘린 금액은 아무 쓸모가 없으므로 글자를 줄이고,
            그래도 모자라면 줄을 바꾼다. 두 줄이 되는 편이 잘리는 것보다 낫다.
          */
          "text-[20px] leading-tight font-bold break-all tabular-nums sm:text-[22px] lg:text-[26px]",
          TONE_CLASS[tone],
        )}
      >
        {value}
      </p>

      {description && (
        <p className="text-[12px] text-font-2">{description}</p>
      )}
    </div>
  );
};

export default StatTile;
