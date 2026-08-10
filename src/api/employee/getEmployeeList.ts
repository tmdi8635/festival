import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { Employee } from "@/type/employee";

export interface EmployeeListParams {
  keyword?: string;
  /** 직책으로 좁히기 */
  roleId?: string;
  /** 퇴사자까지 볼 것인지 */
  includeRetired?: boolean;
}

export interface EmployeeListResponse {
  items: Employee[];
  summary: {
    totalCount: number;
    activeCount: number;
    /** 최고관리자 수. 한 명뿐이면 그 계정을 잃었을 때 되돌릴 방법이 없다. */
    superAdminCount: number;
  };
}

export const getEmployeeList = async (params: EmployeeListParams) => {
  const response = await adminAxios.get<EmployeeListResponse>(
    "/admin/employees",
    { params },
  );

  return response.data;
};

/** 직원 명부. 인적사항 · 회사 직책 · 시스템 권한을 봅니다. */
export const useEmployeeListQuery = (params: EmployeeListParams) =>
  usePermittedQuery<EmployeeListResponse>("employee:read", {
    queryKey: ["get-employee-list", params],
    queryFn: () => getEmployeeList(params),
  });

/* ------------------------------------------------------------------ */
/* 직책 선택지                                                          */
/* ------------------------------------------------------------------ */

export interface EmployeeRoleOption {
  roleId: number;
  name: string;
  description: string;
  isSuperAdmin: boolean;
  memberCount: number;
}

export const getEmployeeRoleList = async () => {
  const response = await adminAxios.get<{ items: EmployeeRoleOption[] }>(
    "/admin/employee-roles",
  );

  return response.data;
};

/**
 * 직원 폼에서 고르는 직책 목록.
 *
 * 직책 설정 화면(`role:read`)과 따로 둔 이유가 있다. 직원을 등록하려면
 * 직책을 반드시 골라야 하는데, 직책 설정 권한이 없으면 선택지가 통째로 비어
 * 등록 자체가 막힌다. 직책을 **고르는 것**과 직책의 권한을 **바꾸는 것**은
 * 위험도가 다르다.
 */
export const useEmployeeRoleListQuery = () =>
  usePermittedQuery<{ items: EmployeeRoleOption[] }>("employee:read", {
    queryKey: ["get-employee-role-list"],
    queryFn: getEmployeeRoleList,
  });
