import { HttpResponse, delay, http } from "msw";
import type {
  ActionItem,
  AttendanceIssue,
  DashboardSummary,
  MonthlyTrendPoint,
  UpcomingEvent,
} from "@/type/dashboard";
import {
  calculateBasePay,
  calculateScheduledWorkHours,
} from "@/type/event";
import { contracts } from "../db/contract";
import { events } from "../db/event";
import { payrollItems } from "../db/payroll";
import { applications } from "../db/recruit";
import { staffList, staffMissingDocuments } from "../db/staff";
import { BASE_URI, MOCK_DELAY_MS, dateFromToday } from "../utils";

/** 최근 6개월의 매출 · 인건비를 만든다. 마진이 어떻게 움직였는지 한눈에 본다. */
const buildMonthlyTrend = (): MonthlyTrendPoint[] => {
  const points = new Map<string, MonthlyTrendPoint>();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);

    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    points.set(month, { month, revenue: 0, laborCost: 0, eventCount: 0 });
  }

  events.forEach((event) => {
    const month = event.startDate.slice(0, 7);
    const point = points.get(month);

    if (!point || event.status === "CANCELED") return;

    const workHours = calculateScheduledWorkHours(event);

    point.eventCount += 1;
    point.revenue += Math.round(
      event.totalAssigned * workHours * event.clientBillingRate,
    );
    point.laborCost += event.assignments.reduce(
      (sum, assignment) =>
        sum +
        calculateBasePay(assignment.wageType, assignment.wage, workHours),
      0,
    );
  });

  return [...points.values()];
};

