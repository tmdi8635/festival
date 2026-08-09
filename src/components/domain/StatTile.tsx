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
        "flex flex-col gap-1 rounded-card border border-border-main bg-surface p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-font-2">{label}</p>
        {icon && <span className="shrink-0 text-font-disabled">{icon}</span>}
      </div>

      <p
        className={cn(
          "text-[26px] font-bold tabular-nums",
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
