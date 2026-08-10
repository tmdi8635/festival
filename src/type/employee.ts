/**
 * 직원 도메인.
 *
 * ## 직원은 직무가 아니다
 *
 * 에이전시에는 월급을 받는 자기 직원이 있다. 이 사람들도 현장에 나가는데,
 * 나가는 자리는 그때그때 다르다. 대행사가 슈퍼바이저 TO를 주면 직원이 메인을 잡고
 * 그 아래를 프리랜서 팀장 · 시급제 알바가 채운다. 다음 행사에서는 같은 직원이
 * 스태프 자리에 서기도 한다.
 *
 * 그래서 '직원'을 **직무로 만들 수 없다.** 직무는 "이 행사에 팀장 2명 · 스태프 20명"처럼
 * 발주를 세는 단위인데, 직원은 그 칸 어디에나 들어가는 사람이기 때문이다.
 * 직무 목록에 '직원'을 넣으면 직원이 팀장을 맡은 행사에서 팀장 발주가 한 명 비게 된다.
 *
 * ## 대신 사람 쪽에 표시한다
 *
 * 직원은 **인력풀의 한 사람**으로 두되 고용 형태만 다르게 표시한다.
 * (`Staff.employment`) 그러면 배치 · 출퇴근 · 캘린더는 프리랜서와 똑같은 길을 쓰고,
 * **돈과 계약서만 갈라진다.**
 *
 * - 근로계약서를 쓰지 않는다. 이미 회사와 근로계약이 되어 있는 사람이다.
 * - 시급 정산을 하지 않는다. 급여는 회사가 월급으로 낸다.
 * - 대신 **근무시간을 센다.** 월급제라 시간이 돈으로 바뀌지는 않지만,
 *   이번 달에 얼마나 현장에 나갔는지는 관리자가 알아야 한다.
 *
 * 그 집계가 이 파일이 다루는 것이고, 화면은 운영 > 직원 관리다.
 */

import type { Staff } from "./staff";

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
 * 흔한 직책.
 *
 * 고정 목록이 아니라 **거들어 주는 보기**다. 에이전시마다 부르는 이름이 달라서
 * (실장 · 팀장 · PM · 매니저) 고정하면 반드시 안 맞는 곳이 생긴다.
 * 그래서 직접 칠 수 있게 두고, 자주 쓰는 것만 눌러 넣게 한다.
 */
export const EMPLOYEE_POSITION_PRESETS = [
  "사원",
  "주임",
  "대리",
  "과장",
  "차장",
  "부장",
  "팀장",
  "실장",
  "이사",
];

/**
 * 기본 근무시간의 기본값 (시간/월).
 *
 * 주 40시간 × 4.345주 ≒ 174시간. 회사마다 다르므로 직원마다 고칠 수 있다.
 */
export const DEFAULT_BASE_MONTHLY_HOURS = 174;

/**
 * 직원 한 명. **인력풀 레코드 위에 얹힌 고용 정보 + 이번 달 집계**다.
 *
 * 별도 테이블로 떼지 않는다. 떼면 같은 사람이 인력 레코드와 직원 레코드로
 * 둘이 되고, 이름 · 연락처를 한쪽만 고치는 일이 반드시 생긴다.
 */
export interface Employee {
  /** 인력풀과 같은 식별자. 배치 · 출퇴근이 이 값을 쓴다. */
  staffId: number;
  name: string;
  phoneNumber: string;
  profileImageUrl: string;
  /** 직책. 직무(JobRole)와 다르다. 회사 안에서의 자리다. */
  position: string;
  hireDate: string;
  /**
   * 이번 달에 채워야 하는 시간.
   *
   * 월급제라 시간이 돈으로 바뀌지는 않지만, 이 기준이 없으면
   * "이번 달 82시간"이 많은 건지 적은 건지 아무도 판단할 수 없다.
   */
  baseMonthlyHours: number;
  /** 퇴사자는 끄기만 하고 지우지 않는다. 과거 행사 기록이 이 사람을 가리킨다. */
  isActive: boolean;
  memo: string;

  /* ------------------------------ 이번 달 집계 ----------------------------- */

  /** 집계 기준 달 (`YYYY-MM`) */
  month: string;
  /**
   * 이 달에 실제로 일한 시간.
   *
   * 출퇴근이 찍힌 날은 실제 시각으로, 아직 안 찍힌 날은 행사 예정 시간으로 센다.
   * (`resolveWorkHours`와 같은 규칙) 예정으로 센 날이 있으면 아직 확정이 아니다.
   */
  workedHours: number;
  /** 그중 출퇴근이 아직 안 찍혀 예정 시간으로 센 시간 */
  scheduledHours: number;
  workedDays: number;
  /** 나간 행사 수 (같은 행사에 여러 날 나가도 하나) */
  eventCount: number;
  /** 그중 메인팀장으로 들어간 행사 수 */
  mainSupervisorCount: number;
}

/** 직원 등록 · 수정 폼 값 */
export interface EmployeeFormValues {
  name: string;
  phoneNumber: string;
  position: string;
  hireDate: string;
  baseMonthlyHours: number;
  isActive: boolean;
  memo: string;
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

/** `YYYY-MM`으로 이번 달 키를 만든다. */
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
  const shifted = new Date(year, monthPart - 1 + offset, 1);

  return monthKey(shifted);
};
