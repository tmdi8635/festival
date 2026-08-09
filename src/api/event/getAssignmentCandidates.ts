import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { AssignmentCandidate } from "@/type/event";
import type { JobRole } from "@/type/staff";

export interface AssignmentCandidateParams {
  eventId: number;
  role?: JobRole;
  keyword?: string;
  /** 같은 날 다른 행사에 이미 확정된 인력도 함께 볼지 */
  includeUnavailable?: boolean;
  /**
   * 배치하려는 근무일 (쉼표로 이어 붙인다).
   * 이 날짜들을 기준으로 겹침을 계산하므로, 고른 날에만 맞춰 후보가 걸러진다.
   */
  dates?: string;
}

export interface AssignmentCandidateResponse {
  items: AssignmentCandidate[];
}

export const getAssignmentCandidates = async ({
  eventId,
  ...params
}: AssignmentCandidateParams) => {
  const response = await adminAxios.get<AssignmentCandidateResponse>(
    `/admin/events/${eventId}/candidates`,
    { params },
  );

  return response.data;
};

/**
 * 배치 후보 조회입니다.
 * 즐겨찾기 · 해당 거래처 경험 · 평판 · 경력을 합친 점수 순으로 내려옵니다.
 */
export const useAssignmentCandidateQuery = (
  params: AssignmentCandidateParams,
  isEnabled: boolean,
) => {
  return useQuery<AssignmentCandidateResponse, AppError>({
    queryKey: ["get-assignment-candidates", params],
    queryFn: () => getAssignmentCandidates(params),
    enabled: isEnabled,
  });
};
