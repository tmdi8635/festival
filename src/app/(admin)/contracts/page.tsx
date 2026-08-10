import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import ContractManager from "./_components/ContractManager";

export default function ContractPage() {
  return (
    <>
      <PageHeader
        title="근로계약서 관리"
        description="확정 배치된 인력 전원을 행사 너머로 모아 봅니다. 아직 계약서를 못 쓴 사람이 맨 위에 옵니다."
      />

      <PermissionGate required="contract:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <ContractManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
