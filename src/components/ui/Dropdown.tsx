"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { Dots } from "@/icons";
import { cn } from "@/lib/utils";
import IconButton from "./IconButton";

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
}

interface DropdownProps {
  items: DropdownItem[];
  /** 기본 트리거는 점 3개 아이콘 버튼이다. */
  trigger?: ReactNode;
  align?: "left" | "right";
  className?: string;
}

/** 메뉴 한 칸 높이 + 위아래 여백. 아래로 펼칠 자리가 있는지 가늠할 때 쓴다. */
const ITEM_HEIGHT = 36;
const MENU_PADDING = 8;

/**
 * 더보기 메뉴.
 *
 * **메뉴는 `body`로 빼서 그린다.** 표 안에서 열리는 일이 대부분인데,
 * 제자리(`absolute`)에 두면 두 가지가 한꺼번에 어긋난다.
 *
 * 1. 표의 행이 `transform`을 갖는 순간(등장 애니메이션 등) 행마다 쌓임 맥락이 생겨,
 *    `z-50`을 줘도 **다음 행이 메뉴 위로 올라온다.** 실제로 그렇게 깨져 있었다.
 * 2. 표는 가로 스크롤을 위해 `overflow-x-auto`를 갖는데, 한 축이 `auto`면
 *    나머지 축도 `visible`이 아니게 되어 **아래로 펼친 메뉴가 잘린다.**
 *
 * 조상이 무엇을 하든 영향을 받지 않아야 하는 요소라, 아예 밖으로 꺼낸다.
 */
const Dropdown = ({
  items,
  trigger,
  align = "right",
  className,
}: DropdownProps) => {
  const isClient = useIsClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, right: 0 });

  /** 트리거 위치를 재서 메뉴를 놓을 자리를 정한다. */
  const measure = () => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect) return;

    const menuHeight = items.length * ITEM_HEIGHT + MENU_PADDING;
    /*
      아래로 펼칠 자리가 없으면 위로 펼친다.
      화면 끝에 있는 행에서 메뉴가 화면 밖으로 나가면 마지막 항목(대개 '삭제')을
      아예 누를 수 없다.
    */
    const opensUpward =
      rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight;

    setPosition({
      top: opensUpward ? rect.top - menuHeight - 4 : rect.bottom + 4,
      left: rect.left,
      right: window.innerWidth - rect.right,
    });
  };

  const handleOpen = () => {
    measure();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    /*
      스크롤하면 닫는다.
      `body`에 붙어 있어 따라 움직이지 않으므로, 열어 둔 채 스크롤하면
      메뉴만 제자리에 남아 엉뚱한 행 옆에 떠 있게 된다.
    */
    const handleClose = () => setIsOpen(false);

    document.addEventListener("mousedown", handleClickAway);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);

    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [isOpen]);

  const handleSelect = (item: DropdownItem) => {
    setIsOpen(false);
    item.onSelect();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <span onClick={handleOpen}>
        {trigger ?? (
          <IconButton
            label="더보기"
            icon={<Dots size={18} />}
            size="sm"
            aria-expanded={isOpen}
          />
        )}
      </span>

      {isClient &&
        isOpen &&
        createPortal(
          <ul
            ref={menuRef}
            style={
              align === "right"
                ? { top: position.top, right: position.right }
                : { top: position.top, left: position.left }
            }
            className="animate-slide-up fixed z-100 min-w-40 overflow-hidden rounded-field border border-border-main bg-surface py-1 shadow-popover"
          >
            {items.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition",
                    "disabled:pointer-events-none disabled:opacity-40",
                    item.tone === "danger"
                      ? "text-danger hover:bg-danger-bg"
                      : "text-font-1 hover:bg-surface-hover",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
};

export default Dropdown;
