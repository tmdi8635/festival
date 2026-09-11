import { HttpResponse, delay, http } from "msw";
import type { EventDetail } from "@/type/event";
import {
  calculateBasePay,
  calculateScheduledWorkHours,
  findPosition,
  toDateKey,
} from "@/type/event";
import type { MyOffer } from "@/type/my";
import type { OfferState, WorkOffer } from "@/type/offer";
import { resolveOfferRespondBy, resolveOfferState } from "@/type/offer";
import type { PostingParticipation } from "@/type/recruit";
import type { StaffDetail } from "@/type/staff";
import { canConfirmAssignment } from "@/type/staff";
import { formatDate } from "@/lib/dayjs";
import {
  findEvent,
  planAssignmentDates,
  positionWorkDates,
  pushConfirmedAssignments,
} from "../db/event";
import {
  findOffer,
  firstWorkStartOf,
  nextOfferId,
  offers,
  remainingSlotOf,
  toOfferView,
  withdrawOverlappingOffers,
} from "../db/offer";
import { dropOverlappingApplications, recalculatePostingCounts } from "../db/recruit";
import { findStaff } from "../db/staff";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  badRequest,
  findRequester,
  notFound,
  requirePermission,
  requireStaff,
} from "../utils";

/**
 * 근무 제안 목업.
 *
 * 관리자 쪽(`/admin/*`)은 권한 키로, 포털 쪽(`/my/*`)은 "본인 것인가"로 가른다.
 * 한 파일에 두는 이유는 수락 규칙이 양쪽에서 **같은 함수**를 봐야 하기 때문이다 —
 * 관리자 목록이 "수락 가능"이라 적고 포털이 막으면 둘 중 하나는 거짓말을 한다.
 */

/**
 * 제안한 날 중 **지금 수락할 수 있는 날.**
 *
 * 지나지 않았고, 발주가 남아 있고, 다른 행사와 겹치지 않고, 그날 자리가 남은 날이다.
 * 제안은 자리를 잡지 않으므로 보낸 뒤에 자리가 찰 수 있다. 수락할 때마다 다시 본다.
 */
const offerDateState = (event: EventDetail, offer: WorkOffer, staffId: number) => {
  const today = toDateKey(new Date());
  const positionDates = positionWorkDates(event, offer.positionId);
  const open = offer.dates.filter(
    (date) => date >= today && positionDates.includes(date),
  );
  const plan = planAssignmentDates(event, staffId, open);
  const filled = plan.available.filter(
    (date) => remainingSlotOf(event, offer.positionId, date) <= 0,
  );
  const availableDates = plan.available.filter((date) => !filled.includes(date));

  return { open, plan, filled, availableDates };
};

/**
 * 수락할 수 없는 이유. 없으면 `undefined`다.
 *
 * 포털 카드의 버튼과 수락 요청이 **같은 함수**로 판정한다. `isFilled`는 자리가 차서
 * 막힌 경우다 — 전일 제안이면 그 자리에서 제안을 닫는다(다시 열릴 일이 없다).
 */
const resolveOfferBlock = (
  event: EventDetail,
  offer: WorkOffer,
  staff: StaffDetail,
): { message: string; isFilled?: boolean } | undefined => {
  if (!canConfirmAssignment(staff)) {
    return { message: "서류가 승인되어야 수락할 수 있어요. 신분증 · 통장사본을 먼저 확인해 주세요." };
  }

  const { open, plan, filled, availableDates } = offerDateState(event, offer, staff.staffId);

  if (open.length === 0) return { message: "근무일이 모두 지났어요." };

  if (offer.participation === "FULL") {
    if (plan.conflicts.length > 0) {
      return {
        message: `${formatDate(plan.conflicts[0].date)} '${plan.conflicts[0].title}'와 겹쳐요. 모든 날 나와야 하는 제안이라 수락할 수 없어요.`,
      };
    }

    if (filled.length > 0) return { message: "자리가 이미 찼어요.", isFilled: true };

    return undefined;
  }

  if (availableDates.length === 0) {
    return plan.conflicts.length > 0 && filled.length === 0
      ? { message: "모든 날이 다른 근무와 겹쳐요." }
      : { message: "자리가 이미 찼어요.", isFilled: true };
  }

  return undefined;
};

