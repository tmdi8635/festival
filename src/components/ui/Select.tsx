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
          "relative flex h-10 items-center overflow-hidden rounded-field border bg-surface transition",
          /*
            좁은 화면에서 고정 폭(w-28 등)을 그대로 쓰면 세 개만 놓여도 화면을 넘는다.
            그렇다고 flex-1로 늘리면 이번엔 셀렉트가 자리를 다 먹고 옆 버튼을 밀어낸다.
            **자라지 않되 줄어들 수 있게** 두고 바닥만 지킨다. 자리가 모자라면 줄로 넘어간다.
          */
          "min-w-32 shrink lg:min-w-0",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-opacity",
          hasError ? "border-danger" : "border-border-main",
          props.disabled && "cursor-not-allowed bg-subtle opacity-60",
          selectBoxClassName,
        )}
      >
        <select
          ref={ref}
          className={cn(
            "h-full w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-9 pl-3 text-[14px] text-ellipsis text-font-1 outline-none",
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
