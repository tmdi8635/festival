"use client";

import { useEffect } from "react";
import { useIsClient } from "@/hooks/useIsClient";
import { Monitor, Phone } from "@/icons";
import {
  DESKTOP_VIEWPORT_WIDTH,
  useViewportStore,
} from "@/store/useViewportStore";
import IconButton from "@/components/ui/IconButton";

const AUTO_CONTENT = "width=device-width, initial-scale=1";
const DESKTOP_CONTENT = `width=${DESKTOP_VIEWPORT_WIDTH}, initial-scale=1`;

/**
 * 모바일 · 데스크톱 배치를 오가는 **테스트용** 버튼.
 *
 * 폰에서는 창 크기를 바꿀 수 없어 넓은 배치를 확인할 방법이 없다.
 * viewport 메타의 `width`를 갈아 끼우면 브라우저가 그 폭의 화면인 것처럼 렌더링하고,
 * `lg:` 미디어 쿼리가 그 값을 보므로 배치 전체가 데스크톱으로 바뀐다.
 *
 * CSS를 건드리지 않는다는 점이 중요하다. 화면마다 예외를 넣기 시작하면
 * 그 예외가 진짜 배치와 달라져서, 정작 확인하려던 것을 확인하지 못한다.
 */
const ViewportModeToggle = () => {
  const { mode, toggleMode } = useViewportStore();

  // 저장된 값은 하이드레이션 뒤에 들어오므로, 그전에는 아이콘을 그리지 않는다.
  const isClient = useIsClient();
  const isDesktopMode = mode === "DESKTOP";

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');

    if (!meta) return;

    meta.setAttribute("content", isDesktopMode ? DESKTOP_CONTENT : AUTO_CONTENT);
  }, [isDesktopMode]);

  if (!isClient) return null;

  return (
    <IconButton
      label={
        isDesktopMode
          ? "모바일 배치로 보기 (지금은 데스크톱 배치)"
          : "데스크톱 배치로 보기 (지금은 기기 폭 그대로)"
      }
      icon={isDesktopMode ? <Phone size={18} /> : <Monitor size={18} />}
      onClick={toggleMode}
      className={isDesktopMode ? "text-brand" : undefined}
    />
  );
};

export default ViewportModeToggle;
