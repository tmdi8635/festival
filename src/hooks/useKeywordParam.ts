"use client";

import { useSearchParams } from "next/navigation";

/**
 * URL의 `?keyword=` 값을 읽는다.
 *
 * 전역 검색(⌘K)에서 데이터 결과를 고르면 해당 목록 화면으로 검색어를 실어 이동한다.
 * 목록 화면은 이 값을 초기 검색어로 사용한다.
 *
 * 사용하는 화면의 page.tsx는 `<Suspense>`로 감싸야 한다.
 * (useSearchParams는 정적 프리렌더 시 경계가 필요하다)
 */
export const useKeywordParam = () => useSearchParams().get("keyword") ?? "";
