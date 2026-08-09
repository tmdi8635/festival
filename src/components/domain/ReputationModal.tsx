"use client";

import { useState } from "react";
import { useAssignmentMutation } from "@/api/event/mutateAssignment";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/type/event";
import {
  REPUTATION_TAGS,
  REPUTATION_VERDICT_LABEL,
  type ReputationVerdict,
} from "@/type/staff";
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
 * 별점 5단계를 걷어냈다. 남기는 사람마다 기준이 달라서 —
 * 누구의 3점은 다른 사람의 4점이다 — 모아 놓으면 평균만 남고 뜻이 사라진다.
 * 현장에서 실제로 내리는 판단은 **"또 부를 것인가"** 하나이고,
 * 그건 누가 눌러도 같은 뜻이다.
 *
 * 그래서 좋아요 · 별로예요 둘로 받고, 왜 그렇게 봤는지는
 * **고르기만 하면 되는 항목**으로 남긴다. 코멘트만 받으면 대부분 비워 두고,
 * 비워 둔 평가는 나중에 아무것도 설명하지 못한다.
 *
 * 평가 주체를 함께 남기는 것이 중요하다. 나중에 **스태프 상호평가**를 열면
 * 에이전시가 보는 모습과 같이 일한 사람이 겪는 모습을 나란히 볼 수 있어야 한다.
 * 관리자 눈에는 일 잘하는 사람인데 옆 사람에게는 매우 불쾌한 경험을 주는 일이
 * 실제로 자주 있고, 지금 구조에서는 그게 아예 드러나지 않는다.
 */
const ReputationModal = ({ assignment, onClose }: ReputationModalProps) => {
  // 열기 전에는 서버 값을 그대로 쓰고, 손대기 시작하면 draft가 화면을 담당한다.
  const [draft, setDraft] = useState<{
    verdict: ReputationVerdict;
    tags: string[];
    comment: string;
  } | null>(null);

  const { reputationMutation } = useAssignmentMutation();

  const verdict = draft?.verdict ?? assignment?.reputationVerdict ?? "GOOD";
  const tags = draft?.tags ?? assignment?.reputationTags ?? [];
  const comment = draft?.comment ?? assignment?.reputationComment ?? "";

  const patch = (
    next: Partial<{
      verdict: ReputationVerdict;
      tags: string[];
      comment: string;
    }>,
  ) => setDraft({ verdict, tags, comment, ...next });

  const handleClose = () => {
    setDraft(null);
    onClose();
  };

  /** 좋아요에서 별로예요로 바꾸면 고른 항목은 뜻이 반대가 되므로 비운다. */
  const handleVerdict = (next: ReputationVerdict) =>
    patch({ verdict: next, tags: next === verdict ? tags : [] });

  const handleToggleTag = (tag: string) =>
    patch({
      tags: tags.includes(tag)
        ? tags.filter((item) => item !== tag)
        : [...tags, tag],
    });

  const handleSubmit = () => {
    if (!assignment) return;

    reputationMutation.mutate(
      {
        assignmentId: assignment.assignmentId,
        verdict,
        tags,
        comment: comment.trim() || undefined,
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Modal
      isOpen={Boolean(assignment)}
      onClose={handleClose}
      title="근무 평가"
      description={
        assignment
          ? `${assignment.staffName} · ${assignment.eventTitle}`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={reputationMutation.isPending}
          >
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="이 인력을 다시 부르시겠어요?"
          hint="평판 점수에 반영됩니다."
          required
        >
          <div className="grid grid-cols-2 gap-2">
            {(["GOOD", "BAD"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={verdict === option}
                onClick={() => handleVerdict(option)}
                className={cn(
                  "rounded-field border py-3 text-[15px] font-semibold transition active:scale-[0.98]",
                  verdict === option
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
          항목은 선택이다. 필수로 만들면 아무거나 눌러서 통계가 오염된다.
          다만 눌러 두면 "왜 별로였는지"가 코멘트 없이도 남는다.
        */}
        <FormField
          label={
            verdict === "GOOD" ? "이런 점이 좋았어요" : "이런 점이 아쉬웠어요"
          }
          hint="여러 개 고를 수 있습니다 (선택)"
        >
          <div className="flex flex-wrap gap-1.5">
            {REPUTATION_TAGS[verdict].map((tag) => (
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
      </div>
    </Modal>
  );
};

export default ReputationModal;
