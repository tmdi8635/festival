import { HttpResponse, delay, http } from "msw";
import { inspectBackupFile, type BackupFile } from "@/type/backup";
import {
  buildBackupFile,
  currentRecordCounts,
  replaceBackupData,
} from "../db/backup";
import { operationLogs } from "../db/ops";
import { BASE_URI, MOCK_DELAY_MS, badRequest } from "../utils";

export const backupHandlers = [
  /** 지금 자료 전체를 백업 파일 한 벌로 내려준다. */
  http.get(`${BASE_URI}/admin/backup/export`, async ({ request }) => {
    const url = new URL(request.url);
    const exportedBy = url.searchParams.get("exportedBy") ?? "알 수 없음";

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(buildBackupFile(exportedBy));
  }),

  /**
   * 자료를 통째로 바꾼다.
   *
   * 서버가 막아야 하는 것은 목업도 막는다. 읽을 수 없는 파일을 받아 두면
   * 서버 연동 뒤에 동작이 달라진다.
   * (형식 판정은 화면에서 이미 하지만, 그건 사용자에게 미리 알려 주기 위한 것이고
   *  실제로 막는 책임은 여기 있다)
   */
  http.post(`${BASE_URI}/admin/backup/import`, async ({ request }) => {
    const body = await request.json();
    const inspection = inspectBackupFile(body);

    if (inspection.compatibility === "INVALID") {
      await delay(MOCK_DELAY_MS);

      return badRequest(inspection.reason, "BACKUP_INVALID");
    }

    if (inspection.compatibility === "NEWER") {
      await delay(MOCK_DELAY_MS);

      return badRequest(inspection.reason, "BACKUP_VERSION_TOO_NEW");
    }

    const before = currentRecordCounts();

    replaceBackupData((body as BackupFile).data);

    /*
      가져오기 기록은 **갈아 끼운 뒤에** 남긴다.
      운영 로그도 백업 대상이라, 먼저 남기면 방금 들어온 자료가 그 줄을 덮어써서
      "데이터를 통째로 바꾼 일"만 흔적 없이 사라진다.
    */
    const { meta } = inspection;

    operationLogs.unshift({
      logId: Math.max(...operationLogs.map((log) => log.logId), 0) + 1,
      level: "WARN",
      domain: "OPS",
      action: "UPDATE",
      actor: "운영자",
      message:
        `백업 가져오기: ${meta?.exportedAt?.slice(0, 10) ?? "-"}에 ` +
        `${meta?.exportedBy ?? "알 수 없음"}이(가) 내보낸 파일(구조 v${meta?.schemaVersion}) 적용`,
      createdAt: new Date().toISOString(),
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({
      before,
      after: currentRecordCounts(),
      meta: inspection.meta,
    });
  }),
];
