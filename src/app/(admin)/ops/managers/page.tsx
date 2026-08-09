import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import ManagerBoard from "./_components/ManagerBoard";

export default function ManagerPage() {
  return (
    <>
      <PageHeader
        title="담당자 관리"
        description="내부 계정과 권한을 관리합니다. 업무를 나누려면 매니저 계정부터 만들어야 합니다."
      />

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <ManagerBoard />
      </Suspense>
    </>
  );
}
