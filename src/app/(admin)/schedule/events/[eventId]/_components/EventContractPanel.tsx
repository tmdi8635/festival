"use client";

import { useState } from "react";
import { useSelection } from "@/hooks/useSelection";
import { useContractListQuery } from "@/api/contract/getContractList";
import { useContractTemplateListQuery } from "@/api/contract/getContractTemplateList";
import { useContractMutation } from "@/api/contract/mutateContract";
import { CONTRACT_STATUS_TONE } from "@/constants/contractOptions";
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
import { showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import {
  useJobRoleComparator,
  useJobRoleFilterOptions,
  useJobRoleLabel,
} from "@/store/useOrgStore";
import {
  CONTRACT_STATUS_LABEL,
  type Contract,
  type ContractStatus,
} from "@/type/contract";
import { type EventDetail } from "@/type/event";
import { formatPhoneNumber, type JobRole } from "@/type/staff";
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

const CONTRACT_CSV_COLUMNS: CsvColumn<Contract>[] = [
  ...CONTRACT_WHO_COLUMNS,
  ...CONTRACT_WORK_COLUMNS,
  ...CONTRACT_WAGE_COLUMNS,
  ...CONTRACT_STATUS_COLUMNS,
  ...CONTRACT_REVISION_COLUMNS,
];

/** 행사 하나의 계약서는 인원 수만큼이라 한 번에 받아 온다. */
const CONTRACT_PAGE_SIZE = 200;

/**
 * 명단에서 한 사람이 놓인 자리.
 * `NONE`은 "확정 배치는 됐는데 계약서가 아직 없다"는 뜻이다.
 */
type RosterState = "NONE" | ContractStatus;

const ROSTER_STATE_LABEL: Record<RosterState, string> = {
  NONE: "미발급",
  ...CONTRACT_STATUS_LABEL,
};

/** 미발급은 '아직 시작도 안 한 것'이라 계약 상태들과 다른 색으로 둔다. */
const ROSTER_STATE_TONE = {
  NONE: "danger",
  ...CONTRACT_STATUS_TONE,
} as const;

/**
 * 처리 순서대로 세운다.
 * 담당자가 보는 것은 "어디까지 왔나"이므로 미발급 → 작성 → 발송 → 서명 순이어야 하고,
 * 손이 더 가야 하는 반려 · 만료가 완료된 것보다 뒤에 묻히면 안 된다.
 */
const ROSTER_STATE_ORDER: RosterState[] = [
  "NONE",
  "REJECTED",
  "EXPIRED",
  "DRAFT",
  "SENT",
  "SIGNED",
  "SUPERSEDED",
];

interface RosterRow {
  staffId: number;
  staffName: string;
  staffPhone: string;
  /** 이 행사에서 맡은 직무. 첫날 설치 · 이후 스태프처럼 둘 이상일 수 있다. */
  roles: JobRole[];
  workDates: string[];
  contract: Contract | null;
  state: RosterState;
}

interface EventContractPanelProps {
  event: EventDetail;
}

/**
 * 근로계약서 탭.
 *
 * **이 탭의 주인공은 계약서가 아니라 사람이다.**
 * 예전에는 이미 만들어진 계약서만 늘어놓아서, 정작 담당자가 제일 알고 싶은
 * "아직 계약서를 못 받은 사람이 누구인가"가 목록에 아예 없었다.
 * 미작성 인원은 경고 문구 안의 숫자로만 있었고, 그 숫자를 눌러도 명단이 나오지 않았다.
 *
 * 그래서 **확정 배치된 전원**을 먼저 세우고, 각자가 계약 절차의 어디에 있는지를
 * 한 줄로 붙인다. 미발급 · 작성됨 · 발송됨 · 반려 · 서명완료가 한 화면에서 갈린다.
 *
 * 계약서는 사람 한 명당 한 장이다. 여러 날 나오는 사람도 한 장에 근무일이 모두 담긴다.
 * (날짜마다 만들면 서명도 날짜 수만큼 받아야 한다)
 */
const EventContractPanel = ({ event }: EventContractPanelProps) => {
  const roleLabel = useJobRoleLabel();
  const compareRoles = useJobRoleComparator();
  const jobRoleFilterOptions = useJobRoleFilterOptions();

  const [state, setState] = useState<RosterState | "">("");
  const [role, setRole] = useState<JobRole | "">("");
  const [detailContractId, setDetailContractId] = useState<number | null>(null);
  const [amendTarget, setAmendTarget] = useState<Contract | null>(null);
  // 고르기 전에는 기본 템플릿을 그대로 쓰고, 고르면 draft가 화면을 담당한다.
  const [draftTemplateId, setDraftTemplateId] = useState<string | null>(null);
  /** 발급 대상 직무. 비우면 전체. */
  const [generateRole, setGenerateRole] = useState<JobRole | "">("");

  const { data, isLoading } = useContractListQuery({
    page: 1,
    size: CONTRACT_PAGE_SIZE,
    eventId: String(event.eventId),
  });
  const { data: templateData } = useContractTemplateListQuery();
  const { generateMutation, statusMutation } = useContractMutation();

  const contracts = data?.content ?? [];

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
    명단은 **확정 배치**에서 만든다. 계약서 목록에서 만들면 아직 계약서가 없는 사람이
    영영 나오지 않는다. 그게 이 화면에서 가장 먼저 보여야 할 사람인데도.
  */
  const rosterMap = new Map<number, RosterRow>();

  for (const assignment of event.assignments) {
    if (assignment.status !== "CONFIRMED") continue;

    const existing = rosterMap.get(assignment.staffId);

    if (existing) {
      if (!existing.roles.includes(assignment.role)) {
        existing.roles.push(assignment.role);
      }
      if (!existing.workDates.includes(assignment.workDate)) {
        existing.workDates.push(assignment.workDate);
      }
      continue;
    }

    rosterMap.set(assignment.staffId, {
      staffId: assignment.staffId,
      staffName: assignment.staffName,
      staffPhone: assignment.staffPhone,
      roles: [assignment.role],
      workDates: [assignment.workDate],
      contract: null,
      state: "NONE",
    });
  }

  /*
    한 사람에게 차수가 여럿일 수 있다. (중도 종료로 재작성한 경우)
    지나간 문서(SUPERSEDED)가 대표로 잡히면 "이미 끝난 사람"으로 보이므로
    가장 높은 차수를 그 사람의 현재 상태로 삼는다.
  */
  for (const contract of contracts) {
    const row = rosterMap.get(contract.staffId);

    if (!row) continue;
    if (row.contract && row.contract.revision >= contract.revision) continue;

    row.contract = contract;
    row.state = contract.status;
  }

  const roster = [...rosterMap.values()].map((row) => ({
    ...row,
    roles: [...row.roles].sort(compareRoles),
    workDates: [...row.workDates].sort(),
  }));

  const rows = roster
    .filter((row) => {
      if (state && row.state !== state) return false;
      if (role && !row.roles.includes(role)) return false;

      return true;
    })
    .sort(
      (a, b) =>
        ROSTER_STATE_ORDER.indexOf(a.state) -
          ROSTER_STATE_ORDER.indexOf(b.state) ||
        compareRoles(a.roles[0], b.roles[0]) ||
        a.staffName.localeCompare(b.staffName),
    );

  /** 상태별 인원. 눌러서 그 상태만 걸러 볼 수 있게 한다. */
  const stateCounts = ROSTER_STATE_ORDER.map((value) => ({
    value,
    count: roster.filter((row) => row.state === value).length,
  })).filter((item) => item.count > 0);

  /* 상태를 한꺼번에 바꾸는 건 계약서가 있는 사람만 가능하다. */
  const selectableIds = rows
    .filter((row) => row.contract)
    .map((row) => row.contract!.contractId);
  const { selectedIds, isAllSelected, isSelected, toggle, toggleAll, clear } =
    useSelection(selectableIds);

  const missingCount = roster.filter((row) => row.state === "NONE").length;
  /** 발급 대상 직무에서 아직 계약서가 없는 인원 */
  const generateTargetCount = roster.filter(
    (row) =>
      row.state === "NONE" &&
      (!generateRole || row.roles.includes(generateRole)),
  ).length;

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        eventId: event.eventId,
        templateId: Number(templateId),
        role: generateRole || undefined,
      });
    } catch (error) {
      showErrorToast(error);
    }
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

  const columns: TableColumn<RosterRow>[] = [
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
      render: (row) =>
        row.contract ? (
          <div onClick={(clickEvent) => clickEvent.stopPropagation()}>
            <Checkbox
              aria-label={`${row.staffName} 선택`}
              checked={isSelected(row.contract.contractId)}
              onChange={() => toggle(row.contract!.contractId)}
            />
          </div>
        ) : null,
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
      key: "role",
      header: "직무",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          {row.roles.map((item) => (
            <Badge key={item} tone="neutral">
              {roleLabel(item)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "work",
      header: "근무일",
      render: (row) => (
        <TableCellStack
          primary={<span className="tabular-nums">{row.workDates.length}일</span>}
          secondary={
            <span className="tabular-nums">
              {formatDate(row.workDates[0])}
              {row.workDates.length > 1 &&
                ` ~ ${formatDate(row.workDates[row.workDates.length - 1])}`}
            </span>
          }
        />
      ),
    },
    {
      key: "state",
      header: "계약서",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={ROSTER_STATE_TONE[row.state]}>
            {ROSTER_STATE_LABEL[row.state]}
          </Badge>
          {row.contract && row.contract.revision > 1 && (
            <Badge tone="warning">{row.contract.revision}차</Badge>
          )}
        </div>
      ),
    },
    {
      key: "number",
      header: "계약번호",
      render: (row) => (
        <span
          className={cn(
            "text-[13px] tabular-nums",
            row.contract ? "text-font-1" : "text-font-disabled",
          )}
        >
          {/* 번호는 계약서를 만들 때 붙는다. 없다는 것 자체가 "아직 시작 전"이라는 뜻이다. */}
          {row.contract?.contractNumber ?? "발급 전"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div
          className="flex flex-wrap items-center justify-end gap-1"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          {row.contract ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Eye size={14} />}
                onClick={() => setDetailContractId(row.contract!.contractId)}
              >
                상세
              </Button>

              {/* 중도 종료는 계약서 · 배치 · 정산이 함께 움직여야 한다. */}
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Refresh size={14} />}
                disabled={row.contract.status === "SUPERSEDED"}
                onClick={() => setAmendTarget(row.contract)}
              >
                재작성
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<FileText size={14} />}
              isLoading={generateMutation.isPending}
              onClick={() =>
                generateMutation
                  .mutateAsync({
                    eventId: event.eventId,
                    templateId: Number(templateId),
                    role: row.roles[0],
                  })
                  .catch(showErrorToast)
              }
              title="선택한 템플릿으로 이 사람의 계약서를 만듭니다."
            >
              발급
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {missingCount > 0 && (
        <Alert
          tone="danger"
          title={`계약서를 아직 받지 못한 인원이 ${missingCount}명 있습니다.`}
          action={
            <Button size="sm" variant="secondary" onClick={() => setState("NONE")}>
              미발급만 보기
            </Button>
          }
        >
          근로계약서는 현장 투입 **전에** 끝나야 합니다. 아래 목록에서 직무별로
          템플릿을 골라 발급할 수 있습니다.
        </Alert>
      )}

      <Card noPadding>
        {/* 발급 줄. 직무마다 계약 조건이 달라 템플릿을 나눠 쓰는 일이 흔하다. */}
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="계약서 템플릿"
              options={templateOptions}
              value={templateId}
              onChange={(changeEvent) =>
                setDraftTemplateId(changeEvent.target.value)
              }
              selectBoxClassName="lg:w-52"
            />

            <Select
              aria-label="발급 대상 직무"
              options={jobRoleFilterOptions}
              value={generateRole}
              onChange={(changeEvent) =>
                setGenerateRole(changeEvent.target.value as JobRole | "")
              }
              selectBoxClassName="lg:w-32"
            />

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              isLoading={generateMutation.isPending}
              disabled={generateTargetCount === 0}
              onClick={handleGenerate}
              title={
                generateRole
                  ? `${roleLabel(generateRole)} 중 계약서가 없는 인원에게 발급합니다.`
                  : "계약서가 없는 인원 전체에게 발급합니다."
              }
            >
              {generateRole
                ? `${roleLabel(generateRole)} ${generateTargetCount}명 발급`
                : `미발급 ${generateTargetCount}명 발급`}
            </Button>
          </div>

          <CsvExportButton
            fileName={`${event.title}_근로계약서`}
            rows={contracts}
            columns={CONTRACT_CSV_COLUMNS}
            disabled={contracts.length === 0}
          />
        </div>

        {/*
          상태별 인원. 숫자만 보여 주고 끝내면 "반려 2건"을 보고도
          그 두 사람을 찾으려 목록을 훑어야 한다. 눌러서 바로 걸러지게 한다.
        */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border-main px-4 py-3 lg:px-5">
          <button
            type="button"
            onClick={() => setState("")}
            className={cn(
              "rounded-field border px-2.5 py-1 text-[13px] whitespace-nowrap transition",
              state === ""
                ? "border-brand bg-surface-selected font-medium text-brand"
                : "border-border-main text-font-2 hover:bg-surface-hover",
            )}
          >
            전체 {roster.length}명
          </button>

          {stateCounts.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setState(item.value)}
              className={cn(
                "rounded-field border px-2.5 py-1 text-[13px] whitespace-nowrap transition",
                state === item.value
                  ? "border-brand bg-surface-selected font-medium text-brand"
                  : "border-border-main text-font-2 hover:bg-surface-hover",
              )}
            >
              {ROSTER_STATE_LABEL[item.value]} {item.count}
            </button>
          ))}

          <Select
            aria-label="직무 필터"
            options={jobRoleFilterOptions}
            value={role}
            onChange={(changeEvent) => {
              setRole(changeEvent.target.value as JobRole | "");
              clear();
            }}
            selectBoxClassName="lg:w-32"
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border-main bg-subtle px-4 py-3 lg:px-5">
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

        <Table
          columns={columns}
          rows={rows}
          getRowKey={(row) => String(row.staffId)}
          isLoading={isLoading}
          emptyTitle={
            roster.length === 0
              ? "확정된 배치가 없습니다."
              : "조건에 맞는 인원이 없습니다."
          }
          emptyDescription={
            roster.length === 0
              ? "인력을 배치하고 확정하면 여기에 계약 대상이 나타납니다."
              : "상태나 직무 필터를 바꿔서 다시 찾아보세요."
          }
          onRowClick={(row) =>
            row.contract && setDetailContractId(row.contract.contractId)
          }
        />
      </Card>

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

export default EventContractPanel;
