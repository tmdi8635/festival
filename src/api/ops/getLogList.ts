import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError, PageResponse } from "@/type/api";
import type { LogDomain, LogLevel, OperationLog } from "@/type/ops";

export interface LogListParams {
  page: number;
  size: number;
  keyword?: string;
  level?: LogLevel;
  domain?: LogDomain;
}

export const getLogList = async (params: LogListParams) => {
  const response = await adminAxios.get<PageResponse<OperationLog>>(
    "/admin/logs",
    { params },
  );

  return response.data;
};

/** 운영 로그 화면에서 사용합니다. 변경 요청은 자동으로 적재됩니다. */
export const useLogListQuery = (params: LogListParams) => {
  return useQuery<PageResponse<OperationLog>, AppError>({
    queryKey: ["get-log-list", params],
    queryFn: () => getLogList(params),
    // 로그는 자주 바뀌므로 캐시를 짧게 가져간다.
    staleTime: 1000 * 10,
  });
};
