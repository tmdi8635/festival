"use client";

import { useState } from "react";
import { useSelection } from "@/hooks/useSelection";
import { usePayrollListQuery } from "@/api/payroll/getPayrollList";
import { usePayrollSummaryQuery } from "@/api/payroll/getPayrollSummary";
import { usePayrollMutation } from "@/api/payroll/mutatePayroll";
import {
  PAYROLL_STATUS_FILTER_OPTIONS,
  PAYROLL_STATUS_TONE,
} from "@/constants/payrollOptions";
import { Check, Download } from "@/icons";
import { downloadCsv, type CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { showAppToast } from "@/lib/toast";
import { formatCurrency } from "@/lib/utils";
import { canViewPayrollDetail, useAdminStore } from "@/store/useAdminStore";
import { openConfirm } from "@/store/useConfirmStore";
import { jobRoleLabel, useJobRoleLabel } from "@/store/useOrgStore";
import { WAGE_TYPE_LABEL, type EventDetail } from "@/type/event";
import {
  PAYROLL_STATUS_LABEL,
  formatPayrollDates,
  type PayrollItem,
  type PayrollStatus,
} from "@/type/payroll";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import PayrollAdjustModal from "@/components/domain/PayrollAdjustModal";
import PayrollBasisCell from "@/components/domain/PayrollBasisCell";

/**
 * 은행 이체용 컬럼.
 *
 * 대부분의 은행 대량이체 양식이 [은행 / 계좌번호 / 예금주 / 금액 / 적요] 순서라
 * 그대로 붙여넣을 수 있게 이 순서를 지킨다.
 */
const TRANSFER_CSV_COLUMNS: CsvColumn<PayrollItem>[] = [
  { header: "은행", value: (row) => row.bankName },
  { header: "계좌번호", value: (row) => row.accountNumber },
  { header: "예금주", value: (row) => row.accountHolder },
  { header: "이체금액", value: (row) => row.netPay },
  {
    header: "적요",
    value: (row) =>
      `${row.eventTitle.slice(0, 10)} ${formatPayrollDates(row.workDates)}`,
  },
];

/** 회계 확인용 상세 컬럼 */
const PAYROLL_CSV_COLUMNS: CsvColumn<PayrollItem>[] = [
  { header: "근무기간", value: (row) => formatPayrollDates(row.workDates) },
  { header: "근무일수", value: (row) => row.workDates.length },
  { header: "이름", value: (row) => row.staffName },
  { header: "직무", value: (row) => jobRoleLabel(row.role) },
  { header: "정산 근무시간(합계)", value: (row) => row.totalWorkHours },
  { header: "예정 근무시간(합계)", value: (row) => row.scheduledWorkHours },
  {
    header: "시간 기준",
    value: (row) =>
      row.isActualTimeApplied
        ? "실제 출퇴근"
        : `예정 ${row.provisionalDayCount}일 포함(잠정)`,
  },
  { header: "지급 기준", value: (row) => WAGE_TYPE_LABEL[row.wageType] },
  { header: "적용 금액", value: (row) => row.wage },
  { header: "기본급", value: (row) => row.basePay },
  { header: "연장수당", value: (row) => row.overtimePay },
  { header: "야간수당", value: (row) => row.nightPay },
  { header: "기타수당", value: (row) => row.allowance },
  { header: "차감액", value: (row) => row.deduction },
  { header: "세전 총액", value: (row) => row.grossPay },
  { header: "원천징수", value: (row) => row.withholdingTax },
  { header: "실지급액", value: (row) => row.netPay },
  { header: "상태", value: (row) => PAYROLL_STATUS_LABEL[row.status] },
];

/** 행사 하나의 정산 건은 인원 수만큼이라 한 번에 받아 온다. */
const PAYROLL_PAGE_SIZE = 300;

interface EventPayrollPanelProps {
  event: EventDetail;
}

/**
 * 정산 탭.
 *
 * 정산은 사실상 행사 단위로 끝난다. ("이번 행사 얼마 나갔지"가 질문의 형태다)
 * 그래서 합계 · 수당 조정 · 이체 파일을 행사 안에서 모두 처리하게 두고,
 * 정산 메뉴는 여러 행사를 가로질러 볼 때만 쓴다.
 */
const EventPayrollPanel = ({ event }: EventPayrollPanelProps) => {
  const roleLabel = useJobRoleLabel();
  const admin = useAdminStore((state) => state.admin);
  const canViewAccount = canViewPayrollDetail(admin?.role);

  const [status, setStatus] = useState<PayrollStatus | "">("");
  const [workDate, setWorkDate] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<PayrollItem | null>(null);

  /** 목록과 합계가 어긋나지 않도록 같은 조건을 넘긴다. */
  const filterParams = {
    eventId: String(event.eventId),
    status: status || undefined,
    startDate: workDate || undefined,
    endDate: workDate || undefined,
  };

  const { data, isLoading } = usePayrollListQuery({
    page: 1,
    size: PAYROLL_PAGE_SIZE,
    ...filterParams,
  });
  const { data: summary } = usePayrollSummaryQuery(filterParams);
  const { statusMutation, allowanceMutation } = usePayrollMutation();

  const rows = data?.content ?? [];
  const { selectedIds, isAllSelected, isSelected, toggle, toggleAll, clear } =
    useSelection(rows.map((row) => row.payrollId));
  const selectedRows = rows.filter((row) => isSelected(row.payrollId));
  const selectedAmount = selectedRows.reduce((sum, row) => sum + row.netPay, 0);

  /*
    정산 건이 행사 전체를 덮게 되면서 이 필터의 뜻이 달라졌다.
    "그날치 금액만 보기"가 아니라 "그날 나온 사람만 추리기"다.
    금액은 여전히 행사 전체 합계이므로 라벨에서 분명히 해 둔다.
  */
  const dateOptions = [
    { label: "전체 인원", value: "" },
    ...event.dates.map((date) => ({
      label: `${formatDate(date)} 근무자`,
      value: date,
    })),
  ];

  const handleBulkStatus = (nextStatus: PayrollStatus) => {
    /*
      실제 출퇴근이 없는 건은 행사 예정 시간으로 잠정 계산된 금액이다.
      이대로 승인하면 나중에 금액을 되돌려야 한다. 반드시 짚어 준다.
    */
    const provisionalCount = selectedRows.filter(
      (row) => !row.isActualTimeApplied,
    ).length;

    const provisionalWarning =
      provisionalCount > 0
        ? `${provisionalCount}건은 출퇴근이 기록되지 않아 행사 예정 시간으로 잠정 계산된 금액입니다. 출퇴근 명부 탭에서 실제 출퇴근을 먼저 채우면 금액이 자동으로 다시 계산됩니다.`
        : undefined;

    openConfirm({
      title:
        nextStatus === "PAID"
          ? `선택한 ${selectedIds.length}건을 지급 완료로 처리할까요?`
          : `선택한 ${selectedIds.length}건을 지급 승인할까요?`,
      description:
        nextStatus === "PAID"
          ? `총 ${formatCurrency(selectedAmount)}이 이미 이체되었다는 뜻입니다. 이체를 먼저 끝낸 뒤 눌러 주세요.`
          : "승인 후 이체 파일을 내려받아 은행에서 일괄 이체하세요.",
      warning:
        nextStatus === "PAID"
          ? [
              provisionalWarning,
              "지급 완료는 되돌리기 어렵습니다. 이체 내역을 먼저 확인해 주세요.",
            ]
              .filter(Boolean)
              .join(" ")
          : provisionalWarning,
      confirmText: nextStatus === "PAID" ? "지급 완료" : "지급 승인",
      tone: nextStatus === "PAID" ? "danger" : "default",
      onConfirm: () =>
        statusMutation
          .mutateAsync({ payrollIds: selectedIds, status: nextStatus })
          .then(() => clear()),
    });
  };

  /**
   * 수당 일괄 적용 · 해제.
   *
   * "이번 행사는 연장수당 빼기로 했다"는 대개 행사 단위로 정해진다.
   * 행사 안에서 전체 선택 → 해제까지 두 번이면 끝나야 한다.
   */
  const handleBulkAllowance = (
    key: "isOvertimeApplied" | "isNightPayApplied",
    isApplied: boolean,
  ) => {
    const label = key === "isOvertimeApplied" ? "연장수당" : "야간수당";

    openConfirm({
      title: `선택한 ${selectedIds.length}건의 ${label}을 ${isApplied ? "적용" : "해제"}할까요?`,
      description:
        "지급액이 즉시 다시 계산됩니다. 이미 지급 완료된 건은 금액만 바뀌고 이체 내역은 바뀌지 않으니 주의해 주세요.",
      confirmText: isApplied ? "적용" : "해제",
      onConfirm: () =>
        allowanceMutation
          .mutateAsync({ payrollIds: selectedIds, [key]: isApplied })
          .then(() => clear()),
    });
  };

  /** 계좌가 없는 건이 섞이면 이체가 통째로 실패하므로 먼저 걸러 준다. */
  const handleDownloadTransfer = () => {
    const targets = selectedRows.length > 0 ? selectedRows : rows;
    const payable = targets.filter((row) => row.accountNumber);

    if (payable.length === 0) {
      showAppToast("warning", "이체할 수 있는 건이 없습니다.", {
        description: "계좌 정보가 등록된 정산 건을 선택해 주세요.",
      });

      return;
    }

    downloadCsv(`${event.title}_은행이체`, payable, TRANSFER_CSV_COLUMNS);
    showAppToast("success", `${payable.length}건의 이체 파일을 저장했습니다.`, {
      description:
        targets.length > payable.length
          ? `계좌 미등록 ${targets.length - payable.length}건은 제외했습니다.`
          : undefined,
    });
  };

  const columns: TableColumn<PayrollItem>[] = [
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
      render: (item) => (
        <div onClick={(clickEvent) => clickEvent.stopPropagation()}>
          <Checkbox
            aria-label={`${item.staffName} 선택`}
            checked={isSelected(item.payrollId)}
            onChange={() => toggle(item.payrollId)}
          />
        </div>
      ),
    },
    {
      /*
        한 사람에게 나가는 돈은 한 줄이다.
        사흘 나온 사람을 세 줄로 나열하면 담당자가 세 번 이체하거나
        세 줄을 손으로 더해 한 번 이체한다. 둘 다 틀린다.
      */
      key: "staff",
      header: "인력 / 근무기간",
      render: (item) => (
        <TableCellStack
          primary={`${item.staffName} · ${roleLabel(item.role)}`}
          secondary={
            <span className="tabular-nums">
              {formatPayrollDates(item.workDates)} · {item.workDates.length}일
            </span>
          }
        />
      ),
    },
    {
      key: "work",
      header: "지급 근거",
      align: "right",
      numeric: true,
      render: (item) => <PayrollBasisCell item={item} />,
    },
    {
      key: "extra",
      header: "수당 / 차감",
      align: "right",
      numeric: true,
      render: (item) => (
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[13px] text-success">
            +{formatCurrency(item.overtimePay + item.nightPay + item.allowance)}
          </span>

          {/*
            붙은 수당만 적는다.

            예전에는 '연장 해제' · '야간 해제'를 회색 배지로 함께 띄웠는데,
            대부분의 건이 해제 상태라 표가 온통 회색 배지로 덮였다.
            없는 것을 굳이 적을 필요가 없다. 배지가 보이면 붙은 것이다.

            일급만 예외다. 붙일 수 없는 것과 뗀 것은 다른 이야기이므로
            "왜 연장수당이 없는지"를 한 줄로 밝혀 준다.
          */}
          {item.wageType === "DAILY" ? (
            <Badge tone="neutral" title="일급은 합의된 금액에 이미 포함된 것으로 봅니다.">
              연장 · 야간 해당 없음
            </Badge>
          ) : (
            (item.isOvertimeApplied || item.isNightPayApplied) && (
              <div className="flex items-center gap-1">
                {item.isOvertimeApplied && <Badge tone="info">연장 적용</Badge>}
                {item.isNightPayApplied && <Badge tone="info">야간 적용</Badge>}
              </div>
            )
          )}

          {item.deduction > 0 && (
            <span className="text-[12px] text-danger">
              -{formatCurrency(item.deduction)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "grossPay",
      header: "세전 총액",
      align: "right",
      numeric: true,
      render: (item) => formatCurrency(item.grossPay),
    },
    {
      key: "withholdingTax",
      header: "원천징수",
      align: "right",
      numeric: true,
      render: (item) => (
        <span className="text-[13px] text-font-2">
          -{formatCurrency(item.withholdingTax)}
        </span>
      ),
    },
    {
      key: "netPay",
      header: "실지급액",
      align: "right",
      numeric: true,
      render: (item) => (
        <span className="font-semibold text-font-0">
          {formatCurrency(item.netPay)}
        </span>
      ),
    },
    {
      key: "account",
      header: "입금 계좌",
      render: (item) =>
        !canViewAccount ? (
          <span className="text-[13px] text-font-disabled">***</span>
        ) : item.accountNumber ? (
          <TableCellStack
            primary={
              <span className="text-[13px]">
                {item.bankName} {item.accountNumber}
              </span>
            }
            secondary={item.accountHolder}
          />
        ) : (
          <Badge tone="danger">계좌 미등록</Badge>
        ),
    },
    {
      key: "status",
      header: "상태",
      render: (item) => (
        <Badge tone={PAYROLL_STATUS_TONE[item.status]}>
          {PAYROLL_STATUS_LABEL[item.status]}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      align: "right",
      render: (item) => (
        <div
          className="flex justify-end"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <Button
            size="sm"
            variant="ghost"
            disabled={item.status === "PAID"}
            onClick={() => setAdjustTarget(item)}
          >
            조정
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {!canViewAccount && (
        <Alert tone="info" title="계좌 정보는 대표 권한에서만 보입니다.">
          매니저 권한으로도 지급액 확인과 승인은 가능하지만, 계좌번호와 이체
          파일은 열람할 수 없습니다.
        </Alert>
      )}

      <Card noPadding>
        {/* 행사 하나의 정산 합계. 정산 메뉴로 나가 같은 행사를 다시 찾을 이유가 없다. */}
        <div className="grid grid-cols-2 gap-3 border-b border-border-main p-4 lg:grid-cols-4">
          <div className="rounded-field border border-border-main bg-subtle px-4 py-3">
            <p className="text-[12px] text-font-2">정산 건수</p>
            <p className="mt-1 text-[18px] font-bold text-font-0 tabular-nums">
              {summary?.totalCount ?? 0}건
            </p>
            <p className="text-[12px] text-font-2">
              대기 {summary?.pendingCount ?? 0} · 완료 {summary?.paidCount ?? 0}
            </p>
          </div>

          <div className="rounded-field border border-border-main bg-subtle px-4 py-3">
            <p className="text-[12px] text-font-2">세전 총액</p>
            <p className="mt-1 text-[18px] font-bold text-font-0 tabular-nums">
              {formatCurrency(summary?.totalGrossPay ?? 0)}
            </p>
            {/* 출퇴근이 덜 채워졌으면 이 금액은 아직 확정이 아니다. */}
            <p
              className={`text-[12px] ${
                (summary?.provisionalCount ?? 0) > 0
                  ? "text-warning"
                  : "text-font-2"
              }`}
            >
              {(summary?.provisionalCount ?? 0) > 0
                ? `${summary?.provisionalCount}건은 예정 시간 기준 잠정`
                : "실제 출퇴근 기준 확정"}
            </p>
          </div>

          <div className="rounded-field border border-border-main bg-subtle px-4 py-3">
            <p className="text-[12px] text-font-2">원천징수 합계</p>
            <p className="mt-1 text-[18px] font-bold text-font-0 tabular-nums">
              {formatCurrency(summary?.totalWithholdingTax ?? 0)}
            </p>
            <p className="text-[12px] text-font-2">사업소득 3.3%</p>
          </div>

          <div className="rounded-field border border-border-main bg-subtle px-4 py-3">
            <p className="text-[12px] text-font-2">미지급 금액</p>
            <p
              className={`mt-1 text-[18px] font-bold tabular-nums ${
                (summary?.unpaidAmount ?? 0) > 0 ? "text-warning" : "text-success"
              }`}
            >
              {formatCurrency(summary?.unpaidAmount ?? 0)}
            </p>
            <p className="text-[12px] text-font-2">
              실지급 합계 {formatCurrency(summary?.totalNetPay ?? 0)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2.5 border-b border-border-main px-4 py-3 lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <Select
            aria-label="근무일 필터"
            options={dateOptions}
            value={workDate}
            onChange={(changeEvent) => {
              setWorkDate(changeEvent.target.value);
              clear();
            }}
            selectBoxClassName="w-40"
          />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Download size={15} />}
              onClick={() =>
                downloadCsv(
                  `${event.title}_정산상세`,
                  rows,
                  PAYROLL_CSV_COLUMNS,
                )
              }
              disabled={rows.length === 0}
            >
              상세 CSV
            </Button>

            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Download size={15} />}
              onClick={handleDownloadTransfer}
              disabled={rows.length === 0 || !canViewAccount}
              title="은행 대량이체 양식으로 저장합니다."
            >
              은행 이체 파일
            </Button>

            <Select
              aria-label="상태 필터"
              options={PAYROLL_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={(changeEvent) => {
                setStatus(changeEvent.target.value as PayrollStatus | "");
                clear();
              }}
              selectBoxClassName="w-32"
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-main bg-subtle px-5 py-3">
            <span className="text-[13px] text-font-2 tabular-nums">
              {selectedIds.length}건 · {formatCurrency(selectedAmount)}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {/* 수당은 강제하지 않는다. 고른 건에 대해 붙이거나 뗀다. */}
              <div className="flex items-center gap-1 rounded-field border border-border-main px-1.5 py-1">
                <span className="px-1 text-[12px] text-font-2">연장</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleBulkAllowance("isOvertimeApplied", true)}
                >
                  적용
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleBulkAllowance("isOvertimeApplied", false)}
                >
                  해제
                </Button>
              </div>

              <div className="flex items-center gap-1 rounded-field border border-border-main px-1.5 py-1">
                <span className="px-1 text-[12px] text-font-2">야간</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleBulkAllowance("isNightPayApplied", true)}
                >
                  적용
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleBulkAllowance("isNightPayApplied", false)}
                >
                  해제
                </Button>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleBulkStatus("APPROVED")}
              >
                지급 승인
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Check size={14} />}
                onClick={() => handleBulkStatus("PAID")}
              >
                지급 완료
              </Button>
            </div>
          </div>
        )}

        <Table
          columns={columns}
          rows={rows}
          getRowKey={(item) => String(item.payrollId)}
          isLoading={isLoading}
          emptyTitle="아직 정산할 건이 없습니다."
          emptyDescription="행사가 끝나면 배치별로 정산 항목이 자동으로 만들어집니다."
        />
      </Card>

      <PayrollAdjustModal
        payroll={adjustTarget}
        onClose={() => setAdjustTarget(null)}
      />
    </>
  );
};

export default EventPayrollPanel;
