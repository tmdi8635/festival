import { ComponentPropsWithoutRef, ReactNode, forwardRef } from "react";
import { Check } from "@/icons";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<ComponentPropsWithoutRef<"input">, "type"> {
  label?: ReactNode;
  boxClassName?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, boxClassName, className, disabled, ...props }, ref) => {
    return (
      <label
        className={cn(
          "group inline-flex cursor-pointer items-center gap-2 select-none",
          disabled && "cursor-not-allowed opacity-50",
          boxClassName,
        )}
      >
        <span className="relative inline-flex size-[18px] shrink-0 items-center justify-center">
          <input
            ref={ref}
            type="checkbox"
            disabled={disabled}
            className={cn("peer absolute inset-0 cursor-pointer opacity-0", className)}
            {...props}
          />

          <span
            className={cn(
              "pointer-events-none flex size-[18px] items-center justify-center rounded-[6px] border border-border-strong bg-surface text-transparent transition",
              "peer-checked:border-brand peer-checked:bg-brand peer-checked:text-font-4",
              "group-hover:peer-enabled:border-brand",
            )}
          >
            <Check size={12} strokeWidth={2.6} />
          </span>
        </span>

        {label && <span className="text-[14px] text-font-1">{label}</span>}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
