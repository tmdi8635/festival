import type { BadgeTone, SelectOption } from "@/components/ui";
import {
  ASSIGNMENT_STATUS_LABEL,
  EVENT_STATUS_FLOW,
  EVENT_STATUS_LABEL,
  RECURRENCE_PRESET_HINT,
  RECURRENCE_PRESET_LABEL,
  WAGE_TYPE_LABEL,
  type AssignmentStatus,
  type EventStatus,
  type FillState,
  type RecurrencePreset,
} from "@/type/event";

/** 행사 상태 색. 진행 전(중립) → 진행 중(브랜드) → 마감(성공) 순으로 읽힌다. */
export const EVENT_STATUS_TONE: Record<EventStatus, BadgeTone> = {
  DRAFT: "neutral",
  RECRUITING: "warning",
  CONFIRMED: "info",
  IN_PROGRESS: "brand",
  SETTLEMENT: "warning",
  DONE: "success",
  CANCELED: "danger",
};

export const EVENT_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 상태", value: "" },
  ...(
    [
      "DRAFT",
      "RECRUITING",
      "CONFIRMED",
      "IN_PROGRESS",
      "SETTLEMENT",
      "DONE",
      "CANCELED",
    ] as const
  ).map((status) => ({ label: EVENT_STATUS_LABEL[status], value: status })),
];

/**
 * 상태 변경 드롭다운에 쓰는 값.
 *
 * 진행 흐름 순서대로 두되 '취소'도 마지막에 넣는다.
 * 빠져 있으면 이미 취소된 행사를 열었을 때 select가 엉뚱한 값을 보여 준다.
 */
export const EVENT_STATUS_OPTIONS: SelectOption[] = [
  ...EVENT_STATUS_FLOW,
  "CANCELED" as const,
].map((status) => ({ label: EVENT_STATUS_LABEL[status], value: status }));

export const ASSIGNMENT_STATUS_TONE: Record<AssignmentStatus, BadgeTone> = {
  PROPOSED: "warning",
  CONFIRMED: "success",
  WAITLIST: "info",
  CANCELED: "neutral",
};

export const ASSIGNMENT_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { label: "배치 전체", value: "" },
  ...(["PROPOSED", "CONFIRMED", "WAITLIST", "CANCELED"] as const).map(
    (status) => ({ label: ASSIGNMENT_STATUS_LABEL[status], value: status }),
  ),
];

/**
 * 충원 상태별 색.
 *
 * 캘린더에서 한눈에 "어디가 비었는지"를 잡아내야 하므로
 * 빈 자리는 위험(빨강), 부분 충원은 경고(주황), 완료는 성공(초록)으로 고정한다.
 */
export const FILL_STATE_TEXT_CLASS: Record<FillState, string> = {
  EMPTY: "text-danger",
  PARTIAL: "text-warning",
  FULL: "text-success",
  OVER: "text-info",
};

export const FILL_STATE_BADGE_TONE: Record<FillState, BadgeTone> = {
  EMPTY: "danger",
  PARTIAL: "warning",
  FULL: "success",
  OVER: "info",
};

/** 캘린더 칩 배경. 상태색을 아주 옅게 깔아 행사 개수가 많아도 눈이 피로하지 않게 한다. */
export const FILL_STATE_CHIP_CLASS: Record<FillState, string> = {
  EMPTY: "border-danger/25 bg-danger-bg",
  PARTIAL: "border-warning/25 bg-warning-bg",
  FULL: "border-success/25 bg-success-bg",
  OVER: "border-info/25 bg-info-bg",
};

/** 휴게 시간 선택지 */
export const BREAK_MINUTE_OPTIONS: SelectOption[] = [
  { label: "없음", value: "0" },
  { label: "30분", value: "30" },
  { label: "60분", value: "60" },
  { label: "90분", value: "90" },
  { label: "120분", value: "120" },
];

/**
 * 반복 프리셋 버튼 목록.
 *
 * 폼에서 이 순서대로 나열한다. 왼쪽일수록 자주 쓰는 구성이다.
 */
export const RECURRENCE_PRESETS: {
  value: RecurrencePreset;
  label: string;
  hint: string;
}[] = (
  ["SINGLE", "CONSECUTIVE", "WEEKEND", "WEEKDAY", "WEEKLY", "CUSTOM"] as const
).map((preset) => ({
  value: preset,
  label: RECURRENCE_PRESET_LABEL[preset],
  hint: RECURRENCE_PRESET_HINT[preset],
}));

/** 반복 간격 선택지. 격주 운영하는 정기 행사가 실제로 많다. */
export const RECURRENCE_INTERVAL_OPTIONS: SelectOption[] = [
  { label: "매주", value: "1" },
  { label: "2주마다", value: "2" },
  { label: "3주마다", value: "3" },
  { label: "4주마다", value: "4" },
];

/** 반복 행사임을 알리는 뱃지 색. 단발 행사와 눈으로 구분되게 한다. */
export const RECURRENCE_BADGE_TONE: BadgeTone = "info";

/**
 * 지급 기준 선택지.
 *
 * 시급이 기본이지만 설치 · 철거처럼 하루 얼마로 통으로 정하는 일도 흔하다.
 * 행사 폼 · 공고 폼이 같은 목록을 쓴다.
 */
export const WAGE_TYPE_OPTIONS: SelectOption[] = (
  ["HOURLY", "DAILY"] as const
).map((wageType) => ({ label: WAGE_TYPE_LABEL[wageType], value: wageType }));
