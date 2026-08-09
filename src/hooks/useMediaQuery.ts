"use client";

import { useSyncExternalStore } from "react";

/**
 * 미디어 쿼리 일치 여부.
 *
 * 화면 폭에 따라 **구조가 달라지는** 곳에만 쓴다.
 * 보이고 안 보이고는 Tailwind의 `lg:` 접두사로 처리하는 편이 낫다.
 * (CSS로 되는 일을 자바스크립트로 하면 첫 렌더에 깜빡인다)
 *
 * 사이드바가 그런 경우다. 넓은 화면에서는 자리를 차지하며 접히고,
 * 좁은 화면에서는 본문 위에 덮이는 서랍이 된다. 접힘 상태를 그대로 물려주면
 * 서랍이 아이콘만 남은 채로 열려서 아무것도 고를 수 없다.
 *
 * `useSyncExternalStore`를 쓰는 이유는 서버 렌더 결과와 어긋나지 않게 하기 위해서다.
 * 서버에는 창이 없으므로 항상 `false`로 시작하고, 마운트된 뒤 실제 값으로 맞춘다.
 */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = (onStoreChange: () => void) => {
    const list = window.matchMedia(query);

    list.addEventListener("change", onStoreChange);

    return () => list.removeEventListener("change", onStoreChange);
  };

  const getSnapshot = () => window.matchMedia(query).matches;
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

/** Tailwind `lg` 기준. 이 위에서만 사이드바가 자리를 차지한다. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
