import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import ScheduleCalendar from "./_components/ScheduleCalendar";

export default function SchedulePage() {
  return (
    <>
      <PageHeader
        title="행사 캘린더"
        description="한 달 일정과 직무별 충원 현황을 한 화면에서 확인합니다. 비어 있는 자리는 붉게 표시됩니다."
      />

      <PermissionGate required="event:read">
        <ScheduleCalendar />
      </PermissionGate>
    </>
  );
}
