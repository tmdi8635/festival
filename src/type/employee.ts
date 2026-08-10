/**
 * 직원 도메인.
 *
 * ## 직원과 담당자는 같은 사람이다
 *
 * 예전에는 '담당자 관리'와 '직원 관리'가 따로 있었다. 담당자는 계정 · 권한을,
 * 직원은 인적사항 · 근무를 들고 있었는데 **둘 다 같은 사람을 가리켰다.**
 * 이름을 두 곳에서 고쳐야 하고, 한쪽에만 있는 사람이 생기고,
 * "박서진이 담당자 목록에는 있는데 직원 목록에는 없다"가 실제로 만들어진다.
 * 그래서 하나로 합쳤다. 회사에 소속된 사람은 전부 여기 한 줄이다.
 *
 * ## 화면은 둘로 나눈다
 *
 * 자료는 하나지만 **묻는 질문이 다르다.**
 *
 * - **직원 관리** — "이 사람은 누구이고 무엇을 할 수 있나."
 *   인적사항 · 회사 직책 · 시스템 권한(직책)을 다룬다.
 * - **직원 근무** — "이번 달에 얼마나 일했나."
 *   기본 근무시간 대비 채움 · 초과, 어느 행사에 며칠 나갔는지를 본다.
 *
 * 한 화면에 다 넣으면 인적사항을 고치러 들어와서 근무 집계를 스크롤로 넘겨야 하고,
 * 근무를 보러 와서는 계정 · 권한이 눈에 들어온다. 탭마다 질문 하나다.
 *
 * ## 직무가 아니라 사람 쪽에 표시한다
 *
 * 직원은 대행사가 주는 자리에 따라 메인팀장도 스태프도 맡는다. 그래서 '직원'을
 * 직무로 만들 수 없다. (직무 목록에 넣으면 직원이 팀장을 맡은 행사에서
 * 팀장 발주가 한 명 비게 된다) 대신 **인력풀의 한 사람**으로 두되 고용 형태만
 * 다르게 표시한다. (`Staff.employment`) 배치 · 출퇴근 · 캘린더는 프리랜서와
 * 같은 길을 쓰고, **돈과 계약서만 갈라진다.**
 *
 * - 근로계약서를 쓰지 않는다. 회사와 이미 근로계약이 되어 있다.
 * - 시급 정산을 하지 않는다. 급여는 월급으로 나간다.
 * - 대신 **근무시간을 센다.** 그것이 '직원 근무' 화면이다.
 */

import type { PermissionKey } from "./permission";
import type { Gender, Staff } from "./staff";

/**
 * 고용 형태.
 *
 * 인력풀에 섞여 있어도 이 값 하나로 계약 · 정산에서 갈라진다.
 * 기본값을 프리랜서로 두는 이유는, 새로 등록되는 사람 대부분이 프리랜서이고
 * 잘못 갈라졌을 때 **계약서를 안 쓰는 쪽이 더 위험하기 때문**이다.
 */
export type EmploymentType = "FREELANCER" | "EMPLOYEE";

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  FREELANCER: "프리랜서",
  EMPLOYEE: "직원",
};

/** 직원인가. 계약 · 정산에서 빼는 판단을 한 곳에서만 한다. */
export const isEmployee = (source: {
  employment?: EmploymentType;
}): boolean => source.employment === "EMPLOYEE";

/**
 * 흔한 회사 직책.
 *
 * 고정 목록이 아니라 **거들어 주는 보기**다. 에이전시마다 부르는 이름이 달라서
 * (실장 · PM · 매니저) 고정하면 반드시 안 맞는 곳이 생긴다.
 * 직접 칠 수 있게 두고, 자주 쓰는 것만 눌러 넣게 한다.
 */
export const EMPLOYEE_POSITION_PRESETS = [
  "사원",
  "주임",
  "대리",
  "과장",
  "차장",
  "부장",
  "실장",
  "이사",
  "대표",
];

/**
 * 기본 근무시간의 기본값 (시간/월).
 *
 * 주 40시간 × 4.345주 ≒ 174시간. 회사마다, 사람마다 다르므로 직원별로 고친다.
 */
export const DEFAULT_BASE_MONTHLY_HOURS = 174;

