import type { Assignment, EventDetail } from "@/type/event";
import {
  calculateNightHours,
  calculateScheduledWorkHours,
  groupAssignmentsByStaffRole,
  resolveCheckOutDayOffset,
  resolveHourlyRate,
  resolveWorkHours,
  toTimeInput,
} from "@/type/event";
import type {
  PayrollItem,
  PayrollStatus,
  PayrollWorkDay,
} from "@/type/payroll";
import {
  calculatePayroll,
  isPayableDay,
  isSettlementReady,
} from "@/type/payroll";
import { toIsoDateTime } from "../utils";
import { events } from "./event";
import { operationSettings } from "./ops";
import { findStaff } from "./staff";

let payrollSequence = 0;

/** 정산 항목이 생기는 단계. 행사가 끝나야 지급할 것이 생긴다. */
const isSettlementStage = (event: EventDetail) =>
  event.status === "SETTLEMENT" || event.status === "DONE";

/**
 * 정산 대상이 되는 배치인가. **돈이 나가는지와는 다른 질문이다.**
 *
 * 우리 직원은 여기 오지 않는다. 급여는 회사가 월급으로 내보내고 있어서,
 * 세워 두면 **같은 근로에 대해 두 번 지급하는 목록**이 만들어진다.
 * 직원의 근무는 돈이 아니라 시간으로 집계한다. (운영 > 직원 관리)
 *
 * 노쇼 · 결근은 여기서 빼지 않는다. 나오지 않은 날이라 0원일 뿐,
 * 그 사람의 정산 자체가 없어지는 것은 아니다. (3일 중 하루 노쇼여도
 * 나머지 이틀은 지급해야 한다) 금액을 0으로 만드는 일은 `isPayableDay`가 한다.
 */
const isSettlementTarget = (assignment: Assignment) =>
  assignment.status === "CONFIRMED" && !assignment.isEmployee;

/**
 * 배치 한 건(=하루)을 정산 근무일로 바꾼다.
 *
 * 지급은 예정 시간이 아니라 **실제로 일한 시간**으로 계산한다.
 * 출퇴근이 아직 기록되지 않은 날은 행사 예정 시간을 잠정으로 쓴다.
 */
const buildWorkDay = (
  event: EventDetail,
  assignment: Assignment,
): PayrollWorkDay => {
  const scheduledWorkHours = calculateScheduledWorkHours(event);

  /*
    나오지 않은 날은 0시간이다.

    `resolveWorkHours`는 출퇴근이 없으면 발주 시간으로 떨어지는데,
    노쇼한 날에 그 값을 쓰면 안 나온 사람에게 여덟 시간이 잡힌다.
    안 나온 것은 **확정된 사실**이라 잠정(`isActual: false`)도 아니다.
  */
  const payable = isPayableDay(assignment);

  const { workHours, isActual } = payable
    ? resolveWorkHours(assignment, event)
    : { workHours: 0, isActual: true };

  /*
    야간 구간은 실제 출퇴근이 있으면 그 시각으로, 없으면 행사 예정 시각으로 잰다.
    며칠 뒤에 끝나는 근무는 야간대를 여러 번 지나므로 날짜 넘김을 함께 넘긴다.
    (기록이 있으면 그 기록의 날짜 차이가, 없으면 행사에 적힌 값이 기준이다)
  */
  const nightHours = payable
    ? calculateNightHours(
        toTimeInput(assignment.checkInAt) || event.startTime,
        toTimeInput(assignment.checkOutAt) || event.endTime,
        operationSettings.nightStartTime,
        operationSettings.nightEndTime,
        resolveCheckOutDayOffset(assignment.workDate, assignment.checkOutAt) ??
          event.endDayOffset,
      )
    : 0;

  /*
    지각은 분 단위로 깎는다. 규칙을 정해 두면 매번 협상하지 않아도 된다.
    일급 건은 하루치를 시간당으로 환산한 값을 기준으로 삼는다.
  */
  const deduction =
    assignment.attendance === "LATE"
      ? Math.round(
          (resolveHourlyRate(
            assignment.wageType,
            assignment.wage,
            scheduledWorkHours,
          ) /
            60) *
            assignment.lateMinutes,
        )
      : 0;

  return {
    assignmentId: assignment.assignmentId,
    workDate: assignment.workDate,
    isPayable: payable,
    /* 공제를 끄면 되살릴 값이라 얼마가 빠졌는지를 그대로 들고 있는다. */
    breakMinutes: assignment.actualBreakMinutes ?? event.breakMinutes,
    /* 계산이 끝나면 `applyPayrollAmounts`가 실제로 매겨진 시간을 채운다. */
    paidWorkHours: 0,
    // 금액은 배치가 들고 있는 값을 그대로 쓴다. 행사 안에서 언제든 바뀔 수 있다.
    wageType: assignment.wageType,
    wage: assignment.wage,
    basePay: 0,
    workHours,
    scheduledWorkHours,
    isActualTimeApplied: isActual,
    checkInAt: assignment.checkInAt,
    checkOutAt: assignment.checkOutAt,
    nightHours,
    attendance: assignment.attendance,
    lateMinutes: assignment.lateMinutes,
    deduction,
  };
};

