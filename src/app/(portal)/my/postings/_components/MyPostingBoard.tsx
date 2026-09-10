"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useMyApplicationListQuery,
  useMyApplicationMutation,
  useMyPostingListQuery,
} from "@/api/my/getMyRecruit";
import { useMyProfileQuery } from "@/api/my/getMyProfile";
import { APPLICATION_STATUS_TONE } from "@/constants/recruitOptions";
import { Calendar, MapPin, Warning } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { openConfirm } from "@/store/useConfirmStore";
import { formatTimeRange } from "@/type/event";
import type { MyPosting } from "@/type/my";
import { APPLICATION_STATUS_LABEL } from "@/type/recruit";
import { WAGE_TYPE_LABEL } from "@/type/event";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Switch from "@/components/ui/Switch";
import Tabs, { type TabItem } from "@/components/ui/Tabs";

type PostingTab = "OPEN" | "MINE";

const TABS: TabItem<PostingTab>[] = [
  { label: "공고", value: "OPEN" },
  { label: "내 지원", value: "MINE" },
];

/** 근무일이 여러 날이면 "09.12 외 2일"로 줄인다. 카드에 열 줄을 세울 수 없다. */
const describeWorkDates = (workDates: string[]): string => {
  if (workDates.length === 0) return "-";

  const first = formatDate(workDates[0]);

  return workDates.length === 1 ? first : `${first} 외 ${workDates.length - 1}일`;
};

interface PostingCardProps {
  posting: MyPosting;
  isDocumentApproved: boolean;
  onApply: (posting: MyPosting) => void;
  isApplying: boolean;
}

