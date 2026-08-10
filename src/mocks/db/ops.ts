import type { AdminRole, OperationLog, OperationSettings } from "@/type/ops";
import type { Employee } from "@/type/employee";
import { normalizePermissions, type PermissionKey } from "@/type/permission";
import { DEFAULT_JOB_ROLES } from "@/type/staff";
import { EMPLOYEE_SEED, employeeStaff } from "./staff";
import { daysAgo } from "../utils";

/**
 * 직책 목업.
 *
 * 처음부터 여러 개를 깔아 둔다. 하나만 두면 "직책을 나눈다"는 개념 자체가
 * 화면에서 드러나지 않아, 결국 전원이 최고관리자로 굴러가게 된다.
 *
 * 권한 구성은 실제로 업무를 나누는 방식에서 왔다.
 * 현장을 굴리는 사람에게 정산 승인까지 열어 줄 이유가 없고,
 * 정산을 보는 사람이 인력 서류(개인정보)를 볼 이유도 없다.
 */
export const adminRoles: AdminRole[] = [
  {
    roleId: 1,
    name: "최고관리자",
    description: "모든 권한을 갖습니다. 직책과 직원을 관리합니다.",
    permissions: [],
    isSuperAdmin: true,
    memberCount: 0,
    createdAt: daysAgo(900),
  },
  {
    roleId: 2,
    name: "운영 매니저",
    description: "행사 · 배치 · 계약을 처리합니다. 정산 승인과 계좌는 볼 수 없습니다.",
    permissions: normalizePermissions([
      "event:read", "event:write",
      "assignment:read", "assignment:write", "assignment:delete",
      "staff:read", "staff:write",
      "contract:read", "contract:write",
      "recruit:read", "recruit:write",
      "message:read", "message:write",
      "settings:read",
      "log:read",
    ] as PermissionKey[]),
    isSuperAdmin: false,
    memberCount: 0,
    createdAt: daysAgo(420),
  },
  {
    roleId: 3,
    name: "정산 담당",
    description: "정산 금액을 확인하고 지급을 승인합니다. 현장 배치는 조회만 합니다.",
    permissions: normalizePermissions([
      "event:read",
      "assignment:read",
      "staff:read",
      "contract:read",
      "payroll:read", "payroll:write", "payroll:approve", "payroll:pay",
      "client:read",
      "log:read",
    ] as PermissionKey[]),
    isSuperAdmin: false,
    memberCount: 0,
    createdAt: daysAgo(300),
  },
  {
    roleId: 4,
    name: "조회 전용",
    description: "일정과 배치 현황만 봅니다. 아무것도 바꿀 수 없습니다.",
    permissions: normalizePermissions([
      "event:read",
      "assignment:read",
      "staff:read",
    ] as PermissionKey[]),
    isSuperAdmin: false,
    memberCount: 0,
    createdAt: daysAgo(90),
  },
];

export const findAdminRole = (roleId: number) =>
  adminRoles.find((role) => role.roleId === roleId);

/**
 * 직원 목업.
 *
 * **인력 레코드에서 만든다.** (`EMPLOYEE_SEED` · `employeeStaff()`)
 * 예전에는 담당자 목록을 여기 손으로 적어 뒀는데, 같은 사람이 인력풀에도 있어서
 * 이름을 한쪽만 고치면 두 화면이 다른 사람을 가리켰다.
 * 이제 사람은 인력풀 한 곳에 있고, 여기서는 **계정 · 권한만** 얹는다.
 */
export const employees: Employee[] = employeeStaff().map((staff, index) => {
  const seed = EMPLOYEE_SEED[index];
  const role = findAdminRole(seed.roleId) ?? adminRoles[adminRoles.length - 1];

  return {
    employeeId: index + 1,
    staffId: staff.staffId,

    name: staff.name,
    email: seed.email,
    phoneNumber: staff.phoneNumber,
    profileImageUrl: staff.profileImageUrl,
    birthDate: staff.birthDate,
    gender: staff.gender,
    address: staff.address,
    emergencyContact: staff.emergencyContact,
    hireDate: staff.hireDate ?? daysAgo(seed.months * 30).slice(0, 10),
    memo: "",

    position: seed.position,
    roleId: role.roleId,
    roleName: role.name,
    isSuperAdmin: role.isSuperAdmin,
    baseMonthlyHours: staff.baseMonthlyHours ?? seed.baseHours,
    isActive: seed.isActive !== false,

    /* 담당 행사 수는 행사 목업이 아직 없을 수도 있어 조회 시점에 다시 센다. */
    eventCount: 0,
    lastLoginAt: seed.isActive === false
      ? daysAgo(140, 11)
      : daysAgo(index % 7, 9 + (index % 8)),
    createdAt: daysAgo(seed.months * 30),
  };
});

export const findEmployee = (employeeId: number) =>
  employees.find((employee) => employee.employeeId === employeeId);

/** 인력 쪽에서 거꾸로 찾는다. 배치 화면이 "이 사람 우리 직원인가"를 물을 때 쓴다. */
export const findEmployeeByStaffId = (staffId: number) =>
  employees.find((employee) => employee.staffId === staffId);

/** 직책별 인원은 직원 목록이 원본이다. 따로 세어 두면 둘이 어긋난다. */
export const recalculateRoleMemberCounts = () => {
  adminRoles.forEach((role) => {
    role.memberCount = employees.filter(
      (employee) => employee.roleId === role.roleId,
    ).length;
  });
};

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
  contractRegisterDeadlineDays: 3,

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
    message: "근로계약서 15건의 서명본을 등록했습니다.",
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

recalculateRoleMemberCounts();
