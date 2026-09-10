"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STAFF_MENU, isStaffMenuActive } from "@/constants/staffMenu";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/hooks/useIsClient";
import { useStaffSessionStore } from "@/store/useStaffSessionStore";

/**
 * 포털의 하단 탭.
 *
 * 관리자 사이드바를 쓰지 않는다. 이 화면을 여는 사람은 대부분 현장으로 가는 길 위에
 * 한 손으로 폰을 쥐고 있고, 엄지가 닿는 곳은 화면 아래다.
 *
 * 넓은 화면에서도 아래에 둔다. 폭에 따라 메뉴가 옆으로 옮겨 가면
 * 같은 사람이 폰과 노트북에서 다른 화면을 익혀야 한다. 대신 가운데로 모아
 * 데스크톱에서 가로로 늘어져 보이지 않게 한다.
 */
const StaffTabBar = () => {
  const pathname = usePathname();
  const staffId = useStaffSessionStore((state) => state.staffId);
  const isClient = useIsClient();

  /*
    비회원에게는 공개 화면만 남긴다. 눌러도 안내문만 나오는 탭을 네 칸
    세워 두면, 로그인하지 않은 사람에게는 앱 전체가 고장난 것으로 보인다.
  */
  const items =
    isClient && staffId === null
      ? STAFF_MENU.filter((item) => item.isPublic)
      : STAFF_MENU;

  return (
    <nav
      /*
        홈 인디케이터가 있는 폰에서 마지막 탭이 가려진다.
        `env(safe-area-inset-bottom)`만큼 아래를 더 띄운다.
      */
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      className="shrink-0 border-t border-border-main bg-surface"
    >
      <ul className="mx-auto flex w-full max-w-lg items-stretch">
        {items.map((item) => {
          const isActive = isStaffMenuActive(item.href, pathname);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 transition",
                  isActive
                    ? "text-brand"
                    : "text-font-2 hover:text-font-1 active:scale-[0.98]",
                )}
              >
                {item.icon}
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default StaffTabBar;
