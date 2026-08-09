import { ReactNode } from "react";
import { CheckCircle, Info, Warning } from "@/icons";
import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<AlertTone, string> = {
  info: "border-info/20 bg-info-bg text-info",
  success: "border-success/20 bg-success-bg text-success",
  warning: "border-warning/20 bg-warning-bg text-warning",
  danger: "border-danger/20 bg-danger-bg text-danger",
};

const TONE_ICON: Record<AlertTone, ReactNode> = {
  info: <Info size={18} />,
  success: <CheckCircle size={18} />,
  warning: <Warning size={18} />,
  danger: <Warning size={18} />,
};

/**
 * 화면에 상시 노출되는 인라인 안내 배너.
 * 일회성 피드백은 Alert가 아니라 showAppToast를 사용한다.
 */
const Alert = ({
  tone = "info",
  title,
  children,
  action,
  className,
}: AlertProps) => {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-field border px-4 py-3",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="mt-px shrink-0">{TONE_ICON[tone]}</span>

      <div className="min-w-0 flex-1 text-[13px]">
        {title && <p className="font-semibold">{title}</p>}
        {children && (
          <div className={cn("text-font-2", title && "mt-1")}>{children}</div>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export default Alert;
