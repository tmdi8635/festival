"use client";

import { useState } from "react";
import { useContractListQuery } from "@/api/contract/getContractList";
import { getContractDrafts } from "@/api/contract/getContractDraft";
import { useContractTemplateListQuery } from "@/api/contract/getContractTemplateList";
import { useContractMutation } from "@/api/contract/mutateContract";
import { useHasPermission } from "@/store/useAdminStore";
import { CONTRACT_STATUS_TONE } from "@/constants/contractOptions";
import {
  CONTRACT_REVISION_COLUMNS,
  CONTRACT_STATUS_COLUMNS,
  CONTRACT_WAGE_COLUMNS,
  CONTRACT_WHO_COLUMNS,
  CONTRACT_WORK_COLUMNS,
} from "@/constants/csvColumns";
import { useSelection } from "@/hooks/useSelection";
import { Download, FileText, ImageIcon, Upload } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import {
  downloadContractAsImage,
  downloadContractAsPdf,
} from "@/lib/contractFile";
import { formatDate } from "@/lib/dayjs";
import { showAppToast, showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  useJobRoleComparator,
  useJobRoleFilterOptions,
  useJobRoleLabel,
} from "@/store/useOrgStore";
import {
  CONTRACT_ROSTER_STATE_ORDER,
  CONTRACT_STATUS_LABEL,
  buildContractDocument,
  buildContractFileName,
  buildContractRoster,
  contractNameTag,
  findDuplicateStaffNames,
  type Contract,
  type ContractRosterRow,
  type ContractRosterState,
} from "@/type/contract";
import { calculateScheduledWorkHours, type EventDetail } from "@/type/event";
import { formatPhoneNumber, type JobRole } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import ContractBulkUploadModal, {
  type BulkUploadTarget,
} from "@/components/domain/ContractBulkUploadModal";
import ContractDetailModal, {
  type ContractDetailTarget,
} from "@/components/domain/ContractDetailModal";
import ContractUploadZone from "@/components/domain/ContractUploadZone";

const CONTRACT_CSV_COLUMNS: CsvColumn<Contract>[] = [
  ...CONTRACT_WHO_COLUMNS,
  ...CONTRACT_WORK_COLUMNS,
  ...CONTRACT_WAGE_COLUMNS,
  ...CONTRACT_STATUS_COLUMNS,
  ...CONTRACT_REVISION_COLUMNS,
];

/** 행사 하나의 계약서는 인원 수만큼이라 한 번에 받아 온다. */
const CONTRACT_PAGE_SIZE = 200;

const ROSTER_STATE_LABEL: Record<ContractRosterState, string> = {
  NONE: "발급 전",
  ...CONTRACT_STATUS_LABEL,
};

/** 발급 전은 '아직 시작도 안 한 것'이라 계약 상태들과 다른 색으로 둔다. */
const ROSTER_STATE_TONE = {
  NONE: "danger",
  ...CONTRACT_STATUS_TONE,
} as const;

interface EventContractPanelProps {
  event: EventDetail;
}

/**
 * 근로계약서 탭.
 *
 * **이 탭의 주인공은 계약서가 아니라 사람이다.**
 * 확정 배치된 전원을 세우고, 각자가 절차의 어디에 있는지를 한 줄로 붙인다.
 * 이미 만들어진 계약서만 늘어놓으면, 정작 제일 급한
 * "아직 계약서를 못 받은 사람이 누구인가"가 목록에 아예 나오지 않는다.
 *
 * ## 지금은 발송이 아니라 등록이다
 *
 * 메인 서버가 붙기 전까지 계약서는 사람 손으로 오간다. 그래서 이 화면의 절차는
 * **명단에서 사람을 누른다 → 문서를 내려받는다 → 종이로 배부하고 서명받는다 →
 * 서명본을 올린다**이고, 마지막 단계에서 계약번호가 붙고 서명완료가 된다.
 *
 * 문서를 '만드는' 단추는 두지 않는다. 종이가 손에 있기 전에 만들어 두는 기록은
 * 화면에서만 계약서가 있는 것처럼 보이게 하고, 그 상태로 사람이 현장에 들어간다.
 *
 * 명단 줄에 파일을 곧바로 끌어다 놓을 수도 있다. 스캔 폴더를 열어 두고 이름을
 * 보며 한 줄씩 떨어뜨리는 것이, 서른 명을 한 명씩 열어 올리는 것보다 훨씬 빠르다.
 *
 * ## 서른 명은 한 명씩 하지 않는다
 *
 * 골라서 **한 번에 내려받고**, 서명받은 뒤 **한 번에 올린다.**
 * 낱장으로도 되지만 그건 한두 명이 남았을 때 쓰는 길이고, 행사 하나를 여는 날의
 * 실제 작업은 스물아홉 장을 인쇄해 나눠 주고 스물아홉 장을 스캔해 넣는 것이다.
 */
