import { type WageType } from "./event";
import type { AttendanceStatus, JobRole } from "./staff";

/**
 * 정산 도메인 타입.
 *
 * **정산 한 건은 "행사 × 사람"이다.** 배치는 사람×날짜라서 3일짜리 행사에
 * 사흘 다 나온 사람은 배치가 3건인데, 정산까지 3건으로 쪼개 두면
 * 담당자는 한 사람에게 세 번 이체하거나, 세 줄을 손으로 더해 한 번 이체한다.
 * 둘 다 틀린다. 실제로 돈이 나가는 단위는 **계약서 한 장이 덮는 기간 전체**다.
 *
 * 그래서 근무일별 기록(`days`)은 그대로 들고 있되, 금액은 전부 합쳐서 낸다.
 * 계좌 정보를 함께 들고 있어야 은행 이체 파일을 바로 만들 수 있다.
 */

export type PayrollStatus = "PENDING" | "APPROVED" | "PAID" | "HOLD";

export const PAYROLL_STATUS_LABEL: Record<PayrollStatus, string> = {
  PENDING: "정산대기",
  APPROVED: "지급승인",
  PAID: "지급완료",
  HOLD: "보류",
};

/**
 * 정산 한 건에 묶인 근무일 하나.
 *
 * 합계만 들고 있으면 "왜 이 금액인지"를 설명할 수 없다.
 * 3일 중 하루만 지각했다거나, 이틀은 출퇴근이 찍혔는데 하루는 비어 있다거나
 * 하는 사정이 전부 이 배열에 남아 있어야 금액에 대해 이야기할 수 있다.
 */
export interface PayrollWorkDay {
  assignmentId: number;
  workDate: string;
  /**
   * 이 날 적용된 지급 기준과 금액.
   *
   * 금액은 **배치 한 건(=사람×날짜)마다 따로 정해질 수 있다.**
   * 같은 사람이 첫날은 설치를 도와 일급을 받고 이후는 시급으로 서는 일이 있고,
   * 같은 직무라도 경력자에게만 시급을 더 주기로 하는 일이 흔하다.
   * 그래서 합계 하나가 아니라 날짜별로 들고 있는다.
   */
  wageType: WageType;
  wage: number;
  /** 이 날의 기본급. 시급이면 `금액 × 실근무시간`, 일급이면 금액 그대로다. */
  basePay: number;
  /** 이 날의 정산 기준 실근무시간 */
  workHours: number;
  /** 행사에 적힌 예정 근무시간 */
  scheduledWorkHours: number;
  /** 실제 출퇴근 기록으로 계산했는지. false면 예정 시간 기준의 잠정치다. */
  isActualTimeApplied: boolean;
  checkInAt?: string;
  checkOutAt?: string;
  /** 이 날 야간(기본 22시~06시)에 걸친 시간 */
  nightHours: number;
  attendance: AttendanceStatus;
  lateMinutes: number;
  /** 이 날 지각으로 깎인 금액 */
  deduction: number;
}

export interface PayrollItem {
  payrollId: number;
  eventId: number;
  eventTitle: string;
  clientName: string;
  staffId: number;
  staffName: string;
  staffPhone: string;
  role: JobRole;

  /**
   * 지급 대상 근무일 전체 (오름차순).
   *
   * 계약서에 적힌 근무일 중 실제로 돈이 나가는 날만 남는다.
   * (노쇼 · 결근은 나오지 않은 것이므로 여기서 빠진다)
   */
  workDates: string[];
  /** 대표 근무일 = 첫날. 목록 정렬과 검색에 쓴다. */
  workDate: string;
  /** 근무일별 내역. 금액의 근거다. */
  days: PayrollWorkDay[];

  /**
   * 전체 근무일의 실근무시간 합계.
   *
   * 하루치가 아니라 **모든 날의 실제 출퇴근을 더한 값**이다.
   * 시급 계약의 기본급은 이 값에 금액을 곱해서 나온다.
   */
  totalWorkHours: number;
  /** 행사 예정 시간으로 계산한 전체 근무시간. 실제와 얼마나 다른지 비교용이다. */
  scheduledWorkHours: number;
  /** 모든 근무일에 실제 출퇴근이 채워졌는지. 하루라도 비면 false다. */
  isActualTimeApplied: boolean;
  /** 출퇴근이 아직 안 찍힌 근무일 수. 0이 되어야 금액이 확정이다. */
  provisionalDayCount: number;
  /** 전체 근무일에서 야간에 걸친 시간 합계 */
  nightHours: number;

