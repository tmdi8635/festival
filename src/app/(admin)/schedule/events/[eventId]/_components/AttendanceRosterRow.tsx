"use client";

import { ASSIGNMENT_STATUS_TONE } from "@/constants/eventOptions";
import { ATTENDANCE_STATUS_TONE } from "@/constants/staffOptions";
import { Star, UserCheck } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  ASSIGNMENT_STATUS_LABEL,
  resolveWorkHours,
  toTimeInput,
  type Assignment,
  type EventDetail,
} from "@/type/event";
import { ATTENDANCE_STATUS_LABEL, REPUTATION_VERDICT_LABEL } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import WageText from "@/components/domain/WageText";
import type { GroupMode } from "./AttendanceRosterGroup";

interface AttendanceRosterRowProps {
  assignment: Assignment;
  event: EventDetail;
  /** 묶음 머리에 이미 나온 값은 줄에서 뺀다. 사람별이면 날짜가, 날짜별이면 이름이 식별자다. */
  groupMode: GroupMode;
  isSelected: boolean;
  onToggle: () => void;
  onOpenStaff: (staffId: number) => void;
  onEditWage: (assignment: Assignment) => void;
  onEditAttendance: (assignment: Assignment) => void;
  onEditReputation: (assignment: Assignment) => void;
}

/**
 * 출퇴근 명부의 한 줄 = 배치 한 건 = 하루.
 *
 * 날짜 · 근태 · 실제 출퇴근 · 금액이 **한 줄에** 있어야
 * "이 날이 비었다"를 바로 알아채고 그 자리에서 고칠 수 있다.
 * 값을 보는 화면과 고치는 화면이 갈리면 담당자는 둘을 왕복하며 대조해야 한다.
 */
const AttendanceRosterRow = ({
  assignment,
  event,
  groupMode,
  isSelected,
  onToggle,
  onOpenStaff,
  onEditWage,
  onEditAttendance,
  onEditReputation,
}: AttendanceRosterRowProps) => {
  const roleLabel = useJobRoleLabel();
  const { workHours, isActual } = resolveWorkHours(assignment, event);

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-field border px-3 py-2",
        isSelected ? "border-brand bg-brand-opacity-3" : "border-border-main",
      )}
    >
      <Checkbox
        aria-label={`${assignment.staffName} ${assignment.workDate} 선택`}
        checked={isSelected}
        onChange={onToggle}
      />

      {groupMode === "STAFF" ? (
        <span className="shrink-0 text-[13px] text-font-1 tabular-nums sm:w-28">
          {formatDate(assignment.workDate)}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onOpenStaff(assignment.staffId)}
          className="shrink-0 text-left text-[13px] text-font-1 transition hover:opacity-70 sm:w-40"
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

      <Badge tone={ATTENDANCE_STATUS_TONE[assignment.attendance]}>
        {ATTENDANCE_STATUS_LABEL[assignment.attendance]}
        {assignment.lateMinutes > 0 && ` ${assignment.lateMinutes}분`}
      </Badge>

      {/* 실제 출퇴근이 곧 지급액이다. 안 적힌 건은 '예정'으로 표시한다. */}
      <span className="flex items-center gap-1.5 text-[12px] tabular-nums">
        {assignment.checkInAt && assignment.checkOutAt ? (
          <span className="text-font-2">
            {toTimeInput(assignment.checkInAt)}~
            {toTimeInput(assignment.checkOutAt)}
          </span>
        ) : (
          <span className="text-font-disabled">출퇴근 미기록</span>
        )}
        <span className={isActual ? "text-font-2" : "text-warning"}>
          {workHours}h {isActual ? "실제" : "예정"}
        </span>
      </span>

      {/* 금액은 눌러서 바로 고친다. 사람마다 · 날마다 다를 수 있다. */}
      <button
        type="button"
        onClick={() => onEditWage(assignment)}
        title="적용 금액을 변경합니다."
        className="shrink-0 rounded-field px-1.5 py-0.5 transition hover:bg-surface-hover active:scale-[0.98] sm:ml-auto"
      >
        <WageText wageType={assignment.wageType} wage={assignment.wage} />
      </button>

      <Button
        size="sm"
        variant="ghost"
        leftIcon={<UserCheck size={14} />}
        onClick={() => onEditAttendance(assignment)}
      >
        근태
      </Button>

      {/* 이미 평가한 건은 결과를 그대로 버튼에 띄운다. 다시 눌러 고칠 수 있다. */}
      <Button
        size="sm"
        variant="ghost"
        leftIcon={<Star size={14} />}
        onClick={() => onEditReputation(assignment)}
      >
        {assignment.reputationVerdict
          ? REPUTATION_VERDICT_LABEL[assignment.reputationVerdict]
          : "평가"}
      </Button>
    </li>
  );
};

export default AttendanceRosterRow;
