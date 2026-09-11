import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { MyApplication, MyPosting } from "@/type/my";
import type { Gender, JobRole } from "@/type/staff";

export interface MyPostingListParams {
  role?: JobRole | "";
  /**
   * **내가 설 수 있는 자리가 있는 공고만.**
   *
   * 직무 · 성별 · 보건증을 한 번에 본다. 조건을 축마다 따로 두면 조합을
   * 맞춰 보기 전까지 무엇이 걸러졌는지 알 수 없고, 대부분은 하나만 켠 채
   * 지원할 수 없는 자리를 계속 본다. (날짜 겹침은 `excludeConflicts`가 갖는다)
   */
  onlyMyRoles?: boolean;
  /** 이미 확정된 근무와 날짜가 겹치는 공고를 숨긴다 */
  excludeConflicts?: boolean;
/**
   * **이 날에 근무가 있는** 공고만.
   *
   * 기간이 아니라 하루다. 이 화면에서 하는 질문은 "다음 주 화요일이 비는데
   * 그날 일이 있나"이지 "이 기간에 걸치는 일을 모두 보여 달라"가 아니다.
   * 다일 행사는 그날이 근무일에 들어 있으면 걸린다.
   */
  workDate?: string;
  /**
   * 성별. **비회원만 쓴다.** 회원은 서버가 본인 성별로 거른다.
   * (남성: 성별 무관 + 남성만 / 여성: 성별 무관 + 여성만)
   */
  gender?: Gender | "";
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

/**
 * 지원은 **모집 줄 하나**에 한다. 한 행사의 여러 줄에 걸어 둘 수 있다.
 * 분할 줄이면 나올 수 있는 날을 함께 보낸다(하루 이상). 전일 줄은 보내지 않는다.
 */
export interface ApplyToPostingRequest {
  postingId: number;
  targetId: number;
  dates?: string[];
}

export const applyToPosting = async (body: ApplyToPostingRequest) => {
  const response = await adminAxios.post<MyApplication>(
    "/my/applications",
    body,
  );

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

  const applyMutation = useMutation<
    MyApplication,
    AppError,
    ApplyToPostingRequest
  >({
    mutationFn: applyToPosting,
    onSuccess: (application) => {
      showAppToast("success", `${application.positionName}에 지원했습니다.`, {
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
