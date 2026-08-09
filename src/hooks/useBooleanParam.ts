"use client";

import { useSearchParams } from "next/navigation";

/**
 * URL의 `?이름=true` 여부를 읽는다.
 *
 * 대시보드의 할 일 목록은 "인원 미충원 13건" 같은 항목을 눌러 처리 화면으로 보낸다.
 * 이때 필터가 걸린 채로 열리지 않으면 전체 목록에서 다시 찾아야 해서
 * 할 일에서 넘어온 의미가 사라진다.
 *
 * 사용하는 화면의 page.tsx는 `<Suspense>`로 감싸야 한다.
 * (useSearchParams는 정적 프리렌더 시 경계가 필요하다)
 */
export const useBooleanParam = (name: string): boolean =>
  useSearchParams().get(name) === "true";
