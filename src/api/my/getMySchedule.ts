import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { MyPayroll, MySummary, MyWork } from "@/type/my";

/** 예정 · 종료. 한 화면에서 탭으로 오간다 */
export type MyScheduleScope = "UPCOMING" | "PAST";

export const getMyAssignments = async (scope: MyScheduleScope) => {
  const response = await adminAxios.get<{ items: MyWork[] }>(
    "/my/assignments",
    { params: { scope } },
  );

  return response.data;
};

export const useMyAssignmentListQuery = (scope: MyScheduleScope) =>
  useQuery<{ items: MyWork[] }, AppError>({
    queryKey: ["get-my-assignments", scope],
    queryFn: () => getMyAssignments(scope),
  });

export const getMyPayrolls = async () => {
  const response = await adminAxios.get<{ items: MyPayroll[] }>("/my/payrolls");

  return response.data;
};

export const useMyPayrollListQuery = () =>
  useQuery<{ items: MyPayroll[] }, AppError>({
    queryKey: ["get-my-payrolls"],
    queryFn: getMyPayrolls,
  });

export const getMySummary = async () => {
  const response = await adminAxios.get<MySummary>("/my/summary");

  return response.data;
};

/** 포털 첫 화면. 여러 조회를 한 번에 묶어 받는다 */
export const useMySummaryQuery = () =>
  useQuery<MySummary, AppError>({
    queryKey: ["get-my-summary"],
    queryFn: getMySummary,
  });
