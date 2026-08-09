import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { DashboardSummary } from "@/type/dashboard";

export const getDashboardSummary = async () => {
  const response = await adminAxios.get<DashboardSummary>(
    "/admin/dashboard/summary",
  );

  return response.data;
};

/** 대시보드 한 화면에 필요한 지표 · 할 일 · 추이를 한 번에 가져옵니다. */
export const useDashboardSummaryQuery = () => {
  return useQuery<DashboardSummary, AppError>({
    queryKey: ["get-dashboard-summary"],
    queryFn: getDashboardSummary,
  });
};
