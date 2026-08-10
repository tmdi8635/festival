"use client";

import { useState } from "react";
import { useFileUploadMutation } from "@/api/file/postFileUpload";
import { useContractMutation } from "@/api/contract/mutateContract";
import { Check, Warning } from "@/icons";
import { cn } from "@/lib/utils";
import {
  contractNameTag,
  parseContractFileName,
  type ContractStatus,
} from "@/type/contract";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ContractUploadZone, {
  SIGNED_CONTRACT_MIME_TYPES,
} from "./ContractUploadZone";

/** 서명본을 붙일 수 있는 명단 한 줄. */
export interface BulkUploadTarget {
  staffId: number;
  staffName: string;
  staffPhone: string;
  /** 재작성으로 이미 만들어진 차수. 있으면 그 차수에 파일을 붙인다. */
  contractId?: number;
  /** 이미 서명본이 등록돼 있는지 */
  isRegistered: boolean;
  status?: ContractStatus;
}

interface ContractBulkUploadModalProps {
  isOpen: boolean;
  targets: BulkUploadTarget[];
  templateId?: number;
  eventId: number;
  onClose: () => void;
}

type ResultState = "SUCCESS" | "FAILED";

interface UploadResult {
  fileName: string;
  state: ResultState;
  /** 붙은 사람 또는 실패한 이유 */
  message: string;
}

/**
 * 서명본 여러 장을 한 번에 등록한다.
 *
 * **이건 기존 등록 절차를 바꾸는 것이 아니라 편의 기능이다.**
 * 한 명씩 올리는 길은 그대로 있고, 여기서 하는 일도 결국 같은 등록 요청이다.
 * 다만 스캐너로 서른 장을 한 번에 뜬 폴더를 그대로 끌어다 놓을 수 있게 한다.
 *
 * 가능한 이유는 **파일명이 규칙이기 때문이다.** (`buildContractFileName`)
 * `261231_행사명_이름.pdf`에서 이름을 읽어 명단과 맞춘다.
 * 그래서 이름을 고쳐 버린 파일은 주인을 찾지 못하고, 그건 실패로 남겨야 한다.
 *
 * ## 실패를 반드시 세어 보여 준다
 *
 * 서른 장을 던져 놓고 "완료"만 뜨면 담당자는 다 된 줄 안다.
 * 그런데 두 장이 조용히 빠져 있으면 그 두 사람은 계약서 없이 현장에 선다.
 * 그래서 **성공 수와 실패 수를 나란히 세고, 실패한 파일은 이유와 함께 남긴다.**
 * 무엇을 다시 해야 하는지가 이 화면에서 끝나야 한다.
 */
