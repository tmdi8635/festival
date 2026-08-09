import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import ContractManager from "./_components/ContractManager";

export default function ContractPage() {
  return (
    <>
      <PageHeader
        title="근로계약서 관리"
        description="행사 배치에서 계약서를 일괄로 만들고, 발송과 서명 상태를 추적합니다."
      />

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <ContractManager />
      </Suspense>
    </>
  );
}
