import { create } from "zustand";
import {
  hasPermission,
  type PermissionAction,
  type PermissionKey,
  type PermissionResource,
} from "@/type/permission";

export interface AdminProfile {
  managerId: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  /** 최고관리자는 권한 목록을 보지 않고 전부 통과한다. */
  isSuperAdmin: boolean;
  permissions: PermissionKey[];
}

interface AdminState {
  admin: AdminProfile | null;
  setAdmin: (admin: AdminProfile | null) => void;
}

/**
 * 현재 로그인한 담당자.
 *
 * 서버 인증이 붙기 전까지는 고정 목업 값을 쓴다.
 * 로그인이 붙으면 `setAdmin`을 부르는 지점만 바꾸면 되고, 권한 판정은 그대로 산다.
 */
const MOCK_ADMIN: AdminProfile = {
  managerId: 1,
  name: "김도윤",
  email: "dy.kim@agency.co.kr",
  roleId: 1,
  roleName: "최고관리자",
  isSuperAdmin: true,
  permissions: [],
};

export const useAdminStore = create<AdminState>((set) => ({
  admin: MOCK_ADMIN,
  setAdmin: (admin) => set({ admin }),
}));

/* ------------------------------------------------------------------ */
/* 권한 판정                                                            */
/* ------------------------------------------------------------------ */

/**
 * 권한이 있는지 묻는다. **화면에서는 이 훅만 쓴다.**
 *
 * 직책 이름으로 판단하면("대표면 되겠지") 직책을 새로 만드는 순간 어긋난다.
 * 판단 기준은 언제나 권한 키 하나다.
 */
export const useHasPermission = (required: PermissionKey): boolean =>
  useAdminStore((state) =>
    hasPermission(state.admin?.permissions, required, state.admin?.isSuperAdmin),
  );

/** 여러 권한 중 하나라도 있는지. 메뉴처럼 "무엇이든 볼 수 있으면 연다"에 쓴다. */
export const useHasAnyPermission = (required: PermissionKey[]): boolean =>
  useAdminStore((state) =>
    required.some((key) =>
      hasPermission(state.admin?.permissions, key, state.admin?.isSuperAdmin),
    ),
  );

/**
 * 컴포넌트 밖(모듈 스코프 · 이벤트 핸들러)에서 묻는다.
 * 훅을 쓸 수 없는 자리에서만 사용한다.
 */
export const checkPermission = (required: PermissionKey): boolean => {
  const { admin } = useAdminStore.getState();

  return hasPermission(admin?.permissions, required, admin?.isSuperAdmin);
};

export const can = (
  resource: PermissionResource,
  action: PermissionAction,
): boolean => checkPermission(`${resource}:${action}`);