  /**
   * 대표 지급 기준 · 금액 (첫 근무일 기준).
   *
   * 표에 한 줄로 적기 위한 값이다. 날마다 다르게 준 건이면
   * `hasMixedWage`가 켜지므로, 그때는 이 값만 보고 금액을 설명하면 안 된다.
   */
  wageType: WageType;
  wage: number;
  /**
   * 근무일마다 금액이 다른지.
   *
   * 켜져 있으면 화면은 "혼합"으로 적고 근무일별 내역을 펼쳐 보여 줘야 한다.
   * 대표 금액에 일수를 곱한 숫자를 보여 주면 총액과 맞지 않아 오히려 혼란스럽다.
   */
  hasMixedWage: boolean;
  /** 모든 근무일의 기본급 합계 */
  basePay: number;
  /**
   * 연장수당 적용 여부.
   *
   * 예전에는 기준을 넘기면 무조건 붙었는데, 실제로는 거래처와 협의해
   * 안 붙이기로 하는 건이 흔하다. 강제하지 않고 건별로 켜고 끈다.
   */
  isOvertimeApplied: boolean;
  /** 기준 초과분 가산액. 연장은 하루 단위로 판정해 모든 날을 더한 값이다. */
  overtimePay: number;
  /** 야간수당 적용 여부 */
  isNightPayApplied: boolean;
  /** 야간 시간 가산액 */
  nightPay: number;
  /** 식대·교통비 등 별도 지급액 (전체 근무일 합계) */
  allowance: number;
  /** 지각·중도이탈 등으로 차감한 금액 (전체 근무일 합계) */
  deduction: number;
  /** 세전 지급 총액 */
  grossPay: number;
  /** 사업소득 원천징수 */
  withholdingTax: number;
  /** 실제 이체 금액 */
  netPay: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: PayrollStatus;
  holdReason?: string;
  paidAt?: string;
  createdAt: string;
}

/** 정산 화면 상단 합계 */
export interface PayrollSummary {
  totalCount: number;
  pendingCount: number;
  paidCount: number;
  totalGrossPay: number;
  totalNetPay: number;
  totalWithholdingTax: number;
  /** 아직 지급하지 않은 금액. 대표가 가장 먼저 보는 숫자다. */
  unpaidAmount: number;
  /**
   * 출퇴근이 덜 채워져 일부 근무일이 예정 시간으로 잠정 계산된 정산 건수.
   * 0이 되어야 정산 금액이 확정이다.
   */
  provisionalCount: number;
}

/** 원천징수율 기본값 (사업소득 3.3%) */
export const DEFAULT_WITHHOLDING_RATE = 0.033;

/** 연장근로 기준 시간 기본값 */
export const OVERTIME_THRESHOLD_HOURS = 8;

/** 지급액 계산에 넘기는 근무일 한 칸 */
export interface PayrollCalculationDay {
  workHours: number;
  nightHours: number;
  /** 이 날 적용된 지급 기준과 금액 */
  wageType: WageType;
  wage: number;
}

export interface PayrollCalculationInput {
  /**
   * 지급 대상 근무일 목록.
   *
   * 합계 시간 하나만 받으면 안 된다. 연장근로는 **하루 8시간**을 넘겼는지로
   * 따지는 것이라, 사흘 동안 18시간 일한 사람에게 "10시간 초과"를 물리면
   * 실제로는 하루도 초과하지 않았는데 연장수당이 붙는다.
   * 일급도 마찬가지로 며칠 나왔는지를 알아야 금액이 나온다.
   *
   * 금액도 날짜별로 받는다. 현장에서는 같은 사람에게도 날마다 다른 조건을
   * 주는 일이 흔해서(첫날만 설치 일급, 이후 시급) 한 값으로 묶을 수 없다.
   */
  days: PayrollCalculationDay[];
  allowance: number;
  deduction: number;
  withholdingRate: number;
  /** 연장수당을 붙일지. 기본 설정값이 초기값이 되고 건별로 바꾼다. */
  isOvertimeApplied: boolean;
  overtimeThresholdHours: number;
  /** 기준 초과분에 곱하는 가산율 (0.5 = 0.5배 추가) */
  overtimeRate: number;
  /** 야간수당을 붙일지 */
  isNightPayApplied: boolean;
  nightRate: number;
}

