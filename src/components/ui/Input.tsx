import { ComponentPropsWithoutRef, ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends ComponentPropsWithoutRef<"input"> {
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  hasError?: boolean;
  inputBoxClassName?: string;
}

/** react-hook-form의 register를 그대로 받기 위해 ref를 전달한다. */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { leftIcon, rightSlot, hasError, inputBoxClassName, className, ...props },
    ref,
  ) => {
    return (
      <div
        className={cn(
          "flex h-10 items-center gap-2 rounded-field border bg-surface px-3 transition",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-opacity",
          hasError ? "border-danger" : "border-border-main",
          props.disabled && "cursor-not-allowed bg-subtle opacity-60",
          inputBoxClassName,
        )}
      >
        {leftIcon && (
          <span className="shrink-0 text-font-disabled">{leftIcon}</span>
        )}

        <input
          ref={ref}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[14px] text-font-1 outline-none",
            "placeholder:text-font-disabled disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        />

        {rightSlot && <span className="shrink-0">{rightSlot}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
