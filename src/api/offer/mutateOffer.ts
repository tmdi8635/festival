import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { WorkOfferView } from "@/type/offer";
import type { PostingParticipation } from "@/type/recruit";

export interface CreateOffersRequest {
  eventId: number;
  staffIds: number[];
  positionId: number;
  /** 제안할 날. 발주가 있고 지나지 않은 날만 서버가 받는다 */
  dates: string[];
  /** 전일이면 전부 수락만, 분할이면 본인이 날짜를 골라 수락한다 */
  participation: PostingParticipation;
  message: string;
}

export interface CreateOffersResponse {
  created: number;
  /** 보내지 못한 사람과 이유. 화면에서 안내해야 한다 */
  skipped: string[];
  items: WorkOfferView[];
}

export const createOffers = async ({ eventId, ...body }: CreateOffersRequest) => {
  const response = await adminAxios.post<CreateOffersResponse>(
    `/admin/events/${eventId}/offers`,
    body,
  );

  return response.data;
};

export const withdrawOffer = async (offerId: number) => {
  const response = await adminAxios.patch<WorkOfferView>(
    `/admin/offers/${offerId}/withdraw`,
  );

  return response.data;
};

/** 제안 보내기 · 철회. 보낸 제안 목록과 행사 상세를 함께 갱신합니다. */
export const useOfferMutation = () => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["get-offer-list"] });
    void queryClient.invalidateQueries({ queryKey: ["get-event-detail"] });
    void queryClient.invalidateQueries({ queryKey: ["get-assignment-candidates"] });
    /* 포털을 나란히 열어 두고 확인한다 */
    void queryClient.invalidateQueries({ queryKey: ["get-my-offers"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-summary"] });
  };

  const createMutation = useMutation<
    CreateOffersResponse,
    AppError,
    CreateOffersRequest
  >({
    mutationFn: createOffers,
    onSuccess: (result) => {
      showAppToast(
        result.skipped.length > 0 ? "warning" : "success",
        `${result.created}명에게 제안을 보냈습니다.`,
        {
          description:
            result.skipped.length > 0
              ? `보내지 못한 사람: ${result.skipped.join(", ")}`
              : "수락하면 곧바로 확정 배치됩니다.",
        },
      );
      invalidate();
    },
  });

  const withdrawMutation = useMutation<WorkOfferView, AppError, number>({
    mutationFn: withdrawOffer,
    onSuccess: () => {
      showAppToast("success", "제안을 철회했습니다.");
      invalidate();
    },
  });

  return { createMutation, withdrawMutation };
};
