import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { Contract, ContractTemplate } from "@/type/contract";
import type { MyContract, MyContractHistoryItem } from "@/type/my";

export const getMyContracts = async () => {
  const response = await adminAxios.get<{ items: MyContract[] }>(
    "/my/contracts",
  );

  return response.data;
};

export const useMyContractListQuery = () =>
  useQuery<{ items: MyContract[] }, AppError>({
    queryKey: ["get-my-contracts"],
    queryFn: getMyContracts,
  });

export interface MyContractPreview {
  /** 문서를 조립하는 원문. 화면에는 `summary`를 쓴다 */
  contract: Contract;
  template: ContractTemplate;
  /** 화면용 요약 (상태 · 수정요청 이력 포함) */
  summary: MyContract;
  /** 같은 행사 계약서의 차수 이력. 오래된 차수부터 */
  history: MyContractHistoryItem[];
}

/**
 * 서명 화면이 그릴 문서 원문.
 *
 * 조립된 문서가 아니라 **계약서 + 양식**을 받아 화면에서 `buildContractDocument`로
 * 만든다. 관리자 미리보기와 같은 함수를 거쳐야 두 사람이 같은 글자를 본다.
 */
export const getMyContractPreview = async (contractId: number) => {
  const response = await adminAxios.get<MyContractPreview>(
    `/my/contracts/${contractId}/preview`,
  );

  return response.data;
};

export const useMyContractPreviewQuery = (contractId: number | null) =>
  useQuery<MyContractPreview, AppError>({
    queryKey: ["get-my-contract-preview", contractId],
    queryFn: () => getMyContractPreview(contractId!),
    enabled: contractId !== null,
  });
