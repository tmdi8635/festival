import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { Contract, ContractTemplate } from "@/type/contract";

/**
 * 계약서 미리보기 응답.
 *
 * 치환이 끝난 본문 대신 계약서와 템플릿 원본을 그대로 받는다.
 * 문서 조립은 `buildContractDocument` 한 곳에서만 해야
 * 미리보기 · 인쇄 · 서명 화면이 같은 문서를 보여 준다.
 */
export interface ContractPreviewResponse {
  contract: Contract;
  template: ContractTemplate;
}

export const getContractPreview = async (contractId: number) => {
  const response = await adminAxios.get<ContractPreviewResponse>(
    `/admin/contracts/${contractId}/preview`,
  );

  return response.data;
};

/** 계약서 미리보기 · 서명 모달에서 사용합니다. */
export const useContractPreviewQuery = (contractId: number | null) => {
  return useQuery<ContractPreviewResponse, AppError>({
    queryKey: ["get-contract-preview", contractId],
    queryFn: () => getContractPreview(contractId!),
    enabled: contractId !== null,
  });
};
