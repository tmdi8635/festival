"use client";

import { UserCheck } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  formatTimeRange,
  resolveWorkHours,
  type Assignment,
  type EventDetail,
} from "@/type/event";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import StaffCell from "@/components/domain/StaffCell";
import AttendanceRosterRow from "./AttendanceRosterRow";

/**
 * 명부를 묶어 보는 단위.
 *
 * - STAFF: 사람 × 직무 한 줄. 사흘 나온 사람은 한 줄 안에 사흘이 펼쳐진다.
 * - DATE:  근무일 한 덩어리. "그날 누가 나왔나"를 볼 때 쓴다.
 */
export type GroupMode = "STAFF" | "DATE";

interface AttendanceRosterGroupProps {
  /** 사람별이면 `${staffId}-${role}`, 날짜별이면 근무일 */
  groupKey: string;
  assignments: Assignment[];
  event: EventDetail;
  groupMode: GroupMode;
  /** 행사 예정 실근무시간. 날짜별 머리에서 그날의 기준으로 보여 준다. */
  scheduledWorkHours: number;
  isGroupSelected: boolean;
  isSelected: (assignmentId: number) => boolean;
  onToggleGroup: (assignmentIds: number[]) => void;
  onToggle: (assignmentId: number) => void;
  /** 이 묶음만 골라 근태 일괄 기록을 연다. */
  onBulkRecord: (assignmentIds: number[]) => void;
  onOpenStaff: (staffId: number) => void;
  onEditWage: (assignment: Assignment) => void;
  onEditAttendance: (assignment: Assignment) => void;
  onEditReputation: (assignment: Assignment) => void;
}

/**
 * 출퇴근 명부의 묶음 하나.
 *
 * 머리에 그 묶음의 판정(며칠 · 실근무 몇 시간 · 미기록 몇 건)을 먼저 놓고,
 * 그 아래에 근거가 되는 하루들을 편다. 담당자는 머리만 훑다가
 * 빨간 게 보일 때만 아래를 본다.
 */
const AttendanceRosterGroup = ({
  groupKey,
  assignments,
  event,
  groupMode,
  scheduledWorkHours,
  isGroupSelected,
  isSelected,
  onToggleGroup,
  onToggle,
  onBulkRecord,
  onOpenStaff,
  onEditWage,
  onEditAttendance,
  onEditReputation,
}: AttendanceRosterGroupProps) => {
  const roleLabel = useJobRoleLabel();

  const [first] = assignments;
  const ids = assignments.map((item) => item.assignmentId);

  /** 이 묶음의 실근무시간 합계. 사람별에서는 곧 지급 근거가 된다. */
  const totalWorkHours =
    Math.round(
      assignments.reduce(
        (sum, item) => sum + resolveWorkHours(item, event).workHours,
        0,
      ) * 10,
    ) / 10;
  const missingCount = assignments.filter(
    (item) => !item.checkInAt || !item.checkOutAt,
  ).length;

  return (
    <li className="flex flex-col gap-2.5 px-5 py-4">
      {/* 묶음 머리. 사람별이면 사람, 날짜별이면 그날의 요약이다. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Checkbox
          aria-label={`${groupMode === "STAFF" ? first.staffName : formatDate(groupKey)} 전체 선택`}
          checked={isGroupSelected}
          onChange={() => onToggleGroup(ids)}
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
              badge={<Badge tone="neutral">{roleLabel(first.role)}</Badge>}
            />
          </button>
        ) : (
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-font-1 tabular-nums">
              {formatDate(groupKey)}
            </p>
            <p className="text-[12px] text-font-2">
              {formatTimeRange(
                event.startTime,
                event.endTime,
                event.endDayOffset,
              )}{" "}
              · 예정 {scheduledWorkHours}시간
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <span className="text-[13px] text-font-2 tabular-nums">
            {groupMode === "STAFF"
              ? `${assignments.length}일 · 실근무 ${totalWorkHours}시간`
              : `${assignments.length}명`}
          </span>

          {missingCount > 0 ? (
            <Badge tone="warning">출퇴근 미기록 {missingCount}건</Badge>
          ) : (
            <Badge tone="success">출퇴근 완료</Badge>
          )}

          {/* 계약서는 현장 투입 전에 끝나야 하는 조건이다. */}
          {groupMode === "STAFF" &&
            assignments.some(
              (item) => item.status === "CONFIRMED" && !item.isContractSigned,
            ) && <Badge tone="danger">계약서 미완료</Badge>}

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<UserCheck size={14} />}
            onClick={() => onBulkRecord(ids)}
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

      <ul className="flex flex-col gap-1 pl-8">
        {assignments.map((assignment) => (
          <AttendanceRosterRow
            key={assignment.assignmentId}
            assignment={assignment}
            event={event}
            groupMode={groupMode}
            isSelected={isSelected(assignment.assignmentId)}
            onToggle={() => onToggle(assignment.assignmentId)}
            onOpenStaff={onOpenStaff}
            onEditWage={onEditWage}
            onEditAttendance={onEditAttendance}
            onEditReputation={onEditReputation}
          />
        ))}
      </ul>
    </li>
  );
};

export default AttendanceRosterGroup;
