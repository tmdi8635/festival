import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** 우측 액션 슬롯. primary 버튼은 여기에 하나만 둔다. */
  action?: ReactNode;
  className?: string;
}

/** 모든 관리자 페이지는 이 헤더로 시작한다. */
const PageHeader = ({
  title,
  description,
  action,
  className,
}: PageHeaderProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold text-font-0 sm:text-[28px]">{title}</h1>
        {description && (
          <p className="mt-1.5 text-[14px] text-font-2">{description}</p>
        )}
      </div>

      {action && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {action}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
