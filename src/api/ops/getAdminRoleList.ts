import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { AdminRole } from "@/type/ops";

export const getAdminRoleList = async () => {
  const response = await adminAxios.get<{ items: AdminRole[] }>("/admin/roles");

  return response.data;
};

/** 직책 목록. 담당자 폼과 직책 설정 화면이 함께 쓴다. */
export const useAdminRoleListQuery = () => {
  return useQuery<{ items: AdminRole[] }, AppError>({
    queryKey: ["get-admin-role-list"],
    queryFn: getAdminRoleList,
  });
};
