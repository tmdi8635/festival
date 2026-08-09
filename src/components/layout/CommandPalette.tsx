"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useGlobalSearchQuery,
  type GlobalSearchType,
} from "@/api/search/getGlobalSearch";
import { ADMIN_MENU } from "@/constants/menu";
import { useDebounce } from "@/hooks/useDebounce";
import { useIsClient } from "@/hooks/useIsClient";
import { ChevronRight, Search } from "@/icons";
import { cn } from "@/lib/utils";
import { useOrgStore } from "@/store/useOrgStore";
import type { FeatureKey } from "@/type/ops";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";

interface CommandItem {
  href: string;
  label: string;
  /** 1뎁스 라벨. 같은 이름의 2뎁스를 구분하기 위해 함께 보여준다. */
  groupLabel: string;
  /** 이 항목이 속한 기능. MOCK이면 배지를 붙이고 LOCKED면 결과에서 뺀다. */
  feature?: FeatureKey;
  /** 검색 대상 문자열 (라벨 + 그룹 + 경로). 데이터 결과는 서버가 걸러서 비어 있다. */
  keywords: string;
  /** 데이터 결과의 보조 설명 (이메일, 캐릭터명 등) */
  description?: string;
}

/** 데이터 검색 결과의 종류 표기 */
const SEARCH_TYPE_LABEL: Record<GlobalSearchType, string> = {
  STAFF: "인력",
  EVENT: "행사",
  CLIENT: "거래처",
};

/** 메뉴 트리를 평평한 검색 대상 목록으로 편다. */
const buildCommandItems = (): CommandItem[] =>
  ADMIN_MENU.flatMap((group) => {
    if (group.href) {
      return [
        {
          href: group.href,
          label: group.label,
          groupLabel: group.label,
          feature: group.feature,
          keywords: `${group.label} ${group.href}`,
        },
      ];
    }

    return (group.children ?? []).map((child) => ({
      href: child.href,
      label: child.label,
      groupLabel: group.label,
      feature: child.feature ?? group.feature,
      keywords: `${child.label} ${group.label} ${child.href}`,
    }));
  });

const COMMAND_ITEMS = buildCommandItems();

/**
 * 전역 검색 (⌘K / Ctrl+K).
 *
 * 메뉴 이동과 데이터 검색을 한 곳에서 처리한다.
 * - 메뉴: 입력 즉시 클라이언트에서 필터링한다.
 * - 데이터(인력 · 행사 · 거래처): 두 글자 이상일 때 서버에 조회한다.
 *   선택하면 해당 목록 화면으로 검색어를 넣은 채 이동한다.
 *
 * 현장에서 "그 사람 지난번에 어디 갔었지"를 가장 자주 찾으므로
 * 인력 결과를 항상 맨 위에 둔다.
 */
const CommandPalette = () => {
  const router = useRouter();
  const isClient = useIsClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // 타이핑마다 조회하지 않도록 서버 검색어만 지연시킨다.
  const debouncedKeyword = useDebounce(keyword, 250);
  const { data: searchData, isFetching } =
    useGlobalSearchQuery(debouncedKeyword);

  // 잠긴 기능은 검색으로도 들어갈 수 없어야 한다. 사이드바에서만 감추면 소용이 없다.
  const featureModes = useOrgStore((state) => state.featureModes);

  const menuResults = useMemo(() => {
    const available = COMMAND_ITEMS.filter(
      (item) => !item.feature || featureModes[item.feature] !== "LOCKED",
    );
    const lowered = keyword.trim().toLowerCase();

    if (!lowered) return available;

    return available.filter((item) =>
      item.keywords.toLowerCase().includes(lowered),
    );
  }, [keyword, featureModes]);

  const dataResults: CommandItem[] = useMemo(
    () =>
      (searchData?.items ?? []).map((item) => ({
        href: item.href,
        label: item.title,
        groupLabel: SEARCH_TYPE_LABEL[item.type],
        description: item.description,
        keywords: "",
      })),
    [searchData],
  );

  // 방향키·Enter가 두 목록을 하나처럼 다루도록 합친다.
  const results = useMemo(
    () => [...menuResults, ...dataResults],
    [menuResults, dataResults],
  );

  // ⌘K / Ctrl+K 로 열고 ESC로 닫는다.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const close = () => {
    setIsOpen(false);
    setKeyword("");
    setActiveIndex(0);
  };

  const move = (item: CommandItem) => {
    router.push(item.href);
    close();
  };

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(results.length, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + results.length) % Math.max(results.length, 1),
      );
      return;
    }

    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      move(results[activeIndex]);
    }
  };

  if (!isClient || !isOpen) return null;

  return createPortal(
    <div
      onClick={close}
      className="animate-fade-in fixed inset-0 z-100 flex items-start justify-center bg-overlay p-6 pt-[12vh] backdrop-blur-[2px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="통합 검색"
        onClick={(event) => event.stopPropagation()}
        className="animate-slide-up flex max-h-[60vh] w-[540px] max-w-full flex-col overflow-hidden rounded-modal bg-surface shadow-modal"
      >
        <div className="flex items-center gap-2.5 border-b border-border-main px-4">
          <Search size={17} className="shrink-0 text-font-disabled" />

          <input
            ref={inputRef}
            autoFocus
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="메뉴 · 인력 · 행사 · 거래처 검색"
            className="h-12 flex-1 bg-transparent text-[14px] text-font-1 outline-none placeholder:text-font-disabled"
          />

          {isFetching && <Spinner size={15} className="text-font-disabled" />}

          <kbd className="shrink-0 rounded-[6px] bg-subtle px-1.5 py-0.5 text-[11px] text-font-2">
            ESC
          </kbd>
        </div>

        <ul className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-[13px] text-font-2">
              {keyword.trim().length < 2
                ? "두 글자 이상 입력하면 인력 · 행사도 함께 찾습니다."
                : "검색 결과가 없습니다."}
            </li>
          )}

          {results.map((item, index) => (
            <li key={`${item.groupLabel}-${item.href}`}>
              {/* 메뉴 목록과 데이터 목록 사이에 구분선을 넣는다. */}
              {index === menuResults.length && menuResults.length > 0 && (
                <p className="mt-2 border-t border-border-main px-3 pt-3 pb-1 text-[12px] font-medium text-font-2">
                  검색 결과
                </p>
              )}

              <button
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => move(item)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-field px-3 py-2.5 text-left transition",
                  index === activeIndex
                    ? "bg-surface-selected text-brand"
                    : "text-font-1 hover:bg-surface-hover",
                )}
              >
                <span className="shrink-0 text-[12px] text-font-2">
                  {item.groupLabel}
                </span>
                <ChevronRight size={13} className="shrink-0 text-font-disabled" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                  {item.label}
                </span>

                {item.description && (
                  <span className="shrink-0 truncate text-[12px] text-font-2">
                    {item.description}
                  </span>
                )}

                {item.feature && featureModes[item.feature] === "MOCK" && (
                  <Badge tone="warning" className="px-1.5 py-0.5 text-[10px]">
                    MOCK
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
};

export default CommandPalette;
