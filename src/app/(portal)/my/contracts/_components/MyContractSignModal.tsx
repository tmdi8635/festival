"use client";

import { useState } from "react";
import { useMyContractPreviewQuery } from "@/api/my/getMyContracts";
import { useMyContractMutation } from "@/api/my/mutateMyContract";
import { Download } from "@/icons";
import { downloadContractAsPdf } from "@/lib/contractFile";
import { showErrorToast } from "@/lib/toast";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  buildContractDocument,
  buildContractFileName,
} from "@/type/contract";
import type { MyContract } from "@/type/my";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import Textarea from "@/components/ui/Textarea";
import ContractSheetView from "@/components/domain/ContractSheetView";
import SignaturePad from "@/components/domain/SignaturePad";

interface MyContractSignModalProps {
  contract: MyContract;
  onClose: () => void;
}

/**
 * 내 근로계약서를 읽고 서명한다.
 *
 * **전문을 먼저 보여 준 뒤에 서명칸을 연다.** 서명 버튼만 크게 두고 문서를 접어 두면
 * 아무도 읽지 않고, 나중에 "그 조항은 못 봤다"가 된다. 그 다툼을 가리려고
 * 서명 시점 문서의 해시까지 남기는데, 정작 읽을 기회를 안 주면 앞뒤가 맞지 않는다.
 *
 * 되돌려 보내는 길도 같은 자리에 둔다. 내용이 다를 때 할 수 있는 일이
 * "서명 안 하고 버티기"뿐이면 담당자는 왜 안 들어오는지 알 수 없다.
 */
const MyContractSignModal = ({ contract, onClose }: MyContractSignModalProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const { data, isLoading } = useMyContractPreviewQuery(contract.contractId);
  const { signMutation, rejectMutation } = useMyContractMutation();

  const [isSigning, setIsSigning] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const [isAgreed, setIsAgreed] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const document =
    data && buildContractDocument(data.contract, data.template, jobRoleLabel(data.contract.role));

  /* 셋 다 갖춰져야 보낸다. 서명만 그리고 이름을 안 적는 일이 실제로 흔하다. */
  const canSubmit =
    signedName.trim().length >= 2 && Boolean(signatureImage) && isAgreed;

  const isSignable = contract.status === "SENT" || contract.status === "REJECTED";

  const handleSign = () => {
    if (!document) return;

    signMutation.mutate(
      {
        contractId: contract.contractId,
        signedName: signedName.trim(),
        imageDataUrl: signatureImage,
        /* 서명 시점 문서의 평문. 서버가 해시로 만들어 보관한다. */
        documentText: document.plainText,
      },
      { onSuccess: onClose },
    );
  };

  const handleDownload = async () => {
    if (!data || !document) return;

    try {
      await downloadContractAsPdf(
        document,
        buildContractFileName(
          data.contract.workDate,
          data.contract.eventTitle,
          data.contract.staffName,
          "pdf",
        ),
      );
    } catch (error) {
      showErrorToast(error);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={contract.eventTitle}
      description={`계약번호 ${contract.contractNumber || "발급 전"}`}
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            leftIcon={<Download size={15} />}
            onClick={handleDownload}
            disabled={!document}
          >
            PDF 내려받기
          </Button>

          {isSignable && !isSigning && !isRejecting && (
            <>
              <Button
                variant="secondary"
                onClick={() => setIsRejecting(true)}
              >
                내용이 달라요
              </Button>
              <Button onClick={() => setIsSigning(true)}>
                서명하기
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {contract.status === "REJECTED" && contract.rejectedReason && (
          <Alert tone="warning" title="담당자에게 전달했습니다.">
            보낸 내용: {contract.rejectedReason}
            <br />
            담당자가 수정해서 다시 보내면 여기에서 서명할 수 있습니다.
          </Alert>
        )}

        {contract.status === "SIGNED" && (
          <Alert tone="success" title="서명이 완료되었습니다.">
            문서 아래쪽에서 서명과 전자서명 시각을 확인할 수 있습니다.
          </Alert>
        )}

        {isLoading || !document ? (
          <Skeleton className="h-96 w-full rounded-card" />
        ) : (
          <ContractSheetView document={document} fitToWidth />
        )}

        {isRejecting && (
          <div className="flex flex-col gap-3 rounded-card border border-border-main bg-subtle p-4">
            <FormField
              label="어디가 다른가요?"
              hint="담당자가 그대로 고칠 수 있게 적어 주세요"
              required
            >
              <Textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="예) 근무일이 3일인데 2일로 적혀 있습니다."
                rows={3}
              />
            </FormField>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setIsRejecting(false)}
              >
                취소
              </Button>
              <Button
                disabled={
                  rejectReason.trim().length < 5 || rejectMutation.isPending
                }
                onClick={() =>
                  rejectMutation.mutate(
                    {
                      contractId: contract.contractId,
                      reason: rejectReason.trim(),
                    },
                    { onSuccess: onClose },
                  )
                }
              >
                보내기
              </Button>
            </div>
          </div>
        )}

        {isSigning && (
          <div className="flex flex-col gap-3 rounded-card border border-border-main bg-subtle p-4">
            <FormField label="서명자 성명" required>
              <Input
                value={signedName}
                onChange={(event) => setSignedName(event.target.value)}
                placeholder="본인 이름을 입력해 주세요"
              />
            </FormField>

            <SignaturePad onChange={setSignatureImage} />

            <Checkbox
              checked={isAgreed}
              onChange={(event) => setIsAgreed(event.target.checked)}
              label="위 근로조건을 확인했으며 이에 동의합니다."
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setIsSigning(false)}
              >
                취소
              </Button>
              <Button
                disabled={!canSubmit || signMutation.isPending}
                onClick={handleSign}
              >
                서명 완료
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MyContractSignModal;