/**
 * 직원 한 명.
 *
 * **계정이자 사람이다.** 로그인 · 권한(`roleId`)과 인적사항이 한 레코드에 있고,
 * 현장에 나가기 위한 인력풀 레코드(`staffId`)를 함께 갖는다.
 * 인력 레코드를 따로 두는 이유는 배치 · 출퇴근 · 캘린더가 전부 `staffId`로
 * 돌아가기 때문이고, 그 길을 직원만을 위해 두 벌로 만들 이유가 없기 때문이다.
 */
export interface Employee {
  employeeId: number;
  /**
   * 인력풀 레코드.
   *
   * 이 값이 있어야 행사에 배치할 수 있다. 직원을 만들 때 함께 생기고,
   * 이름 · 연락처를 고치면 양쪽이 같이 바뀐다.
   */
  staffId: number;

  /* ------------------------------ 인적사항 ------------------------------ */

  name: string;
  email: string;
  phoneNumber: string;
  profileImageUrl: string;
  birthDate: string;
  gender: Gender;
  address: string;
  /** 비상 연락처. 현장에서 사고가 났을 때 회사가 찾을 번호다. */
  emergencyContact: string;
  hireDate: string;
  memo: string;

  /* -------------------------------- 자리 -------------------------------- */

  /** 회사 직책. 행사에서 맡는 직무(JobRole)와 다르다. */
  position: string;
  /**
   * 시스템 권한 묶음(직책).
   *
   * 권한은 사람이 아니라 직책이 갖는다. 사람마다 주면 규칙이 바뀔 때
   * 전원을 다시 손봐야 하고, 한 명만 빠뜨리면 그 사람만 조용히 다른 권한을 갖는다.
   */
  roleId: number;
  roleName: string;
  isSuperAdmin: boolean;
  /** 한 달에 채워야 하는 시간. 근무 집계의 기준선이다. */
  baseMonthlyHours: number;
  /** 퇴사자는 끄기만 하고 지우지 않는다. 지나간 행사 기록이 이 사람을 가리킨다. */
  isActive: boolean;

  /* -------------------------------- 참고 -------------------------------- */

  /** 담당 중인 행사 수 */
  eventCount: number;
  lastLoginAt?: string;
  createdAt: string;
}

/** 직원 등록 · 수정 폼 값 */
export interface EmployeeFormValues {
  name: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  gender: Gender;
  address: string;
  emergencyContact: string;
  hireDate: string;
  position: string;
  roleId: number;
  baseMonthlyHours: number;
  isActive: boolean;
  memo: string;
}

/** 현재 로그인한 직원. 권한 판정에 쓰는 최소한의 묶음이다. */
export interface EmployeeProfile {
  employeeId: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  isSuperAdmin: boolean;
  permissions: PermissionKey[];
}

/* ------------------------------------------------------------------ */
/* 근무 집계                                                            */
/* ------------------------------------------------------------------ */

/**
 * 그 달에 나간 행사 하나.
 *
 * 시간 합계만 주면 "82시간"이 어디서 나왔는지 설명하지 못한다.
 * 초과가 났을 때 관리자가 실제로 하는 일은 **어느 현장이 길었는지 찾는 것**이라,
 * 행사별로 며칠 · 몇 시간인지가 함께 있어야 한다.
 */
export interface EmployeeWorkEvent {
  eventId: number;
  eventTitle: string;
  clientName: string;
  /** 이 달에 나간 날짜만 (오름차순) */
  workDates: string[];
  workHours: number;
  /** 그중 출퇴근이 안 찍혀 예정 시간으로 센 시간 */
  scheduledHours: number;
}

/**
 * 직원 근무 한 줄. **직원 × 달**이다.
 *
 * 입사일 · 이메일 같은 인적사항은 넣지 않는다. 이 화면이 답하는 질문은
 * "이번 달에 얼마나 일했나" 하나이고, 나머지는 직원 관리에서 본다.
 */
export interface EmployeeWorkRow {
  employeeId: number;
  staffId: number;
  name: string;
  position: string;
  phoneNumber: string;
  profileImageUrl: string;
  isActive: boolean;

