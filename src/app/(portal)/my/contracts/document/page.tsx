import { Suspense } from "react";
import Skeleton from "@/components/ui/Skeleton";
import MyContractDocument from "@/app/(portal)/my/contracts/_components/MyContractDocument";

/**
 * 계약서 전문 — `/my/contracts/document?id=`. 서명 · 수정요청은 여기서만 받는다.
 * (정적 내보내기라 번호는 쿼리로 받는다. `useSearchParams` 경계가 필요하다)
 */
export default function MyContractDocumentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-card" />}>
      <MyContractDocument />
    </Suspense>
  );
}
