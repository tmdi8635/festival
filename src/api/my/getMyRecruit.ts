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

/**
 * 공고 조회는 **`/my`가 아니다.**
 *
 * 로그인하지 않아도 볼 수 있는 자료라, 본인 것만 담는 `/my/*` 아래에 두지 않는다.
 * 신원(`X-Staff-Id`)이 실려 있으면 지원 여부까지 채워서 오고, 없으면 공고만 온다.
 */
export const getMyPostings = async (params: MyPostingListParams) => {
  const response = await adminAxios.get<{ items: MyPosting[] }>("/postings", {
    params,
  });

  return response.data;
};

export const useMyPostingListQuery = (params: MyPostingListParams) =>
  useQuery<{ items: MyPosting[] }, AppError>({
    queryKey: ["get-my-postings", params],
    queryFn: () => getMyPostings(params),
  });

export const getMyPosting = async (postingId: number) => {
  const response = await adminAxios.get<MyPosting>(`/postings/${postingId}`);

  return response.data;
};

/**
 * 공고 한 건. 목록에서 고른 카드를 상세 모달로 열 때 쓴다.
 *
 * 목록이 이미 갖고 있는 자료를 다시 부르는 이유는 두 가지다. 하나는 목록이
 * 마감된 공고를 빼기 때문에 '내 지원'에서 들어오는 길에는 자료가 없다는 것,
 * 다른 하나는 지원한 직후에 상태가 바뀐다는 것이다.
 */
export const useMyPostingQuery = (postingId: number | null) =>
  useQuery<MyPosting, AppError>({
    queryKey: ["get-my-posting", postingId],
    queryFn: () => getMyPosting(postingId!),
    enabled: postingId !== null,
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
    void queryClient.invalidateQueries({ queryKey: ["get-my-posting"] });
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
