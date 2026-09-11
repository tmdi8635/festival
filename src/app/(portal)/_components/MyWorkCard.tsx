"use client";

import { toDateKey, toTimeInput } from "@/type/event";
import { MY_WORK_STAGE_TONE } from "@/constants/staffOptions";
import { useState } from "react";
import { Warning } from "@/icons";
import { formatDate, formatDateTime, formatDday } from "@/lib/dayjs";
import { cn, formatCurrency } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  MY_WORK_STAGE_LABEL,
  MY_WORK_STEPS,
  isClosedWork,
  resolveMyWorkStep,
  type MyWork,
} from "@/type/my";
import { resolveAttendancePenalty } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CancelWorkSheet from "./CancelWorkSheet";
import CheckTimeModal from "./CheckTimeModal";
import WorkInfoList from "./WorkInfoList";

interface MyWorkCardProps {
  work: MyWork;
}

/**
 * 내 근무 한 건.
 *
 * 현장으로 가는 길에 폰으로 열어 보는 화면이라, **여기서 답이 끝나야 한다.**
 * 몇 시에 어디로 가는지, 얼마를 받는지, 무엇을 입고 무엇을 챙기는지, 못 찾으면
 * 누구에게 거는지가 한 장에 다 있어야 한다. 종료된 근무도 같은 줄을 세운다 —
 * 지난 근무를 다시 여는 이유는 대부분 "그날 얼마 받기로 했더라"다.
 *
 * 그리고 **지금 어디까지 왔는지**(확정 → 근무 → 정산 → 지급)를 함께 보여 준다.
 * 근무를 마친 사람이 가장 많이 묻는 것이 "돈 언제 들어와요"다.
 */
const MyWorkCard = ({ work }: MyWorkCardProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const [checkSide, setCheckSide] = useState<"IN" | "OUT" | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const isClosed = isClosedWork(work);
  const isUpcoming =
    work.stage === "CONFIRMED" && work.workDate >= toDateKey(new Date());
  const step = resolveMyWorkStep(work.stage);

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-[15px] font-semibold",
                isClosed ? "text-font-2" : "text-font-0",
              )}
            >
              {work.eventTitle}
            </p>
            {/*
              직무가 아니라 **포지션**을 적는다. 같은 행사에 스태프가 A타임 · B타임으로
              갈려 서는데, '스태프'만 적으면 몇 시 조인지 알 수 없다.
            */}
            <p className="mt-0.5 truncate text-[13px] text-font-2">
              {work.clientName} · {work.positionName || jobRoleLabel(work.role)}
            </p>
          </div>

          {/*
            다가오는 근무는 D-day가 단계보다 급하다. '근무 확정'은 진행 표시가 이미 말한다.
          */}
          {isUpcoming ? (
            <Badge tone="brand">{formatDday(work.workDate)}</Badge>
          ) : (
            <Badge tone={MY_WORK_STAGE_TONE[work.stage]}>
              {MY_WORK_STAGE_LABEL[work.stage]}
            </Badge>
          )}
        </div>

        {step >= 0 && <StageProgress step={step} />}

        {isClosed && <ClosedNotice work={work} />}

        <div className="border-t border-border-main pt-3">
          <WorkInfoList info={work} dateLabel={formatDate(work.workDate)} />
        </div>

        {/*
          하루 지급액. 시간은 적지 않는다 — 시각 · 휴게가 위에 있고,
          작은 글씨로 `4.0시간`만 따로 떨어져 있으면 무엇의 시간인지 읽히지 않는다.
        */}
        <div className="flex items-center justify-between gap-2 border-t border-border-main pt-3">
          <span className="text-[13px] text-font-2">
            {work.stage === "PAID" ? "지급액" : "이날 지급액"}
            <span className="ml-1 text-[12px] text-font-disabled">세전</span>
          </span>
          <span
            className={cn(
              "text-[15px] font-semibold tabular-nums",
              isClosed ? "text-font-disabled line-through" : "text-font-0",
            )}
          >
            {formatCurrency(work.payAmount)}
          </span>
        </div>

        {/*
          출퇴근.

          찍은 시각은 버튼이 사라진 뒤에도 남아야 한다. 눌렀는지 안 눌렀는지를
          기억에 맡기면 현장에서 한 번 더 누르러 들어온다.
        */}
        {(work.checkInAt || work.checkOutAt) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field bg-subtle px-3 py-2 text-[13px] tabular-nums">
            <span className="text-font-1">
              <span className="text-font-2">출근 </span>
              {toTimeInput(work.checkInAt) || "-"}
            </span>
            <span className="text-font-1">
              <span className="text-font-2">퇴근 </span>
              {toTimeInput(work.checkOutAt) || "-"}
            </span>
            {work.lateMinutes > 0 && (
              <span className="text-warning">지각 {work.lateMinutes}분</span>
            )}
          </div>
        )}

        {(work.canCheckIn || work.canCheckOut) && (
          <Button
            fullWidth
            variant="primary"
            onClick={() => setCheckSide(work.canCheckIn ? "IN" : "OUT")}
          >
            {work.canCheckIn ? "출근하기" : "퇴근하기"}
          </Button>
        )}

        {/*
          못 찍는 이유를 버튼 자리에 그대로 적는다.
          버튼만 사라지면 본인은 고장인 줄 알고 담당자에게 전화한다.
          취소 · 노쇼한 근무는 이유를 위의 기록 상자가 이미 말한다.
        */}
        {!isClosed &&
          !work.canCheckIn &&
          !work.canCheckOut &&
          work.checkBlockReason && (
            <p className="flex items-start gap-1.5 text-[12px] text-font-2">
              <Warning size={13} className="mt-0.5 shrink-0" />
              {work.checkBlockReason}
            </p>
          )}

        {/*
          취소는 출근 버튼보다 **작게** 둔다. 현장 가는 길에 여는 카드에서
          가장 큰 버튼이 취소면 잘못 누른다. 대신 누르면 어떻게 되는지는 옆에 늘 적어 둔다.
        */}
        {work.canCancel && (
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "min-w-0 text-[12px]",
                work.isLateCancel ? "text-danger" : "text-font-2",
              )}
            >
              {work.isLateCancel
                ? "지금 취소하면 노쇼로 처리돼요"
                : `${formatDateTime(work.cancelDeadline)}까지 불이익 없이 취소`}
            </span>
            <Button
              size="sm"
              variant="dangerGhost"
              className="shrink-0"
              onClick={() => setIsCancelOpen(true)}
            >
              근무 취소
            </Button>
          </div>
        )}
      </div>

      {checkSide && (
        <CheckTimeModal
          work={work}
          side={checkSide}
          onClose={() => setCheckSide(null)}
        />
      )}

      {isCancelOpen && (
        <CancelWorkSheet work={work} onClose={() => setIsCancelOpen(false)} />
      )}
    </Card>
  );
};

