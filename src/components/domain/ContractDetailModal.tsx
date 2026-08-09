"use client";

import { useState } from "react";
import { useContractPreviewQuery } from "@/api/contract/getContractPreview";
import { useContractMutation } from "@/api/contract/mutateContract";
import { CONTRACT_STATUS_TONE } from "@/constants/contractOptions";
import { Check, Download, Edit, Send } from "@/icons";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  CONTRACT_STATUS_LABEL,
  buildContractDocument,
} from "@/type/contract";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import ContractSheetView from "./ContractSheetView";
import CopyButton from "./CopyButton";
import SignaturePad from "./SignaturePad";

interface ContractDetailModalProps {
  contractId: number | null;
  onClose: () => void;
}

/**
 * 근로계약서 상세.
 *
 * 계약서 화면이 해야 하는 일은 세 가지다.
 * 1) 최종 문서를 있는 그대로 보여 준다 (미리보기와 실제가 다르면 의미가 없다)
 * 2) 인쇄 · PDF로 남긴다 (보관 의무가 있는 문서다)
 * 3) 서명을 받는다 (문자 회신은 근거가 되지 않는다)
 *
 * 계약서 관리 화면과 인력 상세가 모두 이 모달을 연다.
 */
const ContractDetailModal = ({
  contractId,
  onClose,
}: ContractDetailModalProps) => {
  const [isSigning, setIsSigning] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const [isAgreed, setIsAgreed] = useState(false);

  const jobRoleLabel = useJobRoleLabel();
  const { data, isLoading } = useContractPreviewQuery(contractId);
  const { statusMutation, signMutation } = useContractMutation();

  const document = data
    ? buildContractDocument(
        data.contract,
        data.template,
        jobRoleLabel(data.contract.role),
      )
    : null;

  const contract = data?.contract;
  const isSigned = contract?.status === "SIGNED";
  /*
    재작성으로 대체된 문서는 보관용이다.
    여기서 서명을 받으면 이미 사실과 다른 근무일 · 금액에 동의를 받는 셈이 된다.
  */
  const isSuperseded = contract?.status === "SUPERSEDED";

  const handleClose = () => {
    setIsSigning(false);
    setSignedName("");
    setSignatureImage("");
    setIsAgreed(false);
    onClose();
  };

  /**
   * 브라우저 인쇄로 PDF를 만든다.
   *
   * PDF 생성 라이브러리를 넣으면 한글 폰트를 통째로 번들에 담아야 하고,
   * 그렇게 만든 문서가 화면과 미묘하게 달라진다.
   * 인쇄 대화상자의 'PDF로 저장'은 화면에 보이는 문서를 그대로 남긴다.
   */
  const handlePrint = () => window.print();

  const canSubmitSignature =
    signedName.trim().length >= 2 && Boolean(signatureImage) && isAgreed;

  const handleSign = () => {
    if (!contract || !document || !canSubmitSignature) return;

    signMutation.mutate(
      {
        contractId: contract.contractId,
        signedName: signedName.trim(),
        imageDataUrl: signatureImage,
        documentText: document.plainText,
      },
      {
        onSuccess: () => {
          setIsSigning(false);
          setSignedName("");
          setSignatureImage("");
          setIsAgreed(false);
        },
      },
    );
  };

  return (
    <Modal
      isOpen={contractId !== null}
      onClose={handleClose}
      title="근로계약서"
      description={
        contract
          ? `${contract.contractNumber} · ${contract.staffName} · ${contract.eventTitle}`
          : undefined
      }
      size="xl"
      footer={
        contract && (
          <div className="contract-print-hidden flex w-full items-center gap-2">
            <Badge tone={CONTRACT_STATUS_TONE[contract.status]}>
              {CONTRACT_STATUS_LABEL[contract.status]}
            </Badge>

            {contract.revision > 1 && (
              <Badge tone="info">{contract.revision}차 재작성본</Badge>
            )}

            <div className="ml-auto flex items-center gap-2">
              <CopyButton
                value={document?.plainText ?? ""}
                label="본문 복사"
                successMessage="계약서 본문을 복사했습니다."
              />

              <Button
                variant="secondary"
                leftIcon={<Download size={15} />}
                onClick={handlePrint}
                title="인쇄 대화상자에서 'PDF로 저장'을 고르면 파일로 남습니다."
              >
                인쇄 · PDF 저장
              </Button>

              {contract.status === "DRAFT" && (
                <Button
                  variant="secondary"
                  leftIcon={<Send size={15} />}
                  onClick={() =>
                    statusMutation.mutate({
                      contractIds: [contract.contractId],
                      status: "SENT",
                    })
                  }
                >
                  발송 처리
                </Button>
              )}

              {!isSigned && !isSuperseded && (
                <Button
                  variant="primary"
                  leftIcon={<Edit size={15} />}
                  onClick={() => setIsSigning((prev) => !prev)}
                >
                  {isSigning ? "서명 접기" : "전자서명 받기"}
                </Button>
              )}
            </div>
          </div>
        )
      }
    >
      {isLoading && <Skeleton className="h-[600px] w-full rounded-field" />}

      {document && contract && (
        <div className="flex flex-col gap-4">
          {contract.status === "REJECTED" && contract.rejectedReason && (
            <Alert
              tone="danger"
              title="근로자가 반려했습니다."
              className="contract-print-hidden"
            >
              {contract.rejectedReason}
            </Alert>
          )}

          {/*
            대체된 문서를 열었을 때 가장 먼저 알아야 할 것은
            "이건 더 이상 유효하지 않다"는 사실이다. 모르고 이대로 발송하면
            근로자는 이미 취소된 근무일이 적힌 계약서에 서명하게 된다.
          */}
          {isSuperseded && (
            <Alert
              tone="warning"
              title="이 계약서는 재작성으로 대체되었습니다."
              className="contract-print-hidden"
            >
              중도 종료 처리로 근무일이 바뀌어 다음 차수가 새로 만들어졌습니다.
              이 문서는 <b>금액의 근거로 보관</b>되며, 서명은 새 차수에서
              받아 주세요.
            </Alert>
          )}

          {contract.revision > 1 && (
            <Alert
              tone="info"
              title={`${contract.revision}차 재작성본입니다.`}
              className="contract-print-hidden"
            >
              {contract.amendReason}
              {contract.removedWorkDates &&
                contract.removedWorkDates.length > 0 && (
                  <>
                    {" · "}당초 계약에서 제외된 근무일{" "}
                    <span className="tabular-nums">
                      {contract.removedWorkDates.join(", ")}
                    </span>
                  </>
                )}
            </Alert>
          )}

          {contract.status === "EXPIRED" && (
            <Alert
              tone="warning"
              title="서명 기한이 지났습니다."
              className="contract-print-hidden"
            >
              계약서를 다시 만들어 발송해 주세요. 서명 없이 현장에 투입하면
              안 됩니다.
            </Alert>
          )}

          {/* 전자서명 */}
          {isSigning && !isSigned && !isSuperseded && (
            <div className="contract-print-hidden flex flex-col gap-3 rounded-card border border-brand bg-brand-opacity-3 p-4">
              <div>
                <p className="text-[14px] font-semibold text-font-1">
                  전자서명
                </p>
                <p className="mt-0.5 text-[12px] text-font-2">
                  근로자 본인이 위 계약 내용을 확인한 뒤 직접 서명해야 합니다.
                  서명 시각과 문서 검증값이 함께 기록됩니다.
                </p>
              </div>

              <FormField label="서명자 성명" required>
                <Input
                  value={signedName}
                  onChange={(event) => setSignedName(event.target.value)}
                  placeholder={contract.staffName}
                  inputBoxClassName="max-w-60"
                />
              </FormField>

              <SignaturePad onChange={setSignatureImage} />

              <Checkbox
                label="위 근로조건(근무일 · 시간 · 시급 · 총 지급액)을 확인하였으며 이에 동의합니다."
                checked={isAgreed}
                onChange={(event) => setIsAgreed(event.target.checked)}
              />

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  leftIcon={<Check size={15} />}
                  disabled={!canSubmitSignature}
                  isLoading={signMutation.isPending}
                  onClick={handleSign}
                >
                  서명 완료
                </Button>
              </div>
            </div>
          )}

          {/*
            실제 계약서도 A4 지면 위에 얹어 보여 준다.
            조항이 많은 템플릿으로 만든 계약서는 몇 장이 되는지, 서명란이
            어느 장에 놓이는지를 발송 전에 알아야 안내 문구를 제대로 쓸 수 있다.
          */}
          <ContractSheetView document={document} />
        </div>
      )}
    </Modal>
  );
};

export default ContractDetailModal;