const ContractBulkUploadModal = ({
  isOpen,
  targets,
  templateId,
  eventId,
  onClose,
}: ContractBulkUploadModalProps) => {
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const { mutateAsync: uploadFile } = useFileUploadMutation();
  const { registerMutation } = useContractMutation();

  const isRunning = progress !== null;

  const handleClose = () => {
    if (isRunning) return;

    setResults(null);
    setProgress(null);
    onClose();
  };

  /**
   * 파일 하나의 주인을 찾는다.
   *
   * 못 찾은 이유를 문장으로 돌려준다. "실패 3건"만 알면 고칠 수가 없다.
   */
  const resolveTarget = (
    fileName: string,
  ): { target: BulkUploadTarget } | { error: string } => {
    const parsed = parseContractFileName(fileName);

    if (!parsed) {
      return {
        error:
          "파일명을 읽을 수 없습니다. 내려받은 이름(261231_행사명_이름.pdf)을 그대로 두세요.",
      };
    }

    const matched = targets.filter(
      (target) => target.staffName === parsed.staffName,
    );

    if (matched.length === 0) {
      return { error: `명단에 '${parsed.staffName}'이(가) 없습니다.` };
    }

    if (matched.length > 1) {
      if (!parsed.nameTag) {
        return {
          error: `동명이인이 ${matched.length}명입니다. 파일명 끝에 휴대폰 뒤 네 자리를 붙여 주세요. (${parsed.staffName}(0000))`,
        };
      }

      const byTag = matched.filter(
        (target) => contractNameTag(target.staffPhone) === parsed.nameTag,
      );

      if (byTag.length !== 1) {
        return {
          error: `'${parsed.staffName}(${parsed.nameTag})'과 맞는 사람이 명단에 없습니다.`,
        };
      }

      return { target: byTag[0] };
    }

    /*
      뒤 네 자리가 적혀 있는데 그 사람과 다르면 막는다.
      동명이인이 아니게 된 뒤에도 예전 파일이 폴더에 남아 있을 수 있고,
      그 파일은 다른 사람 것일 가능성이 있다.
    */
    if (
      parsed.nameTag &&
      contractNameTag(matched[0].staffPhone) !== parsed.nameTag
    ) {
      return {
        error: `'${parsed.staffName}'의 번호와 파일명의 (${parsed.nameTag})이 다릅니다.`,
      };
    }

    return { target: matched[0] };
  };

  const handleFiles = async (files: File[]) => {
    setResults(null);
    setProgress({ done: 0, total: files.length });

    const collected: UploadResult[] = [];

    /*
      한 장씩 차례로 처리한다. 한꺼번에 던지면 같은 사람에게 두 장이 들어가는
      경합이 생기고, 실패한 것이 어느 파일이었는지도 흐려진다.
    */
    for (const file of files) {
      const push = (state: ResultState, message: string) => {
        collected.push({ fileName: file.name, state, message });
        setProgress({ done: collected.length, total: files.length });
      };

      if (!SIGNED_CONTRACT_MIME_TYPES.includes(file.type)) {
        push("FAILED", "PDF 또는 이미지가 아닙니다.");
        continue;
      }

      const resolved = resolveTarget(file.name);

      if ("error" in resolved) {
        push("FAILED", resolved.error);
        continue;
      }

      if (resolved.target.isRegistered) {
        push(
          "FAILED",
          `${resolved.target.staffName}님은 이미 등록돼 있습니다. 바꾸려면 상세에서 등록을 취소한 뒤 올려 주세요.`,
        );
        continue;
      }

      try {
        const uploaded = await uploadFile({
          fileType: "CONTRACT_SIGNED",
          file,
        });

        await registerMutation.mutateAsync({
          ...(resolved.target.contractId
            ? { contractId: resolved.target.contractId }
            : { eventId, staffId: resolved.target.staffId, templateId }),
          fileUrl: uploaded.originalUrl,
          fileName: file.name,
          mimeType: file.type,
        });

        push("SUCCESS", `${resolved.target.staffName}님에게 등록했습니다.`);
      } catch (error) {
        push(
          "FAILED",
          error instanceof Error ? error.message : "등록하지 못했습니다.",
        );
      }
    }

    setResults(collected);
    setProgress(null);
  };

  const successCount = results?.filter((item) => item.state === "SUCCESS").length ?? 0;
  const failedCount = results?.filter((item) => item.state === "FAILED").length ?? 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="서명본 일괄 등록"
      description="스캔한 폴더를 통째로 끌어다 놓으세요. 파일명으로 근로자를 찾아 각자에게 등록합니다."
      size="lg"
      closeOnOverlayClick={!isRunning}
      footer={
        <Button variant="secondary" onClick={handleClose} disabled={isRunning}>
          닫기
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info" title="파일명은 내려받은 그대로 두세요.">
          <span className="tabular-nums">261231_행사명_이름.pdf</span> 형식에서
          이름을 읽어 명단과 맞춥니다. 동명이인은{" "}
          <span className="tabular-nums">이름(뒤 네 자리)</span>까지 봅니다.
          이름을 고친 파일은 주인을 찾지 못해 <b>실패로 남습니다.</b>
        </Alert>

        {!isRunning && (
          <ContractUploadZone
            multiple
            onSelectFiles={handleFiles}
            className="py-8"
          />
        )}

        {isRunning && (
          <div className="flex flex-col gap-2 rounded-field border border-border-main px-4 py-5">
            <p className="text-[13px] text-font-1 tabular-nums">
              {progress.done} / {progress.total}건 처리 중…
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
              <div
                className="h-full bg-brand transition-all"
                style={{
                  width: `${Math.round((progress.done / progress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {results && (
          <>
            {/*
              성공만 세면 안 된다. 빠진 사람이 곧 계약서 없이 현장에 서는 사람이다.
              실패 수를 성공 수와 같은 크기로 나란히 둔다.
            */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-field border border-border-main px-4 py-3">
                <p className="text-[12px] text-font-2">등록 성공</p>
                <p className="mt-0.5 text-[20px] font-semibold text-font-1 tabular-nums">
                  {successCount}건
                </p>
              </div>
              <div
                className={cn(
                  "rounded-field border px-4 py-3",
                  failedCount > 0
                    ? "border-danger bg-danger-bg"
                    : "border-border-main",
                )}
              >
                <p className="text-[12px] text-font-2">실패</p>
                <p
                  className={cn(
                    "mt-0.5 text-[20px] font-semibold tabular-nums",
                    failedCount > 0 ? "text-danger" : "text-font-1",
                  )}
                >
                  {failedCount}건
                </p>
              </div>
            </div>

            <ul className="flex flex-col divide-y divide-border-main rounded-field border border-border-main">
              {results.map((result, index) => (
                <li
                  key={`${result.fileName}-${index}`}
                  className="flex flex-wrap items-start gap-2 px-3 py-2.5"
                >
                  <span className="mt-0.5 shrink-0">
                    {result.state === "SUCCESS" ? (
                      <Check size={14} className="text-success" />
                    ) : (
                      <Warning size={14} className="text-danger" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-[13px] text-font-1">
                    {result.fileName}
                  </span>

                  <span
                    className={cn(
                      "min-w-0 flex-1 text-[12px]",
                      result.state === "SUCCESS"
                        ? "text-font-2"
                        : "text-font-error",
                    )}
                  >
                    {result.message}
                  </span>
                </li>
              ))}
            </ul>

            {failedCount > 0 && (
              <p className="text-[12px] text-font-2">
                실패한 파일은 이름을 고쳐 다시 올리거나, 명단에서 그 사람을 눌러
                직접 올려 주세요.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default ContractBulkUploadModal;
