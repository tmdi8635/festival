"use client";

import { useState } from "react";
import { useContractDraftQuery } from "@/api/contract/getContractDraft";
import { useContractMutation } from "@/api/contract/mutateContract";
import { Eye } from "@/icons";
import { formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  AMEND_REASON_PRESETS,
  buildContractDocument,
  buildCustomTermsFrom,
  type Contract,
  type ContractCustomTerms,
} from "@/type/contract";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import ContractSheetView from "./ContractSheetView";
import ContractTermsEditor from "./ContractTermsEditor";

interface ContractReissueModalProps {
  /** 재발급할 계약서. 수정요청이 온(`REJECTED`) 차수여야 한다. */
  contract: Contract | null;
  onClose: () => void;
}

/**
 * 재발급 — 본인이 보낸 수정요청에 대한 답.
 *
 * 반려된 계약서는 **다시 보낼 수 없다.** 같은 문서를 그대로 밀어 넣으면
 * 본인은 무엇이 달라졌는지 알 수 없고, 요청은 답 없이 사라진다.
 * 그래서 서버는 반려 건의 재발송을 막아 두었고, 이 자리에서만 새 차수가 나간다.
 *
 * 고칠 수 있는 것은 두 갈래다.
 * - **근무일 · 금액 · 포지션** — 원본이 배치다. 행사에서 고치고 오면 새 차수가
 *   지금 배치로 다시 조립된다. 여기서 숫자를 따로 고치면 계약서와 정산이 갈린다.
 * - **조항 문구 · 순서 · 제목** — 여기서 **이 사람 계약서만** 고친다. 템플릿은 그대로다.
 *   수정요청은 대개 한 사람에게만 해당하는 문구라, 템플릿을 고치면 남의 문서까지 바뀐다.
 */
