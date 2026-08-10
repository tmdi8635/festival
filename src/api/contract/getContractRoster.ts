import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { PageResponse } from "@/type/api";
import type {
  ContractRosterRow,
  ContractRosterState,
} from "@/type/contract";
import type { JobRole } from "@/type/staff";

/**
 * 계약 명단 조회. **행사를 가로질러** 계약해야 할 사람을 전부 센다.
 *
 * 계약서 목록(`/admin/contracts`)과 다른 점이 하나 있고, 그것이 전부다.
 * 계약서 목록은 **만들어진 문서**를 주고, 이쪽은 **계약해야 할 의무**를 준다.
 * 그래서 아직 아무것도 안 한 사람이 여기에는 나오고 저기에는 없다.
 * 근로계약서는 반드시 써야 하는 것이라, 관리 화면이 봐야 하는 쪽은 이쪽이다.
 */
export interface ContractRosterParams {
  page: number;
  size: number;
  keyword?: string;
  state?: ContractRosterState;
  eventId?: string;
  role?: JobRole;
  startDate?: string;
  endDate?: string;
}

export interface ContractRosterResponse
  extends PageResponse<ContractRosterRow> {
  /** 상태별 인원. 필터와 무관하게 전체 기준이라 상단 지표로 쓴다. */
  stateCounts: Record<ContractRosterState, number>;
}

export const getContractRoster = async (params: ContractRosterParams) => {
  const response = await adminAxios.get<ContractRosterResponse>(
    "/admin/contract-roster",
    { params },
  );

  return response.data;
};

/** 계약서 관리 화면에서 사용합니다. */
export const useContractRosterQuery = (params: ContractRosterParams) =>
  usePermittedQuery<ContractRosterResponse>("contract:read", {
    queryKey: ["get-contract-roster", params],
    queryFn: () => getContractRoster(params),
  });
