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
 * 남기는 것은 **항목이다.** 좋아요 · 별로예요 버튼은 그 항목을 고르기 쉽게
 * 위아래로 갈라 놓은 **편의 기능**일 뿐, 그 자체가 평가가 아니다.
 *
 * ## 항목을 최소 하나는 골라야 한다
 *
 * 버튼만 누르고 저장할 수 있게 뒀더니 대부분이 그렇게 남겼다. 그렇게 쌓인
 * '좋아요만 남김'은 나중에 아무것도 설명하지 못한다. 왜 좋았는지도, 왜
 * 별로였는지도 없으니 그 사람을 다시 부를지 말지에 쓸 수가 없고, 인력 상세의
 * 평판 탭은 이유 없는 배지 목록이 된다. **점수가 아니라 이유를 남기는 화면**이다.
 *
 * ## 좋아요와 별로예요는 함께 담긴다
 *
 * 좋아요 · 별로예요 버튼은 **항목 팔레트를 바꾸는 것**이지 평가를 한쪽으로
 * 정하는 것이 아니다. "지시 이해는 빠른데 복장 규정은 안 지켰다"는 실제로
 * 흔한 조합인데, 한쪽만 고를 수 있으면 담당자는 둘 중 하나를 버리게 되고
 * 버린 쪽은 영영 기록되지 않는다.
 *
 * ## 남기는 화면에는 점수를 적지 않는다
 *
 * 항목마다 `+5` `-8`을 붙여 뒀더니, 평가를 남기는 사람이 무엇이 좋았는지가
 * 아니라 **몇 점을 줄지**를 고르기 시작했다. 여기서 할 일은 현장에서 본 것을
 * 그대로 고르는 것뿐이다. 항목 하나는 2점이고 그 합이 점수가 되지만,
 * 그 계산은 화면이 아니라 뒤에서 한다. 결과는 인력 상세의 평판 탭이 보여 준다.
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
  /*
    여기는 **새로 쓰는 화면이라** 서버 값을 비출 일이 없다.
    (이미 평가가 있으면 읽기 전용으로 갈라진다) 그래서 draft 패턴 없이
    평범한 상태를 쓴다.
  */
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const handleClose = () => {
    setTags([]);
    setComment("");
    setPalette("GOOD");
    onClose();
  };

  /*
    팔레트를 바꿔도 **고른 항목은 그대로 둔다.**
    예전에는 여기서 비웠는데, 좋아요를 고른 뒤 별로예요를 보려고 누르는
    순간 앞서 고른 것이 사라져 두 방향을 함께 남길 방법이 없었다.

    갱신은 반드시 **이전 값을 받아서** 한다. 바깥의 `tags`를 읽어 새 배열을
    만들면, 한 번의 렌더 안에서 두 개를 잇달아 누를 때 둘 다 같은 옛 배열을
    보고 계산해 **먼저 고른 것이 사라진다.** (실제로 그렇게 빠졌다)
  */
  const handleToggleTag = (tag: string) =>
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((item) => item !== tag)
        : [...prev, tag],
    );

  /** 이번 평가가 점수를 얼마나 움직이는지. 목업 · 집계와 같은 함수를 쓴다. */
  const delta = calculateReputationDelta(tags, palette);

  /**
   * 항목을 하나도 안 고르면 저장하지 않는다.
   *
   * 남길 것은 좋아요/별로예요가 아니라 **왜 그렇게 봤는가**다.
   * 방향만 남은 평가는 나중에 다시 부를지 정할 때 아무 근거가 되지 못한다.
   */
  const hasTag = tags.length > 0;

  const handleSubmit = () => {
    if (!assignment || isRated || !hasTag) return;

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
      onSubmit={isRated || !hasTag ? undefined : handleSubmit}
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
              disabled={!hasTag}
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
            hint="아래 항목을 고르기 위한 버튼입니다. 두 쪽을 함께 고를 수 있습니다."
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

          {/*
            여기가 평가의 본문이다.
            방향(좋아요/별로예요)이 아니라 **어떤 항목을 골랐는가**가 남는다.
          */}
          <FormField
            label={palette === "GOOD" ? "이런 점이 좋았어요" : "이런 점이 아쉬웠어요"}
            required
            hint="한 개 이상 골라 주세요. 여러 개 고를 수 있습니다."
          >
            <div className="flex flex-wrap gap-1.5">
              {reputationTagsOf(palette).map(({ tag }) => (
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
            <span className="text-[13px] font-medium text-font-1">
              이번 평가
              <span className="ml-1.5 text-[12px] font-normal text-font-2">
                {hasTag ? `${tags.length}개 항목` : "항목을 고르지 않았습니다"}
              </span>
            </span>

            {hasTag ? (
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
                    <Close size={12} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-font-error">
                항목을 하나도 고르지 않으면 남길 수 없습니다. 좋아요 ·
                별로예요만으로는 나중에 이 평가를 설명할 수 없습니다.
              </p>
            )}
          </div>

          <FormField label="메모" hint="인력 상세의 평판 탭에 그대로 남습니다.">
            <Textarea
              rows={3}
              value={comment}
              onChange={(changeEvent) => setComment(changeEvent.target.value)}
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
