import { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IconButtonTone = "default" | "danger";

interface IconButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** 아이콘만 있으므로 스크린리더용 라벨을 반드시 받는다. */
  label: string;
  icon: ReactNode;
  tone?: IconButtonTone;
  /**
   * `lg`는 **손가락으로 누르는 자리**다. (44px — iOS 최소 권장)
   *
   * 마우스로 누르는 관리자 화면은 36px(`md`)로 충분하지만, 스태프 포털은
   * 걸으면서 한 손으로 누르는 화면이라 그 크기로는 실제로 빗나간다.
   */
  size?: "sm" | "md" | "lg";
}

const TONE_CLASS: Record<IconButtonTone, string> = {
  default: "text-font-2 hover:bg-surface-hover hover:text-font-1",
  danger: "text-font-2 hover:bg-danger-bg hover:text-danger",
};

const IconButton = ({
  label,
  icon,
  tone = "default",
  size = "md",
  type = "button",
  className,
  ...props
}: IconButtonProps) => {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-field transition",
        "active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "size-8" : size === "lg" ? "size-11" : "size-9",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
};

export default IconButton;
