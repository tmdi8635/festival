"use client";

import { useState } from "react";
import { useAssignmentMutation } from "@/api/event/mutateAssignment";
import { useEventDetailQuery } from "@/api/event/getEventDetail";
import { BREAK_MINUTE_OPTIONS } from "@/constants/eventOptions";
import { ATTENDANCE_OPTIONS } from "@/constants/staffOptions";
import { formatDate } from "@/lib/dayjs";
import {
  calculateScheduledWorkHours,
  calculateWorkHoursFromTimes,
  formatTimeRange,
  guessDayOffset,
  resolveCheckOutDayOffset,
  toCheckDateTime,
  toTimeInput,
  type Assignment,
  type DayOffset,
} from "@/type/event";
import type { AttendanceStatus } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import TimeInput from "@/components/ui/TimeInput";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import DayOffsetField from "./DayOffsetField";

interface AttendanceModalProps {
  assignment: Assignment | null;
  onClose: () => void;
}

/**
 * 근태 기록 모달.
 *
 * 두 가지를 함께 남긴다.
 *
 * 1) **근태 결과** — 나왔는지 안 나왔는지다. 노쇼가 쌓여야 블랙리스트 판정이
 *    근거를 갖는다.
 * 2) **실제 출퇴근 시각** — 행사에 적힌 시간은 공지용 예정 시각일 뿐이다.
 *    현장에서는 조기 철수와 연장 근무가 수시로 생기고, 그 차이가 그대로 지급액 차이가 된다.
 *    실제 시각을 남기면 정산이 예정 시간이 아니라 **일한 만큼**으로 계산된다.
 *
 * ## '지각'은 상태로 받지 않는다
 *
 * 늦게 온 사실은 **출근 시각이 이미 말한다.** 10:20으로 적으면 근무시간이
 * 그만큼 줄고 정산 금액도 저절로 맞는다. 여기에 '지각 20분'을 따로 받으면
 * 같은 사실을 두 번 적는 것이 되고, 둘이 어긋난 건이 실제로 쌓였다.
 * (시각은 10:20인데 지각 0분, 또는 그 반대)
 */
