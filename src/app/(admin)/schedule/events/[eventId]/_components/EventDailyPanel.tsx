"use client";

import { useState } from "react";
import { useAssignmentMutation } from "@/api/event/mutateAssignment";
import {
  ASSIGNMENT_STATUS_TONE,
  FILL_STATE_BADGE_TONE,
  FILL_STATE_CHIP_CLASS,
  FILL_STATE_TEXT_CLASS,
} from "@/constants/eventOptions";
import { ChevronDown, Plus, Sliders, Trash } from "@/icons";
import {
  ASSIGNMENT_CONTRACT_COLUMNS,
  ASSIGNMENT_WAGE_COLUMNS,
  ASSIGNMENT_WHO_COLUMNS,
} from "@/constants/csvColumns";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import {
  useJobRoleComparator,
  useJobRoleLabel,
} from "@/store/useOrgStore";
import {
  formatTimeRange,
  ASSIGNMENT_STATUS_LABEL,
  WEEKDAY_LABELS,
  resolveFillState,
  type Assignment,
  type EventDetail,
  type FillState,
  type EventDayPlan,
} from "@/type/event";
import { type JobRole } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import EmptyState from "@/components/ui/EmptyState";
import StaffCell from "@/components/domain/StaffCell";
import WageEditModal from "@/components/domain/WageEditModal";
import DayRoleEditModal from "./DayRoleEditModal";
import WageText from "@/components/domain/WageText";

/**
 * 현장에 그대로 들고 갈 수 있는 일별 근무자 명단.
 *
 * 이 화면의 관심사는 인력 배치이므로 근태 · 평가는 담지 않는다.
 * (그건 출퇴근 명부 탭이 사람 단위로 맡는다)
 */
const DAILY_CSV_COLUMNS: CsvColumn<Assignment>[] = [
  ...ASSIGNMENT_WHO_COLUMNS,
  { header: "배치 상태", value: (row) => ASSIGNMENT_STATUS_LABEL[row.status] },
  ...ASSIGNMENT_WAGE_COLUMNS,
  ...ASSIGNMENT_CONTRACT_COLUMNS,
];

/** 날짜 카드 왼쪽에 세우는 충원 상태 띠 */
const FILL_STATE_BAR_CLASS: Record<FillState, string> = {
  EMPTY: "bg-danger",
  PARTIAL: "bg-warning",
  FULL: "bg-success",
  OVER: "bg-info",
};

const FILL_STATE_LABEL: Record<FillState, string> = {
  EMPTY: "미배치",
  PARTIAL: "충원 중",
  FULL: "충원 완료",
  OVER: "초과 배치",
};

interface EventDailyPanelProps {
  event: EventDetail;
  /** 그날 · 그 직무로 배치 모달을 연다. */
  onAddStaff: (role?: JobRole, dates?: string[]) => void;
  onOpenStaff: (staffId: number) => void;
}

/**
 * 일별 근무자 탭.
 *
 * 이 화면이 답하는 질문은 딱 하나다. **"어느 날 누가 비어 있는가."**
 *
 * 여러 날 진행하는 행사에서 합계만 보면 "몇 명인지"는 알아도
 * 어느 날이 비어 있는지를 알 수 없다. 근무일을 하나씩 펼쳐서
 * 그날의 충원 현황 · 명단 · 배치 버튼을 같은 줄에 둔다.
 *
 * 근태 · 실제 출퇴근 · 평가는 여기에 두지 않는다.
 * 그건 행사가 **끝난 뒤** 기록하는 일이고, 출퇴근 명부 탭이 사람 단위로 맡는다.
 * 한때 두 화면에 같은 정보를 겹쳐 두었더니 어느 쪽도 제 일을 못 했다.
 * 배치를 짜는 사람은 근태 배지에 눈이 걸리고, 근태를 찍는 사람은
 * 날짜마다 흩어진 같은 인물을 찾아다녀야 했다.
 *
 * 금액은 남긴다. **"이 사람을 이 날 얼마에 쓰는가"는 배치를 결정하는 조건**이지
 * 사후 기록이 아니기 때문이다. 여기서 바로 고칠 수 있다.
 */
