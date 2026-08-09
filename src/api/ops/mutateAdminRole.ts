import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { AdminRole, AdminRoleFormValues } from "@/type/ops";

export const createAdminRole = async (body: AdminRoleFormValues) => {
  const response = await adminAxios.post<AdminRole>("/admin/roles", body);

  return response.data;
};

export const updateAdminRole = async (
  roleId: number,
  body: AdminRoleFormValues,
) => {
  const response = await adminAxios.put<AdminRole>(
    `/admin/roles/${roleId}`,
    body,
  );

  return response.data;
};

export const deleteAdminRole = async (roleId: number) => {
  await adminAxios.delete(`/admin/roles/${roleId}`);
};

/**
 * 직책 생성 · 수정 · 삭제.
 *
 * 권한이 바뀌면 **지금 보고 있는 화면이 곧바로 달라져야 한다.**
 * 방금 정산 권한을 뺐는데 그 사람 화면에 승인 버튼이 남아 있으면,
 * 눌렀을 때 서버가 막아 주더라도 "되는 줄 알았다"는 경험이 남는다.
 * 그래서 캐시를 통째로 버린다.
 */
export const useAdminRoleMutation = () => {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries();

  const createMutation = useMutation<AdminRole, AppError, AdminRoleFormValues>({
    mutationFn: createAdminRole,
    onSuccess: () => {
      showAppToast("success", "직책을 만들었습니다.");
      invalidate();
    },
  });

  const updateMutation = useMutation<
    AdminRole,
    AppError,
    { roleId: number; body: AdminRoleFormValues }
  >({
    mutationFn: ({ roleId, body }) => updateAdminRole(roleId, body),
    onSuccess: () => {
      showAppToast("success", "직책 권한을 저장했습니다.");
      invalidate();
    },
  });

  const deleteMutation = useMutation<void, AppError, number>({
    mutationFn: deleteAdminRole,
    onSuccess: () => {
      showAppToast("success", "직책을 삭제했습니다.");
      invalidate();
    },
  });

  return { createMutation, updateMutation, deleteMutation };
};
