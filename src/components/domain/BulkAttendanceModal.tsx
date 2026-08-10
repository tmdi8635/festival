"use client";

import { useState } from "react";
import { useAssignmentMutation } from "@/api/event/mutateAssignment";
import { ATTENDANCE_OPTIONS } from "@/constants/staffOptions";
import { formatDate } from "@/lib/dayjs";
import { openConfirm } from "@/store/useConfirmStore";
import {
  calculateScheduledWorkHours,
  calculateWorkHoursFromTimes,
  guessDayOffset,
  type Assignment,
  type DayOffset,
  type EventDetail,
} from "@/type/event";
import { ATTENDANCE_STATUS_LABEL, type AttendanceStatus } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import TimeInput from "@/components/ui/TimeInput";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import DayOffsetField from "./DayOffsetField";

interface BulkAttendanceModalProps {
  isOpen: boolean;
  /** 선택된 배치. 사람 × 날짜 단위라 여러 날이 섞여 있을 수 있다. */
  assignments: Assignment[];
  event: EventDetail;
  onClose: () => void;
  onDone: () => void;
}

/**
 * 근태 일괄 기록.
 *
 * 행사가 끝나면 근태를 남겨야 하는데, 30명이 사흘 나온 행사는 배치가 90건이다.
 * 예전에는 근태 '결과'만 일괄로 찍을 수 있었다. 그런데 **지급액을 정하는 것은
 * 실제 출퇴근 시각**이라, 시각은 결국 90건을 하나씩 열어 넣어야 했다.
 * 그럴 바에는 아무도 시각을 넣지 않고, 정산은 영원히 예정 시간 기준의
 * 잠정 금액으로 남는다.
 *
 * 그래서 여기서 **근태 · 출퇴근 시각 · 휴게시간을 한 번에** 찍는다.
 * 현실에서 대부분의 인원은 같은 시간에 와서 같은 시간에 간다.
 * 예외 몇 건만 나중에 개별 근태에서 고치면 된다.
 *
 * 시각은 `HH:mm`으로 받아 **각 배치의 자기 근무일**에 붙는다.
 * 사흘짜리 행사에서 세 건이 전부 첫날로 기록되면 정산이 통째로 틀어진다.
 */
