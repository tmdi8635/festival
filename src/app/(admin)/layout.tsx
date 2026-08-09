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
          관리자 콘솔은 데스크톱 전용이다.
          좁은 창에서 레이아웃이 무너지는 대신 가로 스크롤이 생기도록 최소 폭을 둔다.
        */}
        <main className="flex-1 overflow-auto bg-bg-base scrollbar-thin">
          <div className="flex min-w-[900px] flex-col gap-6 px-8 py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
