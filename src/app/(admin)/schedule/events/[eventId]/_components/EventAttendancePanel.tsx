"use client";

import { useState } from "react";
import {
  ASSIGNMENT_STATUS_FILTER_OPTIONS,
  ASSIGNMENT_STATUS_TONE,
} from "@/constants/eventOptions";
import {
  ATTENDANCE_FILTER_OPTIONS,
  ATTENDANCE_STATUS_TONE,
} from "@/constants/staffOptions";
import { Star, UserCheck } from "@/icons";
import {
  ASSIGNMENT_ATTENDANCE_COLUMNS,
  ASSIGNMENT_CONTRACT_COLUMNS,
  ASSIGNMENT_REPUTATION_COLUMNS,
  ASSIGNMENT_WAGE_COLUMNS,
  ASSIGNMENT_WHO_COLUMNS,
} from "@/constants/csvColumns";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import {
  useJobRoleComparator,
  useJobRoleFilterOptions,
  useJobRoleLabel,
} from "@/store/useOrgStore";
import {
  formatTimeRange,
  groupAssignments,
  groupAssignmentsByStaffRole,
  ASSIGNMENT_STATUS_LABEL,
  calculateScheduledWorkHours,
  resolveWorkHours,
  toTimeInput,
  type Assignment,
  type AssignmentStatus,
  type EventDetail,
} from "@/type/event";
import {
  ATTENDANCE_STATUS_LABEL,
  REPUTATION_VERDICT_LABEL,
  type AttendanceStatus,
  type JobRole,
} from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import EmptyState from "@/components/ui/EmptyState";
import Select from "@/components/ui/Select";
import Tabs from "@/components/ui/Tabs";
import AttendanceModal from "@/components/domain/AttendanceModal";
import BulkAttendanceModal from "@/components/domain/BulkAttendanceModal";
import ReputationModal from "@/components/domain/ReputationModal";
import StaffCell from "@/components/domain/StaffCell";
import WageEditModal from "@/components/domain/WageEditModal";
import WageText from "@/components/domain/WageText";

/** 출퇴근 명부. 정산 근거가 되는 값을 그대로 담는다. */
const ATTENDANCE_CSV_COLUMNS: CsvColumn<Assignment>[] = [
  ...ASSIGNMENT_WHO_COLUMNS,
  ...ASSIGNMENT_ATTENDANCE_COLUMNS,
  ...ASSIGNMENT_WAGE_COLUMNS,
  ...ASSIGNMENT_CONTRACT_COLUMNS,
  ...ASSIGNMENT_REPUTATION_COLUMNS,
];

/**
 * 명부를 묶어 보는 단위.
 *
 * - STAFF: 사람 × 직무 한 줄. 사흘 나온 사람은 한 줄 안에 사흘이 펼쳐진다.
 * - DATE:  근무일 한 덩어리. "그날 누가 나왔나"를 볼 때 쓴다.
 */
type GroupMode = "STAFF" | "DATE";

const GROUP_TABS = [
  { value: "STAFF", label: "사람별" },
  { value: "DATE", label: "날짜별" },
];

interface EventAttendancePanelProps {
  event: EventDetail;
  onOpenStaff: (staffId: number) => void;
}

/**
 * 출퇴근 명부 탭.
 *
 * 행사가 끝나면 근태를 남겨야 하는데, 30명이 사흘 나온 행사는 배치가 90건이다.
 * 예전에는 이 90건을 근무일 · 이름 순으로 평평하게 늘어놓았다.
 * 그러면 **사흘 내내 나온 사람이 세 줄로 흩어져**, "이 사람 사흘 다 채웠나"를
 * 확인하려면 표를 위아래로 훑으며 눈으로 이어 붙여야 했다.
 *
 * 그래서 기본을 **사람별**로 둔다. 한 사람이 한 줄이고, 그 안에 근무일이 펼쳐진다.
 * 누가 며칠 나왔고 어느 날이 비었는지가 한 줄에서 끝난다.
 * "그날 누가 나왔나"가 궁금할 때만 날짜별로 바꾼다.
 *
 * 여기서 남기는 **실제 출퇴근 시각이 곧 지급액**이다.
 * 미기록 건이 남아 있으면 정산 탭의 금액은 아직 예정 기준의 잠정값이다.
 */
