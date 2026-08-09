import type { Client } from "./client";
import type { Contract, ContractTemplate } from "./contract";
import type { EventDetail } from "./event";
import type { MessageLog, MessageTemplate } from "./message";
import type { Manager, OperationLog, OperationSettings } from "./ops";
import type { PayrollItem } from "./payroll";
import type { Application, JobPosting } from "./recruit";
import type { StaffDetail } from "./staff";

/**
 * 백업 파일의 **구조 버전**.
 *
 * 앱 버전과 따로 둔다. 화면을 고치는 일은 잦지만 저장 구조가 바뀌는 일은 드물고,
 * 가져오기가 정말로 따져야 하는 건 "이 파일의 모양을 지금 코드가 읽을 수 있는가"
 * 하나뿐이기 때문이다. 앱 버전으로 판단하면 아무것도 안 바뀐 배포마다
 * 멀쩡한 백업이 거부된다.
 *
 * **필드를 지우거나 뜻을 바꿀 때만 올린다.** 필드를 더하는 것은 올리지 않는다.
 * (옛 파일에 새 필드가 없는 건 기본값으로 메울 수 있다)
 */
export const BACKUP_SCHEMA_VERSION = 1;

/** 이 코드가 읽을 수 있는 가장 낮은 구조 버전. */
export const MIN_SUPPORTED_SCHEMA_VERSION = 1;

/** package.json과 맞춘다. 어느 배포에서 뽑았는지 추적하는 용도다. */
export const APP_VERSION = "0.1.0";

/** 백업에 담기는 자료 묶음. 키 하나가 목업 DB의 배열 하나에 대응한다. */
export interface BackupData {
  clients: Client[];
  staff: StaffDetail[];
  events: EventDetail[];
  contractTemplates: ContractTemplate[];
  contracts: Contract[];
  payrollItems: PayrollItem[];
  postings: JobPosting[];
  applications: Application[];
  messageTemplates: MessageTemplate[];
  messageLogs: MessageLog[];
  managers: Manager[];
  operationLogs: OperationLog[];
  /** 직무 · 수당 · 기능 잠금 등 기준 설정 전체 */
  settings: OperationSettings;
}

/** `BackupData`에서 배열인 키만 추린다. 건수 세기 · 검증에서 함께 쓴다. */
export type BackupCollectionKey = Exclude<keyof BackupData, "settings">;

export const BACKUP_COLLECTION_KEYS: BackupCollectionKey[] = [
  "clients",
  "staff",
  "events",
  "contractTemplates",
  "contracts",
  "payrollItems",
  "postings",
  "applications",
  "messageTemplates",
  "messageLogs",
  "managers",
  "operationLogs",
];

/** 화면에 그대로 쓰는 한국어 이름. */
export const BACKUP_COLLECTION_LABEL: Record<BackupCollectionKey, string> = {
  clients: "거래처",
  staff: "인력",
  events: "행사",
  contractTemplates: "계약서 템플릿",
  contracts: "근로계약서",
  payrollItems: "정산",
  postings: "모집 공고",
  applications: "지원자",
  messageTemplates: "문자 템플릿",
  messageLogs: "발송 이력",
  managers: "담당자",
  operationLogs: "운영 로그",
};

/**
 * 파일에 함께 남기는 정보.
 *
 * 자료만 있으면 나중에 파일 여러 개를 놓고 **어느 것이 최신인지, 어디서 뽑은 것인지**
 * 알 수 없다. 실제로 백업이 쓸모없어지는 이유는 대부분 자료가 아니라 이 정보가 없어서다.
 */
export interface BackupMeta {
  schemaVersion: number;
  appVersion: string;
  /** ISO 일시 */
  exportedAt: string;
  /** 내보낸 담당자 이름. 여러 사람이 쓰는 도구라 누가 뽑았는지가 남아야 한다. */
  exportedBy: string;
  /** 목업에서 뽑았는지 실제 서버에서 뽑았는지. 서버 이전 뒤에 섞이면 곤란하다. */
  source: "MOCK" | "SERVER";
  /** 컬렉션별 건수. 파일을 열어 보지 않고도 규모를 가늠할 수 있다. */
  recordCounts: Record<BackupCollectionKey, number>;
}

export interface BackupFile {
  meta: BackupMeta;
  data: BackupData;
}

