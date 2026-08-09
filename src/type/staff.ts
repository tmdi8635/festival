/**
 * 인력(스태프) 도메인 타입.
 *
 * 직무(JobRole)는 행사·배치·계약·정산이 모두 참조하므로
 * 이 파일을 단일 원본으로 두고 다른 도메인에서 import 한다.
 */

// 지급 기준은 행사 도메인이 원본이다. 타입만 빌려 쓰므로 순환 참조가 생기지 않는다.
import type { WageType } from "./event";

/**
 * 행사에 투입되는 직무.
 *
 * 에이전시마다 부르는 이름도 구성도 달라서 코드로 고정하지 않는다.
 * 실제 직무 목록은 기준 설정(OperationSettings.jobRoles)이 갖고 있고,
 * 여기서는 그 코드 문자열만 다룬다.
 * 라벨이 필요하면 `@/store/useOrgStore`의 `jobRoleLabel()`을 쓴다.
 */
export type JobRole = string;

/** 직무 정의 한 건. 기준 설정에서 자유롭게 추가·수정·삭제한다. */
export interface JobRoleDef {
  /**
   * 내부 식별자. 시스템이 자동으로 붙이고 사람은 건드리지 않는다.
   *
   * 예전에는 사용자가 직접 코드를 적게 했는데, 배치 · 계약 · 정산이 전부
   * 이 값을 들고 있어서 오타 하나가 과거 이력을 통째로 끊어 놓았다.
   * 사람에게 필요한 것은 '이름'이지 식별자가 아니므로 화면에서 감추고,
   * 겹치지 않는 값은 `nextJobRoleCode()`가 만들어 준다.
   */
  code: string;
  /** 화면에 그대로 나가는 이름 */
  name: string;
  /** 캘린더처럼 좁은 곳에서 쓰는 짧은 이름. 비우면 name을 그대로 쓴다. */
  shortName: string;
  /**
   * 화면에 나열하는 순서. 작을수록 앞이다.
   *
   * 배열 순서에 기대면 저장 · 조회를 거치며 뒤섞인다.
   * 자주 쓰는 직무를 위로 올려 두는 것은 현장에서 실제로 필요한 조작이라
   * 순서를 데이터로 들고 있는다.
   */
  order: number;
  /**
   * 이 직무를 보통 어떻게 계산하는지.
   *
   * 설치 · 철거처럼 시간이 들쭉날쭉한 일은 대개 하루 얼마로 통으로 정한다.
   * 직무마다 관행이 달라서 기본값을 여기에 둔다. 행사마다 다시 고를 수 있다.
   */
  defaultWageType: WageType;
  /** 행사 등록 시 초기값으로 깔리는 기본 금액 (시급이면 시간당, 일급이면 하루치) */
  defaultWage: number;
  /** 사용하지 않는 직무는 끄기만 하고 지우지 않는다. (과거 이력이 남아 있다) */
  isActive: boolean;
}

/**
 * 기본 직무 구성.
 *
 * 처음 켰을 때 비어 있으면 아무것도 못 하므로 흔한 구성을 깔아 둔다.
 * 사용자는 기준 설정에서 이름·시급을 바꾸거나 통째로 갈아엎을 수 있다.
 */
export const DEFAULT_JOB_ROLES: JobRoleDef[] = [
  {
    code: "SUPERVISOR",
    name: "팀장",
    shortName: "팀장",
    order: 1,
    defaultWageType: "HOURLY",
    defaultWage: 18000,
    isActive: true,
  },
  {
    code: "STAFF",
    name: "스태프",
    shortName: "스태프",
    order: 2,
    defaultWageType: "HOURLY",
    defaultWage: 12000,
    isActive: true,
  },
  {
    code: "MC",
    name: "MC",
    shortName: "MC",
    order: 3,
    defaultWageType: "HOURLY",
    defaultWage: 30000,
    isActive: true,
  },
  {
    code: "MODEL",
    name: "모델",
    shortName: "모델",
    order: 4,
    defaultWageType: "HOURLY",
    defaultWage: 22000,
    isActive: true,
  },
  {
    code: "SOUND",
    name: "음향",
    shortName: "음향",
    order: 5,
    defaultWageType: "HOURLY",
    defaultWage: 20000,
    isActive: true,
  },
  {
    code: "SETUP",
    name: "설치/철거",
    shortName: "설치",
    order: 6,
    defaultWageType: "DAILY",
    defaultWage: 130000,
    isActive: true,
  },
];

