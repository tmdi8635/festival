import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { Client } from "@/type/client";
import type { EventSummary } from "@/type/event";

export interface ClientDetail extends Client {
  recentEvents: EventSummary[];
}

export const getClientDetail = async (clientId: number) => {
  const response = await adminAxios.get<ClientDetail>(
    `/admin/clients/${clientId}`,
  );

  return response.data;
};

/** 거래처 상세 모달에서 사용합니다. 최근 행사와 마진을 함께 봅니다. */
export const useClientDetailQuery = (clientId: number | null) => {
  return useQuery<ClientDetail, AppError>({
    queryKey: ["get-client-detail", clientId],
    queryFn: () => getClientDetail(clientId!),
    enabled: clientId !== null,
  });
};