/** 가져오기 전에 판정한 결과. */
export type BackupCompatibility =
  /** 그대로 읽을 수 있다. */
  | "OK"
  /** 구조가 더 낮다. 없는 필드는 기본값으로 메워 읽는다. */
  | "OLDER"
  /** 더 새로운 앱에서 뽑았다. 지금 코드가 모르는 구조라 읽지 않는다. */
  | "NEWER"
  /** 백업 파일이 아니거나 망가졌다. */
  | "INVALID";

export interface BackupInspection {
  compatibility: BackupCompatibility;
  /** 사람이 읽을 판정 사유. 화면에 그대로 띄운다. */
  reason: string;
  meta: BackupMeta | null;
  /** 실제로 담겨 있던 컬렉션별 건수 (meta를 믿지 않고 다시 센다) */
  actualCounts: Partial<Record<BackupCollectionKey, number>>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 파일을 읽어도 되는지 판정한다.
 *
 * **meta의 건수를 믿지 않고 자료를 직접 센다.** 손으로 고친 파일이 흔하고,
 * meta만 보고 넘기면 "12건이라 적혀 있는데 3건만 들어온" 상태가 조용히 만들어진다.
 */
export const inspectBackupFile = (raw: unknown): BackupInspection => {
  const empty = { compatibility: "INVALID" as const, meta: null, actualCounts: {} };

  if (!isObject(raw) || !isObject(raw.meta) || !isObject(raw.data)) {
    return { ...empty, reason: "백업 파일 형식이 아닙니다. (meta · data가 없습니다)" };
  }

  const meta = raw.meta as unknown as BackupMeta;
  const data = raw.data as Record<string, unknown>;

  if (typeof meta.schemaVersion !== "number") {
    return { ...empty, reason: "구조 버전(schemaVersion)이 없습니다." };
  }

  /*
    버전을 **자료 모양보다 먼저** 본다.
    더 새로운 앱이 만든 파일은 구조가 달라진 게 당연한데, 모양부터 따지면
    "거래처 · 인력 …이 없습니다"라는 엉뚱한 이유를 대게 된다.
    진짜 이유는 하나다 — 이 파일은 지금 코드가 판단할 대상이 아니다.
  */
  if (meta.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      compatibility: "NEWER",
      reason: `더 새로운 버전(구조 v${meta.schemaVersion})에서 만든 파일입니다. 지금 이 화면은 v${BACKUP_SCHEMA_VERSION}까지 읽을 수 있습니다. 앱을 먼저 올려 주세요.`,
      meta,
      actualCounts: {},
    };
  }

  if (meta.schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
    return {
      compatibility: "INVALID",
      reason: `너무 낮은 구조 버전(v${meta.schemaVersion})입니다. v${MIN_SUPPORTED_SCHEMA_VERSION} 이상만 읽을 수 있습니다.`,
      meta,
      actualCounts: {},
    };
  }

  const actualCounts: Partial<Record<BackupCollectionKey, number>> = {};
  const missing: string[] = [];

  for (const key of BACKUP_COLLECTION_KEYS) {
    const value = data[key];

    if (!Array.isArray(value)) {
      missing.push(BACKUP_COLLECTION_LABEL[key]);
      continue;
    }

    actualCounts[key] = value.length;
  }

  if (!isObject(data.settings)) missing.push("기준 설정");

  if (missing.length > 0) {
    return {
      compatibility: "INVALID",
      reason: `다음 항목이 없거나 형식이 잘못됐습니다: ${missing.join(" · ")}`,
      meta,
      actualCounts,
    };
  }

  if (meta.schemaVersion < BACKUP_SCHEMA_VERSION) {
    return {
      compatibility: "OLDER",
      reason: `이전 구조(v${meta.schemaVersion})입니다. 지금 구조(v${BACKUP_SCHEMA_VERSION})로 맞춰서 가져옵니다.`,
      meta,
      actualCounts,
    };
  }

  return { compatibility: "OK", reason: "바로 가져올 수 있습니다.", meta, actualCounts };
};

/** 내보낼 때 붙일 파일 이름. 정렬하면 시간순이 되도록 날짜를 앞에 둔다. */
export const buildBackupFileName = (exportedAt: string) => {
  const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, "").replace(/-/g, "");

  return `festival-backup-v${BACKUP_SCHEMA_VERSION}-${stamp}.json`;
};

/** 컬렉션 건수를 모두 더한 값. "총 몇 건짜리 백업인가"를 한 줄로 보여 줄 때 쓴다. */
export const totalRecordCount = (
  counts: Partial<Record<BackupCollectionKey, number>>,
) => BACKUP_COLLECTION_KEYS.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
