import type { PermissionKey } from "./permission";
import type { JobRoleDef } from "./staff";

/**
 * 운영 도메인 타입. 직책(권한 묶음) · 로그 · 기준 설정을 다룬다.
 *
 * 사람 자체는 여기 없다. 직원은 `type/employee.ts`가 갖는다.
 * (예전에는 '담당자'가 여기 따로 있었는데, 담당자와 직원이 같은 사람이라
 * 이름을 두 곳에서 고쳐야 했다)
 */

/**
 * 직책.
 *
 * 권한은 사람이 아니라 **직책**이 갖는다. 직원은 직책에 들어갈 뿐이다.
 * 사람이 바뀌어도 직책은 남고, 규칙이 바뀌면 직책 하나만 고치면 된다.
 */
export interface AdminRole {
  roleId: number;
  name: string;
  description: string;
  permissions: PermissionKey[];
  /**
   * 시스템이 보장하는 직책. **최고관리자 하나뿐이다.**
   *
   * 권한을 뺄 수도, 지울 수도 없다. 뺄 수 있으면 실수 한 번으로
   * "권한을 되돌릴 수 있는 사람이 아무도 없는" 상태가 만들어진다.
   */
  isSuperAdmin: boolean;
  /** 이 직책에 속한 직원 수. 지우기 전에 옮길 사람이 있는지 보여 준다. */
  memberCount: number;
  createdAt: string;
}

export interface AdminRoleFormValues {
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export type LogLevel = "INFO" | "WARN" | "ERROR";

export type LogDomain =
  | "EVENT"
  | "STAFF"
  | "CONTRACT"
  | "PAYROLL"
  | "RECRUIT"
  | "MESSAGE"
  | "CLIENT"
  | "OPS";

export const LOG_DOMAIN_LABEL: Record<LogDomain, string> = {
  EVENT: "행사",
  STAFF: "인사",
  CONTRACT: "계약",
  PAYROLL: "정산",
  RECRUIT: "공고",
  MESSAGE: "발송",
  CLIENT: "거래처",
  OPS: "운영",
};

export interface OperationLog {
  logId: number;
  level: LogLevel;
  domain: LogDomain;
  action: string;
  actor: string;
  message: string;
  createdAt: string;
}

/**
 * 기능 운영 모드.
 *
 * 지금은 대부분의 업무를 손으로 처리한다. 그래서 만들어는 뒀지만
 * 아직 쓸 수 없는 기능(모집 공고, 지원자 관리 등)이 섞여 있다.
 * 이 기능들을 메뉴에서 지워 버리면 나중에 무엇이 있었는지 알 수 없고,
 * 그냥 열어 두면 진짜 데이터인 줄 알고 쓰게 된다. 그래서 세 단계로 나눈다.
 */
export type FeatureMode = "ENABLED" | "MOCK" | "LOCKED";

export const FEATURE_MODE_LABEL: Record<FeatureMode, string> = {
  ENABLED: "사용중",
  MOCK: "체험(MOCK)",
  LOCKED: "잠금",
};

export const FEATURE_MODE_DESCRIPTION: Record<FeatureMode, string> = {
  ENABLED: "실제 업무에 사용합니다.",
  MOCK: "샘플 데이터로 화면만 둘러봅니다. 저장해도 실제로 반영되지 않습니다.",
  LOCKED: "메뉴에서 잠급니다. 준비되면 여기서 다시 열 수 있습니다.",
};

/** 모드를 지정할 수 있는 기능 단위 */
export type FeatureKey = "RECRUIT" | "MESSAGE" | "CLIENT" | "HR_POLICY";

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  RECRUIT: "모집 (공고 · 지원자)",
  MESSAGE: "공지 · 문자 발송",
  CLIENT: "거래처 관리",
  HR_POLICY: "인사 · 운영 기준 자동화",
};

