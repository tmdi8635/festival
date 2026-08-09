import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { Manager, ManagerFormValues } from "@/type/ops";

export const createManager = async (body: ManagerFormValues) => {
  const response = await adminAxios.post<Manager>("/admin/managers", body);

  return response.data;
};

export const updateManager = async (
  managerId: number,
  body: ManagerFormValues,
) => {
  const response = await adminAxios.put<Manager>(
    `/admin/managers/${managerId}`,
    body,
  );

  return response.data;
};

export const deleteManager = async (managerId: number) => {
  await adminAxios.delete(`/admin/managers/${managerId}`);
};

/** 담당자 등록 · 수정 · 삭제 후 목록을 갱신합니다. */
export const useManagerMutation = () => {
  const queryClient = useQueryClient();

  const invalidateManager = () =>
    queryClient.invalidateQueries({ queryKey: ["get-manager-list"] });

  const createMutation = useMutation<Manager, AppError, ManagerFormValues>({
    mutationFn: createManager,
    onSuccess: () => {
      showAppToast("success", "담당자를 추가했습니다.");
      invalidateManager();
    },
  });

  const updateMutation = useMutation<
    Manager,
    AppError,
    { managerId: number; body: ManagerFormValues }
  >({
    mutationFn: ({ managerId, body }) => updateManager(managerId, body),
    onSuccess: () => {
      showAppToast("success", "담당자 정보를 저장했습니다.");
      invalidateManager();
    },
  });

  const deleteMutation = useMutation<void, AppError, number>({
    mutationFn: deleteManager,
    onSuccess: () => {
      showAppToast("success", "담당자를 삭제했습니다.");
      invalidateManager();
    },
  });

  return { createMutation, updateMutation, deleteMutation };
};
