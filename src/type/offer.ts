import type { PostingParticipation } from "./recruit";

/**
 * 근무 제안 — 업체가 스태프에게 **먼저** 근무를 권한다.
 *
 * 공고 · 지원은 사람이 자리를 찾아오는 길이고, 제안은 거꾸로 우리가 사람을 찾아가는 길이다.
 * 지난 행사에서 잘해 준 사람, 노쇼로 급히 하루를 메워야 할 때 떠오르는 사람에게
 * 전화를 돌리던 일을 화면으로 옮긴다. 본인은 포털에서 보고 수락 · 거절한다.
 *
 * **제안은 자리를 잡지 않는다.** 여러 사람에게 보낼 수 있고, 수락한 순서대로 확정된다.
 * 자리가 먼저 차면 늦게 수락한 사람은 막힌다 — 전화로 하던 때와 같다.
 * 수락하는 순간 확정 배치가 만들어진다(지원 확정과 같은 규칙 · 같은 함수).
 */
export type OfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";

/**
 * 화면에 서는 상태. **만료는 저장하지 않고** 그때 구한다. (`resolveOfferState`)
 *
 * 만료를 저장해 두면 그 값을 바꿔 줄 누군가가 있어야 한다. 서버가 붙기 전에는
 * 아무도 없고, 붙은 뒤에도 배치 작업이 한 번 밀리면 기한이 지난 제안이 수락된다.
 */
export type OfferState = OfferStatus | "EXPIRED";

export const OFFER_STATE_LABEL: Record<OfferState, string> = {
  PENDING: "응답 대기",
  ACCEPTED: "수락",
  DECLINED: "거절",
  WITHDRAWN: "철회",
  EXPIRED: "기한 지남",
};

export interface WorkOffer {
  offerId: number;
  eventId: number;
  eventTitle: string;
  positionId: number;
  positionName: string;
  staffId: number;
  staffName: string;
  staffPhone: string;
  /** 제안한 날. 발주가 있고 지나지 않은 날만 들어간다 */
  dates: string[];
  /**
   * 전일(`FULL`)이면 **전부 수락만** 된다. 분할(`SPLIT`)이면 본인이 나올 날을 골라 수락한다.
   * 기본값은 포지션의 발주 조건(`scheduleRule`)이다.
   */
  participation: PostingParticipation;
  /** 담당자가 붙이는 한마디. "지난번 현장 잘해 주셔서 먼저 연락드려요" */
  message: string;
  status: OfferStatus;
  /** 이때까지 답이 없으면 기한 지남이다 */
  respondBy: string;
  /** 수락해서 확정된 날 */
  acceptedDates?: string[];
  /** 본인이 남긴 거절 사유. 선택이다 */
  declineReason?: string;
  /**
   * 시스템이나 담당자가 닫은 이유. (자리가 참 · 같은 날 다른 근무 확정 · 담당자 철회)
   * 본인 화면에 '철회'만 뜨면 왜 사라졌는지 묻는다.
   */
  closedReason?: string;
  createdByAdminId: number;
  createdByName: string;
  createdAt: string;
  respondedAt?: string;
}

/** 응답에 실리는 제안. 상태를 그때 구해서 붙인다. */
export interface WorkOfferView extends WorkOffer {
  state: OfferState;
}

/** 응답 기한 = 보낸 뒤 이만큼. */
export const OFFER_RESPONSE_HOURS = 24;

/** 첫 근무 시작 전 이만큼은 비워 둔다. 수락해도 준비할 틈이 없으면 소용이 없다. */
export const OFFER_CUTOFF_BEFORE_START_HOURS = 3;

const HOUR_MS = 60 * 60 * 1000;

/**
 * 응답 기한.
 *
 * 보낸 뒤 24시간이 기본이다. 다만 **첫 근무 3시간 전을 넘기지 않는다** — 내일 아침 노쇼를
 * 메우려고 오늘 밤 보낸 제안이 내일 밤까지 열려 있으면 뜻이 없다.
 * 그마저 한 시간도 안 남으면 한 시간은 준다. (보내자마자 닫히는 제안은 만들지 않는다)
 */
export const resolveOfferRespondBy = (sentAt: Date, firstWorkStart: Date): string => {
  const byHours = sentAt.getTime() + OFFER_RESPONSE_HOURS * HOUR_MS;
  const cutoff = firstWorkStart.getTime() - OFFER_CUTOFF_BEFORE_START_HOURS * HOUR_MS;
  const floor = sentAt.getTime() + HOUR_MS;

  return new Date(Math.max(Math.min(byHours, cutoff), floor)).toISOString();
};

/** 지금 이 제안의 상태. 응답 대기인데 기한이 지났으면 기한 지남이다. */
export const resolveOfferState = (
  offer: Pick<WorkOffer, "status" | "respondBy">,
  now: Date = new Date(),
): OfferState =>
  offer.status === "PENDING" && new Date(offer.respondBy).getTime() <= now.getTime()
    ? "EXPIRED"
    : offer.status;
