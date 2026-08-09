import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { BackupCollectionKey, BackupFile, BackupMeta } from "@/type/backup";

export interface BackupImportResult {
  before: Record<BackupCollectionKey, number>;
  after: Record<BackupCollectionKey, number>;
  meta: BackupMeta | null;
}

export const importBackup = async (file: BackupFile) => {
  const response = await adminAxios.post<BackupImportResult>(
    "/admin/backup/import",
    file,
  );

  return response.data;
};

/**
 * 백업 가져오기.
 *
 * 자료를 통째로 갈아 끼우므로 **캐시를 통째로 버린다.**
 * 쿼리키를 하나씩 무효화하면 빠뜨린 화면이 옛 자료를 계속 보여 주는데,
 * 그게 정산 금액이나 배치 명단이면 없는 사람에게 돈을 보내는 일이 된다.
 */
export const useBackupMutation = () => {
  const queryClient = useQueryClient();

  const importMutation = useMutation<BackupImportResult, AppError, BackupFile>({
    mutationFn: importBackup,
    onSuccess: () => {
      showAppToast("success", "백업을 가져왔습니다.");
      queryClient.invalidateQueries();
    },
  });

  return { importMutation };
};
