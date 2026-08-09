import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { PayrollItem, PayrollStatus } from "@/type/payroll";

export interface UpdatePayrollStatusRequest {
  payrollIds: number[];
  status: PayrollStatus;
  holdReason?: string;
}

export const updatePayrollStatus = async (
  body: UpdatePayrollStatusRequest,
) => {
  const response = await adminAxios.patch<{ updated: PayrollItem[] }>(
    "/admin/payrolls/status",
    body,
  );

  return response.data;
};

export interface UpdatePayrollAmountBody {
  allowance: number;
  deduction: number;
  /** 연장수당을 이 건에 붙일지. 기준 설정의 기본값을 건별로 덮어쓴다. */
  isOvertimeApplied?: boolean;
  isNightPayApplied?: boolean;
}

export const updatePayrollAmount = async (
  payrollId: number,
  body: UpdatePayrollAmountBody,
) => {
  const response = await adminAxios.patch<PayrollItem>(
    `/admin/payrolls/${payrollId}`,
    body,
  );

  return response.data;
};

export interface UpdatePayrollAllowanceRequest {
  payrollIds: number[];
  isOvertimeApplied?: boolean;
  isNightPayApplied?: boolean;
}

export const updatePayrollAllowances = async (
  body: UpdatePayrollAllowanceRequest,
) => {
  const response = await adminAxios.patch<{ updated: PayrollItem[] }>(
    "/admin/payrolls/allowances",
    body,
  );

  return response.data;
};

/** 정산 상태 · 금액 조정 후 목록과 합계를 함께 갱신합니다. */
export const usePayrollMutation = () => {
  const queryClient = useQueryClient();

  const invalidatePayroll = () => {
    queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-payroll-summary"] });
    queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const statusMutation = useMutation<
    { updated: PayrollItem[] },
    AppError,
    UpdatePayrollStatusRequest
  >({
    mutationFn: updatePayrollStatus,
    onSuccess: ({ updated }, variables) => {
      const message =
        variables.status === "PAID"
          ? `${updated.length}건을 지급 완료 처리했습니다.`
          : variables.status === "APPROVED"
            ? `${updated.length}건을 지급 승인했습니다.`
            : "정산 상태를 변경했습니다.";

      showAppToast("success", message);
      invalidatePayroll();
    },
  });

  const amountMutation = useMutation<
    PayrollItem,
    AppError,
    { payrollId: number } & UpdatePayrollAmountBody
  >({
    mutationFn: ({ payrollId, ...body }) =>
      updatePayrollAmount(payrollId, body),
    onSuccess: () => {
      showAppToast("success", "지급액을 조정했습니다.");
      invalidatePayroll();
    },
  });

  /**
   * 수당 적용 일괄 변경.
   *
   * "이번 행사는 연장수당 빼기로 했다"는 대개 행사 단위로 정해진다.
   * 건별로 스무 번 누르지 않아도 되게 한 번에 처리한다.
   */
  const allowanceMutation = useMutation<
    { updated: PayrollItem[] },
    AppError,
    UpdatePayrollAllowanceRequest
  >({
    mutationFn: updatePayrollAllowances,
    onSuccess: ({ updated }, variables) => {
      const target =
        variables.isOvertimeApplied !== undefined ? "연장수당" : "야간수당";
      const isApplied =
        variables.isOvertimeApplied ?? variables.isNightPayApplied;

      showAppToast(
        "success",
        `${updated.length}건의 ${target}을 ${isApplied ? "적용" : "해제"}했습니다.`,
      );
      invalidatePayroll();
    },
  });

  return { statusMutation, amountMutation, allowanceMutation };
};
