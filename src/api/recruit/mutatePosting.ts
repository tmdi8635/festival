import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { JobPosting, PostingFormValues, PostingStatus } from "@/type/recruit";

export const createPosting = async (body: PostingFormValues) => {
  const response = await adminAxios.post<JobPosting>("/admin/postings", body);

  return response.data;
};

export const updatePosting = async (
  postingId: number,
  body: PostingFormValues,
) => {
  const response = await adminAxios.put<JobPosting>(
    `/admin/postings/${postingId}`,
    body,
  );

  return response.data;
};

export const updatePostingStatus = async (
  postingId: number,
  status: PostingStatus,
) => {
  const response = await adminAxios.patch<JobPosting>(
    `/admin/postings/${postingId}/status`,
    { status },
  );

  return response.data;
};

/** 공고 등록 · 수정 · 마감 후 목록을 갱신합니다. */
export const usePostingMutation = () => {
  const queryClient = useQueryClient();

  const invalidatePosting = () => {
    queryClient.invalidateQueries({ queryKey: ["get-posting-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-application-list"] });
  };

  const createMutation = useMutation<JobPosting, AppError, PostingFormValues>({
    mutationFn: createPosting,
    onSuccess: () => {
      showAppToast("success", "공고를 등록했습니다.", {
        description: "공고문을 복사해 오픈카톡방에 올려 주세요.",
      });
      invalidatePosting();
    },
  });

  const updateMutation = useMutation<
    JobPosting,
    AppError,
    { postingId: number; body: PostingFormValues }
  >({
    mutationFn: ({ postingId, body }) => updatePosting(postingId, body),
    onSuccess: () => {
      showAppToast("success", "공고를 저장했습니다.");
      invalidatePosting();
    },
  });

  const statusMutation = useMutation<
    JobPosting,
    AppError,
    { postingId: number; status: PostingStatus }
  >({
    mutationFn: ({ postingId, status }) => updatePostingStatus(postingId, status),
    onSuccess: () => {
      showAppToast("success", "공고 상태를 변경했습니다.");
      invalidatePosting();
    },
  });

  return { createMutation, updateMutation, statusMutation };
};
