import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import PostingManager from "./_components/PostingManager";

export default function PostingPage() {
  return (
    <>
      <PageHeader
        title="공고 관리"
        description="행사에서 부족한 자리를 공고로 만듭니다. 공고문을 복사해 오픈카톡방에 그대로 올릴 수 있습니다."
      />

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <PostingManager />
      </Suspense>
    </>
  );
}
