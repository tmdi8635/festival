"use client";

import { useRef, useState } from "react";
import { getBackupExport } from "@/api/backup/getBackupExport";
import { useBackupMutation } from "@/api/backup/mutateBackup";
import { Download, Upload, Warning } from "@/icons";
import { formatDateTime } from "@/lib/dayjs";
import { showAppToast, showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { useAdminStore } from "@/store/useAdminStore";
import {
  BACKUP_COLLECTION_KEYS,
  BACKUP_COLLECTION_LABEL,
  BACKUP_SCHEMA_VERSION,
  buildBackupFileName,
  inspectBackupFile,
  totalRecordCount,
  type BackupCollectionKey,
  type BackupFile,
  type BackupInspection,
} from "@/type/backup";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

/** 판정 결과별 표시. 못 가져오는 이유를 색으로 먼저 알린다. */
const COMPATIBILITY_TONE = {
  OK: "success",
  OLDER: "warning",
  NEWER: "danger",
  INVALID: "danger",
} as const;

const COMPATIBILITY_LABEL = {
  OK: "가져올 수 있음",
  OLDER: "이전 구조",
  NEWER: "버전 높음",
  INVALID: "읽을 수 없음",
} as const;

interface PickedFile {
  name: string;
  raw: BackupFile;
  inspection: BackupInspection;
}

/**
 * 데이터 내보내기 · 가져오기.
 *
 * 이 도구는 사내에서 먼저 쓰다가 나중에 서버로 옮겨 간다.
 * 그래서 **자료를 통째로 들고 나갈 수 있는 길**이 기능 하나가 아니라 전제 조건이다.
 * 옮길 수 없는 자료는 쌓일수록 발이 묶인다.
 *
 * 파일 하나에 모든 것을 담는다. 도메인별로 쪼개면 받는 쪽에서 순서를 맞춰야 하고
 * (거래처 → 인력 → 행사 → 계약 · 정산), 한 파일이라도 빠지면 참조가 끊긴다.
 */
const BackupManager = () => {
  const admin = useAdminStore((state) => state.admin);
  const { importMutation } = useBackupMutation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  /** 마지막으로 내보낸 시각. 가져오기 전에 백업을 받아 뒀는지 스스로 확인하게 한다. */
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const file = await getBackupExport(admin?.name ?? "알 수 없음");
      const blob = new Blob([JSON.stringify(file, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = buildBackupFileName(file.meta.exportedAt);
      anchor.click();

      URL.revokeObjectURL(url);
      setLastExportedAt(file.meta.exportedAt);
      showAppToast(
        "success",
        `${totalRecordCount(file.meta.recordCounts).toLocaleString()}건을 내보냈습니다.`,
      );
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsExporting(false);
    }
  };

  /** 고른 파일을 읽어 판정만 한다. 이 단계에서는 자료를 건드리지 않는다. */
  const handlePickFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());

      setPicked({ name: file.name, raw, inspection: inspectBackupFile(raw) });
    } catch {
      setPicked(null);
      showAppToast("error", "JSON 파일을 읽지 못했습니다. 파일이 손상되었을 수 있습니다.");
    }
  };

  const handleImport = () => {
    if (!picked || picked.inspection.compatibility === "INVALID") return;
    if (picked.inspection.compatibility === "NEWER") return;

    const incoming = totalRecordCount(picked.inspection.actualCounts);

    openConfirm({
      title: "지금 자료를 전부 이 파일로 바꿀까요?",
      description: `${picked.name} · ${incoming.toLocaleString()}건`,
      warning:
        "지금 들어 있는 자료는 남지 않고 사라집니다. 되돌리려면 바꾸기 전에 내보낸 파일이 있어야 합니다.",
      confirmText: "전부 바꾸기",
      tone: "danger",
      onConfirm: async () => {
        await importMutation.mutateAsync(picked.raw);
        setPicked(null);

        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  };

  const canImport =
    picked?.inspection.compatibility === "OK" ||
    picked?.inspection.compatibility === "OLDER";

  return (
    <div className="flex flex-col gap-5">
      <Alert tone="info" title="자료를 옮길 수 있어야 발이 묶이지 않습니다.">
        지금은 자료가 이 브라우저 안에만 있습니다. 파일로 내보내 두면 다른 PC에서
        이어서 쓰거나, 나중에 서버가 생겼을 때 그대로 올릴 수 있습니다.
        <strong className="font-semibold">
          {" "}
          새로고침하면 이번 세션에서 바꾼 내용은 사라집니다.
        </strong>{" "}
        자리를 뜨기 전에 내보내 두세요.
      </Alert>

      {/* ------------------------------- 내보내기 ------------------------------ */}
      <Card
        title="내보내기"
        description="거래처 · 인력 · 행사 · 계약 · 정산 · 설정을 파일 하나에 담습니다."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              leftIcon={<Download size={15} />}
              isLoading={isExporting}
              onClick={handleExport}
            >
              JSON으로 내보내기
            </Button>

            <span className="text-[13px] text-font-2">
              구조 v{BACKUP_SCHEMA_VERSION}
            </span>

            {lastExportedAt && (
              <Badge tone="success">
                방금 내보냄 · {formatDateTime(lastExportedAt)}
              </Badge>
            )}
          </div>

          <p className="text-[13px] text-font-2">
            파일에는 자료뿐 아니라 <strong>언제 · 누가 · 어느 구조로</strong>{" "}
            내보냈는지가 함께 들어갑니다. 파일이 여러 개 쌓였을 때 어느 것이
            최신인지 열어 보지 않고도 알 수 있어야 하기 때문입니다.
          </p>
        </div>
      </Card>

      {/* ------------------------------ 가져오기 ------------------------------ */}
      <Card
        title="가져오기"
        description="내보낸 파일로 지금 자료를 통째로 바꿉니다."
      >
        <div className="flex flex-col gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) handlePickFile(file);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Upload size={15} />}
              onClick={() => fileInputRef.current?.click()}
            >
              백업 파일 고르기
            </Button>

            {picked && (
              <span className="min-w-0 truncate text-[13px] text-font-2">
                {picked.name}
              </span>
            )}
          </div>

          {picked && (
            <div className="flex flex-col gap-3 rounded-field border border-border-main p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={COMPATIBILITY_TONE[picked.inspection.compatibility]}
                >
                  {COMPATIBILITY_LABEL[picked.inspection.compatibility]}
                </Badge>
                <span className="text-[13px] text-font-2">
                  {picked.inspection.reason}
                </span>
              </div>

              {picked.inspection.meta && (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-font-2">내보낸 시각</dt>
                    <dd className="text-font-1 tabular-nums">
                      {formatDateTime(picked.inspection.meta.exportedAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-font-2">내보낸 사람</dt>
                    <dd className="text-font-1">
                      {picked.inspection.meta.exportedBy}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-font-2">구조 버전</dt>
                    <dd className="text-font-1 tabular-nums">
                      v{picked.inspection.meta.schemaVersion}
                      <span className="ml-1 text-font-2">
                        (지금 v{BACKUP_SCHEMA_VERSION})
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-font-2">앱 버전</dt>
                    <dd className="text-font-1 tabular-nums">
                      {picked.inspection.meta.appVersion}
                    </dd>
                  </div>
                </dl>
              )}

              {/*
                건수를 항목별로 펼친다.
                총합만 보여 주면 "행사는 늘었는데 인력이 통째로 빠진" 파일을
                걸러낼 수 없다. 바꾸기 전에 눈으로 확인할 수 있어야 한다.
              */}
              <BackupCountTable counts={picked.inspection.actualCounts} />

              {!canImport && (
                <p className="flex items-start gap-1.5 text-[13px] text-font-error">
                  <Warning size={14} className="mt-0.5 shrink-0" />
                  이 파일은 가져올 수 없습니다.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="danger"
                  leftIcon={<Upload size={15} />}
                  disabled={!canImport}
                  isLoading={importMutation.isPending}
                  onClick={handleImport}
                >
                  전부 바꾸기
                </Button>

                <Button variant="ghost" onClick={() => setPicked(null)}>
                  취소
                </Button>
              </div>
            </div>
          )}

          {!lastExportedAt && (
            <p className="text-[13px] text-font-2">
              바꾸기 전에 지금 자료를 먼저 내보내 두세요. 가져오기는 되돌릴 수
              없습니다.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

/** 컬렉션별 건수 표. 0건인 항목도 감추지 않는다 — 빠진 것을 알아채야 하기 때문이다. */
const BackupCountTable = ({
  counts,
}: {
  counts: Partial<Record<BackupCollectionKey, number>>;
}) => (
  <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
    {BACKUP_COLLECTION_KEYS.map((key) => {
      const count = counts[key] ?? 0;

      return (
        <li
          key={key}
          className="flex items-center justify-between gap-2 text-[13px]"
        >
          <span className="min-w-0 truncate text-font-2">
            {BACKUP_COLLECTION_LABEL[key]}
          </span>
          <span
            className={cn(
              "shrink-0 tabular-nums",
              count === 0 ? "text-font-disabled" : "text-font-1",
            )}
          >
            {count.toLocaleString()}
          </span>
        </li>
      );
    })}
  </ul>
);

export default BackupManager;
