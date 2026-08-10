/**
 * 인력(스태프) 도메인 타입.
 *
 * 직무(JobRole)는 행사·배치·계약·정산이 모두 참조하므로
 * 이 파일을 단일 원본으로 두고 다른 도메인에서 import 한다.
 */

// 지급 기준은 행사 도메인이 원본이다. 타입만 빌려 쓰므로 순환 참조가 생기지 않는다.
import type { WageType } from "./event";
import type { EmploymentType } from "./employee";

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
  /**
   * 화면에 그대로 나가는 이름.
   *
   * 짧은 이름을 따로 두지 않는다. 두 벌이면 어느 화면에 무엇이 나가는지
   * 매번 확인해야 하고, 한쪽만 고친 이름이 캘린더에만 남는다.
   * 좁은 자리는 자리를 넓히거나 잘라서 푼다.
   */
  name: string;
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
    order: 1,
    defaultWageType: "HOURLY",
    defaultWage: 18000,
    isActive: true,
  },
  {
    code: "STAFF",
    name: "스태프",
    order: 2,
    defaultWageType: "HOURLY",
    defaultWage: 12000,
    isActive: true,
  },
  {
    code: "MC",
    name: "MC",
    order: 3,
    defaultWageType: "HOURLY",
    defaultWage: 30000,
    isActive: true,
  },
  {
    code: "MODEL",
    name: "모델",
    order: 4,
    defaultWageType: "HOURLY",
    defaultWage: 22000,
    isActive: true,
  },
  {
    code: "SOUND",
    name: "음향",
    order: 5,
    defaultWageType: "HOURLY",
    defaultWage: 20000,
    isActive: true,
  },
  {
    code: "SETUP",
    name: "설치/철거",
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

/**
 * 인력 상태. **셋뿐이다.**
 *
 * 예전에는 `활동중 · 휴면 · 블랙리스트 · 활동종료` 넷이었는데, 휴면과 활동종료는
 * 담당자가 손으로 정하는 값이라 실제로는 아무도 갱신하지 않았다. 그래서 반년째
 * 연락이 닿지 않는 사람이 계속 '활동중'으로 서 있었다.
 *
 * 지금은 **서류가 상태를 정한다.** (`resolveStaffStatus`)
 * 신분증 · 통장사본이 없으면 애초에 확정 배치를 할 수 없으니
 * (`canConfirmAssignment`) 그 사실이 곧 "지금 부를 수 있는 사람인가"의 답이다.
 * 사람이 따로 관리해야 하는 값을 하나 줄이면 그만큼 틀릴 자리도 줄어든다.
 *
 * - `PENDING`   대기중. 새로 등록됐거나 서류를 뺐다. 활동할 수 없다
 * - `ACTIVE`    활동중. 필요한 서류를 다 냈다
 * - `BLACKLIST` 에이전시가 직접 지정한다. 서류와 무관하게 이 값이 이긴다
 */
export type StaffStatus = "PENDING" | "ACTIVE" | "BLACKLIST";

/**
 * 인력의 지금 상태를 구한다. **이 함수 하나가 단일 원본이다.**
 *
 * 화면·목업이 각자 판단하면 "서류를 지웠는데 목록에는 활동중"이 반드시 생긴다.
 * 서류를 넣고 빼는 자리, 인력을 만드는 자리가 전부 여기를 거친다.
 */
export const resolveStaffStatus = (staff: {
  isDocumentComplete: boolean;
  employment?: EmploymentType;
  status?: StaffStatus;
}): StaffStatus => {
  // 블랙리스트는 사람이 내린 판단이다. 서류를 다 냈다고 풀리면 안 된다.
  if (staff.status === "BLACKLIST") return "BLACKLIST";

  // 직원은 입사할 때 회사가 서류를 이미 받았다. 인력풀에 다시 낼 이유가 없다.
  if (staff.employment === "EMPLOYEE") return "ACTIVE";

  return staff.isDocumentComplete ? "ACTIVE" : "PENDING";
};

export type Gender = "MALE" | "FEMALE";

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: "남성",
  FEMALE: "여성",
};

/**
 * 좁은 자리(표 · 배지 · 아이콘 라벨)에 쓰는 한 글자.
 *
 * 명단에서 성별은 이름 옆에 붙는 곁가지라 두 글자도 길다.
 * 다만 **읽어 주는 라벨은 반드시 전체 이름**이어야 한다. (`GENDER_LABEL`)
 */
