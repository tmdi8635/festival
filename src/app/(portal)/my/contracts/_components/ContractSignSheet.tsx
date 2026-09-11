"use client";

import { useState } from "react";
import { useMyContractMutation } from "@/api/my/mutateMyContract";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import SignaturePad from "@/components/domain/SignaturePad";

interface ContractSignSheetProps {
  contractId: number;
  eventTitle: string;
  /** 서명 시점 문서의 평문. 서버가 해시(문서 지문)로 남긴다 */
  documentText: string;
  onClose: () => void;
  onSigned: () => void;
}

/**
 * 서명 시트.
 *
 * **부르는 쪽이 열 때 마운트하고 닫을 때 내린다.** 입력을 이 컴포넌트가 들고 있으므로
 * 닫으면 이름 · 서명 · 동의가 함께 사라진다. 예전에는 창을 닫았다 열어도 이전 서명이
 * 캔버스에 남아, 다른 사람이 폰을 넘겨받아 그대로 제출할 수 있었다.
 *
 * 셋 다 갖춰야 보낸다. 서명만 그리고 이름을 안 적는 일이 실제로 흔하다.
 * 버튼만 잠가 두면 무엇이 빠졌는지 모르므로 **남은 것을 버튼 위에 적는다.**
 */
const ContractSignSheet = ({
  contractId,
  eventTitle,
  documentText,
  onClose,
  onSigned,
}: ContractSignSheetProps) => {
  const { signMutation } = useMyContractMutation();

  const [signedName, setSignedName] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const [isAgreed, setIsAgreed] = useState(false);

  const missing = [
    signedName.trim().length < 2 ? "성명" : "",
    signatureImage ? "" : "서명",
    isAgreed ? "" : "동의",
  ].filter(Boolean);

  const handleSubmit = () => {
    signMutation.mutate(
      {
        contractId,
        signedName: signedName.trim(),
        imageDataUrl: signatureImage,
        documentText,
      },
      { onSuccess: onSigned },
    );
  };

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title="계약서에 서명"
      description={eventTitle}
      footer={
        <div className="flex flex-col gap-2">
          {missing.length > 0 && (
            <p className="text-center text-[12px] text-font-2">
              {missing.join(" · ")}이 남았어요
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={missing.length > 0 || signMutation.isPending}
              isLoading={signMutation.isPending}
              onClick={handleSubmit}
            >
              서명 완료
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="서명자 성명" required>
          <Input
            value={signedName}
            onChange={(event) => setSignedName(event.target.value)}
            placeholder="본인 이름을 입력해 주세요"
            autoComplete="name"
          />
        </FormField>

        <FormField label="서명" required>
          <SignaturePad onChange={setSignatureImage} />
        </FormField>

        <Checkbox
          checked={isAgreed}
          onChange={(event) => setIsAgreed(event.target.checked)}
          label="계약서 전문을 확인했고, 적힌 근로조건에 동의합니다."
        />

        <p className="text-[12px] text-font-2">
          서명 시각과 지금 보고 있는 문서의 지문이 함께 남습니다. 서명한 뒤에는 화면에서
          되돌릴 수 없어요.
        </p>
      </div>
    </BottomSheet>
  );
};

export default ContractSignSheet;
