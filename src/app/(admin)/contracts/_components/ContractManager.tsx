"use client";

import { useState } from "react";
import { useSelection } from "@/hooks/useSelection";
import { formatTimeRange } from "@/type/event";
import { useContractListQuery } from "@/api/contract/getContractList";
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
import { useListSearch } from "@/hooks/useListSearch";
import { Check, Eye, FileText, Plus, Refresh, Send } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  CONTRACT_STATUS_LABEL,
  type Contract,
  type ContractStatus,
} from "@/type/contract";
import { formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import DateRangeFilter, { type DateRange } from "@/components/ui/DateRangeFilter";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import StatTile from "@/components/domain/StatTile";
import ContractAmendModal from "@/components/domain/ContractAmendModal";
import ContractDetailModal from "@/components/domain/ContractDetailModal";
import WageText from "@/components/domain/WageText";
import ContractGenerateModal from "./ContractGenerateModal";


const CONTRACT_CSV_COLUMNS: CsvColumn<Contract>[] = [
  ...CONTRACT_WHO_COLUMNS,
  { header: "행사명", value: (row) => row.eventTitle },
  { header: "거래처", value: (row) => row.clientName },
  ...CONTRACT_WORK_COLUMNS,
  ...CONTRACT_WAGE_COLUMNS,
  ...CONTRACT_STATUS_COLUMNS,
  ...CONTRACT_REVISION_COLUMNS,
];

/**
 * 근로계약서 관리.
 *
 * 기존 방식의 가장 큰 구멍은 "근무 전에 계약서가 나가지 못하는 것"이었다.
 * 그래서 미완료 건을 상단 지표와 필터로 항상 먼저 보이게 한다.
 */
const ContractManager = () => {
  const jobRoleLabel = useJobRoleLabel();
  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  const [status, setStatus] = useState<ContractStatus | "">("");
  const [range, setRange] = useState<DateRange>({ startDate: "", endDate: "" });

  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [detailContractId, setDetailContractId] = useState<number | null>(null);
  const [amendTarget, setAmendTarget] = useState<Contract | null>(null);

  const { data, isLoading } = useContractListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    status: status || undefined,
    startDate: range.startDate || undefined,
    endDate: range.endDate || undefined,
  });

  /** 상단 지표는 필터와 무관하게 전체 기준으로 본다. */
  const { data: draftData } = useContractListQuery({
    page: 1,
    size: 1,
    status: "DRAFT",
  });
  const { data: sentData } = useContractListQuery({
    page: 1,
    size: 1,
    status: "SENT",
  });
  const { data: signedData } = useContractListQuery({
    page: 1,
    size: 1,
    status: "SIGNED",
  });

  const { statusMutation } = useContractMutation();

  const rows = data?.content ?? [];
  const { selectedIds, isAllSelected, isSelected, toggle, toggleAll, clear } =
    useSelection(rows.map((row) => row.contractId));

  const handleBulkStatus = (nextStatus: ContractStatus) => {
    const label = nextStatus === "SENT" ? "발송" : "서명 완료 처리";

    openConfirm({
      title: `선택한 ${selectedIds.length}건을 ${label}할까요?`,
      description:
        nextStatus === "SENT"
          ? "문자 발송 연동 전까지는 상태만 바뀝니다. 계약서 링크는 공지 · 발송 화면에서 함께 보내 주세요."
          : "서명 완료로 표시하면 배치 현황의 계약서 상태도 함께 바뀝니다.",
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
        <div onClick={(event) => event.stopPropagation()}>
          <Checkbox
            aria-label={`${contract.staffName} 선택`}
            checked={isSelected(contract.contractId)}
            onChange={() => toggle(contract.contractId)}
          />
        </div>
      ),
    },
    {
      /* 재작성본은 계약번호만 보고 알 수 있어야 옛 문서로 서명을 받으러 가지 않는다. */
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
      key: "event",
      header: "행사 / 근무일",
      render: (contract) => (
        <TableCellStack
          primary={contract.eventTitle}
          secondary={
            <span className="tabular-nums">
              {formatDate(contract.workDate)}{" "}
              {formatTimeRange(
                contract.startTime,
                contract.endTime,
                contract.endDayOffset,
              )}
            </span>
          }
        />
      ),
    },
    {
      key: "role",
      header: "직무",
      render: (contract) => (
        <Badge tone="neutral">{jobRoleLabel(contract.role)}</Badge>
      ),
    },
    {
      key: "wage",
      header: "임금",
      align: "right",
      numeric: true,
      /* 날마다 금액이 다른 건은 대표 금액을 적으면 총 지급액과 맞지 않는다. */
      render: (contract) =>
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
      key: "template",
      header: "템플릿",
      render: (contract) => (
        <span className="text-[13px] text-font-2">{contract.templateName}</span>
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
          onClick={(event) => event.stopPropagation()}
        >
          {/*
            재작성은 여러 날짜 계약에서만 뜻이 있다. 하루짜리는 뺄 날이 없어
            안 나왔으면 재작성이 아니라 해지다. 이미 대체된 문서도 손대지 않는다.
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile
          label="미발송 (작성됨)"
          value={`${draftData?.totalCount ?? 0}건`}
          description="아직 근로자에게 나가지 않은 계약서입니다."
          tone={(draftData?.totalCount ?? 0) > 0 ? "danger" : "default"}
          icon={<FileText size={18} />}
        />
        <StatTile
          label="서명 대기"
          value={`${sentData?.totalCount ?? 0}건`}
          description="발송됐지만 아직 서명이 오지 않았습니다."
          tone={(sentData?.totalCount ?? 0) > 0 ? "warning" : "default"}
          icon={<Send size={18} />}
        />
        <StatTile
          label="서명 완료"
          value={`${signedData?.totalCount ?? 0}건`}
          icon={<Check size={18} />}
        />
      </div>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={handleSearch}
            placeholder="이름 · 행사명 · 계약번호 검색"
          />

          <div className="flex flex-wrap items-center gap-2">
            <CsvExportButton
              fileName="근로계약서"
              rows={rows}
              columns={CONTRACT_CSV_COLUMNS}
              disabled={isLoading}
            />

            <Select
              aria-label="상태 필터"
              options={CONTRACT_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={withPageReset((event) => setStatus(event.target.value as ContractStatus | ""))}
              selectBoxClassName="w-32"
            />

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => setIsGenerateOpen(true)}
            >
              계약서 일괄 생성
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5">
          <DateRangeFilter
            value={range}
            onChange={withPageReset((next) => setRange(next))}
          />

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-font-2 tabular-nums">
                {selectedIds.length}건 선택
              </span>
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
          )}
        </div>

        <Table
          columns={columns}
          rows={rows}
          getRowKey={(contract) => String(contract.contractId)}
          isLoading={isLoading}
          onRowClick={(contract) => setDetailContractId(contract.contractId)}
          emptyTitle="계약서가 없습니다."
          emptyDescription="행사 배치를 끝낸 뒤 '계약서 일괄 생성'을 눌러 보세요."
          emptyAction={
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              onClick={() => setIsGenerateOpen(true)}
            >
              계약서 일괄 생성
            </Button>
          }
        />

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={DEFAULT_PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      <ContractGenerateModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
      />

      <ContractDetailModal
        contractId={detailContractId}
        onClose={() => setDetailContractId(null)}
      />

      <ContractAmendModal
        contract={amendTarget}
        onClose={() => setAmendTarget(null)}
      />
    </>
  );
};

export default ContractManager;