const ContractReissueModal = ({
  contract,
  onClose,
}: ContractReissueModalProps) => {
  const { reissueMutation } = useContractMutation();
  const jobRoleLabel = useJobRoleLabel();
  const [reason, setReason] = useState("");
  /*
    고쳐 쓴 조항. `undefined`는 아직 손대지 않았다는 뜻이라 지난 차수의 내용을 쓰고,
    `null`은 "템플릿 그대로"를 고른 것이다. (draft 패턴 — effect로 옮겨 담지 않는다)
  */
  const [editedTerms, setEditedTerms] = useState<
    ContractCustomTerms | null | undefined
  >(undefined);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  /*
    지금 배치로 다시 조립한 문서. 새 차수는 이것으로 나가므로 미리보기도 이것으로 한다.
    지난 차수의 숫자로 미리 보여 주면, 행사에서 고친 금액이 반영됐는지 여기서 확인할 수 없다.
  */
  const { data: draft } = useContractDraftQuery(
    contract
      ? {
          eventId: contract.eventId,
          staffId: contract.staffId,
          templateId: contract.templateId,
        }
      : null,
  );

  const handleClose = () => {
    /* 닫으면 비운다. 다음에 열었을 때 지난 사유 · 조항이 남아 있으면 그대로 보내진다. */
    setReason("");
    setEditedTerms(undefined);
    setIsPreviewOpen(false);
    onClose();
  };

  const terms =
    editedTerms === undefined ? (contract?.customTerms ?? null) : editedTerms;
  const isCustom = terms !== null;

  const requests = contract?.revisionRequests ?? [];
  /* 아직 답하지 않은 요청. 이번 차수가 답해야 할 대상이다. */
  const openRequests = requests.filter((request) => !request.resolvedAt);
  const isReasonValid = reason.trim().length >= 2;
  const isTermsValid =
    !terms ||
    (terms.documentTitle.trim().length > 0 &&
      terms.clauses.length > 0 &&
      terms.clauses.every((clause) => clause.title.trim().length > 0));

  /* 표를 문구로 풀어 임금 · 근로조건이 배치를 따라가지 않게 된 조항이 있는지 */
  const hasFrozenAutoClause =
    isCustom &&
    !(["WORK_CONDITION", "WAGE"] as const).every((kind) =>
      terms.clauses.some((clause) => clause.kind === kind),
    );

  /*
    새 차수가 실제로 어떻게 나갈지. 차수 · 번호 · 빠지고 늘어난 날까지 서버와 같은 규칙으로
    채워야, 근로조건 표 아래에 붙는 '재작성본' 줄이 미리보기에서도 보인다.
  */
  const previewDocument =
    contract && draft
      ? buildContractDocument(
          {
            ...draft.contract,
            customTerms: terms ?? undefined,
            contractNumber: `${contract.contractNumber.replace(/-R\d+$/, "")}-R${contract.revision + 1}`,
            revision: contract.revision + 1,
            amendReason: reason.trim() || undefined,
            amendReasonType: "REVISION_REQUEST",
            removedWorkDates: contract.workDates.filter(
              (date) => !draft.contract.workDates.includes(date),
            ),
            addedWorkDates: draft.contract.workDates.filter(
              (date) => !contract.workDates.includes(date),
            ),
          },
          draft.template,
          jobRoleLabel(contract.role),
        )
      : null;

  /* 자동 조항을 문구로 풀 때 채울 본문. 지금 문서에 찍히는 표를 그대로 옮긴다. */
  const resolveAutoText = (clauseId: string) =>
    (previewDocument?.sections.find((section) => section.clauseId === clauseId)
      ?.fields ?? [])
      .map((field) => `${field.label}: ${field.value}`)
      .join("\n");

  const handleSubmit = async () => {
    if (!contract || !isReasonValid || !isTermsValid) return;

    await reissueMutation.mutateAsync({
      contractId: contract.contractId,
      reason: reason.trim(),
      templateId: contract.templateId,
      terms,
    });

    handleClose();
  };

  return (
    <Modal
      isOpen={contract !== null}
      onClose={handleClose}
      title="계약서 재발급"
      description={
        contract
          ? `${contract.staffName} · ${contract.eventTitle} · ${contract.revision}차 → ${contract.revision + 1}차`
          : undefined
      }
      size="lg"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {/* 조항을 고치는 자리라 미리보기가 저장과 나란히 있어야 한다. */}
          <Button
            variant="secondary"
            leftIcon={<Eye size={15} />}
            disabled={!previewDocument}
            onClick={() => setIsPreviewOpen(true)}
            className="mr-auto"
          >
            미리보기
          </Button>

          <Button variant="secondary" onClick={handleClose}>
            취소
          </Button>

          <Button
            variant="primary"
            isLoading={reissueMutation.isPending}
            disabled={!isReasonValid || !isTermsValid}
            onClick={handleSubmit}
          >
            재발급
          </Button>
        </div>
      }
    >
      {contract && (
        <div className="flex flex-col gap-5">
          {/*
            무엇을 고쳐 달라고 했는지가 먼저다.
            사유를 안 보고 문서만 다시 뽑으면 같은 문서가 한 번 더 나가고,
            본인은 두 번째 수정요청을 보내게 된다.
          */}
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-medium text-font-1">
              {contract.staffName}님이 보낸 수정요청
            </p>

            {requests.length === 0 ? (
              <p className="text-[13px] text-font-3">
                기록된 수정요청이 없습니다.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {requests.map((request, index) => (
                  <li
                    key={`${request.requestedAt}-${index}`}
                    className={cn(
                      "rounded-field border px-3 py-2",
                      request.resolvedAt
                        ? "border-border-main bg-subtle"
                        : "border-border-main bg-danger-bg",
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={request.resolvedAt ? "neutral" : "danger"}>
                        {request.resolvedAt
                          ? `${request.resolvedRevision}차로 답함`
                          : "답변 대기"}
                      </Badge>

                      <span className="text-[12px] text-font-3">
                        {formatDateTime(request.requestedAt)}
                      </span>
                    </div>

                    <p className="text-[13px] text-font-1">{request.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 문서 내용 — 템플릿 그대로 / 이 사람 것만 고쳐 쓰기 */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[14px] font-semibold text-font-1">계약서 내용</p>
              <p className="mt-0.5 text-[12px] text-font-2">
                근무일 · 금액 · 포지션은 배치에서 다시 채워집니다. 먼저 행사에서
                고친 뒤 재발급해 주세요. 조항 문구는 여기서 이 계약서만 고칠 수
                있습니다.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="계약서 내용"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {(
                [
                  {
                    custom: false,
                    label: "템플릿 그대로",
                    hint: `${contract.templateName} 조항으로 다시 만듭니다.`,
                  },
                  {
                    custom: true,
                    label: "이 계약서만 고쳐 쓰기",
                    hint: "조항을 넣고 빼고 고칩니다. 템플릿은 바뀌지 않습니다.",
                  },
                ] as const
              ).map((option) => {
                const isSelected = option.custom === isCustom;

                return (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={option.custom && !draft && !contract.customTerms}
                    onClick={() => {
                      if (isSelected) return;
                      /*
                        고쳐 쓰기는 지난 차수에서 고쳐 둔 내용이 있으면 거기서,
                        없으면 템플릿에서 출발한다.
                      */
                      setEditedTerms(
                        option.custom
                          ? (contract.customTerms ??
                              (draft ? buildCustomTermsFrom(draft.template) : null))
                          : null,
                      );
                    }}
                    className={cn(
                      "rounded-field border px-3 py-2.5 text-left transition disabled:opacity-50",
                      isSelected
                        ? "border-brand bg-brand-opacity-3"
                        : "border-border-main hover:border-brand",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-[14px] font-medium",
                        isSelected ? "text-brand" : "text-font-1",
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-font-2">
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            {terms && (
              <>
                {hasFrozenAutoClause && (
                  <Alert tone="warning" title="자동 조항을 문구로 풀었습니다.">
                    풀어 쓴 근무일 · 금액은 이후 배치를 고쳐도 문서에 따라오지
                    않습니다. 정산은 배치 금액으로 나가니, 숫자를 바꿀 때는 행사에서도
                    함께 고쳐 주세요.
                  </Alert>
                )}

                <ContractTermsEditor
                  value={terms}
                  onChange={setEditedTerms}
                  resolveAutoText={resolveAutoText}
                />
              </>
            )}
          </div>

          <FormField
            label="무엇을 고쳤는지"
            required
            hint="근로자에게 그대로 보입니다. 요청한 내용을 반영했는지 한 줄로 적어 주세요."
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {AMEND_REASON_PRESETS.REVISION_REQUEST.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className={cn(
                      "rounded-field border px-2.5 py-1 text-[12px] transition hover:border-brand active:scale-[0.98]",
                      reason === preset
                        ? "border-brand bg-brand-opacity-3 text-brand"
                        : "border-border-main text-font-2",
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <Textarea
                rows={3}
                value={reason}
                hasError={!isReasonValid}
                onChange={(changeEvent) => setReason(changeEvent.target.value)}
                placeholder="예) 2일차 근무시간을 21:00~06:00으로 정정했습니다."
              />

              {openRequests.length > 1 && (
                <p className="text-[12px] text-font-3">
                  답변 대기 중인 요청이 {openRequests.length}건입니다. 재발급하면
                  모두 이번 차수로 답한 것으로 남습니다.
                </p>
              )}
            </div>
          </FormField>

          <p className="text-[12px] text-font-2">
            지금 차수는 재작성됨으로 남고, 새 차수가 서명 대기로 본인 화면에
            올라갑니다.
          </p>
        </div>
      )}

      {/* 새 차수 미리보기. 본인이 포털에서 받아 볼 문서와 같은 함수로 조립한다. */}
      <Modal
        isOpen={isPreviewOpen && previewDocument !== null}
        onClose={() => setIsPreviewOpen(false)}
        title={`${(contract?.revision ?? 0) + 1}차 계약서 미리보기`}
        description="재발급하면 이 문서가 본인에게 서명 대기로 올라갑니다."
        size="xl"
      >
        {previewDocument && <ContractSheetView document={previewDocument} />}
      </Modal>
    </Modal>
  );
};

export default ContractReissueModal;
