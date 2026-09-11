import { HttpResponse, delay, http } from "msw";
import type {
  Application,
  ApplicationStatus,
  JobPosting,
  PostingFormValues,
  PostingPosition,
  PostingStatus,
} from "@/type/recruit";
import { ACTIVE_APPLICATION_STATUSES } from "@/type/recruit";
import type { JobRole } from "@/type/staff";
import { canConfirmAssignment, documentBlockMessage } from "@/type/staff";
import { findPosition } from "@/type/event";
import {
  events,
  findConflictEvent,
  findEvent,
  positionWorkDates,
  recalculateEventCounts,
  resolveAssignmentWage,
} from "../db/event";
import {
  applications,
  buildPostingContent,
  findActivePositionApplication,
  findApplication,
  findPosting,
  postings,
  recalculatePostingCounts,
  toPostingPosition,
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
 * 요청의 모집 포지션을 행사 포지션으로 채운다. 행사에 없는 번호는 거부한다.
 *
 * 화면이 옛 목록을 들고 있다가 이미 지워진 포지션으로 공고를 만드는 일이 실제로 난다.
 * 그대로 받으면 지원은 되는데 확정할 때 배치를 만들 곳이 없다.
 */
const resolveTargets = (
  eventId: number,
  targets: PostingFormValues["positions"],
): { positions: PostingPosition[] } | { error: Response } => {
  const event = findEvent(eventId);

  if (!event) return { error: badRequest("행사를 먼저 선택해 주세요.") };

  if (targets.length === 0) {
    return { error: badRequest("모집할 포지션을 한 개 이상 골라 주세요.") };
  }

  const positions: PostingPosition[] = [];

  for (const target of targets) {
    const position = toPostingPosition(event, target);

    if (!position) {
      return {
        error: badRequest(
          "행사에 없는 포지션이 섞여 있습니다. 화면을 새로 고친 뒤 다시 골라 주세요.",
        ),
      };
    }

    if (target.requiredCount < 1) {
      return { error: badRequest(`${position.name}의 모집 인원을 입력해 주세요.`) };
    }

    positions.push(position);
  }

  return { positions };
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
      /* 직무 조건은 "그 직무로 모집하는 포지션이 하나라도 있는가"로 본다. */
      if (role && !posting.positions.some((position) => position.jobRole === role)) {
        return false;
      }

      return matchesKeyword(
        keyword,
        posting.title,
        posting.eventTitle,
        posting.clientName,
        ...posting.positions.map((position) => position.name),
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

    recalculatePostingCounts();

    const posting = findPosting(Number(params.postingId));

    await delay(MOCK_DELAY_MS);

    if (!posting) return notFound("존재하지 않는 공고입니다.");

    return HttpResponse.json(posting);
  }),

  /**
   * 공고 생성. **행사 하나에 공고 하나다.**
   *
   * 같은 행사의 공고가 둘이면 지원자 눈에는 같은 행사가 두 번 보이고,
   * "행사당 지원 하나" 규칙도 공고를 넘나들며 깨진다. 포지션을 늘리려면
   * 기존 공고를 고친다. 마감(`CLOSED` · `FILLED`)된 공고는 다시 열 수 있으니 세지 않는다.
   */
  http.post(`${BASE_URI}/admin/postings`, async ({ request }) => {
    const denied = requirePermission(request, "recruit:write");

    if (denied) return denied;

    const body = (await request.json()) as PostingFormValues;
    const event = findEvent(body.eventId);

    if (!event) return badRequest("행사를 먼저 선택해 주세요.");

    const existing = postings.find(
      (posting) =>
        posting.eventId === event.eventId &&
        (posting.status === "OPEN" || posting.status === "DRAFT"),
    );

    if (existing) {
      return badRequest(
        `이 행사의 공고가 이미 있습니다. '${existing.title}'에서 포지션을 고쳐 주세요.`,
        "POSTING_EXISTS",
      );
    }

    const resolved = resolveTargets(event.eventId, body.positions);

    if ("error" in resolved) return resolved.error;

    const created: JobPosting = {
      postingId: nextId(postings, "postingId"),
      eventId: event.eventId,
      eventTitle: event.title,
      clientName: event.clientName,
      title: body.title,
      positions: resolved.positions,
      requiredCount: resolved.positions.reduce(
        (sum, position) => sum + position.requiredCount,
        0,
      ),
      applicantCount: 0,
      confirmedCount: 0,
      workDate: event.startDate,
      workDates: event.dates,
      venue: event.venue,
      status: "OPEN",
      content: body.content || buildPostingContent(event, resolved.positions),
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    postings.unshift(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  /**
   * 공고 수정. 행사는 바꿀 수 없다 — 지원이 걸린 채로 행사가 바뀌면
   * 지원자가 고른 포지션이 새 행사에 없다.
   *
   * **지원이 걸린 포지션은 뺄 수 없다.** 빼면 그 지원은 확정할 곳을 잃는다.
   * 먼저 지원을 반려하거나 지원자가 취소해야 한다.
   */
  http.put(
    `${BASE_URI}/admin/postings/:postingId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "recruit:write");

      if (denied) return denied;

      const posting = findPosting(Number(params.postingId));
      const body = (await request.json()) as PostingFormValues;

      if (!posting) return notFound("존재하지 않는 공고입니다.");

      const resolved = resolveTargets(posting.eventId, body.positions);

      if ("error" in resolved) return resolved.error;

      const keptIds = new Set(resolved.positions.map((item) => item.positionId));
      const orphan = applications.find(
        (application) =>
          application.postingId === posting.postingId &&
          ACTIVE_APPLICATION_STATUSES.includes(application.status) &&
          !keptIds.has(application.positionId),
      );

      if (orphan) {
        return badRequest(
          `'${orphan.positionName}' 포지션에 처리 중인 지원이 있어 뺄 수 없습니다. 지원을 먼저 처리해 주세요.`,
          "POSITION_HAS_APPLICATIONS",
        );
      }

      posting.title = body.title;
      posting.positions = resolved.positions;
      posting.content = body.content;

      recalculatePostingCounts();
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

      /* 다시 열 때도 "행사당 공고 하나"를 지킨다. (생성과 같은 규칙) */
      if (
        (status === "OPEN" || status === "DRAFT") &&
        postings.some(
          (item) =>
            item.postingId !== posting.postingId &&
            item.eventId === posting.eventId &&
            (item.status === "OPEN" || item.status === "DRAFT"),
        )
      ) {
        return badRequest(
          "이 행사에 이미 열려 있는 공고가 있습니다. 그 공고를 먼저 마감해 주세요.",
          "POSTING_EXISTS",
        );
      }

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
        application.positionName,
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
   *
   * **그 포지션이 서는 모든 날에** 배치한다. 예전에는 행사 첫날 하나만 만들어서,
   * 사흘짜리 공고에 지원해 확정된 사람이 이틀째부터 명단에서 사라졌다.
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

      /** 확정했지만 겹쳐서 배치하지 못한 날. 응답에 실어 담당자에게 알린다. */
      const skipped: string[] = [];

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

        const position = findPosition(event, application.positionId);

        if (!position) {
          return badRequest(
            "지원한 포지션이 행사에서 지워졌습니다. 지원을 반려하고 다른 포지션으로 안내해 주세요.",
            "POSITION_NOT_FOUND",
          );
        }

        /*
          지원 확정은 곧 **확정 배치**다. 그래서 배치와 같은 서류 검사를 받아야 한다.

          여기가 오래 뚫려 있었다. 행사 상세의 배치 모달은 서류 없는 사람을 막는데
          이 길로 들어오면 그대로 통과해서, 막으려던 일이 우회로 하나로 무의미해진다.
          포털에서 본인이 직접 지원하게 되면 이 길로 들어오는 사람이 훨씬 많아진다.
        */
        if (!canConfirmAssignment(staff)) {
          return badRequest(
            documentBlockMessage(staff.documentReviewState, staff.name),
            "DOCUMENT_REQUIRED",
          );
        }

        /*
          날마다 따로 본다. 사흘 중 하루가 다른 행사와 겹치면 그 하루만 빼고 넣는다.
          이미 이 행사에 넣어 둔 날도 건너뛴다 — 사람 × 날짜는 배치 한 건이다.
        */
        const dates = positionWorkDates(event, position.positionId);
        const conflicts: string[] = [];
        const targetDates = dates.filter((date) => {
          const conflict = findConflictEvent(staff.staffId, date, event.eventId);

          if (conflict) {
            conflicts.push(`${date.slice(5)} '${conflict.title}'`);
            return false;
          }

          return !event.assignments.some(
            (assignment) =>
              assignment.staffId === staff.staffId &&
              assignment.workDate === date &&
              assignment.status !== "CANCELED",
          );
        });

        if (targetDates.length === 0) {
          /* 발주가 하루도 없는 포지션은 겹침도 중복도 아니다. 설 자리 자체가 없다. */
          if (dates.length === 0) {
            return badRequest(
              `'${position.name}'은(는) 발주가 있는 근무일이 없습니다. 일별 발주를 먼저 넣어 주세요.`,
              "NO_POSITION_SLOT",
            );
          }

          return badRequest(
            conflicts.length > 0
              ? `${staff.name}님은 모든 근무일이 다른 행사와 겹칩니다. (${conflicts.join(", ")})`
              : `${staff.name}님은 이미 이 행사의 모든 근무일에 배치되어 있습니다.`,
            "ASSIGNMENT_CONFLICT",
          );
        }

        let maxId = events.reduce(
          (max, item) =>
            item.assignments.reduce(
              (innerMax, assignment) =>
                Math.max(innerMax, assignment.assignmentId),
              max,
            ),
          0,
        );

        targetDates.forEach((date) => {
          maxId += 1;

          event.assignments.push({
            assignmentId: maxId,
            eventId: event.eventId,
            eventTitle: event.title,
            workDate: date,
            staffId: staff.staffId,
            staffName: staff.name,
            staffPhone: staff.phoneNumber,
            staffProfileImageUrl: staff.profileImageUrl,
            staffGender: staff.gender,
            isEmployee: staff.employment === "EMPLOYEE",
            positionId: position.positionId,
            role: position.jobRole,
            status: "CONFIRMED",
            ...resolveAssignmentWage(event, date, position.positionId),
            attendance: "PENDING",
            lateMinutes: 0,
            isContractSigned: staff.employment === "EMPLOYEE",
            isPaid: false,
            createdAt: new Date().toISOString(),
          });
        });

        recalculateEventCounts(event);

        if (conflicts.length > 0) {
          skipped.push(
            `${conflicts.join(", ")}은(는) 다른 행사와 겹쳐 배치하지 않았습니다.`,
          );
        }

        /*
          확정된 날에 걸린 **나머지 지원을 지운다.**

          한 사람이 여러 자리에 걸어 둘 수 있게 하면서 정리를 담당자 손에 맡기면
          반드시 하나가 남는다. 남은 지원은 나중에 다른 담당자가 확정을 눌러
          같은 날 두 곳에 세우려다 막히거나(그때는 이유를 모른다), 본인 화면에
          '검토대기'로 계속 떠 있어 다른 일을 잡지 못하게 한다.

          **'지원취소'로 남기지 않고 지운다.** 본인이 무른 것과 시스템이 정리한 것이
          같은 낱말로 목록에 나란히 서면, 본인은 자기가 취소한 적 없는 건을 보고
          누가 내렸는지 묻게 된다. 애초에 낼 수 없었던 지원으로 두는 편이 맞다.

          날짜가 겹치지 않는 지원은 그대로 둔다. 사람 × 날짜가 배치 한 건일 뿐
          한 사람이 다른 날 다른 자리에 서는 것은 막을 이유가 없다.
        */
        const confirmedDates = new Set(targetDates);
        const dropped: string[] = [];

        /* 뒤에서부터 지운다. 앞에서 지우면 남은 항목의 자리가 밀린다. */
        for (let index = applications.length - 1; index >= 0; index -= 1) {
          const other = applications[index];

          if (
            other.applicationId === application.applicationId ||
            other.staffId !== staff.staffId ||
            other.status !== "PENDING"
          ) {
            continue;
          }

          const otherEvent = findEvent(other.eventId);
          const otherDates = otherEvent
            ? positionWorkDates(otherEvent, other.positionId)
            : [other.workDate];

          if (!otherDates.some((date) => confirmedDates.has(date))) continue;

          applications.splice(index, 1);
          dropped.unshift(`${other.eventTitle} '${other.positionName}'`);
        }

        if (dropped.length > 0) {
          skipped.push(
            `날짜가 겹치는 ${dropped.join(", ")} 지원은 함께 내렸습니다.`,
          );
        }
      }

      application.status = status;
      application.processedAt = new Date().toISOString();

      recalculatePostingCounts();
      await delay(MOCK_DELAY_MS);

      /*
        겹쳐서 못 넣은 날을 함께 내린다.

        사흘 중 하루만 겹치면 확정은 성공하고 이틀만 배치된다. 그 사실을
        말해 주지 않으면 담당자는 사흘 다 채운 줄 알고, 빠진 하루는
        현장에서 사람이 안 온 뒤에야 드러난다.
      */
      return HttpResponse.json({ ...application, skipped });
    },
  ),

  /** 문자로 받은 지원을 손으로 등록한다. (앱이 붙기 전까지의 창구) */
  http.post(`${BASE_URI}/admin/applications`, async ({ request }) => {
    const denied = requirePermission(request, "recruit:write");

    if (denied) return denied;

    const body = (await request.json()) as {
      postingId: number;
      positionId: number;
      applicantName: string;
      phoneNumber: string;
      note: string;
    };

    const posting = findPosting(body.postingId);

    if (!posting) return badRequest("공고를 먼저 선택해 주세요.");

    const position = posting.positions.find(
      (item) => item.positionId === Number(body.positionId),
    );

    if (!position) return badRequest("이 공고에서 모집하는 포지션을 골라 주세요.");

    // 이미 등록된 번호면 기존 인력으로 이어 붙인다. 신규면 서류부터 받아야 한다.
    const staff = staffList.find(
      (item) => item.phoneNumber === body.phoneNumber,
    );

    /* 문자로 받은 지원도 같은 규칙이다 — 다른 자리는 되고, **같은 자리만** 막는다. */
    const duplicated = staff
      ? findActivePositionApplication(
          staff.staffId,
          posting.eventId,
          position.positionId,
        )
      : undefined;

    if (duplicated) {
      return badRequest(
        `${staff?.name}님은 이미 '${duplicated.positionName}'에 지원했습니다.`,
        "DUPLICATED_APPLICATION",
      );
    }

    const created: Application = {
      applicationId: nextId(applications, "applicationId"),
      postingId: posting.postingId,
      postingTitle: posting.title,
      eventId: posting.eventId,
      eventTitle: posting.eventTitle,
      workDate: posting.workDate,
      positionId: position.positionId,
      positionName: position.name,
      role: position.jobRole,
      staffId: staff?.staffId,
      applicantName: body.applicantName,
      phoneNumber: body.phoneNumber,
      isExistingStaff: Boolean(staff),
      status: "PENDING",
      note: body.note,
      conflictEventTitle: staff
        ? findConflictEvent(staff.staffId, posting.workDate, posting.eventId)
            ?.title
        : undefined,
      appliedAt: new Date().toISOString(),
    };

    applications.unshift(created);
    recalculatePostingCounts();
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),
];