export const dashboardHandlers = [
  http.get(`${BASE_URI}/admin/dashboard/summary`, async () => {
    const today = dateFromToday(0);
    const weekLater = dateFromToday(7);

    const activeEvents = events.filter(
      (event) => event.status !== "CANCELED" && event.status !== "DRAFT",
    );

    const todayEvents = activeEvents.filter(
      (event) => event.startDate <= today && event.endDate >= today,
    );
    const weekEvents = activeEvents.filter(
      (event) => event.startDate >= today && event.startDate <= weekLater,
    );

    // 아직 채우지 못한 자리는 다가오는 행사만 센다. 지난 행사는 손 쓸 방법이 없다.
    const openSlotCount = activeEvents
      .filter((event) => event.startDate >= today)
      .reduce(
        (sum, event) =>
          sum + Math.max(0, event.totalRequired - event.totalAssigned),
        0,
      );

    const unsignedContracts = contracts.filter(
      (contract) =>
        contract.workDate >= today &&
        contract.status !== "SIGNED" &&
        contract.status !== "EXPIRED",
    );

    const missingDocuments = staffMissingDocuments();

    const pendingPayrolls = payrollItems.filter(
      (item) => item.status !== "PAID",
    );

    const pendingApplications = applications.filter(
      (application) => application.status === "PENDING",
    );

    /** 지금 손대야 하는 일. 클릭하면 처리 화면으로 바로 넘어간다. */
    const actions: ActionItem[] = [];

    const understaffedEvents = activeEvents
      .filter(
        (event) =>
          event.startDate >= today && event.totalAssigned < event.totalRequired,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    if (understaffedEvents.length > 0) {
      const nearest = understaffedEvents[0];

      actions.push({
        actionId: 1,
        type: "UNDERSTAFFED",
        title: `인원이 덜 찬 행사 ${understaffedEvents.length}건`,
        description: `가장 급한 건은 '${nearest.title}' (${nearest.totalAssigned}/${nearest.totalRequired}명)입니다.`,
        href: "/schedule/events?onlyUnderstaffed=true",
        daysLeft: Math.round(
          (new Date(nearest.startDate).getTime() - new Date(today).getTime()) /
            86_400_000,
        ),
        count: understaffedEvents.length,
      });
    }

    /*
      지난 근무인데 출퇴근이 안 적힌 건.
      이게 남아 있으면 정산 금액이 행사 예정 시간 기준의 '잠정'이라
      지급 승인을 해서는 안 된다. 그래서 정산 대기보다 위에 둔다.
    */
    const missingCheckTimeAssignments = events
      .flatMap((event) => event.assignments)
      .filter(
        (assignment) =>
          assignment.workDate < today &&
          assignment.status === "CONFIRMED" &&
          assignment.attendance !== "PENDING" &&
          assignment.attendance !== "NO_SHOW" &&
          assignment.attendance !== "ABSENT" &&
          !(assignment.checkInAt && assignment.checkOutAt),
      );

    if (missingCheckTimeAssignments.length > 0) {
      actions.push({
        actionId: 6,
        type: "CHECK_TIME_MISSING",
        title: `출퇴근 미기록 ${missingCheckTimeAssignments.length}건`,
        description:
          "실제 출퇴근이 없으면 행사 예정 시간으로 잠정 계산됩니다. 지급 승인 전에 채워 주세요.",
        href: "/schedule/assignments?onlyMissingCheckTime=true",
        count: missingCheckTimeAssignments.length,
      });
    }

    if (unsignedContracts.length > 0) {
      actions.push({
        actionId: 2,
        type: "CONTRACT_MISSING",
        title: `근로계약서 미완료 ${unsignedContracts.length}건`,
        description:
          "근무 시작 전까지 서명이 끝나야 합니다. 미발송 건부터 처리하세요.",
        href: "/contracts",
        count: unsignedContracts.length,
      });
    }

    if (missingDocuments.length > 0) {
      actions.push({
        actionId: 3,
        type: "DOCUMENT_MISSING",
        title: `서류 미제출 ${missingDocuments.length}명`,
        description: "신분증 또는 통장사본이 없어 정산 계좌를 확정할 수 없습니다.",
        href: "/staff/documents",
        count: missingDocuments.length,
      });
    }

    if (pendingPayrolls.length > 0) {
      actions.push({
        actionId: 4,
        type: "PAYROLL_PENDING",
        title: `정산 대기 ${pendingPayrolls.length}건`,
        description: `미지급 금액은 ${pendingPayrolls
          .reduce((sum, item) => sum + item.netPay, 0)
          .toLocaleString("ko-KR")}원입니다.`,
        href: "/payroll",
        count: pendingPayrolls.length,
      });
    }

    if (pendingApplications.length > 0) {
      actions.push({
        actionId: 5,
        type: "APPLICATION_PENDING",
        title: `검토 대기 지원 ${pendingApplications.length}건`,
        description: "확정하면 행사 배치까지 한 번에 처리됩니다.",
        href: "/recruit/applications",
        count: pendingApplications.length,
      });
    }

    const upcomingEvents: UpcomingEvent[] = activeEvents
      .filter((event) => event.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 6)
      .map((event) => ({
        eventId: event.eventId,
        title: event.title,
        clientName: event.clientName,
        date: event.startDate,
        startTime: event.startTime,
        endTime: event.endTime,
        endDayOffset: event.endDayOffset,
        venue: event.venue,
        totalRequired: event.totalRequired,
        totalAssigned: event.totalAssigned,
      }));

    const attendanceIssues: AttendanceIssue[] = events
      .flatMap((event) => event.assignments)
      .filter(
        (assignment) =>
          assignment.attendance === "LATE" ||
          assignment.attendance === "ABSENT" ||
          assignment.attendance === "NO_SHOW",
      )
      .sort((a, b) => b.workDate.localeCompare(a.workDate))
      .slice(0, 8)
      .map((assignment) => ({
        assignmentId: assignment.assignmentId,
        staffId: assignment.staffId,
        staffName: assignment.staffName,
        eventTitle: assignment.eventTitle,
        workDate: assignment.workDate,
        type: assignment.attendance as AttendanceIssue["type"],
        lateMinutes: assignment.lateMinutes,
      }));

    const summary: DashboardSummary = {
      metric: {
        todayEventCount: todayEvents.length,
        weekEventCount: weekEvents.length,
        todayStaffCount: todayEvents.reduce(
          (sum, event) => sum + event.totalAssigned,
          0,
        ),
        openSlotCount,
        unsignedContractCount: unsignedContracts.length,
        incompleteDocumentCount: missingDocuments.length,
        missingCheckTimeCount: missingCheckTimeAssignments.length,
        unpaidAmount: pendingPayrolls.reduce(
          (sum, item) => sum + item.netPay,
          0,
        ),
        activeStaffCount: staffList.filter(
          (staff) => staff.status === "ACTIVE",
        ).length,
      },
      actions,
      monthlyTrend: buildMonthlyTrend(),
      upcomingEvents,
      attendanceIssues,
    };

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(summary);
  }),
];
