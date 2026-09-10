import OrgSettingsLoader from "@/components/layout/OrgSettingsLoader";
import StaffHeader from "@/components/layout/StaffHeader";
import StaffTabBar from "@/components/layout/StaffTabBar";

export const metadata = {
  title: "내 페이지 — 행사 스태프",
  description: "내 일정 · 공고 · 근로계약서 · 정산을 확인합니다.",
};

/**
 * 스태프 포털 공통 레이아웃.
 *
 * 관리자 레이아웃과 나란히 서지만 셸을 공유하지 않는다. 사이드바 · 명령 팔레트 ·
 * 통합검색은 전부 `ADMIN_MENU`에 묶여 있고, 이 화면에는 그중 어느 것도 필요 없다.
 *
 * 루트 `layout.tsx`는 손대지 않았다. 테마 · MSW · react-query · 확인 대화상자 ·
 * 토스터가 거기 있어서 그대로 상속된다.
 *
 * **최소 폭을 두지 않는다.** 관리자 쪽은 표가 찌그러지지 않게 `lg:min-w-[900px]`를
 * 두지만, 여기는 폰이 주 사용처다. 최소 폭이 있으면 폭 390px에서 화면이 통째로
 * 가로로 밀리고, 세로로 내리는 동안에도 좌우로 흔들린다.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full flex-col bg-bg-base">
      {/* 직무 이름 · 단가 기준을 화면들이 공유하도록 여기서 한 번 불러 둔다. */}
      <OrgSettingsLoader />

      <StaffHeader />

      <main className="flex-1 overflow-auto scrollbar-thin">
        {/* 데스크톱에서 가로로 늘어지지 않게 가운데로 모은다. */}
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5">
          {children}
        </div>
      </main>

      <StaffTabBar />
    </div>
  );
}