/**
 * 근무일 목록에서 합계와 금액을 다시 계산해 정산 건에 덮어쓴다.
 *
 * 생성 · 근태 변경 · 수당 토글이 전부 이 함수를 거친다.
 * 갈라지면 "화면에서 본 금액"과 "정산에 잡힌 금액"이 달라진다.
 */
const applyPayrollAmounts = (
  item: PayrollItem,
  days: PayrollWorkDay[],
): PayrollItem => {
  const sorted = [...days].sort((a, b) => a.workDate.localeCompare(b.workDate));

  item.days = sorted;
  item.workDates = sorted.map((day) => day.workDate);
  item.workDate = sorted[0]?.workDate ?? item.workDate;
  item.scheduledWorkHours =
    Math.round(
      sorted.reduce((sum, day) => sum + day.scheduledWorkHours, 0) * 10,
    ) / 10;
  /* 안 나온 날은 찍을 출퇴근이 없다. 잠정으로 세면 영원히 확정되지 않는다. */
  item.provisionalDayCount = sorted.filter(
    (day) => day.isPayable && !day.isActualTimeApplied,
  ).length;
  // 하루라도 출퇴근이 비어 있으면 이 건의 금액은 아직 확정이 아니다.
  item.isActualTimeApplied = item.provisionalDayCount === 0;
  item.nightHours =
    Math.round(sorted.reduce((sum, day) => sum + day.nightHours, 0) * 10) / 10;
  item.deduction = sorted.reduce((sum, day) => sum + day.deduction, 0);

  /*
    기타수당은 **손대지 않는다.** 기본값은 0이다.

    예전에는 8시간 넘게 선 날마다 식대 10,000원을 시스템이 알아서 붙였다.
    그런데 식대를 주는지 · 얼마인지는 발주마다 다르고, 무엇보다 이 함수는
    근태를 고칠 때마다 다시 도는 자리라 담당자가 정산 화면에서 적어 넣은
    금액을 매번 자동 계산값으로 되돌려 놓았다.
    더 줄 돈이 있으면 사람이 정산 화면에서 적는다. 그래야 근거가 남는다.
  */

  /*
    금액도 근무일에서 다시 읽는다.
    행사 안에서 사람마다 · 날마다 시급을 고칠 수 있으므로, 정산 건이 만들어질 때
    한 번 복사해 둔 값을 계속 쓰면 고친 금액이 정산에 영영 반영되지 않는다.
  */
  /* 대표 금액은 **돈이 나가는 첫날**에서 읽는다. 노쇼한 첫날의 금액은 뜻이 없다. */
  const firstDay = sorted.find((day) => day.isPayable) ?? sorted[0];

  if (firstDay) {
    item.wageType = firstDay.wageType;
    item.wage = firstDay.wage;
    item.hasMixedWage = sorted.some(
      (day) => day.wageType !== firstDay.wageType || day.wage !== firstDay.wage,
    );
  }

  /*
    휴게시간 공제를 끄면 **그날 빠졌던 만큼을 되돌려 놓는다.**

    근무시간(`day.workHours`)에는 이미 휴게가 빠져 있다. 팀장처럼 휴게를
    쪼개 쓰거나 쉬면서도 현장을 도는 자리는 그 시간까지 쳐서 주는데,
    그때 이 값을 다시 더하지 않으면 실제로 붙어 있던 시간이 기록에서 사라진다.
  */
  const paidHoursOf = (day: PayrollWorkDay) =>
    item.isBreakDeducted || !day.isPayable
      ? day.workHours
      : Math.round((day.workHours + day.breakMinutes / 60) * 10) / 10;

  const calculated = calculatePayroll({
    days: sorted.map((day) => ({
      workHours: paidHoursOf(day),
      nightHours: day.nightHours,
      wageType: day.wageType,
      wage: day.wage,
      isPayable: day.isPayable,
    })),
    allowance: item.allowance,
    deduction: item.deduction,
    withholdingRate: operationSettings.withholdingRate,
    isOvertimeApplied: item.isOvertimeApplied,
    overtimeThresholdHours: operationSettings.overtimeThresholdHours,
    overtimeRate: operationSettings.overtimeRate,
    isNightPayApplied: item.isNightPayApplied,
    nightRate: operationSettings.nightRate,
  });

  // 근무일별 기본급을 되돌려 놓아야 "왜 이 금액인지"를 화면에서 펼쳐 볼 수 있다.
  sorted.forEach((day, index) => {
    day.basePay = calculated.dailyBasePay[index];
    day.paidWorkHours = paidHoursOf(day);
  });

  Object.assign(item, calculated);

  return item;
};

