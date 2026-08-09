import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** 라벨 우측 보조 설명 */
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * 라벨 · 입력 · 에러 메시지 묶음.
 * 에러 영역 높이를 항상 예약해 메시지 노출 시 레이아웃이 밀리지 않게 한다.
 */
const FormField = ({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  className,
}: FormFieldProps) => {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-medium text-font-1"
        >
          {label}
          {required && <span className="ml-0.5 text-font-error">*</span>}
        </label>

        {hint && <span className="text-[12px] text-font-2">{hint}</span>}
      </div>

      {children}

      <p className="min-h-4 text-[12px] text-font-error">{error}</p>
    </div>
  );
};

export default FormField;
