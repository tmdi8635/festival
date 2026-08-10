import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { Manager } from "@/type/ops";

export interface ManagerListParams {
  keyword?: string;
}

export interface ManagerListResponse {
  items: Manager[];
}

export const getManagerList = async (params: ManagerListParams = {}) => {
  const response = await adminAxios.get<ManagerListResponse>(
    "/admin/managers",
    { params },
  );

  return response.data;
};

/** 담당자 관리 화면과 담당자 전환(테스트)에서 사용합니다. */
export const useManagerListQuery = (params: ManagerListParams = {}) => {
  return usePermittedQuery<ManagerListResponse>("admin:read", {
    queryKey: ["get-manager-list", params],
    queryFn: () => getManagerList(params),
  });
};
