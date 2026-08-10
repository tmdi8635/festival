"use client";

import { useState } from "react";
import { formatTimeRange } from "@/type/event";
import { useContractRosterQuery } from "@/api/contract/getContractRoster";
import { useHasPermission } from "@/store/useAdminStore";
import { CONTRACT_STATUS_TONE } from "@/constants/contractOptions";
import { useListSearch } from "@/hooks/useListSearch";
import { Check, FileText, Refresh, Warning } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { cn, formatCurrency } from "@/lib/utils";
import { useJobRoleFilterOptions, useJobRoleLabel } from "@/store/useOrgStore";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  CONTRACT_ROSTER_STATE_ORDER,
  CONTRACT_STATUS_LABEL,
  type Contract,
  type ContractRosterRow,
  type ContractRosterState,
} from "@/type/contract";
import { formatPhoneNumber, type JobRole } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CsvExportButton from "@/components/ui/CsvExportButton";
import DateRangeFilter, { type DateRange } from "@/components/ui/DateRangeFilter";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import StatTile from "@/components/domain/StatTile";
import ContractAmendModal from "@/components/domain/ContractAmendModal";
import ContractDetailModal, {
  type ContractDetailTarget,
} from "@/components/domain/ContractDetailModal";
import WageText from "@/components/domain/WageText";

/**
 * 명단의 상태 이름.
 * '발급 전'은 계약 상태가 아니라 **아직 시작도 안 한 것**이라 따로 둔다.
 */
const ROSTER_STATE_LABEL: Record<ContractRosterState, string> = {
  NONE: "발급 전",
  ...CONTRACT_STATUS_LABEL,
};

const ROSTER_STATE_TONE = {
  NONE: "danger",
  ...CONTRACT_STATUS_TONE,
} as const;

const ROSTER_STATE_FILTER_OPTIONS = [
  { label: "전체 상태", value: "" },
  ...CONTRACT_ROSTER_STATE_ORDER.map((state) => ({
    label: ROSTER_STATE_LABEL[state],
    value: state,
  })),
];

const ROSTER_CSV_COLUMNS: CsvColumn<ContractRosterRow>[] = [
  { header: "상태", value: (row) => ROSTER_STATE_LABEL[row.state] },
  { header: "계약번호", value: (row) => row.contract?.contractNumber ?? "" },
  { header: "이름", value: (row) => row.staffName },
  { header: "연락처", value: (row) => row.staffPhone },
  { header: "행사명", value: (row) => row.eventTitle },
  { header: "거래처", value: (row) => row.clientName },
  { header: "근무일", value: (row) => row.workDates.join(" ") },
  { header: "근무일수", value: (row) => row.workDates.length },
  { header: "총 실근무시간", value: (row) => row.totalWorkHours },
  { header: "총 지급액", value: (row) => row.totalWage },
  { header: "계약 차수", value: (row) => row.contract?.revision ?? "" },
  {
    header: "서명본 파일",
    value: (row) => row.contract?.signedFile?.fileName ?? "",
  },
];

/**
 * 근로계약서 관리.
 *
 * **이 화면은 계약서 목록이 아니라 계약 명단이다.**
 *
 * 계약서 기록은 서명본을 올려야 생긴다. 그래서 만들어진 문서만 늘어놓으면
 * 정작 담당자가 제일 알아야 하는 **"아직 계약서를 못 쓴 사람이 누구인가"** 가
 * 화면에 아예 없다. 근로계약서는 반드시 써야 하는 것이고, 안 쓴 것을 찾는 일이
 * 이 화면의 존재 이유다.
 *
 * 그래서 **확정 배치 전원**을 세운다. (`buildContractRoster`)
 * 행사 상세의 탭이 한 행사 안에서 하는 일을, 여기서는 행사를 가로질러 한다.
 *
 * 줄의 단위는 **행사 하나 × 사람 하나**다. 같은 사람이 행사 두 개에 나갔으면
 * 줄도 두 개다. 계약은 사람이 아니라 그 행사의 근로에 대해 맺는 것이라
 * 계약서도 두 장 나와야 하기 때문이다.
 */
