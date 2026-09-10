"use client";

import { useState } from "react";
import { useMyPostingListQuery } from "@/api/my/getMyRecruit";
import { useMyProfileQuery } from "@/api/my/getMyProfile";
import { Calendar, ChevronRight, MapPin } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { useStaffSessionStore } from "@/store/useStaffSessionStore";
import { formatTimeRange } from "@/type/event";
import type { MyPosting } from "@/type/my";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Switch from "@/components/ui/Switch";
import PostingDetailModal from "../../_components/PostingDetailModal";

/** 근무일이 여러 날이면 "09.12 외 2일"로 줄인다. 카드에 열 줄을 세울 수 없다. */
const describeWorkDates = (workDates: string[]): string => {
  if (workDates.length === 0) return "-";

  const first = formatDate(workDates[0]);

  return workDates.length === 1 ? first : `${first} 외 ${workDates.length - 1}일`;
};

interface PostingCardProps {
  posting: MyPosting;
  onOpen: (posting: MyPosting) => void;
}

/**
 * 공고 한 줄.
 *
 * **누를지 말지 정하는 데 필요한 것만 세운다** — 무슨 행사인지, 언제, 어디서,
 * 얼마인지. 복장 · 준비물 · 집합 장소는 상세에 있다.
 *
 * 모집 인원은 적지 않는다. 응답에 아예 없다(`MyPosting`). 몇 자리 남았는지가
 * 보이면 지원이 눈치 게임이 되고, 우리가 인력을 얼마나 못 채웠는지가
 * 그대로 밖으로 나간다.
 */
const PostingCard = ({ posting, onOpen }: PostingCardProps) => {
  const jobRoleLabel = useJobRoleLabel();

  return (
    <Card noPadding>
      <button
        type="button"
        onClick={() => onOpen(posting)}
        className="flex w-full items-center gap-3 p-5 text-left transition hover:bg-surface-hover"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-2.5">
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="min-w-0 truncate text-[15px] font-semibold text-font-0">
                {posting.title}
              </span>
              {posting.isApplied && <Badge tone="warning">지원함</Badge>}
            </span>

            {/*
              직무를 제목 바로 밑에 둔다. 한 행사에서 직무별로 공고가 따로 나가므로
              (팀장 공고 · 스태프 공고), 직무가 아래쪽 금액 옆에 작게 붙어 있으면
              같은 줄이 두 번 적힌 것처럼 보인다.
            */}
            <span className="min-w-0 truncate text-[13px] text-font-2">
              {posting.clientName} · {jobRoleLabel(posting.role)}
            </span>
          </span>

          <span className="flex flex-col gap-1 text-[13px] text-font-1">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="shrink-0 text-font-disabled" />
              <span className="min-w-0 truncate">
                {describeWorkDates(posting.workDates)}{" "}
                <span className="tabular-nums">
                  {formatTimeRange(
                    posting.startTime,
                    posting.endTime,
                    posting.endDayOffset,
                  )}
                </span>
              </span>
            </span>

            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="shrink-0 text-font-disabled" />
              <span className="min-w-0 truncate">{posting.venue}</span>
            </span>
          </span>

          <span className="text-[16px] font-semibold text-font-0 tabular-nums">
            하루 {formatCurrency(posting.dailyPay)}
          </span>
        </span>

        <ChevronRight size={16} className="shrink-0 text-font-disabled" />
      </button>
    </Card>
  );
};

/**
 * 공고 열람 · 지원.
 *
 * 담당자가 오픈카톡방에 붙여넣던 공고문을 그대로 보여 주지 않는다.
 * 그 글은 "지원: 성함/나이/경력을 담당자에게" 로 끝나는데, 지원 버튼이 있는
 * 화면에서 그 문장이 함께 뜨면 두 가지 방법이 동시에 열린 것으로 읽힌다.
 *
 * **로그인하지 않아도 열린다.** 비회원에게는 공고만 보이고, 지원과
 * '내가 할 수 있는 직무만'은 잠긴다 — 무엇이 내 직무인지는 등록한 사람에게만
 * 있는 정보라, 켤 수 있는 것처럼 보여 놓고 아무것도 걸러 내지 못한다.
 */
const PostingBoard = () => {
  const staffId = useStaffSessionStore((state) => state.staffId);
  const isGuest = staffId === null;

  const [onlyMyRoles, setOnlyMyRoles] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: profile } = useMyProfileQuery();
  const { data, isLoading } = useMyPostingListQuery({
    onlyMyRoles: isGuest ? false : onlyMyRoles,
  });

  const postings = data?.items ?? [];
  const isDocumentApproved = profile?.documentReviewState === "APPROVED";

  return (
    <>
      {isGuest ? (
        <Alert tone="info" title="지금은 둘러보는 중입니다.">
          공고는 로그인하지 않아도 볼 수 있습니다. 지원하려면 로그인해 주세요.
        </Alert>
      ) : (
        !isDocumentApproved && (
          <Alert tone="warning" title="서류를 먼저 등록해 주세요.">
            신분증 · 통장사본이 승인되어야 근무를 확정할 수 있습니다.
          </Alert>
        )
      )}

      {/*
        직무 조건은 **회원 전용**이다.

        Switch가 button이라 label로 감싸지 않는다. 라벨은 Switch가 직접 받는다.
      */}
      {!isGuest && (
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
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-card" />
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
              onOpen={(item) => setSelectedId(item.postingId)}
            />
          ))}
        </div>
      )}

      {selectedId !== null && (
        <PostingDetailModal
          postingId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
};

export default PostingBoard;
