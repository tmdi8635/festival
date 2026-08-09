import { useEffect, useState } from "react";

/**
 * 입력값이 멈춘 뒤에만 갱신되는 값을 돌려준다.
 * 타이핑마다 서버를 때리지 않도록 검색 입력에 사용한다.
 */
export const useDebounce = <T>(value: T, delay = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};
