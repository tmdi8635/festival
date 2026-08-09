import { ComponentPropsWithoutRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends ComponentPropsWithoutRef<"textarea"> {
  hasError?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ hasError, className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full rounded-field border bg-surface px-3 py-2.5 text-[14px] text-font-1 transition outline-none",
          "placeholder:text-font-disabled",
          "focus:border-brand focus:ring-2 focus:ring-brand-opacity",
          "disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60",
          hasError ? "border-danger" : "border-border-main",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