/**
 * 직무를 화면 순서대로 정렬한다.
 *
 * 저장 · 조회를 거치면 배열 순서는 언제든 뒤집힐 수 있으므로
 * 나열하는 쪽은 배열 순서가 아니라 항상 `order`를 믿는다.
 * 값이 같으면 이름순으로 떨어뜨려 렌더마다 순서가 흔들리지 않게 한다.
 */
export const sortJobRoles = (jobRoles: JobRoleDef[]): JobRoleDef[] =>
  [...jobRoles].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );

/**
 * 새 직무에 붙일 내부 코드를 만든다.
 *
 * 사람이 정하지 않으므로 겹치지 않기만 하면 된다.
 * 일련번호 방식이라 몇 번째로 만든 직무인지도 함께 남는다.
 */
export const nextJobRoleCode = (jobRoles: JobRoleDef[]): string => {
  const used = new Set(jobRoles.map((role) => role.code));

  let sequence = jobRoles.length + 1;

  while (used.has(`ROLE_${sequence}`)) sequence += 1;

  return `ROLE_${sequence}`;
};

/** 목록 맨 끝에 붙일 순서값 */
export const nextJobRoleOrder = (jobRoles: JobRoleDef[]): number =>
  jobRoles.reduce((max, role) => Math.max(max, role.order), 0) + 1;

export type StaffStatus = "ACTIVE" | "DORMANT" | "BLACKLIST" | "RETIRED";

export type Gender = "MALE" | "FEMALE";

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: "남성",
  FEMALE: "여성",
};

/** 인력 목록에서 다루는 요약 정보 */
export interface Staff {
  staffId: number;
  name: string;
  phoneNumber: string;
  profileImageUrl: string;
  birthDate: string;
  gender: Gender;
  status: StaffStatus;
  /** 투입 가능한 직무. 배치 후보 추천의 1차 조건이다. */
  roles: JobRole[];
  /** 주 활동 지역 시/도. 새벽 집합 행사에서 이동 가능 여부를 가른다. */
  region: string;
  /** 활동 지역의 시/군/구 */
  district: string;
  /** 신분증·통장사본이 모두 제출됐는지 */
  isDocumentComplete: boolean;
  /** 누적 근무 횟수 */
  workCount: number;
  totalWorkHours: number;
  noShowCount: number;
  lateCount: number;
  /** 받은 '좋아요' 수 */
  goodCount: number;
  /** 받은 '별로예요' 수 */
  badCount: number;
  /**
   * 즐겨찾기.
   *
   * 에이전시는 결국 부르던 사람을 또 부른다. 그 목록이 대표 머릿속에만 있으면
   * 담당자를 나눌 수 없어서, 목록에서 별 한 번으로 넣고 뺄 수 있게 했다.
   * 배치 후보 추천에서는 이 사람들이 가장 위로 올라온다.
   */
  isFavorite: boolean;
  lastWorkedAt?: string;
  createdAt: string;
}

/** 인력 상세에서만 노출하는 민감 정보 · 이력 */
export interface StaffDetail extends Staff {
  /** 계좌 정보는 정산 이체에만 사용한다. */
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  /** 신분증 사본 이미지 */
  idCardImageUrl: string;
  /** 통장 사본 이미지 */
  bankBookImageUrl: string;
  address: string;
  emergencyContact: string;
  height?: number;
  clothingSize?: string;
  /** 블랙리스트 지정 사유. 상태가 BLACKLIST일 때만 값이 있다. */
  blacklistReason?: string;
  blacklistedAt?: string;
  totalPaidAmount: number;
  memos: StaffMemo[];
}

/** 인력에 남기는 타임스탬프 메모 */
export interface StaffMemo {
  memoId: number;
  staffId: number;
  content: string;
  /** 주의가 필요한 메모는 상세 상단에 경고로 올린다. */
  isWarning: boolean;
  author: string;
  createdAt: string;
}

/** 참여 이력에서 날짜별 근태를 펼쳐 볼 때 쓰는 한 칸 */
export interface StaffWorkDay {
  assignmentId: number;
  date: string;
  attendance: AttendanceStatus;
  lateMinutes: number;
  payAmount: number;
  /** 이 날 받은 평가 */
  verdict?: ReputationVerdict;
}

/**
 * 인력이 참여한 행사 이력 한 줄.
 *
 * **행사 단위**로 묶는다. 배치는 "사람 × 날짜"라서 3일 나온 행사는 배치가 3건인데,
 * 그대로 나열하면 같은 행사가 하루짜리 세 줄로 흩어져 "며칠 일했는지"가 사라진다.
 * 사람이 이력에서 알고 싶은 것은 "어느 행사에 며칠 나왔나"다.
 */
