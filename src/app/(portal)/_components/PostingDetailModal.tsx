"use client";

import { useMyPostingQuery, useMyApplicationMutation } from "@/api/my/getMyRecruit";
import { Calendar, Clock, MapPin, Package, UserCheck, Warning } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { useStaffSessionStore } from "@/store/useStaffSessionStore";
import { WAGE_TYPE_LABEL, formatTimeRange } from "@/type/event";
import type { MyPosting } from "@/type/my";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";

interface PostingDetailModalProps {
  postingId: number;
  onClose: () => void;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

const DetailRow = ({ icon, label, children }: DetailRowProps) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 shrink-0 text-font-disabled">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] text-font-2">{label}</p>
      <div className="mt-0.5 text-[14px] text-font-1">{children}</div>
    </div>
  </div>
);

/**
 * 공고 상세.
 *
 * 목록에는 **눌러 볼지 정하는 데 필요한 것만** 세운다. 집합 장소 · 복장 · 준비물 ·
 * 근무일 전체는 여기서 본다. 카드 하나에 다 적으면 한 장이 화면 두 개 높이가 되고,
 * 그러면 두 번째 공고부터는 아무도 스크롤해서 보지 않는다.
 *
 * **화면이 아니라 모달인 이유**는 포털이 정적으로 내보내지기 때문이다.
 * 공고 번호마다 페이지를 미리 찍을 수 없다. (`docs/DEVELOPMENT_GUIDE.md` 13-5장)
 *
 * 공고 목록과 '내 지원' 양쪽에서 같은 모달을 연다. 지원한 뒤에 조건을 다시
 * 확인하려는 사람이 실제로 많은데, 그때 볼 수 있는 화면이 따로 있으면
 * 두 곳의 내용이 조금씩 어긋나기 시작한다.
 */
