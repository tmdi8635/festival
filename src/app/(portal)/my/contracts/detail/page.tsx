import { Suspense } from "react";
import Skeleton from "@/components/ui/Skeleton";
import MyContractDetail from "@/app/(portal)/my/contracts/_components/MyContractDetail";

/**
 * 계약서 상세 — `/my/contracts/detail?id=`.
 *
 * 번호를 경로가 아니라 쿼리로 받는다. 정적으로 내보내므로 계약서마다 페이지를
 * 미리 찍을 수 없다. `useSearchParams`를 쓰므로 경계가 필요하다.
 */
export default function MyContractDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
      <MyContractDetail />
    </Suspense>
  );
}
