"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useMyContractListQuery } from "@/api/my/getMyContracts";
import { CONTRACT_STATUS_TONE } from "@/constants/contractOptions";
import { ChevronRight } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { cn, formatCurrency } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { CONTRACT_STATUS_LABEL, formatWorkDates } from "@/type/contract";
import type { MyContract } from "@/type/my";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";

/**
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

/**
 * 카드 맨 아래 한 줄 — 이 문서가 **지금 나에게 무엇을 요구하는가.**
 * 상태 배지만으로는 '반려'가 내가 뭘 잘못한 것인지, 업체를 기다리는 것인지 알 수 없다.
 */
const describeNextStep = (
  contract: MyContract,
): { text: string; className: string } | null => {
  switch (contract.status) {
    case "SENT":
      return {
        text: "전문을 확인하고 서명해 주세요",
        className: "font-medium text-warning",
      };
    case "REJECTED":
      return {
        text: "수정요청을 보냈어요 · 업체가 다시 발급하면 서명할 수 있어요",
        className: "text-font-2",
      };
    case "SIGNED":
      return {
        text: `${contract.signedAt ? `${formatDate(contract.signedAt)} ` : ""}서명${
          contract.isPaperSigned ? " (종이 접수)" : ""
        }`,
        className: "text-font-disabled",
      };
    case "SUPERSEDED":
      return {
        text: "새 차수로 대체된 보관용 문서예요",
        className: "text-font-disabled",
      };
    default:
      return null;
  }
};

/**
 * 내 근로계약서.
 *
 * 카드를 누르면 **상세 페이지**로 간다. 예전에는 모달 하나에 요약 · 전문 · 서명 폼 ·
 * 수정요청 폼을 모두 넣었는데, 서명 버튼을 누르면 전문으로 바뀌면서 서명칸은
 * 요약 쪽에 떠 버리는 일이 생겼고, 수정요청 칸은 모달 맨 아래에 붙어 아무도 알아채지 못했다.
 * 지금은 한 화면이 한 가지만 한다 — 목록(고르기) → 상세(확인) → 전문(읽고 서명).
 */
const MyContractList = () => {
  const jobRoleLabel = useJobRoleLabel();
  const { data, isLoading } = useMyContractListQuery();

  /*
    **새 차수가 있는 행사의 지난 차수는 목록에서 뺀다.** 같은 행사가 '재작성됨'과
    '서명 대기'로 두 줄 서면 계약이 두 개인 줄 안다. 지난 차수는 상세의 이력에 남아 있다.
    (새 차수가 아직 본인에게 오지 않았다면 — 등록 대기 — 지난 차수라도 남긴다. 그 행사의
    유일한 문서다)
  */
  const { contracts, hiddenCount } = useMemo(() => {
    const items = data?.items ?? [];
    const latestRevision = new Map<number, number>();

    items.forEach((contract) => {
      latestRevision.set(
        contract.eventId,
        Math.max(latestRevision.get(contract.eventId) ?? 0, contract.revision),
      );
    });

    const visible = items
      .filter(
        (contract) =>
          contract.status !== "SUPERSEDED" ||
          (latestRevision.get(contract.eventId) ?? 0) <= contract.revision,
      )
      .sort(
        (a, b) =>
          SORT_ORDER.indexOf(a.status) - SORT_ORDER.indexOf(b.status) ||
          (b.workDates[0] ?? "").localeCompare(a.workDates[0] ?? ""),
      );

    return { contracts: visible, hiddenCount: items.length - visible.length };
  }, [data]);

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

      <ul className="flex flex-col gap-3">
        {contracts.map((contract) => {
          const nextStep = describeNextStep(contract);
          const positionText =
            contract.positionNames.length > 0
              ? contract.positionNames.join(" · ")
              : jobRoleLabel(contract.role);

          return (
            <li key={contract.contractId}>
              <Link
                href={`/my/contracts/detail?id=${contract.contractId}`}
                className="flex w-full items-center gap-3 rounded-card border border-border-main bg-surface p-5 shadow-card transition hover:-translate-y-px hover:border-brand hover:shadow-card-hover active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-[15px] font-semibold text-font-0">
                      {contract.eventTitle}
                    </span>
                    {/* 차수가 올라간 문서는 그 사실이 먼저 보여야 한다. */}
                    {contract.revision > 1 && (
                      <Badge tone="neutral" className="shrink-0">
                        {contract.revision}차
                      </Badge>
                    )}
                  </span>

                  <span className="mt-0.5 block truncate text-[13px] text-font-2">
                    {contract.clientName} · {positionText}
                  </span>

                  <span className="mt-1 block text-[12px] text-font-2 tabular-nums">
                    {formatWorkDates(contract.workDates)} ·{" "}
                    {formatCurrency(contract.totalWage)}
                  </span>

                  {nextStep && (
                    <span
                      className={cn("mt-1.5 block text-[12px]", nextStep.className)}
                    >
                      {nextStep.text}
                    </span>
                  )}
                </span>

                <Badge tone={CONTRACT_STATUS_TONE[contract.status]} className="shrink-0">
                  {CONTRACT_STATUS_LABEL[contract.status]}
                </Badge>

                <ChevronRight size={16} className="shrink-0 text-font-disabled" />
              </Link>
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <p className="text-center text-[12px] text-font-2">
          지난 차수 {hiddenCount}건은 각 계약서 상세의 이력에서 볼 수 있어요.
        </p>
      )}
    </>
  );
};

export default MyContractList;
