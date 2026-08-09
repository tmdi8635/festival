import PageHeader from "@/components/layout/PageHeader";
import BackupManager from "./_components/BackupManager";

export default function BackupPage() {
  return (
    <>
      <PageHeader
        title="데이터 백업"
        description="자료 전체를 파일 하나로 내보내고, 그 파일로 되돌립니다. 다른 PC로 옮기거나 서버로 이전할 때 씁니다."
      />

      <BackupManager />
    </>
  );
}
