import { HttpResponse, delay, http } from "msw";
import type {
  Assignment,
  AssignmentCandidate,
  AssignmentStatus,
  CalendarEvent,
  EventDetail,
  EventFormValues,
  EventRoleSlot,
  EventStatus,
  WageType,
} from "@/type/event";
import { aggregateDayPlans, resolveEventDates } from "@/type/event";
import type { AttendanceStatus, JobRole } from "@/type/staff";
import {
  calculateReputationScore,
  canConfirmAssignment,
  DOCUMENT_BLOCK_MESSAGE,
} from "@/type/staff";
import { clients } from "../db/client";
import {
  defaultWageOf,
  events,
  syncStaffReputationCounts,
  findConflictEvent,
  findEvent,
  recalculateEventCounts,
  syncEventDays,
} from "../db/event";
import {
  ensurePayrollForEvent,
  syncPayrollWithAssignment,
} from "../db/payroll";
import { assignableStaff, findStaff } from "../db/staff";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  badRequest,
  matchesKeyword,
  nextId,
  notFound,
  paginate,
  requirePermission,
} from "../utils";

/** 목록 응답에는 배치 · 일자별 계획을 내려주지 않는다. 표에서 쓰지 않는 데이터라 무겁다. */
const toEventSummary = (event: EventDetail) => {
  const { assignments, days, ...summary } = event;
  void assignments;
  void days;

  return summary;
};

/**
 * 배치 한 건에 적용할 지급 기준과 금액을 정한다.
 *
 * 그날 그 직무의 발주 조건을 그대로 물려받고, 없으면 직무 기본값으로 떨어진다.
 * 사람마다 · 날마다 다르게 주기로 한 금액은 배치를 만든 뒤 언제든 고칠 수 있으므로
 * (적용 금액 변경) 여기서는 기준값만 정한다.
 */
const resolveAssignmentWage = (
  event: EventDetail,
  date: string,
  role: JobRole,
): { wageType: WageType; wage: number } => {
  const slot = event.days
    .find((day) => day.date === date)
    ?.roles.find((item) => item.role === role);

  return slot ?? defaultWageOf(role);
};

/**
 * 배치 후보 점수.
 *
 * 사람이 매번 기억해서 고르던 기준(즐겨찾기 → 해당 거래처 경험 → 평판 → 경력)을
 * 숫자로 만들어 목록 정렬에 쓴다.
 *
 * 예전에는 '신뢰도'라는 합성 점수를 썼는데, 무엇 때문에 점수가 깎였는지
 * 화면에서 알 수 없어 담당자가 결국 무시하게 됐다.
 * 그래서 평판 · 노쇼 · 지각을 각각 반영하고, 화면에도 그 값을 그대로 보여 준다.
 */
const calculateMatchScore = (params: {
  isFavorite: boolean;
  clientWorkCount: number;
  goodCount: number;
  badCount: number;
  workCount: number;
  noShowCount: number;
  lateCount: number;
  hasConflict: boolean;
  isDocumentComplete: boolean;
}): number => {
  if (params.hasConflict) return -1;

  /*
    평가가 적은 사람의 높은 평판은 덜 믿는다. (좋아요 1건이 전부인 경우)
    표본 수를 반영한 평판 점수가 이미 그 일을 하고 있으므로 그대로 쓴다.
  */
  const ratingScore =
    calculateReputationScore(params.goodCount, params.badCount) * 8;

  return (
    (params.isFavorite ? 30 : 0) +
    Math.min(params.clientWorkCount, 10) * 4 +
    ratingScore +
    Math.min(params.workCount, 40) * 0.5 +
    (params.isDocumentComplete ? 10 : 0) -
    params.noShowCount * 25 -
    params.lateCount * 4
  );
};

