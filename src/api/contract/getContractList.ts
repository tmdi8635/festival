import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError, PageResponse } from "@/type/api";
import type { Contract, ContractStatus } from "@/type/contract";

export interface ContractListParams {
  page: number;
  size: number;
  keyword?: string;
  status?: ContractStatus;
  eventId?: string;
  staffId?: string;
  startDate?: string;
  endDate?: string;
}

export const getContractList = async (params: ContractListParams) => {
  const response = await adminAxios.get<PageResponse<Contract>>(
    "/admin/contracts",
    { params },
  );

  return response.data;
};

/** 근로계약서 목록 화면과 인력 상세의 계약서 탭에서 함께 사용합니다. */
export const useContractListQuery = (params: ContractListParams) => {
  return useQuery<PageResponse<Contract>, AppError>({
    queryKey: ["get-contract-list", params],
    queryFn: () => getContractList(params),
  });
};
