import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { MyContract } from "@/type/my";

export interface SignMyContractRequest {
  contractId: number;
  /** 서명자가 직접 입력한 성명 */
  signedName: string;
  /** 캔버스에서 받은 서명 이미지 (data URL) */
  imageDataUrl: string;
  /**
   * 서명 시점 문서의 평문.
   *
   * 서버가 해시로 만들어 보관한다. 서명한 뒤에 금액을 고쳐도 서명 이미지는 그대로
   * 붙어 있어서, 무엇에 서명했는지를 남기지 않으면 그 문서는 아무것도 증명하지 못한다.
   */
  documentText: string;
}

export const signMyContract = async ({
  contractId,
  ...body
}: SignMyContractRequest) => {
  const response = await adminAxios.post<MyContract>(
    `/my/contracts/${contractId}/sign`,
    body,
  );

  return response.data;
};

export const rejectMyContract = async (contractId: number, reason: string) => {
  const response = await adminAxios.post<MyContract>(
    `/my/contracts/${contractId}/reject`,
    { reason },
  );

  return response.data;
};

/**
 * 내 계약서에 서명하거나 되돌려 보낸다.
 *
 * 서명 한 번으로 관리자 쪽 명단 · 행사 상세 · 정산 대상까지 함께 움직인다.
 * 되돌릴 범위를 좁게 잡으면 관리자 화면을 나란히 열어 둔 채로 확인할 수 없다 —
 * 그리고 그것이 이 프로젝트의 확인 방식이다.
 */
export const useMyContractMutation = () => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["get-my-contracts"] });
    void queryClient.invalidateQueries({
      queryKey: ["get-my-contract-preview"],
    });
    void queryClient.invalidateQueries({ queryKey: ["get-my-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["get-contract-list"] });
    void queryClient.invalidateQueries({ queryKey: ["get-contract-roster"] });
    void queryClient.invalidateQueries({ queryKey: ["get-event-detail"] });
    void queryClient.invalidateQueries({ queryKey: ["get-assignment-list"] });
    void queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
    void queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const signMutation = useMutation<MyContract, AppError, SignMyContractRequest>({
    mutationFn: signMyContract,
    onSuccess: (contract) => {
      showAppToast("success", "서명이 완료되었습니다.", {
        description: `계약번호 ${contract.contractNumber}`,
      });
      invalidate();
    },
  });

  const rejectMutation = useMutation<
    MyContract,
    AppError,
    { contractId: number; reason: string }
  >({
    mutationFn: ({ contractId, reason }) => rejectMyContract(contractId, reason),
    onSuccess: () => {
      showAppToast(
        "success",
        "담당자에게 전달했습니다. 내용을 확인한 뒤 다시 보내 드립니다.",
      );
      invalidate();
    },
  });

  return { signMutation, rejectMutation };
};
