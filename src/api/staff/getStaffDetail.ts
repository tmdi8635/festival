import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { StaffDetail } from "@/type/staff";

export const getStaffDetail = async (staffId: number) => {
  const response = await adminAxios.get<StaffDetail>(`/admin/staff/${staffId}`);

  return response.data;
};

/** 인력 상세 모달에서 사용합니다. 계좌 · 신분증 등 민감 정보가 포함됩니다. */
export const useStaffDetailQuery = (staffId: number | null) => {
  return usePermittedQuery<StaffDetail>("staff:read", {
    queryKey: ["get-staff-detail", staffId],
    queryFn: () => getStaffDetail(staffId!),
    enabled: staffId !== null,
  });
};