/**
 * 한 사람이 이 행사에서 일한 날들을 묶어 정산 한 건을 만든다.
 *
 * 정산은 배치(하루)가 아니라 **행사 × 사람**으로 잡힌다.
 * 3일 나온 사람에게 세 번 이체할 일이 없기 때문이다.
 */
const buildPayrollItem = (
  event: EventDetail,
  assignments: Assignment[],
  /** 시드에서만 넘긴다. 상태를 섞어 화면을 확인하기 위한 값이다. */
  seedIndex?: number,
): PayrollItem => {
  const [first] = assignments;
  const staff = findStaff(first.staffId);
  const days = assignments.map((assignment) => buildWorkDay(event, assignment));

  /*
    수당은 기준 설정의 기본값으로 시작한다.
    예전에는 조건만 맞으면 무조건 붙었는데, 실제로는 거래처와 협의해
    빼는 건이 흔해서 정산 화면에서 건별로 다시 켜고 끌 수 있게 했다.
  */
  const isOvertimeApplied = operationSettings.isOvertimeEnabled;
  const isNightPayApplied =
    operationSettings.isNightPayEnabled &&
    days.some((day) => day.nightHours > 0);

  // 행사에 나온 날 중 하루라도 지급이 끝났으면 그 사람 몫은 끝난 것으로 본다.
  const isPaid = assignments.every((assignment) => assignment.isPaid);

  const status: PayrollStatus = isPaid
    ? "PAID"
    : !staff?.accountNumber
      ? "HOLD"
      : seedIndex !== undefined && seedIndex % 5 === 0
        ? "APPROVED"
        : "PENDING";

  payrollSequence += 1;

  const lastWorkDate = days[days.length - 1]?.workDate ?? first.workDate;

  const item: PayrollItem = {
    payrollId: payrollSequence,
    eventId: event.eventId,
    eventTitle: event.title,
    clientName: event.clientName,
    staffId: first.staffId,
    staffName: first.staffName,
    staffPhone: first.staffPhone,
    role: first.role,
    workDates: [],
    workDate: first.workDate,
    days: [],
    totalWorkHours: 0,
    scheduledWorkHours: 0,
    isActualTimeApplied: false,
    provisionalDayCount: 0,
    nightHours: 0,
    wageType: first.wageType,
    wage: first.wage,
    hasMixedWage: false,
    basePay: 0,
    isOvertimeApplied,
    overtimePay: 0,
    isNightPayApplied,
    nightPay: 0,
    /* 기본은 공제한다. 빼지 않기로 한 건만 정산 화면에서 끈다. */
    isBreakDeducted: true,
    allowance: 0,
    deduction: 0,
    grossPay: 0,
    withholdingTax: 0,
    netPay: 0,
    bankName: staff?.bankName ?? "",
    accountNumber: staff?.accountNumber ?? "",
    accountHolder: staff?.accountHolder ?? first.staffName,
    status,
    holdReason:
      status === "HOLD" ? "통장 사본 미제출로 계좌 확인 불가" : undefined,
    // 지급은 행사가 다 끝난 뒤에 한 번 나간다. 마지막 근무일을 기준으로 잡는다.
    paidAt: status === "PAID" ? toIsoDateTime(lastWorkDate, "18:00") : undefined,
    createdAt: toIsoDateTime(lastWorkDate, "20:00"),
  };

  return applyPayrollAmounts(item, days);
};

/** 행사의 배치를 "사람 × 직무"로 묶는다. 이 묶음 하나가 정산 한 건이 된다. */
const groupSettlementAssignments = (event: EventDetail): Assignment[][] =>
  groupAssignmentsByStaffRole(event.assignments.filter(isSettlementTarget));

/**
 * 정산에 올릴 수 있는 묶음만.
 *
 * **사람 단위로 자른다.** 열네 명 중 열세 명이 계약서와 출퇴근을 채웠으면
 * 정산에는 열세 명이 뜬다. 예전에는 조건 없이 전원을 올려 두고 화면에서
 * "잠정"이라고 적었는데, 그러면 지급 승인 버튼이 확정되지 않은 금액 위에
 * 놓이게 되고 실제로 그대로 눌리는 일이 생긴다.
 */
const groupReadyAssignments = (event: EventDetail): Assignment[][] =>
  groupSettlementAssignments(event).filter(isSettlementReady);

/**
 * 정산 목업.
 *
 * 이미 지난 행사(정산대기 · 완료)에서만 만든다.
 * 계좌 정보는 인력 DB에서 가져와 은행 이체 파일을 바로 만들 수 있게 한다.
 */
