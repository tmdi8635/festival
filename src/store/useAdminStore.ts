import { create } from "zustand";
import type { ManagerRole } from "@/type/ops";
import { MANAGER_ROLE_LABEL } from "@/type/ops";

export interface AdminProfile {
  managerId: number;
  name: string;
  email: string;
  role: ManagerRole;
}

interface AdminState {
  admin: AdminProfile | null;
  setAdmin: (admin: AdminProfile | null) => void;
}

/**
 * 현재 로그인한 담당자 정보.
 *
 * 서버 인증이 붙기 전까지는 고정 목업 값을 사용한다.
 * 로그인이 붙으면 setAdmin 호출 지점만 교체하면 된다.
 */
const MOCK_ADMIN: AdminProfile = {
  managerId: 1,
  name: "김도윤",
  email: "dy.kim@agency.co.kr",
  role: "OWNER",
};

export const ADMIN_ROLE_LABEL = MANAGER_ROLE_LABEL;

export const useAdminStore = create<AdminState>((set) => ({
  admin: MOCK_ADMIN,
  setAdmin: (admin) => set({ admin }),
}));

/**
 * 계좌 · 정산 금액을 볼 수 있는지 판정한다.
 *
 * 매니저에게 배치와 계약까지는 열어 주되 계좌 정보는 막아야
 * 업무를 나누면서도 개인정보 접근 범위를 좁게 유지할 수 있다.
 */
export const canViewPayrollDetail = (role?: ManagerRole): boolean =>
  role === "OWNER";
