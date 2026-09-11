import { HttpResponse, delay, http } from "msw";
import type {
  Application,
  ApplicationStatus,
  JobPosting,
  PostingFormValues,
  PostingLine,
  PostingStatus,
} from "@/type/recruit";
import { ACTIVE_APPLICATION_STATUSES, formatDateList } from "@/type/recruit";
import { lineKeyOf } from "@/schema/recruit.schema";
import type { JobRole } from "@/type/staff";
import { canConfirmAssignment, documentBlockMessage } from "@/type/staff";
import { findPosition, toDateKey } from "@/type/event";
import {
  findConflictEvent,
  findEvent,
  planAssignmentDates,
  positionWorkDates,
  pushConfirmedAssignments,
} from "../db/event";
import {
  applications,
  buildPostingContent,
  dropOverlappingApplications,
  findActiveLineApplication,
  findApplication,
  findPosting,
  nextTargetId,
  postings,
  recalculatePostingCounts,
  toPostingLine,
} from "../db/recruit";
import { withdrawOverlappingOffers } from "../db/offer";
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
 * 요청의 모집 줄을 행사 포지션으로 채운다. 행사에 없는 포지션은 거부한다.
 *
 * 화면이 옛 목록을 들고 있다가 이미 지워진 포지션으로 공고를 만드는 일이 실제로 난다.
 * 그대로 받으면 지원은 되는데 확정할 때 배치를 만들 곳이 없다.
 *
 * **줄 번호는 서버가 붙인다.** 수정할 때 이미 있던 줄은 번호를 그대로 두고,
 * 새 줄만 다음 번호를 받는다. 지원이 줄 번호를 들고 있어서, 번호가 바뀌면
 * 걸려 있던 지원이 엉뚱한 줄로 옮겨 간다.
 */
