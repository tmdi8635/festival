import { Suspense } from "react";
import Skeleton from "@/components/ui/Skeleton";
import MyDocumentsEdit from "@/app/(portal)/my/profile/_components/MyDocumentsEdit";

/** 서류 · 계좌 · 보건증 제출. `?focus=`를 읽으므로 경계가 필요하다. */
export default function MyDocumentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-card" />}>
      <MyDocumentsEdit />
    </Suspense>
  );
}
