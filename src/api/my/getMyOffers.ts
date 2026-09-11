import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { MyOffer } from "@/type/my";

export const getMyOffers = async () => {
  const response = await adminAxios.get<{ items: MyOffer[] }>("/my/offers");

  return response.data;
};

/** 받은 제안. 응답 대기 → 기한이 가까운 순으로 온다 */
export const useMyOfferListQuery = () =>
  useQuery<{ items: MyOffer[] }, AppError>({
    queryKey: ["get-my-offers"],
    queryFn: getMyOffers,
  });

export interface AcceptMyOfferRequest {
  offerId: number;
  /** 분할 제안일 때 나올 날. 전일 제안은 보내지 않는다 */
  dates?: string[];
}

export const acceptMyOffer = async ({ offerId, ...body }: AcceptMyOfferRequest) => {
  const response = await adminAxios.post<MyOffer>(
    `/my/offers/${offerId}/accept`,
    body,
  );

  return response.data;
};

export interface DeclineMyOfferRequest {
  offerId: number;
  reason?: string;
}

export const declineMyOffer = async ({ offerId, reason }: DeclineMyOfferRequest) => {
  const response = await adminAxios.post<MyOffer>(
    `/my/offers/${offerId}/decline`,
    { reason },
  );

  return response.data;
};

/**
 * 제안 수락 · 거절.
 *
 * 수락은 **곧 확정**이다. 지원과 달리 담당자 검토가 없다 — 담당자가 먼저 부른 자리라서다.
 * 토스트에서 그 사실을 분명히 해 두지 않으면 본인은 아직 검토 중인 줄 안다.
 */
export const useMyOfferMutation = () => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["get-my-offers"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-assignments"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-applications"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-postings"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-posting"] });
    /* 관리자 화면도 함께. 나란히 열어 두고 확인한다 */
    void queryClient.invalidateQueries({ queryKey: ["get-offer-list"] });
    void queryClient.invalidateQueries({ queryKey: ["get-event-detail"] });
  };

  const acceptMutation = useMutation<MyOffer, AppError, AcceptMyOfferRequest>({
    mutationFn: acceptMyOffer,
    onSuccess: (offer) => {
      showAppToast("success", `${offer.eventTitle} 근무가 확정되었습니다.`, {
        description: `${offer.acceptedDates?.length ?? 0}일 · 일정의 '예정'에서 확인하세요.`,
      });
      invalidate();
    },
  });

  const declineMutation = useMutation<MyOffer, AppError, DeclineMyOfferRequest>({
    mutationFn: declineMyOffer,
    onSuccess: () => {
      showAppToast("success", "제안을 거절했습니다.");
      invalidate();
    },
  });

  return { acceptMutation, declineMutation };
};