export interface StaffWorkHistory {
  /** 인력 + 행사 조합. 행사 단위로 묶었으므로 배치 ID를 키로 쓸 수 없다. */
  historyId: string;
  eventId: number;
  eventTitle: string;
  clientName: string;
  role: JobRole;
  /** 실제 근무한 날짜 (오름차순) */
  workDates: string[];
  /** 대표 근무일 = 첫날. 정렬과 목록 표시에 쓴다. */
  workDate: string;
  /** 이 행사에서 나온 일수 */
  dayCount: number;
  /** 하루 실근무시간 */
  workHours: number;
  /** 전체 실근무시간 (하루 × 일수) */
  totalWorkHours: number;
  /** 전체 지급액 */
  payAmount: number;
  /** 날짜별 근태. 여러 날 중 하루만 지각한 경우를 표현하려면 날짜별로 있어야 한다. */
  days: StaffWorkDay[];
  /** 이 행사에서 받은 평가. 여러 날이면 '좋아요'가 하나라도 있으면 좋아요로 본다. */
  verdict?: ReputationVerdict;
  reputationComment?: string;
  /**
   * 이 행사의 근로계약서.
   *
   * 계약서를 따로 탭으로 빼 두면 "이 행사 때 계약서가 나갔나"를 확인하려고
   * 두 탭을 오가야 한다. 참여 이력 한 줄에서 바로 보이도록 함께 내려준다.
   * 계약서도 사람×행사 한 장이라 이 묶음과 단위가 같다.
   */
  contractId?: number;
  contractNumber?: string;
  contractStatus?: import("./contract").ContractStatus;
}

/**
 * 여러 날 근태를 한 줄로 요약한다.
 *
 * 전부 정상이면 "정상 출근", 아니면 문제가 있는 것만 센다.
 * ("정상 8 · 지각 2"처럼) 열 줄을 다 보여 주면 표가 읽히지 않는다.
 */
export const summarizeAttendance = (
  days: Pick<StaffWorkDay, "attendance">[],
): { label: string; status: AttendanceStatus } => {
  if (days.length === 0) return { label: "-", status: "PENDING" };

  const counts = new Map<AttendanceStatus, number>();

  days.forEach((day) =>
    counts.set(day.attendance, (counts.get(day.attendance) ?? 0) + 1),
  );

  // 한 가지 근태로만 이뤄져 있으면 그대로 보여 준다.
  if (counts.size === 1) {
    const [status] = [...counts.keys()];

    return { label: ATTENDANCE_STATUS_LABEL[status], status };
  }

  /*
    섞여 있으면 가장 나쁜 근태를 대표로 삼는다.
    "10일 중 하루 노쇼"는 노쇼로 보여야 판단을 그르치지 않는다.
  */
  const severity: AttendanceStatus[] = [
    "NO_SHOW",
    "ABSENT",
    "EARLY_LEAVE",
    "LATE",
    "PENDING",
    "PRESENT",
  ];
  const worst = severity.find((status) => counts.has(status)) ?? "PENDING";

  const label = [...counts.entries()]
    .sort(
      (a, b) => severity.indexOf(a[0]) - severity.indexOf(b[0]),
    )
    .map(([status, count]) => `${ATTENDANCE_STATUS_LABEL[status]} ${count}`)
    .join(" · ");

  return { label, status: worst };
};

/** 인력이 받은 평가 한 줄. 인력 상세의 평판 탭에서 쓴다. */
export interface StaffReputation {
  assignmentId: number;
  eventId: number;
  eventTitle: string;
  clientName: string;
  workDate: string;
  role: JobRole;
  verdict: ReputationVerdict;
  /** 고른 평가 항목. 비워 둘 수 있다. */
  tags: string[];
  comment?: string;
  /** 평가를 남긴 사람 */
  ratedBy: string;
  /**
   * 누가 남긴 평가인지.
   *
   * 에이전시 · 현장 팀장이 보는 모습과 **같이 일한 스태프가 겪는 모습은 다르다.**
   * 관리자 눈에는 일 잘하는 사람인데 옆 사람에게는 매우 불쾌한 경험을 주는 일이
   * 실제로 자주 있다. 나중에 스태프 상호평가를 열었을 때 그 차이를 볼 수 있어야 하므로,
   * 지금부터 평가 주체를 함께 남긴다.
   */
  raterType: RaterType;
}

