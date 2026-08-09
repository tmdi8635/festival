import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 클라이언트 렌더링 여부.
 * portal 대상이나 테마처럼 서버 마크업과 달라질 수 있는 값을 다룰 때 사용한다.
 */
export const useIsClient = () => {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
