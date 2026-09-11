"use client";

import { useState } from "react";
import { useApplicationMutation } from "@/api/recruit/mutateApplication";
import { useJobRoleLabel } from "@/store/useOrgStore";
import type { AppError } from "@/type/api";
import {
  PARTICIPATION_LABEL,
  formatDateList,
  type Application,
} from "@/type/recruit";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Modal from "@/components/ui/Modal";
import DateChips from "@/components/domain/DateChips";

interface ApplicationAcceptModalProps {
  application: Application;
  onClose: () => void;
}

/**
 * 지원 확정 모달.
 *
 * 예전에는 확인창 하나였다. 확정이 "그 포지션의 모든 날"이었을 때는 그걸로 됐지만,
 * 이제는 **어느 날을 확정하는지**를 담당자가 정해야 한다.
 *
 * - 분할 지원: 신청한 날 중 **일부만** 확정할 수 있다. (둘째 날은 이미 찼다)
 * - 전일 지원: 신청한 날 전부다. 하루라도 겹치면 서버가 막고, 담당자가 '되는 날만 배치'를
 *   골라야 강행된다. 업체가 원한 것이 전 일정 가능자라서, 조용히 이틀만 넣으면 안 된다.
 *
 * 부르는 쪽이 `key`로 지원 번호를 넘겨 새로 그린다. 모달 안의 고른 날 · 에러는
 * 지원마다 새로 시작해야 한다. (effect로 되돌리지 않는다)
 */
const ApplicationAcceptModal = ({
  application,
  onClose,
}: ApplicationAcceptModalProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const { statusMutation } = useApplicationMutation();

  const requested = application.requestedDates;
  const isSplit = application.participation === "SPLIT" && requested.length > 1;
  const isFullMultiDay =
    application.participation === "FULL" && requested.length > 1;

  const [dates, setDates] = useState<string[]>(requested);
  const [allowPartial, setAllowPartial] = useState(false);
  const [serverError, setServerError] = useState<AppError | null>(null);

  const isFullConflict = serverError?.code === "FULL_SCHEDULE_CONFLICT";
  const confirmCount = isSplit ? dates.length : requested.length;

  const handleToggleDate = (date: string) => {
    setDates((prev) =>
      prev.includes(date)
        ? prev.filter((item) => item !== date)
        : [...prev, date].sort(),
    );
    setServerError(null);
  };

  const handleSubmit = () => {
    statusMutation.mutate(
      {
        applicationId: application.applicationId,
        status: "ACCEPTED",
        dates: isSplit ? dates : undefined,
        allowPartial: isFullMultiDay ? allowPartial : undefined,
      },
      {
        onSuccess: onClose,
        /* 겹침 · 서류 · 미등록은 서버가 말한 그대로 모달 안에 적는다. 닫으면 다시 열어 봐야 한다. */
        onError: (error) => setServerError(error),
      },
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="지원 확정"
      description={`${application.applicantName} · ${application.eventTitle}`}
      onSubmit={confirmCount > 0 ? handleSubmit : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={confirmCount === 0}
            isLoading={statusMutation.isPending}
          >
            {confirmCount}일 확정
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
          <dt className="text-font-2">포지션</dt>
          <dd className="text-font-1">
            {application.positionName || jobRoleLabel(application.role)}
          </dd>
          <dt className="text-font-2">참여 방식</dt>
          <dd className="text-font-1">{PARTICIPATION_LABEL[application.participation]}</dd>
          <dt className="text-font-2">신청한 날</dt>
          <dd className="text-font-1 tabular-nums">
            {requested.length}일 · {formatDateList(requested)}
          </dd>
        </dl>

        {isSplit && (
          <div className="flex flex-col gap-2 rounded-field border border-border-main bg-subtle px-4 py-3">
            <p className="text-[13px] font-medium text-font-1">
              확정할 날
              <span className="ml-1.5 text-[12px] font-normal text-font-2">
                신청한 날 중 일부만 확정할 수 있습니다
              </span>
            </p>
            <DateChips dates={requested} selected={dates} onToggle={handleToggleDate} />
            {dates.length === 0 ? (
              <p className="text-[12px] text-font-error">
                확정할 날을 하루 이상 골라 주세요.
              </p>
            ) : (
              dates.length < requested.length && (
                <p className="text-[12px] text-font-2">
                  본인 화면에는 &lsquo;{requested.length}일 신청 · {dates.length}일 확정&rsquo;으로
                  보입니다. 빠진 날은 연락해서 알려 주세요.
                </p>
              )
            )}
          </div>
        )}

        {isFullMultiDay && (
          <Alert tone="info" title={`전일 모집 지원입니다. ${requested.length}일 모두 배치합니다.`}>
            하루라도 다른 행사와 겹치면 확정되지 않습니다. 알고도 넣어야 하면 아래를
            골라 주세요 — 겹치는 날은 빼고 나머지 날만 배치됩니다.
            <div className="mt-2">
              <Checkbox
                label="겹치는 날이 있으면 되는 날만 배치"
                checked={allowPartial}
                onChange={(changeEvent) => {
                  setAllowPartial(changeEvent.target.checked);
                  setServerError(null);
                }}
              />
            </div>
          </Alert>
        )}

        {application.conflictEventTitle && !serverError && (
          <Alert tone="warning" title="일정이 겹칠 수 있습니다.">
            &lsquo;{application.conflictEventTitle}&rsquo;에 이미 확정된 날이 있습니다.
          </Alert>
        )}

        {serverError && (
          <Alert
            tone="danger"
            title={isFullConflict ? "전일 조건과 일정이 겹칩니다." : "확정하지 못했습니다."}
          >
            {serverError.message}
          </Alert>
        )}
      </div>
    </Modal>
  );
};

export default ApplicationAcceptModal;
