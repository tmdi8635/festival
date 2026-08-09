import { ComponentPropsWithoutRef, forwardRef } from "react";
import { ChevronDown } from "@/icons";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
}

interface SelectProps extends ComponentPropsWithoutRef<"select"> {
  options: SelectOption[];
  placeholder?: string;
  hasError?: boolean;
  selectBoxClassName?: string;
}

/** 네이티브 select 기반. 다중 선택·검색이 필요하면 Dropdown을 쓴다. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { options, placeholder, hasError, selectBoxClassName, className, ...props },
    ref,
  ) => {
    return (
      <div
        className={cn(
          "relative flex h-10 items-center rounded-field border bg-surface transition",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-opacity",
          hasError ? "border-danger" : "border-border-main",
          props.disabled && "cursor-not-allowed bg-subtle opacity-60",
          selectBoxClassName,
        )}
      >
        <select
          ref={ref}
          className={cn(
            "h-full w-full cursor-pointer appearance-none bg-transparent pr-9 pl-3 text-[14px] text-font-1 outline-none",
            "disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {options.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 text-font-2"
        />
      </div>
    );
  },
);

Select.displayName = "Select";

export default Select;
