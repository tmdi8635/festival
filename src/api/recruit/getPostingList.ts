import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError, PageResponse } from "@/type/api";
import type { JobPosting, PostingStatus } from "@/type/recruit";
import type { JobRole } from "@/type/staff";

export interface PostingListParams {
  page: number;
  size: number;
  keyword?: string;
  status?: PostingStatus;
  role?: JobRole;
}

export const getPostingList = async (params: PostingListParams) => {
  const response = await adminAxios.get<PageResponse<JobPosting>>(
    "/admin/postings",
    { params },
  );

  return response.data;
};

/** 공고 목록 화면에서 사용합니다. 근무일이 가까운 순으로 내려옵니다. */
export const usePostingListQuery = (params: PostingListParams) => {
  return useQuery<PageResponse<JobPosting>, AppError>({
    queryKey: ["get-posting-list", params],
    queryFn: () => getPostingList(params),
  });
};
