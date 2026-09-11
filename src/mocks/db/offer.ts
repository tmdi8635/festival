import type { EventDetail, EventPosition } from "@/type/event";
import { resolvePositionSchedule, toCheckDateTime, toDateKey } from "@/type/event";
import type { WorkOffer, WorkOfferView } from "@/type/offer";
import { resolveOfferRespondBy, resolveOfferState } from "@/type/offer";
import type { PostingParticipation } from "@/type/recruit";
import { DEMO_STAFF_ID } from "../demo";
import { dateFromToday, toIsoDateTime } from "../utils";
import {
  NIGHT_MARKET_EVENT_TITLE,
  events,
  findConflictEvent,
  positionWorkDates,
} from "./event";
import { assignableStaff, findStaff, staffList } from "./staff";

type Staff = (typeof staffList)[number];

/** 이 포지션의 그날 예정 시작. 응답 기한을 첫 근무에 맞춰 자르는 데 쓴다. */
export const firstWorkStartOf = (
  event: EventDetail,
  positionId: number,
  date: string,
): Date => {
  const startAt = toCheckDateTime(
    date,
    resolvePositionSchedule(event, positionId).startTime,
  );

  /* 시각이 비어 있는 행사는 그날 0시로 본다. 기한이 첫 근무를 넘지 않게만 하면 된다. */
  return new Date(startAt ?? `${date}T00:00:00`);
};

/** 그날 이 포지션에 **남은 자리.** 제안은 자리를 잡지 않으므로 수락할 때 다시 본다. */
export const remainingSlotOf = (
  event: EventDetail,
  positionId: number,
  date: string,
): number => {
  const slot = event.days
    .find((day) => day.date === date)
    ?.roles.find((item) => item.positionId === positionId);

  return slot ? slot.requiredCount - slot.assignedCount : 0;
};

/** 제안할 수 있는 날 — 지나지 않았고, 다른 행사 · 이 행사에 이미 서 있지 않다. */
const isFreeDate = (event: EventDetail, staffId: number, date: string): boolean =>
  date > toDateKey(new Date()) &&
  !findConflictEvent(staffId, date, event.eventId) &&
  !event.assignments.some(
    (assignment) =>
      assignment.staffId === staffId &&
      assignment.workDate === date &&
      assignment.status !== "CANCELED",
  );

let offerSequence = 0;

export const offers: WorkOffer[] = [];

const pushSeedOffer = (
  event: EventDetail,
  position: EventPosition,
  staff: Staff,
  dates: string[],
  participation: PostingParticipation,
  overrides: Partial<WorkOffer> = {},
) => {
  offerSequence += 1;

  offers.push({
    offerId: offerSequence,
    eventId: event.eventId,
    eventTitle: event.title,
    positionId: position.positionId,
    positionName: position.name,
    staffId: staff.staffId,
    staffName: staff.name,
    staffPhone: staff.phoneNumber,
    dates,
    participation,
    message: "",
    status: "PENDING",
    respondBy: resolveOfferRespondBy(
      new Date(),
      firstWorkStartOf(event, position.positionId, dates[0]),
    ),
    createdByAdminId: 1,
    createdByName: "김도윤",
    createdAt: toIsoDateTime(dateFromToday(0), "09:00"),
    ...overrides,
  });
};

/* --------------------------- 데모 보정 --------------------------- */

/**
 * 포털 기본 접속자에게 **응답 대기 제안 두 건**을 고정한다. (`mocks/demo.ts`)
 *
 * 하나는 전일(전부 수락만), 하나는 분할(날짜 골라 수락)이다. 둘 다 없으면 일정의
 * '제안' 탭은 늘 비어 있고, 수락 · 거절 · 날짜 고르기를 눌러 볼 방법이 없다.
 * 같은 행사에 다른 사람에게 보낸 제안(대기 · 거절)도 넣어 관리자 목록에 상태가 섞여 보이게 한다.
 *
 * 야시장은 공고로 지원해 보는 행사라 제안은 넣지 않는다.
 */