export const payrollItems: PayrollItem[] = events
  .filter(isSettlementStage)
  .flatMap((event) =>
    groupReadyAssignments(event).map((assignments, index) =>
      buildPayrollItem(event, assignments, index),
    ),
  );

export const findPayroll = (payrollId: number) =>
  payrollItems.find((item) => item.payrollId === payrollId);

/** 이 행사·이 사람의 정산 건을 찾는다. */
const findItem = (event: EventDetail, staffId: number, role: string) =>
  payrollItems.find(
    (item) =>
      item.eventId === event.eventId &&
      item.staffId === staffId &&
      item.role === role,
  );

/**
 * 행사가 정산 단계로 넘어오면 **준비가 끝난 사람의** 정산 건을 만든다.
 *
 * 이게 없으면 새로 끝난 행사는 정산 화면에 아무것도 뜨지 않아,
 * 출퇴근을 아무리 기록해도 반영될 곳이 없다.
 * 이미 만들어진 건은 손대지 않는다. (수당 조정·보류 사유가 날아가면 안 된다)
 */
export const ensurePayrollForEvent = (event: EventDetail): PayrollItem[] => {
  if (!isSettlementStage(event)) return [];

  const created = groupReadyAssignments(event)
    .filter(
      (assignments) =>
        !findItem(event, assignments[0].staffId, assignments[0].role),
    )
    .map((assignments) => buildPayrollItem(event, assignments));

  payrollItems.unshift(...created);

  return created;
};

/**
 * 배치의 근태 · 출퇴근이 바뀌면 그 사람의 정산 금액을 다시 맞춘다.
 *
 * 근태만 기록하고 정산이 예정 시간 그대로면, 결국 정산 화면에서 손으로 또 고쳐야 한다.
 * "기록하면 정산까지 이어진다"가 이 시스템을 쓰는 이유이므로 여기서 연결한다.
 *
 * 정산이 행사 단위로 묶여 있으므로 **그 사람의 근무일 전체를 다시 계산한다.**
 * 바뀐 하루만 고치면 총액과 근무일별 내역이 어긋난다.
 */
export const syncPayrollWithAssignment = (
  assignment: Assignment,
  event: EventDetail,
) => {
  if (!isSettlementStage(event)) return;

  /*
    이 사람이 이 행사에서 맡은 날을 통째로 다시 모은다.
    노쇼 · 결근한 날도 남긴다. 0원짜리 줄로 서서 "왜 이 날은 안 나갔는지"를
    설명하고, 나머지 날의 지급은 그대로 이어진다.
  */
  const assignments = event.assignments
    .filter(
      (target) =>
        target.staffId === assignment.staffId &&
        target.role === assignment.role &&
        isSettlementTarget(target),
    )
    .sort((a, b) => a.workDate.localeCompare(b.workDate));

  const item = findItem(event, assignment.staffId, assignment.role);
  const isReady = isSettlementReady(assignments);

  /*
    아직 준비가 안 됐으면 정산에 세우지 않는다.

    계약서를 다시 쓰기로 해서 서명이 풀렸거나, 출퇴근 기록을 지웠을 때가
    여기다. 이미 승인 · 지급이 끝난 건은 건드리지 않는다 — 돈이 이미
    나간 기록을 화면에서 지우면 그 이체를 설명할 자리가 사라진다.
  */
  if (!isReady) {
    if (!item || item.status === "APPROVED" || item.status === "PAID") return;

    payrollItems.splice(payrollItems.indexOf(item), 1);

    return;
  }

  // 준비가 끝났는데 아직 없으면 이 시점에 만든다. (계약서를 다시 올린 직후가 이 경우다)
  if (!item) {
    payrollItems.unshift(buildPayrollItem(event, assignments));

    return;
  }

  applyPayrollAmounts(
    item,
    assignments.map((target) => buildWorkDay(event, target)),
  );
};

/**
 * 계약서 상태가 바뀌면 그 사람의 정산도 따라 움직인다.
 *
 * 중도 종료로 계약서를 다시 쓰기로 하면 정산에서 내려가고, 새 계약서가
 * 작성 완료되면 다시 올라온다. 계약서 화면에서만 처리하고 정산을 그대로 두면
 * 근거 없는 지급이 목록에 남는다.
 */
export const syncPayrollWithContract = (
  event: EventDetail,
  staffId: number,
) => {
  event.assignments
    .filter((target) => target.staffId === staffId && isSettlementTarget(target))
    .forEach((target) => syncPayrollWithAssignment(target, event));
};

/** 수당 적용 여부를 바꾼 뒤 금액을 다시 맞춘다. */
export const recalculatePayroll = (item: PayrollItem) =>
  applyPayrollAmounts(item, item.days);