export const FEATURE_HINT: Record<FeatureKey, string> = {
  RECRUIT:
    "앱 출시 전까지는 공고를 띄울 곳이 없습니다. 인력은 인력풀에서 직접 등록하세요.",
  MESSAGE: "문자 API 연동 전입니다. 문구만 만들어 기존 방식으로 보내야 합니다.",
  CLIENT: "발주처를 따로 관리하지 않는다면 꺼 두세요.",
  /*
    블랙리스트 자동 후보 · 출근 안내 자동 발송 · 계약서 기한 알림은
    전부 "때가 되면 시스템이 먼저 알려 준다"는 기능인데, 그 알림을 내보낼
    곳(문자 · 푸시)이 아직 없다. 숫자만 저장되고 아무 일도 일어나지 않으므로
    켜 두면 "설정했으니 돌아가고 있겠지"라고 믿게 된다.
  */
  HR_POLICY:
    "알림을 내보낼 곳이 아직 없어 기준값만 저장됩니다. 블랙리스트 후보 · 출근 안내 · 계약서 기한은 지금은 담당자가 직접 확인해야 합니다.",
};

/**
 * 운영 기준 설정.
 *
 * 매번 사람이 판단하던 값(직무 · 시급 · 수당)을 규칙으로 굳혀 둔다.
 * 에이전시마다 운영 방식이 달라서, 강제하지 않고 최대한 켜고 끌 수 있게 만든다.
 */
export interface OperationSettings {
  /**
   * 직무별 단가와 사용 여부.
   *
   * **직무 목록 자체는 여기 없다.** 직무는 대행사와 주고받는 말이라
   * 시스템이 고정하고(`JOB_ROLE_CATALOG`), 에이전시가 정하는 것은
   * 지급 단가 · 청구 단가 · 우리가 그 직무를 취급하는지뿐이다.
   * 그래서 이 배열에는 카탈로그에 없는 코드가 들어올 수 없고,
   * 빠진 코드가 있어도 `mergeJobRoles()`가 기본 단가로 메운다.
   */
  jobRoles: JobRoleDef[];

  /** 사업소득 원천징수율 (0.033 = 3.3%) */
  withholdingRate: number;

  /**
   * 연장수당 기본 적용 여부.
   * 여기서 정한 값이 정산 건의 초기값이 되고, 건마다 정산 화면에서 다시 끌 수 있다.
   */
  isOvertimeEnabled: boolean;
  /** 연장근로 기준 시간 */
  overtimeThresholdHours: number;
  /** 기준 초과분에 곱하는 가산율 (0.5 = 0.5배 추가) */
  overtimeRate: number;

  /** 야간수당 기본 적용 여부 */
  isNightPayEnabled: boolean;
  /** 야간 가산 시작 시각 */
  nightStartTime: string;
  /** 야간 가산 종료 시각 */
  nightEndTime: string;
  /** 야간 시간에 곱하는 가산율 */
  nightRate: number;

  /** 노쇼 몇 회부터 블랙리스트 후보로 올릴지 */
  blacklistNoShowThreshold: number;
  /** 행사 시작 며칠 전에 출근 안내를 보낼지 */
  reminderDaysBefore: number;
  /**
   * 근무 시작 며칠 전까지 서명본이 등록돼야 하는지.
   *
   * 서명 요청 링크의 유효 기간이 아니다. 지금은 링크가 나가지 않는다.
   * 담당자가 종이를 배부하고 받아 오는 데 걸리는 시간을 앞에 두는 값이다.
   */
  contractRegisterDeadlineDays: number;

  /*
    행사 등록 폼의 시간 · 휴게시간 기본값은 두지 않는다.
    행사마다 천차만별이라 하나로 특정할 수 없고, 어설픈 초기값이 깔려 있으면
    고치지 않고 그대로 저장하는 사고가 오히려 늘어난다.
  */

  /** 시급 입력을 검증하는 하한선 */
  minimumHourlyWage: number;

  /** 기능별 운영 모드 */
  featureModes: Record<FeatureKey, FeatureMode>;

