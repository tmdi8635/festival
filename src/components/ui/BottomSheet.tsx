"use client";

import { PointerEvent, ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { Close } from "@/icons";
import { cn } from "@/lib/utils";
import IconButton from "./IconButton";
import { useEscapeLayer } from "./Modal";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /**
   * 시트를 끝내는 동작(제출 · 취소). 본문이 길어도 **항상 보이는 자리**에 둔다.
   * 본문 맨 아래에 붙이면 서명판을 그리느라 스크롤한 사람이 버튼을 못 찾는다.
   */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 이만큼 끌어내리면 닫는다. 살짝 건드린 것까지 닫히면 입력이 날아간다. */
const DISMISS_DISTANCE = 96;

/**
 * 화면 아래에서 올라오는 패널.
 *
 * **폰에서 '지금 이 문서에 대해 하는 일'을 받는 자리다.** (서명 · 수정요청)
 * 가운데 모달은 폰에서 위쪽이 비어 엄지가 닿지 않고, 본문 맨 아래에 폼을 붙이면
 * 문서를 읽던 사람은 폼이 생긴 것조차 모른다. 실제로 수정요청 칸이 모달 맨 아래에
 * 붙어 있어 아무도 알아채지 못했다.
 *
 * - 뒤의 문서가 흐리게 남아 있어 **무엇에 대해** 하는 일인지 잊지 않는다.
 * - 오버레이 · Escape · 손잡이를 끌어내리는 것으로 닫힌다. 셋 다 같은 `onClose`다.
 * - 닫으면 곧바로 사라진다(`Modal`과 같은 이유 — 종료 애니메이션 동안 남은 오버레이가
 *   클릭을 막는다). 안의 입력을 비우는 것은 **부르는 쪽이 시트를 통째로 내려서** 한다.
 */
const BottomSheet = ({
  isOpen,
  onClose,
  title,
  description,
  footer,
  children,
  className,
}: BottomSheetProps) => {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);

  /* 손잡이를 끌어내린 거리. 놓으면 0으로 돌아가거나 닫힌다. */
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  useEscapeLayer(isOpen, onClose);

  /*
    열리면 포커스를 시트 안으로 들인다. 여는 단추에 포커스가 남아 있으면
    스크린리더는 시트가 뜬 것을 모르고, 닫을 때 되돌아갈 자리도 흐려진다.
  */
  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;

    panelRef.current?.focus({ preventScroll: true });

    return () => {
      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
    /* 닫기 단추를 누르는 것까지 끌기로 잡으면 클릭이 먹힌다. */
    if ((event.target as HTMLElement).closest("button")) return;

    dragStartRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current === null) return;

    /* 위로는 끌리지 않는다. 시트가 화면 위로 떠오르면 어디가 끝인지 모른다. */
    setDragOffset(Math.max(0, event.clientY - dragStartRef.current));
  };

  const handleDragEnd = () => {
    if (dragStartRef.current === null) return;

    dragStartRef.current = null;

    if (dragOffset > DISMISS_DISTANCE) onClose();

    setDragOffset(0);
  };

  if (!isClient || !isOpen) return null;

  /* 홈 인디케이터에 가려지지 않게 맨 아래 칸에만 안전 영역만큼 띄운다. */
  const safeAreaStyle = { paddingBottom: "max(16px, env(safe-area-inset-bottom))" };

  return createPortal(
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-100 flex items-end justify-center bg-overlay backdrop-blur-[2px]"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={
          dragOffset > 0
            ? { transform: `translateY(${dragOffset}px)`, transition: "none" }
            : undefined
        }
        className={cn(
          "animate-slide-up flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-modal bg-surface shadow-modal outline-none transition-transform",
          className,
        )}
      >
        {/*
          손잡이 + 제목 줄이 끄는 자리다. 본문까지 끌기로 받으면
          서명판에 선을 긋는 손가락이 시트를 끌어내린다.
        */}
        <div
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          className="shrink-0 cursor-grab touch-none border-b border-border-main active:cursor-grabbing"
        >
          <div className="flex justify-center pt-2.5 pb-1">
            <span className="h-1 w-10 rounded-full bg-border-strong" />
          </div>

          <header className="flex items-start justify-between gap-4 px-4 pt-1 pb-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold text-font-0">{title}</h2>
              {description && (
                <p className="mt-1 text-[13px] text-font-2">{description}</p>
              )}
            </div>

            <IconButton
              label="닫기"
              icon={<Close size={18} />}
              onClick={onClose}
              className="-mt-1 -mr-2 shrink-0"
            />
          </header>
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 scrollbar-thin"
          style={footer ? { paddingBottom: 16 } : safeAreaStyle}
        >
          {children}
        </div>

        {footer && (
          <footer
            className="shrink-0 border-t border-border-main px-4 pt-3"
            style={safeAreaStyle}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default BottomSheet;