const PostingDetailModal = ({ postingId, onClose }: PostingDetailModalProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const staffId = useStaffSessionStore((state) => state.staffId);
  const { data: posting, isLoading } = useMyPostingQuery(postingId);
  const { applyMutation, cancelMutation } = useMyApplicationMutation();

  const isGuest = staffId === null;

  const handleApply = (target: MyPosting) => {
    openConfirm({
      title: "이 공고에 지원할까요?",
      description: target.title,
      /* 지원이 확정이 아니라는 것을 누르기 전에 말해 둔다. */
      warning:
        "지원한다고 근무가 확정되는 것은 아닙니다. 담당자가 확인한 뒤 연락드립니다.",
      confirmText: "지원하기",
      onConfirm: () =>
        applyMutation.mutate(target.postingId, { onSuccess: onClose }),
    });
  };

  const handleCancel = (target: MyPosting) => {
    if (!target.applicationId) return;

    openConfirm({
      title: "지원을 취소할까요?",
      description: target.title,
      confirmText: "지원 취소",
      tone: "danger",
      onConfirm: () =>
        cancelMutation.mutate(target.applicationId!, { onSuccess: onClose }),
    });
  };

  /* 막는 이유가 여럿이면 **하나만** 말한다. 세 줄이 겹치면 무엇부터 해야 할지 모른다. */
  const blockReason = !posting
    ? ""
    : isGuest
      ? "지원하려면 로그인이 필요합니다."
      : posting.conflictEventTitle
        ? `같은 날 '${posting.conflictEventTitle}'에 확정되어 있습니다.`
        : "";

  /** 검토 대기일 때만 무를 수 있다. 확정된 뒤에 혼자 빠지면 현장에 구멍이 난다. */
  const isCancelable = posting?.applicationStatus === "PENDING";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={posting?.title ?? "공고"}
      description={posting ? posting.clientName : undefined}
      size="md"
      footer={
        posting && (
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="ghost" fullWidth onClick={onClose}>
              닫기
            </Button>

            {isCancelable ? (
              <Button
                variant="dangerSoft"
                fullWidth
                disabled={cancelMutation.isPending}
                onClick={() => handleCancel(posting)}
              >
                지원 취소
              </Button>
            ) : (
              <Button
                fullWidth
                disabled={
                  posting.isApplied ||
                  Boolean(blockReason) ||
                  applyMutation.isPending
                }
                onClick={() => handleApply(posting)}
              >
                {posting.isApplied ? "지원함" : "지원하기"}
              </Button>
            )}
          </div>
        )
      }
    >
      {isLoading || !posting ? (
        <Skeleton className="h-72 w-full rounded-card" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{jobRoleLabel(posting.role)}</Badge>
            {posting.isApplied && posting.applicationStatus === "PENDING" && (
              <Badge tone="warning">검토 대기</Badge>
            )}
          </div>

          {/* 돈이 가장 먼저 궁금하다. 위에 크게 둔다. */}
          <div className="flex items-end justify-between gap-3 rounded-card bg-subtle px-4 py-3">
            <div>
              <p className="text-[12px] text-font-2">
                {WAGE_TYPE_LABEL[posting.wageType]}{" "}
                {formatCurrency(posting.wage)}
              </p>
              <p className="text-[20px] font-bold text-font-0 tabular-nums">
                하루 {formatCurrency(posting.dailyPay)}
              </p>
            </div>
            <span className="pb-1 text-[12px] text-font-2 tabular-nums">
              실근무 {posting.workHours.toFixed(1)}시간
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            <DetailRow icon={<Calendar size={16} />} label="근무일">
              {/*
                다일 행사는 날짜를 **전부** 적는다. "09.12 외 2일"로 줄인 채로
                지원하면, 나머지 이틀이 언제인지 모르고 다른 일을 잡는다.
              */}
              <ul className="flex flex-wrap gap-1.5">
                {posting.workDates.map((date) => (
                  <li
                    key={date}
                    className="rounded-field bg-subtle px-2 py-0.5 text-[13px] tabular-nums"
                  >
                    {formatDate(date)}
                  </li>
                ))}
              </ul>
            </DetailRow>

            <DetailRow icon={<Clock size={16} />} label="근무 시간">
              <span className="tabular-nums">
                {formatTimeRange(
                  posting.startTime,
                  posting.endTime,
                  posting.endDayOffset,
                )}
              </span>
              {posting.breakMinutes > 0 && (
                <span className="text-font-2"> · 휴게 {posting.breakMinutes}분</span>
              )}
            </DetailRow>

            <DetailRow icon={<MapPin size={16} />} label="장소">
              {posting.venue}
              {posting.address && (
                <span className="block text-[13px] text-font-2">
                  {posting.address}
                </span>
              )}
              {/* 집합 장소는 행사장 주소와 다르다. 후문 · 지하 주차장인 경우가 흔하다. */}
              {posting.meetingPoint && (
                <span className="mt-1 block rounded-field bg-brand-opacity px-2 py-1 text-[13px] text-brand">
                  집합 {posting.meetingPoint}
                </span>
              )}
            </DetailRow>

            {posting.dressCode && (
              <DetailRow icon={<UserCheck size={16} />} label="복장">
                {posting.dressCode}
              </DetailRow>
            )}

            {posting.belongings && (
              <DetailRow icon={<Package size={16} />} label="준비물">
                {posting.belongings}
              </DetailRow>
            )}
          </div>

          {blockReason && (
            <Alert tone="warning" title={blockReason}>
              {isGuest
                ? "공고는 로그인하지 않아도 볼 수 있습니다. 지원은 담당자가 계정을 만들어 드린 뒤에 할 수 있습니다."
                : "그래도 지원하고 싶다면 담당자에게 먼저 알려 주세요."}
            </Alert>
          )}

          {posting.isApplied && !isCancelable && (
            <p className="flex items-start gap-1.5 text-[12px] text-font-2">
              <Warning size={13} className="mt-0.5 shrink-0" />
              이미 처리된 지원이라 화면에서 되돌릴 수 없습니다. 담당자에게 문의해
              주세요.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default PostingDetailModal;
