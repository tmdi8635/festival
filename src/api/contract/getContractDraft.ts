import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { Contract, ContractTemplate } from "@/type/contract";

/**
 * 아직 등록되지 않은 계약서의 미리보기.
 *
 * 서명본을 올리기 전에는 계약서 **기록이 없다.** (번호도 없다)
 * 그런데 담당자는 그 전에 문서를 보고 내려받아야 한다. 배부할 종이가 그것이기 때문이다.
 *
 * 그래서 저장하지 않고 문서만 조립해서 돌려준다.
 * 화면에 보이는 이 문서와 등록 뒤에 보이는 문서가 같은 조립기를 쓰므로
 * (`buildContractDocument`) "받아 본 것과 다르다"가 생기지 않는다.
 */
export interface ContractDraftResponse {
  /** 저장되지 않은 계약서. `contractId`는 0, `contractNumber`는 빈 문자열이다. */
  contract: Contract;
  template: ContractTemplate;
}

export interface ContractDraftParams {
  eventId: number;
  staffId: number;
  /** 비우면 기본 템플릿을 쓴다. */
  templateId?: number;
}

export const getContractDraft = async ({
  eventId,
  staffId,
  templateId,
}: ContractDraftParams) => {
  const response = await adminAxios.get<ContractDraftResponse>(
    `/admin/events/${eventId}/contract-draft`,
    { params: { staffId, templateId } },
  );

  return response.data;
};

/** 근로계약서 상세에서 아직 등록되지 않은 사람의 문서를 볼 때 사용합니다. */
export const useContractDraftQuery = (
  params: ContractDraftParams | null,
) =>
  usePermittedQuery<ContractDraftResponse>("contract:read", {
    queryKey: ["get-contract-draft", params],
    queryFn: () => getContractDraft(params!),
    enabled: params !== null,
  });

/**
 * 여러 명분을 한 번에 조립해 받는다. (명단에서 골라 일괄로 내려받을 때)
 *
 * 한 명씩 부르면 서른 명이면 서른 번이고, 그중 하나만 늦어도 인쇄 창이
 * 절반만 채운 채로 열린다. 문서는 전부 모인 뒤에 한 번에 그려야 한다.
 */
export const getContractDrafts = async (
  eventId: number,
  staffIds: number[],
  templateId?: number,
) => {
  const response = await adminAxios.post<{ items: ContractDraftResponse[] }>(
    `/admin/events/${eventId}/contract-drafts`,
    { staffIds, templateId },
  );

  return response.data;
};
