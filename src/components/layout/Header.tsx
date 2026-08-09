"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ADMIN_MENU, isMenuItemActive } from "@/constants/menu";
import { useIsClient } from "@/hooks/useIsClient";
import { ChevronRight, Menu, Moon, Search, Sun } from "@/icons";
import { useAdminStore } from "@/store/useAdminStore";
import { useSidebarStore } from "@/store/useSidebarStore";
import IconButton from "@/components/ui/IconButton";
import AdminAccountSwitcher from "./AdminAccountSwitcher";
import ViewportModeToggle from "./ViewportModeToggle";

/** 현재 경로에 해당하는 [1뎁스, 2뎁스] 라벨을 찾는다. */
const findBreadcrumb = (pathname: string): string[] => {
  for (const group of ADMIN_MENU) {
    if (
      group.href &&
      (group.href === pathname ||
        (group.href !== "/" && pathname.startsWith(`${group.href}/`)))
    ) {
      return [group.label];
    }

    const child = group.children?.find((item) =>
      isMenuItemActive(item, pathname),
    );

    if (child) return [group.label, child.label];
  }

  return [];
};

const Header = () => {
  const pathname = usePathname();
  const admin = useAdminStore((state) => state.admin);
  const openMobile = useSidebarStore((state) => state.openMobile);
  const { resolvedTheme, setTheme } = useTheme();

  // 테마 아이콘은 하이드레이션 이후에만 렌더링해야 마크업 불일치가 없다.
  const isClient = useIsClient();

  const breadcrumb = findBreadcrumb(pathname);
  const isDark = resolvedTheme === "dark";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border-main bg-surface px-4 lg:gap-4 lg:px-6">
      {/* 좁은 화면에서 사이드바는 덮여 있다. 이 버튼이 메뉴로 가는 유일한 입구다. */}
      <button
        type="button"
        onClick={openMobile}
        aria-label="메뉴 열기"
        className="flex size-9 shrink-0 items-center justify-center rounded-field text-font-1 transition hover:bg-surface-hover lg:hidden"
      >
        <Menu size={20} />
      </button>

      <nav className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13px] text-font-2 lg:flex-none">
        {breadcrumb.map((label, index) => (
          <span key={label} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight size={13} />}
            <span
              className={
                index === breadcrumb.length - 1 ? "text-font-1" : undefined
              }
            >
              {label}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        {/* 실제 열기는 CommandPalette가 전역 단축키로 처리한다. 여기서는 발견 가능성만 제공한다. */}
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true }),
            )
          }
          aria-label="통합 검색"
          className="flex h-8 items-center gap-2 rounded-field border border-border-main px-2 text-[13px] text-font-2 transition hover:bg-surface-hover hover:text-font-1 sm:px-2.5"
        >
          <Search size={15} />
          <span className="hidden sm:inline">통합 검색</span>
          {/* ⌘K는 물리 키보드가 있을 때만 뜻이 있다. */}
          <kbd className="hidden rounded-[5px] bg-subtle px-1.5 py-0.5 text-[11px] lg:inline">
            ⌘K
          </kbd>
        </button>

        {/* 테스트용. 로그인이 붙으면 이 두 줄만 지우면 된다. */}
        <AdminAccountSwitcher />
        <ViewportModeToggle />

        {isClient && (
          <IconButton
            label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
            icon={isDark ? <Sun size={18} /> : <Moon size={18} />}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          />
        )}

        {admin && (
          <div className="flex items-center gap-2.5 border-border-main pl-0 sm:border-l sm:pl-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-opacity text-[13px] font-semibold text-brand">
              {admin.name.slice(0, 1)}
            </span>

            <div className="hidden leading-tight sm:block">
              <p className="text-[13px] font-medium text-font-1">{admin.name}</p>
              <p className="text-[12px] text-font-2">
                {admin.roleName}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
