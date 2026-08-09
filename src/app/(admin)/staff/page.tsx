import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import StaffManager from "./_components/StaffManager";

export default function StaffPage() {
  return (
    <>
      <PageHeader
        title="인력풀"
        description="인적사항 · 서류 · 참여 이력 · 메모를 한 사람 단위로 모아 봅니다."
      />

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <StaffManager />
      </Suspense>
    </>
  );
}