const EventAttendancePanel = ({
  event,
  onOpenStaff,
}: EventAttendancePanelProps) => {
  const jobRoleFilterOptions = useJobRoleFilterOptions();
  const roleLabel = useJobRoleLabel();
  // 직무 순서는 기준 설정이 정한다. 코드 알파벳순으로 늘어놓으면 팀장이 맨 뒤로 밀린다.
  const compareRoles = useJobRoleComparator();

  const [groupMode, setGroupMode] = useState<GroupMode>("STAFF");
  const [workDate, setWorkDate] = useState("");
  const [role, setRole] = useState<JobRole | "">("");
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const [attendance, setAttendance] = useState<AttendanceStatus | "">("");
  const [onlyMissingCheckTime, setOnlyMissingCheckTime] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [attendanceTarget, setAttendanceTarget] = useState<Assignment | null>(
    null,
  );
  const [reputationTarget, setReputationTarget] =
    useState<Assignment | null>(null);
  const [wageTarget, setWageTarget] = useState<Assignment | null>(null);

  /** 행사 하나의 배치는 많아야 수백 건이라 상세 응답 안에서 걸러 쓴다. */
  const rows = event.assignments
    .filter((assignment) => {
      if (workDate && assignment.workDate !== workDate) return false;
      if (role && assignment.role !== role) return false;
      if (status && assignment.status !== status) return false;
      if (attendance && assignment.attendance !== attendance) return false;
      if (
        onlyMissingCheckTime &&
        assignment.checkInAt &&
        assignment.checkOutAt
      ) {
        return false;
      }

      return true;
    })
    .sort(
      (a, b) =>
        a.workDate.localeCompare(b.workDate) ||
        compareRoles(a.role, b.role) ||
        a.staffName.localeCompare(b.staffName),
    );

  /**
   * 사람 × 직무로 묶는다.
   *
   * 직무가 다르면 시급도 계약도 다른 일이라 한 줄로 합치지 않는다.
   * (첫날은 설치, 이후는 스태프인 경우가 실제로 있다)
   * 묶는 규칙은 계약서 · 정산과 같아야 하므로 공통 함수를 쓴다.
   */
  const staffGroups = groupAssignmentsByStaffRole(rows)
    .map((assignments) => ({
      key: `${assignments[0].staffId}-${assignments[0].role}`,
      assignments,
    }))
    .sort(
      (a, b) =>
        compareRoles(a.assignments[0].role, b.assignments[0].role) ||
        a.assignments[0].staffName.localeCompare(b.assignments[0].staffName),
    );

  /** 날짜별 묶음. "그날 누가 나왔나"를 볼 때 쓴다. */
  const dateGroups = groupAssignments(
    rows,
    (assignment) => assignment.workDate,
  )
    .map((assignments) => ({
      key: assignments[0].workDate,
      assignments: [...assignments].sort(
        (a, b) =>
          compareRoles(a.role, b.role) ||
          a.staffName.localeCompare(b.staffName),
      ),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const groups = groupMode === "STAFF" ? staffGroups : dateGroups;

  const isAllSelected =
    rows.length > 0 &&
    rows.every((row) => selectedIds.includes(row.assignmentId));
  const selectedRows = rows.filter((row) =>
    selectedIds.includes(row.assignmentId),
  );

  const missingCheckTimeCount = event.assignments.filter(
    (assignment) =>
      assignment.status === "CONFIRMED" &&
      (!assignment.checkInAt || !assignment.checkOutAt),
  ).length;

  const scheduledWorkHours = calculateScheduledWorkHours(event);

  const dateOptions = [
    { label: "전체 근무일", value: "" },
    ...event.dates.map((date) => ({
      label: formatDate(date),
      value: date,
    })),
  ];

  const handleToggleAll = () =>
    setSelectedIds(isAllSelected ? [] : rows.map((row) => row.assignmentId));

  const handleToggle = (assignmentId: number) =>
    setSelectedIds((prev) =>
      prev.includes(assignmentId)
        ? prev.filter((id) => id !== assignmentId)
        : [...prev, assignmentId],
    );

  /** 묶음 하나를 통째로 켜고 끈다. 사흘 나온 사람을 세 번 누를 이유가 없다. */
  const handleToggleGroup = (assignments: Assignment[]) => {
    const ids = assignments.map((item) => item.assignmentId);
    const isGroupSelected = ids.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) =>
      isGroupSelected
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])],
    );
  };

  return (
    <>
      {missingCheckTimeCount > 0 && (
        <Alert
          tone="warning"
          title={`출퇴근이 기록되지 않은 배치가 ${missingCheckTimeCount}건 있습니다.`}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setOnlyMissingCheckTime(true);
                setSelectedIds(
                  event.assignments
                    .filter(
                      (item) =>
                        item.status === "CONFIRMED" &&
                        (!item.checkInAt || !item.checkOutAt),
                    )
                    .map((item) => item.assignmentId),
                );
              }}
            >
              미기록 전체 선택
            </Button>
          }
        >
          이 건들의 지급액은 행사 예정 시간으로 잠정 계산됩니다. 실제 출퇴근을
          채우면 정산 금액이 곧바로 다시 계산됩니다.
        </Alert>
      )}

      <Card noPadding>
        <div className="flex items-center justify-between gap-3 border-b border-border-main px-5 py-3.5">
          <div className="flex items-center gap-3">
            {/* 같은 명부를 사람으로 묶어 볼지 날짜로 묶어 볼지만 다르다. */}
            <Tabs
              items={GROUP_TABS}
              value={groupMode}
              onChange={(next) => setGroupMode(next as GroupMode)}
            />

            <Select
              aria-label="근무일 필터"
              options={dateOptions}
              value={workDate}
              onChange={(changeEvent) => {
                setWorkDate(changeEvent.target.value);
                setSelectedIds([]);
              }}
              selectBoxClassName="w-36"
            />

            <Checkbox
              label="출퇴근 미기록만"
              boxClassName="whitespace-nowrap"
              checked={onlyMissingCheckTime}
              onChange={(changeEvent) => {
                setOnlyMissingCheckTime(changeEvent.target.checked);
                setSelectedIds([]);
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <CsvExportButton
              fileName={`${event.title}_출퇴근명부`}
              rows={rows}
              columns={ATTENDANCE_CSV_COLUMNS}
              disabled={rows.length === 0}
            />

            <Select
              aria-label="직무 필터"
              options={jobRoleFilterOptions}
              value={role}
              onChange={(changeEvent) => {
                setRole(changeEvent.target.value as JobRole | "");
                setSelectedIds([]);
              }}
              selectBoxClassName="w-28"
            />

            <Select
              aria-label="배치 상태 필터"
              options={ASSIGNMENT_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={(changeEvent) => {
                setStatus(changeEvent.target.value as AssignmentStatus | "");
                setSelectedIds([]);
              }}
              selectBoxClassName="w-28"
            />

            <Select
              aria-label="근태 필터"
              options={ATTENDANCE_FILTER_OPTIONS}
              value={attendance}
              onChange={(changeEvent) => {
                setAttendance(changeEvent.target.value as AttendanceStatus | "");
                setSelectedIds([]);
              }}
              selectBoxClassName="w-28"
            />
          </div>
        </div>

        {/*
          선택 · 일괄 처리 줄.

          근태는 한 명씩 찍는 일이 아니다. 대부분은 예정대로 왔다 가므로
          전체를 한 번에 찍고 예외 몇 건만 개별로 고치는 순서가 되어야 한다.
        */}
        <div className="flex items-center justify-between gap-3 border-b border-border-main bg-subtle px-5 py-3">
          <div className="flex items-center gap-3">
            <Checkbox
              label={`전체 선택 (${rows.length}건)`}
              boxClassName="whitespace-nowrap"
              checked={isAllSelected}
              onChange={handleToggleAll}
            />

            {selectedIds.length > 0 && (
              <span className="text-[13px] text-font-2 tabular-nums">
                {selectedIds.length}건 선택 ·{" "}
                {new Set(selectedRows.map((row) => row.staffId)).size}명
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<UserCheck size={14} />}
            disabled={selectedIds.length === 0}
            onClick={() => setIsBulkOpen(true)}
            title="선택한 배치에 근태와 실제 출퇴근 시각을 한 번에 기록합니다."
          >
            근태 일괄 기록
          </Button>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            title="조건에 맞는 배치가 없습니다."
            description="근무일이나 근태 필터를 바꿔서 다시 찾아보세요."
          />
        ) : (
          <ul className="divide-y divide-border-main">
            {groups.map(({ key, assignments }) => {
              const [first] = assignments;
              const ids = assignments.map((item) => item.assignmentId);
              const isGroupSelected = ids.every((id) =>
                selectedIds.includes(id),
              );

              /* 이 묶음의 실근무시간 합계. 사람별에서는 곧 지급 근거가 된다. */
              const totalWorkHours =
                Math.round(
                  assignments.reduce(
                    (sum, item) =>
                      sum + resolveWorkHours(item, event).workHours,
                    0,
                  ) * 10,
                ) / 10;
              const missingCount = assignments.filter(
                (item) => !item.checkInAt || !item.checkOutAt,
              ).length;

              return (
                <li key={key} className="flex flex-col gap-2.5 px-5 py-4">
                  {/* 묶음 머리. 사람별이면 사람, 날짜별이면 그날의 요약이다. */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      aria-label={`${groupMode === "STAFF" ? first.staffName : formatDate(key)} 전체 선택`}
                      checked={isGroupSelected}
                      onChange={() => handleToggleGroup(assignments)}
                    />

                    {groupMode === "STAFF" ? (
                      <button
                        type="button"
                        onClick={() => onOpenStaff(first.staffId)}
                        className="min-w-0 text-left transition hover:opacity-70"
                        title="인력 상세를 엽니다."
                      >
                        <StaffCell
                          name={first.staffName}
                          phoneNumber={first.staffPhone}
                          badge={
                            <Badge tone="neutral">
                              {roleLabel(first.role)}
                            </Badge>
                          }
                        />
                      </button>
                    ) : (
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-font-1 tabular-nums">
                          {formatDate(key)}
                        </p>
                        <p className="text-[12px] text-font-2">
                          {formatTimeRange(
                            event.startTime,
                            event.endTime,
                            event.endDayOffset,
                          )}{" "}
                          · 예정{" "}
                          {scheduledWorkHours}시간
                        </p>
                      </div>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[13px] text-font-2 tabular-nums">
                        {groupMode === "STAFF"
                          ? `${assignments.length}일 · 실근무 ${totalWorkHours}시간`
                          : `${assignments.length}명`}
                      </span>

                      {missingCount > 0 ? (
                        <Badge tone="warning">
                          출퇴근 미기록 {missingCount}건
                        </Badge>
                      ) : (
                        <Badge tone="success">출퇴근 완료</Badge>
                      )}

                      {/* 계약서는 현장 투입 전에 끝나야 하는 조건이다. */}
                      {groupMode === "STAFF" &&
                        assignments.some(
                          (item) =>
                            item.status === "CONFIRMED" &&
                            !item.isContractSigned,
                        ) && <Badge tone="danger">계약서 미완료</Badge>}

                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<UserCheck size={14} />}
                        onClick={() => {
                          setSelectedIds(ids);
                          setIsBulkOpen(true);
                        }}
                        title={
                          groupMode === "STAFF"
                            ? "이 사람의 근무일 전체에 근태를 한 번에 기록합니다."
                            : "이 날 근무자 전체에 근태를 한 번에 기록합니다."
                        }
                      >
                        일괄 기록
                      </Button>
                    </div>
                  </div>

                  {/*
                    묶음 안의 배치 한 건 = 하루.
                    날짜 · 근태 · 실제 출퇴근 · 금액이 한 줄에 있어야
                    "이 날이 비었다"를 바로 알아채고 그 자리에서 고칠 수 있다.
                  */}
                  <ul className="flex flex-col gap-1 pl-8">
                    {assignments.map((assignment) => {
                      const { workHours, isActual } = resolveWorkHours(
                        assignment,
                        event,
                      );

                      return (
                        <li
                          key={assignment.assignmentId}
                          className={cn(
                            "flex items-center gap-3 rounded-field border px-3 py-2",
                            selectedIds.includes(assignment.assignmentId)
                              ? "border-brand bg-brand-opacity-3"
                              : "border-border-main",
                          )}
                        >
                          <Checkbox
                            aria-label={`${assignment.staffName} ${assignment.workDate} 선택`}
                            checked={selectedIds.includes(
                              assignment.assignmentId,
                            )}
                            onChange={() =>
                              handleToggle(assignment.assignmentId)
                            }
                          />

                          {/* 사람별이면 날짜가, 날짜별이면 사람이 이 자리의 식별자다. */}
                          {groupMode === "STAFF" ? (
                            <span className="w-28 shrink-0 text-[13px] text-font-1 tabular-nums">
                              {formatDate(assignment.workDate)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenStaff(assignment.staffId)}
                              className="w-40 shrink-0 text-left text-[13px] text-font-1 transition hover:opacity-70"
                              title="인력 상세를 엽니다."
                            >
                              {assignment.staffName}
                              <span className="ml-1.5 text-[12px] text-font-2">
                                {roleLabel(assignment.role)}
                              </span>
                            </button>
                          )}

                          <Badge tone={ASSIGNMENT_STATUS_TONE[assignment.status]}>
                            {ASSIGNMENT_STATUS_LABEL[assignment.status]}
                          </Badge>

                          <Badge
                            tone={ATTENDANCE_STATUS_TONE[assignment.attendance]}
                          >
                            {ATTENDANCE_STATUS_LABEL[assignment.attendance]}
                            {assignment.lateMinutes > 0 &&
                              ` ${assignment.lateMinutes}분`}
                          </Badge>

                          {/* 실제 출퇴근이 곧 지급액이다. 안 적힌 건은 '예정'으로 표시한다. */}
                          <span className="flex items-center gap-1.5 text-[12px] tabular-nums">
                            {assignment.checkInAt && assignment.checkOutAt ? (
                              <span className="text-font-2">
                                {toTimeInput(assignment.checkInAt)}~
                                {toTimeInput(assignment.checkOutAt)}
                              </span>
                            ) : (
                              <span className="text-font-disabled">
                                출퇴근 미기록
                              </span>
                            )}
                            <span
                              className={
                                isActual ? "text-font-2" : "text-warning"
                              }
                            >
                              {workHours}h {isActual ? "실제" : "예정"}
                            </span>
                          </span>

                          {/* 금액은 눌러서 바로 고친다. 사람마다 · 날마다 다를 수 있다. */}
                          <button
                            type="button"
                            onClick={() => setWageTarget(assignment)}
                            title="적용 금액을 변경합니다."
                            className="ml-auto shrink-0 rounded-field px-1.5 py-0.5 transition hover:bg-surface-hover active:scale-[0.98]"
                          >
                            <WageText
                              wageType={assignment.wageType}
                              wage={assignment.wage}
                            />
                          </button>

                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<UserCheck size={14} />}
                            onClick={() => setAttendanceTarget(assignment)}
                          >
                            근태
                          </Button>

                          {/* 이미 평가한 건은 결과를 그대로 버튼에 띄운다. 다시 눌러 고칠 수 있다. */}
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<Star size={14} />}
                            onClick={() => setReputationTarget(assignment)}
                          >
                            {assignment.reputationVerdict
                              ? REPUTATION_VERDICT_LABEL[
                                  assignment.reputationVerdict
                                ]
                              : "평가"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <BulkAttendanceModal
        isOpen={isBulkOpen}
        assignments={selectedRows}
        event={event}
        onClose={() => setIsBulkOpen(false)}
        onDone={() => {
          setIsBulkOpen(false);
          setSelectedIds([]);
        }}
      />

      <AttendanceModal
        assignment={attendanceTarget}
        onClose={() => setAttendanceTarget(null)}
      />

      <ReputationModal
        assignment={reputationTarget}
        onClose={() => setReputationTarget(null)}
      />

      <WageEditModal
        assignment={wageTarget}
        event={event}
        onClose={() => setWageTarget(null)}
      />
    </>
  );
};

export default EventAttendancePanel;
