import type { BadgeTone, SelectOption } from "@/components/ui";
import {
  ATTENDANCE_STATUS_LABEL,
  GENDER_LABEL,
  type AttendanceStatus,
  type StaffStatus,
} from "@/type/staff";

/**
 * 인사 도메인 라벨 · 옵션.
 * 목록 · 상세 · 모달 · 필터가 같은 문구를 공유하도록 여기 한 곳에만 둔다.
 *
 * 직무 선택지는 여기 없다. 직무는 에이전시마다 다르게 정의하므로
 * `@/store/useOrgStore`의 `useJobRoleOptions()`에서 가져온다.
 */
export const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
  ACTIVE: "활동중",
  DORMANT: "휴면",
  BLACKLIST: "블랙리스트",
  RETIRED: "활동종료",
};

export const STAFF_STATUS_TONE: Record<StaffStatus, BadgeTone> = {
  ACTIVE: "success",
  DORMANT: "warning",
  BLACKLIST: "danger",
  RETIRED: "neutral",
};

export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, BadgeTone> = {
  PENDING: "neutral",
  PRESENT: "success",
  LATE: "warning",
  EARLY_LEAVE: "warning",
  ABSENT: "danger",
  NO_SHOW: "danger",
};

export const STAFF_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 상태", value: "" },
  { label: STAFF_STATUS_LABEL.ACTIVE, value: "ACTIVE" },
  { label: STAFF_STATUS_LABEL.DORMANT, value: "DORMANT" },
  { label: STAFF_STATUS_LABEL.BLACKLIST, value: "BLACKLIST" },
  { label: STAFF_STATUS_LABEL.RETIRED, value: "RETIRED" },
];

export const STAFF_STATUS_OPTIONS: SelectOption[] = [
  { label: STAFF_STATUS_LABEL.ACTIVE, value: "ACTIVE" },
  { label: STAFF_STATUS_LABEL.DORMANT, value: "DORMANT" },
  { label: STAFF_STATUS_LABEL.RETIRED, value: "RETIRED" },
];

export const GENDER_OPTIONS: SelectOption[] = [
  { label: GENDER_LABEL.FEMALE, value: "FEMALE" },
  { label: GENDER_LABEL.MALE, value: "MALE" },
];

/** 서류 제출 여부 필터. 정산 계좌를 확정할 수 있는지와 직결된다. */
export const DOCUMENT_STATE_FILTER_OPTIONS: SelectOption[] = [
  { label: "서류 전체", value: "" },
  { label: "제출 완료", value: "COMPLETE" },
  { label: "미제출", value: "INCOMPLETE" },
];

/**
 * 인력 정렬 기준.
 *
 * '신뢰도'는 노쇼·지각·평점을 섞어 만든 합성 점수였는데,
 * 무엇 때문에 점수가 깎였는지 화면에서 알 수 없어 판단에 쓰이지 못했다.
 * 평판 점수와 노쇼 횟수를 그대로 보여 주는 편이 낫다.
 */
export const STAFF_SORT_OPTIONS: SelectOption[] = [
  { label: "최근 등록순", value: "RECENT" },
  { label: "근무 횟수순", value: "WORK_COUNT" },
  { label: "평판 점수순", value: "RATING" },
  { label: "평가 많은순", value: "RATING_COUNT" },
  { label: "최근 근무순", value: "LAST_WORKED" },
];

export const ATTENDANCE_FILTER_OPTIONS: SelectOption[] = [
  { label: "근태 전체", value: "" },
  ...(
    ["PENDING", "PRESENT", "LATE", "EARLY_LEAVE", "ABSENT", "NO_SHOW"] as const
  ).map((status) => ({
    label: ATTENDANCE_STATUS_LABEL[status],
    value: status,
  })),
];

/** 근태 기록 모달에서 고르는 값. "예정"은 되돌리기 용도로 남겨 둔다. */
export const ATTENDANCE_OPTIONS: SelectOption[] = (
  ["PRESENT", "LATE", "EARLY_LEAVE", "ABSENT", "NO_SHOW", "PENDING"] as const
).map((status) => ({
  label: ATTENDANCE_STATUS_LABEL[status],
  value: status,
}));

/** 일괄 근태 처리 버튼에 쓰는 값. 현장에서 가장 자주 누르는 순서로 둔다. */
export const BULK_ATTENDANCE_OPTIONS: {
  status: AttendanceStatus;
  label: string;
}[] = [
  { status: "PRESENT", label: "정상 출근" },
  { status: "LATE", label: "지각" },
  { status: "EARLY_LEAVE", label: "조퇴" },
  { status: "ABSENT", label: "결근" },
  { status: "NO_SHOW", label: "노쇼" },
  { status: "PENDING", label: "예정으로 되돌리기" },
];

/**
 * 평판 점수 구간별 색.
 *
 * 색은 **평판 점수**로 고른다. 단순 평균으로 고르면 1건 5.0이
 * 40건 4.3보다 진한 색을 달고 목록에서 더 좋아 보인다.
 * 평판 점수는 이미 표본 수를 반영하고 있어 건수를 따로 볼 필요가 없다.
 *
 * 구간은 기본 점수(3.6)를 가운데 두고 나눈다.
 * 기본선 근처는 '아직 판단할 근거가 없다'는 뜻이라 색을 죽인다.
 */
export const resolveRatingTone = (reputationScore: number): BadgeTone => {
  if (reputationScore >= 4.3) return "success";
  if (reputationScore >= 4) return "info";
  if (reputationScore >= 3.5) return "neutral";
  if (reputationScore >= 3.2) return "warning";

  return "danger";
};
