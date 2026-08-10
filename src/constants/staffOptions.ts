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
  PENDING: "대기중",
  ACTIVE: "활동중",
  BLACKLIST: "블랙리스트",
};

/**
 * 대기중이 `warning`인 이유.
 *
 * 서류가 없어 **지금 부를 수 없는 사람**이다. 중립색으로 두면 목록에서
 * 활동중과 구분되지 않고, 배치하려다 확정 단계에서야 막힌다.
 */
export const STAFF_STATUS_TONE: Record<StaffStatus, BadgeTone> = {
  PENDING: "warning",
  ACTIVE: "success",
  BLACKLIST: "danger",
};

/** 상태별로 지금 무엇을 뜻하는지. 배지 옆·필터 안내에 그대로 쓴다. */
export const STAFF_STATUS_HINT: Record<StaffStatus, string> = {
  PENDING: "신분증 · 통장사본이 없어 확정 배치할 수 없습니다.",
  ACTIVE: "필요한 서류를 모두 냈습니다. 배치할 수 있습니다.",
  BLACKLIST: "에이전시가 지정했습니다. 배치 대상에서 빠집니다.",
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
  { label: STAFF_STATUS_LABEL.PENDING, value: "PENDING" },
  { label: STAFF_STATUS_LABEL.BLACKLIST, value: "BLACKLIST" },
];

export const GENDER_OPTIONS: SelectOption[] = [
  { label: GENDER_LABEL.FEMALE, value: "FEMALE" },
  { label: GENDER_LABEL.MALE, value: "MALE" },
];

/**
 * 배치 후보를 성별로 좁힐 때 쓰는 선택지.
 *
 * 발주에 성별 조건이 있으면 이 값의 **초기값**이 그 조건으로 깔린다.
 * 다만 언제든 '전체 성별'로 되돌릴 수 있어야 한다. 현장은 조건과 다르게
 * 뽑는 일이 늘 있고, 필터가 그것을 막으면 후보가 아예 안 보인다.
 */
export const GENDER_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 성별", value: "" },
  ...GENDER_OPTIONS,
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

/**
 * 근태 기록 모달에서 고르는 값. "예정"은 되돌리기 용도로 남겨 둔다.
 *
 * **'지각'은 없다.** 지각은 상태가 아니라 시각의 문제다. 늦게 온 사람은
 * 출근 시각을 실제로 온 시각으로 적으면 그만이고, 그러면 근무시간이 줄어
 * 정산 금액까지 저절로 맞는다. 상태로 따로 받으면 같은 사실을 두 번 적게 되고
 * (10:20으로 적고 + 지각 20분으로 또 적고) 두 값이 어긋나는 날이 온다.
 * 실제로 지각 분수와 출근 시각이 따로 노는 건이 쌓였다.
 */
export const ATTENDANCE_OPTIONS: SelectOption[] = (
  ["PRESENT", "EARLY_LEAVE", "ABSENT", "NO_SHOW", "PENDING"] as const
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
  { status: "EARLY_LEAVE", label: "조퇴" },
  { status: "ABSENT", label: "결근" },
  { status: "NO_SHOW", label: "노쇼" },
  { status: "PENDING", label: "예정으로 되돌리기" },
];

/*
  평판 점수에는 색을 입히지 않는다.

  등급 이름을 걷어내고도 초록 · 빨강 배지는 남겨 뒀는데, 그 색이 결국
  등급이 하던 일을 그대로 했다. 1002점이 초록이면 좋아요 한 번 더 받은 사람이
  화면에서 '괜찮은 사람'이 되고 998점은 그 반대가 된다. 점수를 보고 판단하는
  것은 에이전시의 일이지 화면이 미리 해 줄 일이 아니다. (`RatingStat`)
*/