const resolveLines = (
  eventId: number,
  inputs: PostingFormValues["lines"],
  previous?: JobPosting,
): { lines: PostingLine[] } | { error: Response } => {
  const event = findEvent(eventId);

  if (!event) return { error: badRequest("행사를 먼저 선택해 주세요.") };

  if (inputs.length === 0) {
    return { error: badRequest("모집할 포지션을 한 개 이상 골라 주세요.") };
  }

  const keptIds = new Set(previous?.lines.map((line) => line.targetId) ?? []);
  let next = previous ? nextTargetId(previous) : 1;
  const lines: PostingLine[] = [];

  for (const input of inputs) {
    const targetId =
      input.targetId && keptIds.has(Number(input.targetId))
        ? Number(input.targetId)
        : next++;

    if (Number(input.requiredCount) < 1) {
      return { error: badRequest("모집 인원을 1명 이상 입력해 주세요.") };
    }

    /* 스키마와 같은 규칙이다. 주소를 직접 부르면 폼의 검증은 없다. */
    if (input.participation === "FULL" && input.dates) {
      return { error: badRequest("전일 모집에는 날짜를 따로 고르지 않습니다.") };
    }

    if (input.dates && input.dates.length === 0) {
      return { error: badRequest("모집할 날을 하루 이상 골라 주세요.") };
    }

    const line = toPostingLine(event, {
      targetId,
      positionId: Number(input.positionId),
      requiredCount: Number(input.requiredCount),
      participation: input.participation,
      dates: input.dates ? [...input.dates].sort() : undefined,
      isUrgent: Boolean(input.isUrgent),
    });

    if (!line) {
      return {
        error: badRequest(
          "행사에 없는 포지션이 섞여 있습니다. 화면을 새로 고친 뒤 다시 골라 주세요.",
        ),
      };
    }

    /* 발주가 없는 날만 골랐으면 설 자리가 없다. 지원을 받아도 확정할 곳이 없다. */
    if (line.workDates.length === 0) {
      return {
        error: badRequest(`'${line.name}'은(는) 고른 날에 발주가 없습니다.`),
      };
    }

    lines.push(line);
  }

  const fullIds = lines
    .filter((line) => line.participation === "FULL")
    .map((line) => line.positionId);

  if (new Set(fullIds).size !== fullIds.length) {
    return {
      error: badRequest("한 포지션에 전일 모집 줄은 하나만 둘 수 있습니다."),
    };
  }

  /* 폼 스키마와 같은 열쇠로 본다. 주소를 직접 부르면 폼의 검증은 없다. */
  const keys = lines.map((line) => lineKeyOf(line));

  if (new Set(keys).size !== keys.length) {
    return {
      error: badRequest(
        "같은 조건의 모집 줄이 두 번 있습니다. 한 줄로 합쳐 인원을 고쳐 주세요.",
      ),
    };
  }

  return { lines };
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
      /* 직무 조건은 "그 직무로 모집하는 줄이 하나라도 있는가"로 본다. */
      if (role && !posting.lines.some((line) => line.jobRole === role)) {
        return false;
      }

      return matchesKeyword(
        keyword,
        posting.title,
        posting.eventTitle,
        posting.clientName,
        ...posting.lines.map((line) => line.name),
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
   * 같은 행사의 공고가 둘이면 지원자 눈에는 같은 행사가 두 번 보인다.
   * 급구도 새 공고가 아니라 기존 공고에 줄을 더한다. 마감(`CLOSED` · `FILLED`)된
   * 공고는 다시 열 수 있으니 세지 않는다.
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
        `이 행사의 공고가 이미 있습니다. '${existing.title}'에서 모집 줄을 고쳐 주세요.`,
        "POSTING_EXISTS",
      );
    }

    const resolved = resolveLines(event.eventId, body.lines);

    if ("error" in resolved) return resolved.error;

    const created: JobPosting = {
      postingId: nextId(postings, "postingId"),
      eventId: event.eventId,
      eventTitle: event.title,
      clientName: event.clientName,
      title: body.title,
      lines: resolved.lines,
      requiredCount: resolved.lines.reduce((sum, line) => sum + line.requiredCount, 0),
      applicantCount: 0,
      confirmedCount: 0,
      workDate: event.startDate,
      workDates: event.dates,
      venue: event.venue,
      status: "OPEN",
      content: body.content || buildPostingContent(event, resolved.lines),
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
   * **지원이 걸린 줄은 뺄 수 없다.** 빼면 그 지원은 확정할 곳을 잃는다.
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

      const resolved = resolveLines(posting.eventId, body.lines, posting);

      if ("error" in resolved) return resolved.error;

      const keptIds = new Set(resolved.lines.map((line) => line.targetId));
      const orphan = applications.find(
        (application) =>
          application.postingId === posting.postingId &&
          ACTIVE_APPLICATION_STATUSES.includes(application.status) &&
          !keptIds.has(application.targetId),
      );

      if (orphan) {
        return badRequest(
          `'${orphan.positionName}' 줄에 처리 중인 지원이 있어 뺄 수 없습니다. 지원을 먼저 처리해 주세요.`,
          "POSITION_HAS_APPLICATIONS",
        );
      }

      posting.title = body.title;
      posting.lines = resolved.lines;
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
   * 배치하는 날은 **지원이 신청한 날**이다. (발주가 남아 있고 지나지 않은 날만)
   * - 전일 지원: 하루라도 다른 행사와 겹치면 **확정 자체를 막는다.** 업체가 원한 것은
   *   사흘을 끝까지 서는 사람이다. 담당자가 알고도 넣겠다면 `allowPartial`로 강행한다.
   * - 분할 지원: 담당자가 신청한 날 중 **일부만** 확정할 수 있다(`dates`).
   *   겹친 날은 빼고 넣고, 뺀 날을 응답으로 알린다.
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
      const { status, dates, allowPartial } = (await request.json()) as {
        status: ApplicationStatus;
        dates?: string[];
        allowPartial?: boolean;
      };

      const denied =
        requirePermission(request, "recruit:write") ??
        (status === "ACCEPTED"
          ? requirePermission(request, "assignment:write")
          : null);

      if (denied) return denied;

      const application = findApplication(Number(params.applicationId));

      if (!application) return notFound("존재하지 않는 지원 건입니다.");

      /** 확정했지만 넣지 못한 날 · 함께 정리한 지원. 응답에 실어 담당자에게 알린다. */
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
          신청한 날 중 **지금도 설 수 있는 날.** 지원한 뒤 담당자가 일별 발주를
          0으로 내렸거나 날이 지났으면 그 날은 뺀다. 부르지 않은 자리에 사람을 세우지 않는다.
        */
        const today = toDateKey(new Date());
        const positionDates = positionWorkDates(event, position.positionId);
        const offered = application.requestedDates.filter(
          (date) => positionDates.includes(date) && date >= today,
        );

        if (offered.length === 0) {
          return badRequest(
            `'${position.name}'에 신청한 날이 모두 지났거나 발주가 없습니다.`,
            "NO_POSITION_SLOT",
          );
        }

        /* 일부만 확정하는 것은 분할 지원만이다. 전일 지원은 신청한 날 전부다. */
        let wanted = offered;

        if (application.participation === "SPLIT" && dates && dates.length > 0) {
          if (dates.some((date) => !offered.includes(date))) {
            return badRequest(
              "신청하지 않은 날은 확정할 수 없습니다. 다른 날이 필요하면 직접 배치해 주세요.",
              "DATE_NOT_REQUESTED",
            );
          }

          wanted = offered.filter((date) => dates.includes(date));
        }

        const plan = planAssignmentDates(event, staff.staffId, wanted);
        const conflictText = plan.conflicts
          .map((item) => `${item.date.slice(5).replace("-", ".")} '${item.title}'`)
          .join(", ");

        if (
          application.participation === "FULL" &&
          plan.conflicts.length > 0 &&
          !allowPartial
        ) {
          return badRequest(
            `${staff.name}님은 전일 모집에 지원했는데 ${conflictText}와(과) 겹칩니다. 되는 날만 넣으려면 '되는 날만 배치'를 골라 주세요.`,
            "FULL_SCHEDULE_CONFLICT",
          );
        }

        if (plan.available.length === 0 && plan.already.length === 0) {
          return badRequest(
            `${staff.name}님은 고른 날이 모두 다른 행사와 겹칩니다. (${conflictText})`,
            "ASSIGNMENT_CONFLICT",
          );
        }

        pushConfirmedAssignments(event, staff, position.positionId, plan.available);

        /* 이미 들어가 있던 날도 이 사람이 서는 날이다. 확정한 날에 함께 적는다. */
        application.confirmedDates = [...plan.available, ...plan.already].sort();

        if (plan.conflicts.length > 0) {
          skipped.push(`${conflictText}은(는) 다른 행사와 겹쳐 배치하지 않았습니다.`);
        }

        /*
          확정된 날에 걸린 **나머지 지원을 지운다.**
          날짜가 겹치지 않는 지원은 그대로 둔다. 사람 × 날짜가 배치 한 건일 뿐
          한 사람이 다른 날 다른 자리에 서는 것은 막을 이유가 없다.
        */
        const applicationCleanup = dropOverlappingApplications(
          staff.staffId,
          application.confirmedDates,
          application.applicationId,
        );

        if (applicationCleanup.dropped.length > 0) {
          skipped.push(
            `날짜가 겹치는 ${applicationCleanup.dropped.join(", ")} 지원은 함께 내렸습니다.`,
          );
        }

        if (applicationCleanup.trimmed.length > 0) {
          skipped.push(
            `${applicationCleanup.trimmed.join(", ")} 지원은 겹친 날만 뺐습니다.`,
          );
        }

        /* 같은 날에 걸린 대기 제안도 정리한다. 남겨 두면 본인이 수락하려다 겹침으로 막힌다. */
        const offerCleanup = withdrawOverlappingOffers(
          staff.staffId,
          application.confirmedDates,
        );

        if (offerCleanup.withdrawn.length > 0) {
          skipped.push(
            `날짜가 겹치는 ${offerCleanup.withdrawn.join(", ")} 제안은 철회했습니다.`,
          );
        }

        if (offerCleanup.trimmed.length > 0) {
          skipped.push(`${offerCleanup.trimmed.join(", ")} 제안은 겹친 날만 뺐습니다.`);
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
      targetId: number;
      dates?: string[];
      applicantName: string;
      phoneNumber: string;
      note: string;
    };

    const posting = findPosting(body.postingId);

    if (!posting) return badRequest("공고를 먼저 선택해 주세요.");

    const line = posting.lines.find(
      (item) => item.targetId === Number(body.targetId),
    );

    if (!line) return badRequest("이 공고에서 모집하는 포지션을 골라 주세요.");

    const today = toDateKey(new Date());
    const openDates = line.workDates.filter((date) => date >= today);
    /* 전일 줄은 날짜를 고르지 않는다. 분할 줄은 문자로 받은 날을 담당자가 옮겨 적는다. */
    const requestedDates =
      line.participation === "FULL"
        ? openDates
        : openDates.filter((date) => (body.dates ?? []).includes(date));

    if (requestedDates.length === 0) {
      return badRequest(
        line.participation === "SPLIT"
          ? "나올 수 있는 날을 하루 이상 골라 주세요."
          : "이 줄에는 남은 근무일이 없습니다.",
        "DATES_REQUIRED",
      );
    }

    // 이미 등록된 번호면 기존 인력으로 이어 붙인다. 신규면 서류부터 받아야 한다.
    const staff = staffList.find(
      (item) => item.phoneNumber === body.phoneNumber,
    );

    /* 문자로 받은 지원도 같은 규칙이다 — 다른 줄은 되고, **같은 줄만** 막는다. */
    const duplicated = staff
      ? findActiveLineApplication(staff.staffId, posting.eventId, line.targetId)
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
      workDate: requestedDates[0],
      targetId: line.targetId,
      positionId: line.positionId,
      positionName: line.name,
      role: line.jobRole,
      participation: line.participation,
      requestedDates,
      staffId: staff?.staffId,
      applicantName: body.applicantName,
      phoneNumber: body.phoneNumber,
      isExistingStaff: Boolean(staff),
      status: "PENDING",
      note: body.note,
      conflictEventTitle: staff
        ? requestedDates
            .map((date) => findConflictEvent(staff.staffId, date, posting.eventId))
            .find(Boolean)?.title
        : undefined,
      appliedAt: new Date().toISOString(),
    };

    applications.unshift(created);
    recalculatePostingCounts();
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),
];

/** 확정 모달이 보여 줄 날짜 설명. (다른 핸들러가 쓸 일이 생기면 `type/`으로 옮긴다) */
export const describeRequestedDates = (application: Application): string =>
  formatDateList(application.requestedDates);
