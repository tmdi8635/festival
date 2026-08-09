"use client";

import { useState } from "react";
import { ASSIGNMENT_STATUS_FILTER_OPTIONS } from "@/constants/eventOptions";
import { ATTENDANCE_FILTER_OPTIONS } from "@/constants/staffOptions";
import { UserCheck } from "@/icons";
import { useSelection } from "@/hooks/useSelection";
import {
  ASSIGNMENT_ATTENDANCE_COLUMNS,
  ASSIGNMENT_CONTRACT_COLUMNS,
  ASSIGNMENT_REPUTATION_COLUMNS,
  ASSIGNMENT_WAGE_COLUMNS,
  ASSIGNMENT_WHO_COLUMNS,
} from "@/constants/csvColumns";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import {
  useJobRoleComparator,
  useJobRoleFilterOptions,
} from "@/store/useOrgStore";
import {
  groupAssignments,
  groupAssignmentsByStaffRole,
  calculateScheduledWorkHours,
  type Assignment,
  type AssignmentStatus,
  type EventDetail,
} from "@/type/event";
import type { AttendanceStatus, JobRole } from "@/type/staff";
import Alert from "@/components/ui/Alert";
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
import WageEditModal from "@/components/domain/WageEditModal";
import AttendanceRosterGroup, {
  type GroupMode,
} from "./AttendanceRosterGroup";

/** 출퇴근 명부. 정산 근거가 되는 값을 그대로 담는다. */
const ATTENDANCE_CSV_COLUMNS: CsvColumn<Assignment>[] = [
  ...ASSIGNMENT_WHO_COLUMNS,
  ...ASSIGNMENT_ATTENDANCE_COLUMNS,
  ...ASSIGNMENT_WAGE_COLUMNS,
  ...ASSIGNMENT_CONTRACT_COLUMNS,
  ...ASSIGNMENT_REPUTATION_COLUMNS,
];

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
 *
 * 이 컴포넌트는 **필터 · 선택 · 모달만** 맡는다.
 * 묶음과 줄을 그리는 일은 `AttendanceRosterGroup` · `AttendanceRosterRow`에 있다.
 */
const EventAttendancePanel = ({
  event,
  onOpenStaff,
}: EventAttendancePanelProps) => {
  const jobRoleFilterOptions = useJobRoleFilterOptions();
  // 직무 순서는 기준 설정이 정한다. 코드 알파벳순으로 늘어놓으면 팀장이 맨 뒤로 밀린다.
  const compareRoles = useJobRoleComparator();

  const [groupMode, setGroupMode] = useState<GroupMode>("STAFF");
  const [workDate, setWorkDate] = useState("");
  const [role, setRole] = useState<JobRole | "">("");
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const [attendance, setAttendance] = useState<AttendanceStatus | "">("");
  const [onlyMissingCheckTime, setOnlyMissingCheckTime] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [attendanceTarget, setAttendanceTarget] = useState<Assignment | null>(
    null,
  );
  const [reputationTarget, setReputationTarget] = useState<Assignment | null>(
    null,
  );
  const [wageTarget, setWageTarget] = useState<Assignment | null>(null);

  /** 행사 하나의 배치는 많아야 수백 건이라 상세 응답 안에서 걸러 쓴다. */
  const rows = event.assignments
    .filter((assignment) => {
      if (workDate && assignment.workDate !== workDate) return false;
      if (role && assignment.role !== role) return false;
      if (status && assignment.status !== status) return false;
      if (attendance && assignment.attendance !== attendance) return false;
      if (onlyMissingCheckTime && assignment.checkInAt && assignment.checkOutAt) {
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
  const dateGroups = groupAssignments(rows, (assignment) => assignment.workDate)
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

  const {
    selectedIds,
    setSelectedIds,
    isAllSelected,
    isSelected,
    areAllSelected,
    toggle,
    toggleAll,
    toggleMany,
    clear,
  } = useSelection(rows.map((row) => row.assignmentId));
  const selectedRows = rows.filter((row) => isSelected(row.assignmentId));

  const missingCheckTimeAssignments = event.assignments.filter(
    (assignment) =>
      assignment.status === "CONFIRMED" &&
      (!assignment.checkInAt || !assignment.checkOutAt),
  );

  const scheduledWorkHours = calculateScheduledWorkHours(event);

  const dateOptions = [
    { label: "전체 근무일", value: "" },
    ...event.dates.map((date) => ({
      label: formatDate(date),
      value: date,
    })),
  ];

  /** 필터를 바꾸면 선택을 버린다. 걸러져 사라진 건이 일괄 처리에 남으면 안 된다. */
  const withClear =
    <T,>(apply: (value: T) => void) =>
    (value: T) => {
      apply(value);
      clear();
    };

  /** 묶음의 '일괄 기록'은 그 묶음만 골라 놓고 모달을 연다. */
  const handleBulkRecord = (assignmentIds: number[]) => {
    setSelectedIds(assignmentIds);
    setIsBulkOpen(true);
  };

  return (
    <>
      {missingCheckTimeAssignments.length > 0 && (
        <Alert
          tone="warning"
          title={`출퇴근이 기록되지 않은 배치가 ${missingCheckTimeAssignments.length}건 있습니다.`}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setOnlyMissingCheckTime(true);
                setSelectedIds(
                  missingCheckTimeAssignments.map((item) => item.assignmentId),
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
              onChange={withClear((changeEvent) =>
                setWorkDate(changeEvent.target.value),
              )}
              selectBoxClassName="w-36"
            />

            <Checkbox
              label="출퇴근 미기록만"
              boxClassName="whitespace-nowrap"
              checked={onlyMissingCheckTime}
              onChange={withClear((changeEvent) =>
                setOnlyMissingCheckTime(changeEvent.target.checked),
              )}
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
              onChange={withClear((changeEvent) =>
                setRole(changeEvent.target.value as JobRole | ""),
              )}
              selectBoxClassName="w-28"
            />

            <Select
              aria-label="배치 상태 필터"
              options={ASSIGNMENT_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={withClear((changeEvent) =>
                setStatus(changeEvent.target.value as AssignmentStatus | ""),
              )}
              selectBoxClassName="w-28"
            />

            <Select
              aria-label="근태 필터"
              options={ATTENDANCE_FILTER_OPTIONS}
              value={attendance}
              onChange={withClear((changeEvent) =>
                setAttendance(changeEvent.target.value as AttendanceStatus | ""),
              )}
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
              onChange={toggleAll}
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
            {groups.map(({ key, assignments }) => (
              <AttendanceRosterGroup
                key={key}
                groupKey={key}
                assignments={assignments}
                event={event}
                groupMode={groupMode}
                scheduledWorkHours={scheduledWorkHours}
                isGroupSelected={areAllSelected(
                  assignments.map((item) => item.assignmentId),
                )}
                isSelected={isSelected}
                onToggleGroup={toggleMany}
                onToggle={toggle}
                onBulkRecord={handleBulkRecord}
                onOpenStaff={onOpenStaff}
                onEditWage={setWageTarget}
                onEditAttendance={setAttendanceTarget}
                onEditReputation={setReputationTarget}
              />
            ))}
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
          clear();
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
