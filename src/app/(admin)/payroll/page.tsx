import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import PayrollManager from "./_components/PayrollManager";

export default function PayrollPage() {
  return (
    <>
      <PageHeader
        title="정산 관리"
        description="행사가 끝난 배치의 지급액을 계산하고, 은행 이체용 파일을 내려받습니다."
      />

      <PermissionGate required="payroll:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <PayrollManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
