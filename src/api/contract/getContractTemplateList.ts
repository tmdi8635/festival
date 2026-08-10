import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { ContractTemplate } from "@/type/contract";

export interface ContractTemplateListParams {
  keyword?: string;
}

export interface ContractTemplateResponse {
  items: ContractTemplate[];
}

export const getContractTemplateList = async (
  params: ContractTemplateListParams = {},
) => {
  const response = await adminAxios.get<ContractTemplateResponse>(
    "/admin/contract-templates",
    { params },
  );

  return response.data;
};

/** 계약서 템플릿 화면과 계약서 생성 모달의 선택지에서 함께 사용합니다. */
export const useContractTemplateListQuery = (
  params: ContractTemplateListParams = {},
) => {
  return usePermittedQuery<ContractTemplateResponse>("contract:read", {
    queryKey: ["get-contract-templates", params],
    queryFn: () => getContractTemplateList(params),
  });
};
