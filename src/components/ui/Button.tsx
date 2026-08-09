import { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import Spinner from "./Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerGhost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** 텍스트 좌측 아이콘. 로딩 중에는 스피너로 대체된다. */
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-font-4 hover:bg-brand-hover",
  secondary:
    "border border-border-main bg-surface text-font-1 hover:bg-surface-hover",
  ghost: "text-font-2 hover:bg-surface-hover hover:text-font-1",
  danger: "bg-danger text-white hover:opacity-90",
  dangerGhost: "text-danger hover:bg-danger-bg",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-[14px]",
  lg: "h-12 gap-2 px-6 text-[15px]",
};

const SPINNER_SIZE: Record<ButtonSize, number> = {
  sm: 13,
  md: 15,
  lg: 17,
};

const Button = ({
  variant = "secondary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  type = "button",
  disabled,
  className,
  children,
  ...props
}: ButtonProps) => {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-field font-medium whitespace-nowrap transition",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {isLoading ? <Spinner size={SPINNER_SIZE[size]} /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
};

export default Button;
