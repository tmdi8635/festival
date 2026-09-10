import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { MyApplication, MyPosting } from "@/type/my";
import type { JobRole } from "@/type/staff";

export interface MyPostingListParams {
  role?: JobRole | "";
  /** 내가 할 수 있다고 신고한 직무만 본다 */
  onlyMyRoles?: boolean;
}

export const getMyPostings = async (params: MyPostingListParams) => {
  const response = await adminAxios.get<{ items: MyPosting[] }>("/my/postings", {
    params,
  });

  return response.data;
};

export const useMyPostingListQuery = (params: MyPostingListParams) =>
  useQuery<{ items: MyPosting[] }, AppError>({
    queryKey: ["get-my-postings", params],
    queryFn: () => getMyPostings(params),
  });

export const getMyApplications = async () => {
  const response = await adminAxios.get<{ items: MyApplication[] }>(
    "/my/applications",
  );

  return response.data;
};

export const useMyApplicationListQuery = () =>
  useQuery<{ items: MyApplication[] }, AppError>({
    queryKey: ["get-my-applications"],
    queryFn: getMyApplications,
  });

export const applyToPosting = async (postingId: number) => {
  const response = await adminAxios.post<MyApplication>("/my/applications", {
    postingId,
  });

  return response.data;
};

export const cancelMyApplication = async (applicationId: number) => {
  const response = await adminAxios.patch<MyApplication>(
    `/my/applications/${applicationId}/cancel`,
  );

  return response.data;
};

/**
 * 지원 · 지원 취소.
 *
 * 지원은 **확정이 아니다.** 토스트에서 그 사실을 분명히 해 두지 않으면
 * 본인은 그날 일이 잡힌 줄 알고 다른 자리를 거절한다.
 */
export const useMyApplicationMutation = () => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["get-my-postings"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-applications"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-summary"] });
    /* 관리자 지원자 관리 화면도 함께. 나란히 열어 두고 확인한다 */
    void queryClient.invalidateQueries({ queryKey: ["get-application-list"] });
    void queryClient.invalidateQueries({ queryKey: ["get-posting-list"] });
  };

  const applyMutation = useMutation<MyApplication, AppError, number>({
    mutationFn: applyToPosting,
    onSuccess: (application) => {
      showAppToast("success", "지원했습니다.", {
        description: `${application.eventTitle} · 담당자가 확인한 뒤 연락드립니다.`,
      });
      invalidate();
    },
  });

  const cancelMutation = useMutation<MyApplication, AppError, number>({
    mutationFn: cancelMyApplication,
    onSuccess: () => {
      showAppToast("success", "지원을 취소했습니다.");
      invalidate();
    },
  });

  return { applyMutation, cancelMutation };
};
