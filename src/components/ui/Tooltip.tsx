"use client";

import { ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  /** 말풍선에 담을 내용. 여러 줄이어도 된다. */
  content: ReactNode;
  /** 말풍선을 띄울 대상. 하나의 요소를 감싼다. */
  children: ReactNode;
  className?: string;
}

/** 화면 밖으로 넘치지 않게 좌우를 물려 두는 여백 */
const EDGE_GAP = 8;

/** 커서가 스쳐 지나갈 때마다 뜨지 않도록 두는 지연 */
const OPEN_DELAY_MS = 150;

/**
 * 우리 디자인으로 그린 말풍선.
 *
 * 브라우저 기본 `title`은 뜨기까지 1초 넘게 걸리고, 폰트 · 색 · 줄바꿈이
 * 운영체제 것이라 화면 안에서 혼자 다른 물건처럼 보인다. 무엇보다
 * **여러 줄로 정리해서 보여 줄 수가 없다.** 캘린더 막대처럼 한 줄에
 * 제목밖에 못 담는 자리에서는 거기 못 담은 것들(거래처 · 시간 · 담당자)이
 * 곧 알고 싶은 값이라, 그것들을 줄 맞춰 보여 줄 자리가 필요하다.
 *
 * 위치는 **띄울 때 한 번** 잰다. 스크롤 · 리사이즈를 따라다니지 않는다.
 * 말풍선이 떠 있는 동안 화면을 굴리는 일은 거의 없고, 따라다니게 만들면
 * 캘린더 한 장에 마흔 개의 리스너가 붙는다.
 */
const Tooltip = ({ content, children, className }: TooltipProps) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    isAbove: boolean;
  } | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const open = () => {
    clearTimer();

    timerRef.current = window.setTimeout(() => {
      const anchor = anchorRef.current?.getBoundingClientRect();

      if (!anchor) return;

      /*
        기본은 대상 위쪽 가운데다. 위가 좁으면 아래로 내려 붙인다.
        캘린더 첫 주에서 위로 띄우면 헤더에 가려 아무것도 안 보인다.
      */
      const isAbove = anchor.top > 160;

      setPosition({
        isAbove,
        top: isAbove ? anchor.top - 8 : anchor.bottom + 8,
        /* 좌우로 넘치면 화면 안쪽으로 물린다. 잘린 말풍선은 읽을 수 없다. */
        left: Math.min(
          Math.max(anchor.left + anchor.width / 2, 150 + EDGE_GAP),
          window.innerWidth - 150 - EDGE_GAP,
        ),
      });
    }, OPEN_DELAY_MS);
  };

  const close = () => {
    clearTimer();
    setPosition(null);
  };

  return (
    <span
      ref={anchorRef}
      onMouseEnter={open}
      onMouseLeave={close}
      /* 키보드로 훑는 사람에게도 같은 내용이 보여야 한다. */
      onFocus={open}
      onBlur={close}
      className={cn("relative inline-flex", className)}
    >
      {children}

      {position && (
        <span
          role="tooltip"
          style={{
            top: position.top,
            left: position.left,
            transform: `translate(-50%, ${position.isAbove ? "-100%" : "0"})`,
          }}
          className="animate-fade-in pointer-events-none fixed z-200 w-[300px] max-w-[calc(100vw-16px)] rounded-field border border-border-main bg-surface px-3 py-2.5 text-left shadow-modal"
        >
          {content}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
