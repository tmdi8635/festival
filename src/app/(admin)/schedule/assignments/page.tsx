import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import AssignmentManager from "./_components/AssignmentManager";

export default function AssignmentPage() {
  return (
    <>
      <PageHeader
        title="배치 · 근태 현황"
        description="행사에 배치된 인력을 사람 기준으로 봅니다. 근태 기록과 계약서 진행 상태를 여기서 확인합니다."
      />

      <PermissionGate required="assignment:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <AssignmentManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