const EventDailyPanel = ({
  event,
  onAddStaff,
  onOpenStaff,
}: EventDailyPanelProps) => {
  const roleLabel = useJobRoleLabel();
  // 직무 순서는 기준 설정이 정한다. 코드 알파벳순이면 팀장이 맨 뒤로 밀린다.
  const compareRoles = useJobRoleComparator();
  const { deleteMutation } = useAssignmentMutation();

  const [onlyUnderstaffed, setOnlyUnderstaffed] = useState(false);
  const [wageTarget, setWageTarget] = useState<Assignment | null>(null);
  /** 발주 인원을 고칠 근무일. 날마다 필요한 사람이 달라 하루 단위로 고친다. */
  const [roleEditDay, setRoleEditDay] = useState<EventDayPlan | null>(null);
  /**
   * 접어 둔 근무일.
   *
   * 30명이 8일 나오는 행사는 명단이 240줄이다. 다 펴 두면 "어느 날이 덜 찼나"를
   * 보려고 화면을 한참 굴려야 한다. 머리줄(날짜 · 충원 상태)만 남기고 접을 수 있게 한다.
   * 접은 날을 기억하는 쪽이 아니라 **편 날을 기억하는 쪽**이면 기본값이 '전부 펴기'가 되어
   * 근무일이 늘어날수록 다시 길어진다. 그래서 접힌 날짜를 들고 있는다.
   */
  const [foldedDates, setFoldedDates] = useState<string[]>([]);

  const activeAssignments = event.assignments.filter(
    (assignment) => assignment.status !== "CANCELED",
  );

  /** 근무일 하나의 명단과 충원 상태를 한 번에 계산한다. */
  const days = event.days.map((day) => {
    const assignments = activeAssignments
      .filter((assignment) => assignment.workDate === day.date)
      .sort(
        (a, b) =>
          compareRoles(a.role, b.role) ||
          a.staffName.localeCompare(b.staffName),
      );

    const confirmedCount = assignments.filter(
      (assignment) => assignment.status === "CONFIRMED",
    ).length;
    const requiredCount = day.roles.reduce(
      (sum, slot) => sum + slot.requiredCount,
      0,
    );

    return {
      day,
      // 발주 슬롯도 기준 설정 순서로 세운다. 날마다 칩 자리가 바뀌면 눈이 다시 찾는다.
      roles: [...day.roles].sort((a, b) => compareRoles(a.role, b.role)),
      assignments,
      confirmedCount,
      requiredCount,
      fillState: resolveFillState(confirmedCount, requiredCount),
    };
  });

  const visibleDays = onlyUnderstaffed
    ? days.filter((item) => item.confirmedCount < item.requiredCount)
    : days;

  const understaffedCount = days.filter(
    (item) => item.confirmedCount < item.requiredCount,
  ).length;

  /** 계약서가 아직인 확정 배치. 현장 투입 전에 반드시 끝나야 한다. */
  const contractMissingCount = activeAssignments.filter(
    (assignment) =>
      assignment.status === "CONFIRMED" && !assignment.isContractSigned,
  ).length;

  const isAllFolded =
    visibleDays.length > 0 &&
    visibleDays.every(({ day }) => foldedDates.includes(day.date));

  const toggleFold = (date: string) =>
    setFoldedDates((prev) =>
      prev.includes(date)
        ? prev.filter((item) => item !== date)
        : [...prev, date],
    );

  const handleRemove = (assignment: Assignment) => {
    openConfirm({
      title: "배치를 해제할까요?",
      description: `'${assignment.staffName}'님을 ${formatDate(assignment.workDate)} 근무에서 제외합니다.`,
      warning: "이미 발송한 계약서가 있다면 따로 취소 안내가 필요합니다.",
      confirmText: "해제",
      tone: "danger",
      onConfirm: () => deleteMutation.mutateAsync(assignment.assignmentId),
    });
  };

  return (
    <>
      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[13px] text-font-2">
              근무일 {event.dayCount}일 ·{" "}
              <span
                className={
                  understaffedCount > 0
                    ? "font-medium text-danger"
                    : "font-medium text-success"
                }
              >
                미충원 {understaffedCount}일
              </span>
            </p>

            {contractMissingCount > 0 && (
              <Badge tone="danger">계약서 미완료 {contractMissingCount}건</Badge>
            )}

            <Checkbox
              label="미충원 날짜만"
              boxClassName="whitespace-nowrap"
              checked={onlyUnderstaffed}
              onChange={(changeEvent) =>
                setOnlyUnderstaffed(changeEvent.target.checked)
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CsvExportButton
              fileName={`${event.title}_일별근무자`}
              rows={activeAssignments}
              columns={DAILY_CSV_COLUMNS}
              disabled={activeAssignments.length === 0}
            />

            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus size={15} />}
              onClick={() => onAddStaff()}
            >
              전체 근무일 배치
            </Button>

            {/* 근무일이 여럿일 때만 뜻이 있다. 하루짜리 행사에서는 누를 이유가 없다. */}
            {visibleDays.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={
                  <ChevronDown
                    size={14}
                    className={cn(
                      "transition-transform",
                      isAllFolded && "-rotate-90",
                    )}
                  />
                }
                onClick={() =>
                  setFoldedDates(
                    isAllFolded ? [] : visibleDays.map(({ day }) => day.date),
                  )
                }
              >
                {isAllFolded ? "전체 펴기" : "전체 접기"}
              </Button>
            )}
          </div>
        </div>

        {visibleDays.length === 0 ? (
          <EmptyState
            title="조건에 맞는 근무일이 없습니다."
            description="모든 근무일의 인원이 채워졌습니다."
          />
        ) : (
          <ul className="divide-y divide-border-main">
            {visibleDays.map(
              ({
                day,
                roles,
                assignments,
                confirmedCount,
                requiredCount,
                fillState,
              }) => {
                const isFolded = foldedDates.includes(day.date);

                return (
                <li key={day.date} className="flex gap-0">
                  {/*
                    충원 상태를 왼쪽 띠로 세운다.
                    날짜가 스무 줄 넘어가면 숫자를 하나하나 읽을 수 없다.
                    색만 훑어도 "빨간 줄이 있는 날"이 눈에 먼저 들어와야 한다.
                  */}
                  <span
                    className={cn(
                      "w-1 shrink-0",
                      FILL_STATE_BAR_CLASS[fillState],
                    )}
                    aria-hidden
                  />

                  <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-5">
                    {/*
                      좁은 화면에서는 날짜 · 직무 칩 · 충원 상태를 위아래로 쌓는다.
                      128px 날짜 칸을 옆에 붙여 두면 칩에 남는 자리가 200px도 안 돼
                      직무 칩이 화면 밖으로 밀려난다.
                    */}
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                      {/* 날짜를 눌러 접는다. 접기 전용 버튼을 따로 두면 누를 자리가 좁다. */}
                      <button
                        type="button"
                        onClick={() => toggleFold(day.date)}
                        aria-expanded={!isFolded}
                        className="flex items-center gap-1.5 text-left transition hover:opacity-70 sm:w-32 sm:shrink-0"
                        title={isFolded ? "이 날 명단 펴기" : "이 날 명단 접기"}
                      >
                        <ChevronDown
                          size={15}
                          className={cn(
                            "shrink-0 text-font-2 transition-transform",
                            isFolded && "-rotate-90",
                          )}
                        />
                        <span className="min-w-0">
                        <p className="text-[14px] font-medium text-font-1 tabular-nums">
                          {formatDate(day.date)}
                        </p>
                        <p className="text-[12px] text-font-2">
                          {
                            WEEKDAY_LABELS[
                              new Date(`${day.date}T00:00:00`).getDay()
                            ]
                          }
                          요일 ·{" "}
                          {formatTimeRange(
                            event.startTime,
                            event.endTime,
                            event.endDayOffset,
                          )}
                        </p>
                        </span>
                      </button>

                      {/*
                        직무 칩 자체가 배치 버튼이다.
                        칩 안에 또 버튼을 넣으면 높이가 들쭉날쭉해지고 여백이 무너진다.
                        또 발주를 다 채운 직무도 눌러야 한다 — 현장에서 사람이 더 붙는 일이
                        흔해서, 부족할 때만 열어 주면 초과 배치를 할 방법이 없다.
                      */}
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        {roles.map((slot) => {
                          const slotState = resolveFillState(
                            slot.assignedCount,
                            slot.requiredCount,
                          );

                          return (
                            <button
                              key={slot.role}
                              type="button"
                              onClick={() => onAddStaff(slot.role, [day.date])}
                              title={`${formatDate(day.date)} ${roleLabel(slot.role)} 배치 (초과 배치도 가능합니다)`}
                              className={cn(
                                "inline-flex items-center gap-2 rounded-field border px-3 py-1.5 text-[12px] transition hover:border-brand active:scale-[0.98]",
                                FILL_STATE_CHIP_CLASS[slotState],
                              )}
                            >
                              <span className="text-font-1">
                                {roleLabel(slot.role)}
                              </span>
                              <span
                                className={cn(
                                  "font-semibold tabular-nums",
                                  FILL_STATE_TEXT_CLASS[slotState],
                                )}
                              >
                                {slot.assignedCount}/{slot.requiredCount}
                              </span>
                              <Plus size={13} className="text-font-disabled" />
                            </button>
                          );
                        })}
                      </div>

                      <Badge tone={FILL_STATE_BADGE_TONE[fillState]}>
                        {FILL_STATE_LABEL[fillState]} {confirmedCount}/
                        {requiredCount}
                      </Badge>

                      {/* 발주에 없던 직무(설치 · 철거 등)를 그날만 붙일 때 쓴다. */}
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Plus size={14} />}
                        onClick={() => onAddStaff(undefined, [day.date])}
                      >
                        이 날 배치
                      </Button>

                      {/*
                        발주는 행사 폼에서 모든 날에 똑같이 깔린다.
                        설치는 첫날만, 철거는 마지막 날만 필요한데 그걸 표현할 자리가
                        여기밖에 없다. 배치 옆에 두어 "몇 명 필요한가 → 누구를 넣는가"가
                        한자리에서 끝나게 한다.
                      */}
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<Sliders size={14} />}
                        onClick={() => setRoleEditDay(day)}
                        title="이 날에만 적용되는 발주 인원을 고칩니다."
                      >
                        발주 수정
                      </Button>
                    </div>

                    {isFolded ? null : assignments.length === 0 ? (
                      <p className="text-[13px] text-font-disabled sm:pl-36">
                        배치된 인력이 없습니다.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1 sm:pl-36">
                        {assignments.map((assignment) => (
                          <li
                            key={assignment.assignmentId}
                            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-field border border-border-main px-3 py-2.5 sm:px-4"
                          >
                            {/* 직무는 이름에 붙여 둔다. 따로 떨어져 있으면 누가 무슨 일을 하는지 눈으로 다시 이어야 한다. */}
                            <button
                              type="button"
                              onClick={() => onOpenStaff(assignment.staffId)}
                              className="flex min-w-0 text-left transition hover:opacity-70 sm:flex-1"
                              title="인력 상세를 엽니다."
                            >
                              <StaffCell
                                name={assignment.staffName}
                                phoneNumber={assignment.staffPhone}
                                badge={
                                  <Badge tone="neutral">
                                    {roleLabel(assignment.role)}
                                  </Badge>
                                }
                              />
                            </button>

                            <Badge
                              tone={ASSIGNMENT_STATUS_TONE[assignment.status]}
                            >
                              {ASSIGNMENT_STATUS_LABEL[assignment.status]}
                            </Badge>

                            {/* 계약서는 현장 투입 전에 반드시 끝나야 하는 조건이다. */}
                            {assignment.status === "CONFIRMED" && (
                              <Badge
                                tone={
                                  assignment.isContractSigned
                                    ? "success"
                                    : "danger"
                                }
                              >
                                계약서{" "}
                                {assignment.isContractSigned
                                  ? "완료"
                                  : "미완료"}
                              </Badge>
                            )}

                            {/*
                              이 사람을 이 날 얼마에 쓰는가.
                              배치를 결정하는 조건이므로 여기서 바로 고친다.
                              기준 설정의 시급은 초기값일 뿐이고, 사람마다 · 날마다
                              다르게 주기로 하는 일이 현장에서는 오히려 흔하다.
                            */}
                            <button
                              type="button"
                              onClick={() => setWageTarget(assignment)}
                              title="적용 금액을 변경합니다."
                              className="shrink-0 rounded-field px-1.5 py-0.5 transition hover:bg-surface-hover active:scale-[0.98] sm:ml-auto"
                            >
                              <WageText
                                wageType={assignment.wageType}
                                wage={assignment.wage}
                              />
                            </button>

                            <Button
                              size="sm"
                              variant="dangerGhost"
                              leftIcon={<Trash size={14} />}
                              onClick={() => handleRemove(assignment)}
                            >
                              해제
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
                );
              },
            )}
          </ul>
        )}
      </Card>

      <WageEditModal
        assignment={wageTarget}
        event={event}
        onClose={() => setWageTarget(null)}
      />

      <DayRoleEditModal
        event={event}
        day={roleEditDay}
        onClose={() => setRoleEditDay(null)}
      />
    </>
  );
};

export default EventDailyPanel;
