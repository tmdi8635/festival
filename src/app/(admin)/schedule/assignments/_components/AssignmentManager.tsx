"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAssignmentListQuery } from "@/api/event/getAssignmentList";
import { ASSIGNMENT_STATUS_FILTER_OPTIONS, ASSIGNMENT_STATUS_TONE } from "@/constants/eventOptions";
import {
  ATTENDANCE_FILTER_OPTIONS,
  ATTENDANCE_STATUS_TONE,
  BULK_ATTENDANCE_OPTIONS,
} from "@/constants/staffOptions";
import { useBooleanParam } from "@/hooks/useBooleanParam";
import { useListSearch } from "@/hooks/useListSearch";
import { useSelection } from "@/hooks/useSelection";
import { Star, UserCheck } from "@/icons";
import { openConfirm } from "@/store/useConfirmStore";
import {
  useJobRoleFilterOptions,
  useJobRoleLabel,
} from "@/store/useOrgStore";
import { useAssignmentMutation } from "@/api/event/mutateAssignment";
import {
  ASSIGNMENT_ATTENDANCE_COLUMNS,
  ASSIGNMENT_CONTRACT_COLUMNS,
  ASSIGNMENT_REPUTATION_COLUMNS,
  ASSIGNMENT_WAGE_COLUMNS,
  ASSIGNMENT_WHO_COLUMNS,
} from "@/constants/csvColumns";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  ASSIGNMENT_STATUS_LABEL,
  toTimeInput,
  type Assignment,
  type AssignmentStatus,
} from "@/type/event";
import {
  ATTENDANCE_STATUS_LABEL,
  type AttendanceStatus,
  type JobRole,
} from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import DateRangeFilter, { type DateRange } from "@/components/ui/DateRangeFilter";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import AttendanceModal from "@/components/domain/AttendanceModal";
import ReputationModal from "@/components/domain/ReputationModal";
import VerdictBadge from "@/components/domain/VerdictBadge";
import StaffCell from "@/components/domain/StaffCell";
import WageText from "@/components/domain/WageText";
import StaffDetailModal from "@/components/domain/StaffDetailModal";

const ASSIGNMENT_CSV_COLUMNS: CsvColumn<Assignment>[] = [
  ...ASSIGNMENT_WHO_COLUMNS,
  { header: "행사명", value: (row) => row.eventTitle },
  ...ASSIGNMENT_WAGE_COLUMNS,
  ...ASSIGNMENT_ATTENDANCE_COLUMNS,
  ...ASSIGNMENT_CONTRACT_COLUMNS,
  ...ASSIGNMENT_REPUTATION_COLUMNS,
];

/**
 * 배치 · 근태 현황.
 *
 * 행사 상세는 "이 행사에 누가 있나"를 보고, 이 화면은 "이 사람이 언제 어디 가나"를 본다.
 * 계약서 미완료 필터를 두어 현장 투입 전에 걸러야 할 건을 바로 찾게 한다.
 */
