import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import EventManager from "./_components/EventManager";

export default function EventListPage() {
  return (
    <>
      <PageHeader
        title="행사 목록"
        description="발주받은 행사를 검색하고, 인원이 덜 찬 건부터 처리합니다."
      />

      <PermissionGate required="event:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <EventManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
