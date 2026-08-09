import {
  BACKUP_COLLECTION_KEYS,
  BACKUP_SCHEMA_VERSION,
  APP_VERSION,
  type BackupCollectionKey,
  type BackupData,
  type BackupFile,
  type BackupMeta,
} from "@/type/backup";
import { clients } from "./client";
import { contracts, contractTemplates } from "./contract";
import { events } from "./event";
import { messageLogs, messageTemplates } from "./message";
import { managers, operationLogs, operationSettings } from "./ops";
import { payrollItems } from "./payroll";
import { applications, postings } from "./recruit";
import { staffList } from "./staff";

/**
 * 백업 대상 배열을 한곳에 모아 둔다.
 *
 * 여기 빠뜨린 컬렉션은 **조용히 백업에서 빠진다.** 그래서 도메인 배열을 새로 만들면
 * 반드시 이 표에 추가해야 하고, `BackupData`의 키와 짝이 맞지 않으면 타입이 먼저 막는다.
 */
const COLLECTIONS: { [K in BackupCollectionKey]: BackupData[K] } = {
  clients,
  staff: staffList,
  events,
  contractTemplates,
  contracts,
  payrollItems,
  postings,
  applications,
  messageTemplates,
  messageLogs,
  managers,
  operationLogs,
};

/** 지금 목업 DB에 들어 있는 자료를 그대로 담아낸다. */
export const collectBackupData = (): BackupData => ({
  clients,
  staff: staffList,
  events,
  contractTemplates,
  contracts,
  payrollItems,
  postings,
  applications,
  messageTemplates,
  messageLogs,
  managers,
  operationLogs,
  settings: operationSettings,
});

const countRecords = (data: BackupData) =>
  BACKUP_COLLECTION_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: data[key].length }),
    {} as Record<BackupCollectionKey, number>,
  );

/** 지금 상태로 백업 파일 한 벌을 만든다. */
export const buildBackupFile = (exportedBy: string): BackupFile => {
  const data = collectBackupData();

  const meta: BackupMeta = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy,
    source: "MOCK",
    recordCounts: countRecords(data),
  };

  /*
    깊은 복사로 내보낸다. 참조를 그대로 넘기면 직렬화되기 전에 화면에서 값을 바꿨을 때
    파일 내용이 함께 바뀌어, 내려받은 파일이 "받기를 누른 시점"의 상태가 아니게 된다.
  */
  return structuredClone({ meta, data });
};

/**
 * 가져온 자료로 목업 DB를 통째로 갈아 끼운다.
 *
 * 배열을 새로 만들어 대입하지 않고 **제자리에서 비우고 채운다.**
 * 핸들러 · 화면이 이미 이 배열들을 직접 참조하고 있어서, 새 배열로 바꾸면
 * 참조를 들고 있는 쪽은 옛 배열을 계속 보게 된다. (가져오기가 된 것처럼 보이지만
 * 목록은 그대로인 상태가 만들어진다)
 */
export const replaceBackupData = (data: BackupData) => {
  const incoming = structuredClone(data);

  for (const key of BACKUP_COLLECTION_KEYS) {
    const target = COLLECTIONS[key] as unknown[];
    const source = (incoming[key] ?? []) as unknown[];

    target.splice(0, target.length, ...source);
  }

  /*
    기준 설정은 배열이 아니라 객체 하나다.
    옛 키가 남지 않도록 전부 지운 뒤 새 값을 넣는다. (병합하면 없어진 직무가 되살아난다)
  */
  const settingsRecord = operationSettings as unknown as Record<string, unknown>;

  for (const key of Object.keys(settingsRecord)) {
    delete settingsRecord[key];
  }

  Object.assign(operationSettings, incoming.settings);
};

/** 지금 담겨 있는 건수. 가져오기 전후 비교에 쓴다. */
export const currentRecordCounts = () => countRecords(collectBackupData());