export const eventHandlers = [
  /**
   * 캘린더용 조회.
   *
   * 다일 행사를 날짜별로 쪼개서 내려주면 캘린더에서 같은 행사가 여러 개로 보인다.
   * 한 덩어리로 내려주고, 주 단위로 자르는 일은 화면이 한다.
   */
  http.get(`${BASE_URI}/admin/events/calendar`, async ({ request }) => {
    const denied = requirePermission(request, "event:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const clientId = url.searchParams.get("clientId") ?? "";
    const status = url.searchParams.get("status") as EventStatus | null;

    const items: CalendarEvent[] = events
      .filter((event) => {
        if (clientId && String(event.clientId) !== clientId) return false;
        if (status && event.status !== status) return false;

        /*
          기간에 한 칸이라도 걸치면 내려준다.
          띄엄띄엄한 일정은 기간이 걸쳐도 그 안에 근무일이 하나도 없을 수 있어
          (예: 화~목만 보는데 주말 행사) 실제 근무일로 한 번 더 거른다.
        */
        if (from && event.endDate < from) return false;
        if (to && event.startDate > to) return false;

        return event.dates.some(
          (date) => (!from || date >= from) && (!to || date <= to),
        );
      })
      .map((event) => ({
        eventId: event.eventId,
        title: event.title,
        clientName: event.clientName,
        status: event.status,
        startDate: event.startDate,
        endDate: event.endDate,
        recurrence: event.recurrence,
        // 근무일 목록을 함께 내려야 "주말만" 같은 일정을 캘린더가 제대로 자를 수 있다.
        dates: event.dates,
        dayCount: event.dayCount,
        startTime: event.startTime,
        endTime: event.endTime,
        endDayOffset: event.endDayOffset,
        venue: event.venue,
        managerName: event.managerName,
        mainSupervisorName: event.mainSupervisorName,
        roles: event.roles,
        days: event.days,
        totalRequired: event.totalRequired,
        totalAssigned: event.totalAssigned,
        // 캘린더 '자세히 보기'에서 명단을 바로 펼치기 위한 요약이다.
        assignedStaff: event.assignments
          .filter((assignment) => assignment.status !== "CANCELED")
          .map((assignment) => ({
            assignmentId: assignment.assignmentId,
            staffId: assignment.staffId,
            staffName: assignment.staffName,
            role: assignment.role,
            workDate: assignment.workDate,
            status: assignment.status,
          })),
      }));

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items });
  }),

  /** 행사 목록 */
  http.get(`${BASE_URI}/admin/events`, async ({ request }) => {
    const denied = requirePermission(request, "event:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const status = url.searchParams.get("status") as EventStatus | null;
    const clientId = url.searchParams.get("clientId") ?? "";
    const startDate = url.searchParams.get("startDate") ?? "";
    const endDate = url.searchParams.get("endDate") ?? "";
    // 인원이 덜 찬 행사만 보는 필터. 대시보드 할 일에서 넘어올 때 쓴다.
    const onlyUnderstaffed = url.searchParams.get("onlyUnderstaffed") === "true";

    const filtered = events.filter((event) => {
      if (status && event.status !== status) return false;
      if (clientId && String(event.clientId) !== clientId) return false;
      if (startDate && event.endDate < startDate) return false;
      if (endDate && event.startDate > endDate) return false;
      if (onlyUnderstaffed && event.totalAssigned >= event.totalRequired) {
        return false;
      }

      return matchesKeyword(
        keyword,
        event.title,
        event.clientName,
        event.venue,
        event.managerName,
      );
    });

    const sorted = [...filtered].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(sorted.map(toEventSummary), url));
  }),

  http.get(`${BASE_URI}/admin/events/:eventId`, async ({ params, request }) => {
    const denied = requirePermission(request, "event:read");

    if (denied) return denied;

    const event = findEvent(Number(params.eventId));

    await delay(MOCK_DELAY_MS);

    if (!event) return notFound("존재하지 않는 행사입니다.");

    return HttpResponse.json(event);
  }),

  http.post(`${BASE_URI}/admin/events`, async ({ request }) => {
      const denied = requirePermission(request, "event:write");

      if (denied) return denied;

    const body = (await request.json()) as EventFormValues;
    const client = clients.find((item) => item.clientId === body.clientId);

    if (!client) return badRequest("거래처를 먼저 선택해 주세요.");

    const baseRoles = body.roles.map((slot) => ({ ...slot, assignedCount: 0 }));

    /*
      반복 규칙에서 실제 근무일을 뽑는다.
      폼에서 받은 인원은 '하루치 기준'이므로 모든 근무일에 같은 값을 깔아 두고,
      날짜별 편차는 행사 상세의 일자별 계획에서 조정한다.
    */
    const dates = resolveEventDates(
      body.startDate,
      body.endDate,
      body.recurrence,
    );

    if (dates.length === 0) {
      return badRequest(
        "이 조건으로는 근무일이 하나도 없습니다. 기간이나 반복 조건을 확인해 주세요.",
        "EMPTY_RECURRENCE",
      );
    }

    const days = dates.map((date) => ({
      date,
      roles: baseRoles.map((slot) => ({ ...slot })),
    }));
    const roles = aggregateDayPlans(days);

    const created: EventDetail = {
      ...body,
      eventId: nextId(events, "eventId"),
      clientName: client.name,
      status: "RECRUITING",
      dates,
      dayCount: days.length,
      days,
      roles,
      totalRequired: roles.reduce((sum, slot) => sum + slot.requiredCount, 0),
      totalAssigned: 0,
      assignments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    events.push(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  /**
   * 메인팀장 지정.
   *
   * 확정 배치된 사람만 지정할 수 있다. 배치되지도 않은 사람을 메인으로 적어 두면
   * 캘린더에는 이름이 뜨는데 현장에는 그 사람이 없다.
   */
  http.patch(
    `${BASE_URI}/admin/events/:eventId/main-supervisor`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "event:write");

      if (denied) return denied;

      const event = findEvent(Number(params.eventId));
      const body = (await request.json()) as { staffId: number | null };

      if (!event) return notFound("존재하지 않는 행사입니다.");

      if (body.staffId === null) {
        event.mainSupervisorStaffId = undefined;
        event.mainSupervisorName = undefined;
        event.mainSupervisorPhone = undefined;

        await delay(MOCK_DELAY_MS);

        return HttpResponse.json(event);
      }

      const assignment = event.assignments.find(
        (item) =>
          item.staffId === body.staffId && item.status === "CONFIRMED",
      );

      if (!assignment) {
        return badRequest(
          "이 행사에 확정 배치된 인력만 메인팀장으로 지정할 수 있습니다.",
        );
      }

      event.mainSupervisorStaffId = assignment.staffId;
      event.mainSupervisorName = assignment.staffName;
      event.mainSupervisorPhone = assignment.staffPhone;
      event.updatedAt = new Date().toISOString();

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(event);
    },
  ),

  http.put(`${BASE_URI}/admin/events/:eventId`, async ({ params, request }) => {
      const denied = requirePermission(request, "event:write");

      if (denied) return denied;

    const event = findEvent(Number(params.eventId));
    const body = (await request.json()) as EventFormValues;

    if (!event) return notFound("존재하지 않는 행사입니다.");

    const client = clients.find((item) => item.clientId === body.clientId);

    if (
      resolveEventDates(body.startDate, body.endDate, body.recurrence)
        .length === 0
    ) {
      return badRequest(
        "이 조건으로는 근무일이 하나도 없습니다. 기간이나 반복 조건을 확인해 주세요.",
        "EMPTY_RECURRENCE",
      );
    }

    Object.assign(event, body, { clientName: client?.name ?? event.clientName });

    /*
      기간이 늘어나면 새 날에 기준 인원을 깔고, 줄어들면 밖으로 밀려난 배치를 정리한다.
      이미 있던 날의 인원은 현장에서 조정해 둔 값일 수 있으므로 덮어쓰지 않는다.

      새 날에 깔 기준은 **이미 있는 첫 근무일**에서 가져온다.
      수정 폼은 발주를 더 이상 받지 않으므로(일별 근무자 탭이 담당한다)
      요청 본문의 값은 화면에서 손댄 적 없는 옛 값이고, 그걸 깔면
      담당자가 일별로 조정해 둔 구성과 다른 날이 조용히 섞인다.
    */
    const [firstDay] = event.days;

    syncEventDays(
      event,
      (firstDay?.roles ?? body.roles).map((slot) => ({
        ...slot,
        assignedCount: 0,
      })),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(event);
  }),

  /**
   * 근무일 하나의 발주 인원을 고친다.
   *
   * 행사 폼의 발주는 **모든 날에 같은 인원**을 깔아 주는 초기값일 뿐이다.
   * 실제 현장은 날마다 필요한 사람이 다르다. (설치는 첫날만, 철거는 마지막 날만,
   * 주말에만 인원을 늘리는 식) 그걸 표현할 방법이 없으면 담당자는
   * 가장 많이 필요한 날에 맞춰 발주를 잡아 두고 나머지 날은 머릿속으로 뺀다.
   */
  http.put(
    `${BASE_URI}/admin/events/:eventId/days/:date/roles`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "event:write");

      if (denied) return denied;

      const event = findEvent(Number(params.eventId));
      const { roles } = (await request.json()) as {
        roles: Omit<EventRoleSlot, "assignedCount">[];
      };

      if (!event) return notFound("존재하지 않는 행사입니다.");

      const day = event.days.find((item) => item.date === params.date);

      if (!day) return notFound("존재하지 않는 근무일입니다.");

      const duplicated = roles.find(
        (slot, index) =>
          roles.findIndex((other) => other.role === slot.role) !== index,
      );

      if (duplicated) {
        return badRequest("같은 직무를 두 번 넣을 수 없습니다.", "DUPLICATED_ROLE");
      }

      /*
        이미 배치된 사람이 있는 직무는 뺄 수 없다.
        발주만 지우면 배치는 남아 "발주 0명인데 3명이 나오는 날"이 만들어지고,
        그 사람들의 계약서 · 정산은 근거 없는 문서가 된다.
      */
      const removed = day.roles.filter(
        (slot) => !roles.some((next) => next.role === slot.role),
      );
      const blocked = removed.find((slot) =>
        event.assignments.some(
          (assignment) =>
            assignment.workDate === day.date &&
            assignment.role === slot.role &&
            assignment.status !== "CANCELED",
        ),
      );

      if (blocked) {
        return badRequest(
          "이미 배치된 인력이 있는 직무는 뺄 수 없습니다. 배치를 먼저 해제해 주세요.",
          "ROLE_HAS_ASSIGNMENT",
        );
      }

      day.roles = roles.map((slot) => ({ ...slot, assignedCount: 0 }));

      // 합계 · 충원 상태는 일자별 계획이 원본이다. 여기서 다시 세어 맞춘다.
      recalculateEventCounts(event);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(event);
    },
  ),

  http.patch(
    `${BASE_URI}/admin/events/:eventId/status`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "event:write");

      if (denied) return denied;

      const event = findEvent(Number(params.eventId));
      const { status } = (await request.json()) as { status: EventStatus };

      if (!event) return notFound("존재하지 않는 행사입니다.");

      event.status = status;
      event.updatedAt = new Date().toISOString();

      /*
        정산대기로 넘어오는 순간 배치별 정산 항목을 만든다.
        여기서 만들어 두지 않으면 근태·출퇴근을 기록해도 반영될 곳이 없어
        "기록하면 정산까지 이어진다"는 흐름이 끊긴다.
      */
      ensurePayrollForEvent(event);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(event);
    },
  ),

  http.delete(`${BASE_URI}/admin/events/:eventId`, async ({ params, request }) => {
      const denied = requirePermission(request, "event:delete");

      if (denied) return denied;

    const index = events.findIndex(
      (event) => event.eventId === Number(params.eventId),
    );

    if (index < 0) return notFound("존재하지 않는 행사입니다.");

    events.splice(index, 1);
    await delay(MOCK_DELAY_MS);

    return new HttpResponse(null, { status: 204 });
  }),

  /**
   * 배치 후보 조회.
   *
   * 다일 행사는 "3일 중 2일만 가능"한 경우가 흔하다.
   * 그래서 겹침 여부를 참/거짓이 아니라 **날짜 목록**으로 알려 준다.
   * 화면은 겹치는 날만 빼고 배치할 수 있다.
   */
  http.get(
    `${BASE_URI}/admin/events/:eventId/candidates`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "assignment:read");

      if (denied) return denied;

      const event = findEvent(Number(params.eventId));
      const url = new URL(request.url);
      const role = url.searchParams.get("role") as JobRole | null;
      const keyword = url.searchParams.get("keyword") ?? "";
      // 비어 있으면 행사 전체 기간을 대상으로 본다.
      const dates =
        url.searchParams.get("dates")?.split(",").filter(Boolean) ?? [];
      const includeUnavailable =
        url.searchParams.get("includeUnavailable") === "true";

      if (!event) return notFound("존재하지 않는 행사입니다.");

      const targetDates =
        dates.length > 0 ? dates : event.days.map((day) => day.date);

      const candidates: AssignmentCandidate[] = assignableStaff()
        /*
          직원은 직무 조건에 걸리지 않는다.
          대행사가 슈퍼바이저 TO를 주면 직원이 메인을 잡고, 다음 행사에서는
          같은 사람이 스태프 자리에 서기도 한다. "가능 직무"로 좁히면
          정작 어디에나 넣을 수 있는 사람이 후보에서 사라진다.
        */
        .filter((staff) =>
          role
            ? staff.employment === "EMPLOYEE" || staff.roles.includes(role)
            : true,
        )
        .filter((staff) =>
          matchesKeyword(keyword, staff.name, staff.phoneNumber, staff.region),
        )
        .map((staff) => {
          // 이 행사에서 이미 잡혀 있는 날
          const assignedDates = event.assignments
            .filter(
              (assignment) =>
                assignment.staffId === staff.staffId &&
                assignment.status !== "CANCELED",
            )
            .map((assignment) => assignment.workDate);

          // 다른 행사와 겹치는 날
          const conflicts = targetDates
            .map((date) => ({
              date,
              conflictEvent: findConflictEvent(
                staff.staffId,
                date,
                event.eventId,
              ),
            }))
            .filter((item) => Boolean(item.conflictEvent));

          // 같은 거래처 행사 경험은 현장 적응 속도와 직결되므로 따로 센다.
          const clientWorkCount = events.filter(
            (item) =>
              item.clientId === event.clientId &&
              item.assignments.some(
                (assignment) => assignment.staffId === staff.staffId,
              ),
          ).length;

          // 고른 날이 전부 막혀 있으면 지금은 배치할 수 없는 사람이다.
          const isFullyBlocked = targetDates.every(
            (date) =>
              assignedDates.includes(date) ||
              conflicts.some((item) => item.date === date),
          );

          return {
            staffId: staff.staffId,
            name: staff.name,
            phoneNumber: staff.phoneNumber,
            profileImageUrl: staff.profileImageUrl,
            roles: staff.roles,
            region: staff.region,
            district: staff.district,
            goodCount: staff.goodCount,
            badCount: staff.badCount,
            workCount: staff.workCount,
            noShowCount: staff.noShowCount,
            lateCount: staff.lateCount,
            isFavorite: staff.isFavorite,
            isDocumentComplete: staff.isDocumentComplete,
            isEmployee: staff.employment === "EMPLOYEE",
            position: staff.position,
            clientWorkCount,
            conflictDates: conflicts.map((item) => item.date),
            conflictEventTitle: conflicts[0]?.conflictEvent?.title,
            assignedDates,
            matchScore: calculateMatchScore({
              isFavorite: staff.isFavorite,
              clientWorkCount,
              goodCount: staff.goodCount,
              badCount: staff.badCount,
              workCount: staff.workCount,
              noShowCount: staff.noShowCount,
              lateCount: staff.lateCount,
              hasConflict: isFullyBlocked,
              isDocumentComplete: staff.isDocumentComplete,
            }),
          };
        })
        .filter((candidate) => includeUnavailable || candidate.matchScore >= 0)
        .sort((a, b) => b.matchScore - a.matchScore);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json({ items: candidates.slice(0, 40) });
    },
  ),

  /**
   * 인력 배치.
   *
   * 여러 명 × 여러 날을 한 번에 넣는다.
   * 이미 잡혀 있거나 다른 행사와 겹치는 날은 건너뛰고,
   * 무엇을 건너뛰었는지 응답으로 돌려준다.
   */
  http.post(
    `${BASE_URI}/admin/events/:eventId/assignments`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "assignment:write");

      if (denied) return denied;

      const event = findEvent(Number(params.eventId));
      const body = (await request.json()) as {
        staffIds: number[];
        dates?: string[];
        role: JobRole;
        status: AssignmentStatus;
      };

      if (!event) return notFound("존재하지 않는 행사입니다.");

      /*
        날짜를 지정하지 않으면 행사의 모든 근무일에 넣는다.
        (호출부가 dates를 아예 보내지 않는 경우도 있어 옵셔널로 다룬다)
      */
      const targetDates =
        body.dates && body.dates.length > 0
          ? body.dates
          : event.days.map((day) => day.date);

      const skipped: string[] = [];
      let createdCount = 0;

      let maxId = events.reduce(
        (max, item) =>
          item.assignments.reduce(
            (innerMax, assignment) =>
              Math.max(innerMax, assignment.assignmentId),
            max,
          ),
        0,
      );

      /** 서류가 없어 확정하지 못한 사람. 무엇 때문에 빠졌는지 돌려줘야 한다. */
      const documentBlocked: string[] = [];

      body.staffIds.forEach((staffId) => {
        const staff = findStaff(staffId);
        if (!staff) return;

        /*
          서류(신분증 · 통장사본)가 없으면 확정 배치를 막는다.
          일을 다 시킨 뒤에 통장사본이 없다는 걸 알면 지급할 방법이 없다.
          제안 · 대기는 그대로 둔다. 서류는 보통 "같이 하기로 한 뒤에" 받는다.
        */
        if (body.status === "CONFIRMED" && !canConfirmAssignment(staff)) {
          documentBlocked.push(staff.name);
          return;
        }

        const blockedDates: string[] = [];

        targetDates.forEach((date) => {
          // 같은 행사에 같은 날 두 번 넣지 않는다.
          const isAlreadyAssigned = event.assignments.some(
            (assignment) =>
              assignment.staffId === staffId &&
              assignment.workDate === date &&
              assignment.status !== "CANCELED",
          );

          if (isAlreadyAssigned) {
            blockedDates.push(date);
            return;
          }

          // 확정 배치만 다른 행사와의 중복을 막는다. 대기 등록은 겹쳐도 된다.
          if (body.status === "CONFIRMED") {
            const conflict = findConflictEvent(staffId, date, event.eventId);

            if (conflict) {
              blockedDates.push(date);
              return;
            }
          }

          maxId += 1;
          createdCount += 1;

          event.assignments.push({
            assignmentId: maxId,
            eventId: event.eventId,
            eventTitle: event.title,
            workDate: date,
            staffId: staff.staffId,
            staffName: staff.name,
            staffPhone: staff.phoneNumber,
            staffProfileImageUrl: staff.profileImageUrl,
            isEmployee: staff.employment === "EMPLOYEE",
            role: body.role,
            status: body.status,
            ...resolveAssignmentWage(event, date, body.role),
            attendance: "PENDING",
            lateMinutes: 0,
            /* 직원은 회사와 이미 근로계약이 되어 있어 행사마다 다시 쓰지 않는다. */
            isContractSigned: staff.employment === "EMPLOYEE",
            isPaid: false,
            createdAt: new Date().toISOString(),
          });
        });

        if (blockedDates.length > 0) {
          skipped.push(`${staff.name}(${blockedDates.length}일)`);
        }
      });

      recalculateEventCounts(event);
      await delay(MOCK_DELAY_MS);

      if (createdCount === 0) {
        /*
          서류 때문에 막힌 것과 일정이 겹쳐 막힌 것은 담당자가 할 일이 다르다.
          (서류는 받아 오면 되고, 겹침은 다른 사람을 찾아야 한다)
          한 문장으로 뭉뚱그리면 무엇을 해야 할지 알 수 없다.
        */
        if (documentBlocked.length > 0) {
          return badRequest(
            `${documentBlocked.join(", ")}님은 ${DOCUMENT_BLOCK_MESSAGE}`,
            "DOCUMENT_REQUIRED",
          );
        }

        return badRequest(
          skipped.length > 0
            ? `배치할 수 있는 날이 없습니다. 일정이 겹칩니다: ${skipped.join(", ")}`
            : "배치할 대상이 없습니다.",
          "ASSIGNMENT_CONFLICT",
        );
      }

      return HttpResponse.json(
        { event, createdCount, skipped, documentBlocked },
        { status: 201 },
      );
    },
  ),

  /**
   * 일자별 발주 인원 조정.
   *
   * 현장에서 "내일은 두 명 더", "마지막 날은 세 명 빼자"가 수시로 생긴다.
   * 행사 전체를 수정하지 않고 그 날의 숫자만 바꿀 수 있어야 한다.
   */
  http.patch(
    `${BASE_URI}/admin/events/:eventId/days`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "event:write");

      if (denied) return denied;

      const event = findEvent(Number(params.eventId));
      const body = (await request.json()) as {
        date: string;
        role: JobRole;
        requiredCount: number;
      };

      if (!event) return notFound("존재하지 않는 행사입니다.");

      const day = event.days.find((item) => item.date === body.date);

      if (!day) return badRequest("행사 기간에 없는 날짜입니다.");

      const slot = day.roles.find((item) => item.role === body.role);

      if (slot) {
        slot.requiredCount = Math.max(0, body.requiredCount);
      } else {
        // 그날에 없던 직무를 새로 투입하는 경우다.
        day.roles.push({
          role: body.role,
          requiredCount: Math.max(0, body.requiredCount),
          assignedCount: 0,
          ...defaultWageOf(body.role),
        });
      }

      recalculateEventCounts(event);
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(event);
    },
  ),

  /** 배치 상태 · 근태 · 평가 변경 */
  http.patch(
    `${BASE_URI}/admin/assignments/:assignmentId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "assignment:write");

      if (denied) return denied;

      const assignmentId = Number(params.assignmentId);
      const body = (await request.json()) as Partial<
        Pick<
          Assignment,
          | "status"
          | "role"
          | "attendance"
          | "lateMinutes"
          | "reputationVerdict"
          | "reputationTags"
          | "reputationComment"
          | "isContractSigned"
          // 적용 금액은 행사 안에서 사람마다 · 날마다 자유롭게 고칠 수 있다.
          | "wageType"
          | "wage"
        >
      > & {
        // 출퇴근은 null로 지울 수 있다. (노쇼로 바꾸면 기록을 없애야 한다)
        checkInAt?: string | null;
        checkOutAt?: string | null;
        actualBreakMinutes?: number | null;
      };

      const event = events.find((item) =>
        item.assignments.some(
          (assignment) => assignment.assignmentId === assignmentId,
        ),
      );
      const assignment = event?.assignments.find(
        (item) => item.assignmentId === assignmentId,
      );

      if (!event || !assignment) return notFound("존재하지 않는 배치입니다.");

      /*
        대기 · 제안을 확정으로 올릴 때도 같은 규칙을 건다.
        생성에서만 막으면 "제안으로 넣어 두고 나중에 확정"이라는 우회로가 남아,
        결국 서류 없는 사람이 현장에 나가게 된다.
      */
      if (body.status === "CONFIRMED" && assignment.status !== "CONFIRMED") {
        const staff = findStaff(assignment.staffId);

        if (staff && !canConfirmAssignment(staff)) {
          return badRequest(
            `${staff.name}님은 ${DOCUMENT_BLOCK_MESSAGE}`,
            "DOCUMENT_REQUIRED",
          );
        }
      }

      const { checkInAt, checkOutAt, actualBreakMinutes, ...rest } = body;

      Object.assign(assignment, rest);

      /*
        출퇴근 기록은 세 상태를 구분해야 한다.
        - undefined: 이번 요청에서 건드리지 않음
        - null:      기록 삭제 (예정 시간으로 되돌아간다)
        - 문자열:     기록
      */
      if (checkInAt !== undefined) {
        assignment.checkInAt = checkInAt ?? undefined;
      }
      if (checkOutAt !== undefined) {
        assignment.checkOutAt = checkOutAt ?? undefined;
      }
      if (actualBreakMinutes !== undefined) {
        assignment.actualBreakMinutes = actualBreakMinutes ?? undefined;
      }

      // 근태를 기록하면 인력의 누적 지표도 함께 움직여야 통계가 어긋나지 않는다.
      if (body.attendance) {
        const staff = findStaff(assignment.staffId);

        if (staff) {
          const attendance = body.attendance as AttendanceStatus;

          if (attendance === "NO_SHOW") staff.noShowCount += 1;
          if (attendance === "LATE") staff.lateCount += 1;
        }
      }

      /*
        평가를 남기면 그 사람의 평판 점수가 곧바로 따라와야 한다.
        점수를 따로 들고 있으면 목록의 점수와 상세의 평가 내역이 어긋난다.
      */
      if (body.reputationVerdict) syncStaffReputationCounts();

      /*
        실제 근무시간이 바뀌면 지급액이 바뀐다.
        근태만 기록하고 정산은 예정 시간 그대로면, 결국 정산 화면에서 손으로
        다시 고쳐야 한다. 기록하는 순간 정산까지 이어지게 한다.
      */
      syncPayrollWithAssignment(assignment, event);

      recalculateEventCounts(event);
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(assignment);
    },
  ),

  http.delete(
    `${BASE_URI}/admin/assignments/:assignmentId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "assignment:delete");

      if (denied) return denied;

      const assignmentId = Number(params.assignmentId);
      const event = events.find((item) =>
        item.assignments.some(
          (assignment) => assignment.assignmentId === assignmentId,
        ),
      );

      if (!event) return notFound("존재하지 않는 배치입니다.");

      event.assignments = event.assignments.filter(
        (assignment) => assignment.assignmentId !== assignmentId,
      );
      recalculateEventCounts(event);

      await delay(MOCK_DELAY_MS);

      return new HttpResponse(null, { status: 204 });
    },
  ),

  /** 배치 현황 보드. 인력 기준으로 배치를 펴서 본다. */
  http.get(`${BASE_URI}/admin/assignments`, async ({ request }) => {
    const denied = requirePermission(request, "assignment:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const role = url.searchParams.get("role") as JobRole | null;
    const status = url.searchParams.get("status") as AssignmentStatus | null;
    const attendance = url.searchParams.get(
      "attendance",
    ) as AttendanceStatus | null;
    const startDate = url.searchParams.get("startDate") ?? "";
    const endDate = url.searchParams.get("endDate") ?? "";
    const onlyUnsignedContract =
      url.searchParams.get("onlyUnsignedContract") === "true";
    const onlyMissingCheckTime =
      url.searchParams.get("onlyMissingCheckTime") === "true";

    const filtered = events
      .flatMap((event) => event.assignments)
      .filter((assignment) => {
        if (role && assignment.role !== role) return false;
        if (status && assignment.status !== status) return false;
        if (attendance && assignment.attendance !== attendance) return false;
        if (startDate && assignment.workDate < startDate) return false;
        if (endDate && assignment.workDate > endDate) return false;
        if (onlyUnsignedContract && assignment.isContractSigned) return false;

        /*
          출퇴근 미기록 필터.
          아직 오지 않은 날과 노쇼·결근은 적을 것이 없으므로 대상에서 뺀다.
        */
        if (onlyMissingCheckTime) {
          const isSkippable =
            assignment.attendance === "PENDING" ||
            assignment.attendance === "NO_SHOW" ||
            assignment.attendance === "ABSENT";

          if (isSkippable) return false;
          if (assignment.checkInAt && assignment.checkOutAt) return false;
        }

        return matchesKeyword(
          keyword,
          assignment.staffName,
          assignment.eventTitle,
          assignment.staffPhone,
        );
      })
      .sort((a, b) => b.workDate.localeCompare(a.workDate));

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(filtered, url));
  }),
];
