import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import ContractTemplateManager from "./_components/ContractTemplateManager";

export default function ContractTemplatePage() {
  return (
    <>
      <PageHeader
        title="계약서 템플릿"
        description="직무별 계약서 양식을 관리합니다. 금액과 시간은 변수로 두어 사람마다 다르게 채워집니다."
      />

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <ContractTemplateManager />
      </Suspense>
    </>
  );
}
