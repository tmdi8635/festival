import type { PermissionKey } from "./permission";
import type { JobRoleDef } from "./staff";

/** 운영 도메인 타입. 내부 담당자 · 로그 · 기준 설정을 다룬다. */

/**
 * 직책.
 *
 * 권한은 사람이 아니라 **직책**이 갖는다. 담당자는 직책에 들어갈 뿐이다.
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
  /** 이 직책에 속한 담당자 수. 지우기 전에 옮길 사람이 있는지 보여 준다. */
  memberCount: number;
  createdAt: string;
}

export interface AdminRoleFormValues {
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export interface Manager {
  managerId: number;
  name: string;
  email: string;
  phoneNumber: string;
  roleId: number;
  /** 목록에서 바로 보여 주기 위한 직책 이름 */
  roleName: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  /** 담당 중인 행사 수 */
  eventCount: number;
  lastLoginAt?: string;
  createdAt: string;
}

export interface ManagerFormValues {
  name: string;
  email: string;
  phoneNumber: string;
  roleId: number;
  isActive: boolean;
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
export type FeatureKey = "RECRUIT" | "MESSAGE" | "CLIENT";

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  RECRUIT: "모집 (공고 · 지원자)",
  MESSAGE: "공지 · 문자 발송",
  CLIENT: "거래처 관리",
};

export const FEATURE_HINT: Record<FeatureKey, string> = {
  RECRUIT:
    "앱 출시 전까지는 공고를 띄울 곳이 없습니다. 인력은 인력풀에서 직접 등록하세요.",
  MESSAGE: "문자 API 연동 전입니다. 문구만 만들어 기존 방식으로 보내야 합니다.",
  CLIENT: "발주처를 따로 관리하지 않는다면 꺼 두세요.",
};

/**
 * 운영 기준 설정.
 *
 * 매번 사람이 판단하던 값(직무 · 시급 · 수당)을 규칙으로 굳혀 둔다.
 * 에이전시마다 운영 방식이 달라서, 강제하지 않고 최대한 켜고 끌 수 있게 만든다.
 */
export interface OperationSettings {
  /**
   * 직무 정의. 최소 한 개는 있어야 한다.
   * 직무를 지우면 그 직무로 잡혀 있던 인력·배치의 직무가 사라지므로
   * 화면에서 반드시 경고를 띄운 뒤에 지운다.
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
  /** 계약서 서명 요청 링크 유효 기간(일) */
  contractExpireDays: number;

  /*
    행사 등록 폼의 시간 · 휴게시간 기본값은 두지 않는다.
    행사마다 천차만별이라 하나로 특정할 수 없고, 어설픈 초기값이 깔려 있으면
    고치지 않고 그대로 저장하는 사고가 오히려 늘어난다.
  */

  /** 시급 입력을 검증하는 하한선 */
  minimumHourlyWage: number;

  /** 기능별 운영 모드 */
  featureModes: Record<FeatureKey, FeatureMode>;

  updatedAt: string;
}

/**
 * 직무를 지울 수 있는지 본다.
 *
 * 마지막 한 개까지 지우면 행사를 만들 수 없게 되므로 최소 1개는 남긴다.
 */
export const canRemoveJobRole = (jobRoles: JobRoleDef[]): boolean =>
  jobRoles.length > 1;
