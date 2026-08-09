import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import ClientManager from "./_components/ClientManager";

export default function ClientPage() {
  return (
    <>
      <PageHeader
        title="거래처 관리"
        description="발주처별 청구 단가와 누적 마진을 관리합니다."
      />

      <PermissionGate required="client:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <ClientManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
