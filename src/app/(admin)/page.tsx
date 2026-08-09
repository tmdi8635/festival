import PageHeader from "@/components/layout/PageHeader";
import DashboardOverview from "./_components/DashboardOverview";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="대시보드"
        description="오늘 나가야 할 현장, 아직 비어 있는 자리, 밀린 계약서와 정산을 한 화면에서 확인합니다."
      />

      <DashboardOverview />
    </>
  );
}
