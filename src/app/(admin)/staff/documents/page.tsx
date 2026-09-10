import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import DocumentManager from "./_components/DocumentManager";

export default function StaffDocumentPage() {
  return (
    <>
      <PageHeader
        title="서류 관리"
        description="본인이 올린 신분증 · 통장사본을 확인하고 승인합니다. 승인 전에는 확정 배치를 할 수 없습니다."
      />

      <PermissionGate required="staffDocument:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <DocumentManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
