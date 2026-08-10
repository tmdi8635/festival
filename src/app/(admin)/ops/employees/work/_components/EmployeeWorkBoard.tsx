"use client";

import { useState } from "react";
import Link from "next/link";
import { useEmployeeWorkQuery } from "@/api/employee/getEmployeeWork";
import { ChevronRight, Clock, TrendUp, Users, Warning } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
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
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import MonthPicker from "@/components/ui/MonthPicker";
import SearchInput from "@/components/ui/SearchInput";
import Table, { type TableColumn } from "@/components/ui/Table";
import StaffCell from "@/components/domain/StaffCell";
import StatTile from "@/components/domain/StatTile";

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
  const [includeRetired, setIncludeRetired] = useState(false);
  /** 펼친 줄. 한 번에 하나만 연다. 전부 열면 훑는다는 목적이 사라진다. */
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isLoading } = useEmployeeWorkQuery({
    month,
    keyword: keyword || undefined,
    includeRetired,
  });

  const rows = data?.items ?? [];
  const summary = data?.summary;

  const columns: TableColumn<EmployeeWorkRow>[] = [
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
      header: "근무시간 / 기준",
      render: (row) => {
        const { rate, remainingHours, overHours, isOver } =
          summarizeEmployeeHours(row);
        const tone = resolveEmployeeHourTone(rate);

        return (
          <div className="flex min-w-44 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-[14px] font-medium tabular-nums",
                  HOUR_TONE_CLASS[tone],
                )}
              >
                {row.workedHours}
                <span className="text-font-2">
                  {" "}
                  / {row.baseMonthlyHours}시간
                </span>
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
    {
      key: "events",
      header: "참여 행사",
      align: "right",
      numeric: true,
      render: (row) =>
        row.events.length > 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenId(openId === row.employeeId ? null : row.employeeId);
            }}
            className="inline-flex items-center gap-1 rounded-field px-1.5 py-0.5 text-[13px] text-font-1 tabular-nums transition hover:bg-surface-hover"
          >
            {row.events.length}건
            <ChevronRight
              size={13}
              className={cn(
                "text-font-2 transition-transform",
                openId === row.employeeId && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="text-font-disabled">-</span>
        ),
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

            <Checkbox
              label="퇴사자 포함"
              checked={includeRetired}
              onChange={(event) => setIncludeRetired(event.target.checked)}
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
          onRowClick={(row) =>
            setOpenId(openId === row.employeeId ? null : row.employeeId)
          }
          emptyTitle="집계할 근무가 없습니다."
          emptyDescription="직원을 행사에 배치하면 이 달 근무시간이 여기에 쌓입니다."
          renderExpanded={(row) =>
            openId === row.employeeId && row.events.length > 0 ? (
              /*
                어느 현장이 길었는지.
                시간 합계만 보면 초과가 났다는 것만 알고 무엇을 줄여야 할지는 모른다.
              */
              <ul className="flex flex-col gap-1.5 bg-subtle px-5 py-3">
                {row.events.map((event) => (
                  <li
                    key={event.eventId}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                  >
                    <Link
                      href={`/schedule/events/${event.eventId}`}
                      className="min-w-0 truncate text-[13px] text-font-1 transition hover:text-brand hover:underline"
                    >
                      {event.eventTitle}
                      <span className="text-font-2"> · {event.clientName}</span>
                    </Link>

                    <span className="shrink-0 text-[12px] text-font-2 tabular-nums">
                      {formatDate(event.workDates[0])}
                      {event.workDates.length > 1 &&
                        ` 외 ${event.workDates.length - 1}일`}{" "}
                      · {event.workHours}시간
                      {event.scheduledHours > 0 &&
                        ` (예정 ${event.scheduledHours})`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
      </Card>
    </>
  );
};

export default EmployeeWorkBoard;