  /** 집계 기준 달 (`YYYY-MM`) */
  month: string;
  baseMonthlyHours: number;
  /**
   * 이 달에 실제로 일한 시간.
   *
   * 출퇴근이 찍힌 날은 실제 시각으로, 아직 안 찍힌 날은 행사 예정 시간으로 센다.
   * 정산이 쓰는 규칙(`resolveWorkHours`)과 같은 함수를 쓴다. 여기서만 다르게 세면
   * 같은 근무가 정산 화면과 직원 화면에서 다른 시간으로 적힌다.
   */
  workedHours: number;
  /** 그중 예정 시간으로 센 시간. 남아 있으면 이 숫자는 아직 확정이 아니다. */
  scheduledHours: number;
  workedDays: number;
  /** 이 달에 나간 행사 (근무시간이 많은 순) */
  events: EmployeeWorkEvent[];
}

/** 근무 화면 상단 합계 */
export interface EmployeeWorkSummary {
  /** 집계에 잡힌 직원 수 */
  totalCount: number;
  totalWorkedHours: number;
  totalBaseHours: number;
  /** 기준을 넘긴 인원. 다음 달 배치를 덜어 줘야 하는 쪽이다. */
  overCount: number;
  /** 한참 못 채운 인원(60% 미만). 현장에 더 넣을 수 있는 쪽이다. */
  underCount: number;
  /** 초과분 합계. 회사가 이 달에 얼마나 무리했는지를 한 숫자로 보여 준다. */
  totalOverHours: number;
}

/**
 * 기준 시간을 얼마나 채웠는지.
 *
 * 비율만 주면 "104%"가 좋은 건지 나쁜 건지 읽는 사람마다 다르게 본다.
 * 남은 시간 · 초과 시간을 함께 줘서 다음에 무엇을 해야 하는지가 보이게 한다.
 * (모자라면 배치를 더 잡고, 넘치면 다음 달 배치를 덜어 준다)
 */
export const summarizeEmployeeHours = (employee: {
  workedHours: number;
  baseMonthlyHours: number;
}) => {
  const { workedHours, baseMonthlyHours } = employee;

  const rate =
    baseMonthlyHours > 0
      ? Math.round((workedHours / baseMonthlyHours) * 100)
      : 0;
  const diff = Math.round((workedHours - baseMonthlyHours) * 10) / 10;

  return {
    rate,
    /** 남은 시간. 이미 넘겼으면 0이다. */
    remainingHours: Math.max(0, -diff),
    /** 초과한 시간. 아직 모자라면 0이다. */
    overHours: Math.max(0, diff),
    isOver: diff > 0,
  };
};

/**
 * 채움 정도를 색으로 가른다.
 *
 * 넘긴 것도 모자란 것도 둘 다 눈에 띄어야 한다.
 * 초과는 다음 달 배치를 덜어야 한다는 뜻이고, 미달은 사람이 놀고 있다는 뜻이다.
 */
export const resolveEmployeeHourTone = (
  rate: number,
): "default" | "success" | "warning" | "danger" => {
  if (rate > 110) return "danger";
  if (rate >= 90) return "success";
  if (rate >= 60) return "default";

  return "warning";
};

/** 인력풀에서 직원만 추린다. */
export const pickEmployees = <T extends Pick<Staff, "employment">>(
  people: readonly T[],
): T[] => people.filter(isEmployee);

/* ------------------------------------------------------------------ */
/* 달                                                                   */
/* ------------------------------------------------------------------ */

/** `YYYY-MM`으로 달 키를 만든다. */
export const monthKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** `2026-08` → `2026년 8월` */
export const formatMonthLabel = (month: string): string => {
  const [year, monthPart] = month.split("-");

  return `${year}년 ${Number(monthPart)}월`;
};

/** 달 이동. `-1`이면 지난달이다. */
export const shiftMonth = (month: string, offset: number): string => {
  const [year, monthPart] = month.split("-").map(Number);

  return monthKey(new Date(year, monthPart - 1 + offset, 1));
};

/** `2026-08` → `2026` */
export const yearOf = (month: string): number => Number(month.split("-")[0]);

/** `2026-08` → `8` */
export const monthOf = (month: string): number => Number(month.split("-")[1]);

/** 연 · 월을 합쳐 달 키로 만든다. */
export const toMonthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;