const EventContractPanel = ({ event }: EventContractPanelProps) => {
  const roleLabel = useJobRoleLabel();
  const compareRoles = useJobRoleComparator();
  const jobRoleFilterOptions = useJobRoleFilterOptions();

  const [state, setState] = useState<ContractRosterState | "">("");
  const [role, setRole] = useState<JobRole | "">("");
  const [detailTarget, setDetailTarget] =
    useState<ContractDetailTarget | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  // 고르기 전에는 기본 템플릿을 그대로 쓰고, 고르면 draft가 화면을 담당한다.
  const [draftTemplateId, setDraftTemplateId] = useState<string | null>(null);

  const { data, isLoading } = useContractListQuery({
    page: 1,
    size: CONTRACT_PAGE_SIZE,
    eventId: String(event.eventId),
  });
  const { data: templateData } = useContractTemplateListQuery();
  const canWrite = useHasPermission("contract:write");

  const { registerMutation } = useContractMutation();

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

    계약서 관리 화면과 **같은 함수**를 쓴다. 두 곳에서 따로 세면
    "행사에서는 6명인데 전체에서는 4명"이 되고, 어느 쪽이 맞는지 알 수 없다.
  */
  const roster = buildContractRoster(
    event,
    event.assignments,
    contracts,
    calculateScheduledWorkHours(event),
  ).map((row) => ({ ...row, roles: [...row.roles].sort(compareRoles) }));

  const rows = roster
    .filter((row) => {
      if (state && row.state !== state) return false;
      if (role && !row.roles.includes(role)) return false;

      return true;
    })
    .sort(
      (a, b) =>
        CONTRACT_ROSTER_STATE_ORDER.indexOf(a.state) -
          CONTRACT_ROSTER_STATE_ORDER.indexOf(b.state) ||
        compareRoles(a.roles[0], b.roles[0]) ||
        a.staffName.localeCompare(b.staffName),
    );

  /** 상태별 인원. 눌러서 그 상태만 걸러 볼 수 있게 한다. */
  const stateCounts = CONTRACT_ROSTER_STATE_ORDER.map((value) => ({
    value,
    count: roster.filter((row) => row.state === value).length,
  })).filter((item) => item.count > 0);

  /** 아직 서명본을 못 받은 인원. 재작성해 놓고 못 받은 사람까지 함께 센다. */
  const missingCount = roster.filter(
    (row) => row.state === "NONE" || row.state === "DRAFT",
  ).length;

  const openDetail = (row: ContractRosterRow) =>
    setDetailTarget({
      eventId: event.eventId,
      staffId: row.staffId,
      templateId: Number(templateId) || undefined,
    });

  /** 명단 줄에 곧바로 떨어뜨린 서명본을 등록한다. */
  const registerFromRow = (
    row: ContractRosterRow,
    file: { fileUrl: string; fileName: string; mimeType: string },
  ) =>
    registerMutation.mutate(
      row.contract
        ? { contractId: row.contract.contractId, ...file }
        : {
            eventId: event.eventId,
            staffId: row.staffId,
            templateId: Number(templateId) || undefined,
            ...file,
          },
    );

  /* ------------------------------ 일괄 처리 ------------------------------ */

  const { selectedIds, isAllSelected, isSelected, toggle, toggleAll, clear } =
    useSelection(rows.map((row) => row.staffId));

  /*
    동명이인은 파일명에 휴대폰 뒤 네 자리를 붙인다.
    한 행사에 '김민준'이 둘이면 파일명이 똑같아져, 폴더에 내려받는 순간
    하나가 `(1)`로 밀리고 어느 쪽이 누구 것인지 아는 방법이 사라진다.
  */
  const duplicateNames = findDuplicateStaffNames(roster);

  const draftFileName = (contract: Contract, extension: string) =>
    buildContractFileName(
      contract.workDate,
      contract.eventTitle,
      contract.staffName,
      extension,
      duplicateNames.has(contract.staffName)
        ? contractNameTag(contract.staffPhone)
        : undefined,
    );

  /** 고른 사람들의 문서를 한 번에 조립해 받는다. */
  const fetchSelectedDrafts = async () => {
    setIsPreparing(true);

    try {
      const { items } = await getContractDrafts(
        event.eventId,
        selectedIds,
        Number(templateId) || undefined,
      );

      if (items.length === 0) {
        showAppToast("info", "내려받을 문서가 없습니다.");
        return null;
      }

      return items;
    } catch (error) {
      showErrorToast(error, "계약서를 준비하지 못했습니다.");
      return null;
    } finally {
      setIsPreparing(false);
    }
  };

  /**
   * 고른 사람들의 계약서를 내려받는다. **사람마다 파일 하나다.**
   *
   * 예전에는 인쇄 대화상자로 한 파일에 묶어 냈다. 인쇄는 한 번에 파일을
   * 하나만 만들 수 있어서 그럴 수밖에 없었는데, 계약서는 각자에게 나눠 주는
   * 문서라 결국 담당자가 PDF를 열어 사람 수만큼 쪼개고 있었다.
   *
   * 지금은 지면을 이미지로 구워 PDF를 직접 만든다. 인쇄 창을 거치지 않으니
   * 파일명 규칙(`261231_행사명_이름.pdf`)이 그대로 지켜지고, 서른 명을
   * 골라도 서른 개 파일이 각자 이름을 달고 떨어진다.
   */
  const handleBulkDownload = async (extension: "pdf" | "png") => {
    const items = await fetchSelectedDrafts();

    if (!items) return;

    let failed = 0;

    for (const item of items) {
      const contractDocument = buildContractDocument(
        item.contract,
        item.template,
        roleLabel(item.contract.role),
      );

      try {
        if (extension === "pdf") {
          await downloadContractAsPdf(
            contractDocument,
            draftFileName(item.contract, "pdf"),
          );
        } else {
          await downloadContractAsImage(
            contractDocument,
            draftFileName(item.contract, "png"),
          );
        }
      } catch {
        failed += 1;
      }
    }

    /*
      실패 수를 성공 수와 같은 크기로 알린다.
      "완료"만 뜨면 두 장이 조용히 빠져도 담당자는 다 된 줄 안다.
    */
    showAppToast(
      failed > 0 ? "warning" : "success",
      failed > 0
        ? `${items.length - failed}건을 내려받고 ${failed}건이 실패했습니다.`
        : `${items.length}건을 각각 내려받았습니다.`,
      {
        description:
          failed > 0
            ? "실패한 인원은 명단에서 한 명씩 열어 내려받아 주세요."
            : "파일명은 261231_행사명_이름 형식입니다. 그대로 두면 서명본을 일괄 등록할 수 있습니다.",
      },
    );
  };

  /** 일괄 등록에 넘길 명단. 누가 이미 등록됐는지까지 함께 알려 준다. */
  const bulkUploadTargets: BulkUploadTarget[] = roster.map((row) => ({
    staffId: row.staffId,
    staffName: row.staffName,
    staffPhone: row.staffPhone,
    contractId: row.contract?.contractId,
    isRegistered: Boolean(row.contract?.signedFile),
    status: row.contract?.status,
  }));

  const columns: TableColumn<ContractRosterRow>[] = [
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
      render: (row) => (
        <div onClick={(clickEvent) => clickEvent.stopPropagation()}>
          <Checkbox
            aria-label={`${row.staffName} 선택`}
            checked={isSelected(row.staffId)}
            onChange={() => toggle(row.staffId)}
          />
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
        <TableCellStack
          primary={
            <span
              className={cn(
                "text-[13px] tabular-nums",
                row.contract ? "text-font-1" : "text-font-disabled",
              )}
            >
              {/* 번호는 서명본을 등록할 때 붙는다. 없다는 것 자체가 "아직 시작 전"이라는 뜻이다. */}
              {row.contract?.contractNumber ?? "발급 전"}
            </span>
          }
          secondary={
            row.contract?.signedFile ? (
              <span className="truncate">{row.contract.signedFile.fileName}</span>
            ) : undefined
          }
        />
      ),
    },
    {
      /*
        줄을 누르면 상세가 열린다. 그래서 '상세' 단추를 따로 두지 않는다.
        누르면 열리는 줄 옆에 "누르면 열립니다" 단추를 두는 셈이라,
        칸만 차지하고 정작 여기서 해야 할 일(서명본 올리기)을 밀어낸다.
      */
      key: "actions",
      header: "",
      align: "right",
      render: (row) =>
        canWrite && !row.contract?.signedFile ? (
          <div
            className="flex items-center justify-end"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            <ContractUploadZone
              onUploaded={(file) => registerFromRow(row, file)}
              disabled={registerMutation.isPending}
              className="flex-row gap-1.5 border-solid px-2.5 py-1.5 text-[13px]"
            >
              <span className="flex items-center gap-1.5 text-font-2">
                <Upload size={14} />
                서명본 등록
              </span>
            </ContractUploadZone>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      {missingCount > 0 && (
        <Alert
          tone="danger"
          title={`서명본을 아직 받지 못한 인원이 ${missingCount}명 있습니다.`}
          action={
            <Button size="sm" variant="secondary" onClick={() => setState("NONE")}>
              발급 전만 보기
            </Button>
          }
        >
          근로계약서는 현장 투입 <b>전에</b> 끝나야 합니다. 이름을 눌러 문서를
          내려받아 배부하고, 서명받은 종이를 다시 올려 주세요.
        </Alert>
      )}

      <Card noPadding>
        {/* 템플릿 줄. 직무마다 계약 조건이 달라 템플릿을 나눠 쓰는 일이 흔하다. */}
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

            <p className="flex items-center gap-1.5 text-[12px] text-font-2">
              <FileText size={14} />
              내려받는 문서가 이 템플릿으로 만들어집니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Upload size={15} />}
                onClick={() => setIsBulkUploadOpen(true)}
                title="스캔한 폴더를 통째로 올리면 파일명으로 각자에게 나눠 등록합니다."
              >
                서명본 일괄 등록
              </Button>
            )}

            <CsvExportButton
              fileName={`${event.title}_근로계약서`}
              rows={contracts}
              columns={CONTRACT_CSV_COLUMNS}
              disabled={contracts.length === 0}
            />
          </div>
        </div>

        {/*
          상태별 인원. 숫자만 보여 주고 끝내면 "등록 대기 2건"을 보고도
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
            onChange={(changeEvent) =>
              setRole(changeEvent.target.value as JobRole | "")
            }
            selectBoxClassName="lg:w-32"
          />
        </div>

        {/*
          고른 사람들에게 한 번에 하는 일.

          인쇄는 **한 파일**로 묶어 사람마다 장을 넘긴다. 그대로 잘라 나눠 주면 된다.
          이미지는 반대로 **사람마다 한 장**이다. 개인에게 따로 보낼 때 쓴다.
        */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border-main bg-subtle px-4 py-3 lg:px-5">
            <span className="text-[13px] text-font-2 tabular-nums">
              {selectedIds.length}명 선택
            </span>

            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Download size={14} />}
              isLoading={isPreparing}
              onClick={() => handleBulkDownload("pdf")}
              title="선택한 인원의 계약서를 한 명당 한 파일씩 PDF로 내려받습니다."
            >
              PDF로 각각 내려받기
            </Button>

            <Button
              size="sm"
              variant="secondary"
              leftIcon={<ImageIcon size={14} />}
              isLoading={isPreparing}
              onClick={() => handleBulkDownload("png")}
              title="카톡으로 개인에게 보낼 때 씁니다. 한 명당 이미지 한 장입니다."
            >
              이미지로 각각
            </Button>

            <Button size="sm" variant="ghost" onClick={clear}>
              선택 해제
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
          onRowClick={openDetail}
        />
      </Card>

      <ContractDetailModal
        target={detailTarget}
        onClose={() => setDetailTarget(null)}
      />

      <ContractBulkUploadModal
        isOpen={isBulkUploadOpen}
        eventId={event.eventId}
        targets={bulkUploadTargets}
        templateId={Number(templateId) || undefined}
        onClose={() => setIsBulkUploadOpen(false)}
      />

    </>
  );
};

export default EventContractPanel;
