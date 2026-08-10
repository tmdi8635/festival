"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useStaffMutation } from "@/api/staff/mutateStaff";
import { blacklistSchema, type BlacklistSchema } from "@/schema/staff.schema";
import { calculateReputationScore, type StaffDetail } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";

interface BlacklistModalProps {
  staff: StaffDetail | null;
  onClose: () => void;
}

/**
 * 블랙리스트 지정 모달.
 *
 * 기존에는 "대표 마음에 안 들면 잘린다"에 가까웠다.
 * 사유를 반드시 남기게 해서 판단 근거를 기록으로 만든다.
 * 지정된 인력은 배치 후보에서 자동으로 빠진다.
 */
const BlacklistModal = ({ staff, onClose }: BlacklistModalProps) => {
  const { statusMutation } = useStaffMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BlacklistSchema>({
    resolver: zodResolver(blacklistSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (staff) reset({ reason: "" });
  }, [staff, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!staff) return;

    statusMutation.mutate(
      {
        staffId: staff.staffId,
        body: { status: "BLACKLIST", reason: values.reason },
      },
      { onSuccess: onClose },
    );
  });

  return (
    <Modal
      isOpen={Boolean(staff)}
      onClose={onClose}
      title="블랙리스트 지정"
      description={staff ? `${staff.name}님을 배치 대상에서 제외합니다.` : undefined}
      closeOnOverlayClick={false}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="danger" onClick={onSubmit} isLoading={isSubmitting}>
            블랙리스트 지정
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Alert tone="warning" title="사유는 기록으로 남습니다.">
          지정 이후 이 인력은 배치 후보와 공고 확정 대상에서 자동으로 빠집니다.
          해제는 언제든 가능하며, 이력은 메모로 남겨 두세요.
        </Alert>

        {staff && staff.noShowCount > 0 && (
          <div className="rounded-field border border-border-main bg-subtle px-4 py-3 text-[13px] text-font-2">
            누적 기록: 노쇼 {staff.noShowCount}회 · 지각 {staff.lateCount}회 ·
            평판{" "}
            {calculateReputationScore(
              staff.goodCount,
              staff.badCount,
            ).toFixed(1)}{" "}
            (좋아요 {staff.goodCount} · 별로 {staff.badCount}) ·
            누적 근무 {staff.workCount}회
          </div>
        )}

        <FormField label="지정 사유" required error={errors.reason?.message}>
          <Textarea
            {...register("reason")}
            rows={4}
            placeholder="예) 행사 당일 무단 불참 2회. 거래처 항의 접수."
            hasError={Boolean(errors.reason)}
          />
        </FormField>
      </form>
    </Modal>
  );
};

export default BlacklistModal;
