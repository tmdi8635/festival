"use client";

import { useState } from "react";
import { useSelection } from "@/hooks/useSelection";
import { useContractListQuery } from "@/api/contract/getContractList";
import { useContractTemplateListQuery } from "@/api/contract/getContractTemplateList";
import { useContractMutation } from "@/api/contract/mutateContract";
import {
  CONTRACT_STATUS_FILTER_OPTIONS,
  CONTRACT_STATUS_TONE,
} from "@/constants/contractOptions";
import {
  CONTRACT_REVISION_COLUMNS,
  CONTRACT_STATUS_COLUMNS,
  CONTRACT_WAGE_COLUMNS,
  CONTRACT_WHO_COLUMNS,
  CONTRACT_WORK_COLUMNS,
} from "@/constants/csvColumns";
import { Check, Eye, FileText, Plus, Refresh, Send } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  CONTRACT_STATUS_LABEL,
  type Contract,
  type ContractStatus,
} from "@/type/contract";
import { type EventDetail } from "@/type/event";
import { formatPhoneNumber } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import ContractAmendModal from "@/components/domain/ContractAmendModal";
import ContractDetailModal from "@/components/domain/ContractDetailModal";
import WageText from "@/components/domain/WageText";

/** 행사 단위로 계약 이행 현황을 보관·확인할 때 쓰는 컬럼 */
const CONTRACT_CSV_COLUMNS: CsvColumn<Contract>[] = [
  ...CONTRACT_WHO_COLUMNS,
  ...CONTRACT_WORK_COLUMNS,
  ...CONTRACT_WAGE_COLUMNS,
  ...CONTRACT_STATUS_COLUMNS,
  ...CONTRACT_REVISION_COLUMNS,
];

/** 행사 하나의 계약서는 인원 수만큼이라 한 번에 받아 온다. */
const CONTRACT_PAGE_SIZE = 200;

interface EventContractPanelProps {
  event: EventDetail;
}

/**
 * 근로계약서 탭.
 *
 * 가장 큰 구멍은 "근무 전에 계약서가 나가지 못하는 것"이었다.
 * 계약서를 행사에 붙여 두면 배치를 끝낸 자리에서 곧바로 생성 · 발송까지 이어진다.
 * (예전에는 계약서 메뉴로 나가 같은 행사를 다시 검색해야 했다)
 */
