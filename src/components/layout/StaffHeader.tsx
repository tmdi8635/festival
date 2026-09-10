"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useMyProfileQuery } from "@/api/my/getMyProfile";
import { staffPageTitle } from "@/constants/staffMenu";
import { useIsClient } from "@/hooks/useIsClient";
import { Moon, ShieldCheck, Sun } from "@/icons";
import IconButton from "@/components/ui/IconButton";
import StaffAccountSwitcher from "./StaffAccountSwitcher";

/**
 * 포털 헤더.
 *
 * 관리자 `Header`를 재사용하지 않는다. 그쪽은 `ADMIN_MENU`로 브레드크럼을 만들고
 * 통합검색·사이드바 토글을 들고 있는데, 여기에는 그 셋 중 어느 것도 없다.
 * 뎁스가 얕아 브레드크럼 대신 화면 이름 하나면 충분하다.
 */
const StaffHeader = () => {
  const pathname = usePathname();
  const { data: profile } = useMyProfileQuery();
  const { resolvedTheme, setTheme } = useTheme();

  // 테마 아이콘은 하이드레이션 이후에만 렌더링해야 마크업 불일치가 없다.
  const isClient = useIsClient();
  const isDark = resolvedTheme === "dark";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border-main bg-surface px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="truncate text-[17px] font-semibold text-font-0">
          {staffPageTitle(pathname)}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {/*
          관리자 화면으로 건너가는 길.

          이것도 테스트용이다. 실제로는 근로자와 담당자가 다른 계정이라 한 사람이
          두 화면을 오갈 일이 없지만, 만들면서 확인하려면 양쪽을 나란히 열어 두고
          "여기서 승인하면 저기가 어떻게 바뀌는가"를 봐야 한다.
        */}
        <Link
          href="/"
          title="관리자 화면으로"
          aria-label="관리자 화면으로"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-field text-font-2 transition hover:bg-surface-hover hover:text-font-1 active:scale-[0.94]"
        >
          <ShieldCheck size={18} />
        </Link>

        <StaffAccountSwitcher />

        {isClient && (
          <IconButton
            size="lg"
            label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
            icon={isDark ? <Sun size={18} /> : <Moon size={18} />}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          />
        )}

        {profile && (
          <span className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-opacity text-[13px] font-semibold text-brand">
            {profile.name.slice(0, 1)}
          </span>
        )}
      </div>
    </header>
  );
};

export default StaffHeader;
