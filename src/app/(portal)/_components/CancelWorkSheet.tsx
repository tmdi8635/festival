"use client";

import { useState } from "react";
import { useMyAttendanceMutation } from "@/api/my/mutateMyAttendance";
import { Warning } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { STAFF_CANCEL_DEADLINE_HOURS, toTimeInput } from "@/type/event";
import type { MyWork } from "@/type/my";
import { LATE_CANCEL_PENALTY } from "@/type/staff";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Textarea from "@/components/ui/Textarea";

interface CancelWorkSheetProps {
  work: MyWork;
  onClose: () => void;
}

/**
 * 근무 취소 시트.
 *
 * **누르기 전에 결과를 먼저 말한다.** 24시간 전이면 불이익이 없다는 것을,
 * 그 이후면 노쇼로 남고 점수가 얼마나 깎이는지를 버튼 바로 위에 적는다.
 * 누른 뒤에 알게 되면 되돌릴 방법이 없다.
 *
 * 사유는 필수다. 담당자는 이 한 줄을 보고 대타를 구할지, 일정을 옮겨 다시 부를지를 정한다.
 */
const CancelWorkSheet = ({ work, onClose }: CancelWorkSheetProps) => {
  const [reason, setReason] = useState("");
  const { cancelMutation } = useMyAttendanceMutation();

  const trimmed = reason.trim();
  const deadlineText = `${formatDate(work.cancelDeadline)} ${toTimeInput(work.cancelDeadline)}`;

  const handleSubmit = () => {
    if (!trimmed) return;

    cancelMutation.mutate(
      { assignmentId: work.assignmentId, reason: trimmed },
      { onSuccess: onClose },
    );
  };

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title="근무를 취소할까요?"
      description={`${work.eventTitle} · ${formatDate(work.workDate)}`}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button fullWidth onClick={onClose}>
            돌아가기
          </Button>
          <Button
            fullWidth
            variant={work.isLateCancel ? "danger" : "dangerSoft"}
            disabled={!trimmed}
            isLoading={cancelMutation.isPending}
            onClick={handleSubmit}
          >
            {work.isLateCancel ? "노쇼로 취소" : "근무 취소"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {work.isLateCancel ? (
          <div className="flex items-start gap-2 rounded-field bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
            <Warning size={16} className="mt-0.5 shrink-0" />
            <p>
              근무 시작 {STAFF_CANCEL_DEADLINE_HOURS}시간 이내라{" "}
              <strong>노쇼로 처리됩니다.</strong>
              <span className="mt-1 block text-font-1">
                평판 점수 {LATE_CANCEL_PENALTY}점 · 노쇼 1회가 기록되고,
                노쇼가 쌓이면 근무 배정이 제한될 수 있어요.
              </span>
            </p>
          </div>
        ) : (
          <div className="rounded-field bg-subtle px-3 py-2.5 text-[13px] text-font-1">
            <p>
              <span className="font-medium tabular-nums">{deadlineText}</span>
              까지는 불이익 없이 취소할 수 있어요.
            </p>
            <p className="mt-1 text-font-2">
              그 이후 취소는 노쇼로 처리되어 평판 점수가 깎입니다.
            </p>
          </div>
        )}

        <FormField label="취소 사유" htmlFor="cancel-reason" required>
          <Textarea
            id="cancel-reason"
            placeholder="예) 가족 일정이 생겨 참석이 어렵습니다."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={200}
          />
        </FormField>
      </div>
    </BottomSheet>
  );
};

export default CancelWorkSheet;
