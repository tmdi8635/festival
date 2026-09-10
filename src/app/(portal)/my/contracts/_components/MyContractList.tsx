"use client";

import { useState } from "react";
import { useMyContractListQuery } from "@/api/my/getMyContracts";
import { CONTRACT_STATUS_TONE } from "@/constants/contractOptions";
import { ChevronRight } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  CONTRACT_STATUS_LABEL,
  formatWorkDates,
} from "@/type/contract";
import type { MyContract } from "@/type/my";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import MyContractSignModal from "./MyContractSignModal";

/**
 * 내 근로계약서.
 *
 * 서명해야 하는 것이 맨 위에 온다. 끝난 문서는 보관용이라 아래로 내려간다.
 * 관리자 명단의 정렬(`CONTRACT_ROSTER_STATE_ORDER`)과 방향은 같지만 기준이 다르다 —
 * 저쪽은 담당자가 손댈 순서이고, 여기는 본인이 손댈 순서다.
 */
const SORT_ORDER: MyContract["status"][] = [
  "SENT",
  "REJECTED",
  "SIGNED",
  "DRAFT",
  "SUPERSEDED",
];

const MyContractList = () => {
  const jobRoleLabel = useJobRoleLabel();
  const { data, isLoading } = useMyContractListQuery();
  const [selected, setSelected] = useState<MyContract | null>(null);

  const contracts = [...(data?.items ?? [])].sort(
    (a, b) =>
      SORT_ORDER.indexOf(a.status) - SORT_ORDER.indexOf(b.status) ||
      b.workDates[0].localeCompare(a.workDates[0]),
  );

  const waitingCount = contracts.filter(
    (contract) => contract.status === "SENT",
  ).length;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-card" />
        ))}
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <Card>
        <EmptyState
          title="계약서가 없습니다."
          description="근무가 확정되면 담당자가 근로계약서를 보내 드립니다."
        />
      </Card>
    );
  }

  return (
    <>
      {waitingCount > 0 && (
        <Alert tone="warning" title={`서명할 계약서가 ${waitingCount}건 있습니다.`}>
          근무 전에 서명해 주세요. 계약서가 없으면 정산이 시작되지 않습니다.
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        {contracts.map((contract) => (
          <Card key={contract.contractId} noPadding>
            <button
              type="button"
              onClick={() => setSelected(contract)}
              className="flex w-full items-center gap-3 p-5 text-left transition hover:bg-surface-hover"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-[15px] font-semibold text-font-0">
                    {contract.eventTitle}
                  </span>
                  {/* 차수가 올라간 문서는 그 사실이 먼저 보여야 한다. */}
                  {contract.revision > 1 && (
                    <Badge tone="neutral">{contract.revision}차</Badge>
                  )}
                </span>

                <span className="mt-0.5 block truncate text-[13px] text-font-2">
                  {contract.clientName} · {jobRoleLabel(contract.role)}
                </span>

                <span className="mt-1 block text-[12px] text-font-2 tabular-nums">
                  {formatWorkDates(contract.workDates)} ·{" "}
                  {formatCurrency(contract.totalWage)}
                </span>

                {contract.status === "SIGNED" && contract.signedAt && (
                  <span className="mt-1 block text-[12px] text-font-disabled">
                    {formatDate(contract.signedAt)} 서명
                    {contract.isPaperSigned && " (종이 접수)"}
                  </span>
                )}
              </span>

              <Badge tone={CONTRACT_STATUS_TONE[contract.status]}>
                {CONTRACT_STATUS_LABEL[contract.status]}
              </Badge>

              <ChevronRight size={16} />
            </button>
          </Card>
        ))}
      </div>

      {selected && (
        <MyContractSignModal
          contract={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
};

export default MyContractList;