const BulkAttendanceModal = ({
  isOpen,
  assignments,
  event,
  onClose,
  onDone,
}: BulkAttendanceModalProps) => {
  const { bulkAttendanceMutation } = useAssignmentMutation();

  // 행사 예정 시간을 초기값으로 깔아 준다. 대부분은 예정대로 끝나므로 손댈 일이 없다.
  const [draft, setDraft] = useState<{
    attendance: AttendanceStatus;
    lateMinutes: string;
    shouldRecordTime: boolean;
    checkInTime: string;
    checkOutTime: string;
    checkOutDayOffset: DayOffset;
    breakMinutes: string;
  } | null>(null);

  const attendance = draft?.attendance ?? "PRESENT";
  const lateMinutes = draft?.lateMinutes ?? "0";
  const shouldRecordTime = draft?.shouldRecordTime ?? true;
  const checkInTime = draft?.checkInTime ?? event.startTime;
  const checkOutTime = draft?.checkOutTime ?? event.endTime;
  /*
    초기값은 행사에 적힌 종료 시점을 그대로 따른다.
    행사 자체가 D+1에 끝나는 철야 건이면 퇴근도 대개 D+1이다.
  */
  const checkOutDayOffset =
    draft?.checkOutDayOffset ??
    event.endDayOffset ??
    guessDayOffset(event.startTime, event.endTime);
  const breakMinutes = draft?.breakMinutes ?? String(event.breakMinutes);

  const patchDraft = (
    patch: Partial<{
      attendance: AttendanceStatus;
      lateMinutes: string;
      shouldRecordTime: boolean;
      checkInTime: string;
      checkOutTime: string;
      checkOutDayOffset: DayOffset;
      breakMinutes: string;
    }>,
  ) =>
    setDraft({
      attendance,
      lateMinutes,
      shouldRecordTime,
      checkInTime,
      checkOutTime,
      checkOutDayOffset,
      breakMinutes,
      ...patch,
    });

  const handleClose = () => {
    setDraft(null);
    onClose();
  };

  /*
    노쇼 · 결근은 나오지 않은 것이다. 출퇴근 시각이 있으면 안 되고,
    이미 적혀 있다면 지워야 정산에 근무시간이 잡히지 않는다.
  */
  const isAbsent = attendance === "NO_SHOW" || attendance === "ABSENT";
  const canRecordTime = !isAbsent;

  const nextWorkHours = calculateWorkHoursFromTimes(
    checkInTime,
    checkOutTime,
    Number(breakMinutes) || 0,
    checkOutDayOffset,
  );

  const scheduledWorkHours = calculateScheduledWorkHours(event);

  /** 선택된 건이 며칠에 걸쳐 있는지. 같은 시각이 여러 날에 각각 붙는다는 것을 보여 준다. */
  const dates = [...new Set(assignments.map((item) => item.workDate))].sort();
  const staffCount = new Set(assignments.map((item) => item.staffId)).size;

  const handleSubmit = () => {
    bulkAttendanceMutation.mutate(
      {
        assignments: assignments.map((item) => ({
          assignmentId: item.assignmentId,
          workDate: item.workDate,
        })),
        attendance,
        lateMinutes: attendance === "LATE" ? Number(lateMinutes) || 0 : 0,
        checkInTime:
          canRecordTime && shouldRecordTime ? checkInTime : undefined,
        checkOutTime:
          canRecordTime && shouldRecordTime ? checkOutTime : undefined,
        checkOutDayOffset,
        actualBreakMinutes:
          canRecordTime && shouldRecordTime
            ? Number(breakMinutes) || 0
            : undefined,
        // 결근 처리하면 이미 적힌 출퇴근을 지워야 지급 대상에서 빠진다.
        shouldClearCheckTime: isAbsent,
      },
      {
        onSuccess: () => {
          setDraft(null);
          onDone();
        },
      },
    );
  };

  /*
    한 번에 여러 건을 덮어쓰는 자리라 확인을 한 번 더 받는다.

    잘못 고른 채로 90건을 덮어쓰면 원래 값이 무엇이었는지 알 방법이 없다.
    다시 찍으면 되는 것이 아니라 **무엇이 지워졌는지를 모르게 되는 것**이라
    되돌릴 수 없다. 몇 명에게 무엇이 찍히는지를 눈으로 한 번 더 읽게 한다.
  */
  const confirmSubmit = () =>
    openConfirm({
      title: "선택한 근태를 한 번에 기록합니다",
      description: `${staffCount}명 · ${dates.length}일 · ${assignments.length}건에 '${ATTENDANCE_STATUS_LABEL[attendance]}'을(를) 기록합니다.`,
      warning: "이미 기록된 건은 덮어쓰며, 이전 값은 남지 않습니다.",
      confirmText: `${assignments.length}건 기록`,
      tone: isAbsent ? "danger" : "default",
      onConfirm: handleSubmit,
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="근태 일괄 기록"
      description={`${assignments.length}건 · ${staffCount}명 · ${dates.length}일`}
      onSubmit={assignments.length === 0 ? undefined : confirmSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant={isAbsent ? "danger" : "primary"}
            onClick={confirmSubmit}
            disabled={assignments.length === 0}
            isLoading={bulkAttendanceMutation.isPending}
          >
            {assignments.length}건 기록
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 무엇에 찍는지 먼저 보여 준다. 잘못 고른 채로 90건을 덮어쓰면 되돌리기 어렵다. */}
        <div className="rounded-field border border-border-main bg-subtle px-4 py-3">
          <p className="text-[13px] text-font-1">
            선택한 <b>{assignments.length}건</b>에 같은 값을 기록합니다.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {dates.map((date) => (
              <span
                key={date}
                className="rounded-[5px] bg-surface px-2 py-0.5 text-[11px] text-font-2 tabular-nums"
              >
                {formatDate(date)}{" "}
                {assignments.filter((item) => item.workDate === date).length}건
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="근태" required>
            <Select
              options={ATTENDANCE_OPTIONS}
              value={attendance}
              onChange={(changeEvent) =>
                patchDraft({
                  attendance: changeEvent.target.value as AttendanceStatus,
                })
              }
            />
          </FormField>

          {attendance === "LATE" && (
            <FormField label="지각" hint="분 단위로 공제 계산에 쓰입니다.">
              <Input
                type="number"
                min={0}
                step={10}
                value={lateMinutes}
                onChange={(changeEvent) =>
                  patchDraft({ lateMinutes: changeEvent.target.value })
                }
                rightSlot={<span className="text-[13px] text-font-2">분</span>}
              />
            </FormField>
          )}
        </div>

        {isAbsent ? (
          <Alert
            tone="warning"
            title={`'${ATTENDANCE_STATUS_LABEL[attendance]}'은 지급 대상에서 빠집니다.`}
          >
            이미 기록된 출퇴근 시각이 있다면 함께 지웁니다. 그래야 정산에
            근무시간이 잡히지 않습니다. 노쇼는 인력의 누적 기록에 남아
            블랙리스트 판정 근거가 되니, 정말 해당하는 건만 골랐는지 확인해
            주세요.
          </Alert>
        ) : (
          <div className="flex flex-col gap-3 rounded-field border border-border-main px-4 py-3">
            {/*
              실제 출퇴근을 함께 찍는 것이 이 화면의 핵심이다.
              끄면 예전처럼 근태 결과만 남고, 정산은 예정 시간 기준의 잠정 금액이 된다.
            */}
            <Checkbox
              label="실제 출퇴근 시각도 함께 기록"
              checked={shouldRecordTime}
              onChange={(changeEvent) =>
                patchDraft({ shouldRecordTime: changeEvent.target.checked })
              }
            />

            {shouldRecordTime ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="출근">
                    <TimeInput
                      value={checkInTime}
                      onChange={(nextTime) =>
                        patchDraft({ checkInTime: nextTime })
                      }
                    />
                  </FormField>

                  <FormField
                    label="퇴근"
                    hint={
                      checkOutDayOffset > 0
                        ? `+${checkOutDayOffset}일 시각`
                        : undefined
                    }
                  >
                    <TimeInput
                      value={checkOutTime}
                      onChange={(nextTime) =>
                        patchDraft({
                          checkOutTime: nextTime,
                          // 시각을 새로 고르면 날짜 넘김을 다시 추측해 깔아 준다.
                          checkOutDayOffset: guessDayOffset(
                            checkInTime,
                            nextTime,
                          ),
                        })
                      }
                    />
                  </FormField>

                  {/* 출퇴근 사이에 포함된 시간이다. 09~18시에 60분이면 실근무 8시간. */}
                  <FormField label="휴게시간" hint="출퇴근 시간 안에 포함">
                    <Input
                      type="number"
                      min={0}
                      max={240}
                      step={10}
                      value={breakMinutes}
                      onChange={(changeEvent) =>
                        patchDraft({ breakMinutes: changeEvent.target.value })
                      }
                      rightSlot={
                        <span className="text-[13px] text-font-2">분</span>
                      }
                    />
                  </FormField>
                </div>

                {/*
                  며칠 뒤에 퇴근했는지는 반드시 사람이 정한다.
                  새벽에 끝나는 현장이 흔한데, 시각만으로는 "당일 23시"와
                  "다음 날 03시"를, 나아가 24시간을 넘기는 근무를 구분할 수 없다.
                */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[13px] font-medium text-font-1">
                    퇴근 시점
                  </span>
                  <DayOffsetField
                    value={checkOutDayOffset}
                    onChange={(next) =>
                      patchDraft({ checkOutDayOffset: next })
                    }
                    baseLabel="각 근무일"
                  />
                </div>

                {/*
                  설명과 결과 시간을 좌우로 나란히 두면, 설명이 두 줄로 접히면서
                  오른쪽 시간이 "하루 / 32 / 시간" 세 줄로 쪼개진다.
                  결과 숫자는 이 화면에서 제일 크게 읽혀야 하는 값이라
                  설명 아래로 내리고 오른쪽에 한 줄로 붙인다.
                */}
                <div className="flex flex-col gap-2 border-t border-border-main pt-3">
                  <span className="text-[13px] text-font-2">
                    이 시각은 선택한 <b>{dates.length}개 근무일에 각각</b>{" "}
                    기록됩니다.
                    {checkOutDayOffset > 0 &&
                      ` 퇴근은 각 근무일의 +${checkOutDayOffset}일입니다.`}
                  </span>

                  <span className="flex flex-wrap items-center justify-end gap-2">
                    {nextWorkHours !== undefined &&
                      nextWorkHours !== scheduledWorkHours && (
                        <Badge
                          tone={
                            nextWorkHours > scheduledWorkHours
                              ? "info"
                              : "warning"
                          }
                        >
                          예정 {scheduledWorkHours}h 대비{" "}
                          {nextWorkHours > scheduledWorkHours ? "+" : ""}
                          {Math.round(
                            (nextWorkHours - scheduledWorkHours) * 10,
                          ) / 10}
                          h
                        </Badge>
                      )}
                    <span className="text-[15px] font-semibold whitespace-nowrap text-font-0 tabular-nums">
                      하루 {nextWorkHours ?? 0}시간
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-font-2">
                근태 결과만 남깁니다. 실제 출퇴근이 비어 있는 건은 정산이 행사
                예정 시간으로 잠정 계산되고, 지급 전에 결국 다시 채워야 합니다.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkAttendanceModal;
