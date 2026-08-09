import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  /** 사이드바 축소 여부 (축소 시 1뎁스 아이콘만 노출) */
  isCollapsed: boolean;
  /** 펼쳐진 1뎁스 그룹 키 목록 */
  openGroupKeys: string[];
  /**
   * 좁은 화면에서 사이드바를 서랍으로 열었는지 여부.
   *
   * 넓은 화면의 `isCollapsed`와는 다른 값이다. 좁은 화면에서는 사이드바가
   * 자리를 차지하지 않고 본문 위에 덮여 뜨기 때문에, "접혔나"가 아니라
   * "떠 있나"를 물어야 한다.
   */
  isMobileOpen: boolean;

  toggleCollapsed: () => void;
  toggleGroup: (key: string) => void;
  openGroup: (key: string) => void;
  openMobile: () => void;
  closeMobile: () => void;
}

/** 펼침 상태는 라우팅 간 유지되어야 하므로 로컬 스토리지에 저장한다. */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      isCollapsed: false,
      openGroupKeys: [],
      isMobileOpen: false,

      toggleCollapsed: () =>
        set((state) => ({ isCollapsed: !state.isCollapsed })),

      openMobile: () => set({ isMobileOpen: true }),
      closeMobile: () => set({ isMobileOpen: false }),

      toggleGroup: (key) =>
        set((state) => ({
          openGroupKeys: state.openGroupKeys.includes(key)
            ? state.openGroupKeys.filter((openKey) => openKey !== key)
            : [...state.openGroupKeys, key],
        })),

      openGroup: (key) => {
        if (get().openGroupKeys.includes(key)) return;

        set((state) => ({ openGroupKeys: [...state.openGroupKeys, key] }));
      },
    }),
    {
      name: "hr-admin-sidebar",
      /**
       * 서랍이 열린 상태는 저장하지 않는다.
       * 저장하면 다음에 들어올 때 사이드바가 본문을 덮은 채로 시작한다.
       */
      partialize: ({ isCollapsed, openGroupKeys }) => ({
        isCollapsed,
        openGroupKeys,
      }),
    },
  ),
);
