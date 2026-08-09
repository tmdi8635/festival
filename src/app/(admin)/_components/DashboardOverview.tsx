"use client";

import Link from "next/link";
import { formatTimeRange } from "@/type/event";
import { useDashboardSummaryQuery } from "@/api/dashboard/getDashboardSummary";
import { ATTENDANCE_STATUS_TONE } from "@/constants/staffOptions";
import {
  Briefcase,
  Calendar,
  ChevronRight,
  FileText,
  MapPin,
  Users,
  Wallet,
  Warning,
} from "@/icons";
import { formatDate, formatDday } from "@/lib/dayjs";
import { formatCurrency, formatWithCommas } from "@/lib/utils";
import { ACTION_TYPE_LABEL, type ActionItem } from "@/type/dashboard";
import { ATTENDANCE_STATUS_LABEL } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import StatTile from "@/components/domain/StatTile";
import RevenueTrendChart from "./RevenueTrendChart";

/** 할 일 종류별 강조 색. 사람이 빠지는 문제를 가장 위험하게 본다. */
const ACTION_TONE: Record<ActionItem["type"], "danger" | "warning" | "info"> = {
  UNDERSTAFFED: "danger",
  CHECK_TIME_MISSING: "warning",
  CONTRACT_MISSING: "danger",
  DOCUMENT_MISSING: "warning",
  PAYROLL_PENDING: "warning",
  APPLICATION_PENDING: "info",
};

/**
 * 대시보드.
 *
 * 대표가 아침에 열었을 때 "오늘 뭘 해야 하나"가 바로 보여야 한다.
 * 그래서 지표보다 '지금 손대야 하는 일' 목록을 위쪽에 크게 둔다.
 */
const DashboardOverview = () => {
  const { data, isLoading } = useDashboardSummaryQuery();

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-card" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const { metric, actions, monthlyTrend, upcomingEvents, attendanceIssues } =
    data;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="오늘 진행 행사"
            value={`${metric.todayEventCount}건`}
            description={`현장 인원 ${metric.todayStaffCount}명 · 이번 주 ${metric.weekEventCount}건`}
            icon={<Calendar size={18} />}
          />
          <StatTile
            label="아직 비어 있는 자리"
            value={`${metric.openSlotCount}자리`}
            description="다가오는 행사 기준"
            tone={metric.openSlotCount > 0 ? "danger" : "default"}
            icon={<Users size={18} />}
          />
          <StatTile
            label="계약서 미완료"
            value={`${metric.unsignedContractCount}건`}
            description={`서류 미제출 ${metric.incompleteDocumentCount}명`}
            tone={metric.unsignedContractCount > 0 ? "warning" : "default"}
            icon={<FileText size={18} />}
          />
          <StatTile
            label="미지급 정산액"
            value={formatCurrency(metric.unpaidAmount)}
            description={`활동 인력 ${formatWithCommas(metric.activeStaffCount)}명`}
            tone={metric.unpaidAmount > 0 ? "warning" : "default"}
            icon={<Wallet size={18} />}
          />
        </div>

        <Card
          title="지금 처리해야 할 일"
          description="항목을 누르면 처리 화면으로 바로 이동합니다."
          noPadding
        >
          {actions.length === 0 ? (
            <EmptyState
              title="밀린 일이 없습니다."
              description="새 발주가 들어오면 여기에서 알려 드립니다."
            />
          ) : (
            <ul className="divide-y divide-border-main">
              {actions.map((action) => (
                <li key={action.actionId}>
                  <Link
                    href={action.href}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-surface-hover"
                  >
                    <Badge tone={ACTION_TONE[action.type]}>
                      {ACTION_TYPE_LABEL[action.type]}
                    </Badge>

                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-font-1">
                        {action.title}
                      </p>
                      <p className="mt-0.5 text-[13px] text-font-2">
                        {action.description}
                      </p>
                    </div>

                    {action.daysLeft !== undefined && (
                      <Badge tone={action.daysLeft <= 3 ? "danger" : "neutral"}>
                        {action.daysLeft === 0
                          ? "오늘"
                          : `D-${action.daysLeft}`}
                      </Badge>
                    )}

                    <ChevronRight size={16} className="shrink-0 text-font-disabled" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="월별 매출 · 인건비" description="단위: 만원">
          <RevenueTrendChart data={monthlyTrend} />
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card title="다가오는 행사" noPadding>
            {upcomingEvents.length === 0 ? (
              <EmptyState
                title="예정된 행사가 없습니다."
                description="행사 캘린더에서 새 발주를 등록해 보세요."
              />
            ) : (
              <ul className="divide-y divide-border-main">
                {upcomingEvents.map((event) => {
                  const isUnderstaffed =
                    event.totalAssigned < event.totalRequired;

                  return (
                    <li key={event.eventId}>
                      {/* 행사 상세는 페이지다. 대시보드에서 바로 그 행사로 넘어간다. */}
                      <Link
                        href={`/schedule/events/${event.eventId}`}
                        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-surface-hover"
                      >
                        <div className="w-16 shrink-0">
                          <p className="text-[13px] font-medium text-font-1 tabular-nums">
                            {formatDate(event.date).slice(5)}
                          </p>
                          <p className="text-[12px] text-font-2">
                            {formatDday(event.date)}
                          </p>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-font-1">
                            {event.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-font-2">
                            <MapPin size={12} />
                            {event.venue} ·{" "}
                            {formatTimeRange(
                              event.startTime,
                              event.endTime,
                              event.endDayOffset,
                            )}
                          </p>
                        </div>

                        <Badge tone={isUnderstaffed ? "danger" : "success"}>
                          {event.totalAssigned}/{event.totalRequired}명
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            title="최근 근태 이슈"
            description="누적되면 등급과 블랙리스트에 반영됩니다."
            noPadding
          >
            {attendanceIssues.length === 0 ? (
              <EmptyState
                icon={<Briefcase size={40} />}
                title="최근 근태 이슈가 없습니다."
                description="지각 · 노쇼가 기록되면 여기에 모아 보여 드립니다."
              />
            ) : (
              <ul className="divide-y divide-border-main">
                {attendanceIssues.map((issue) => (
                  <li
                    key={issue.assignmentId}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <Warning size={16} className="shrink-0 text-warning" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-font-1">
                        {issue.staffName}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-font-2">
                        {issue.eventTitle} · {formatDate(issue.workDate)}
                      </p>
                    </div>

                    <Badge tone={ATTENDANCE_STATUS_TONE[issue.type]}>
                      {ATTENDANCE_STATUS_LABEL[issue.type]}
                      {issue.lateMinutes > 0 && ` ${issue.lateMinutes}분`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Alert tone="info" title="다음 단계">
          지금은 사내에서만 쓰는 웹입니다. 이후 서버에 올리고 앱에서 공고를
          띄우면, 지원 접수 · 블랙리스트 · 인사 이력이 이 시스템에 자동으로
          쌓입니다.
        </Alert>
      </div>
    </>
  );
};

export default DashboardOverview;
