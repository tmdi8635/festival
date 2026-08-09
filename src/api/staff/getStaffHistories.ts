import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { StaffWorkHistory } from "@/type/staff";

export interface StaffHistoryResponse {
  items: StaffWorkHistory[];
}

export const getStaffHistories = async (staffId: number) => {
  const response = await adminAxios.get<StaffHistoryResponse>(
    `/admin/staff/${staffId}/histories`,
  );

  return response.data;
};

/** 인력 상세의 참여 이력 탭에서 사용합니다. 블랙리스트 판단의 근거가 됩니다. */
export const useStaffHistoryQuery = (staffId: number | null) => {
  return useQuery<StaffHistoryResponse, AppError>({
    queryKey: ["get-staff-histories", staffId],
    queryFn: () => getStaffHistories(staffId!),
    enabled: staffId !== null,
  });
};