/** 제안 한 건을 포털 자료로 옮긴다. 근무 카드와 같은 만큼 조건을 담는다. */
const toMyOffer = (offer: WorkOffer, staff: StaffDetail): MyOffer => {
  const event = findEvent(offer.eventId);
  const position = event ? findPosition(event, offer.positionId) : undefined;
  const state = resolveOfferState(offer);
  const isOpen = Boolean(event) && state === "PENDING";
  const block = isOpen && event ? resolveOfferBlock(event, offer, staff) : undefined;
  const availableDates =
    isOpen && event ? offerDateState(event, offer, staff.staffId).availableDates : [];
  /* 금액은 공고 상세와 같은 계산이다. 둘이 다르면 제안받은 금액이 바뀐 줄 안다. */
  const workHours = position ? calculateScheduledWorkHours(position) : 0;
  const dailyPay = position
    ? calculateBasePay(position.wageType, position.wage, workHours)
    : 0;

  return {
    offerId: offer.offerId,
    eventId: offer.eventId,
    eventTitle: offer.eventTitle,
    clientName: event?.clientName ?? "",
    positionId: offer.positionId,
    positionName: position?.name ?? offer.positionName,
    role: position?.jobRole ?? "STAFF",
    dates: offer.dates,
    availableDates,
    participation: offer.participation,
    message: offer.message,
    state,
    respondBy: offer.respondBy,
    acceptedDates: offer.acceptedDates,
    declineReason: offer.declineReason,
    closedReason: offer.closedReason,
    venue: event?.venue ?? "",
    address: event?.address ?? "",
    startTime: position?.startTime ?? event?.startTime ?? "",
    endTime: position?.endTime ?? event?.endTime ?? "",
    endDayOffset: position?.endDayOffset ?? event?.endDayOffset ?? 0,
    breakMinutes: position?.breakMinutes ?? event?.breakMinutes ?? 0,
    wageType: position?.wageType ?? "HOURLY",
    wage: position?.wage ?? 0,
    dailyPay,
    totalPay: dailyPay * offer.dates.length,
    meetingPoint: event?.meetingPoint ?? "",
    description: event?.description ?? "",
    dressCode: event?.dressCode ?? "",
    belongings: event?.belongings ?? "",
    managerName: event?.managerName ?? "",
    managerPhone: event?.managerPhone ?? "",
    createdAt: offer.createdAt,
    respondedAt: offer.respondedAt,
    canAccept: isOpen && !block,
    blockReason: block?.message,
  };
};

/** 포털에 닫힌 제안을 남기는 기간 */
const CLOSED_OFFER_KEEP_DAYS = 14;

/** 남의 제안은 **없는 것으로 답한다.** (404이지 403이 아니다 — 번호를 훑는 문이 된다) */
const findMyOffer = (staffId: number, offerId: number) => {
  const offer = findOffer(offerId);

  return offer?.staffId === staffId ? offer : undefined;
};

