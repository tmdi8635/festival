"use client";

import { ReactNode, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMyContractPreviewQuery,
  type MyContractPreview,
} from "@/api/my/getMyContracts";
import { CONTRACT_STATUS_TONE } from "@/constants/contractOptions";
import { ChevronRight, FileText } from "@/icons";
import { formatDateTime, formatShortDate } from "@/lib/dayjs";
import { cn, formatCurrency } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  AMEND_REASON_LABEL,
  CONTRACT_STATUS_LABEL,
  formatWorkDates,
} from "@/type/contract";
import { WAGE_TYPE_LABEL, calculateBasePay, formatTimeRange } from "@/type/event";
import type { MyContractHistoryItem } from "@/type/my";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import PortalBackHeader from "@/app/(portal)/_components/PortalBackHeader";
import ContractNotFound from "./ContractNotFound";
import { useContractIdParam } from "./useContractIdParam";

const SummaryRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex items-start justify-between gap-4 py-2.5">
    <dt className="shrink-0 text-[13px] text-font-2">{label}</dt>
    <dd className="min-w-0 text-right text-[14px] text-font-1">{children}</dd>
  </div>
);

const detailHref = (contractId: number) => `/my/contracts/detail?id=${contractId}`;

interface StatusNoticeProps {
  preview: MyContractPreview;
  onOpen: (contractId: number) => void;
}

/**
 * 상태별 안내. **지금 내가 할 일이 있는가**를 한 문단으로 답한다.
 *
 * 반려(수정요청)는 경고색이 아니다. 본인이 할 일은 이미 끝났고 업체를 기다리는 중이다.
 * 붉게 칠하면 뭔가 더 해야 하는 줄 알고 담당자에게 전화한다.
 */
const StatusNotice = ({ preview, onOpen }: StatusNoticeProps) => {
  const { summary, contract, history } = preview;

  switch (summary.status) {
    case "SENT":
      return (
        <Alert tone="warning" title="서명을 기다리고 있어요.">
          계약서 전문을 끝까지 확인한 뒤 서명해 주세요. 안내받은 내용과 다르면 서명하지
          말고 전문 화면에서 수정요청을 보내 주세요.
        </Alert>
      );

    case "REJECTED": {
      const latest = summary.revisionRequests[summary.revisionRequests.length - 1];

      return (
        <Alert tone="info" title="수정요청을 보냈어요.">
          <span className="block rounded-field bg-surface px-3 py-2 whitespace-pre-line text-font-1">
            {latest?.reason ?? summary.rejectedReason}
          </span>
          {latest && (
            <span className="mt-1 block text-[12px] tabular-nums">
              {formatDateTime(latest.requestedAt)} 전송
            </span>
          )}
          <span className="mt-2 block">
            업체가 확인하고 다시 발급하면 새 계약서에 서명할 수 있어요. 이 문서에는 서명할
            수 없어요.
          </span>
        </Alert>
      );
    }

    case "SIGNED":
      return (
        <Alert tone="success" title="서명이 완료되었어요.">
          {contract.signature ? (
            <>
              {contract.signature.signedName} ·{" "}
              <span className="tabular-nums">
                {formatDateTime(contract.signature.signedAt)}
              </span>{" "}
              전자서명
              <span className="mt-1 block text-[12px] tabular-nums">
                문서 지문 {contract.signature.documentHash}
              </span>
            </>
          ) : (
            <>
              종이 서명본으로 접수되었어요
              {summary.signedAt && ` (${formatDateTime(summary.signedAt)})`}.
            </>
          )}
        </Alert>
      );

    case "SUPERSEDED": {
      const latest = history[history.length - 1];
      const newer = latest && latest.revision > summary.revision ? latest : undefined;

      return (
        <Alert
          tone="info"
          title="새 차수로 다시 작성된 계약서예요."
          action={
            newer && (
              <Button size="sm" onClick={() => onOpen(newer.contractId)}>
                {newer.revision}차 보기
              </Button>
            )
          }
        >
          {newer
            ? "지금 유효한 문서는 새 차수입니다. 이 문서는 보관용으로 남겨 두었어요."
            : "업체가 새 계약서를 준비하고 있어요. 준비되면 목록에 나타납니다."}
        </Alert>
      );
    }

    default:
      return null;
  }
};

interface HistoryItemProps {
  item: MyContractHistoryItem;
  isCurrent: boolean;
}

/**
 * 차수 한 줄. **무엇을 고쳐 달라고 했고, 그게 몇 차로 돌아왔는가**가 한눈에 이어져야 한다.
 */
