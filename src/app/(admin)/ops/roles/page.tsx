import PageHeader from "@/components/layout/PageHeader";
import RoleManager from "./_components/RoleManager";

export default function RolePage() {
  return (
    <>
      <PageHeader
        title="직책 · 권한"
        description="직책을 만들고 할 수 있는 일을 정합니다. 담당자는 직책에 배정합니다."
      />

      <RoleManager />
    </>
  );
}