const EventContractPanel = ({ event }: EventContractPanelProps) => {
  const roleLabel = useJobRoleLabel();

  const [status, setStatus] = useState<ContractStatus | "">("");
  const [detailContractId, setDetailContractId] = useState<number | null>(null);
  const [amendTarget, setAmendTarget] = useState<Contract | null>(null);
  // 고르기 전에는 기본 템플릿을 그대로 쓰고, 고르면 draft가 화면을 담당한다.
  const [draftTemplateId, setDraftTemplateId] = useState<string | null>(null);

  const { data, isLoading } = useContractListQuery({
    page: 1,
    size: CONTRACT_PAGE_SIZE,
    eventId: String(event.eventId),
    status: status || undefined,
  });
  const { data: templateData } = useContractTemplateListQuery();
  const { generateMutation, statusMutation } = useContractMutation();

  const rows = data?.content ?? [];
  const { selectedIds, isAllSelected, isSelected, toggle, toggleAll, clear } =
    useSelection(rows.map((row) => row.contractId));

  const templates = (templateData?.items ?? []).filter(
    (template) => template.isActive,
  );
  const templateId =
    draftTemplateId ??
    String(
      templates.find((template) => template.isDefault)?.templateId ??
        templates[0]?.templateId ??
        0,
    );
  const templateOptions = templates.map((template) => ({
    label: template.isDefault ? `${template.name} (기본)` : template.name,
    value: String(template.templateId),
  }));

  /*
    계약서는 사람 단위로 한 장이 나간다. (여러 날 나오는 인력도 한 장에 근무일이 모두 담긴다)
    그래서 "아직 계약서가 없는 사람"은 확정 배치의 인력 중 계약서에 없는 사람이다.
    상태 필터가 걸려 있으면 목록만으로는 셀 수 없어 전체 목록을 따로 받는다.
  */
  const { data: allContractData } = useContractListQuery({
    page: 1,
    size: CONTRACT_PAGE_SIZE,
    eventId: String(event.eventId),
  });
  const contractedStaffIds = new Set(
    (allContractData?.content ?? []).map((contract) => contract.staffId),
  );
  const missingStaff = [
    ...new Map(
      event.assignments
        .filter(
          (assignment) =>
            assignment.status === "CONFIRMED" &&
            !contractedStaffIds.has(assignment.staffId),
        )
        .map((assignment) => [assignment.staffId, assignment]),
    ).values(),
  ];

  /*
    재작성한 뒤 아직 서명을 못 받은 건.

    중도 종료를 처리하고 나면 새 차수가 '작성됨'으로 남는데, 이건
    "계약서가 있다"에 걸려 미작성 인원 알림에는 잡히지 않는다.
    그대로 두면 서명 없는 문서로 정산까지 가므로 따로 세어 보여 준다.
  */
  const amendedUnsigned = (allContractData?.content ?? []).filter(
    (contract) => contract.revision > 1 && contract.status !== "SIGNED",
  );

  const handleGenerate = () => {
    generateMutation.mutate({
      eventId: event.eventId,
      templateId: Number(templateId),
    });
  };

  const handleBulkStatus = (nextStatus: ContractStatus) => {
    const label = nextStatus === "SENT" ? "발송" : "서명 완료 처리";

    openConfirm({
      title: `선택한 ${selectedIds.length}건을 ${label}할까요?`,
      description:
        nextStatus === "SENT"
          ? "문자 발송 연동 전까지는 상태만 바뀝니다. 계약서 링크는 공지 · 발송 화면에서 함께 보내 주세요."
          : "서명 완료로 표시하면 이 행사의 배치 현황과 상단 요약도 함께 바뀝니다.",
      confirmText: nextStatus === "SENT" ? "발송" : "서명 완료",
      onConfirm: () =>
        statusMutation
          .mutateAsync({ contractIds: selectedIds, status: nextStatus })
          .then(() => clear()),
    });
  };

  const columns: TableColumn<Contract>[] = [
    {
      key: "select",
      header: (
        <Checkbox
          aria-label="전체 선택"
          checked={isAllSelected}
          onChange={toggleAll}
        />
      ),
      width: "44px",
      align: "center",
      render: (contract) => (
        <div onClick={(clickEvent) => clickEvent.stopPropagation()}>
          <Checkbox
            aria-label={`${contract.staffName} 선택`}
            checked={isSelected(contract.contractId)}
            onChange={() => toggle(contract.contractId)}
          />
        </div>
      ),
    },
    {
      key: "staff",
      header: "근로자",
      render: (contract) => (
        <TableCellStack
          primary={contract.staffName}
          secondary={
            <span className="tabular-nums">
              {formatPhoneNumber(contract.staffPhone)}
            </span>
          }
        />
      ),
    },
    {
      /*
        재작성본은 계약번호만 보고 알 수 있어야 한다.
        같은 사람의 계약서가 두 줄 있는데 어느 쪽이 유효한지 모르면
        옛 문서를 들고 서명을 받으러 간다.
      */
      key: "contractNumber",
      header: "계약번호",
      render: (contract) => (
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] text-font-2 tabular-nums">
            {contract.contractNumber}
          </span>
          {contract.revision > 1 && (
            <Badge tone="info" title={contract.amendReason}>
              {contract.revision}차
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "role",
      header: "직무",
      render: (contract) => (
        <Badge tone="neutral">{roleLabel(contract.role)}</Badge>
      ),
    },
    {
      /* 여러 날 나오는 인력은 근무일이 여러 개다. 며칠짜리 계약인지가 금액의 근거다. */
      key: "workDates",
      header: "계약 근무일",
      render: (contract) => (
        <TableCellStack
          primary={
            <span className="tabular-nums">
              {formatDate(contract.workDates[0])}
              {contract.workDates.length > 1 &&
                ` 외 ${contract.workDates.length - 1}일`}
            </span>
          }
          secondary={
            <span className="tabular-nums">
              총 {contract.totalWorkHours}시간
              {/* 중도 종료로 빠진 날은 이 줄에서 바로 보여야 금액이 설명된다. */}
              {contract.removedWorkDates &&
                contract.removedWorkDates.length > 0 &&
                ` · 제외 ${contract.removedWorkDates.length}일`}
            </span>
          }
        />
      ),
    },
    {
      key: "wage",
      header: "임금",
      align: "right",
      numeric: true,
      render: (contract) =>
        /*
          날마다 금액이 다른 건은 대표 금액 하나를 적으면 안 된다.
          "시급 12,000원"과 총 지급액이 맞지 않아 오히려 계산을 의심하게 된다.
        */
        contract.hasMixedWage ? (
          <Badge tone="neutral" title="근무일마다 지급 조건이 다릅니다.">
            근무일별 상이
          </Badge>
        ) : (
          <WageText wageType={contract.wageType} wage={contract.wage} />
        ),
    },
    {
      key: "totalWage",
      header: "총 지급액",
      align: "right",
      numeric: true,
      render: (contract) => (
        <span className="font-medium">{formatCurrency(contract.totalWage)}</span>
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (contract) => (
        <Badge tone={CONTRACT_STATUS_TONE[contract.status]}>
          {CONTRACT_STATUS_LABEL[contract.status]}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "220px",
      align: "right",
      render: (contract) => (
        <div
          className="flex justify-end"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          {/*
            재작성은 여러 날짜 계약에서만 뜻이 있다.
            하루짜리 계약은 뺄 날이 없어서, 안 나왔으면 재작성이 아니라 해지다.
            이미 대체된 문서도 손대지 않는다. 항상 마지막 차수에서만 이어 간다.
          */}
          {contract.workDates.length > 1 &&
            contract.status !== "SUPERSEDED" && (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Refresh size={14} />}
                onClick={() => setAmendTarget(contract)}
                title="중도 종료된 인력의 계약서를 실제 근무일로 다시 만듭니다."
              >
                중도 종료
              </Button>
            )}

          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Eye size={14} />}
            onClick={() => setDetailContractId(contract.contractId)}
          >
            미리보기
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/*
        계약서가 없는 확정 인원을 먼저 보여 준다.
        "몇 명 남았는가"를 세는 일과 "만들기"를 같은 자리에서 끝낸다.
      */}
      {missingStaff.length > 0 && (
        <Alert
          tone="danger"
          title={`계약서가 없는 확정 인원이 ${missingStaff.length}명 있습니다.`}
        >
          {missingStaff
            .slice(0, 8)
            .map((assignment) => assignment.staffName)
            .join(", ")}
          {missingStaff.length > 8 && ` 외 ${missingStaff.length - 8}명`} ·
          서명이 끝나야 현장 투입이 가능합니다. 아래에서 템플릿을 고르고 한 번에
          만드세요.
        </Alert>
      )}

      {amendedUnsigned.length > 0 && (
        <Alert
          tone="warning"
          title={`재작성한 계약서 ${amendedUnsigned.length}건의 서명이 아직입니다.`}
        >
          {amendedUnsigned
            .map((contract) => `${contract.staffName}(${contract.revision}차)`)
            .join(", ")}{" "}
          · 재작성본은 <b>서명을 처음부터 다시</b> 받아야 합니다. 이전 차수의
          서명은 바뀐 근무일 · 금액에 대한 동의가 아닙니다.
        </Alert>
      )}

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="계약서 템플릿"
              options={
                templateOptions.length > 0
                  ? templateOptions
                  : [{ label: "사용 가능한 템플릿이 없습니다", value: "0" }]
              }
              value={templateId}
              onChange={(changeEvent) =>
                setDraftTemplateId(changeEvent.target.value)
              }
              selectBoxClassName="w-52"
            />

            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus size={15} />}
              onClick={handleGenerate}
              disabled={templateId === "0" || missingStaff.length === 0}
              isLoading={generateMutation.isPending}
              title="계약서가 없는 확정 인원에게 한 번에 만듭니다."
            >
              계약서 일괄 생성
              {missingStaff.length > 0 && ` (${missingStaff.length}명)`}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <CsvExportButton
              fileName={`${event.title}_근로계약서`}
              rows={rows}
              columns={CONTRACT_CSV_COLUMNS}
              disabled={isLoading || rows.length === 0}
            />

            <Select
              aria-label="상태 필터"
              options={CONTRACT_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={(changeEvent) => {
                setStatus(changeEvent.target.value as ContractStatus | "");
                clear();
              }}
              selectBoxClassName="w-32"
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-border-main bg-subtle px-5 py-3">
            <span className="text-[13px] text-font-2 tabular-nums">
              {selectedIds.length}건 선택
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Send size={14} />}
                onClick={() => handleBulkStatus("SENT")}
              >
                발송 처리
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Check size={14} />}
                onClick={() => handleBulkStatus("SIGNED")}
              >
                서명 완료
              </Button>
            </div>
          </div>
        )}

        <Table
          columns={columns}
          rows={rows}
          getRowKey={(contract) => String(contract.contractId)}
          isLoading={isLoading}
          onRowClick={(contract) => setDetailContractId(contract.contractId)}
          emptyTitle="이 행사의 계약서가 아직 없습니다."
          emptyDescription="확정 배치를 끝낸 뒤 템플릿을 고르고 '계약서 일괄 생성'을 눌러 보세요."
          emptyAction={
            <Button
              variant="primary"
              leftIcon={<FileText size={15} />}
              onClick={handleGenerate}
              disabled={templateId === "0" || missingStaff.length === 0}
              isLoading={generateMutation.isPending}
            >
              계약서 일괄 생성
            </Button>
          }
        />
      </Card>

      <ContractDetailModal
        contractId={detailContractId}
        onClose={() => setDetailContractId(null)}
      />

      <ContractAmendModal
        contract={amendTarget}
        event={event}
        onClose={() => setAmendTarget(null)}
      />
    </>
  );
};

export default EventContractPanel;
