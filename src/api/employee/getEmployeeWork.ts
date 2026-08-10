import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { EmployeeWorkRow, EmployeeWorkSummary } from "@/type/employee";

/**
 * 정렬 기준.
 *
 * - `HOURS`   실제로 많이 뛴 순. 기준 시간이 사람마다 달라 채움률만으로는 안 보인다
 * - `RATE`    채움률 높은 순 (기본). 다음 달 배치를 덜어 줄 사람이 위로 온다
 * - `POSITION` 직책순. 팀 단위로 훑을 때 쓴다
 */
export type EmployeeWorkSort = "HOURS" | "RATE" | "POSITION";

export interface EmployeeWorkParams {
  /** 집계 기준 달 (`YYYY-MM`) */
  month: string;
  keyword?: string;
  sort?: EmployeeWorkSort;
}

export interface EmployeeWorkResponse {
  items: EmployeeWorkRow[];
  month: string;
  summary: EmployeeWorkSummary;
}

export const getEmployeeWork = async (params: EmployeeWorkParams) => {
  const response = await adminAxios.get<EmployeeWorkResponse>(
    "/admin/employee-work",
    { params },
  );

  return response.data;
};

/**
 * 직원 근무 집계.
 *
 * 조회 기준은 언제나 **달 하나**입니다. 급여가 달 단위로 나가고 기본 근무시간도
 * 달 기준이라, 기간을 자유롭게 받으면 "이번 달을 채웠는가"라는 질문에
 * 답할 수 없는 숫자가 나옵니다.
 */
export const useEmployeeWorkQuery = (params: EmployeeWorkParams) =>
  usePermittedQuery<EmployeeWorkResponse>("employee:read", {
    queryKey: ["get-employee-work", params],
    queryFn: () => getEmployeeWork(params),
  });
