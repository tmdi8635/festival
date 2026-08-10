import { create } from "zustand";
import {
  hasPermission,
  type PermissionAction,
  type PermissionKey,
  type PermissionResource,
} from "@/type/permission";

/**
 * 현재 로그인한 직원.
 *
 * 예전 이름은 '담당자'였는데, 담당자와 직원이 같은 사람이라 하나로 합쳤다.
 * (`type/employee.ts`)
 */
export interface AdminProfile {
  employeeId: number;
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
 * 서버 인증이 붙기 전까지 쓰는 고정 목업 계정.
 *
 * 로그인이 붙으면 `setAdmin`을 부르는 지점만 바꾸면 되고, 권한 판정은 그대로 산다.
 */
const MOCK_ADMIN: AdminProfile = {
  employeeId: 1,
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

/**
 * 최고관리자인가.
 *
 * **권한 키로 표현할 수 없는 일에만** 쓴다. 지금은 근무 평가 삭제 하나다.
 * 평가는 한 번 남기면 고칠 수 없어야 공정한데(그래야 나중에 이해관계가
 * 생겼을 때 지난 평가를 손보지 못한다), 잘못 남긴 것을 되돌릴 길은 있어야 한다.
 * 그 길을 `staff:write` 같은 일상 권한에 붙이면 결국 아무나 지우게 되므로
 * 되돌릴 책임을 지는 한 사람에게만 연다.
 *
 * 다른 곳에서는 쓰지 않는다. 직책 이름이나 계정 종류로 판단하기 시작하면
 * 직책을 새로 만드는 순간 규칙이 어긋난다.
 */
export const useIsSuperAdmin = (): boolean =>
  useAdminStore((state) => Boolean(state.admin?.isSuperAdmin));

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