const PostingCard = ({
  posting,
  isDocumentApproved,
  onApply,
  isApplying,
}: PostingCardProps) => {
  const jobRoleLabel = useJobRoleLabel();

  /* 막는 이유가 여럿이면 **하나만** 말한다. 세 줄이 겹치면 무엇부터 해야 할지 모른다. */
  const blockReason = posting.isApplied
    ? "이미 지원했습니다."
    : posting.conflictEventTitle
      ? `같은 날 '${posting.conflictEventTitle}'에 확정되어 있습니다.`
      : !isDocumentApproved
        ? "서류가 승인되어야 지원할 수 있습니다."
        : "";

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-font-0">
              {posting.title}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-font-2">
              {posting.clientName} · {jobRoleLabel(posting.role)}
            </p>
          </div>

          <Badge tone="brand">{posting.requiredCount}명 모집</Badge>
        </div>

        <dl className="flex flex-col gap-2 border-t border-border-main pt-3 text-[13px]">
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 shrink-0 text-font-disabled">
              <Calendar size={15} />
            </dt>
            <dd className="min-w-0 text-font-1">
              {describeWorkDates(posting.workDates)}{" "}
              <span className="tabular-nums">
                {formatTimeRange(
                  posting.startTime,
                  posting.endTime,
                  posting.endDayOffset,
                )}
              </span>
            </dd>
          </div>

          <div className="flex items-start gap-2">
            <dt className="mt-0.5 shrink-0 text-font-disabled">
              <MapPin size={15} />
            </dt>
            <dd className="min-w-0 text-font-1">
              {posting.venue}
              {posting.address && (
                <span className="block text-[12px] text-font-2">
                  {posting.address}
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="flex items-end justify-between gap-3 border-t border-border-main pt-3">
          <div>
            <p className="text-[12px] text-font-2">
              {WAGE_TYPE_LABEL[posting.wageType]}{" "}
              {formatCurrency(posting.wage)}
            </p>
            <p className="text-[16px] font-semibold text-font-0 tabular-nums">
              하루 {formatCurrency(posting.dailyPay)}
            </p>
          </div>

          <Button
            variant={blockReason ? "secondary" : "primary"}
            disabled={Boolean(blockReason) || isApplying}
            onClick={() => onApply(posting)}
          >
            {posting.isApplied ? "지원함" : "지원하기"}
          </Button>
        </div>

        {blockReason && (
          <p className="flex items-center gap-1.5 text-[12px] text-font-2">
            <Warning size={13} />
            {blockReason}
          </p>
        )}
      </div>
    </Card>
  );
};

/**
 * 공고 열람 · 지원.
 *
 * 담당자가 오픈카톡방에 붙여넣던 공고문을 그대로 보여 주지 않는다.
 * 그 글은 "지원: 성함/나이/경력을 담당자에게" 로 끝나는데, 지원 버튼이 있는
 * 화면에서 그 문장이 함께 뜨면 두 가지 방법이 동시에 열린 것으로 읽힌다.
 */
const MyPostingBoard = () => {
  const initialTab = useSearchParams().get("tab") === "MINE" ? "MINE" : "OPEN";
  const [tab, setTab] = useState<PostingTab>(initialTab);
  const [onlyMyRoles, setOnlyMyRoles] = useState(true);

  const { data: profile } = useMyProfileQuery();
  const { data: postingData, isLoading } = useMyPostingListQuery({
    onlyMyRoles,
  });
  const { data: applicationData } = useMyApplicationListQuery();
  const { applyMutation, cancelMutation } = useMyApplicationMutation();

  const postings = postingData?.items ?? [];
  const applications = applicationData?.items ?? [];
  const isDocumentApproved = profile?.documentReviewState === "APPROVED";

  const handleApply = (posting: MyPosting) => {
    openConfirm({
      title: "이 공고에 지원할까요?",
      description: `${posting.title}\n${describeWorkDates(posting.workDates)}`,
      /* 지원이 확정이 아니라는 것을 누르기 전에 말해 둔다. */
      warning:
        "지원한다고 근무가 확정되는 것은 아닙니다. 담당자가 확인한 뒤 연락드립니다.",
      confirmText: "지원하기",
      onConfirm: () => applyMutation.mutate(posting.postingId),
    });
  };

  return (
    <>
      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === "OPEN" ? (
        <>
          {!isDocumentApproved && (
            <Alert tone="warning" title="서류를 먼저 등록해 주세요.">
              신분증 · 통장사본이 승인되어야 근무를 확정할 수 있어
              지금은 지원할 수 없습니다.
            </Alert>
          )}

          {/* Switch가 button이라 label로 감싸지 않는다. 라벨은 Switch가 직접 받는다. */}
          <div className="flex items-center justify-between gap-3 rounded-card border border-border-main bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] text-font-1">내가 할 수 있는 직무만</p>
              <p className="text-[12px] text-font-2">
                내 정보에 등록한 직무 기준입니다
              </p>
            </div>
            <Switch
              label="내가 할 수 있는 직무만 보기"
              checked={onlyMyRoles}
              onChange={setOnlyMyRoles}
            />
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-52 w-full rounded-card" />
              ))}
            </div>
          ) : postings.length === 0 ? (
            <Card>
              <EmptyState
                title="지금 올라온 공고가 없습니다."
                description={
                  onlyMyRoles
                    ? "직무 조건을 끄면 다른 자리도 볼 수 있습니다."
                    : "새 공고가 올라오면 여기에 표시됩니다."
                }
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {postings.map((posting) => (
                <PostingCard
                  key={posting.postingId}
                  posting={posting}
                  isDocumentApproved={isDocumentApproved}
                  onApply={handleApply}
                  isApplying={applyMutation.isPending}
                />
              ))}
            </div>
          )}
        </>
      ) : applications.length === 0 ? (
        <Card>
          <EmptyState
            title="지원한 공고가 없습니다."
            description="공고 탭에서 원하는 자리에 지원해 보세요."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {applications.map((application) => (
            <Card key={application.applicationId}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-font-0">
                    {application.eventTitle}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-font-2">
                    {formatDate(application.workDate)} · {application.clientName}
                  </p>
                </div>

                <Badge tone={APPLICATION_STATUS_TONE[application.status]}>
                  {APPLICATION_STATUS_LABEL[application.status]}
                </Badge>
              </div>

              {/*
                취소는 검토 대기일 때만 뜬다. 확정된 뒤에 화면에서 혼자 빠질 수 있으면
                담당자는 전날에야 사람이 사라진 것을 알게 된다.
              */}
              {application.status === "PENDING" && (
                <div className="mt-3 flex justify-end border-t border-border-main pt-3">
                  <Button
                    variant="ghost"
                    disabled={cancelMutation.isPending}
                    onClick={() =>
                      openConfirm({
                        title: "지원을 취소할까요?",
                        description: application.eventTitle,
                        confirmText: "지원 취소",
                        tone: "danger",
                        onConfirm: () =>
                          cancelMutation.mutate(application.applicationId),
                      })
                    }
                  >
                    지원 취소
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default MyPostingBoard;
