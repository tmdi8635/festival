"use client";

import { useState } from "react";
import {
  useEmployeeWorkQuery,
  type EmployeeWorkSort,
} from "@/api/employee/getEmployeeWork";
import { Clock, TrendUp, Users, Warning } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import { cn } from "@/lib/utils";
import {
  formatMonthLabel,
  monthKey,
  resolveEmployeeHourTone,
  summarizeEmployeeHours,
  type EmployeeWorkRow,
} from "@/type/employee";
import { formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CsvExportButton from "@/components/ui/CsvExportButton";
import MonthPicker from "@/components/ui/MonthPicker";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { type TableColumn } from "@/components/ui/Table";
import StaffCell from "@/components/domain/StaffCell";
import StatTile from "@/components/domain/StatTile";
import EmployeeWorkDetailModal from "./EmployeeWorkDetailModal";

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

/** 정렬 선택지. 기본은 채움률이다. */
const WORK_SORT_OPTIONS = [
  { label: "채움률 높은순", value: "RATE" },
  { label: "근무시간 많은순", value: "HOURS" },
  { label: "직책순", value: "POSITION" },
];

const WORK_CSV_COLUMNS: CsvColumn<EmployeeWorkRow>[] = [
  { header: "이름", value: (row) => row.name },
  { header: "직책", value: (row) => row.position },
  { header: "기준 시간", value: (row) => row.baseMonthlyHours },
  { header: "근무시간", value: (row) => row.workedHours },
  {
    header: "초과",
    value: (row) => summarizeEmployeeHours(row).overHours,
  },
  {
    header: "미달",
    value: (row) => summarizeEmployeeHours(row).remainingHours,
  },
  { header: "채움률(%)", value: (row) => summarizeEmployeeHours(row).rate },
  { header: "그중 예정 기준", value: (row) => row.scheduledHours },
  { header: "근무일수", value: (row) => row.workedDays },
  { header: "참여 행사", value: (row) => row.events.length },
  {
    header: "행사 내역",
    value: (row) =>
      row.events
        .map(
          (event) =>
            `${event.eventTitle}(${event.workDates.length}일 ${event.workHours}h)`,
        )
        .join(" / "),
  },
];

/**
 * 직원 근무.
 *
 * **이 화면이 답하는 질문은 하나다 — "이번 달에 누가 얼마나 일했나."**
 *
 * 직원은 월급을 받으니 시급 계산이 없고, 대신 시간이 관리 대상이 된다.
 * 기준을 크게 넘긴 사람은 다음 달 배치를 덜어 줘야 하고, 한참 못 채운 사람은
 * 현장에 더 넣을 수 있다. 그 판단을 하려면 **채움률**과 **어느 현장이 길었는지**가
 * 한 줄에서 보여야 한다.
 *
 * 인적사항 · 권한은 여기 없다. 그건 직원 관리가 맡는다.
 * 입사일도 넣지 않는다. 이 달에 얼마나 일했는지와 아무 상관이 없다.
 */
const EmployeeWorkBoard = () => {
  const [month, setMonth] = useState(monthKey());
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<EmployeeWorkSort>("RATE");
  /** 상세를 열어 둔 줄. 표 아래에 펴는 대신 모달로 올린다. */
  const [detailRow, setDetailRow] = useState<EmployeeWorkRow | null>(null);

  const { data, isLoading } = useEmployeeWorkQuery({
    month,
    keyword: keyword || undefined,
    sort,
  });

  const rows = data?.items ?? [];
  const summary = data?.summary;

  const columns: TableColumn<EmployeeWorkRow>[] = [
    {
      key: "employee",
      header: "직원",
      render: (row) => (
        /*
          퇴사자도 이 표에 그대로 선다. 지난 달을 열면 그때 일한 사람이
          지금은 퇴사자일 뿐이고, 그 근무는 실제로 있었던 근무다.
          체크박스로 걸러 내면 합계가 틀린다.
        */
        <StaffCell
          name={row.name}
          profileImageUrl={row.profileImageUrl}
          gender={row.gender}
          secondary={`${row.position} · ${formatPhoneNumber(row.phoneNumber)}`}
          badge={!row.isActive ? <Badge tone="neutral">퇴사</Badge> : undefined}
        />
      ),
    },
    {
      /*
        채움률이 이 화면의 본문이다.
        숫자만 적으면 "82시간"이 많은지 적은지 읽는 사람마다 다르게 보므로,
        기준 대비 어디쯤인지를 막대로 함께 그린다.
      */
      /*
        **이 칸이 화면의 본문이다.**

        "82시간"이라는 숫자만으로는 많은지 적은지 읽는 사람마다 다르게 보므로
        기준 대비 어디쯤인지를 막대로 함께 그린다. 자리를 넉넉히 주고 막대를
        두껍게 둔다 — 이 표에서 눈이 가장 먼저 닿아야 하는 곳이다.
      */
      key: "hours",
      header: "근무시간 / 기준",
      render: (row) => {
        const { rate, remainingHours, overHours, isOver } =
          summarizeEmployeeHours(row);
        const tone = resolveEmployeeHourTone(rate);

        return (
          <div className="flex min-w-64 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-[16px] font-semibold tabular-nums",
                  HOUR_TONE_CLASS[tone],
                )}
              >
                {row.workedHours}
                <span className="text-[13px] font-normal text-font-2">
                  {" "}
                  / {row.baseMonthlyHours}시간
                </span>
              </span>
              <span
                className={cn(
                  "text-[13px] font-medium tabular-nums",
                  HOUR_TONE_CLASS[tone],
                )}
              >
                {rate}%
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-subtle">
              <div
                className={cn("h-full rounded-full", BAR_TONE_CLASS[tone])}
                style={{ width: `${Math.min(100, rate)}%` }}
              />
            </div>

            <span className="text-[12px] text-font-2">
              {isOver
                ? `초과 +${overHours}시간`
                : `${remainingHours}시간 남음`}
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
      header: "근무일",
      align: "right",
      numeric: true,
      render: (row) => <span className="tabular-nums">{row.workedDays}일</span>,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="집계 인원"
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
          description={
            (summary?.totalOverHours ?? 0) > 0
              ? `초과분 합계 ${summary?.totalOverHours}시간`
              : "넘긴 사람이 없습니다."
          }
          tone={(summary?.overCount ?? 0) > 0 ? "warning" : "default"}
          icon={<TrendUp size={18} />}
        />
        {/*
          한참 못 채운 사람도 함께 센다.
          초과만 보면 "덜어 줄 사람"만 보이고, 그 일을 **누구에게 넘길지**가 안 보인다.
        */}
        <StatTile
          label="60% 미만"
          value={`${summary?.underCount ?? 0}명`}
          description="현장에 더 넣을 수 있는 인원입니다."
          icon={<Warning size={18} />}
        />
      </div>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          {/*
            달 하나가 이 화면의 전부다.
            화살표만 두면 3년 전 기록을 보려고 마흔 번을 눌러야 해서,
            라벨을 누르면 연도 이동 + 12개월 격자가 열린다.
          */}
          <MonthPicker value={month} onChange={setMonth} />

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={keyword}
              onSearch={setKeyword}
              placeholder="이름 · 직책 검색"
            />

            {/*
              정렬.

              기본은 채움률이지만 기준 시간이 사람마다 달라(단축근무 120시간)
              "실제로 오래 뛴 사람"은 절대 시간으로 봐야 보인다.
              직책순은 팀 단위로 훑을 때 쓴다.
            */}
            <Select
              aria-label="정렬 기준"
              options={WORK_SORT_OPTIONS}
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as EmployeeWorkSort)
              }
              selectBoxClassName="w-36"
            />

            <CsvExportButton
              fileName={`직원_근무_${month}`}
              rows={rows}
              columns={WORK_CSV_COLUMNS}
              disabled={isLoading || rows.length === 0}
            />
          </div>
        </div>

        <Table
          columns={columns}
          rows={rows}
          getRowKey={(row) => String(row.employeeId)}
          isLoading={isLoading}
          onRowClick={setDetailRow}
          emptyTitle="집계할 근무가 없습니다."
          emptyDescription="직원을 행사에 배치하면 이 달 근무시간이 여기에 쌓입니다. 근무 집계를 끈 직원은 나오지 않습니다."
        />
      </Card>

      <EmployeeWorkDetailModal
        row={detailRow}
        onClose={() => setDetailRow(null)}
      />
    </>
  );
};

export default EmployeeWorkBoard;
