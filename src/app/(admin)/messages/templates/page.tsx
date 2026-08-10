import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import MessageTemplateManager from "./_components/MessageTemplateManager";

export default function MessageTemplatePage() {
  return (
    <>
      <PageHeader
        title="메시지 템플릿"
        description="상황별 문구를 미리 만들어 두면 바쁠 때도 공지가 빠지지 않습니다."
      />

      <PermissionGate required="message:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <MessageTemplateManager />
        </Suspense>
      </PermissionGate>
    </>
  );
}
