"use client";

import { useState } from "react";
import { Check, Copy } from "@/icons";
import { showAppToast } from "@/lib/toast";
import Button from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/Button";

interface CopyButtonProps {
  value: string;
  label?: string;
  /** 복사 후 보여 줄 토스트 문구 */
  successMessage?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
}

/**
 * 클립보드 복사 버튼.
 *
 * 공고문 · 연락처 목록처럼 "시스템 밖으로 한 번 나갔다 오는" 값이 많아
 * 복사를 공통 동작으로 둔다. 복사 성공은 아이콘과 토스트로 함께 알린다.
 */
const CopyButton = ({
  value,
  label = "복사",
  successMessage = "클립보드에 복사했습니다.",
  size = "sm",
  variant = "secondary",
  disabled = false,
}: CopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      showAppToast("success", successMessage);

      // 아이콘만 잠깐 바꿔 두고 원래대로 돌린다.
      window.setTimeout(() => setIsCopied(false), 1_500);
    } catch {
      showAppToast("error", "복사에 실패했습니다. 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      leftIcon={isCopied ? <Check size={15} /> : <Copy size={15} />}
      onClick={handleCopy}
      disabled={disabled || !value}
    >
      {isCopied ? "복사됨" : label}
    </Button>
  );
};

export default CopyButton;
