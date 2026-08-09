import CommandPalette from "@/components/layout/CommandPalette";
import Header from "@/components/layout/Header";
import OrgSettingsLoader from "@/components/layout/OrgSettingsLoader";
import Sidebar from "@/components/layout/Sidebar";

/**
 * 관리자 공통 레이아웃.
 *
 * 전체 화면 높이를 고정하고 워크스페이스 영역만 스크롤한다.
 * 로그인/권한 가드가 필요해지면 이 파일 한 곳만 수정한다.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full">
      {/* 직무 · 등급제 · 기능 잠금 기준을 모든 화면이 공유하도록 여기서 한 번 불러 둔다. */}
      <OrgSettingsLoader />
      <CommandPalette />
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        {/*
          넓은 화면에서는 표가 찌그러지지 않도록 최소 폭을 두고, 부족하면 가로로 스크롤한다.

          좁은 화면에서는 그 최소 폭을 걷어낸다.
          최소 폭이 남아 있으면 폭 390px 화면에서 페이지 전체가 900px로 버티는 바람에
          모든 화면이 가로로 밀리고, 세로 스크롤을 내리는 동안에도 좌우로 흔들린다.
          넓어야 하는 건 페이지가 아니라 표다. 표는 자기 안에서 스크롤한다. (`Table`)
        */}
        <main className="flex-1 overflow-auto bg-bg-base scrollbar-thin">
          <div className="flex min-w-0 flex-col gap-5 px-4 py-5 lg:min-w-[900px] lg:gap-6 lg:px-8 lg:py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
