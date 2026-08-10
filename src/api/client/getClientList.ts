import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { PageResponse } from "@/type/api";
import type { Client } from "@/type/client";

export interface ClientListParams {
  page: number;
  size: number;
  keyword?: string;
  /** "true" | "false" | undefined(전체) */
  isActive?: string;
}

export const getClientList = async (params: ClientListParams) => {
  const response = await adminAxios.get<PageResponse<Client>>("/admin/clients", {
    params,
  });

  return response.data;
};

/** 거래처 목록 화면과 행사 등록 폼의 선택지에서 함께 사용합니다. */
export const useClientListQuery = (params: ClientListParams) => {
  return usePermittedQuery<PageResponse<Client>>("client:read", {
    queryKey: ["get-client-list", params],
    queryFn: () => getClientList(params),
  });
};
