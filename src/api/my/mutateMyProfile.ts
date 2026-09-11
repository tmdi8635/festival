import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type {
  MyDocumentFormValues,
  MyHealthCertFormValues,
  MyProfile,
  MyProfileFormValues,
} from "@/type/my";

export const updateMyProfile = async (body: MyProfileFormValues) => {
  const response = await adminAxios.put<MyProfile>("/my/profile", body);

  return response.data;
};

export const updateMyDocuments = async (body: MyDocumentFormValues) => {
  const response = await adminAxios.put<MyProfile>("/my/documents", body);

  return response.data;
};

export const updateMyHealthCert = async (body: MyHealthCertFormValues) => {
  const response = await adminAxios.put<MyProfile>("/my/health-cert", body);

  return response.data;
};

/**
 * 내 정보 변경.
 *
 * 인적사항은 곧바로 반영되고, 서류 · 계좌 · 보건증은 **승인 대기로 들어간다.**
 * 성공 토스트가 그 차이를 말해 주지 않으면 본인은 다 끝난 줄 알고 현장에 나선다.
 */
export const useMyProfileMutation = () => {
  const queryClient = useQueryClient();

  /*
    관리자 화면도 함께 되돌린다. 서류를 내면 인력 목록의 상태(대기중 · 활동중)와
    서류 관리 화면의 대기열이 곧바로 달라져야 한다. 포털과 관리자를 나란히 열어 두고
    확인하는 일이 실제로 이 프로젝트의 확인 방식이다.
  */
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["get-my-profile"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["get-staff-list"] });
    void queryClient.invalidateQueries({ queryKey: ["get-staff-detail"] });
    void queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const profileMutation = useMutation<MyProfile, AppError, MyProfileFormValues>({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      showAppToast("success", "내 정보를 저장했습니다.");
      invalidate();
    },
  });

  const documentMutation = useMutation<
    MyProfile,
    AppError,
    MyDocumentFormValues
  >({
    mutationFn: updateMyDocuments,
    onSuccess: () => {
      showAppToast(
        "success",
        "서류를 제출했습니다. 담당자 승인 후 근무를 확정할 수 있습니다.",
      );
      invalidate();
    },
  });

  const healthCertMutation = useMutation<
    MyProfile,
    AppError,
    MyHealthCertFormValues
  >({
    mutationFn: updateMyHealthCert,
    onSuccess: () => {
      showAppToast("success", "보건증을 제출했습니다.", {
        description: "담당자가 승인하면 보건증이 필요한 자리에 지원할 수 있어요.",
      });
      invalidate();
      /* 공고의 '보건증 필요' 포지션 버튼이 풀리는지가 여기에 달려 있다. */
      void queryClient.invalidateQueries({ queryKey: ["get-my-postings"] });
      void queryClient.invalidateQueries({ queryKey: ["get-my-posting"] });
    },
  });

  return { profileMutation, documentMutation, healthCertMutation };
};
