import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PermissionGate from "@/components/domain/PermissionGate";
import Skeleton from "@/components/ui/Skeleton";
import SettingsForm from "./_components/SettingsForm";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="기준 설정"
        description="직무 · 시급 · 수당처럼 매번 판단하지 않아도 되는 값을 규칙으로 굳혀 둡니다."
      />

      <PermissionGate required="settings:read">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
          <SettingsForm />
        </Suspense>
      </PermissionGate>
    </>
  );
}
