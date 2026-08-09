import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * - `AUTO`:    기기 폭을 그대로 쓴다. 폰에서는 좁은 배치가 나온다. (기본값)
 * - `DESKTOP`: 기기가 좁아도 1280px 화면인 척한다. 넓은 배치가 축소되어 보인다.
 */
export type ViewportMode = "AUTO" | "DESKTOP";

/** 강제 데스크톱 모드에서 흉내 낼 폭. `lg`(1024px)를 넉넉히 넘겨야 넓은 배치가 나온다. */
export const DESKTOP_VIEWPORT_WIDTH = 1280;

interface ViewportState {
  mode: ViewportMode;
  toggleMode: () => void;
}

/**
 * 화면 폭을 강제로 바꿔 보는 **테스트용** 상태.
 *
 * 폰에서 데스크톱 배치를 확인하려면 창 크기를 바꿀 방법이 없다.
 * 그래서 viewport 메타의 `width`를 갈아 끼워 브라우저에게 "이 화면은 1280px이다"라고
 * 알려 준다. 미디어 쿼리(`lg:`)가 그 값을 보므로 배치가 통째로 데스크톱으로 바뀐다.
 * 모바일 브라우저의 '데스크톱 사이트 요청'과 같은 원리다.
 *
 * 확인이 끝나면 `ViewportModeToggle`을 헤더에서 빼면 된다. 나머지 코드는 이 값을 모른다.
 */
export const useViewportStore = create<ViewportState>()(
  persist(
    (set) => ({
      mode: "AUTO",
      toggleMode: () =>
        set((state) => ({ mode: state.mode === "AUTO" ? "DESKTOP" : "AUTO" })),
    }),
    { name: "hr-admin-viewport" },
  ),
);
