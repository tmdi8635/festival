"use client";

import { useState } from "react";
import { useAssignmentMutation } from "@/api/event/mutateAssignment";
import { Close } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { useIsSuperAdmin } from "@/store/useAdminStore";
import { openConfirm } from "@/store/useConfirmStore";
import type { Assignment } from "@/type/event";
import {
  REPUTATION_VERDICT_LABEL,
  calculateReputationDelta,
  formatReputationDelta,
  reputationTagsOf,
  resolveTagPoints,
  resolveTagVerdict,
  type ReputationVerdict,
} from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";

interface ReputationModalProps {
  assignment: Assignment | null;
  onClose: () => void;
}

/** 좋아요 · 별로예요 버튼의 색. 두 선택지가 대등해 보여야 한다. */
const VERDICT_CLASS: Record<ReputationVerdict, string> = {
  GOOD: "border-success bg-success-bg text-success",
  BAD: "border-danger bg-danger-bg text-danger",
};

/**
 * 근무 평가.
 *
 * 현장에서 실제로 내리는 판단은 **"또 부를 것인가"** 하나이고,
 * 그건 누가 눌러도 같은 뜻이다. 그래서 좋아요 · 별로예요 둘로 받고,
 * 왜 그렇게 봤는지는 **고르기만 하면 되는 항목**으로 남긴다.
 *
 * ## 좋아요와 별로예요는 함께 담긴다
 *
 * 좋아요 · 별로예요 버튼은 **항목 팔레트를 바꾸는 것**이지 평가를 한쪽으로
 * 정하는 것이 아니다. "지시 이해는 빠른데 복장 규정은 안 지켰다"는 실제로
 * 흔한 조합인데, 한쪽만 고를 수 있으면 담당자는 둘 중 하나를 버리게 되고
 * 버린 쪽은 영영 기록되지 않는다.
 *
 * ## 점수는 항목이 정한다
 *
 * 항목마다 무게가 다르다. (칭찬 +1~+5 / 불만 −5~−10) 복장이 흐트러진 것과
 * 말없이 자리를 비운 것을 같은 한 표로 세면, 현장에 구멍을 낸 사람과
 * 옷이 좀 헐렁했던 사람이 목록에서 나란히 선다.
 * 이번 평가가 몇 점을 움직이는지 저장 전에 그대로 보여 준다.
 *
 * ## 한 번 남기면 고칠 수 없다
 *
 * 고칠 수 있게 두면 나중에 이해관계가 생겼을 때 지난 평가를 손보게 되고,
 * 그 순간 쌓아 온 점수 전체가 근거를 잃는다. 잘못 남긴 평가는
 * **최고관리자가 지우고** 다시 남긴다.
 */
