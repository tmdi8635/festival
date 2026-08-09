import { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  tone?: BadgeTone;
  leftIcon?: ReactNode;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-neutral-bg text-neutral",
  brand: "bg-brand-opacity text-brand",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
};

const Badge = ({
  tone = "neutral",
  leftIcon,
  className,
  children,
  ...props
}: BadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {leftIcon}
      {children}
    </span>
  );
};

export default Badge;
