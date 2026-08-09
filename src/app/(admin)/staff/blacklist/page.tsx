import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import BlacklistManager from "./_components/BlacklistManager";

export default function BlacklistPage() {
  return (
    <>
      <PageHeader
        title="블랙리스트"
        description="배치 대상에서 제외된 인력과 그 사유를 관리합니다. 노쇼가 기준 횟수를 넘긴 인력은 후보로 함께 보여 줍니다."
      />

      <PermissionGate required="blacklist:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <BlacklistManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