/**
 * 확정 · 근무 · 정산 · 지급 네 칸.
 *
 * 단계 이름 하나만 적어 두면 '정산대기'가 끝에서 몇 번째인지 모른다.
 * 칸으로 보여야 "이제 하나 남았다"가 읽힌다.
 */
const StageProgress = ({ step }: { step: number }) => (
  <ol className="grid grid-cols-4 gap-1" aria-label="근무 진행 단계">
    {MY_WORK_STEPS.map((label, index) => (
      <li
        key={label}
        className="flex flex-col gap-1"
        aria-current={index === step ? "step" : undefined}
      >
        <span
          className={cn(
            "h-1 rounded-full",
            index <= step ? "bg-brand" : "bg-subtle",
          )}
        />
        <span
          className={cn(
            "text-[11px]",
            index === step
              ? "font-semibold text-brand"
              : index < step
                ? "text-font-2"
                : "text-font-disabled",
          )}
        >
          {label}
        </span>
      </li>
    ))}
  </ol>
);

/**
 * 취소 · 노쇼 · 결근 기록.
 *
 * **점수가 왜 깎였는지를 본인이 여기서 확인한다.** 건별 평가는 본인에게 내리지 않지만
 * (`MyProfile.reputationScore` 주석) 노쇼 감점은 본인이 한 일에서 나온 것이라
 * 누가 남겼는지가 드러날 걱정이 없고, 알려야 다음에 반복하지 않는다.
 */
const ClosedNotice = ({ work }: { work: MyWork }) => {
  const penalty = resolveAttendancePenalty(work);

  const title =
    work.stage === "CANCELED"
      ? "본인 취소 · 불이익 없음"
      : work.stage === "ABSENT"
        ? "결근으로 기록된 근무입니다"
        : penalty?.type === "LATE_CANCEL"
          ? `24시간 이내 취소로 노쇼 처리 · 평판 ${penalty.points}점`
          : `노쇼로 기록된 근무입니다 · 평판 ${penalty?.points ?? 0}점`;

  return (
    <div
      className={cn(
        "rounded-field px-3 py-2.5 text-[13px]",
        work.stage === "CANCELED"
          ? "bg-subtle text-font-1"
          : "bg-danger-bg text-danger",
      )}
    >
      <p className="font-medium">{title}</p>
      {work.staffCanceledAt && (
        <p className="mt-1 text-[12px] text-font-2 tabular-nums">
          {formatDateTime(work.staffCanceledAt)} 취소
          {work.staffCancelReason && ` · ${work.staffCancelReason}`}
        </p>
      )}
      {!work.staffCanceledAt && work.stage !== "CANCELED" && (
        <p className="mt-1 text-[12px] text-font-2">
          사정이 있었다면 담당자에게 연락해 주세요.
        </p>
      )}
    </div>
  );
};

export default MyWorkCard;
