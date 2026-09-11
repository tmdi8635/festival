import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { OfferState, WorkOfferView } from "@/type/offer";

export interface OfferListParams {
  eventId?: number;
  state?: OfferState;
}

export interface OfferListResponse {
  items: WorkOfferView[];
}

export const getOfferList = async (params: OfferListParams) => {
  const response = await adminAxios.get<OfferListResponse>("/admin/offers", {
    params,
  });

  return response.data;
};

/**
 * 보낸 제안 목록입니다.
 * 수락되면 배치가 되므로 배치를 볼 수 있는 사람만 조회합니다.
 */
export const useOfferListQuery = (params: OfferListParams) =>
  usePermittedQuery<OfferListResponse>("assignment:read", {
    queryKey: ["get-offer-list", params],
    queryFn: () => getOfferList(params),
  });