const buildDemoOffers = () => {
  const demo = findStaff(DEMO_STAFF_ID);

  if (!demo) return;

  const candidates = events
    .filter(
      (event) =>
        event.status !== "CANCELED" &&
        event.title !== NIGHT_MARKET_EVENT_TITLE &&
        event.dates.length > 1 &&
        event.dates[0] > dateFromToday(1),
    )
    .flatMap((event) =>
      event.positions
        .filter((position) => demo.roles.includes(position.jobRole))
        .map((position) => ({
          event,
          position,
          dates: positionWorkDates(event, position.positionId),
        })),
    )
    .filter(
      ({ event, dates }) =>
        dates.length > 1 && dates.every((date) => isFreeDate(event, demo.staffId, date)),
    );

  const full =
    candidates.find(({ position }) => position.scheduleRule === "FULL_ONLY") ??
    candidates[0];
  const split = candidates.find(
    ({ event }) => event.eventId !== full?.event.eventId,
  );

  if (full) {
    pushSeedOffer(full.event, full.position, demo, full.dates, "FULL", {
      message:
        "지난번 같은 거래처 현장에서 잘해 주셔서 먼저 연락드려요. 모든 날 가능하시면 수락해 주세요.",
    });
  }

  if (split) {
    pushSeedOffer(split.event, split.position, demo, split.dates, "SPLIT", {
      message: "하루만 되셔도 괜찮습니다. 가능한 날을 골라 수락해 주세요.",
    });
  }

  [full, split].forEach((item) => {
    if (!item) return;

    const others = assignableStaff()
      .filter(
        (staff) =>
          staff.staffId !== DEMO_STAFF_ID &&
          staff.roles.includes(item.position.jobRole) &&
          item.dates.every((date) => isFreeDate(item.event, staff.staffId, date)),
      )
      .slice(0, 2);

    others.forEach((staff, index) =>
      pushSeedOffer(
        item.event,
        item.position,
        staff,
        item.dates,
        item === full ? "FULL" : "SPLIT",
        index === 0
          ? {}
          : {
              status: "DECLINED",
              declineReason: "그 주에 시험이 있어서 어렵습니다.",
              respondedAt: toIsoDateTime(dateFromToday(0), "09:40"),
            },
      ),
    );
  });
};

buildDemoOffers();

export const findOffer = (offerId: number) =>
  offers.find((offer) => offer.offerId === offerId);

export const nextOfferId = (): number => (offerSequence += 1);

/** 응답에 실을 모양. 상태를 지금 시각으로 구해서 붙인다. */
export const toOfferView = (offer: WorkOffer): WorkOfferView => ({
  ...offer,
  state: resolveOfferState(offer),
});

/**
 * 확정된 날에 걸린 이 사람의 **다른 대기 제안을 닫는다.** 닫은 것의 이름을 돌려준다.
 *
 * 지원을 정리하는 것(`dropOverlappingApplications`)과 같은 이유다. 같은 날 두 곳의
 * 제안이 떠 있으면 본인은 둘 다 수락하려 하고, 두 번째는 겹침으로 막혀 고장으로 읽힌다.
 * 지원과 달리 **지우지 않고 철회로 남긴다** — 담당자가 보낸 기록이라 사라지면 안 되고,
 * 본인 화면에는 왜 닫혔는지(`closedReason`)를 적는다.
 */
export const withdrawOverlappingOffers = (
  staffId: number,
  dates: readonly string[],
  exceptOfferId?: number,
): { withdrawn: string[]; trimmed: string[] } => {
  const confirmed = new Set(dates);
  const withdrawn: string[] = [];
  const trimmed: string[] = [];

  offers.forEach((offer) => {
    if (
      offer.offerId === exceptOfferId ||
      offer.staffId !== staffId ||
      resolveOfferState(offer) !== "PENDING" ||
      !offer.dates.some((date) => confirmed.has(date))
    ) {
      return;
    }

    const label = `${offer.eventTitle} '${offer.positionName}'`;

    /*
      **날짜를 골라 수락하는 제안은 겹친 날만 뺀다.** 사흘 제안 중 하루가 다른 근무로
      잡혔다고 나머지 이틀까지 닫으면, 본인은 아직 나올 수 있는 날을 수락할 길을 잃는다.
      전일 제안은 전부 수락만 되므로 하루라도 겹치면 닫는다.
    */
    if (offer.participation === "SPLIT") {
      const remaining = offer.dates.filter((date) => !confirmed.has(date));

      if (remaining.length > 0) {
        offer.dates = remaining;
        trimmed.push(label);
        return;
      }
    }

    offer.status = "WITHDRAWN";
    offer.closedReason = "같은 날 다른 근무가 확정되었습니다.";
    offer.respondedAt = new Date().toISOString();
    withdrawn.push(label);
  });

  return { withdrawn, trimmed };
};
