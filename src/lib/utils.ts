// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 숫자에 3자리마다 콤마를 추가하는 함수
 * @param value - 포맷팅할 숫자 또는 숫자형 문자열
 * @returns 콤마가 포함된 문자열 (ex: 1,234,567)
 */
export const formatWithCommas = (value: number | string): string => {
  const num = typeof value === "string" ? Number(value) : value;

  // 숫자가 아니거나 유효하지 않은 값이 들어오면 '0'을 반환
  if (isNaN(num)) return "0";

  return new Intl.NumberFormat("ko-KR").format(num);
};

/**
 * 숫자 포맷터
 * 규칙:
 * - 999 이하: 그대로 표시
 * - 1,000 ~ 9,999: '천' 단위 (소수점 한자리, 내림)
 * - 10,000 ~ 99,999,999: '만' 단위 (정수, 내림)
 * - 100,000,000 이상: '억' 단위 (정수, 내림)
 */
export const formatStatCount = (count: number): string => {
  if (count >= 100_000_000) {
    return `${Math.floor(count / 100_000_000)}억`;
  }

  if (count >= 10_000) {
    return `${Math.floor(count / 10_000)}만`;
  }

  if (count >= 1_000) {
    const truncated = Math.floor((count / 1000) * 10) / 10;
    return `${truncated.toFixed(1)}천`;
  }

  return count.toString();
};

/**
 * 최소 통화 단위(원) 금액을 표시용 문자열로 변환한다.
 * 관리자에서 다루는 모든 금액은 원 단위 정수다.
 */
export const formatCurrency = (amount: number): string =>
  `${formatWithCommas(amount)}원`;

/** 크레딧은 정수 단위로만 관리한다. */
export const formatCredit = (credit: number): string =>
  `${formatWithCommas(Math.trunc(credit))} CR`;

/** 증감률을 부호가 붙은 문자열로 변환한다. (ex: +12.4%) */
export const formatDelta = (rate: number): string => {
  const sign = rate > 0 ? "+" : "";

  return `${sign}${rate.toFixed(1)}%`;
};

/** 긴 문자열을 말줄임 처리한다. 표 셀에서 주로 사용한다. */
export const truncate = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;

/** 배열 요소를 from → to 위치로 옮긴 새 배열을 반환한다. (드래그 정렬용) */
export const reorder = <T>(items: T[], from: number, to: number): T[] => {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  return next;
};