const HistoryItem = ({ item, isCurrent }: HistoryItemProps) => (
  <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[14px] font-semibold text-font-0">{item.revision}차</span>
      <Badge tone={CONTRACT_STATUS_TONE[item.status]}>
        {CONTRACT_STATUS_LABEL[item.status]}
      </Badge>
      {isCurrent && <Badge tone="brand">지금 보는 문서</Badge>}
      <span className="ml-auto text-[13px] text-font-1 tabular-nums">
        {formatCurrency(item.totalWage)}
      </span>
    </div>

    <p className="text-[12px] text-font-2 tabular-nums">
      {item.sentAt ? `${formatDateTime(item.sentAt)} 발급` : "발급 전"}
      {item.signedAt && ` · ${formatDateTime(item.signedAt)} 서명`}
    </p>

    {/* 2차부터는 왜 다시 나왔는지가 있다. 금액이 달라진 이유가 여기서 읽혀야 한다. */}
    {item.amendReason && (
      <p className="text-[13px] text-font-1">
        <span className="text-font-2">
          다시 작성한 이유
          {item.amendReasonType && ` (${AMEND_REASON_LABEL[item.amendReasonType]})`}
          {" · "}
        </span>
        {item.amendReason}
      </p>
    )}

    {item.revisionRequests.map((request) => (
      <div
        key={request.requestedAt}
        className="flex flex-col gap-1 rounded-field bg-subtle px-3 py-2.5"
      >
        <p className="text-[12px] text-font-2 tabular-nums">
          {formatDateTime(request.requestedAt)} 내가 보낸 수정요청
        </p>
        <p className="text-[13px] whitespace-pre-line text-font-1">{request.reason}</p>
        <p
          className={cn(
            "text-[12px]",
            request.resolvedRevision ? "text-success" : "text-font-2",
          )}
        >
          {request.resolvedRevision
            ? `${request.resolvedRevision}차로 다시 발급됨${
                request.resolvedAt ? ` · ${formatDateTime(request.resolvedAt)}` : ""
              }`
            : "업체가 확인하고 있어요"}
        </p>
      </div>
    ))}

    {!isCurrent && (
      <Link
        href={detailHref(item.contractId)}
        className="flex items-center gap-0.5 self-start text-[13px] text-brand transition hover:opacity-80"
      >
        이 차수 보기
        <ChevronRight size={14} />
      </Link>
    )}
  </li>
);

/**
 * 근로계약서 상세 — **확인하는 화면이다. 서명 · 수정요청 버튼은 여기 없다.**
 *
 * 전문을 열지 않고 요약만 보고 수정요청을 보내거나 서명할 수 있으면, 조항은 아무도
 * 읽지 않은 채 계약이 맺어진다. 서명과 수정요청은 전문 화면 맨 아래에서만 받는다.
 *
 * 여기서는 폰에서 크게 읽혀야 하는 세 가지 — 언제 · 몇 시에 · 얼마 — 를 위에 세우고,
 * 이 문서가 몇 번째 차수인지, 내가 무엇을 고쳐 달라고 했는지를 아래에 이어 둔다.
 */
