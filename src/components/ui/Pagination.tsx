import { ChevronLeft, ChevronRight } from "@/icons";
import { cn, formatWithCommas } from "@/lib/utils";

interface PaginationProps {
  /** 1부터 시작하는 현재 페이지 */
  page: number;
  totalCount: number;
  pageSize: number;
  onChange: (page: number) => void;
  className?: string;
}

/** 한 번에 노출할 페이지 번호 개수 */
const PAGE_BLOCK_SIZE = 5;

const Pagination = ({
  page,
  totalCount,
  pageSize,
  onChange,
  className,
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const blockIndex = Math.floor((page - 1) / PAGE_BLOCK_SIZE);
  const firstPage = blockIndex * PAGE_BLOCK_SIZE + 1;
  const lastPage = Math.min(firstPage + PAGE_BLOCK_SIZE - 1, totalPages);

  const pages = Array.from(
    { length: lastPage - firstPage + 1 },
    (_, index) => firstPage + index,
  );

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t border-border-main px-5 py-3.5",
        className,
      )}
    >
      <p className="text-[13px] text-font-2 tabular-nums">
        총 {formatWithCommas(totalCount)}건
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="이전 페이지"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="flex size-8 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onChange(pageNumber)}
            className={cn(
              "flex size-8 items-center justify-center rounded-field text-[13px] tabular-nums transition",
              pageNumber === page
                ? "bg-surface-selected font-semibold text-brand"
                : "text-font-2 hover:bg-surface-hover hover:text-font-1",
            )}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          aria-label="다음 페이지"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="flex size-8 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
