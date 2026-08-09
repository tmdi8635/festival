import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import LogManager from "./_components/LogManager";

export default function LogPage() {
  return (
    <>
      <PageHeader
        title="운영 로그"
        description="누가 무엇을 바꿨는지 기록합니다. 변경 요청은 자동으로 쌓입니다."
      />

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <LogManager />
      </Suspense>
    </>
  );
}
