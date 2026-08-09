import { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  /** 헤더 좌측 제목. 없으면 헤더 자체를 렌더링하지 않는다. */
  title?: ReactNode;
  description?: ReactNode;
  /** 헤더 우측 액션 영역 */
  action?: ReactNode;
  /** 본문 패딩 제거. 표를 그대로 넣을 때 사용한다. */
  noPadding?: boolean;
  bodyClassName?: string;
}

const Card = ({
  title,
  description,
  action,
  noPadding = false,
  bodyClassName,
  className,
  children,
  ...props
}: CardProps) => {
  return (
    <section
      className={cn(
        /*
          `overflow-hidden`으로 둥근 모서리 안쪽만 그린다.
          noPadding 카드에 목록·표를 넣으면 자식의 각진 배경이
          카드의 둥근 모서리를 뚫고 나온다.
        */
        "overflow-hidden rounded-card border border-border-main bg-surface shadow-card",
        className,
      )}
      {...props}
    >
      {title && (
        <header className="flex items-start justify-between gap-4 border-b border-border-main px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold whitespace-nowrap text-font-1">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-[13px] text-font-2">{description}</p>
            )}
          </div>

          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}

      <div className={cn(!noPadding && "p-5", bodyClassName)}>{children}</div>
    </section>
  );
};

export default Card;
