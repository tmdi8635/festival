import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { PageResponse } from "@/type/api";
import type {
  HealthCertFilter,
  JobRole,
  Staff,
  StaffStatus,
} from "@/type/staff";

/** 인력 목록 정렬 기준 */
export type StaffSort =
  | "RECENT"
  | "WORK_COUNT"
  | "RATING_COUNT"
  | "RATING"
  | "LAST_WORKED";

export interface StaffListParams {
  page: number;
  size: number;
  keyword?: string;
  status?: StaffStatus;
  role?: JobRole;
  /** 시/도 기준 지역 필터. 새벽 집합 행사에서 올 수 있는 사람을 추릴 때 쓴다. */
  region?: string;
  /** 서류 심사 상태 (`DocumentReviewState`). 비우면 전체 */
  documentState?: string;
  /** 보건증 유무. 식음료 자리에 세울 사람을 추릴 때 쓴다 */
  healthCert?: HealthCertFilter;
  onlyFavorite?: boolean;
  sort?: StaffSort;
}

export const getStaffList = async (params: StaffListParams) => {
  const response = await adminAxios.get<PageResponse<Staff>>("/admin/staff", {
    params,
  });

  return response.data;
};

/** 인력풀 화면에서 검색 · 등급/직무/서류 필터 · 정렬과 함께 사용합니다. */
export const useStaffListQuery = (params: StaffListParams) => {
  return usePermittedQuery<PageResponse<Staff>>("staff:read", {
    queryKey: ["get-staff-list", params],
    queryFn: () => getStaffList(params),
  });
};
