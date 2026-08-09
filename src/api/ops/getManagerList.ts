import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
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

/** 담당자 관리 화면에서 사용합니다. */
export const useManagerListQuery = (params: ManagerListParams = {}) => {
  return useQuery<ManagerListResponse, AppError>({
    queryKey: ["get-manager-list", params],
    queryFn: () => getManagerList(params),
  });
};
