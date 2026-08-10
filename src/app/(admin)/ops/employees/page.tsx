import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import EmployeeBoard from "./_components/EmployeeBoard";

export default function EmployeePage() {
  return (
    <>
      <PageHeader
        title="직원 관리"
        description="회사에 소속된 사람의 인적사항과 권한을 관리합니다. 이번 달 근무시간은 '직원 근무'에서 봅니다."
      />

      <PermissionGate required="employee:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <EmployeeBoard />
        </Suspense>
      </PermissionGate>
    </>
  );
}
