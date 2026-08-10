import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { ReputationVerdict, StaffReputation } from "@/type/staff";

export interface StaffReputationResponse {
  items: StaffReputation[];
  goodCount: number;
  badCount: number;
  /**
   * 평가 항목별 집계.
   *
   * "별로예요 12건"만으로는 무엇이 문제인지 알 수 없다.
   * 그중 8건이 '지각이 잦음'이면 태도가 아니라 시간 문제이고, 대응도 달라진다.
   * 그래서 항목을 세어 함께 내려준다.
   */
  tagCounts: { tag: string; count: number; verdict: ReputationVerdict }[];
}

export const getStaffReputations = async (staffId: number) => {
  const response = await adminAxios.get<StaffReputationResponse>(
    `/admin/staff/${staffId}/reputations`,
  );

  return response.data;
};

/**
 * 인력 상세의 평판 탭에서 사용합니다.
 * 어느 행사에서 누구에게 어떤 평가를 받았는지 그대로 보여 줍니다.
 */
export const useStaffReputationQuery = (staffId: number | null) => {
  return usePermittedQuery<StaffReputationResponse>("staff:read", {
    queryKey: ["get-staff-reputations", staffId],
    queryFn: () => getStaffReputations(staffId!),
    enabled: staffId !== null,
  });
};
