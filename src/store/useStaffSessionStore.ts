import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StaffSessionState {
  /** 지금 포털에 접속한 인력의 ID */
  staffId: number;
  setStaffId: (staffId: number) => void;
}

/**
 * 스태프 포털(`/my`)에 접속한 사람이 누구인가.
 *
 * 관리자 쪽 `useAdminStore`와 **일부러 갈라 둔다.** 같은 스토어에 담으면
 * "지금 이 요청이 관리자가 보낸 것인가 본인이 보낸 것인가"를 구분할 수 없고,
 * 그 순간 본인만 볼 수 있어야 하는 계좌 · 평판이 관리자 권한으로 새는 문이 생긴다.
 *
 * 로그인이 붙으면 기본값 대신 세션에서 꺼낸 값을 넣는 것으로 끝난다.
 * 나머지 코드는 이 스토어가 어디서 채워졌는지 모른다.
 *
 * 새로고침해도 남게 저장한다. 목업 자료는 새로고침하면 되돌아가지만
 * "누구로 보고 있었는가"까지 함께 되돌아가면 확인이 매번 처음부터가 된다.
 */
export const useStaffSessionStore = create<StaffSessionState>()(
  persist(
    (set) => ({
      /* 시드 인력의 첫 번째. 서버가 붙으면 세션이 정한다. */
      staffId: 1,
      setStaffId: (staffId) => set({ staffId }),
    }),
    { name: "hr-staff-session" },
  ),
);
