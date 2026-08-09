import { HttpResponse } from "msw";
import { DEFAULT_PAGE_SIZE, PageResponse } from "@/type/api";

/** 서버 베이스 URI. 모든 핸들러가 같은 값을 쓴다. */
export const BASE_URI = process.env.NEXT_PUBLIC_BASE_URI;

/** 대상이 없을 때 돌려주는 공통 응답 */
export const notFound = (message: string) =>
  HttpResponse.json({ code: "NOT_FOUND", message }, { status: 404 });

/** 요청 값이 잘못됐을 때 돌려주는 공통 응답 */
export const badRequest = (message: string, code = "BAD_REQUEST") =>
  HttpResponse.json({ code, message }, { status: 400 });

/** 목업 응답 지연 시간 (로딩 상태를 눈으로 확인하기 위한 값) */
export const MOCK_DELAY_MS = 250;

/** 배열을 목록 API 응답 형태로 감싼다. */
export const paginate = <T>(
  items: T[],
  url: URL,
): PageResponse<T> => {
  const page = Number(url.searchParams.get("page") ?? 1);
  const size = Number(url.searchParams.get("size") ?? DEFAULT_PAGE_SIZE);
  const start = (page - 1) * size;

  return {
    content: items.slice(start, start + size),
    page,
    size,
    totalCount: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
  };
};

/** 검색어가 대상 필드 중 하나라도 포함되는지 확인한다. */
export const matchesKeyword = (keyword: string, ...fields: string[]) => {
  if (!keyword) return true;

  const lowered = keyword.toLowerCase();

  return fields.some((field) => field?.toLowerCase().includes(lowered));
};

/** 목업 데이터의 다음 ID를 만든다. */
export const nextId = <T>(items: T[], key: keyof T): number =>
  items.reduce((max, item) => Math.max(max, Number(item[key]) || 0), 0) + 1;

/** 시드 데이터용 상대 일시 문자열 */
export const daysAgo = (days: number, hour = 12): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);

  return date.toISOString();
};

/**
 * 오늘 기준 상대 날짜를 `YYYY-MM-DD`로 만든다.
 *
 * 행사 일정은 항상 "오늘" 주변에 있어야 캘린더가 비어 보이지 않는다.
 * 고정 날짜를 박으면 시간이 지날수록 목업이 과거로 밀리므로 상대 날짜만 쓴다.
 */
export const dateFromToday = (offsetDays: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/** `YYYY-MM-DD` + `HH:mm`을 ISO 일시로 합친다. */
export const toIsoDateTime = (date: string, time: string): string =>
  new Date(`${date}T${time}:00`).toISOString();

/** 시드 데이터용 의사 난수. 실행마다 값이 바뀌지 않도록 seed 기반으로 만든다. */
export const pseudoRandom = (seed: number): number => {
  const value = Math.sin(seed) * 10_000;

  return value - Math.floor(value);
};

/** seed 기반 정수 난수 */
export const randomInt = (seed: number, min: number, max: number): number =>
  min + Math.floor(pseudoRandom(seed) * (max - min + 1));

/** seed 기반 배열 요소 선택 */
export const pickOne = <T>(seed: number, items: readonly T[]): T =>
  items[randomInt(seed, 0, items.length - 1)];
