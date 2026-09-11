"use client";

import { useState } from "react";
import { useMyContractMutation } from "@/api/my/mutateMyContract";
import { cn } from "@/lib/utils";
import { REVISION_REQUEST_PRESETS } from "@/type/contract";
import Alert from "@/components/ui/Alert";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Textarea from "@/components/ui/Textarea";

interface ContractRevisionSheetProps {
  contractId: number;
  eventTitle: string;
  onClose: () => void;
  onSent: () => void;
}

/** 서버가 받는 최소 길이. 짧으면 담당자가 무엇을 고칠지 되물어야 한다 */
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

/**
 * 수정요청 시트.
 *
 * 빠른 선택을 누르면 **그 문장이 입력칸에 그대로 들어간다.** 칩만 고르고 무엇이
 * 보내지는지 안 보이면, 담당자에게 간 글과 본인이 생각한 글이 달라진다.
 * 들어간 문장은 고치거나 덧붙일 수 있고, 칩을 다시 누르면 그 줄이 빠진다.
 *
 * 닫으면 입력이 사라진다 — 부르는 쪽이 닫을 때 이 컴포넌트를 내린다.
 */
const ContractRevisionSheet = ({
  contractId,
  eventTitle,
  onClose,
  onSent,
}: ContractRevisionSheetProps) => {
  const { rejectMutation } = useMyContractMutation();
  const [reason, setReason] = useState("");

  const trimmed = reason.trim();
  const lines = reason.split("\n").map((line) => line.trim());

  const togglePreset = (text: string) => {
    setReason((current) => {
      const currentLines = current.split("\n");

      if (currentLines.some((line) => line.trim() === text)) {
        return currentLines
          .filter((line) => line.trim() !== text)
          .join("\n")
          .trim();
      }

      return current.trim() ? `${current.trimEnd()}\n${text}` : text;
    });
  };

  const handleSubmit = () => {
    rejectMutation.mutate({ contractId, reason: trimmed }, { onSuccess: onSent });
  };

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title="수정요청 보내기"
      description={eventTitle}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={trimmed.length < MIN_REASON_LENGTH || rejectMutation.isPending}
            isLoading={rejectMutation.isPending}
            onClick={handleSubmit}
          >
            수정요청 보내기
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info" title="보내면 이 문서에는 서명할 수 없어요.">
          업체가 내용을 확인해 고친 뒤 새 차수로 다시 발급합니다. 그 문서가 오면 다시
          확인하고 서명해 주세요.
        </Alert>

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-font-1">무엇이 다른가요?</p>
          <div role="group" aria-label="빠른 선택" className="flex flex-wrap gap-2">
            {REVISION_REQUEST_PRESETS.map((preset) => {
              const isActive = lines.includes(preset.text);

              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => togglePreset(preset.text)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] transition active:scale-[0.98]",
                    isActive
                      ? "border-brand bg-surface-selected font-medium text-brand"
                      : "border-border-main bg-surface text-font-1 hover:bg-surface-hover",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <FormField
          label="자세한 내용"
          hint="담당자가 그대로 고칠 수 있게 적어 주세요"
          required
        >
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예) 근무일이 3일인데 2일로 적혀 있습니다."
            rows={5}
            maxLength={MAX_REASON_LENGTH}
          />
        </FormField>

        <p
          className={cn(
            "-mt-2 text-right text-[12px] tabular-nums",
            trimmed.length > 0 && trimmed.length < MIN_REASON_LENGTH
              ? "text-warning"
              : "text-font-2",
          )}
        >
          {trimmed.length < MIN_REASON_LENGTH
            ? `${MIN_REASON_LENGTH}자 이상 적어 주세요 · `
            : ""}
          {trimmed.length}/{MAX_REASON_LENGTH}
        </p>
      </div>
    </BottomSheet>
  );
};

export default ContractRevisionSheet;
