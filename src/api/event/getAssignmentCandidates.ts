import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { EmploymentType } from "@/type/employee";
import type { AssignmentCandidate } from "@/type/event";
import type { Gender, JobRole } from "@/type/staff";

export interface AssignmentCandidateParams {
  eventId: number;
  role?: JobRole;
  keyword?: string;
  /** 같은 날 다른 행사에 이미 확정된 인력도 함께 볼지 */
  includeUnavailable?: boolean;
  /**
   * 성별로 좁히기.
   *
   * 발주의 성별 조건이 이 값의 **초기값**을 정할 뿐이고, 담당자가 언제든
   * 비울 수 있다. 조건과 다른 성별을 배치하는 일이 현장에서는 늘 있어서
   * 여기서 발주 조건을 강제하면 후보가 아예 안 보이는 날이 생긴다.
   */
  gender?: Gender;
  /**
   * 고용 형태로 좁히기.
   *
   * 직원은 직무 조건에 걸리지 않아 어느 직무를 골라도 후보에 섞여 있는데,
   * 인력풀이 수십 명이면 추천 점수 순 목록 어딘가에 묻혀 **"직원은 어떻게
   * 넣나"**가 된다. 우리 사람만 따로 세워 볼 수 있어야 한다.
   */
  employment?: EmploymentType;
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
  return usePermittedQuery<AssignmentCandidateResponse>("assignment:read", {
    queryKey: ["get-assignment-candidates", params],
    queryFn: () => getAssignmentCandidates(params),
    enabled: isEnabled,
  });
};
