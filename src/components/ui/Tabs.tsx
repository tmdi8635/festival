import { cn } from "@/lib/utils";

export interface TabItem<T extends string = string> {
  label: string;
  value: T;
  /** 라벨 우측 개수 표기 */
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** 스크린샷의 법적 고지 화면과 동일한 언더라인 탭 */
const Tabs = <T extends string>({
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) => {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-1 overflow-x-auto border-b border-border-main scrollbar-thin",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[14px] whitespace-nowrap transition sm:px-4",
              isActive
                ? "border-brand font-semibold text-brand"
                : "border-transparent text-font-2 hover:text-font-1",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="ml-1.5 tabular-nums">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
