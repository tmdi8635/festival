import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import { hydrateOrgSettings } from "@/store/useOrgStore";
import type { AppError } from "@/type/api";
import type { OperationSettings } from "@/type/ops";

export const updateSettings = async (body: OperationSettings) => {
  const response = await adminAxios.put<OperationSettings>(
    "/admin/settings",
    body,
  );

  return response.data;
};

/** 기준 설정 저장 후 관련 화면을 갱신합니다. */
export const useSettingsMutation = () => {
  const queryClient = useQueryClient();

  const updateMutation = useMutation<OperationSettings, AppError, OperationSettings>(
    {
      mutationFn: updateSettings,
      onSuccess: (settings) => {
        showAppToast("success", "기준 설정을 저장했습니다.");
        hydrateOrgSettings(settings);

        /*
          직무 이름과 등급제 on/off는 거의 모든 화면에 영향을 준다.
          설정만 갱신하면 이미 그려진 목록이 옛 직무명을 그대로 달고 있으므로
          직무 · 등급을 참조하는 목록을 함께 무효화한다.
        */
        queryClient.invalidateQueries({ queryKey: ["get-settings"] });
        queryClient.invalidateQueries({ queryKey: ["get-staff-list"] });
        queryClient.invalidateQueries({ queryKey: ["get-event-list"] });
        queryClient.invalidateQueries({ queryKey: ["get-event-calendar"] });
        queryClient.invalidateQueries({ queryKey: ["get-assignment-list"] });
        queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
      },
    },
  );

  return { updateMutation };
};
