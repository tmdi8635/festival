import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import MessageHistory from "./_components/MessageHistory";

export default function MessageHistoryPage() {
  return (
    <>
      <PageHeader
        title="발송 이력"
        description="언제 누구에게 무엇을 보냈는지 기록으로 남깁니다."
      />

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <MessageHistory />
      </Suspense>
    </>
  );
}
