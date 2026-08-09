import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ko";

dayjs.extend(relativeTime);
dayjs.locale("ko");

export default dayjs;

/** 표 · 상세에서 쓰는 기본 일시 표기 (ex: 2026.05.01 21:32) */
export const formatDateTime = (value?: string | number | Date | null): string =>
  value ? dayjs(value).format("YYYY.MM.DD HH:mm") : "-";

/** 날짜만 필요한 경우 (ex: 2026.05.01) */
export const formatDate = (value?: string | number | Date | null): string =>
  value ? dayjs(value).format("YYYY.MM.DD") : "-";

/** 초 단위까지 필요한 로그 · 장부용 표기 */
export const formatDateTimeSecond = (
  value?: string | number | Date | null,
): string => (value ? dayjs(value).format("YYYY.MM.DD HH:mm:ss") : "-");

/** 상대 시간 표기 (ex: 3시간 전) */
export const formatFromNow = (value?: string | number | Date | null): string =>
  value ? dayjs(value).fromNow() : "-";

/** input[type=date] 바인딩용 값 */
export const toDateInputValue = (
  value?: string | number | Date | null,
): string => (value ? dayjs(value).format("YYYY-MM-DD") : "");

/** 공고문 · 안내 문자에 넣는 표기 (ex: 8월 12일(수)) */
export const formatKoreanDate = (
  value?: string | number | Date | null,
): string => (value ? dayjs(value).format("M월 D일(ddd)") : "-");

/** 캘린더 · 목록에서 쓰는 짧은 표기 (ex: 08.12(수)) */
export const formatShortDate = (
  value?: string | number | Date | null,
): string => (value ? dayjs(value).format("MM.DD(ddd)") : "-");

/**
 * 하루 이상 이어지는 행사의 기간 표기.
 * 시작과 종료가 같으면 날짜 하나만 보여 준다.
 */
export const formatDateRange = (startDate: string, endDate: string): string =>
  startDate === endDate
    ? formatDate(startDate)
    : `${formatDate(startDate)} ~ ${formatDate(endDate)}`;

/** 오늘 기준 남은 일수. 지난 날짜는 음수다. */
export const diffFromToday = (value: string): number =>
  dayjs(value).startOf("day").diff(dayjs().startOf("day"), "day");

/** D-day 표기 (ex: D-3 / 오늘 / D+2) */
export const formatDday = (value: string): string => {
  const diff = diffFromToday(value);

  if (diff === 0) return "오늘";

  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
};
