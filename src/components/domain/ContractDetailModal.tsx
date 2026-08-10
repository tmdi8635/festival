"use client";

import { useState } from "react";
import { useContractDraftQuery } from "@/api/contract/getContractDraft";
import { useContractListQuery } from "@/api/contract/getContractList";
import { useContractPreviewQuery } from "@/api/contract/getContractPreview";
import { useContractMutation } from "@/api/contract/mutateContract";
import { useEventDetailQuery } from "@/api/event/getEventDetail";
import { useHasPermission } from "@/store/useAdminStore";
import { CONTRACT_STATUS_TONE } from "@/constants/contractOptions";
import { Download, ImageIcon, Refresh, Trash } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import {
  downloadContractAsImage,
  downloadContractAsPdf,
  openContractPdf,
} from "@/lib/contractFile";
import { showErrorToast } from "@/lib/toast";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  CONTRACT_STATUS_LABEL,
  buildContractDocument,
  buildContractFileName,
  contractNameTag,
  findDuplicateStaffNames,
  type Contract,
} from "@/type/contract";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import ContractAmendModal from "./ContractAmendModal";
import ContractFilePreview from "./ContractFilePreview";
import ContractPreviewCard from "./ContractPreviewCard";
import ContractUploadZone from "./ContractUploadZone";
import CopyButton from "./CopyButton";

/**
 * 이 모달이 다루는 대상은 계약서가 아니라 **사람 한 명**이다.
 *
 * 계약서 번호로 열면 아직 계약서가 없는 사람은 열 수 없다.
 * 그런데 이 화면에서 제일 먼저 할 일이 바로 그 사람의 문서를 내려받는 것이다.
 */
export interface ContractDetailTarget {
  eventId: number;
  staffId: number;
  /** 명단에서 고른 템플릿. 아직 등록 전인 문서를 조립할 때 쓴다. */
  templateId?: number;
}

interface ContractDetailModalProps {
  target: ContractDetailTarget | null;
  onClose: () => void;
}

/** 계약서 목록은 한 사람의 차수를 모두 담아도 몇 건 되지 않는다. */
const REVISION_PAGE_SIZE = 50;

/**
 * 근로계약서 상세.
 *
 * ## 지금은 사람이 직접 배부한다
 *
 * 서버가 없으므로 발송도 승인도 없다. 이 화면이 하는 일은 그 절차를 대신하는 것이다.
 *
 * 1. **미리보기** — 무엇에 서명받을 문서인지 여기서 확인한다.
 * 2. **내려받기** — 서명란이 빈 문서를 PDF나 이미지로 받는다.
 *    파일명은 `261231_행사명_이름.pdf`로 고정된다. 폴더에 서른 장이 쌓이기 때문이다.
 * 3. **등록** — 종이에 서명받아 스캔한 파일을 여기에 올린다.
 *    올라간 순간 계약번호가 붙고 서명완료가 된다.
 *
 * ## 차수는 모두 살아 있다
 *
 * 재작성해도 지난 차수의 **서명본 파일은 지우지 않는다.** 그 종이가 곧
 * "그때는 이 조건으로 일했다"의 근거이고, 정산 금액을 설명할 때 필요한 것도 그것이다.
 * 그래서 차수를 골라 그 차수의 문서와 서명본을 보고 내려받을 수 있게 한다.
 */
