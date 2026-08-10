import { HttpResponse, delay, http } from "msw";
import type { PayrollItem, PayrollStatus, PayrollSummary } from "@/type/payroll";
import type { JobRole } from "@/type/staff";
import { calculatePayroll } from "@/type/payroll";
import { findEvent } from "../db/event";
import { operationSettings } from "../db/ops";
import { findPayroll, payrollItems, recalculatePayroll } from "../db/payroll";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  matchesKeyword,
  notFound,
  paginate,
  requirePermission,
} from "../utils";

/** 목록과 합계가 같은 조건을 쓰도록 필터를 한 곳에 둔다. */
const filterPayrolls = (url: URL): PayrollItem[] => {
  const keyword = url.searchParams.get("keyword") ?? "";
  const status = url.searchParams.get("status") as PayrollStatus | null;
  const eventId = url.searchParams.get("eventId") ?? "";
  const role = url.searchParams.get("role") as JobRole | null;
  const startDate = url.searchParams.get("startDate") ?? "";
  const endDate = url.searchParams.get("endDate") ?? "";

  return payrollItems.filter((item) => {
    if (status && item.status !== status) return false;
    if (eventId && String(item.eventId) !== eventId) return false;
    if (role && item.role !== role) return false;

    /*
      정산 한 건이 여러 날을 덮으므로, 기간 필터는 "근무일 중 하나라도
      기간에 걸치는가"로 본다. 첫날만 보면 5월에 시작해 6월까지 이어진
      행사가 6월 조회에서 통째로 사라진다.
    */
    if (
      (startDate || endDate) &&
      !item.workDates.some(
        (date) =>
          (!startDate || date >= startDate) && (!endDate || date <= endDate),
      )
    ) {
      return false;
    }

    return matchesKeyword(
      keyword,
      item.staffName,
      item.eventTitle,
      item.clientName,
      item.accountHolder,
    );
  });
};