/**
 * 행사 한 건 · 한 사람의 지급액을 계산한다.
 *
 * 화면·목업·정산 내보내기가 모두 같은 값을 쓰도록 계산은 여기 한 곳에만 둔다.
 *
 * **모든 근무일을 한 번에 합산한다.** 하루씩 계산해 나중에 더하면
 * 반올림이 날마다 쌓여 총액이 어긋나고, 연장 · 야간을 어느 날 붙였는지도
 * 흩어져 설명할 수 없게 된다.
 *
 * - 시급: 금액 × (모든 날의 실근무시간 합)
 * - 일급: 금액 × 지급 대상 일수 (시간과 무관)
 *
 * 수당은 강제하지 않는다. 꺼져 있으면 그 항목은 0원이다.
 * 일급 건은 연장 · 야간수당을 아예 계산하지 않는다. (금액에 이미 포함된 것으로 본다)
 */
export const calculatePayroll = ({
  days,
  allowance,
  deduction,
  withholdingRate,
  isOvertimeApplied,
  overtimeThresholdHours,
  overtimeRate,
  isNightPayApplied,
  nightRate,
}: PayrollCalculationInput) => {
  const totalWorkHours =
    Math.round(days.reduce((sum, day) => sum + day.workHours, 0) * 10) / 10;

  /*
    하루치 금액을 각각 구해서 더한다.
    합계 시간에 대표 금액 하나를 곱하면, 날마다 조건이 다른 건에서
    총액이 실제 지급액과 어긋난다.

    일급은 "하루에 얼마"로 미리 합의한 총액이라 연장 · 야간을 얹지 않는다.
    (더 줄 돈이 생기면 기타수당으로 넣는다. 그래야 왜 더 줬는지가 남는다)
  */
  const perDay = days.map((day) => {
    const isHourly = day.wageType === "HOURLY";

    const basePay = isHourly
      ? Math.round(day.wage * day.workHours)
      : day.wage;

    // 연장은 하루 8시간 기준이므로 그날의 시간으로만 판정한다.
    const overtimeHours = Math.max(
      0,
      day.workHours - overtimeThresholdHours,
    );

    return {
      basePay,
      overtimePay:
        isHourly && isOvertimeApplied
          ? Math.round(overtimeHours * day.wage * overtimeRate)
          : 0,
      nightPay:
        isHourly && isNightPayApplied
          ? Math.round(day.nightHours * day.wage * nightRate)
          : 0,
    };
  });

  const sum = (pick: (day: (typeof perDay)[number]) => number) =>
    perDay.reduce((total, day) => total + pick(day), 0);

  const basePay = sum((day) => day.basePay);
  const overtimePay = sum((day) => day.overtimePay);
  const nightPay = sum((day) => day.nightPay);

  const grossPay = Math.max(
    0,
    basePay + overtimePay + nightPay + allowance - deduction,
  );
  const withholdingTax = Math.floor((grossPay * withholdingRate) / 10) * 10;

  return {
    totalWorkHours,
    /** 근무일별 기본급. 화면에서 "왜 이 금액인지"를 그대로 보여 줄 때 쓴다. */
    dailyBasePay: perDay.map((day) => day.basePay),
    basePay,
    overtimePay,
    nightPay,
    grossPay,
    withholdingTax,
    netPay: grossPay - withholdingTax,
  };
};

/**
 * 근무일 목록을 한 줄 문구로 만든다.
 *
 * 여러 날 행사는 날짜가 열 개도 넘어간다. 전부 나열하면 표가 읽히지 않으므로
 * 첫날~마지막날로 묶고, 일수는 옆에 따로 적는다.
 */
export const formatPayrollDates = (workDates: string[]): string => {
  if (workDates.length === 0) return "-";

  const toShort = (date: string) => date.slice(5).replace("-", ".");
  const sorted = [...workDates].sort();

  if (sorted.length === 1) return toShort(sorted[0]);

  return `${toShort(sorted[0])} ~ ${toShort(sorted[sorted.length - 1])}`;
};