export const offerHandlers = [
  /* ------------------------------ 관리자 ------------------------------ */

  /** 보낸 제안 목록. 행사 상세의 '보낸 제안' 탭이 쓴다. */
  http.get(`${BASE_URI}/admin/offers`, async ({ request }) => {
    const denied = requirePermission(request, "assignment:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const eventId = Number(url.searchParams.get("eventId")) || 0;
    const state = url.searchParams.get("state") as OfferState | null;

    const items = offers
      .map(toOfferView)
      .filter((offer) => (eventId ? offer.eventId === eventId : true))
      .filter((offer) => (state ? offer.state === state : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items });
  }),

  /**
   * 제안 보내기. 여러 명에게 한 번에 보낸다.
   *
   * 배치와 같은 권한이다 — 수락되는 순간 확정 배치가 만들어지므로, 배치를 못 하는 사람이
   * 제안으로 돌아서 배치를 만들 수 있으면 권한이 뚫린다.
   *
   * 보낼 수 없는 사람은 **건너뛰고 이유를 돌려준다.** (서류 미승인 · 이미 대기 중 · 날짜 불가)
   * 서류가 없는 사람에게 보내면 본인은 수락을 눌러도 막히고, 그걸 모르는 담당자는 기다린다.
   */
  http.post(
    `${BASE_URI}/admin/events/:eventId/offers`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "assignment:write");

      if (denied) return denied;

      const event = findEvent(Number(params.eventId));
      const body = (await request.json()) as {
        staffIds: number[];
        positionId: number;
        dates: string[];
        participation: PostingParticipation;
        message?: string;
      };

      if (!event) return notFound("존재하지 않는 행사입니다.");

      const position = findPosition(event, Number(body.positionId));

      if (!position) return badRequest("제안할 포지션을 골라 주세요.", "POSITION_REQUIRED");

      const today = toDateKey(new Date());
      const positionDates = positionWorkDates(event, position.positionId);
      const dates = [...new Set(body.dates ?? [])]
        .filter((date) => positionDates.includes(date) && date >= today)
        .sort();

      if (dates.length === 0) {
        return badRequest(
          "제안할 날을 하루 이상 골라 주세요. (발주가 있고 지나지 않은 날만 됩니다)",
          "DATES_REQUIRED",
        );
      }

      /* 하루짜리는 전일과 분할이 같은 말이다. */
      const participation: PostingParticipation =
        dates.length === 1 ? "FULL" : body.participation === "SPLIT" ? "SPLIT" : "FULL";
      const admin = findRequester(request);
      const respondBy = resolveOfferRespondBy(
        new Date(),
        firstWorkStartOf(event, position.positionId, dates[0]),
      );

      const skipped: string[] = [];
      const created: WorkOffer[] = [];

      body.staffIds.forEach((staffId) => {
        const staff = findStaff(staffId);

        if (!staff || staff.status === "BLACKLIST") {
          skipped.push(`${staff?.name ?? `#${staffId}`}(제안할 수 없는 인력)`);
          return;
        }

        if (!canConfirmAssignment(staff)) {
          skipped.push(`${staff.name}(서류 미승인)`);
          return;
        }

        const waiting = offers.find(
          (offer) =>
            offer.staffId === staffId &&
            offer.eventId === event.eventId &&
            resolveOfferState(offer) === "PENDING" &&
            offer.dates.some((date) => dates.includes(date)),
        );

        if (waiting) {
          skipped.push(`${staff.name}(이미 응답 대기 중인 제안)`);
          return;
        }

        const plan = planAssignmentDates(event, staffId, dates);
        const blockedCount = plan.conflicts.length + plan.already.length;

        /* 전일 제안은 전부 나올 수 있어야 보낸다. 받고 나서 수락이 막히면 보낸 뜻이 없다. */
        if (participation === "FULL" && blockedCount > 0) {
          skipped.push(`${staff.name}(${dates.length}일 중 ${blockedCount}일 불가)`);
          return;
        }

        if (plan.available.length === 0) {
          skipped.push(`${staff.name}(모든 날 불가)`);
          return;
        }

        const offer: WorkOffer = {
          offerId: nextOfferId(),
          eventId: event.eventId,
          eventTitle: event.title,
          positionId: position.positionId,
          positionName: position.name,
          staffId: staff.staffId,
          staffName: staff.name,
          staffPhone: staff.phoneNumber,
          /* 분할 제안은 되는 날만 보낸다. 안 되는 날이 칩에 잠겨 있으면 왜 보냈는지 묻는다. */
          dates: participation === "FULL" ? dates : plan.available,
          participation,
          message: (body.message ?? "").trim(),
          status: "PENDING",
          respondBy,
          createdByAdminId: admin?.employeeId ?? 0,
          createdByName: admin?.name ?? "",
          createdAt: new Date().toISOString(),
        };

        offers.unshift(offer);
        created.push(offer);
      });

      await delay(MOCK_DELAY_MS);

      if (created.length === 0) {
        return badRequest(
          skipped.length > 0
            ? `보낼 수 있는 사람이 없습니다: ${skipped.join(", ")}`
            : "제안할 대상이 없습니다.",
          "OFFER_SKIPPED",
        );
      }

      return HttpResponse.json(
        { created: created.length, skipped, items: created.map(toOfferView) },
        { status: 201 },
      );
    },
  ),

  /** 철회. 응답 대기일 때만 된다 — 이미 수락된 제안은 배치에서 뺀다. */
  http.patch(
    `${BASE_URI}/admin/offers/:offerId/withdraw`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "assignment:write");

      if (denied) return denied;

      const offer = findOffer(Number(params.offerId));

      if (!offer) return notFound("존재하지 않는 제안입니다.");

      if (resolveOfferState(offer) !== "PENDING") {
        return badRequest(
          "응답 대기 중인 제안만 철회할 수 있습니다. 수락된 제안은 행사 배치에서 빼 주세요.",
        );
      }

      offer.status = "WITHDRAWN";
      offer.closedReason = "담당자가 제안을 거두었습니다.";
      offer.respondedAt = new Date().toISOString();

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toOfferView(offer));
    },
  ),

  /* ------------------------------ 포털 ------------------------------ */

  /**
   * 받은 제안. 응답 대기가 앞, 그중에서도 **기한이 가까운 것**이 먼저다.
   *
   * 닫힌 제안도 **최근 것은** 남긴다 — 왜 사라졌는지(자리 참 · 다른 근무 확정 · 기한 지남)는
   * 본인이 봐야 한다. 다만 오래된 거절 · 철회까지 쌓이면 응답 대기가 묻혀서 14일만 둔다.
   */
  http.get(`${BASE_URI}/my/offers`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const closedCutoff = Date.now() - CLOSED_OFFER_KEEP_DAYS * 24 * 60 * 60 * 1000;

    const items = offers
      .filter((offer) => offer.staffId === staff.staffId)
      .filter(
        (offer) =>
          resolveOfferState(offer) === "PENDING" ||
          new Date(offer.respondedAt ?? offer.respondBy).getTime() >= closedCutoff,
      )
      .map((offer) => toMyOffer(offer, staff))
      .sort((a, b) => {
        const aOpen = a.state === "PENDING";
        const bOpen = b.state === "PENDING";

        if (aOpen !== bOpen) return aOpen ? -1 : 1;

        return aOpen
          ? a.respondBy.localeCompare(b.respondBy)
          : (b.respondedAt ?? b.createdAt).localeCompare(a.respondedAt ?? a.createdAt);
      });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items });
  }),

  /**
   * 수락. **그 자리에서 확정 배치가 만들어진다.** (지원 확정과 같은 함수)
   *
   * 전일 제안은 날짜를 고르지 않고 전부다. 분할 제안은 본인이 고른 날인데,
   * 잠긴 날(겹침 · 자리 참)이 섞여 있으면 받지 않는다 — 화면이 잠근 날을 주소로 직접 보낸 경우다.
   * 확정된 날에 걸린 다른 대기 지원 · 제안은 함께 정리한다.
   */
  http.post(
    `${BASE_URI}/my/offers/:offerId/accept`,
    async ({ params, request }) => {
      const { staff, response } = requireStaff(request);

      if (!staff) return response;

      const offer = findMyOffer(staff.staffId, Number(params.offerId));

      if (!offer) return notFound("존재하지 않는 제안입니다.");

      const state = resolveOfferState(offer);

      if (state !== "PENDING") {
        return badRequest(
          state === "EXPIRED"
            ? "응답 기한이 지났어요. 담당자에게 직접 연락해 주세요."
            : "이미 끝난 제안이에요.",
          "OFFER_CLOSED",
        );
      }

      const event = findEvent(offer.eventId);

      if (!event || !findPosition(event, offer.positionId)) {
        return badRequest(
          "행사가 바뀌어 수락할 수 없어요. 담당자에게 문의해 주세요.",
          "OFFER_CLOSED",
        );
      }

      const block = resolveOfferBlock(event, offer, staff);

      if (block) {
        /* 전일 제안인데 자리가 찼으면 다시 열릴 일이 없다. 그 자리에서 닫는다. */
        if (block.isFilled && offer.participation === "FULL") {
          offer.status = "WITHDRAWN";
          offer.closedReason = "자리가 먼저 찼습니다.";
          offer.respondedAt = new Date().toISOString();
        }

        return badRequest(block.message, "OFFER_BLOCKED");
      }

      const { availableDates } = offerDateState(event, offer, staff.staffId);
      const body = (await request.json().catch(() => ({}))) as { dates?: string[] };
      let dates = availableDates;

      if (offer.participation === "SPLIT") {
        const picked = [...new Set(body.dates ?? [])].sort();

        if (picked.length === 0) {
          return badRequest("나올 날을 하루 이상 골라 주세요.", "DATES_REQUIRED");
        }

        if (picked.some((date) => !availableDates.includes(date))) {
          return badRequest(
            "고를 수 없는 날이 섞여 있어요. 화면을 새로 고친 뒤 다시 골라 주세요.",
            "DATES_UNAVAILABLE",
          );
        }

        dates = picked;
      }

      pushConfirmedAssignments(event, staff, offer.positionId, dates);

      offer.status = "ACCEPTED";
      offer.acceptedDates = dates;
      offer.respondedAt = new Date().toISOString();

      dropOverlappingApplications(staff.staffId, dates);
      withdrawOverlappingOffers(staff.staffId, dates, offer.offerId);
      recalculatePostingCounts();

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toMyOffer(offer, staff));
    },
  ),

  /** 거절. 사유는 선택이다 — 적으라고 하면 거절 대신 무응답을 고른다. */
  http.post(
    `${BASE_URI}/my/offers/:offerId/decline`,
    async ({ params, request }) => {
      const { staff, response } = requireStaff(request);

      if (!staff) return response;

      const offer = findMyOffer(staff.staffId, Number(params.offerId));

      if (!offer) return notFound("존재하지 않는 제안입니다.");

      if (resolveOfferState(offer) !== "PENDING") {
        return badRequest("이미 끝난 제안이에요.", "OFFER_CLOSED");
      }

      const body = (await request.json().catch(() => ({}))) as { reason?: string };

      offer.status = "DECLINED";
      offer.declineReason = (body.reason ?? "").trim() || undefined;
      offer.respondedAt = new Date().toISOString();

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toMyOffer(offer, staff));
    },
  ),
];
