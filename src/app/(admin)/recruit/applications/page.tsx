import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import ApplicationManager from "./_components/ApplicationManager";

export default function ApplicationPage() {
  return (
    <>
      <PageHeader
        title="지원자 관리"
        description="문자로 받은 지원을 목록으로 관리합니다. 확정하면 행사 배치까지 한 번에 처리됩니다."
      />

      <PermissionGate required="recruit:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <ApplicationManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
