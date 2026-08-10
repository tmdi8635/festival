import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { AmendReasonType, Contract } from "@/type/contract";

/**
 * 서명받은 계약서를 등록한다.
 *
 * 서버가 없는 동안 이 요청 하나가 계약을 성립시킨다.
 * 문서를 내려받아 배부하고 종이에 서명받아 다시 올리는 것이 절차 전부이고,
 * **이 요청이 성공한 시점에** 계약번호가 붙고 서명완료가 된다.
 *
 * 최초 등록이면 계약서 기록이 이때 처음 만들어지므로 `contractId`가 없다.
 * 재작성으로 다음 차수가 이미 만들어져 있으면 그 차수에 파일만 붙인다.
 */
export interface RegisterContractRequest {
  /** 이어 붙일 기존 계약서. 재작성한 차수에 서명본을 올릴 때만 보낸다. */
  contractId?: number;
  /** 처음 등록할 때 필요한 값들 */
  eventId?: number;
  staffId?: number;
  templateId?: number;
  /** 업로드한 서명본 */
  fileUrl: string;
  fileName: string;
  mimeType: string;
  /**
   * 결과를 토스트로 알리지 않는다. **일괄 등록에서만 켠다.**
   *
   * 서른 장을 올리면 성공 토스트가 서른 개 쌓여 결과 화면을 덮는다.
   * 일괄은 자기 화면에 성공 · 실패를 나란히 세워 보여 주므로 토스트가 필요 없다.
   */
  isSilent?: boolean;
}

export const registerContract = async ({
  isSilent,
  ...body
}: RegisterContractRequest) => {
  void isSilent;

  const response = await adminAxios.post<Contract>(
    "/admin/contracts/register",
    body,
  );

  return response.data;
};

/**
 * 등록을 되돌린다.
 *
 * 남의 서명본을 잘못 올리는 일이 실제로 생긴다. (파일명이 비슷하다)
 * 그때 고칠 방법이 없으면 담당자는 계약서를 통째로 지우고 처음부터 다시 하게 되고,
 * 재작성 차수라면 이력까지 함께 사라진다.
 *
 * 최초 계약(1차)은 기록 자체를 지워 '발급 전'으로 돌아가고,
 * 재작성 차수는 파일만 떼어 '등록 대기'로 돌아간다. (번호와 이력은 남는다)
 */
export const cancelContractRegistration = async (contractId: number) => {
  const response = await adminAxios.delete<{ contract: Contract | null }>(
    `/admin/contracts/${contractId}/registration`,
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
  /** 재작성 사유 구분. 나중에 "왜 다시 썼는지"를 분류해 볼 수 있어야 한다. */
  reasonType?: AmendReasonType;
  /**
   * 계약서에 남길 변경 내용.
   *
   * 중식 제공처럼 **금액에도 근무일에도 잡히지 않는 조건**이 있다.
   * 이걸 적을 자리가 없으면 재작성은 됐는데 무엇이 달라졌는지가 문서에 없다.
   */
  note?: string;
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

/** 계약서 등록 · 재작성 후 목록과 배치 현황을 함께 갱신합니다. */
export const useContractMutation = () => {
  const queryClient = useQueryClient();

  const invalidateContract = () => {
    queryClient.invalidateQueries({ queryKey: ["get-contract-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-contract-roster"] });
    queryClient.invalidateQueries({ queryKey: ["get-contract-preview"] });
    queryClient.invalidateQueries({ queryKey: ["get-contract-draft"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-detail"] });
    queryClient.invalidateQueries({ queryKey: ["get-assignment-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const registerMutation = useMutation<
    Contract,
    AppError,
    RegisterContractRequest
  >({
    mutationFn: registerContract,
    onSuccess: (contract, variables) => {
      /*
        일괄 등록에서는 토스트를 띄우지 않는다.

        서른 장을 올리면 토스트가 서른 개 쌓여 화면을 덮고, 정작 결과를
        읽어야 하는 모달이 그 뒤로 가려진다. 게다가 성공만 알리므로
        실패한 두 장은 그 더미 속에서 아예 보이지 않는다.
        일괄은 자기 화면에 성공 · 실패를 나란히 세워 보여 준다.
      */
      if (variables.isSilent) {
        invalidateContract();
        return;
      }

      showAppToast(
        "success",
        `${contract.staffName}님의 근로계약서를 등록했습니다.`,
        { description: `계약번호 ${contract.contractNumber}` },
      );
      invalidateContract();
    },
  });

  const cancelRegistrationMutation = useMutation<
    { contract: Contract | null },
    AppError,
    number
  >({
    mutationFn: cancelContractRegistration,
    onSuccess: ({ contract }) => {
      showAppToast(
        "success",
        contract
          ? "등록을 취소했습니다. 서명본을 다시 올려 주세요."
          : "등록을 취소했습니다. 이 사람은 다시 '발급 전'이 됩니다.",
      );
      invalidateContract();
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
              ? `근무일 ${created.workDates.length}일 기준 · 배치 ${canceledCount}건 취소 · 서명본을 다시 받아 등록해 주세요.`
              : `근무일 ${created.workDates.length}일 기준 · 서명본을 다시 받아 등록해 주세요.`,
        },
      );
      invalidateContract();
      queryClient.invalidateQueries({ queryKey: ["get-event-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-payroll-summary"] });
      queryClient.invalidateQueries({ queryKey: ["get-staff-detail"] });
      queryClient.invalidateQueries({ queryKey: ["get-staff-histories"] });
    },
  });

  return {
    registerMutation,
    cancelRegistrationMutation,
    amendMutation,
    deleteMutation,
  };
};
