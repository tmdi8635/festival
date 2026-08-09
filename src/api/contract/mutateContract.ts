import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { Contract, ContractStatus } from "@/type/contract";
import type { JobRole } from "@/type/staff";

export interface GenerateContractRequest {
  eventId: number;
  templateId: number;
  /** 지정하지 않으면 계약서가 없는 확정 배치 전부를 대상으로 합니다. */
  assignmentIds?: number[];
  /**
   * 이 직무만 발급합니다. 비우면 전체.
   *
   * 직무마다 계약 조건이 달라 템플릿을 나눠 쓰는 경우가 많습니다.
   * (팀장은 책임 범위, 설치는 일급과 안전 조항) 전체 발급만 있으면
   * 첫 직무 템플릿으로 전원이 묶여 나갑니다.
   */
  role?: JobRole;
}

export const generateContracts = async (body: GenerateContractRequest) => {
  const response = await adminAxios.post<{ created: Contract[] }>(
    "/admin/contracts/generate",
    body,
  );

  return response.data;
};

export interface UpdateContractStatusRequest {
  contractIds: number[];
  status: ContractStatus;
  rejectedReason?: string;
}

export const updateContractStatus = async (
  body: UpdateContractStatusRequest,
) => {
  const response = await adminAxios.patch<{ updated: Contract[] }>(
    "/admin/contracts/status",
    body,
  );

  return response.data;
};

export const deleteContract = async (contractId: number) => {
  await adminAxios.delete(`/admin/contracts/${contractId}`);
};

export interface AmendContractRequest {
  contractId: number;
  /**
   * 새 차수에 남길 근무일.
   *
   * "며칠에 그만뒀는가"가 아니라 **실제로 나온 날**을 보낸다.
   * 중간에 하루 빠지고 다시 나오는 경우가 있어 마지막 근무일 하나로는 표현되지 않는다.
   */
  workDates: string[];
  /** 재작성 사유. 금액이 달라지는 근거라 비워 둘 수 없다. */
  reason: string;
  /** 계약에서 빠진 근무일의 배치를 취소 처리할지 */
  cancelsRemovedAssignments: boolean;
  /** 다른 템플릿으로 다시 쓸 때만 보낸다. 비우면 원래 템플릿을 그대로 쓴다. */
  templateId?: number;
}

export interface AmendContractResponse {
  /** 대체된 원래 계약서 */
  previous: Contract;
  /** 새로 만들어진 차수 */
  created: Contract;
  /** 함께 취소 처리된 배치 건수 */
  canceledCount: number;
}

export const amendContract = async ({
  contractId,
  ...body
}: AmendContractRequest) => {
  const response = await adminAxios.post<AmendContractResponse>(
    `/admin/contracts/${contractId}/amend`,
    body,
  );

  return response.data;
};

export interface SignContractRequest {
  contractId: number;
  /** 서명자가 직접 입력한 성명 */
  signedName: string;
  /** 캔버스에서 받은 서명 이미지 (data URL) */
  imageDataUrl: string;
  /** 서명 시점의 문서 평문. 서버가 해시로 만들어 보관한다. */
  documentText: string;
}

export const signContract = async ({
  contractId,
  ...body
}: SignContractRequest) => {
  const response = await adminAxios.post<Contract>(
    `/admin/contracts/${contractId}/sign`,
    body,
  );

  return response.data;
};

/** 계약서 생성 · 발송 · 서명 처리 후 목록과 배치 현황을 함께 갱신합니다. */
export const useContractMutation = () => {
  const queryClient = useQueryClient();

  const invalidateContract = () => {
    queryClient.invalidateQueries({ queryKey: ["get-contract-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-detail"] });
    queryClient.invalidateQueries({ queryKey: ["get-assignment-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const generateMutation = useMutation<
    { created: Contract[] },
    AppError,
    GenerateContractRequest
  >({
    mutationFn: generateContracts,
    onSuccess: ({ created }) => {
      showAppToast(
        created.length > 0 ? "success" : "info",
        created.length > 0
          ? `계약서 ${created.length}건을 만들었습니다.`
          : "새로 만들 계약서가 없습니다. 확정 배치를 먼저 확인해 주세요.",
      );
      invalidateContract();
    },
  });

  const statusMutation = useMutation<
    { updated: Contract[] },
    AppError,
    UpdateContractStatusRequest
  >({
    mutationFn: updateContractStatus,
    onSuccess: ({ updated }, variables) => {
      const message =
        variables.status === "SENT"
          ? `${updated.length}건을 발송했습니다.`
          : variables.status === "SIGNED"
            ? `${updated.length}건을 서명 완료 처리했습니다.`
            : "계약서 상태를 변경했습니다.";

      showAppToast("success", message);
      invalidateContract();
    },
  });

  const signMutation = useMutation<Contract, AppError, SignContractRequest>({
    mutationFn: signContract,
    onSuccess: (contract) => {
      showAppToast("success", `${contract.staffName}님의 서명을 접수했습니다.`, {
        description: `계약번호 ${contract.contractNumber}`,
      });
      invalidateContract();
      queryClient.invalidateQueries({ queryKey: ["get-contract-preview"] });
    },
  });

  const deleteMutation = useMutation<void, AppError, number>({
    mutationFn: deleteContract,
    onSuccess: () => {
      showAppToast("success", "계약서를 삭제했습니다.");
      invalidateContract();
    },
  });

  /**
   * 중도 종료로 계약서를 재작성한다.
   *
   * 이 요청 하나가 배치 · 계약서 · 정산을 함께 움직인다.
   * 그래서 무효화도 세 갈래를 모두 해야 한다. 하나라도 빠지면
   * 화면마다 다른 근무일수와 금액이 남는다.
   */
  const amendMutation = useMutation<
    AmendContractResponse,
    AppError,
    AmendContractRequest
  >({
    mutationFn: amendContract,
    onSuccess: ({ created, canceledCount }) => {
      showAppToast(
        "success",
        `${created.staffName}님의 계약서를 ${created.revision}차로 다시 만들었습니다.`,
        {
          description:
            canceledCount > 0
              ? `근무일 ${created.workDates.length}일 기준 · 배치 ${canceledCount}건 취소 · 정산 금액이 함께 다시 계산됩니다.`
              : `근무일 ${created.workDates.length}일 기준으로 정산 금액이 함께 다시 계산됩니다.`,
        },
      );
      invalidateContract();
      queryClient.invalidateQueries({ queryKey: ["get-contract-preview"] });
      queryClient.invalidateQueries({ queryKey: ["get-event-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-payroll-summary"] });
      queryClient.invalidateQueries({ queryKey: ["get-staff-detail"] });
      queryClient.invalidateQueries({ queryKey: ["get-staff-histories"] });
    },
  });

  return {
    generateMutation,
    statusMutation,
    signMutation,
    amendMutation,
    deleteMutation,
  };
};
