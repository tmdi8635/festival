import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { Application, ApplicationStatus } from "@/type/recruit";

export interface CreateApplicationRequest {
  postingId: number;
  /** 어느 포지션에 지원했는지. 확정할 때 이 포지션으로 배치된다. */
  positionId: number;
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

/**
 * 확정 결과.
 *
 * 확정은 그 포지션의 발주가 있는 **모든 근무일**에 배치를 만든다. 그런데 그중
 * 하루가 다른 행사와 겹치면 그 하루만 빠지고 나머지는 들어간다. 이때
 * "확정했습니다"만 띄우면 담당자는 전부 채운 줄 알고, 빠진 날은 현장에서 드러난다.
 */
export interface ApplicationStatusResponse extends Application {
  /** 겹쳐서 배치하지 못한 날 안내. 없으면 빈 배열이다 */
  skipped?: string[];
}

export const updateApplicationStatus = async (
  applicationId: number,
  status: ApplicationStatus,
) => {
  const response = await adminAxios.patch<ApplicationStatusResponse>(
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
    ApplicationStatusResponse,
    AppError,
    { applicationId: number; status: ApplicationStatus }
  >({
    mutationFn: ({ applicationId, status }) =>
      updateApplicationStatus(applicationId, status),
    onSuccess: (result, variables) => {
      const skipped = result.skipped ?? [];

      showAppToast(
        skipped.length > 0 ? "warning" : "success",
        variables.status === "ACCEPTED"
          ? "확정 처리했습니다. 행사 배치에 자동으로 반영됩니다."
          : "지원 상태를 변경했습니다.",
        skipped.length > 0 ? { description: skipped.join("\n") } : undefined,
      );
      invalidateApplication();
    },
  });

  return { createMutation, statusMutation };
};