  /** 본인이 찍는 출퇴근을 어떻게 기록할지 */
  attendance: AttendanceSettings;

  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* 출퇴근 기록 규칙                                                      */
/* ------------------------------------------------------------------ */

/**
 * 찍은 시각을 **예정 시각에 맞출지**.
 *
 * - `ACTUAL`   찍은 그대로 남긴다
 * - `SCHEDULE` 예정 시각 쪽으로 당긴다. **한 방향으로만** 당긴다는 것이 핵심이다
 *              (출근은 이른 것만, 퇴근은 늦은 것만). 양쪽을 다 맞추면
 *              지각과 조퇴가 화면에서 통째로 사라진다
 */
export type CheckTimeBase = "ACTUAL" | "SCHEDULE";

export const CHECK_TIME_BASE_LABEL: Record<CheckTimeBase, string> = {
  ACTUAL: "찍은 시각 그대로",
  SCHEDULE: "예정 시각으로 맞춤",
};

/** 분 단위로 굴리는 방향 */
export type CheckTimeRounding = "NONE" | "UP" | "DOWN" | "NEAREST";

export const CHECK_TIME_ROUNDING_LABEL: Record<CheckTimeRounding, string> = {
  NONE: "보정 안 함",
  UP: "올림",
  DOWN: "내림",
  NEAREST: "반올림",
};

/** 고를 수 있는 보정 단위 (분) */
export const CHECK_TIME_UNITS = [10, 15, 30, 60] as const;

/**
 * 출근 또는 퇴근 한쪽의 기록 규칙.
 *
 * 두 축으로 나눠 둔 이유가 있다. 한 덩어리 enum으로 만들면
 * "10분 단위로 올린 다음 예정 시각을 넘지 않게" 같은 조합을 표현할 수 없다.
 *
 * **적용 순서는 단위 보정 → 예정 클램프다.** 반대로 하면 맞춰 둔 값을 다시 굴려
 * 예정 시각에서 벗어난다. (`applyCheckTimeRule`)
 */
export interface CheckTimeRule {
  base: CheckTimeBase;
  rounding: CheckTimeRounding;
  /** `rounding`이 `NONE`이면 쓰이지 않는다 */
  unit: number;
}

/**
 * 근태 기록 기준.
 *
 * **본인이 찍는 경로에만 적용된다.** 관리자가 근태 모달에서 직접 적는 시각에는
 * 걸지 않는다. 관리자는 "실제로 이랬다"를 적는 사람이고, 그 입력에 규칙을 또 걸면
 * 잘못 들어간 기록을 고칠 방법이 없어진다.
 */
export interface AttendanceSettings {
  checkIn: CheckTimeRule;
  checkOut: CheckTimeRule;
  /** 근무 시작 몇 시간 전부터 출근을 찍을 수 있는지 */
  checkInWindowBeforeHours: number;
  /** 예정 종료 몇 시간 뒤까지 찍을 수 있는지 */
  checkInWindowAfterHours: number;
  /**
   * 현장으로 인정하는 반경 (m).
   *
   * 0이면 위치를 확인하지 않는다. 행사에 좌표가 없을 때도 확인하지 않는다 —
   * 좌표를 깜빡한 행사에서 전원이 출근을 못 찍으면 그 순간 현장이 멈춘다.
   */
  checkInRadiusMeters: number;
}

/**
 * 기준 설정 응답에 근태 항목이 없을 때 메우는 기본값.
 *
 * 서버가 아직 이 필드를 모르는 동안에도 화면이 돌아야 한다. (`mergeJobRoles`와 같은 이유)
 * 기본은 **예정 시각으로 맞춤**이다 — 일찍 온 것이 곧바로 돈이 되면 다들 일찍 찍고,
 * 정리하고 나가느라 늦게 찍은 것이 연장수당이 되면 돈이 샌다.
 */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  checkIn: { base: "SCHEDULE", rounding: "NONE", unit: 10 },
  checkOut: { base: "SCHEDULE", rounding: "NONE", unit: 10 },
  checkInWindowBeforeHours: 2,
  checkInWindowAfterHours: 2,
  checkInRadiusMeters: 300,
};

/** 응답에 빠져 있거나 일부만 온 근태 설정을 기본값으로 메운다. */
export const mergeAttendanceSettings = (
  attendance?: Partial<AttendanceSettings>,
): AttendanceSettings => ({
  ...DEFAULT_ATTENDANCE_SETTINGS,
  ...attendance,
  checkIn: { ...DEFAULT_ATTENDANCE_SETTINGS.checkIn, ...attendance?.checkIn },
  checkOut: { ...DEFAULT_ATTENDANCE_SETTINGS.checkOut, ...attendance?.checkOut },
});

/**
 * 직무를 하나도 안 쓰는 상태인지 본다.
 *
 * 직무는 지울 수 없고 끄기만 할 수 있는데, 전부 꺼 버리면 행사를 만들 수 없다.
 * 저장을 막는 대신 화면에서 경고한다.
 */
export const hasActiveJobRole = (jobRoles: JobRoleDef[]): boolean =>
  jobRoles.some((role) => role.isActive);
