"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STAFF_MENU, isStaffMenuActive } from "@/constants/staffMenu";
import { useIsClient } from "@/hooks/useIsClient";
import { Megaphone, UserCheck } from "@/icons";
import { useStaffSessionStore } from "@/store/useStaffSessionStore";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

/**
 * 로그인이 필요한 화면을 비회원에게서 가린다.
 *
 * **화면마다 걸지 않고 여기 한 곳에서 건다.** 여섯 화면에 같은 검사를 흩어 놓으면
 * 다음에 화면이 하나 늘 때 반드시 한 곳을 빠뜨리고, 그때 새는 것은
 * 남의 계좌와 평판이다. 어느 주소가 공개인지는 메뉴(`STAFF_MENU`)가 갖는다.
 *
 * 목업은 실제로도 막는다 — `X-Staff-Id`가 없으면 `/my/*` 핸들러가 401을 낸다.
 * 이 컴포넌트는 그 401을 화면에서 만나지 않게 미리 돌려세우는 것뿐이다.
 */
const StaffSessionGate = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const staffId = useStaffSessionStore((state) => state.staffId);

  /*
    저장된 신원은 하이드레이션 뒤에 들어온다. 그 전에 판정하면 서버가 그린
    마크업과 어긋나고, 로그인한 사람도 첫 순간에 안내문을 한 번 보게 된다.
  */
  const isClient = useIsClient();

  const isPublicPath = STAFF_MENU.some(
    (item) => item.isPublic && isStaffMenuActive(item.href, pathname),
  );

  if (!isClient || staffId !== null || isPublicPath) return <>{children}</>;

  return (
    <Card>
      <EmptyState
        icon={<UserCheck size={28} />}
        title="로그인이 필요한 화면입니다."
        description="내 일정 · 근로계약서 · 정산은 본인만 볼 수 있습니다. 공고는 로그인하지 않아도 둘러볼 수 있습니다."
      />

      <div className="mt-4 flex justify-center">
        <Link href="/postings">
          <Button leftIcon={<Megaphone size={15} />}>공고 보러 가기</Button>
        </Link>
      </div>
    </Card>
  );
};

export default StaffSessionGate;
