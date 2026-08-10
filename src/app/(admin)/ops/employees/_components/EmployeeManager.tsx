"use client";

import { useState } from "react";
import { useEmployeeListQuery } from "@/api/employee/getEmployeeList";
import { useHasPermission } from "@/store/useAdminStore";
import { ChevronLeft, ChevronRight, Clock, Plus, Star, Users } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import { cn } from "@/lib/utils";
import {
  formatMonthLabel,
  monthKey,
  resolveEmployeeHourTone,
  shiftMonth,
  summarizeEmployeeHours,
  type Employee,
} from "@/type/employee";
import { formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import IconButton from "@/components/ui/IconButton";
import SearchInput from "@/components/ui/SearchInput";
import Table, { type TableColumn } from "@/components/ui/Table";
import StaffCell from "@/components/domain/StaffCell";
import StatTile from "@/components/domain/StatTile";
import EmployeeFormModal from "./EmployeeFormModal";

const HOUR_TONE_CLASS = {
  default: "text-font-1",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

const BAR_TONE_CLASS = {
  default: "bg-font-2",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

const EMPLOYEE_CSV_COLUMNS: CsvColumn<Employee>[] = [
  { header: "이름", value: (row) => row.name },
  { header: "직책", value: (row) => row.position },
  { header: "연락처", value: (row) => row.phoneNumber },
  { header: "입사일", value: (row) => row.hireDate },
  { header: "기본 근무시간", value: (row) => row.baseMonthlyHours },
  { header: "근무시간", value: (row) => row.workedHours },
  { header: "그중 예정 기준", value: (row) => row.scheduledHours },
  { header: "근무일수", value: (row) => row.workedDays },
  { header: "참여 행사", value: (row) => row.eventCount },
  { header: "메인팀장", value: (row) => row.mainSupervisorCount },
  { header: "재직", value: (row) => (row.isActive ? "재직" : "퇴사") },
];

/**
 * 직원 관리.
 *
 * ## 왜 인력풀이 아니라 여기인가
 *
 * 인력풀은 "이번 행사에 누구를 부를까"를 고르는 자리다. 그 판단의 축은
 * 서류 · 평판 · 지급 이력인데, 직원은 그 축 어디에도 해당하지 않는다.
 * 섞어 두면 직원은 서류 미제출 · 정산 없음으로만 읽혀 매번 눈에 걸린다.
 *
 * ## 이 화면이 답하는 질문
 *
 * **"이번 달에 누가 얼마나 뛰었나."** 직원은 월급을 받으니 시급 계산이 없고,
 * 대신 시간이 관리 대상이 된다. 기준 시간을 크게 넘긴 사람은 다음 달 배치를
 * 덜어 줘야 하고, 한참 못 채운 사람은 현장에 더 넣을 수 있다.
 * 그 판단을 하려면 **채움률**이 한 줄에 보여야 한다.
 */
const EmployeeManager = () => {
  const canWrite = useHasPermission("employee:write");

  const [month, setMonth] = useState(monthKey());
  const [keyword, setKeyword] = useState("");
  const [includeRetired, setIncludeRetired] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);

  const { data, isLoading } = useEmployeeListQuery({
    month,
    keyword: keyword || undefined,
    includeRetired,
  });

  const rows = data?.items ?? [];
  const summary = data?.summary;

  /* 다음 달은 아직 오지 않았다. 미래로 넘겨 봐야 전부 0이라 길을 막아 둔다. */
  const isCurrentMonth = month >= monthKey();

  const openForm = (employee: Employee | null) => {
    setEditTarget(employee);
    setIsFormOpen(true);
  };

  const columns: TableColumn<Employee>[] = [
    {
      key: "employee",
      header: "직원",
      render: (row) => (
        <StaffCell
          name={row.name}
          profileImageUrl={row.profileImageUrl}
          secondary={formatPhoneNumber(row.phoneNumber)}
          badge={
            <>
              <Badge tone="info">{row.position}</Badge>
              {!row.isActive && <Badge tone="neutral">퇴사</Badge>}
            </>
          }
        />
      ),
    },
    {
      /*
        채움률이 이 화면의 본문이다.
        숫자만 적으면 "82시간"이 많은지 적은지 읽는 사람마다 다르게 보므로,
        기준 대비 어디쯤인지를 막대로 함께 그린다.
      */
      key: "hours",
      header: "이번 달 근무",
      render: (row) => {
        const { rate, remainingHours, overHours, isOver } =
          summarizeEmployeeHours(row);
        const tone = resolveEmployeeHourTone(rate);

        return (
          <div className="flex min-w-40 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-[14px] font-medium tabular-nums",
                  HOUR_TONE_CLASS[tone],
                )}
              >
                {row.workedHours}
                <span className="text-font-2"> / {row.baseMonthlyHours}시간</span>
              </span>
              <span className="text-[12px] text-font-2 tabular-nums">
                {rate}%
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
              <div
                className={cn("h-full rounded-full", BAR_TONE_CLASS[tone])}
                style={{ width: `${Math.min(100, rate)}%` }}
              />
            </div>

            <span className="text-[12px] text-font-2">
              {isOver ? `기준 대비 +${overHours}시간` : `${remainingHours}시간 남음`}
              {/*
                출퇴근이 아직 안 찍힌 날은 행사 예정 시간으로 셌다.
                그 사실을 적지 않으면 확정된 숫자로 읽고 다음 달 배치를 정하게 된다.
              */}
              {row.scheduledHours > 0 &&
                ` · 예정 기준 ${row.scheduledHours}시간 포함`}
            </span>
          </div>
        );
      },
    },
    {
      key: "days",
      header: "근무일 / 행사",
      align: "right",
      numeric: true,
      render: (row) => (
        <span className="tabular-nums">
          {row.workedDays}일 / {row.eventCount}건
        </span>
      ),
    },
    {
      /*
        메인팀장을 맡은 횟수.
        직원이 현장에서 실제로 무엇을 했는지는 시간만으로 안 보인다.
        메인을 몇 번 잡았는지가 그 사람의 그 달 무게에 가깝다.
      */
      key: "main",
      header: "메인팀장",
      align: "right",
      numeric: true,
      render: (row) =>
        row.mainSupervisorCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-[13px] text-font-1 tabular-nums">
            <Star size={12} className="text-brand" />
            {row.mainSupervisorCount}건
          </span>
        ) : (
          <span className="text-font-disabled">-</span>
        ),
    },
    {
      key: "hireDate",
      header: "입사일",
      render: (row) => (
        <span className="text-[13px] text-font-2 tabular-nums">
          {row.hireDate || "-"}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="재직 직원"
          value={`${summary?.totalCount ?? 0}명`}
          description={`${formatMonthLabel(month)} 기준`}
          icon={<Users size={18} />}
        />
        <StatTile
          label="합계 근무시간"
          value={`${summary?.totalWorkedHours ?? 0}시간`}
          description={`기준 합계 ${summary?.totalBaseHours ?? 0}시간`}
          icon={<Clock size={18} />}
        />
        <StatTile
          label="기준 초과"
          value={`${summary?.overCount ?? 0}명`}
          description="다음 달 배치를 덜어 줘야 하는 인원입니다."
          tone={(summary?.overCount ?? 0) > 0 ? "warning" : "default"}
          icon={<Clock size={18} />}
        />
        <StatTile
          label="메인팀장 수행"
          value={`${summary?.mainSupervisorCount ?? 0}건`}
          description="이 달에 직원이 메인을 잡은 행사입니다."
          icon={<Star size={18} />}
        />
      </div>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          {/* 달 이동. 이 화면의 모든 숫자가 이 값 하나에 걸려 있다. */}
          <div className="flex items-center gap-1.5">
            <IconButton
              label="지난달"
              icon={<ChevronLeft size={16} />}
              onClick={() => setMonth((prev) => shiftMonth(prev, -1))}
            />
            <span className="min-w-28 text-center text-[15px] font-semibold text-font-0 tabular-nums">
              {formatMonthLabel(month)}
            </span>
            <IconButton
              label="다음달"
              icon={<ChevronRight size={16} />}
              disabled={isCurrentMonth}
              onClick={() => setMonth((prev) => shiftMonth(prev, 1))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={keyword}
              onSearch={setKeyword}
              placeholder="이름 · 직책 검색"
            />

            <Checkbox
              label="퇴사자 포함"
              checked={includeRetired}
              onChange={(event) => setIncludeRetired(event.target.checked)}
            />

            <CsvExportButton
              fileName={`직원_근무시간_${month}`}
              rows={rows}
              columns={EMPLOYEE_CSV_COLUMNS}
              disabled={isLoading || rows.length === 0}
            />

            {canWrite && (
              <Button
                variant="primary"
                leftIcon={<Plus size={15} />}
                onClick={() => openForm(null)}
              >
                직원 등록
              </Button>
            )}
          </div>
        </div>

        <Table
          columns={columns}
          rows={rows}
          getRowKey={(row) => String(row.staffId)}
          isLoading={isLoading}
          onRowClick={canWrite ? openForm : undefined}
          emptyTitle="등록된 직원이 없습니다."
          emptyDescription="월급을 받는 우리 직원을 등록하면, 행사에서 직무와 관계없이 배치할 수 있고 이번 달 근무시간이 여기에 쌓입니다."
        />
      </Card>

      <EmployeeFormModal
        isOpen={isFormOpen}
        employee={editTarget}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
};

export default EmployeeManager;
