import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { Application, ApplicationStatus } from "@/type/recruit";

export interface CreateApplicationRequest {
  postingId: number;
  applicantName: string;
  phoneNumber: string;
  note: string;
}

export const createApplication = async (body: CreateApplicationRequest) => {
  const response = await adminAxios.post<Application>(
    "/admin/applications",
    body,
  );

  return response.data;
};

export const updateApplicationStatus = async (
  applicationId: number,
  status: ApplicationStatus,
) => {
  const response = await adminAxios.patch<Application>(
    `/admin/applications/${applicationId}`,
    { status },
  );

  return response.data;
};

/**
 * 지원 등록 · 처리 후 관련 화면을 모두 갱신합니다.
 * 확정은 행사 배치까지 함께 만들기 때문에 캘린더도 함께 무효화합니다.
 */
export const useApplicationMutation = () => {
  const queryClient = useQueryClient();

  const invalidateApplication = () => {
    queryClient.invalidateQueries({ queryKey: ["get-application-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-posting-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-detail"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const createMutation = useMutation<
    Application,
    AppError,
    CreateApplicationRequest
  >({
    mutationFn: createApplication,
    onSuccess: (application) => {
      showAppToast("success", "지원을 등록했습니다.", {
        description: application.isExistingStaff
          ? undefined
          : "인력풀에 없는 지원자입니다. 확정 전에 인사 등록이 필요합니다.",
      });
      invalidateApplication();
    },
  });

  const statusMutation = useMutation<
    Application,
    AppError,
    { applicationId: number; status: ApplicationStatus }
  >({
    mutationFn: ({ applicationId, status }) =>
      updateApplicationStatus(applicationId, status),
    onSuccess: (_, variables) => {
      showAppToast(
        "success",
        variables.status === "ACCEPTED"
          ? "확정 처리했습니다. 행사 배치에 자동으로 반영됩니다."
          : "지원 상태를 변경했습니다.",
      );
      invalidateApplication();
    },
  });

  return { createMutation, statusMutation };
};
