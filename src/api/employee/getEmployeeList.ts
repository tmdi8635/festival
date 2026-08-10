import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { Employee } from "@/type/employee";

export interface EmployeeListParams {
  /** 집계 기준 달 (`YYYY-MM`) */
  month: string;
  keyword?: string;
  /** 퇴사자까지 볼 것인지 */
  includeRetired?: boolean;
}

export interface EmployeeListResponse {
  items: Employee[];
  month: string;
  summary: {
    totalCount: number;
    totalWorkedHours: number;
    totalBaseHours: number;
    /** 기준 시간을 넘긴 인원 */
    overCount: number;
    /** 이 달에 메인팀장을 맡은 횟수 합계 */
    mainSupervisorCount: number;
  };
}

export const getEmployeeList = async (params: EmployeeListParams) => {
  const response = await adminAxios.get<EmployeeListResponse>(
    "/admin/employees",
    { params },
  );

  return response.data;
};

/**
 * 직원 명부와 그 달 근무 집계를 함께 받습니다.
 *
 * 명부만 보러 오는 일이 없어서 나누지 않았습니다.
 * (관리자가 이 화면에 들어오는 이유가 "이번 달 누가 얼마나 뛰었나"입니다)
 */
export const useEmployeeListQuery = (params: EmployeeListParams) =>
  usePermittedQuery<EmployeeListResponse>("employee:read", {
    queryKey: ["get-employee-list", params],
    queryFn: () => getEmployeeList(params),
  });
