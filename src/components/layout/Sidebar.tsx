"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  ADMIN_MENU,
  AdminMenuGroup,
  findActiveGroupKey,
  isMenuItemActive,
} from "@/constants/menu";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { ChevronDown, ChevronLeft, Close } from "@/icons";
import { cn } from "@/lib/utils";
import { useAdminStore } from "@/store/useAdminStore";
import { useOrgStore } from "@/store/useOrgStore";
import { hasPermission, type PermissionKey } from "@/type/permission";
import { useSidebarStore } from "@/store/useSidebarStore";
import Badge from "@/components/ui/Badge";

const Sidebar = () => {
  const pathname = usePathname();
  const {
    isCollapsed,
    openGroupKeys,
    isMobileOpen,
    toggleCollapsed,
    toggleGroup,
    openGroup,
    closeMobile,
  } = useSidebarStore();

  /*
    기능별 운영 모드를 메뉴에 반영한다.
    - LOCKED: 메뉴에서 감춘다. (아직 쓸 수 없는 기능을 눌러 보고 실망하지 않게)
    - MOCK:   'MOCK' 배지를 붙여, 화면은 열리지만 진짜 데이터가 아님을 알린다.
    기준 설정에서 언제든 다시 열 수 있으므로 코드에서 지우지는 않는다.
  */
  const featureModes = useOrgStore((state) => state.featureModes);

  /*
    권한이 없는 화면은 메뉴에서 감춘다.
    열리지도 않는 화면을 목록에 두면 담당자는 매번 눌러 보고 거부당한다.
    (기능 잠금과는 다른 축이다 — 잠금은 "아직 없는 기능",
     권한은 "당신에게 닫힌 기능"이라 안내 문구도 달라야 한다)
  */
  const admin = useAdminStore((state) => state.admin);
  const isAllowed = (permission?: PermissionKey) =>
    !permission ||
    hasPermission(admin?.permissions, permission, admin?.isSuperAdmin);

  /*
    접힌 사이드바(아이콘만 남는 레일)는 넓은 화면에서만 뜻이 있다.
    좁은 화면의 사이드바는 자리를 차지하지 않고 덮여 뜨는 서랍이라,
    접힘까지 물려주면 아이콘만 남은 서랍이 열려 아무것도 고를 수 없다.
  */
  const isDesktop = useIsDesktop();
  const isRail = isCollapsed && isDesktop;

  const isLocked = (feature?: string) =>
    Boolean(feature) && featureModes[feature as never] === "LOCKED";
  const isMock = (feature?: string) =>
    Boolean(feature) && featureModes[feature as never] === "MOCK";

  const activeGroupKey = findActiveGroupKey(pathname);

  // 현재 경로가 속한 그룹은 항상 펼쳐진 상태로 시작한다.
  useEffect(() => {
    if (activeGroupKey) openGroup(activeGroupKey);
  }, [activeGroupKey, openGroup]);

  /*
    메뉴를 고르면 서랍을 닫는다.
    좁은 화면에서 서랍은 본문을 덮고 있으므로, 닫지 않으면 방금 고른 화면이 가려진 채로 남는다.
  */
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  const renderGroup = (group: AdminMenuGroup) => {
    if (isLocked(group.feature)) return null;
    if (group.href && !isAllowed(group.permission)) return null;

    const isActiveGroup = group.key === activeGroupKey;
    const isOpen = openGroupKeys.includes(group.key);
    const visibleChildren =
      group.children?.filter(
        (item) => !isLocked(item.feature) && isAllowed(item.permission),
      ) ?? [];

    // 하위가 전부 잠기면 그룹 자체를 보여 줄 이유가 없다.
    if (!group.href && visibleChildren.length === 0) return null;

    // 하위가 없는 단독 메뉴
    if (group.href) {
      return (
        <li key={group.key}>
          <Link
            href={group.href}
            title={isRail ? group.label : undefined}
            className={cn(
              "flex h-10 items-center gap-2.5 rounded-field px-3 text-[14px] transition",
              isRail && "justify-center px-0",
              isActiveGroup
                ? "bg-surface-selected font-semibold text-brand"
                : "text-font-1 hover:bg-surface-hover",
            )}
          >
            <span className="shrink-0">{group.icon}</span>
            {!isRail && (
              <>
                <span className="flex-1 truncate">{group.label}</span>
                {isMock(group.feature) && (
                  <Badge tone="warning" className="px-1.5 py-0.5 text-[10px]">
                    MOCK
                  </Badge>
                )}
              </>
            )}
          </Link>
        </li>
      );
    }

    return (
      <li key={group.key}>
        <button
          type="button"
          onClick={() => toggleGroup(group.key)}
          title={isRail ? group.label : undefined}
          aria-expanded={isOpen}
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-field px-3 text-[14px] transition",
            isRail && "justify-center px-0",
            isActiveGroup
              ? "font-semibold text-brand"
              : "text-font-1 hover:bg-surface-hover",
          )}
        >
          <span className="shrink-0">{group.icon}</span>

          {!isRail && (
            <>
              <span className="flex-1 truncate text-left">{group.label}</span>
              {isMock(group.feature) && (
                <Badge tone="warning" className="px-1.5 py-0.5 text-[10px]">
                  MOCK
                </Badge>
              )}
              <ChevronDown
                size={15}
                className={cn(
                  "shrink-0 text-font-2 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </>
          )}
        </button>

        {/* grid-rows 전환으로 펼침을 애니메이션한다. 높이를 직접 계산하지 않아 내용이 잘리지 않는다. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            isOpen && !isRail ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <ul className="overflow-hidden">
            {visibleChildren.map((item) => {
              const isActive = isMenuItemActive(item, pathname);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "mt-0.5 flex h-9 items-center gap-2 rounded-field pr-3 pl-9 text-[13px] transition",
                      isActive
                        ? "bg-surface-selected font-semibold text-brand"
                        : "text-font-2 hover:bg-surface-hover hover:text-font-1",
                    )}
                  >
                    <span className="flex-1 truncate">{item.label}</span>

                    {isMock(item.feature) && (
                      <Badge
                        tone="warning"
                        className="px-1.5 py-0.5 text-[10px]"
                      >
                        MOCK
                      </Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </li>
    );
  };

  return (
    <>
      {/* 서랍 뒤를 덮는 배경. 넓은 화면에는 서랍 자체가 없으므로 함께 사라진다. */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          aria-hidden
          className="animate-fade-in fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-border-main bg-surface",
          /*
            좁은 화면에서는 본문 위에 덮이는 서랍이다.
            자리를 차지하게 두면 폭 320px 화면에서 본문에 남는 자리가 60px뿐이다.
          */
          "fixed inset-y-0 left-0 z-60 w-65 transition-transform duration-200",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          /* 넓은 화면에서는 원래대로 자리를 차지하고, 접기 기능이 살아난다. */
          "lg:static lg:z-auto lg:translate-x-0 lg:transition-[width]",
          isRail ? "lg:w-[68px]" : "lg:w-65",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center gap-2 border-b border-border-main px-4",
            isRail && "lg:justify-center lg:px-0",
          )}
        >
          {!isRail && (
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-[8px] bg-brand text-[13px] font-bold text-font-4">
                H
              </span>
              <span className="text-[15px] font-bold text-font-0">
                인력관리 시스템
              </span>
            </Link>
          )}

          {/* 접기는 넓은 화면 전용이다. 서랍에서는 접을 자리가 없다. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={isRail ? "사이드바 펼치기" : "사이드바 접기"}
            className={cn(
              "hidden size-8 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover hover:text-font-1 lg:flex",
              !isRail && "ml-auto",
            )}
          >
            <ChevronLeft
              size={16}
              className={cn("transition-transform", isRail && "rotate-180")}
            />
          </button>

          {/* 좁은 화면에서는 대신 서랍을 닫는다. */}
          <button
            type="button"
            onClick={closeMobile}
            aria-label="메뉴 닫기"
            className="ml-auto flex size-8 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover hover:text-font-1 lg:hidden"
          >
            <Close size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
          <ul className="flex flex-col gap-0.5">
            {ADMIN_MENU.map(renderGroup)}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
