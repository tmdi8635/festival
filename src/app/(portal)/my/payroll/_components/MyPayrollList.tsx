"use client";

import { useState } from "react";
import { useMyPayrollListQuery } from "@/api/my/getMySchedule";
import { PAYROLL_STATUS_TONE } from "@/constants/payrollOptions";
import { ChevronDown } from "@/icons";
import { formatCurrency, cn } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { formatWorkDates } from "@/type/contract";
import { PAYROLL_STATUS_LABEL } from "@/type/payroll";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";

/** 금액 한 줄. 0원인 항목은 아예 세우지 않는다 — 없는 것이 정상인 값들이다. */
const AmountRow = ({
  label,
  amount,
  isNegative = false,
}: {
  label: string;
  amount: number;
  isNegative?: boolean;
}) => {
  if (amount === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-font-2">{label}</span>
      <span
        className={cn("tabular-nums", isNegative ? "text-danger" : "text-font-1")}
      >
        {isNegative ? "-" : ""}
        {formatCurrency(amount)}
      </span>
    </div>
  );
};

/**
 * 내 정산.
 *
 * **왜 이 금액인지를 펼쳐 볼 수 있어야 한다.** 실지급액 하나만 보여 주면
 * "얼마 받기로 했는데 왜 이만큼이지"에 담당자가 매번 답해야 하고,
 * 그 통화가 정산 기간 내내 이어진다.
 */
const MyPayrollList = () => {
  const jobRoleLabel = useJobRoleLabel();
  const { data, isLoading } = useMyPayrollListQuery();
  const [openId, setOpenId] = useState<number | null>(null);

  const items = data?.items ?? [];
  const holdItems = items.filter((item) => item.status === "HOLD");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-card" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          title="정산 내역이 없습니다."
          description="근무가 끝나고 계약서 · 출퇴근 기록이 모두 확인되면 정산이 시작됩니다."
        />
      </Card>
    );
  }

  return (
    <>
      {holdItems.length > 0 && (
        <Alert tone="warning" title="보류된 정산이 있습니다.">
          {holdItems[0].holdReason ??
            "계좌 확인이 필요합니다. 내 정보에서 통장 사본과 계좌를 확인해 주세요."}
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const isOpen = openId === item.payrollId;

          return (
            <Card key={item.payrollId} noPadding>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : item.payrollId)}
                className="flex w-full items-center gap-3 p-5 text-left transition hover:bg-surface-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-font-0">
                    {item.eventTitle}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-font-2">
                    {formatWorkDates(item.workDates)} · {jobRoleLabel(item.role)}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-semibold text-font-0 tabular-nums">
                    {formatCurrency(item.netPay)}
                  </span>
                  <Badge tone={PAYROLL_STATUS_TONE[item.status]}>
                    {PAYROLL_STATUS_LABEL[item.status]}
                  </Badge>
                </span>

                <ChevronDown
                  size={16}
                  className={cn("shrink-0 transition", isOpen && "rotate-180")}
                />
              </button>

              {isOpen && (
                <div className="flex flex-col gap-1.5 border-t border-border-main px-5 py-4">
                  <AmountRow label="기본급" amount={item.basePay} />
                  <AmountRow label="연장수당" amount={item.overtimePay} />
                  <AmountRow label="야간수당" amount={item.nightPay} />
                  <AmountRow label="추가수당" amount={item.allowance} />
                  <AmountRow label="공제" amount={item.deduction} isNegative />

                  <div className="mt-1 flex items-center justify-between gap-3 border-t border-border-main pt-2 text-[13px]">
                    <span className="text-font-2">세전 합계</span>
                    <span className="text-font-1 tabular-nums">
                      {formatCurrency(item.grossPay)}
                    </span>
                  </div>

                  <AmountRow
                    label="원천징수 (사업소득 3.3%)"
                    amount={item.withholdingTax}
                    isNegative
                  />

                  <div className="mt-1 flex items-center justify-between gap-3 border-t border-border-main pt-2">
                    <span className="text-[14px] font-medium text-font-1">
                      실지급액
                    </span>
                    <span className="text-[17px] font-bold text-font-0 tabular-nums">
                      {formatCurrency(item.netPay)}
                    </span>
                  </div>

                  <p className="mt-1 text-[12px] text-font-2">
                    총 {item.totalWorkHours.toFixed(1)}시간
                    {item.bankName && item.accountTail && (
                      <>
                        {" · "}
                        {item.bankName} ****{item.accountTail}
                      </>
                    )}
                  </p>

                  {item.holdReason && (
                    <p className="mt-1 text-[12px] text-warning">
                      {item.holdReason}
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
};

export default MyPayrollList;
