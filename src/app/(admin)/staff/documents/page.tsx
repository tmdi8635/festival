import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import DocumentManager from "./_components/DocumentManager";

export default function StaffDocumentPage() {
  return (
    <>
      <PageHeader
        title="서류 관리"
        description="신분증 · 통장사본 제출 현황을 봅니다. 서류가 없으면 정산 계좌를 확정할 수 없습니다."
      />

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <DocumentManager />
      </Suspense>
    </>
  );
}