const ReputationModal = ({ assignment, onClose }: ReputationModalProps) => {
  const isSuperAdmin = useIsSuperAdmin();
  const { reputationMutation, deleteReputationMutation } =
    useAssignmentMutation();

  /** 이미 평가가 남아 있으면 읽기 전용이다. */
  const isRated = Boolean(assignment?.reputationVerdict);

  /*
    팔레트 방향. 어느 쪽 항목을 보여 줄지만 정한다.
    항목을 하나도 고르지 않았을 때의 기본 방향으로도 쓰인다.
  */
  const [palette, setPalette] = useState<ReputationVerdict>("GOOD");
  const [draft, setDraft] = useState<{
    tags: string[];
    comment: string;
  } | null>(null);

  const tags = draft?.tags ?? [];
  const comment = draft?.comment ?? "";

  const patch = (next: Partial<{ tags: string[]; comment: string }>) =>
    setDraft({ tags, comment, ...next });

  const handleClose = () => {
    setDraft(null);
    setPalette("GOOD");
    onClose();
  };

  /*
    팔레트를 바꿔도 **고른 항목은 그대로 둔다.**
    예전에는 여기서 비웠는데, 좋아요를 고른 뒤 별로예요를 보려고 누르는
    순간 앞서 고른 것이 사라져 두 방향을 함께 남길 방법이 없었다.
  */
  const handleToggleTag = (tag: string) =>
    patch({
      tags: tags.includes(tag)
        ? tags.filter((item) => item !== tag)
        : [...tags, tag],
    });

  /** 이번 평가가 점수를 얼마나 움직이는지. 목업 · 집계와 같은 함수를 쓴다. */
  const delta = calculateReputationDelta(tags, palette);

  const handleSubmit = () => {
    if (!assignment || isRated) return;

    reputationMutation.mutate(
      {
        assignmentId: assignment.assignmentId,
        /* 방향은 항목의 합이 정한다. 섞여 있으면 더 무거운 쪽이 이긴다. */
        verdict: delta >= 0 ? "GOOD" : "BAD",
        tags,
        comment: comment.trim() || undefined,
      },
      { onSuccess: handleClose },
    );
  };

  const handleDelete = () => {
    if (!assignment) return;

    openConfirm({
      title: "이 평가를 지울까요?",
      description: `${assignment.staffName}님의 ${formatDate(assignment.workDate)} 근무 평가를 지웁니다. 평판 점수에서도 빠집니다.`,
      warning:
        "평가는 원래 고칠 수 없습니다. 잘못 남긴 것을 되돌리는 용도로만 써 주세요. 지운 뒤 다시 남길 수 있습니다.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: () =>
        deleteReputationMutation
          .mutateAsync(assignment.assignmentId)
          .then(() => handleClose()),
    });
  };

  /** 이미 남은 평가를 볼 때 쓰는 값 */
  const ratedTags = assignment?.reputationTags ?? [];
  const ratedDelta = calculateReputationDelta(
    ratedTags,
    assignment?.reputationVerdict,
  );

  return (
    <Modal
      isOpen={Boolean(assignment)}
      onClose={handleClose}
      title={isRated ? "근무 평가" : "근무 평가 남기기"}
      description={
        assignment
          ? `${assignment.staffName} · ${assignment.eventTitle}`
          : undefined
      }
      onSubmit={isRated ? undefined : handleSubmit}
      footer={
        isRated ? (
          <>
            {isSuperAdmin && (
              <Button
                variant="dangerGhost"
                onClick={handleDelete}
                isLoading={deleteReputationMutation.isPending}
              >
                평가 삭제
              </Button>
            )}
            <Button variant="secondary" onClick={handleClose}>
              닫기
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={reputationMutation.isPending}
            >
              평가 남기기
            </Button>
          </>
        )
      }
    >
      {isRated ? (
        /* ------------------------- 이미 남긴 평가 ------------------------- */
        <div className="flex flex-col gap-4">
          <Alert tone="info" title="평가는 고칠 수 없습니다.">
            남긴 평가를 나중에 손볼 수 있으면 쌓아 온 점수가 근거를 잃습니다.
            잘못 남겼다면 최고관리자에게 삭제를 요청해 주세요.
          </Alert>

          <div className="flex items-center justify-between gap-3 rounded-field border border-border-main px-4 py-3">
            <span className="text-[13px] text-font-2">평판 점수 반영</span>
            <span
              className={cn(
                "text-[18px] font-bold tabular-nums",
                ratedDelta > 0
                  ? "text-success"
                  : ratedDelta < 0
                    ? "text-danger"
                    : "text-font-1",
              )}
            >
              {formatReputationDelta(ratedDelta)}점
            </span>
          </div>

          <FormField label="평가 항목">
            {ratedTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ratedTags.map((tag) => (
                  <Badge
                    key={tag}
                    tone={
                      resolveTagVerdict(tag) === "BAD" ? "danger" : "success"
                    }
                  >
                    {tag}
                    <span className="ml-1 tabular-nums opacity-70">
                      {formatReputationDelta(resolveTagPoints(tag))}
                    </span>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-font-2">
                고른 항목 없이{" "}
                {REPUTATION_VERDICT_LABEL[
                  assignment?.reputationVerdict ?? "GOOD"
                ]}
                만 남겼습니다.
              </p>
            )}
          </FormField>

          <FormField label="메모">
            <p className="text-[13px] text-font-1 whitespace-pre-wrap">
              {assignment?.reputationComment || "남긴 의견 없음"}
            </p>
          </FormField>
        </div>
      ) : (
        /* -------------------------- 평가 남기기 -------------------------- */
        <div className="flex flex-col gap-4">
          <FormField
            label="어떤 점을 남기시겠어요?"
            hint="누르면 아래 항목이 바뀝니다. 두 쪽을 함께 고를 수 있습니다."
          >
            <div className="grid grid-cols-2 gap-2">
              {(["GOOD", "BAD"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={palette === option}
                  onClick={() => setPalette(option)}
                  className={cn(
                    "rounded-field border py-3 text-[15px] font-semibold transition active:scale-[0.98]",
                    palette === option
                      ? VERDICT_CLASS[option]
                      : "border-border-main text-font-2 hover:bg-surface-hover",
                  )}
                >
                  {REPUTATION_VERDICT_LABEL[option]}
                </button>
              ))}
            </div>
          </FormField>

          <FormField
            label={palette === "GOOD" ? "이런 점이 좋았어요" : "이런 점이 아쉬웠어요"}
            hint="여러 개 고를 수 있습니다 (선택)"
          >
            <div className="flex flex-wrap gap-1.5">
              {reputationTagsOf(palette).map(({ tag, points }) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={tags.includes(tag)}
                  onClick={() => handleToggleTag(tag)}
                  className={cn(
                    "rounded-field border px-3 py-1.5 text-[13px] transition active:scale-[0.98]",
                    tags.includes(tag)
                      ? "border-brand bg-brand-opacity-3 font-medium text-brand"
                      : "border-border-main text-font-2 hover:border-brand",
                  )}
                >
                  {tag}
                  <span className="ml-1.5 text-[12px] tabular-nums opacity-60">
                    {formatReputationDelta(points)}
                  </span>
                </button>
              ))}
            </div>
          </FormField>

          {/*
            고른 항목을 **한자리에 모아** 보여 준다.

            팔레트를 옮겨 다니며 고르면 지금 무엇을 골라 뒀는지가 흩어진다.
            좋아요 쪽을 보고 있을 때 별로예요에서 고른 항목이 화면에서
            사라지면, 담당자는 자기가 무엇을 남기는지 모르는 채 저장한다.
          */}
          <div className="flex flex-col gap-2 rounded-field border border-border-main bg-subtle px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-font-1">
                이번 평가
                <span className="ml-1.5 text-[12px] font-normal text-font-2">
                  {tags.length > 0
                    ? `${tags.length}개 항목`
                    : "항목을 고르지 않았습니다"}
                </span>
              </span>

              <span
                className={cn(
                  "text-[16px] font-bold tabular-nums",
                  delta > 0 ? "text-success" : "text-danger",
                )}
              >
                {formatReputationDelta(delta)}점
              </span>
            </div>

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    title="눌러서 뺍니다."
                    className={cn(
                      "inline-flex items-center gap-1 rounded-field border px-2.5 py-1 text-[12px] transition hover:opacity-70",
                      resolveTagVerdict(tag) === "BAD"
                        ? "border-danger/30 bg-danger-bg text-danger"
                        : "border-success/30 bg-success-bg text-success",
                    )}
                  >
                    {tag}
                    <span className="tabular-nums opacity-70">
                      {formatReputationDelta(resolveTagPoints(tag))}
                    </span>
                    <Close size={12} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-font-2">
                항목 없이 남기면 {REPUTATION_VERDICT_LABEL[palette]}만 기록되고{" "}
                {formatReputationDelta(delta)}점이 반영됩니다.
              </p>
            )}
          </div>

          <FormField label="메모" hint="인력 상세의 평판 탭에 그대로 남습니다.">
            <Textarea
              rows={3}
              value={comment}
              onChange={(changeEvent) =>
                patch({ comment: changeEvent.target.value })
              }
              placeholder="현장에서 확인한 내용을 남겨 주세요. (선택)"
            />
          </FormField>

          <p className="text-[12px] text-font-2">
            저장하면 <b>고칠 수 없습니다.</b> 잘못 남긴 평가는 최고관리자만 지울
            수 있습니다.
          </p>
        </div>
      )}
    </Modal>
  );
};

export default ReputationModal;
