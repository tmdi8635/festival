import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import EmployeeWorkBoard from "./_components/EmployeeWorkBoard";

export default function EmployeeWorkPage() {
  return (
    <>
      <PageHeader
        title="직원 근무"
        description="달마다 직원이 얼마나 일했는지 봅니다. 기본 근무시간을 얼마나 채웠는지, 어느 행사에 며칠 나갔는지가 함께 나옵니다."
      />

      <PermissionGate required="employee:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <EmployeeWorkBoard />
        </Suspense>
      </PermissionGate>
    </>
  );
}
