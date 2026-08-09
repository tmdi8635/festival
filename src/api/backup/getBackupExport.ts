import { adminAxios } from "..";
import type { BackupFile } from "@/type/backup";

/**
 * 지금 자료 전체를 백업 파일 한 벌로 받아 온다.
 *
 * 쿼리 훅을 두지 않고 함수만 둔다. 백업은 **누를 때 그 시점의 값**을 받아야 하는데,
 * react-query에 얹으면 캐시가 남아 두 번째 받기에서 옛 자료가 나갈 수 있다.
 */
export const getBackupExport = async (exportedBy: string) => {
  const response = await adminAxios.get<BackupFile>("/admin/backup/export", {
    params: { exportedBy },
  });

  return response.data;
};
