import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import MessageComposer from "@/components/domain/MessageComposer";

export default function MessageSendPage() {
  return (
    <>
      <PageHeader
        title="문자 발송"
        description="행사 확정자에게 출근 안내와 계약서 요청을 한 번에 보냅니다."
      />

      <PermissionGate required="message:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <MessageComposer />
        </Suspense>
      </PermissionGate>
    </>
  );
}
