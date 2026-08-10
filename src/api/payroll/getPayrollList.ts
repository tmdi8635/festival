import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { PageResponse } from "@/type/api";
import type { PayrollItem, PayrollStatus } from "@/type/payroll";
import type { JobRole } from "@/type/staff";

export interface PayrollListParams {
  page: number;
  size: number;
  keyword?: string;
  status?: PayrollStatus;
  eventId?: string;
  role?: JobRole;
  startDate?: string;
  endDate?: string;
}

export const getPayrollList = async (params: PayrollListParams) => {
  const response = await adminAxios.get<PageResponse<PayrollItem>>(
    "/admin/payrolls",
    { params },
  );

  return response.data;
};

/** 정산 목록 화면에서 사용합니다. 계좌 정보가 포함되므로 권한을 확인해야 합니다. */
export const usePayrollListQuery = (params: PayrollListParams) => {
  return usePermittedQuery<PageResponse<PayrollItem>>("payroll:read", {
    queryKey: ["get-payroll-list", params],
    queryFn: () => getPayrollList(params),
  });
};