const ContractManager = () => {
  const jobRoleLabel = useJobRoleLabel();
  const jobRoleFilterOptions = useJobRoleFilterOptions();
  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  const [state, setState] = useState<ContractRosterState | "">("");
  const [role, setRole] = useState<JobRole | "">("");
  const [range, setRange] = useState<DateRange>({ startDate: "", endDate: "" });

  const [detailTarget, setDetailTarget] =
    useState<ContractDetailTarget | null>(null);
  const [amendTarget, setAmendTarget] = useState<Contract | null>(null);

  const { data, isLoading } = useContractRosterQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    state: state || undefined,
    role: role || undefined,
    startDate: range.startDate || undefined,
    endDate: range.endDate || undefined,
  });

  const canWrite = useHasPermission("contract:write");

  const rows = data?.content ?? [];
  const counts = data?.stateCounts;

  const openDetail = (row: ContractRosterRow) =>
    setDetailTarget({
      eventId: row.eventId,
      staffId: row.staffId,
      templateId: row.contract?.templateId,
    });

  const columns: TableColumn<ContractRosterRow>[] = [
    {
      /*
        상태가 맨 앞이다. 이 화면에서 훑는 것은 계약번호가 아니라
        "이 사람 계약서 됐나"이고, 아직 안 된 줄은 번호 자체가 없다.
      */
      key: "state",
      header: "상태",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={ROSTER_STATE_TONE[row.state]}>
            {ROSTER_STATE_LABEL[row.state]}
          </Badge>
          {row.contract && row.contract.revision > 1 && (
            <Badge tone="info" title={row.contract.amendReason}>
              {row.contract.revision}차
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "staff",
      header: "근로자",
      render: (row) => (
        <TableCellStack
          primary={row.staffName}
          secondary={
            <span className="tabular-nums">
              {formatPhoneNumber(row.staffPhone)}
            </span>
          }
        />
      ),
    },
    {
      key: "event",
      header: "행사 / 근무일",
      render: (row) => (
        <TableCellStack
          primary={row.eventTitle}
          secondary={
            <span className="tabular-nums">
              {formatDate(row.workDate)}
              {row.workDates.length > 1 && ` 외 ${row.workDates.length - 1}일`} ·{" "}
              {formatTimeRange(row.startTime, row.endTime, row.endDayOffset)}
            </span>
          }
        />
      ),
    },
    {
      key: "role",
      header: "직무",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          {row.roles.map((item) => (
            <Badge key={item} tone="neutral">
              {jobRoleLabel(item)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "wage",
      header: "임금",
      align: "right",
      numeric: true,
      /* 날마다 금액이 다른 건은 대표 금액을 적으면 총 지급액과 맞지 않는다. */
      render: (row) =>
        row.hasMixedWage ? (
          <Badge tone="neutral" title="근무일마다 지급 조건이 다릅니다.">
            근무일별 상이
          </Badge>
        ) : (
          <WageText wageType={row.wageType} wage={row.wage} />
        ),
    },
    {
      key: "totalWage",
      header: "총 지급액",
      align: "right",
      numeric: true,
      render: (row) => (
        <span className="font-medium">{formatCurrency(row.totalWage)}</span>
      ),
    },
    {
      key: "contractNumber",
      header: "계약번호",
      render: (row) => (
        <TableCellStack
          primary={
            <span
              className={cn(
                "text-[13px] tabular-nums",
                row.contract ? "text-font-1" : "text-font-disabled",
              )}
            >
              {/* 번호는 서명본을 등록할 때 붙는다. 없다는 것 자체가 "아직 시작 전"이다. */}
              {row.contract?.contractNumber ?? "발급 전"}
            </span>
          }
          secondary={
            row.contract?.signedFile ? (
              <span className="truncate">
                {row.contract.signedFile.fileName}
              </span>
            ) : undefined
          }
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      /*
        줄을 누르면 상세가 열린다. 그래서 여는 단추는 두지 않는다.
        여기 남길 것은 목록에서만 눈에 띄어야 하는 일, 즉 중도 종료 하나다.
      */
      render: (row) =>
        canWrite &&
        row.contract &&
        row.contract.status !== "SUPERSEDED" &&
        row.workDates.length > 1 ? (
          <div onClick={(event) => event.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Refresh size={14} />}
              onClick={() => setAmendTarget(row.contract)}
              title="중도 종료된 인력의 계약서를 실제 근무일로 다시 만듭니다."
            >
              중도 종료
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/*
          '발급 전'이 첫 칸이다.
          이 숫자가 0이 아니면 그만큼의 사람이 계약서 없이 현장에 설 수 있다.
        */}
        <StatTile
          label="발급 전"
          value={`${counts?.NONE ?? 0}명`}
          description="확정 배치는 됐는데 아직 서명본이 없습니다."
          tone={(counts?.NONE ?? 0) > 0 ? "danger" : "default"}
          icon={<Warning size={18} />}
        />
        <StatTile
          label="등록 대기"
          value={`${counts?.DRAFT ?? 0}명`}
          description="재작성해 놓고 서명본을 아직 못 받았습니다."
          tone={(counts?.DRAFT ?? 0) > 0 ? "warning" : "default"}
          icon={<FileText size={18} />}
        />
        <StatTile
          label="서명 완료"
          value={`${counts?.SIGNED ?? 0}명`}
          description="서명본이 등록돼 계약번호가 발급됐습니다."
          icon={<Check size={18} />}
        />
      </div>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={handleSearch}
            placeholder="이름 · 행사명 · 거래처 · 계약번호 검색"
          />

          <div className="flex flex-wrap items-center gap-2">
            <CsvExportButton
              fileName="근로계약_명단"
              rows={rows}
              columns={ROSTER_CSV_COLUMNS}
              disabled={isLoading || rows.length === 0}
            />

            <Select
              aria-label="직무 필터"
              options={jobRoleFilterOptions}
              value={role}
              onChange={withPageReset((event) =>
                setRole(event.target.value as JobRole | ""),
              )}
              selectBoxClassName="w-32"
            />

            <Select
              aria-label="상태 필터"
              options={ROSTER_STATE_FILTER_OPTIONS}
              value={state}
              onChange={withPageReset((event) =>
                setState(event.target.value as ContractRosterState | ""),
              )}
              selectBoxClassName="w-32"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:px-5">
          <DateRangeFilter
            value={range}
            onChange={withPageReset((next) => setRange(next))}
          />
        </div>

        <Table
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.rowId}
          isLoading={isLoading}
          onRowClick={openDetail}
          emptyTitle="계약 대상이 없습니다."
          emptyDescription="행사에 인력을 배치하고 확정하면 여기에 계약 대상이 나타납니다."
        />

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={DEFAULT_PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      <ContractDetailModal
        target={detailTarget}
        onClose={() => setDetailTarget(null)}
      />

      <ContractAmendModal
        contract={amendTarget}
        onClose={() => setAmendTarget(null)}
      />
    </>
  );
};

export default ContractManager;
