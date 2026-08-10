import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { PayrollSummary } from "@/type/payroll";
import type { PayrollListParams } from "./getPayrollList";

export type PayrollSummaryParams = Omit<PayrollListParams, "page" | "size">;

export const getPayrollSummary = async (params: PayrollSummaryParams) => {
  const response = await adminAxios.get<PayrollSummary>(
    "/admin/payrolls/summary",
    { params },
  );

  return response.data;
};

/** 정산 화면 상단 합계입니다. 목록과 같은 필터를 넘겨 숫자가 어긋나지 않게 합니다. */
export const usePayrollSummaryQuery = (params: PayrollSummaryParams) => {
  return usePermittedQuery<PayrollSummary>("payroll:read", {
    queryKey: ["get-payroll-summary", params],
    queryFn: () => getPayrollSummary(params),
  });
};
