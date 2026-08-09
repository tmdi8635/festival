"use client";

import { ReactNode, useEffect } from "react";
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
  /** 파괴적 작업 모달은 오버레이 클릭으로 닫지 않는다. */
  closeOnOverlayClick?: boolean;
  children: ReactNode;
  className?: string;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "w-[400px]",
  md: "w-[520px]",
  lg: "w-[720px]",
  xl: "w-[960px]",
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
  closeOnOverlayClick = true,
  children,
  className,
}: ModalProps) => {
  // SSR 환경에서는 portal 대상이 없으므로 클라이언트에서만 렌더링
  const isClient = useIsClient();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isClient || !isOpen) return null;

  return createPortal(
    <div
      onClick={closeOnOverlayClick ? onClose : undefined}
      className="animate-fade-in fixed inset-0 z-100 flex items-center justify-center bg-overlay p-6 backdrop-blur-[2px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "animate-slide-up flex max-h-[calc(100vh-96px)] max-w-full flex-col overflow-hidden rounded-modal bg-surface shadow-modal",
          SIZE_CLASS[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-main px-6 py-4">
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
            className="-mt-1 -mr-2"
          />
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-border-main px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
