import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { PageResponse } from "@/type/api";
import type { Assignment, AssignmentStatus } from "@/type/event";
import type { AttendanceStatus, JobRole } from "@/type/staff";

export interface AssignmentListParams {
  page: number;
  size: number;
  keyword?: string;
  role?: JobRole;
  status?: AssignmentStatus;
  attendance?: AttendanceStatus;
  startDate?: string;
  endDate?: string;
  /** 계약서가 아직 완료되지 않은 배치만 봅니다. */
  onlyUnsignedContract?: boolean;
  /** 지난 근무인데 실제 출퇴근이 안 적힌 건만. 정산 전 확인용이다. */
  onlyMissingCheckTime?: boolean;
}

export const getAssignmentList = async (params: AssignmentListParams) => {
  const response = await adminAxios.get<PageResponse<Assignment>>(
    "/admin/assignments",
    { params },
  );

  return response.data;
};

/** 배치 현황 화면에서 인력 기준으로 배치를 펴서 봅니다. */
export const useAssignmentListQuery = (params: AssignmentListParams) => {
  return usePermittedQuery<PageResponse<Assignment>>("assignment:read", {
    queryKey: ["get-assignment-list", params],
    queryFn: () => getAssignmentList(params),
  });
};
