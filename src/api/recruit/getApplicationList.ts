import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { PageResponse } from "@/type/api";
import type { Application, ApplicationStatus } from "@/type/recruit";

export interface ApplicationListParams {
  page: number;
  size: number;
  keyword?: string;
  status?: ApplicationStatus;
  postingId?: string;
  /** 인력풀에 없는 신규 지원자만 봅니다. 서류부터 받아야 하는 대상입니다. */
  onlyNewApplicant?: boolean;
}

export const getApplicationList = async (params: ApplicationListParams) => {
  const response = await adminAxios.get<PageResponse<Application>>(
    "/admin/applications",
    { params },
  );

  return response.data;
};

/** 지원자 관리 화면에서 사용합니다. */
export const useApplicationListQuery = (params: ApplicationListParams) => {
  return usePermittedQuery<PageResponse<Application>>("recruit:read", {
    queryKey: ["get-application-list", params],
    queryFn: () => getApplicationList(params),
  });
};