export const payrollHandlers = [
  http.get(`${BASE_URI}/admin/payrolls/summary`, async ({ request }) => {
    const denied = requirePermission(request, "payroll:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const filtered = filterPayrolls(url);

    const summary: PayrollSummary = {
      totalCount: filtered.length,
      pendingCount: filtered.filter((item) => item.status === "PENDING").length,
      paidCount: filtered.filter((item) => item.status === "PAID").length,
      totalGrossPay: filtered.reduce((sum, item) => sum + item.grossPay, 0),
      totalNetPay: filtered.reduce((sum, item) => sum + item.netPay, 0),
      totalWithholdingTax: filtered.reduce(
        (sum, item) => sum + item.withholdingTax,
        0,
      ),
      unpaidAmount: filtered
        .filter((item) => item.status !== "PAID")
        .reduce((sum, item) => sum + item.netPay, 0),
      // 하루라도 출퇴근이 비어 있으면 그 건은 아직 잠정 금액이다.
      provisionalCount: filtered.filter((item) => item.provisionalDayCount > 0)
        .length,
    };

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(summary);
  }),

  http.get(`${BASE_URI}/admin/payrolls`, async ({ request }) => {
    const denied = requirePermission(request, "payroll:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const sorted = filterPayrolls(url).sort((a, b) =>
      b.workDate.localeCompare(a.workDate),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(sorted, url));
  }),

  /** 상태 일괄 변경. 정산은 건별이 아니라 행사 단위로 처리하는 일이 많다. */
  http.patch(`${BASE_URI}/admin/payrolls/status`, async ({ request }) => {
    const body = (await request.json()) as {
      payrollIds: number[];
      status: PayrollStatus;
      holdReason?: string;
    };

    /*
      승인과 지급 완료는 다른 권한이다.

      '승인'은 금액을 확정하는 일이고, '지급 완료'는 돈이 나갔다고 장부에 찍는 일이다.
      찍히는 순간 미지급 금액에서 빠지고 배치에도 정산 완료로 반영되므로,
      실제로 이체를 확인한 사람만 눌러야 한다.
      한 주소로 들어오지만 요구하는 권한은 상태값에 따라 갈린다.
    */
    const denied = requirePermission(
      request,
      body.status === "PAID" ? "payroll:pay" : "payroll:approve",
    );

    if (denied) return denied;

    const updated = body.payrollIds
      .map((payrollId) => findPayroll(payrollId))
      .filter((item): item is PayrollItem => Boolean(item));

    updated.forEach((item) => {
      item.status = body.status;
      item.holdReason = body.status === "HOLD" ? body.holdReason : undefined;
      item.paidAt = body.status === "PAID" ? new Date().toISOString() : undefined;

      /*
        지급 완료는 배치에도 반영해 행사 화면에서 정산 여부를 볼 수 있게 한다.
        정산이 행사 단위로 묶여 있으므로 그 사람의 모든 근무일에 함께 찍는다.
      */
      const event = findEvent(item.eventId);

      item.days.forEach((day) => {
        const assignment = event?.assignments.find(
          (target) => target.assignmentId === day.assignmentId,
        );

        if (assignment) assignment.isPaid = body.status === "PAID";
      });
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ updated });
  }),

  /**
   * 수당 적용 일괄 변경.
   *
   * "이번 행사는 연장수당 빼기로 했다"가 행사 단위로 정해지는 일이 많아
   * 건별로 스무 번 누르지 않아도 되게 한다.
   *
   * `/:payrollId`보다 **먼저** 등록해야 한다.
   * MSW는 먼저 일치하는 핸들러를 쓰기 때문에, 순서가 뒤바뀌면
   * `PATCH /admin/payrolls/allowances`가 `payrollId = "allowances"`로 잡혀 404가 난다.
   */
  http.patch(`${BASE_URI}/admin/payrolls/allowances`, async ({ request }) => {
    const denied = requirePermission(request, "payroll:write");

    if (denied) return denied;

    const body = (await request.json()) as {
      payrollIds: number[];
      isOvertimeApplied?: boolean;
      isNightPayApplied?: boolean;
    };

    const updated = body.payrollIds
      .map((payrollId) => findPayroll(payrollId))
      .filter((item): item is PayrollItem => Boolean(item));

    updated.forEach((item) => {
      item.isOvertimeApplied =
        body.isOvertimeApplied ?? item.isOvertimeApplied;
      item.isNightPayApplied =
        body.isNightPayApplied ?? item.isNightPayApplied;

      recalculatePayroll(item);
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ updated });
  }),

  /**
   * 개별 조정 (수당 · 차감액 · 수당 적용 여부).
   *
   * 연장 · 야간수당을 강제로 붙이지 않고 건별로 켜고 끌 수 있게 했다.
   * 계산은 화면과 같은 함수를 써야 두 곳의 금액이 어긋나지 않는다.
   */
  http.patch(
    `${BASE_URI}/admin/payrolls/:payrollId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "payroll:write");

      if (denied) return denied;

      const item = findPayroll(Number(params.payrollId));
      const body = (await request.json()) as {
        allowance: number;
        deduction: number;
        isOvertimeApplied?: boolean;
        isNightPayApplied?: boolean;
      };

      if (!item) return notFound("존재하지 않는 정산 항목입니다.");

      item.allowance = body.allowance;
      item.deduction = body.deduction;
      item.isOvertimeApplied =
        body.isOvertimeApplied ?? item.isOvertimeApplied;
      item.isNightPayApplied =
        body.isNightPayApplied ?? item.isNightPayApplied;

      /*
        기타수당 · 차감액은 사람이 정한 값이므로 그대로 두고,
        나머지는 근무일 내역에서 다시 계산한다.
        (recalculatePayroll이 식대 · 지각 공제를 근무일에서 다시 만든다)
      */
      recalculatePayroll(item);

      item.allowance = body.allowance;
      item.deduction = body.deduction;

      Object.assign(
        item,
        calculatePayroll({
          days: item.days.map((day) => ({
            workHours: day.workHours,
            nightHours: day.nightHours,
            wageType: day.wageType,
            wage: day.wage,
          })),
          allowance: item.allowance,
          deduction: item.deduction,
          withholdingRate: operationSettings.withholdingRate,
          isOvertimeApplied: item.isOvertimeApplied,
          overtimeThresholdHours: operationSettings.overtimeThresholdHours,
          overtimeRate: operationSettings.overtimeRate,
          isNightPayApplied: item.isNightPayApplied,
          nightRate: operationSettings.nightRate,
        }),
      );

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(item);
    },
  ),
];
