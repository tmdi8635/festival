import type { BadgeTone } from "@/components/ui";
import type { OfferState } from "@/type/offer";

/** 제안 상태 배지. 응답 대기만 눈에 걸리게, 닫힌 것은 흐리게 둔다. */
export const OFFER_STATE_TONE: Record<OfferState, BadgeTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  DECLINED: "danger",
  WITHDRAWN: "neutral",
  EXPIRED: "neutral",
};
