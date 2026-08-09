"use client";

import { useState } from "react";
import { useKeywordParam } from "@/hooks/useKeywordParam";

/**
 * 목록 화면의 검색어 · 페이지 상태.
 *
 * 목록 화면 11곳이 전부 같은 네 줄로 시작하고 있었다.
 * 전역 검색(⌘K)에서 넘어온 `?keyword=`를 초기값으로 쓰되,
 * 화면에서 한 번이라도 검색하면 그때부터는 그 값이 우선해야 한다.
 * (`draft`가 `null`인 동안만 URL 값을 본다 — 7장의 draft 패턴과 같다.
 *  URL 값을 `useState` 초기값으로 넣으면 ⌘K로 다시 넘어와도 화면이 안 바뀐다)
 *
 * 페이지를 함께 들고 있는 이유는 둘이 늘 같이 움직이기 때문이다.
 * **검색어나 필터가 바뀌면 결과가 통째로 달라지므로 항상 1페이지로 되돌린다.**
 * 3페이지를 보던 중에 필터를 걸면 그 조건의 3페이지가 비어 있어서
 * "결과 없음"이 뜬다. 데이터가 없는 게 아니라 페이지가 남아 있던 것이다.
 *
 * 쓰는 화면의 page.tsx는 `<Suspense>`로 감싸야 한다. (`useKeywordParam` 참고)
 */
export const useListSearch = () => {
  const keywordParam = useKeywordParam();
  const [page, setPage] = useState(1);
  const [draftKeyword, setDraftKeyword] = useState<string | null>(null);
  const keyword = draftKeyword ?? keywordParam;

  /** `SearchInput`의 `onSearch`에 그대로 넘긴다. */
  const handleSearch = (nextKeyword: string) => {
    setDraftKeyword(nextKeyword);
    setPage(1);
  };

  /**
   * 필터 변경 핸들러를 감싸 페이지를 1로 되돌린다.
   *
   * ```tsx
   * onChange={withPageReset((event) => setStatus(event.target.value as StaffStatus | ""))}
   * ```
   *
   * 핸들러마다 `setPage(1)`을 손으로 적으면 필터를 하나 늘릴 때 빠뜨리고,
   * 빠뜨린 필터만 빈 화면을 내놓는다. 규칙을 자리에 박아 둔다.
   */
  const withPageReset =
    <T,>(apply: (value: T) => void) =>
    (value: T) => {
      apply(value);
      setPage(1);
    };

  return { page, setPage, keyword, handleSearch, withPageReset };
};