const AttendanceModal = ({ assignment, onClose }: AttendanceModalProps) => {
  const { attendanceMutation } = useAssignmentMutation();

  // 행사 예정 시간을 초기값으로 깔아 준다. 대부분은 예정대로 끝나므로 손댈 일이 없다.
  const { data: event } = useEventDetailQuery(assignment?.eventId ?? null);

  /*
    편집 전에는 서버 값(또는 행사 예정값)을 그대로 쓰고,
    입력이 시작되면 draft가 화면을 담당한다.
  */
  const [draft, setDraft] = useState<{
    attendance: AttendanceStatus;
    checkInTime: string;
    checkOutTime: string;
    checkOutDayOffset: DayOffset;
    breakMinutes: string;
  } | null>(null);

  const attendance = draft?.attendance ?? assignment?.attendance ?? "PRESENT";
  /*
    출퇴근은 **반드시 받는다.**

    예전에는 비워 두면 행사 예정 시간으로 정산했다. 그런데 그건 "예정대로
    끝났다"가 아니라 "아직 아무도 확인하지 않았다"였고, 두 가지가 화면에서
    똑같이 보였다. 그 상태로 정산이 넘어가면 실제로 두 시간 일찍 보낸 날도
    여덟 시간으로 나간다. 발주 시각을 **placeholder로 깔아** 그대로면
    한 번 눌러 확정하게 하고, 빈 채로는 저장하지 않는다.
  */
  const checkInTime =
    draft?.checkInTime ?? toTimeInput(assignment?.checkInAt) ?? "";
  const checkOutTime =
    draft?.checkOutTime ?? toTimeInput(assignment?.checkOutAt) ?? "";
  const breakMinutes =
    draft?.breakMinutes ??
    String(assignment?.actualBreakMinutes ?? event?.breakMinutes ?? 0);

  /*
    이미 기록된 건이면 저장된 퇴근 일시가 근무일로부터 며칠 뒤인지 되짚는다.
    기록이 없으면 시각만 보고 추측한 값을 초기값으로 깔아 주고,
    최종 결정은 사람이 D+1 · D+2 버튼으로 한다.
  */
  const checkOutDayOffset =
    draft?.checkOutDayOffset ??
    resolveCheckOutDayOffset(
      assignment?.workDate ?? "",
      assignment?.checkOutAt,
    ) ??
    guessDayOffset(checkInTime, checkOutTime);

  const patch = (
    next: Partial<{
      attendance: AttendanceStatus;
      checkInTime: string;
      checkOutTime: string;
      checkOutDayOffset: DayOffset;
      breakMinutes: string;
    }>,
  ) =>
    setDraft({
      attendance,
      checkInTime,
      checkOutTime,
      checkOutDayOffset,
      breakMinutes,
      ...next,
    });

  const handleClose = () => {
    setDraft(null);
    onClose();
  };

  /** 노쇼·결근은 나오지 않은 것이므로 출퇴근을 받지 않는다. */
  const isNoWork = attendance === "NO_SHOW" || attendance === "ABSENT";

  const scheduledHours = event ? calculateScheduledWorkHours(event) : 0;

  const hasCheckTime = Boolean(checkInTime && checkOutTime);

  const actualHours =
    isNoWork || !hasCheckTime
      ? undefined
      : calculateWorkHoursFromTimes(
          checkInTime,
          checkOutTime,
          Number(breakMinutes) || 0,
          checkOutDayOffset,
        );

  /** 나온 날인데 출퇴근이 비어 있으면 저장하지 않는다. */
  const isMissingCheckTime = !isNoWork && !hasCheckTime;

  const handleSubmit = () => {
    if (!assignment || isMissingCheckTime) return;

    attendanceMutation.mutate(
      {
        assignmentId: assignment.assignmentId,
        attendance,
        /*
          지각은 더 이상 상태로 받지 않는다. 늦게 온 사실은 출근 시각에
          그대로 남고, 그 시각이 근무시간과 금액을 정한다.
          예전 기록에 남아 있는 분수는 저장할 때마다 0으로 정리된다.
        */
        lateMinutes: 0,
        // 나오지 않은 날은 출퇴근 기록을 지운다. 남겨 두면 정산에 시간이 잡힌다.
        checkInAt: isNoWork
          ? null
          : (toCheckDateTime(assignment.workDate, checkInTime) ?? null),
        // 며칠 뒤 퇴근인지는 사람이 고른 값으로만 정한다. 시각만 보고 추측하지 않는다.
        checkOutAt: isNoWork
          ? null
          : (toCheckDateTime(
              assignment.workDate,
              checkOutTime,
              checkOutDayOffset,
            ) ?? null),
        actualBreakMinutes: isNoWork ? null : Number(breakMinutes) || 0,
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Modal
      isOpen={Boolean(assignment)}
      onClose={handleClose}
      title="근태 · 출퇴근 기록"
      description={
        assignment
          ? `${assignment.staffName} · ${assignment.eventTitle} · ${formatDate(assignment.workDate)}`
          : undefined
      }
      onSubmit={isMissingCheckTime ? undefined : handleSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isMissingCheckTime}
            isLoading={attendanceMutation.isPending}
          >
            기록
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {isNoWork && (
          <Alert tone="danger" title="누적 기록에 반영됩니다.">
            노쇼 · 결근은 인력의 누적 기록에 남아 블랙리스트 판정 근거가 되고,
            해당 일자는 정산 대상에서 빠집니다.
          </Alert>
        )}

        <FormField label="근태 결과" required>
          <Select
            options={ATTENDANCE_OPTIONS}
            value={attendance}
            onChange={(changeEvent) =>
              patch({ attendance: changeEvent.target.value as AttendanceStatus })
            }
          />
        </FormField>

        {/*
          실제 출퇴근.
          행사에 적힌 시간은 공지용이고, 지급은 여기 적힌 시간으로 계산된다.
        */}
        {!isNoWork && (
          <div className="flex flex-col gap-3 rounded-field border border-border-main p-4">
            <div>
              <p className="text-[14px] font-semibold text-font-1">
                실제 출퇴근
              </p>
              <p className="mt-0.5 text-[12px] text-font-2">
                옅게 적힌{" "}
                {event
                  ? formatTimeRange(
                      event.startTime,
                      event.endTime,
                      event.endDayOffset,
                    )
                  : "-"}
                는 발주 시각입니다. 현장에서 실제로 오고 간 시각을 적어 주세요.
                정산이 그 시간으로 계산됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/*
                발주 시각을 placeholder로 깔아 둔다.

                값으로 채워 넣지 않는 이유는, 그 순간 "확인한 시각"과
                "아직 아무도 안 본 시각"이 화면에서 똑같아지기 때문이다.
                옅게 보여 주고 사람이 확정하게 한다.
              */}
              <FormField label="출근" required>
                <TimeInput
                  value={checkInTime}
                  placeholder={event?.startTime}
                  hasError={!checkInTime}
                  onChange={(nextTime) => patch({ checkInTime: nextTime })}
                />
              </FormField>

              <FormField
                label="퇴근"
                required
                hint={
                  checkOutDayOffset > 0
                    ? `+${checkOutDayOffset}일 시각`
                    : undefined
                }
              >
                <TimeInput
                  value={checkOutTime}
                  placeholder={event?.endTime}
                  hasError={!checkOutTime}
                  onChange={(nextTime) =>
                    patch({
                      checkOutTime: nextTime,
                      /*
                        시각을 새로 고르면 날짜 넘김을 다시 추측해 깔아 준다.
                        사람이 버튼을 직접 만진 뒤에는 그 뜻을 존중해야 하지만,
                        시각 자체가 바뀌면 이야기가 달라진다.
                      */
                      checkOutDayOffset: guessDayOffset(checkInTime, nextTime),
                    })
                  }
                />
              </FormField>

              {/*
                출퇴근 사이에 **포함된** 시간이다.
                09~18시에 60분이면 실근무 8시간이다. (9시간 + 휴게가 아니다)

                숫자를 자유롭게 받지 않는다. 현장에서 휴게는 전원에게 같은 양을
                주고 교대로 쓰게 하는 값이라 30분 단위면 충분하고, 열어 두면
                `45`처럼 근거 없는 숫자가 그 건에만 남는다.
              */}
              <FormField label="휴게시간">
                <Select
                  options={BREAK_MINUTE_OPTIONS}
                  value={breakMinutes}
                  onChange={(changeEvent) =>
                    patch({ breakMinutes: changeEvent.target.value })
                  }
                />
              </FormField>
            </div>

            {/*
              며칠 뒤에 퇴근했는지는 반드시 사람이 정한다.

              시각만으로는 알 수 없다. 13시 출근 → 다음 날 03시 퇴근인 철야 현장이
              실제로 있고, 그런 날의 '03:00'을 같은 날로 읽으면 근무시간이 음수가 된다.
              반대로 13시 출근 → 다음 날 14시 퇴근처럼 24시간을 넘기는 근무는
              추측 규칙으로는 아예 표현되지 않는다.
            */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-medium text-font-1">
                퇴근 시점
              </span>
              <DayOffsetField
                value={checkOutDayOffset}
                onChange={(next) => patch({ checkOutDayOffset: next })}
                baseLabel={
                  assignment ? formatDate(assignment.workDate) : undefined
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-field bg-subtle px-3 py-2.5">
              <span className="text-[13px] text-font-2">
                정산 기준 근무시간
              </span>

              {actualHours === undefined ? (
                <span className="text-[13px] text-font-2">
                  출퇴근을 적으면 계산됩니다.
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Badge tone="info">실제 기록</Badge>
                  <span className="text-[15px] font-semibold text-font-0 tabular-nums">
                    {actualHours}시간
                  </span>
                  {/* 예정과 얼마나 차이 나는지 함께 보여 줘야 이상값을 잡아낸다. */}
                  {actualHours !== scheduledHours && (
                    <span
                      className={
                        actualHours > scheduledHours
                          ? "text-[12px] text-success tabular-nums"
                          : "text-[12px] text-danger tabular-nums"
                      }
                    >
                      예정 대비 {actualHours > scheduledHours ? "+" : ""}
                      {Math.round((actualHours - scheduledHours) * 10) / 10}시간
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AttendanceModal;