const MyContractDetail = () => {
  const router = useRouter();
  const contractId = useContractIdParam();
  const jobRoleLabel = useJobRoleLabel();
  const { data, isLoading, isError } = useMyContractPreviewQuery(contractId);

  /* 근무일별 표. 날마다 포지션 · 시각 · 금액이 다를 수 있다 (A타임 · B타임). */
  const workDays = useMemo(
    () =>
      [...(data?.contract.workDays ?? [])].sort((a, b) =>
        a.workDate.localeCompare(b.workDate),
      ),
    [data],
  );

  if (contractId === null || isError) {
    return (
      <>
        <PortalBackHeader href="/my/contracts" label="계약서 목록" />
        <ContractNotFound />
      </>
    );
  }

  if (isLoading || !data) {
    return (
      <>
        <PortalBackHeader href="/my/contracts" label="계약서 목록" />
        <Skeleton className="h-20 w-full rounded-field" />
        <Skeleton className="h-96 w-full rounded-card" />
      </>
    );
  }

  const { contract, template, summary, history } = data;
  const isPerDay = contract.hasMixedSchedule || contract.hasMixedWage;
  const positionText =
    summary.positionNames.length > 0
      ? summary.positionNames.join(" · ")
      : jobRoleLabel(contract.role);

  const showHistory =
    history.length > 1 ||
    history.some((item) => item.revisionRequests.length > 0);

  const openContract = (id: number) => router.push(detailHref(id));

  return (
    <>
      <PortalBackHeader href="/my/contracts" label="계약서 목록" />

      <StatusNotice preview={data} onOpen={openContract} />

      <Card>
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={CONTRACT_STATUS_TONE[summary.status]}>
                {CONTRACT_STATUS_LABEL[summary.status]}
              </Badge>
              {summary.revision > 1 && (
                <Badge tone="neutral">{summary.revision}차</Badge>
              )}
            </div>
            <h2 className="mt-2 text-[17px] font-semibold text-font-0">
              {summary.eventTitle}
            </h2>
            <p className="mt-0.5 text-[13px] text-font-2">
              {summary.clientName} · 계약번호{" "}
              <span className="tabular-nums">{summary.contractNumber || "-"}</span>
            </p>
          </div>

          {/* 확인해야 하는 세 가지 중 가장 먼저 — 얼마. */}
          <div className="rounded-card bg-subtle px-4 py-3">
            <p className="text-[12px] text-font-2">세전 총 지급액</p>
            <p className="text-[24px] font-bold text-font-0 tabular-nums">
              {formatCurrency(contract.totalWage)}
            </p>
            <p className="mt-0.5 text-[12px] text-font-2 tabular-nums">
              {contract.hasMixedWage
                ? "근무일마다 금액이 달라요"
                : `${WAGE_TYPE_LABEL[contract.wageType]} ${formatCurrency(contract.wage)}`}
              {` · ${contract.workDates.length}일 · 실근무 총 ${contract.totalWorkHours.toFixed(1)}시간`}
            </p>
          </div>

          <dl className="divide-y divide-border-main">
            <SummaryRow label="근무일">
              <span className="tabular-nums">{formatWorkDates(contract.workDates)}</span>
            </SummaryRow>

            <SummaryRow label="근무 시간">
              {contract.hasMixedSchedule ? (
                <span className="text-font-2">근무일마다 달라요 (아래 표)</span>
              ) : (
                <>
                  <span className="tabular-nums">
                    {formatTimeRange(
                      contract.startTime,
                      contract.endTime,
                      contract.endDayOffset,
                    )}
                  </span>
                  {contract.breakMinutes > 0 && (
                    <span className="block text-[12px] text-font-2">
                      휴게 {contract.breakMinutes}분
                    </span>
                  )}
                </>
              )}
            </SummaryRow>

            <SummaryRow label="포지션">
              {positionText}
              <span className="block text-[12px] text-font-2">
                {jobRoleLabel(contract.role)}
              </span>
            </SummaryRow>

            <SummaryRow label="장소">{contract.venue || "-"}</SummaryRow>
            <SummaryRow label="사업주">{template.companyName}</SummaryRow>
          </dl>

          {isPerDay && workDays.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-medium text-font-1">근무일별 조건</p>
              <ul className="divide-y divide-border-main rounded-field border border-border-main">
                {workDays.map((day) => (
                  <li
                    key={day.workDate}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-font-1 tabular-nums">
                        {formatShortDate(day.workDate)}
                        {day.positionName && (
                          <span className="ml-1.5 font-normal text-font-2">
                            {day.positionName}
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-font-2 tabular-nums">
                        {formatTimeRange(day.startTime, day.endTime, day.endDayOffset)}
                        {day.breakMinutes > 0 && ` · 휴게 ${day.breakMinutes}분`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-medium text-font-1 tabular-nums">
                        {formatCurrency(
                          calculateBasePay(day.wageType, day.wage, day.workHours),
                        )}
                      </p>
                      <p className="text-[12px] text-font-2 tabular-nums">
                        {WAGE_TYPE_LABEL[day.wageType]} {formatCurrency(day.wage)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[12px] text-font-2">
            위 요약은 계약서에서 뽑아 온 값입니다. 조항 전문은 아래에서 확인해 주세요.
          </p>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          leftIcon={<FileText size={16} />}
          onClick={() => router.push(`/my/contracts/document?id=${summary.contractId}`)}
        >
          계약서 전문 보기
        </Button>
        {summary.status === "SENT" && (
          <p className="text-center text-[12px] text-font-2">
            서명과 수정요청은 전문을 끝까지 읽은 뒤 맨 아래에서 할 수 있어요.
          </p>
        )}
      </div>

      {showHistory && (
        <Card title="차수 · 수정요청 이력" description="오래된 차수부터 적었어요.">
          <ol className="divide-y divide-border-main">
            {history.map((item) => (
              <HistoryItem
                key={item.contractId}
                item={item}
                isCurrent={item.contractId === summary.contractId}
              />
            ))}
          </ol>
        </Card>
      )}
    </>
  );
};

export default MyContractDetail;