export const GENDER_SHORT_LABEL: Record<Gender, string> = {
  MALE: "남",
  FEMALE: "여",
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
  /**
   * 고용 형태.
   *
   * 직원은 인력풀에 함께 있되 **돈과 계약서에서 갈라진다.**
   * (근로계약서를 쓰지 않고 시급 정산도 하지 않는다 — `type/employee.ts`)
   * 배치 · 출퇴근은 프리랜서와 같은 길을 쓰므로 여기서만 구분한다.
   */
  employment: EmploymentType;
  /**
   * 투입 가능한 직무. 배치 후보 추천의 1차 조건이다.
   *
   * 직원은 이 목록과 무관하게 **모든 직무에 들어갈 수 있다.**
   * 대행사가 주는 자리에 따라 메인팀장도 스태프도 맡기 때문이다.
   */
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
  /**
   * 평판 점수. **누적값이다.** (`REPUTATION_BASE_SCORE`에서 시작)
   *
   * 평가 한 건이 항목마다 정해진 만큼 더하고 뺀다. 구간 안을 오가는 평균이
   * 아니라 쌓이는 값이라, 오래 잘해 온 사람과 이제 막 시작한 사람이 구분된다.
   */
  reputationScore: number;
  /** 받은 '좋아요' 항목 수. 점수가 왜 그 값인지 설명하는 근거다. */
  goodCount: number;
  /** 받은 '별로예요' 항목 수 */
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

  /* ------------------------------ 직원만 쓰는 값 ---------------------------- */

  /** 회사 안에서의 자리. 직무(JobRole)가 아니다. */
  position?: string;
  hireDate?: string;
  /** 이번 달에 채워야 하는 시간. 이 기준이 없으면 집계가 많은지 적은지 알 수 없다. */
  baseMonthlyHours?: number;
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
  /**
   * 이 평가가 어느 쪽이었나. **항목의 합에서 나온 값이다.**
   *
   * 한 평가에 좋아요 항목과 별로예요 항목이 함께 담기므로, 사람이 고르는 값이
   * 아니라 결과다. 목록에서는 따로 세우지 않는다 — 항목 자체가 이미
   * 좋아요/별로예요를 말하고 있어서, 옆에 요약 배지를 하나 더 두면
   * 같은 말이 두 번 적힌 칸이 된다.
   */
  verdict: ReputationVerdict;
  /** 고른 평가 항목. 좋아요 · 별로예요가 **섞여 있을 수 있다.** */
  tags: string[];
  /** 이 평가가 평판 점수를 움직인 크기 */
  points: number;
  comment?: string;
  /** 남긴 시각. 평가는 고칠 수 없으므로 이 값도 바뀌지 않는다. */
  ratedAt?: string;
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

/**
 * 확정 배치가 가능한 인력인가. 화면과 목업이 같은 함수를 쓴다.
 *
 * **직원은 이 검사를 받지 않는다.** 신분증 · 통장사본을 요구하는 이유가
 * "이 사람에게 돈을 보낼 수 있는가"인데, 직원의 급여는 회사가 이미 다른 경로로
 * 내보내고 있다. 입사할 때 받은 서류를 인력풀에 다시 올리게 하면,
 * 직원을 현장에 넣을 때마다 아무 뜻 없는 벽에 막힌다.
 */
export const canConfirmAssignment = (staff: {
  isDocumentComplete: boolean;
  employment?: EmploymentType;
}): boolean => staff.employment === "EMPLOYEE" || staff.isDocumentComplete;

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
 * 평가 항목 하나. **항목이 곧 점수다.**
 *
 * 코멘트만 받으면 대부분 비워 두고, 비워 둔 평가는 나중에 아무것도 설명하지 못한다.
 * 그렇다고 필수로 만들면 아무 말이나 적는다. 그래서 **고르기만 하면 되는 항목**을
 * 미리 깔아 두고, 그 항목마다 무게를 붙여 둔다.
 *
 * 무게가 다른 이유는 실제로 다르기 때문이다. 복장이 흐트러진 것과 말없이 자리를
 * 비운 것을 같은 한 표로 세면, 현장에 구멍을 낸 사람과 옷이 좀 헐렁했던 사람이
 * 목록에서 나란히 선다.
 */
export interface ReputationTagDef {
  tag: string;
  verdict: ReputationVerdict;
  /** 좋아요는 +1~+5, 별로예요는 −5~−10 */
  points: number;
}

/**
 * 평가 항목 목록. **하나의 배열로 둔다.**
 *
 * 한 평가에 좋아요 항목과 별로예요 항목이 **함께** 담길 수 있다.
 * ("지시 이해는 빠른데 복장 규정은 안 지켰다"는 실제로 흔한 조합이다)
 * verdict별 Record로 쪼개 두면 그 조합을 표현할 자리가 없어진다.
 */
export const REPUTATION_TAGS: ReputationTagDef[] = [
  { tag: "먼저 찾아서 함", verdict: "GOOD", points: 5 },
  { tag: "지시 이해가 빠름", verdict: "GOOD", points: 3 },
  { tag: "손님 응대가 좋음", verdict: "GOOD", points: 3 },
  { tag: "시간을 잘 지킴", verdict: "GOOD", points: 2 },
  { tag: "동료와 협조적", verdict: "GOOD", points: 2 },
  { tag: "복장 · 용모 단정", verdict: "GOOD", points: 1 },

  { tag: "무단으로 자리를 비움", verdict: "BAD", points: -10 },
  { tag: "지시를 따르지 않음", verdict: "BAD", points: -8 },
  { tag: "손님 응대가 불친절", verdict: "BAD", points: -8 },
  { tag: "지각이 잦음", verdict: "BAD", points: -7 },
  { tag: "동료와 마찰", verdict: "BAD", points: -7 },
  { tag: "복장 규정 미준수", verdict: "BAD", points: -5 },
];

/** 좋아요 · 별로예요별 항목. 평가 모달의 팔레트를 그릴 때 쓴다. */
export const reputationTagsOf = (
  verdict: ReputationVerdict,
): ReputationTagDef[] => REPUTATION_TAGS.filter((item) => item.verdict === verdict);

const findReputationTag = (tag: string): ReputationTagDef | undefined =>
  REPUTATION_TAGS.find((item) => item.tag === tag);

/** 항목 하나의 무게. 없어진 항목(과거 평가)은 0으로 둔다. */
export const resolveTagPoints = (tag: string): number =>
  findReputationTag(tag)?.points ?? 0;

/** 항목이 좋아요 쪽인지 별로예요 쪽인지. 배지 색을 여기서 정한다. */
export const resolveTagVerdict = (tag: string): ReputationVerdict | undefined =>
  findReputationTag(tag)?.verdict;

/**
 * 항목을 하나도 고르지 않았을 때의 기본 무게.
 *
 * 버튼만 누르고 넘어가는 평가도 뜻이 있어야 하지만, 이유를 적은 평가보다
 * 무겁게 잡히면 안 된다. 그래서 각 방향의 가장 작은 값을 준다.
 */
const BARE_VERDICT_POINTS: Record<ReputationVerdict, number> = {
  GOOD: 1,
  BAD: -5,
};

/**
 * 평가 한 건이 점수를 얼마나 움직이는지.
 *
 * 항목을 고르면 그 합, 하나도 안 골랐으면 방향만큼의 최소값이다.
 * **화면·목업이 같은 함수를 쓴다.** 따로 세면 모달에 적힌 `+8점`과
 * 저장 뒤 실제로 오른 점수가 달라진다.
 */
export const calculateReputationDelta = (
  tags: readonly string[],
  verdict?: ReputationVerdict,
): number => {
  if (tags.length > 0) {
    return tags.reduce((sum, tag) => sum + resolveTagPoints(tag), 0);
  }

  return verdict ? BARE_VERDICT_POINTS[verdict] : 0;
};

/**
 * 아무 평가도 받지 않은 사람이 서는 자리.
 *
 * 0에서 시작하면 첫 별로예요 한 건에 곧바로 음수가 되어 "빚진 사람"처럼 보이고,
 * 신입과 오래 잘해 온 사람의 거리도 좁다. 게임 레이팅처럼 가운데 기준점을
 * 두면 오르내림이 양쪽으로 읽힌다.
 */
export const REPUTATION_BASE_SCORE = 1000;

/** 평가 항목들을 누적 점수로 바꾼다. (기준점 + 합) */
export const buildReputationScore = (delta: number): number =>
  REPUTATION_BASE_SCORE + delta;

/**
 * 점수 구간.
 *
 * `1009점`이라는 숫자만으로는 좋은 것인지 알 수 없다. 기준점이 1000이라는 사실을
 * 아는 사람에게만 뜻이 통하는 숫자라, 읽는 말을 항상 함께 붙인다.
 */
export type ReputationTier = "GREAT" | "GOOD" | "NORMAL" | "CAUTION" | "RISK";

export const REPUTATION_TIER_LABEL: Record<ReputationTier, string> = {
  GREAT: "우수",
  GOOD: "양호",
  NORMAL: "보통",
  CAUTION: "주의",
  RISK: "위험",
};

export const resolveReputationTier = (score: number): ReputationTier => {
  if (score >= REPUTATION_BASE_SCORE + 30) return "GREAT";
  if (score >= REPUTATION_BASE_SCORE + 10) return "GOOD";
  if (score > REPUTATION_BASE_SCORE - 10) return "NORMAL";
  if (score > REPUTATION_BASE_SCORE - 30) return "CAUTION";

  return "RISK";
};

/** 기준점에서 얼마나 움직였는지. `+24` · `-31`처럼 부호를 붙여 적는다. */
export const formatReputationDelta = (delta: number): string =>
  `${delta > 0 ? "+" : ""}${delta}`;

/** 평판을 함께 다룰 때 쓰는 최소 묶음 */
export type ReputationSource = Pick<
  Staff,
  "reputationScore" | "goodCount" | "badCount"
>;

/** 받은 평가 항목 총 개수 */
export const resolveReputationCount = (staff: ReputationSource): number =>
  staff.goodCount + staff.badCount;
