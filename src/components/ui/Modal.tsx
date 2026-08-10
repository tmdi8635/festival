"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { Close } from "@/icons";
import { cn } from "@/lib/utils";
import IconButton from "./IconButton";

export type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  /** 푸터 영역. 취소 → 확인 순으로 우측 정렬한다. */
  footer?: ReactNode;
  /**
   * 제목 줄 우측(닫기 버튼 왼쪽) 슬롯.
   *
   * 즐겨찾기처럼 **문서를 닫지 않는 토글**은 푸터에 두면 안 된다.
   * 푸터는 "이 창을 끝내는 동작"(저장 · 취소 · 삭제) 자리라, 거기에 섞으면
   * 별을 누르는 것이 저장인지 아닌지 매번 헷갈린다.
   */
  headerAction?: ReactNode;
  /** 파괴적 작업 모달은 오버레이 클릭으로 닫지 않는다. */
  closeOnOverlayClick?: boolean;
  /**
   * Enter로 실행할 기본 동작. 푸터의 **확인 버튼과 같은 것**을 넘긴다.
   *
   * 넘기지 않으면 Enter는 아무 일도 하지 않는다. 조회용 모달이나
   * 되돌리기 어려운 일을 곧바로 저지르는 모달에는 달지 않는 편이 낫다.
   */
  onSubmit?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * 열려 있는 모달들.
 *
 * 확인 다이얼로그가 폼 모달 위에 겹쳐 뜨는 일이 흔한데,
 * 키 처리를 각자 하면 Enter 한 번에 두 창이 같이 반응하고
 * Escape 한 번에 두 창이 같이 닫힌다. **맨 위 창만** 키를 받는다.
 */
const openStack: symbol[] = [];

/** Enter를 확인으로 받으면 안 되는 자리인지. */
const shouldIgnoreEnter = (event: KeyboardEvent): boolean => {
  /*
    한글은 Enter로 조합을 끝낸다. 그 Enter까지 확인으로 받으면
    이름을 "김승우"까지 치고 마지막 글자를 확정하는 순간 저장돼 버린다.
    (`keyCode === 229`는 조합 중임을 알리는 옛 브라우저의 신호다)
  */
  if (event.isComposing || event.keyCode === 229) return true;

  const target = event.target as HTMLElement | null;

  if (!target) return false;

  // 버튼 · 링크 위에서 Enter는 그것을 누르는 것이다. 확인까지 겹치면 두 번 실행된다.
  if (target.tagName === "BUTTON" || target.tagName === "A") return true;

  if (target.isContentEditable) return true;

  // 여러 줄 칸에서 Enter는 줄바꿈이다. 굳이 보내려면 ⌘(Ctrl)+Enter.
  if (target.tagName === "TEXTAREA" && !event.metaKey && !event.ctrlKey) {
    return true;
  }

  return false;
};

/** 좁은 화면에서는 폭을 강제하지 않는다. `w-full`이 이기고 화면에 맞춰 줄어든다. */
const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "sm:w-[400px]",
  md: "sm:w-[520px]",
  lg: "sm:w-[720px]",
  xl: "sm:w-[960px]",
};

/**
 * 관리자 공통 모달.
 *
 * 등장 애니메이션은 framer-motion의 AnimatePresence가 아니라 CSS 키프레임으로 처리한다.
 * AnimatePresence는 exit 애니메이션이 끝나도 포털 안의 노드를 언마운트하지 못하는 경우가 있는데,
 * 그러면 투명해진 오버레이가 화면에 남아 페이지 전체의 클릭을 막는다.
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  size = "md",
  footer,
  headerAction,
  closeOnOverlayClick = true,
  onSubmit,
  children,
  className,
}: ModalProps) => {
  // SSR 환경에서는 portal 대상이 없으므로 클라이언트에서만 렌더링
  const isClient = useIsClient();

  /* 겹쳐 열린 창들 사이에서 자기를 알아보는 표식. 값 자체에는 뜻이 없다. */
  const idRef = useRef<symbol>(Symbol("modal"));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const id = idRef.current;

    openStack.push(id);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== id) return;

      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Enter" || !onSubmit) return;
      if (shouldIgnoreEnter(event)) return;

      /*
        폼 안에서의 Enter는 브라우저가 이미 submit으로 바꾼다.
        막지 않으면 저장이 두 번 돈다.
      */
      event.preventDefault();
      onSubmit();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      const index = openStack.indexOf(id);

      if (index >= 0) openStack.splice(index, 1);
    };
  }, [isOpen, onClose, onSubmit]);

  /*
    창이 열리면 포커스를 창 안으로 들여온다.

    이걸 하지 않으면 창을 연 단추에 포커스가 그대로 남고, `shouldIgnoreEnter`가
    "버튼 위에서의 Enter"로 보아 걸러 버린다. 그래서 '배치를 해제할까요?' 같은
    확인창에서 Enter가 아무 일도 하지 않았다. 지금 키를 받아야 하는 것은
    **맨 위에 뜬 이 창**이다.

    열고 닫을 때 **한 번씩만** 움직여야 하므로 키 처리와 효과를 나눠 둔다.
    `onSubmit`은 대개 렌더마다 새로 만들어지는 함수라, 한 효과에 묶으면
    글자를 한 자 칠 때마다 포커스가 입력칸에서 창 바깥틀로 튕겨 나간다.
  */
  useEffect(() => {
    if (!isOpen) return;

    // 돌려줄 곳은 열기 직전에 잡아 둔다. 안 되돌리면 닫는 순간 문서 맨 앞으로 튕긴다.
    const previousFocus = document.activeElement as HTMLElement | null;

    panelRef.current?.focus({ preventScroll: true });

    return () => {
      // 이미 화면에서 사라진 요소로 되돌리면 포커스가 body로 떨어진다.
      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  if (!isClient || !isOpen) return null;

  return createPortal(
    <div
      onClick={closeOnOverlayClick ? onClose : undefined}
      className="animate-fade-in fixed inset-0 z-100 flex items-center justify-center bg-overlay p-3 backdrop-blur-[2px] sm:p-6"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        /* 포커스를 받을 수 있어야 Enter · Escape가 이 창의 것이 된다. (탭 순서에는 끼지 않는다) */
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "animate-slide-up flex max-h-[calc(100dvh-24px)] w-full max-w-full flex-col overflow-hidden rounded-modal bg-surface shadow-modal outline-none sm:max-h-[calc(100dvh-96px)]",
          SIZE_CLASS[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-main px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-font-0">{title}</h2>
            {description && (
              <p className="mt-1 text-[13px] text-font-2">{description}</p>
            )}
          </div>

          <div className="-mt-1 -mr-2 flex shrink-0 items-center gap-1">
            {headerAction}

            <IconButton
              label="닫기"
              icon={<Close size={18} />}
              onClick={onClose}
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6 sm:py-5">
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-border-main px-4 py-3.5 sm:px-6 sm:py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