/** 근태 결과. 블랙리스트 판정과 평판 점수의 근거 데이터다. */
export type AttendanceStatus =
  | "PENDING"
  | "PRESENT"
  | "LATE"
  | "EARLY_LEAVE"
  | "ABSENT"
  | "NO_SHOW";

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PENDING: "예정",
  PRESENT: "정상 출근",
  LATE: "지각",
  EARLY_LEAVE: "조퇴",
  ABSENT: "결근",
  NO_SHOW: "노쇼",
};

/** 인력 생성·수정 폼 값 */
/**
 * 서류가 갖춰지지 않으면 **확정 배치할 수 없다.**
 *
 * 신분증과 통장사본은 있으면 좋은 서류가 아니라 **돈을 보낼 수 있는 조건**이다.
 * 계약서를 쓰고 일을 다 시킨 뒤에야 통장사본이 없다는 걸 알면,
 * 근로는 이미 제공됐는데 지급할 방법이 없는 상태가 된다.
 * 그때는 사람을 다시 찾아 서류를 받는 것 말고 방법이 없고, 연락이 닿지 않으면
 * 미지급으로 남는다. 그래서 **일을 시키기 전에** 막는다.
 *
 * 제안 · 대기까지 막지는 않는다. 서류는 보통 "같이 하기로 한 뒤에" 받으므로,
 * 제안 단계에서 막으면 새 인력을 부를 방법 자체가 없어진다.
 * 확정 하나만 막아도 "서류 없이 현장에 나가는" 일은 생기지 않는다.
 */
export const REQUIRED_DOCUMENT_LABEL = "신분증 · 통장사본";

export const DOCUMENT_BLOCK_MESSAGE =
  "신분증 또는 통장사본이 없어 확정 배치할 수 없습니다. 서류를 먼저 등록해 주세요.";

/** 확정 배치가 가능한 인력인가. 화면과 목업이 같은 함수를 쓴다. */
export const canConfirmAssignment = (staff: {
  isDocumentComplete: boolean;
}): boolean => staff.isDocumentComplete;

export interface StaffFormValues {
  name: string;
  phoneNumber: string;
  profileImageUrl: string;
  birthDate: string;
  gender: Gender;
  roles: JobRole[];
  region: string;
  district: string;
  address: string;
  emergencyContact: string;
  height?: number;
  clothingSize?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  idCardImageUrl: string;
  bankBookImageUrl: string;
}

/** 휴대폰번호를 010-1234-5678 형태로 표시한다. */
export const formatPhoneNumber = (phoneNumber?: string): string => {
  if (!phoneNumber) return "-";

  return phoneNumber.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
};

/** 생년월일로 만 나이를 계산한다. */
export const calculateAge = (birthDate?: string): number | undefined => {
  if (!birthDate) return undefined;

  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
};

/** 활동 지역을 "인천 남동구" 한 줄로 합친다. */
export const formatRegion = (region?: string, district?: string): string =>
  [region, district].filter(Boolean).join(" ") || "-";

/* ------------------------------------------------------------------ */
/* 평판                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 평가 결과.
 *
 * 별점 5단계를 걷어내고 **좋아요 / 별로예요** 둘로 좁혔다.
 * 5단계는 남기는 사람마다 기준이 달라서(누구의 3점은 다른 사람의 4점이다)
 * 모아 놓으면 평균만 남고 뜻이 사라진다. 반면 "또 부를 것인가"는
 * 현장에서 실제로 내리는 판단이고, 누가 눌러도 같은 뜻이다.
 */
export type ReputationVerdict = "GOOD" | "BAD";

export const REPUTATION_VERDICT_LABEL: Record<ReputationVerdict, string> = {
  GOOD: "좋아요",
  BAD: "별로예요",
};

/** 평가를 남긴 주체 */
export type RaterType = "AGENCY" | "SUPERVISOR" | "PEER";

export const RATER_TYPE_LABEL: Record<RaterType, string> = {
  AGENCY: "에이전시",
  SUPERVISOR: "현장 팀장",
  PEER: "동료 스태프",
};

/**
 * 평가 항목.
 *
 * 코멘트만 받으면 대부분 비워 두고, 비워 둔 평가는 나중에 아무것도 설명하지 못한다.
 * 그렇다고 필수로 만들면 아무 말이나 적는다. 그래서 **고르기만 하면 되는 항목**을
 * 미리 깔아 두고 선택으로 남긴다. 모이면 그 자체로 통계가 된다.
 */
export const REPUTATION_TAGS: Record<ReputationVerdict, string[]> = {
  GOOD: [
    "시간을 잘 지킴",
    "지시 이해가 빠름",
    "손님 응대가 좋음",
    "동료와 협조적",
    "먼저 찾아서 함",
    "복장 · 용모 단정",
  ],
  BAD: [
    "지각이 잦음",
    "지시를 따르지 않음",
    "손님 응대가 불친절",
    "동료와 마찰",
    "무단으로 자리를 비움",
    "복장 규정 미준수",
  ],
};

