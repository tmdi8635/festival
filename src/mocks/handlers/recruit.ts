import { HttpResponse, delay, http } from "msw";
import type {
  Application,
  ApplicationStatus,
  JobPosting,
  PostingFormValues,
  PostingStatus,
} from "@/type/recruit";
import type { WageType } from "@/type/event";
import type { JobRole } from "@/type/staff";
import { jobRoleLabel } from "@/store/useOrgStore";
import {
  defaultWageOf,
  events,
  findConflictEvent,
  findEvent,
  recalculateEventCounts,
} from "../db/event";
import {
  applications,
  buildPostingContent,
  findApplication,
  findPosting,
  postings,
  recalculatePostingCounts,
} from "../db/recruit";
import { findStaff, staffList } from "../db/staff";
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

/**
 * 지원자를 확정할 때 붙는 지급 기준과 금액.
 *
 * 행사 직무의 조건을 그대로 물려받는다.
 * 사람마다 다르게 주기로 한 금액은 배치 화면에서 따로 고친다.
 */
const resolveConfirmedWage = (
  event: { roles: { role: JobRole; wageType: WageType; wage: number }[] },
  role: JobRole,
): { wageType: WageType; wage: number } => {
  const slot = event.roles.find((item) => item.role === role);

  return slot ?? defaultWageOf(role);
};

