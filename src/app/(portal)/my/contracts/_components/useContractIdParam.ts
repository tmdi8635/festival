"use client";

import { useSearchParams } from "next/navigation";

/**
 * 주소의 `?id=` 계약서 번호.
 *
 * 포털은 정적으로 내보내므로 `/my/contracts/[id]` 같은 동적 경로를 만들 수 없다.
 * 번호는 쿼리로 받는다. 숫자가 아니면 `null` — 조회를 걸지 않고 곧장
 * '찾을 수 없음'으로 보낸다. `NaN`으로 조회를 걸면 404가 한 번 나가고 끝이다.
 */
export const useContractIdParam = (): number | null => {
  const value = Number(useSearchParams().get("id"));

  return Number.isInteger(value) && value > 0 ? value : null;
};
