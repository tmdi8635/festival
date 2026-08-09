import { Fragment, ReactNode } from "react";
import { cn } from "@/lib/utils";
import EmptyState from "./EmptyState";
import Skeleton from "./Skeleton";

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  /** 셀 렌더러. 없으면 아무것도 그리지 않는다. */
  render: (row: T, index: number) => ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  /** 숫자 컬럼은 tabular-nums를 자동 적용한다. */
  numeric?: boolean;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  isLoading?: boolean;
  /** 로딩 중 보여줄 스켈레톤 행 개수 */
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

/**
 * 관리자 공통 표.
 * 컨테이너(Card)는 호출부에서 감싼다. 표 자체는 경계선만 담당한다.
 */
const Table = <T,>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  skeletonRows = 8,
  emptyTitle = "데이터가 없습니다.",
  emptyDescription,
  emptyAction,
  onRowClick,
  className,
}: TableProps<T>) => {
  const isEmpty = !isLoading && rows.length === 0;

  return (
    /*
        등장 애니메이션은 **표 전체에 한 번**만 건다.
        행마다 걸면 transform이 행마다 쌓임 맥락을 만들어,
        행 안에서 연 더보기 메뉴가 다음 행에 덮인다.
      */
      <div
        className={cn("animate-rise w-full overflow-x-auto scrollbar-thin", className)}
      >
      <table className="w-full min-w-max text-[14px]">
        <thead>
          <tr className="bg-subtle">
            {columns.map(({ key, header, width, align = "left" }) => (
              <th
                key={key}
                style={{ width }}
                className={cn(
                  "px-4 py-3 text-[13px] font-medium whitespace-nowrap text-font-2",
                  ALIGN_CLASS[align],
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isLoading &&
            Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border-main">
                {columns.map(({ key }) => (
                  <td key={key} className="px-4 py-3.5">
                    <Skeleton className="h-4 w-full max-w-40" />
                  </td>
                ))}
              </tr>
            ))}

          {!isLoading &&
            rows.map((row, rowIndex) => (
              <tr
                key={getRowKey(row, rowIndex)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-t border-border-main transition-colors hover:bg-surface-hover",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map(({ key, render, align = "left", numeric }) => (
                  <td
                    key={key}
                    className={cn(
                      "px-4 py-3.5 text-font-1",
                      ALIGN_CLASS[align],
                      numeric && "tabular-nums",
                    )}
                  >
                    {render(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>

      {isEmpty && (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      )}
    </div>
  );
};

export default Table;

/** 표 셀 안에서 이름 + 보조 정보를 함께 보여줄 때 사용한다. */
export const TableCellStack = ({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
}) => (
  <Fragment>
    <p className="text-font-1">{primary}</p>
    {secondary && <p className="mt-0.5 text-[12px] text-font-2">{secondary}</p>}
  </Fragment>
);