const ContractDetailModal = ({
  target,
  onClose,
}: ContractDetailModalProps) => {
  const [amendTarget, setAmendTarget] = useState<Contract | null>(null);
  /* PDF는 지면을 이미지로 굽는 과정이 있어 잠깐 걸린다. 눌린 것이 보여야 한다. */
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);
  /** 보고 있는 차수. 비우면 지금 유효한 차수를 본다. */
  const [viewingContractId, setViewingContractId] = useState<number | null>(
    null,
  );

  const jobRoleLabel = useJobRoleLabel();
  const canWrite = useHasPermission("contract:write");

  const { registerMutation, cancelRegistrationMutation } =
    useContractMutation();

  /*
    이 사람의 이 행사 계약서를 전부 받아 온다.
    지나간 차수(`SUPERSEDED`)까지 함께 와야 이력을 보여 줄 수 있다.
  */
  const { data: listData, isLoading: isListLoading } = useContractListQuery({
    page: 1,
    size: REVISION_PAGE_SIZE,
    eventId: target ? String(target.eventId) : "",
    staffId: target ? String(target.staffId) : "",
  });

  const revisions = [...(listData?.content ?? [])].sort(
    (a, b) => b.revision - a.revision,
  );

  /** 지금 유효한 문서. 없으면 아직 아무것도 등록되지 않은 사람이다. */
  const current = revisions.find(
    (contract) => contract.status !== "SUPERSEDED",
  );

  /*
    화면에 그릴 차수. 이력에서 지난 차수를 고르면 그 문서로 갈아 낀다.
    고른 차수가 목록에 없으면(재작성 직후 등) 유효한 차수로 되돌아간다.
  */
  const viewing =
    revisions.find((item) => item.contractId === viewingContractId) ?? current;

  const { data: previewData, isLoading: isPreviewLoading } =
    useContractPreviewQuery(viewing?.contractId ?? null);

  /*
    등록 전에는 저장된 문서가 없으므로 조립만 해서 받아 온다.
    이미 등록된 사람에게는 부르지 않는다. (같은 문서를 두 벌 만들 이유가 없다)
  */
  const { data: draftData, isLoading: isDraftLoading } = useContractDraftQuery(
    target && !isListLoading && !current
      ? {
          eventId: target.eventId,
          staffId: target.staffId,
          templateId: target.templateId,
        }
      : null,
  );

  /*
    동명이인이면 파일명에 휴대폰 뒤 네 자리를 붙인다.
    그 판단은 **이 행사의 확정 배치 전체**를 봐야 할 수 있어서 행사를 함께 받는다.
    (행사 상세에서 열었으면 이미 받아 둔 것이라 다시 부르지 않는다)
  */
  const { data: event } = useEventDetailQuery(target?.eventId ?? null);

  const data = previewData ?? draftData;
  const contract = data?.contract;

  const document = data
    ? buildContractDocument(
        data.contract,
        data.template,
        jobRoleLabel(data.contract.role),
      )
    : null;

  const isLoading =
    isListLoading || isPreviewLoading || (isDraftLoading && !current);

  const handleClose = () => {
    setAmendTarget(null);
    setViewingContractId(null);
    onClose();
  };

  const duplicateNames = findDuplicateStaffNames(
    (event?.assignments ?? []).filter(
      (assignment) => assignment.status === "CONFIRMED",
    ),
  );

  const fileName = (extension: string) => {
    if (!contract) return `근로계약서.${extension}`;

    const base = buildContractFileName(
      contract.workDate,
      contract.eventTitle,
      contract.staffName,
      extension,
      duplicateNames.has(contract.staffName)
        ? contractNameTag(contract.staffPhone)
        : undefined,
    );

    /* 차수가 여럿이면 파일명으로도 갈라져야 한다. 폴더에서 덮어써 버린다. */
    return contract.revision > 1
      ? base.replace(new RegExp(`\\.${extension}$`), `_${contract.revision}차.${extension}`)
      : base;
  };

  const handleDownloadImage = async () => {
    if (!document) return;

    try {
      await downloadContractAsImage(document, fileName("png"));
    } catch (error) {
      showErrorToast(error, "계약서를 이미지로 만들지 못했습니다.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!document) return;

    setIsDownloadingPdf(true);

    try {
      await downloadContractAsPdf(document, fileName("pdf"));
    } catch (error) {
      showErrorToast(error, "계약서를 PDF로 만들지 못했습니다.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  /** 조항을 실제로 읽어야 할 때. 보고 있던 화면은 그대로 남는다. */
  const handleOpenPdf = async () => {
    if (!document) return;

    setIsOpeningPdf(true);

    try {
      await openContractPdf(document);
    } catch (error) {
      showErrorToast(error, "계약서를 열지 못했습니다.");
    } finally {
      setIsOpeningPdf(false);
    }
  };

  const handleRegister = (file: {
    fileUrl: string;
    fileName: string;
    mimeType: string;
  }) => {
    if (!target) return;

    registerMutation.mutate(
      current
        ? { contractId: current.contractId, ...file }
        : {
            eventId: target.eventId,
            staffId: target.staffId,
            templateId: contract?.templateId,
            ...file,
          },
    );
  };

  const handleCancelRegistration = () => {
    if (!current) return;

    openConfirm({
      title: "등록을 취소할까요?",
      description: `${current.staffName}님의 서명본(${current.signedFile?.fileName})을 떼어 냅니다.`,
      warning:
        current.revision === 1
          ? "1차 계약서는 계약번호도 함께 사라지고 '발급 전'으로 돌아갑니다. 서명받은 종이는 그대로이니 다시 올리면 됩니다."
          : "이 차수는 '등록 대기'로 돌아갑니다. 계약번호와 재작성 이력은 남습니다.",
      confirmText: "등록 취소",
      tone: "danger",
      onConfirm: () =>
        cancelRegistrationMutation.mutateAsync(current.contractId),
    });
  };

  /** 지금 보고 있는 차수가 유효한 차수인지. 지난 차수는 손대지 않는다. */
  const isViewingCurrent = Boolean(
    viewing && current && viewing.contractId === current.contractId,
  );

  return (
    <>
      <Modal
        isOpen={target !== null}
        onClose={handleClose}
        title="근로계약서"
        description={
          contract
            ? `${contract.staffName} · ${contract.eventTitle} · ${
                contract.contractNumber || "계약번호는 등록할 때 발급됩니다"
              }`
            : undefined
        }
        size="xl"
        footer={
          document && (
            <div className="contract-print-hidden flex w-full flex-wrap items-center gap-2">
              <Badge
                tone={
                  viewing ? CONTRACT_STATUS_TONE[viewing.status] : "danger"
                }
              >
                {viewing ? CONTRACT_STATUS_LABEL[viewing.status] : "발급 전"}
              </Badge>

              {viewing && viewing.revision > 1 && (
                <Badge tone="info">{viewing.revision}차</Badge>
              )}

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <CopyButton
                  value={document.plainText}
                  label="본문 복사"
                  successMessage="계약서 본문을 복사했습니다."
                />

                <Button
                  variant="secondary"
                  leftIcon={<ImageIcon size={15} />}
                  onClick={handleDownloadImage}
                  title={`${fileName("png")} 으로 저장됩니다.`}
                >
                  이미지
                </Button>

                {/*
                  인쇄 대화상자를 거치지 않고 파일을 직접 만든다.
                  대화상자를 거치면 사람이 'PDF로 저장'을 고르지 않는 한
                  파일이 남지 않고, 파일명도 매번 확인해 줘야 했다.
                */}
                <Button
                  variant="primary"
                  leftIcon={<Download size={15} />}
                  isLoading={isDownloadingPdf}
                  onClick={handleDownloadPdf}
                  title={`${fileName("pdf")} 으로 저장됩니다.`}
                >
                  PDF 내려받기
                </Button>
              </div>
            </div>
          )
        }
      >
        {isLoading && <Skeleton className="h-[600px] w-full rounded-field" />}

        {document && contract && (
          <div className="flex flex-col gap-4">
            {/*
              지금 어디까지 왔는지.
              내려받기 · 배부 · 등록은 화면 밖에서 벌어지는 일이라, 여기서
              "다음에 뭘 해야 하는지"를 적어 두지 않으면 담당자는 매번 헤맨다.
            */}
            {!current && (
              <Alert
                tone="info"
                title="아직 등록 전입니다."
                className="contract-print-hidden"
              >
                아래 문서를 <b>PDF나 이미지로 내려받아</b> 근로자에게 배부하고,
                서명받은 종이를 다시 올려 주세요. 올리는 순간 계약번호가 붙고
                서명완료가 됩니다.
              </Alert>
            )}

            {isViewingCurrent && current?.status === "DRAFT" && (
              <Alert
                tone="warning"
                title={`${current.revision}차 계약서의 서명본이 아직 없습니다.`}
                className="contract-print-hidden"
              >
                재작성한 문서는 <b>서명을 처음부터 다시</b> 받아야 합니다. 아래
                문서를 내려받아 다시 배부해 주세요.
              </Alert>
            )}

            {!isViewingCurrent && viewing && (
              <Alert
                tone="info"
                title={`${viewing.revision}차 (지난 차수)를 보고 있습니다.`}
                className="contract-print-hidden"
              >
                지난 차수는 <b>보관용</b>입니다. 문서와 서명본을 그대로 내려받을
                수 있지만 새로 등록하거나 재작성할 수는 없습니다. 지금 유효한
                차수는 {current?.revision ?? "-"}차입니다.
              </Alert>
            )}

            {viewing && viewing.revision > 1 && (
              <Alert
                tone="info"
                title={`${viewing.revision}차 재작성본입니다.`}
                className="contract-print-hidden"
              >
                {viewing.amendReason}
                {viewing.removedWorkDates &&
                  viewing.removedWorkDates.length > 0 && (
                    <>
                      {" · "}당초 계약에서 제외된 근무일{" "}
                      <span className="tabular-nums">
                        {viewing.removedWorkDates.join(", ")}
                      </span>
                    </>
                  )}
              </Alert>
            )}

            {/* 서명본 */}
            <section className="contract-print-hidden flex flex-col gap-2.5 rounded-card border border-border-main p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-font-1">
                  서명받은 계약서
                  {viewing && viewing.revision > 1 && (
                    <span className="ml-1.5 text-[13px] font-normal text-font-2">
                      {viewing.revision}차
                    </span>
                  )}
                </p>

                {canWrite && isViewingCurrent && current?.signedFile && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<Refresh size={14} />}
                      onClick={() => setAmendTarget(current)}
                    >
                      재작성
                    </Button>

                    <Button
                      size="sm"
                      variant="dangerGhost"
                      leftIcon={<Trash size={14} />}
                      isLoading={cancelRegistrationMutation.isPending}
                      onClick={handleCancelRegistration}
                    >
                      등록 취소
                    </Button>
                  </div>
                )}
              </div>

              {viewing?.signedFile ? (
                <ContractFilePreview file={viewing.signedFile} />
              ) : isViewingCurrent || !viewing ? (
                canWrite ? (
                  <ContractUploadZone
                    onUploaded={handleRegister}
                    disabled={registerMutation.isPending}
                  />
                ) : (
                  <p className="text-[13px] text-font-2">
                    아직 등록된 서명본이 없습니다. 등록하려면 &lsquo;근로계약서
                    &gt; 등록 · 수정&rsquo; 권한이 필요합니다.
                  </p>
                )
              ) : (
                <p className="rounded-field border border-dashed border-border-strong px-3 py-6 text-center text-[13px] text-font-2">
                  이 차수는 서명본을 받기 전에 재작성돼 파일이 없습니다.
                </p>
              )}
            </section>

            {/* 차수 이력 */}
            {revisions.length > 1 && (
              <section className="contract-print-hidden flex flex-col gap-2 rounded-card border border-border-main p-4">
                <p className="text-[14px] font-semibold text-font-1">
                  재작성 이력
                </p>
                <p className="text-[12px] text-font-2">
                  차수를 누르면 그 차수의 문서와 서명본을 봅니다. 지난 차수도
                  그대로 내려받을 수 있습니다.
                </p>

                <ul className="mt-1 flex flex-col divide-y divide-border-main">
                  {revisions.map((revision) => {
                    const isViewing = viewing?.contractId === revision.contractId;

                    return (
                      <li key={revision.contractId}>
                        <button
                          type="button"
                          onClick={() =>
                            setViewingContractId(revision.contractId)
                          }
                          className={cn(
                            "flex w-full flex-wrap items-center gap-2 rounded-field px-2 py-2.5 text-left transition",
                            isViewing
                              ? "bg-surface-selected"
                              : "hover:bg-surface-hover",
                          )}
                        >
                          <span className="text-[13px] font-medium text-font-1 tabular-nums">
                            {revision.revision}차
                          </span>
                          <Badge tone={CONTRACT_STATUS_TONE[revision.status]}>
                            {CONTRACT_STATUS_LABEL[revision.status]}
                          </Badge>
                          <span className="text-[12px] text-font-2 tabular-nums">
                            {revision.contractNumber}
                          </span>
                          <span className="text-[12px] text-font-2 tabular-nums">
                            근무일 {revision.workDates.length}일 ·{" "}
                            {revision.totalWage.toLocaleString("ko-KR")}원
                          </span>

                          {/* 서명본이 남아 있는지가 이 줄에서 바로 보여야 한다. */}
                          <span className="ml-auto flex items-center gap-2 text-[12px] text-font-2">
                            {revision.signedFile ? (
                              <span className="max-w-60 truncate">
                                {revision.signedFile.fileName}
                              </span>
                            ) : (
                              <span>서명본 없음</span>
                            )}
                            <span className="shrink-0">
                              {revision.amendReason ??
                                `${formatDate(revision.createdAt)} 작성`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/*
              미리보기.

              A4 지면을 전부 그려 두면 조항이 많은 문서에서 모달이 문서로
              가득 차고, 정작 여기서 할 일(내려받아 배부 · 서명본 등록)이
              스크롤 저 아래로 밀린다. 첫 장만 작게 보여 주고,
              조항을 실제로 읽어야 할 때는 새 창에서 PDF로 연다.
            */}
            <ContractPreviewCard
              document={document}
              isOpening={isOpeningPdf}
              onOpenPdf={handleOpenPdf}
            />
          </div>
        )}
      </Modal>

      <ContractAmendModal
        contract={amendTarget}
        onClose={() => setAmendTarget(null)}
      />
    </>
  );
};

export default ContractDetailModal;