const AssignmentManager = () => {
  const router = useRouter();
  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  const [role, setRole] = useState<JobRole | "">("");
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const [attendance, setAttendance] = useState<AttendanceStatus | "">("");
  const [range, setRange] = useState<DateRange>({ startDate: "", endDate: "" });
  const [onlyUnsignedContract, setOnlyUnsignedContract] = useState(false);
  /**
   * 지난 근무인데 출퇴근이 안 적힌 건. 정산 전에 반드시 채워야 한다.
   * 대시보드 할 일에서 넘어오면 필터가 걸린 채로 열린다.
   */
  const missingCheckTimeParam = useBooleanParam("onlyMissingCheckTime");
  const [draftMissingCheckTime, setDraftMissingCheckTime] = useState<
    boolean | null
  >(null);
  const onlyMissingCheckTime = draftMissingCheckTime ?? missingCheckTimeParam;
  const setOnlyMissingCheckTime = setDraftMissingCheckTime;

  const [attendanceTarget, setAttendanceTarget] = useState<Assignment | null>(
    null,
  );
  const [reputationTarget, setReputationTarget] =
    useState<Assignment | null>(null);
  const [detailStaffId, setDetailStaffId] = useState<number | null>(null);

  /** 이 화면은 인력 기준으로 훑는 자리다. 행사 단위 처리는 상세 페이지로 넘긴다. */
  const openEventDetail = (eventId: number) =>
    router.push(`/schedule/events/${eventId}`);

  const jobRoleFilterOptions = useJobRoleFilterOptions();
  const roleLabel = useJobRoleLabel();
  const { bulkAttendanceMutation } = useAssignmentMutation();

  const { data, isLoading } = useAssignmentListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    role: role || undefined,
    status: status || undefined,
    attendance: attendance || undefined,
    startDate: range.startDate || undefined,
    endDate: range.endDate || undefined,
    onlyUnsignedContract: onlyUnsignedContract || undefined,
    onlyMissingCheckTime: onlyMissingCheckTime || undefined,
  });

  const rows = data?.content ?? [];
  /** 일괄 근태 처리를 위해 고른 배치들 */
  const { selectedIds, isAllSelected, isSelected, toggle, toggleAll, clear } =
    useSelection(rows.map((row) => row.assignmentId));
  const selectedRows = rows.filter((row) => isSelected(row.assignmentId));

  /** 검색 결과가 달라지면 선택도 버린다. 화면에서 사라진 건이 일괄 처리에 남으면 안 된다. */
  const handleSearchAndClear = (nextKeyword: string) => {
    handleSearch(nextKeyword);
    clear();
  };

  /**
   * 일괄 근태 처리.
   *
   * 행사가 끝나면 20~30명의 근태를 한 명씩 눌러 기록해야 했다.
   * 대부분은 '정상 출근'이고 예외만 몇 건이라, 전체를 한 번에 처리한 뒤
   * 예외만 개별로 고치는 편이 훨씬 빠르다.
   */
  const handleBulkAttendance = (attendance: AttendanceStatus) => {
    const label = ATTENDANCE_STATUS_LABEL[attendance];
    const isPenalty = attendance === "NO_SHOW" || attendance === "ABSENT";

    openConfirm({
      title: `선택한 ${selectedIds.length}건을 '${label}'으로 처리할까요?`,
      description: selectedRows
        .slice(0, 5)
        .map((row) => row.staffName)
        .join(", ")
        .concat(selectedRows.length > 5 ? ` 외 ${selectedRows.length - 5}명` : ""),
      warning: isPenalty
        ? "노쇼 · 결근은 인력의 누적 기록에 남고 블랙리스트 판정 근거가 됩니다. 정말 해당하는 건만 골랐는지 확인해 주세요."
        : undefined,
      confirmText: label,
      tone: isPenalty ? "danger" : "default",
      onConfirm: async () => {
        /*
          근무일을 함께 넘긴다. 출퇴근 시각은 각 배치의 자기 날짜에 붙어야 하는데,
          이 화면은 여러 행사를 가로질러 보는 곳이라 날짜가 제각각이다.
          (여기서는 근태 결과만 찍는다. 시각은 행사 상세의 출퇴근 명부에서 넣는다)
        */
        await bulkAttendanceMutation.mutateAsync({
          assignments: selectedRows.map((row) => ({
            assignmentId: row.assignmentId,
            workDate: row.workDate,
          })),
          attendance,
        });
        clear();
      },
    });
  };

  const columns: TableColumn<Assignment>[] = [
    {
      key: "select",
      header: (
        <Checkbox
          aria-label="전체 선택"
          checked={isAllSelected}
          onChange={toggleAll}
        />
      ),
      width: "44px",
      align: "center",
      render: (assignment) => (
        <div onClick={(clickEvent) => clickEvent.stopPropagation()}>
          <Checkbox
            aria-label={`${assignment.staffName} 선택`}
            checked={isSelected(assignment.assignmentId)}
            onChange={() => toggle(assignment.assignmentId)}
          />
        </div>
      ),
    },
    {
      key: "staff",
      header: "인력",
      render: (assignment) => (
        /*
          이름을 눌러 인력 상세로 바로 갈 수 있어야 한다.
          "이 사람 지난번에도 지각했나"를 확인하려고 인력풀로 나갔다가
          다시 이 화면의 필터를 처음부터 잡는 일이 잦았다.
        */
        <button
          type="button"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            setDetailStaffId(assignment.staffId);
          }}
          className="text-left transition hover:opacity-70"
          title="인력 상세를 엽니다."
        >
          <StaffCell
            name={assignment.staffName}
            phoneNumber={assignment.staffPhone}
          />
        </button>
      ),
    },
    {
      key: "event",
      header: "행사 / 근무일",
      render: (assignment) => (
        <TableCellStack
          primary={assignment.eventTitle}
          secondary={
            <span className="tabular-nums">
              {formatDate(assignment.workDate)}
            </span>
          }
        />
      ),
    },
    {
      key: "role",
      header: "직무",
      render: (assignment) => (
        <Badge tone="neutral">{roleLabel(assignment.role)}</Badge>
      ),
    },
    {
      key: "wage",
      header: "적용 금액",
      align: "right",
      numeric: true,
      // 시급인지 일급인지가 금액만큼 중요하다. 금액만 보면 자릿수로 짐작해야 한다.
      render: (assignment) => (
        <WageText wageType={assignment.wageType} wage={assignment.wage} />
      ),
    },
    {
      key: "status",
      header: "배치",
      render: (assignment) => (
        <Badge tone={ASSIGNMENT_STATUS_TONE[assignment.status]}>
          {ASSIGNMENT_STATUS_LABEL[assignment.status]}
        </Badge>
      ),
    },
    {
      key: "attendance",
      header: "근태 · 출퇴근",
      render: (assignment) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge tone={ATTENDANCE_STATUS_TONE[assignment.attendance]}>
            {ATTENDANCE_STATUS_LABEL[assignment.attendance]}
            {assignment.lateMinutes > 0 && ` ${assignment.lateMinutes}분`}
          </Badge>

          {/*
            실제 출퇴근이 곧 지급액이다.
            아직 안 적힌 건은 정산이 예정 시간으로 잡혀 있다는 뜻이라 표시해 둔다.
          */}
          {assignment.checkInAt && assignment.checkOutAt ? (
            <span className="text-[11px] text-font-2 tabular-nums">
              {toTimeInput(assignment.checkInAt)}~
              {toTimeInput(assignment.checkOutAt)}
            </span>
          ) : (
            assignment.attendance !== "PENDING" &&
            assignment.attendance !== "NO_SHOW" &&
            assignment.attendance !== "ABSENT" && (
              <span className="text-[11px] text-warning">출퇴근 미기록</span>
            )
          )}
        </div>
      ),
    },
    {
      key: "contract",
      header: "계약서",
      align: "center",
      render: (assignment) =>
        assignment.isContractSigned ? (
          <Badge tone="success">완료</Badge>
        ) : (
          <Badge tone="danger">미완료</Badge>
        ),
    },
    {
      key: "reputation",
      header: "평가",
      align: "center",
      render: (assignment) => (
        <VerdictBadge verdict={assignment.reputationVerdict} emptyLabel="-" />
      ),
    },
    {
      key: "actions",
      header: "",
      width: "150px",
      align: "right",
      render: (assignment) => (
        <div
          className="flex justify-end gap-1"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<UserCheck size={14} />}
            onClick={() => setAttendanceTarget(assignment)}
          >
            근태
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Star size={14} />}
            onClick={() => setReputationTarget(assignment)}
          >
            평가
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={keyword}
              onSearch={handleSearchAndClear}
              placeholder="이름 · 행사명 · 연락처 검색"
            />

            <Checkbox
              label="계약서 미완료만"
              boxClassName="whitespace-nowrap"
              checked={onlyUnsignedContract}
              onChange={withPageReset((event) => setOnlyUnsignedContract(event.target.checked))}
            />

            {/* 정산 전에 반드시 채워야 하는 건을 바로 찾을 수 있게 한다. */}
            <Checkbox
              label="출퇴근 미기록만"
              boxClassName="whitespace-nowrap"
              checked={onlyMissingCheckTime}
              onChange={withPageReset((event) => setOnlyMissingCheckTime(event.target.checked))}
            />
          </div>

          <div className="flex items-center gap-2">
            <CsvExportButton
              fileName="배치현황"
              rows={data?.content ?? []}
              columns={ASSIGNMENT_CSV_COLUMNS}
              disabled={isLoading}
            />

            <Select
              aria-label="직무 필터"
              options={jobRoleFilterOptions}
              value={role}
              onChange={withPageReset((event) => setRole(event.target.value as JobRole | ""))}
              selectBoxClassName="w-32"
            />

            <Select
              aria-label="배치 상태 필터"
              options={ASSIGNMENT_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={withPageReset((event) => setStatus(event.target.value as AssignmentStatus | ""))}
              selectBoxClassName="w-32"
            />

            <Select
              aria-label="근태 필터"
              options={ATTENDANCE_FILTER_OPTIONS}
              value={attendance}
              onChange={withPageReset((event) => setAttendance(event.target.value as AttendanceStatus | ""))}
              selectBoxClassName="w-32"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5">
          <DateRangeFilter
            value={range}
            onChange={withPageReset((next: DateRange) => {
              setRange(next);
              clear();
            })}
          />

          {/* 일괄 근태 처리. 대부분이 '정상 출근'이라 한 번에 찍고 예외만 고친다. */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-font-2 tabular-nums">
                {selectedIds.length}건 선택
              </span>

              {BULK_ATTENDANCE_OPTIONS.map((option) => (
                <Button
                  key={option.status}
                  size="sm"
                  variant={
                    option.status === "PRESENT"
                      ? "primary"
                      : option.status === "NO_SHOW" || option.status === "ABSENT"
                        ? "dangerGhost"
                        : "secondary"
                  }
                  onClick={() => handleBulkAttendance(option.status)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <Table
          columns={columns}
          rows={rows}
          getRowKey={(assignment) => String(assignment.assignmentId)}
          isLoading={isLoading}
          onRowClick={(assignment) => openEventDetail(assignment.eventId)}
          emptyTitle="조건에 맞는 배치가 없습니다."
          emptyDescription="기간이나 직무 필터를 바꿔서 다시 찾아보세요."
        />

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={DEFAULT_PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      <AttendanceModal
        assignment={attendanceTarget}
        onClose={() => setAttendanceTarget(null)}
      />

      <ReputationModal
        assignment={reputationTarget}
        onClose={() => setReputationTarget(null)}
      />

      <StaffDetailModal
        staffId={detailStaffId}
        onClose={() => setDetailStaffId(null)}
        onOpenEvent={openEventDetail}
      />
    </>
  );
};

export default AssignmentManager;
