import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import EmployeeManager from "./_components/EmployeeManager";

export default function EmployeePage() {
  return (
    <>
      <PageHeader
        title="직원 관리"
        description="월급을 받는 우리 직원입니다. 행사에서는 직무와 관계없이 어느 자리에나 배치할 수 있고, 근로계약서와 시급 정산에서는 빠집니다."
      />

      <PermissionGate required="employee:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <EmployeeManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