/**
 * 평가가 하나도 없는 사람이 서는 자리 (좋아요 비율).
 *
 * 0에서 시작하면 처음 배치받는 사람은 영원히 최하위로 밀리고,
 * 1에서 시작하면 아무 근거 없이 최고 인력으로 보인다.
 * 그래서 '보통'에 해당하는 값에서 출발시킨다.
 */
export const BASE_GOOD_RATIO = 0.72;

/** 점수는 5점 만점으로 환산해 보여 준다. 사람이 읽기에 익숙한 눈금이다. */
export const REPUTATION_SCORE_MAX = 5;

/** 평가가 없는 사람의 점수 = 3.6 */
export const BASE_REPUTATION_SCORE = BASE_GOOD_RATIO * REPUTATION_SCORE_MAX;

/**
 * 기본 점수에 실리는 무게. 이만큼의 '보통 평가'가 미리 깔려 있다고 본다.
 *
 * 이 값이 크면 점수가 느리게 움직이고, 작으면 한두 건에 출렁인다.
 * 10건 정도는 쌓여야 그 사람의 평가로 인정한다는 뜻이다.
 */
export const REPUTATION_PRIOR_COUNT = 10;

/**
 * 평판 점수를 구한다.
 *
 * 좋아요 비율을 그대로 쓰면 표본 수를 버린다. 1건 전부 좋아요(100%)와
 * 200건 중 190건 좋아요(95%)가 같은 잣대로 나란히 서면, 목록을 점수순으로
 * 정렬했을 때 딱 한 번 칭찬받은 신입이 맨 위에 온다.
 * 실제로 배치하고 싶은 사람은 200건 쪽이다.
 *
 * 그래서 기본 비율에서 출발해, 평가가 쌓이는 만큼만 그쪽으로 끌려가게 한다.
 * 좋은 평가가 이어지면 천천히 오르고, 나쁜 평가가 이어지면 천천히 내려간다.
 *
 * 예) 좋아요 1건 → 3.7 / 좋아요 18 · 별로예요 2 → 4.0 / 좋아요 190 · 별로예요 10 → 4.7
 */
export const calculateReputationScore = (
  goodCount: number,
  badCount: number,
): number => {
  const total = goodCount + badCount;
  const ratio =
    (goodCount + BASE_GOOD_RATIO * REPUTATION_PRIOR_COUNT) /
    (total + REPUTATION_PRIOR_COUNT);

  return Math.round(ratio * REPUTATION_SCORE_MAX * 100) / 100;
};

/** 평판 점수 한 건을 함께 다룰 때 쓰는 묶음 */
export type ReputationSource = Pick<Staff, "goodCount" | "badCount">;

/** 인력 객체에서 바로 평판 점수를 뽑는다. */
export const resolveReputationScore = (staff: ReputationSource): number =>
  calculateReputationScore(staff.goodCount, staff.badCount);

/** 받은 평가 총 건수 */
export const resolveReputationCount = (staff: ReputationSource): number =>
  staff.goodCount + staff.badCount;

/**
 * 점수를 얼마나 믿을 수 있는지 알려 준다.
 *
 * 좋아요 100%인데 1건이면 95%에 200건보다 못 미덥다.
 * 점수만 크게 띄우고 건수를 숨기면 판단을 그르치므로 항상 함께 쓴다.
 */
export const resolveRatingConfidence = (
  count: number,
): "NONE" | "LOW" | "MEDIUM" | "HIGH" => {
  if (count === 0) return "NONE";
  if (count < 3) return "LOW";
  if (count < 10) return "MEDIUM";

  return "HIGH";
};

/**
 * 평판 점수가 기본선에서 어느 쪽으로 얼마나 움직였는지.
 *
 * 4.1이라는 숫자만으로는 좋은 것인지 알기 어렵다.
 * "기본 3.6에서 +0.5 올라온 사람"으로 읽혀야 뜻이 통한다.
 */
export const resolveReputationTrend = (
  score: number,
): { direction: "UP" | "DOWN" | "FLAT"; delta: number } => {
  const delta = Math.round((score - BASE_REPUTATION_SCORE) * 100) / 100;

  if (Math.abs(delta) < 0.05) return { direction: "FLAT", delta: 0 };

  return { direction: delta > 0 ? "UP" : "DOWN", delta };
};