export const recruitHandlers = [
  http.get(`${BASE_URI}/admin/postings`, async ({ request }) => {
    const denied = requirePermission(request, "recruit:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const status = url.searchParams.get("status") as PostingStatus | null;
    const role = url.searchParams.get("role") as JobRole | null;

    recalculatePostingCounts();

    const filtered = postings.filter((posting) => {
      if (status && posting.status !== status) return false;
      if (role && posting.role !== role) return false;

      return matchesKeyword(
        keyword,
        posting.title,
        posting.eventTitle,
        posting.clientName,
      );
    });

    const sorted = [...filtered].sort((a, b) =>
      a.workDate.localeCompare(b.workDate),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(sorted, url));
  }),

  http.get(`${BASE_URI}/admin/postings/:postingId`, async ({ params, request }) => {
    const denied = requirePermission(request, "recruit:read");

    if (denied) return denied;

    const posting = findPosting(Number(params.postingId));

    await delay(MOCK_DELAY_MS);

    if (!posting) return notFound("존재하지 않는 공고입니다.");

    return HttpResponse.json(posting);
  }),

  /**
   * 공고 생성.
   * 행사 정보에서 공고문을 자동으로 만들어 준다. 필수 항목 누락을 막기 위해서다.
   */
  http.post(`${BASE_URI}/admin/postings`, async ({ request }) => {
    const denied = requirePermission(request, "recruit:write");

    if (denied) return denied;

    const body = (await request.json()) as PostingFormValues;
    const event = findEvent(body.eventId);

    if (!event) return badRequest("행사를 먼저 선택해 주세요.");

    const created: JobPosting = {
      postingId: nextId(postings, "postingId"),
      eventId: event.eventId,
      eventTitle: event.title,
      clientName: event.clientName,
      title: body.title,
      role: body.role,
      requiredCount: body.requiredCount,
      applicantCount: 0,
      confirmedCount: 0,
      wageType: body.wageType,
      wage: body.wage,
      workDate: event.startDate,
      startTime: event.startTime,
      endTime: event.endTime,
      endDayOffset: event.endDayOffset,
      venue: event.venue,
      status: "OPEN",
      content:
        body.content ||
        buildPostingContent({
          eventTitle: event.title,
          workDate: event.startDate,
          startTime: event.startTime,
          endTime: event.endTime,
          endDayOffset: event.endDayOffset,
          venue: event.venue,
          meetingPoint: event.meetingPoint,
          role: jobRoleLabel(body.role),
          requiredCount: body.requiredCount,
          wageType: body.wageType,
          wage: body.wage,
          dressCode: event.dressCode,
          belongings: event.belongings,
          managerName: event.managerName,
        }),
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    postings.unshift(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(
    `${BASE_URI}/admin/postings/:postingId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "recruit:write");

      if (denied) return denied;

      const posting = findPosting(Number(params.postingId));
      const body = (await request.json()) as PostingFormValues;

      if (!posting) return notFound("존재하지 않는 공고입니다.");

      Object.assign(posting, {
        title: body.title,
        role: body.role,
        requiredCount: body.requiredCount,
        wageType: body.wageType,
        wage: body.wage,
        content: body.content,
      });

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(posting);
    },
  ),

  http.patch(
    `${BASE_URI}/admin/postings/:postingId/status`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "recruit:write");

      if (denied) return denied;

      const posting = findPosting(Number(params.postingId));
      const { status } = (await request.json()) as { status: PostingStatus };

      if (!posting) return notFound("존재하지 않는 공고입니다.");

      posting.status = status;
      posting.closedAt =
        status === "CLOSED" || status === "FILLED"
          ? new Date().toISOString()
          : undefined;
      posting.publishedAt =
        status === "OPEN"
          ? (posting.publishedAt ?? new Date().toISOString())
          : posting.publishedAt;

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(posting);
    },
  ),

  /* ---------------------------------- 지원 ---------------------------------- */

  http.get(`${BASE_URI}/admin/applications`, async ({ request }) => {
    const denied = requirePermission(request, "recruit:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const status = url.searchParams.get("status") as ApplicationStatus | null;
    const postingId = url.searchParams.get("postingId") ?? "";
    const onlyNewApplicant = url.searchParams.get("onlyNewApplicant") === "true";

    const filtered = applications.filter((application) => {
      if (status && application.status !== status) return false;
      if (postingId && String(application.postingId) !== postingId) return false;
      if (onlyNewApplicant && application.isExistingStaff) return false;

      return matchesKeyword(
        keyword,
        application.applicantName,
        application.phoneNumber,
        application.eventTitle,
      );
    });

    const sorted = [...filtered].sort((a, b) =>
      b.appliedAt.localeCompare(a.appliedAt),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(sorted, url));
  }),

  /**
   * 지원 처리.
   *
   * 확정하면 그 자리에서 행사 배치까지 만든다.
   * 문자로 받고 따로 표에 옮겨 적던 단계를 없애는 것이 이 API의 목적이다.
   */
  http.patch(
    `${BASE_URI}/admin/applications/:applicationId`,
    async ({ params, request }) => {
      /*
        지원 확정은 그 자리에서 행사 배치까지 만든다.
        그래서 모집 권한만으로는 부족하고 배치 권한도 함께 있어야 한다.
        한쪽만 보고 통과시키면 `assignment:write`가 없는 사람이
        모집 화면을 통해 배치를 만들 수 있다.
      */
      const { status } = (await request.json()) as {
        status: ApplicationStatus;
      };

      const denied =
        requirePermission(request, "recruit:write") ??
        (status === "ACCEPTED"
          ? requirePermission(request, "assignment:write")
          : null);

      if (denied) return denied;

      const application = findApplication(Number(params.applicationId));

      if (!application) return notFound("존재하지 않는 지원 건입니다.");

      if (status === "ACCEPTED") {
        if (!application.staffId) {
          return badRequest(
            "인력풀에 등록되지 않은 지원자입니다. 인사관리에서 먼저 등록해 주세요.",
            "STAFF_NOT_REGISTERED",
          );
        }

        const staff = findStaff(application.staffId);
        const event = findEvent(application.eventId);

        if (!staff || !event) return notFound("행사 또는 인력을 찾을 수 없습니다.");

        const conflict = findConflictEvent(
          staff.staffId,
          event.startDate,
          event.eventId,
        );

        if (conflict) {
          return badRequest(
            `${staff.name}님은 같은 날 '${conflict.title}'에 이미 확정되어 있습니다.`,
            "ASSIGNMENT_CONFLICT",
          );
        }

        const maxId = events.reduce(
          (max, item) =>
            item.assignments.reduce(
              (innerMax, assignment) =>
                Math.max(innerMax, assignment.assignmentId),
              max,
            ),
          0,
        );

        event.assignments.push({
          assignmentId: maxId + 1,
          eventId: event.eventId,
          eventTitle: event.title,
          workDate: event.startDate,
          staffId: staff.staffId,
          staffName: staff.name,
          staffPhone: staff.phoneNumber,
          staffProfileImageUrl: staff.profileImageUrl,
          isEmployee: staff.employment === "EMPLOYEE",
          role: application.role,
          status: "CONFIRMED",
          ...resolveConfirmedWage(event, application.role),
          attendance: "PENDING",
          lateMinutes: 0,
          isContractSigned: staff.employment === "EMPLOYEE",
          isPaid: false,
          createdAt: new Date().toISOString(),
        });

        recalculateEventCounts(event);
      }

      application.status = status;
      application.processedAt = new Date().toISOString();

      recalculatePostingCounts();
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(application);
    },
  ),

  /** 문자로 받은 지원을 손으로 등록한다. (앱이 붙기 전까지의 창구) */
  http.post(`${BASE_URI}/admin/applications`, async ({ request }) => {
    const denied = requirePermission(request, "recruit:write");

    if (denied) return denied;

    const body = (await request.json()) as {
      postingId: number;
      applicantName: string;
      phoneNumber: string;
      note: string;
    };

    const posting = findPosting(body.postingId);

    if (!posting) return badRequest("공고를 먼저 선택해 주세요.");

    // 이미 등록된 번호면 기존 인력으로 이어 붙인다. 신규면 서류부터 받아야 한다.
    const staff = staffList.find(
      (item) => item.phoneNumber === body.phoneNumber,
    );

    const created: Application = {
      applicationId: nextId(applications, "applicationId"),
      postingId: posting.postingId,
      postingTitle: posting.title,
      eventId: posting.eventId,
      eventTitle: posting.eventTitle,
      workDate: posting.workDate,
      role: posting.role,
      staffId: staff?.staffId,
      applicantName: body.applicantName,
      phoneNumber: body.phoneNumber,
      isExistingStaff: Boolean(staff),
      status: "PENDING",
      note: body.note,
      conflictEventTitle: staff
        ? findConflictEvent(staff.staffId, posting.workDate)?.title
        : undefined,
      appliedAt: new Date().toISOString(),
    };

    applications.unshift(created);
    recalculatePostingCounts();
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),
];
