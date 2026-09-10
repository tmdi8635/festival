import { Suspense } from "react";
import Skeleton from "@/components/ui/Skeleton";
import MyPostingBoard from "./_components/MyPostingBoard";

export default function MyPostingPage() {
  return (
    /* `?tab=`을 읽으므로 경계가 필요하다. (`useSearchParams`) */
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
      <MyPostingBoard />
    </Suspense>
  );
}
