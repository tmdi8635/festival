import type { Manager, OperationLog, OperationSettings } from "@/type/ops";
import { DEFAULT_JOB_ROLES } from "@/type/staff";
import { daysAgo } from "../utils";

/**
 * 내부 담당자 목업.
 *
 * 대표 한 사람이 전부 쥐고 있던 업무를 나누는 것이 이 시스템의 목적이라
 * 매니저 · 조회전용 계정을 처음부터 만들어 둔다.
 */
export const managers: Manager[] = [
  {
    managerId: 1,
    name: "김도윤",
    email: "dy.kim@agency.co.kr",
    phoneNumber: "01033910284",
    role: "OWNER",
    isActive: true,
    eventCount: 14,
    lastLoginAt: daysAgo(0, 9),
    createdAt: daysAgo(900),
  },
  {
    managerId: 2,
    name: "박서진",
    email: "sj.park@agency.co.kr",
    phoneNumber: "01048820137",
    role: "MANAGER",
    isActive: true,
    eventCount: 13,
    lastLoginAt: daysAgo(0, 8),
    createdAt: daysAgo(420),
  },
  {
    managerId: 3,
    name: "이가온",
    email: "gaon.lee@agency.co.kr",
    phoneNumber: "01072640918",
    role: "MANAGER",
    isActive: true,
    eventCount: 11,
    lastLoginAt: daysAgo(1, 19),
    createdAt: daysAgo(180),
  },
  {
    managerId: 4,
    name: "최유나",
    email: "yn.choi@agency.co.kr",
    phoneNumber: "01059930472",
    role: "VIEWER",
    isActive: true,
    eventCount: 0,
    lastLoginAt: daysAgo(6, 14),
    createdAt: daysAgo(90),
  },
  {
    managerId: 5,
    name: "정민석",
    email: "ms.jung@agency.co.kr",
    phoneNumber: "01021170865",
    role: "MANAGER",
    isActive: false,
    eventCount: 6,
    lastLoginAt: daysAgo(140, 11),
    createdAt: daysAgo(560),
  },
];

/**
 * 운영 기준 설정.
 *
 * 직무 · 수당 · 원천징수까지 전부 여기서 켜고 끈다.
 * 에이전시마다 운영 방식이 달라서, 시스템이 강제하는 규칙을 최대한 줄이고
 * "우리는 이렇게 한다"를 이 화면 하나로 정하게 만드는 것이 목적이다.
 */
export const operationSettings: OperationSettings = {
  jobRoles: DEFAULT_JOB_ROLES.map((role) => ({ ...role })),

  withholdingRate: 0.033,

  // 연장·야간수당은 기본값만 정해 두고, 실제 적용은 정산 건마다 고른다.
  isOvertimeEnabled: true,
  overtimeThresholdHours: 8,
  overtimeRate: 0.5,

  isNightPayEnabled: false,
  nightStartTime: "22:00",
  nightEndTime: "06:00",
  nightRate: 0.5,

  blacklistNoShowThreshold: 2,
  reminderDaysBefore: 1,
  contractExpireDays: 3,

  minimumHourlyWage: 10_030,

  /*
    지금은 대부분의 업무를 손으로 처리한다.
    모집 공고와 문자 발송은 화면만 만들어 두고 MOCK으로 열어 둔다.
  */
  featureModes: {
    RECRUIT: "MOCK",
    MESSAGE: "MOCK",
    CLIENT: "ENABLED",
  },

  updatedAt: daysAgo(14),
};

/**
 * 운영 로그 목업.
 *
 * 변경 요청은 MSW 감사 로그 핸들러가 실시간으로 앞에 쌓는다.
 * 여기 있는 값은 화면을 처음 열었을 때 비어 보이지 않게 하는 초기 데이터다.
 */
export const operationLogs: OperationLog[] = [
  {
    logId: 8,
    level: "WARN",
    domain: "STAFF",
    action: "블랙리스트",
    actor: "김도윤",
    message: "노쇼 2회 누적으로 인력을 블랙리스트로 전환했습니다.",
    createdAt: daysAgo(1, 11),
  },
  {
    logId: 7,
    level: "INFO",
    domain: "PAYROLL",
    action: "지급",
    actor: "김도윤",
    message: "정산 24건을 지급 완료 처리했습니다. (총 4,182,000원)",
    createdAt: daysAgo(2, 17),
  },
  {
    logId: 6,
    level: "INFO",
    domain: "MESSAGE",
    action: "발송",
    actor: "박서진",
    message: "출근 안내 문자를 18명에게 발송했습니다.",
    createdAt: daysAgo(2, 20),
  },
  {
    logId: 5,
    level: "ERROR",
    domain: "MESSAGE",
    action: "발송",
    actor: "시스템",
    message: "수신 거부 번호 1건으로 알림톡 발송에 실패했습니다.",
    createdAt: daysAgo(3, 10),
  },
  {
    logId: 4,
    level: "INFO",
    domain: "EVENT",
    action: "생성",
    actor: "이가온",
    message: "신규 행사를 등록했습니다. (슈퍼바이저 1명 · 스태프 14명)",
    createdAt: daysAgo(4, 15),
  },
  {
    logId: 3,
    level: "INFO",
    domain: "CONTRACT",
    action: "발송",
    actor: "박서진",
    message: "근로계약서 15건을 일괄 발송했습니다.",
    createdAt: daysAgo(5, 13),
  },
  {
    logId: 2,
    level: "WARN",
    domain: "EVENT",
    action: "변경",
    actor: "김도윤",
    message: "행사 시작 3일 전 기준 스태프 4자리가 비어 있습니다.",
    createdAt: daysAgo(6, 9),
  },
  {
    logId: 1,
    level: "INFO",
    domain: "OPS",
    action: "변경",
    actor: "김도윤",
    message: "야간수당 가산율을 1.5배로 바꿨습니다.",
    createdAt: daysAgo(14, 16),
  },
];
