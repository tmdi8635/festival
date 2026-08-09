"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
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

/** 등장 애니메이션은 Modal과 같은 이유로 CSS 키프레임을 쓴다. */
const Dropdown = ({
  items,
  trigger,
  align = "right",
  className,
}: DropdownProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickAway);

    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [isOpen]);

  const handleSelect = (item: DropdownItem) => {
    setIsOpen(false);
    item.onSelect();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <span onClick={() => setIsOpen((prev) => !prev)}>
        {trigger ?? (
          <IconButton
            label="더보기"
            icon={<Dots size={18} />}
            size="sm"
            aria-expanded={isOpen}
          />
        )}
      </span>

      {isOpen && (
        <ul
          className={cn(
            "animate-slide-up absolute top-full z-50 mt-1 min-w-40 overflow-hidden rounded-field border border-border-main bg-surface py-1 shadow-popover",
            align === "right" ? "right-0" : "left-0",
          )}
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
        </ul>
      )}
    </div>
  );
};

export default Dropdown;
