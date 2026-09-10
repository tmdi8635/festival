"use client";

import { useState } from "react";
import { useMyContractPreviewQuery } from "@/api/my/getMyContracts";
import { useMyContractMutation } from "@/api/my/mutateMyContract";
import { ChevronLeft, Download, FileText } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { downloadContractAsPdf } from "@/lib/contractFile";
import { showErrorToast } from "@/lib/toast";
import { formatCurrency } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { WAGE_TYPE_LABEL, formatTimeRange } from "@/type/event";
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

const SummaryRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-4 py-2.5">
    <dt className="shrink-0 text-[13px] text-font-2">{label}</dt>
    <dd className="min-w-0 text-right text-[14px] text-font-1">{children}</dd>
  </div>
);

/**
 * 내 근로계약서를 읽고 서명한다.
 *
 * **요약을 먼저 세우고 전문은 눌러서 편다.** 폰에서 A4 지면을 그대로 띄우면
 * 글자가 손톱만 해져서, 정작 확인해야 하는 근무일 · 시간 · 금액을 읽으려고
 * 확대와 스크롤을 반복하게 된다. 그 세 가지는 큰 글씨로 위에 세우고,
 * 조항 전문은 지면 그대로 볼 수 있게 따로 연다.
 *
 * 그래도 **서명하려면 전문이 열린다.** 서명 버튼을 누르면 지면으로 전환하고
 * 그 아래에 서명칸을 붙인다. 조항을 접어 둔 채 받은 서명은
 * 나중에 "그건 못 봤다"가 되고, 서명 시점 문서의 해시를 남기는 일도
 * 읽을 기회를 안 준 상태에서는 앞뒤가 맞지 않는다.
 *
 * 되돌려 보내는 길도 같은 자리에 둔다. 내용이 다를 때 할 수 있는 일이
 * "서명 안 하고 버티기"뿐이면 담당자는 왜 안 들어오는지 알 수 없다.
 */
const MyContractSignModal = ({ contract, onClose }: MyContractSignModalProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const { data, isLoading } = useMyContractPreviewQuery(contract.contractId);
  const { signMutation, rejectMutation } = useMyContractMutation();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const [isAgreed, setIsAgreed] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const detail = data?.contract;

  const document =
    data && buildContractDocument(data.contract, data.template, jobRoleLabel(data.contract.role));

  /* 셋 다 갖춰져야 보낸다. 서명만 그리고 이름을 안 적는 일이 실제로 흔하다. */
  const canSubmit =
    signedName.trim().length >= 2 && Boolean(signatureImage) && isAgreed;

  const isSignable = contract.status === "SENT" || contract.status === "REJECTED";

  const handleStartSigning = () => {
    /* 서명은 전문 위에서만 받는다. (위 주석) */
    setIsExpanded(true);
    setIsSigning(true);
  };

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
      size={isExpanded ? "lg" : "md"}
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
              <Button variant="secondary" onClick={() => setIsRejecting(true)}>
                내용이 달라요
              </Button>
              <Button onClick={handleStartSigning}>서명하기</Button>
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

        {isLoading || !document || !detail ? (
          <Skeleton className="h-72 w-full rounded-card" />
        ) : isExpanded ? (
          <>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1 self-start text-[13px] text-font-2 transition hover:text-font-1"
            >
              <ChevronLeft size={15} />
              요약으로 돌아가기
            </button>

            {/*
              인쇄 안내는 담당자 몫이라 끈다. "A4 2장을 모두 배부하세요"는
              문서를 나눠 주는 사람에게 하는 말이고, 여기서는 할 수 있는 일이 없다.
            */}
            <ContractSheetView document={document} fitToWidth showPrintGuide={false} />
          </>
        ) : (
          <>
            {/* 확인해야 하는 세 가지 — 언제 · 얼마나 · 얼마. 크게 위에 세운다. */}
            <div className="rounded-card bg-subtle px-4 py-3">
              <p className="text-[12px] text-font-2">세전 총 지급액</p>
              <p className="text-[24px] font-bold text-font-0 tabular-nums">
                {formatCurrency(detail.totalWage)}
              </p>
              <p className="mt-0.5 text-[12px] text-font-2">
                {WAGE_TYPE_LABEL[detail.wageType]} {formatCurrency(detail.wage)}
                {detail.hasMixedWage && " (근무일마다 다름)"} · 실근무 총{" "}
                {detail.totalWorkHours.toFixed(1)}시간
              </p>
            </div>

            <dl className="divide-y divide-border-main">
              <SummaryRow label="근무일">
                <span className="tabular-nums">
                  {detail.workDates.map((date) => formatDate(date)).join(", ")}
                </span>
              </SummaryRow>

              <SummaryRow label="근무 시간">
                <span className="tabular-nums">
                  {formatTimeRange(
                    detail.startTime,
                    detail.endTime,
                    detail.endDayOffset,
                  )}
                </span>
                {detail.breakMinutes > 0 && (
                  <span className="text-font-2"> · 휴게 {detail.breakMinutes}분</span>
                )}
              </SummaryRow>

              <SummaryRow label="직무">{jobRoleLabel(detail.role)}</SummaryRow>
              <SummaryRow label="장소">{detail.venue}</SummaryRow>
              <SummaryRow label="사업주">{data.template.companyName}</SummaryRow>
              <SummaryRow label="양식">{detail.templateName}</SummaryRow>
            </dl>

            <Button
              variant="secondary"
              fullWidth
              leftIcon={<FileText size={15} />}
              onClick={() => setIsExpanded(true)}
            >
              계약서 전문 보기
            </Button>

            <p className="text-[12px] text-font-2">
              위 요약은 계약서에서 뽑아 온 값입니다. 조항 전문은 전문 보기에서
              확인해 주세요.
            </p>
          </>
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

            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" fullWidth onClick={() => setIsRejecting(false)}>
                취소
              </Button>
              <Button
                fullWidth
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

            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" fullWidth onClick={() => setIsSigning(false)}>
                취소
              </Button>
              <Button
                fullWidth
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
