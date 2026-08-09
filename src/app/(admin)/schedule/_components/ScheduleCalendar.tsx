"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useClientListQuery } from "@/api/client/getClientList";
import { useEventCalendarQuery } from "@/api/event/getEventCalendar";
import { EVENT_STATUS_FILTER_OPTIONS } from "@/constants/eventOptions";
import { ChevronLeft, ChevronRight, Plus } from "@/icons";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import {
  groupConsecutiveDates,
  type CalendarEvent,
  type EventStatus,
} from "@/type/event";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import EventFormModal from "@/components/domain/EventFormModal";
import StaffDetailModal from "@/components/domain/StaffDetailModal";
import CalendarEventChip from "./CalendarEventChip";
import MultiDayEventBar from "./MultiDayEventBar";

type CalendarView = "MONTH" | "WEEK";

/**
 * 칸에 얼마나 펼쳐 보여 줄지.
 *
 * 간략히 보기는 "이번 달에 무슨 일이 있나"를 훑는 용도,
 * 자세히 보기는 "그날 누가 나오나"를 확인하는 용도다.
 * 자세히 보기에서 칸이 커지더라도 명단을 한 번에 볼 수 있어야
 * 행사를 하나씩 열어 보는 일이 없어진다.
 */
type CalendarDensity = "BRIEF" | "DETAILED";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** 이어지는 근무일 막대 한 줄의 높이(px). 셀 상단에 이만큼씩 자리를 비워 둔다. */
const BAR_LANE_HEIGHT = 24;

/** 날짜 숫자가 들어가는 셀 상단 높이(px) */
const CELL_HEADER_HEIGHT = 28;

/** 주 안에서 이어지는 근무일 구간 */
interface BarSegment {
  event: CalendarEvent;
  /** 이 주에서 시작하는 열 (0=일요일) */
  startColumn: number;
  /** 차지하는 열 수 */
  span: number;
  /** 이 구간의 근무일 수 */
  segmentDayCount: number;
  /** 겹치지 않도록 배정된 줄 번호 */
  lane: number;
  isContinuedFromPrevWeek: boolean;
  isContinuedToNextWeek: boolean;
  key: string;
}

/**
 * 한 주에 걸치는 근무일 구간을 막대로 만든다.
 *
 * 예전에는 startDate~endDate를 통으로 한 막대로 그렸다.
 * 그런데 "매주 주말만" 하는 행사는 그 사이 평일에 아무도 안 나오는데
 * 캘린더에는 한 달 내내 일하는 것처럼 보였다.
 *
 * 그래서 실제 근무일(dates)을 **이어지는 구간으로 쪼갠 뒤** 막대를 그린다.
 * 토·일만 하는 행사는 주말마다 두 칸짜리 막대가 하나씩 생긴다.
 */
const buildBarSegments = (
  weekStart: dayjs.Dayjs,
  events: CalendarEvent[],
): BarSegment[] => {
  const weekEnd = weekStart.add(6, "day");
  const weekStartDate = weekStart.format("YYYY-MM-DD");
  const weekEndDate = weekEnd.format("YYYY-MM-DD");

  const candidates = events.flatMap((event) =>
    groupConsecutiveDates(event.dates)
      // 하루짜리 구간은 막대로 그리지 않는다. 날짜 칸 안의 카드가 더 잘 읽힌다.
      .filter(
        (group) =>
          group.dayCount > 1 &&
          group.start <= weekEndDate &&
          group.end >= weekStartDate,
      )
      .map((group) => ({ event, group })),
  );

  const sorted = candidates.sort(
    (a, b) =>
      a.group.start.localeCompare(b.group.start) ||
      b.group.dayCount - a.group.dayCount,
  );

  /** lane 번호 → 그 줄에서 이미 채워진 마지막 열 */
  const laneLastColumn: number[] = [];

  return sorted.map(({ event, group }) => {
    const segmentStart = dayjs(
      group.start < weekStartDate ? weekStartDate : group.start,
    );
    const segmentEnd = dayjs(group.end > weekEndDate ? weekEndDate : group.end);

    const startColumn = segmentStart.diff(weekStart, "day");
    const span = segmentEnd.diff(segmentStart, "day") + 1;

    let lane = laneLastColumn.findIndex(
      (lastColumn) => lastColumn < startColumn,
    );

    if (lane === -1) lane = laneLastColumn.length;

    laneLastColumn[lane] = startColumn + span - 1;

    return {
      event,
      startColumn,
      span,
      segmentDayCount: group.dayCount,
      lane,
      isContinuedFromPrevWeek: group.start < weekStartDate,
      isContinuedToNextWeek: group.end > weekEndDate,
      key: `${event.eventId}-${group.start}`,
    };
  });
};

/**
 * 행사 캘린더.
 *
 * 월간 뷰는 "이번 달에 무슨 일이 있나", 주간 뷰는 "이번 주 어디가 비었나"를 본다.
 * 이어지는 근무일은 하나의 막대로 그리고, 띄엄띄엄한 반복 일정은
 * 실제로 나가는 구간에만 막대를 그린다.
 */
const ScheduleCalendar = () => {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>("MONTH");
  const [density, setDensity] = useState<CalendarDensity>("BRIEF");
  const [cursor, setCursor] = useState(() => dayjs());
  const [status, setStatus] = useState<EventStatus | "">("");
  const [clientId, setClientId] = useState("");

  const [detailStaffId, setDetailStaffId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDate, setFormDate] = useState<string | undefined>(undefined);

  /** 캘린더는 "언제"만 본다. 행사 하나를 처리하는 일은 상세 페이지가 맡는다. */
  const openDetail = (eventId: number) =>
    router.push(`/schedule/events/${eventId}`);

  /** 월간 뷰는 앞뒤 달의 잘린 주까지 그려야 격자가 깨지지 않는다. */
  const range = useMemo(() => {
    if (view === "WEEK") {
      return {
        from: cursor.startOf("week").format("YYYY-MM-DD"),
        to: cursor.endOf("week").format("YYYY-MM-DD"),
      };
    }

    return {
      from: cursor.startOf("month").startOf("week").format("YYYY-MM-DD"),
      to: cursor.endOf("month").endOf("week").format("YYYY-MM-DD"),
    };
  }, [cursor, view]);

  const { data, isLoading } = useEventCalendarQuery({
    from: range.from,
    to: range.to,
    status: status || undefined,
    clientId: clientId || undefined,
  });

  const { data: clientData } = useClientListQuery({ page: 1, size: 100 });

  const clientOptions = [
    { label: "전체 거래처", value: "" },
    ...(clientData?.content ?? []).map((client) => ({
      label: client.name,
      value: String(client.clientId),
    })),
  ];

  const calendarEvents = useMemo(() => data?.items ?? [], [data]);

  /**
   * 날짜 칸 안에 넣을 행사.
   *
   * 이어지는 구간(2일 이상)은 막대로 따로 그리므로, 칸에는 그 구간에 속하지 않는
   * 하루짜리 근무일만 넣는다. 그래야 같은 행사가 두 번 보이지 않는다.
   */
  const singleDayEventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    calendarEvents.forEach((event) => {
      groupConsecutiveDates(event.dates)
        .filter((group) => group.dayCount === 1)
        .forEach((group) => {
          const bucket = grouped.get(group.start) ?? [];
          bucket.push(event);
          grouped.set(group.start, bucket);
        });
    });

    grouped.forEach((events) =>
      events.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    );

    return grouped;
  }, [calendarEvents]);

  /** 주 단위로 잘라 둔다. 막대를 그리려면 주가 렌더링 단위여야 한다. */
  const weeks = useMemo(() => {
    const start = dayjs(range.from);
    const end = dayjs(range.to);
    const weekCount = Math.ceil((end.diff(start, "day") + 1) / 7);

    return Array.from({ length: weekCount }, (_, weekIndex) => {
      const weekStart = start.add(weekIndex * 7, "day");

      return {
        weekStart,
        days: Array.from({ length: 7 }, (_, dayIndex) =>
          weekStart.add(dayIndex, "day"),
        ),
        segments: buildBarSegments(weekStart, calendarEvents),
      };
    });
  }, [range, calendarEvents]);

  const today = dayjs().format("YYYY-MM-DD");
  const isDetailed = density === "DETAILED";

  /** 이번 기간의 미충원 자리 수. 캘린더 위에서 바로 알려 준다. */
  const openSlotCount = calendarEvents.reduce(
    (sum, event) => sum + Math.max(0, event.totalRequired - event.totalAssigned),
    0,
  );

  const handleMove = (direction: -1 | 1) => {
    setCursor((prev) =>
      view === "WEEK"
        ? prev.add(direction, "week")
        : prev.add(direction, "month"),
    );
  };

  const handleOpenForm = (date?: string) => {
    setFormDate(date);
    setIsFormOpen(true);
  };

  return (
    <>
      <Card noPadding>
        <div className="flex flex-wrap items-center justify-start gap-2.5 border-b border-border-main px-4 py-3 lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-field border border-border-main p-0.5">
              <button
                type="button"
                aria-label="이전 기간"
                onClick={() => handleMove(-1)}
                className="flex size-8 items-center justify-center rounded-[7px] text-font-2 transition hover:bg-surface-hover hover:text-font-1"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label="다음 기간"
                onClick={() => handleMove(1)}
                className="flex size-8 items-center justify-center rounded-[7px] text-font-2 transition hover:bg-surface-hover hover:text-font-1"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <p className="text-[17px] font-semibold text-font-0 tabular-nums">
              {view === "WEEK"
                ? `${cursor.startOf("week").format("YYYY.MM.DD")} ~ ${cursor.endOf("week").format("MM.DD")}`
                : cursor.format("YYYY년 M월")}
            </p>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCursor(dayjs())}
            >
              오늘
            </Button>

            {openSlotCount > 0 && (
              <p className="text-[13px] text-danger tabular-nums">
                미충원 {openSlotCount}자리
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 간략히 / 자세히 보기 */}
            <div className="flex items-center rounded-field border border-border-main p-0.5">
              {(
                [
                  { value: "BRIEF", label: "간략히" },
                  { value: "DETAILED", label: "자세히" },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={
                    item.value === "DETAILED"
                      ? "행사마다 배치된 인력 명단까지 펼쳐 봅니다."
                      : "행사명과 충원 현황만 간단히 봅니다."
                  }
                  onClick={() => setDensity(item.value)}
                  className={cn(
                    "rounded-[7px] px-2.5 py-1 text-[13px] transition",
                    density === item.value
                      ? "bg-surface-selected font-medium text-brand"
                      : "text-font-2 hover:bg-surface-hover hover:text-font-1",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center rounded-field border border-border-main p-0.5">
              {(["MONTH", "WEEK"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  className={cn(
                    "rounded-[7px] px-2.5 py-1 text-[13px] transition",
                    view === item
                      ? "bg-surface-selected font-medium text-brand"
                      : "text-font-2 hover:bg-surface-hover hover:text-font-1",
                  )}
                >
                  {item === "MONTH" ? "월간" : "주간"}
                </button>
              ))}
            </div>

            <Select
              aria-label="거래처 필터"
              options={clientOptions}
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              selectBoxClassName="w-44"
            />

            <Select
              aria-label="상태 필터"
              options={EVENT_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as EventStatus | "")
              }
              selectBoxClassName="w-32"
            />

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => handleOpenForm()}
            >
              행사 등록
            </Button>
          </div>
        </div>

        {/*
          좁은 화면에서 한 주 7칸을 그대로 욱여넣으면 칸마다 글자가 두세 자씩만 남아
          무슨 행사인지 읽을 수 없다. 달력은 폭을 지키고 대신 가로로 스크롤한다.
          (막대는 주 컨테이너 기준 퍼센트로 놓이므로 최소 폭 위에서 그대로 맞는다)
        */}
        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b border-border-main bg-subtle">
              {WEEKDAY_LABELS.map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    "px-3 py-2 text-center text-[13px] font-medium",
                    index === 0 && "text-danger",
                    index === 6 && "text-info",
                    index !== 0 && index !== 6 && "text-font-2",
                  )}
                >
                  {label}
                </div>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: view === "WEEK" ? 7 : 35 }).map((_, index) => (
                  <div
                    key={index}
                    className="border-r border-b border-border-main p-2"
                  >
                    <Skeleton
                      className={cn("w-full", view === "WEEK" ? "h-40" : "h-24")}
                    />
                  </div>
                ))}
              </div>
            ) : (
              weeks.map(({ weekStart, days, segments }) => {
                const laneCount = segments.reduce(
                  (max, segment) => Math.max(max, segment.lane + 1),
                  0,
                );
                const barAreaHeight = laneCount * BAR_LANE_HEIGHT;

                return (
                  <div key={weekStart.format("YYYY-MM-DD")} className="relative">
                    <div className="grid grid-cols-7">
                      {days.map((day) => {
                        const date = day.format("YYYY-MM-DD");
                        const dayEvents = singleDayEventsByDate.get(date) ?? [];
                        const isCurrentMonth =
                          view === "WEEK" || day.isSame(cursor, "month");
                        const isToday = date === today;
                        const weekday = day.day();

                        return (
                          <div
                            key={date}
                            style={{ paddingTop: barAreaHeight }}
                            className={cn(
                              "group flex flex-col gap-1 border-r border-b border-border-main p-2",
                              /*
                                자세히 보기는 명단이 들어가 칸이 길어진다.
                                최소 높이만 키우고 잘라내지 않아야 "한 번에 보는" 목적이 산다.
                              */
                              view === "WEEK"
                                ? "min-h-56"
                                : isDetailed
                                  ? "min-h-44"
                                  : "min-h-28",
                              !isCurrentMonth && "bg-subtle",
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={cn(
                                  "flex size-6 items-center justify-center rounded-full text-[13px] tabular-nums",
                                  isToday && "bg-brand font-semibold text-font-4",
                                  !isToday && weekday === 0 && "text-danger",
                                  !isToday && weekday === 6 && "text-info",
                                  !isToday &&
                                    weekday !== 0 &&
                                    weekday !== 6 &&
                                    "text-font-1",
                                  !isCurrentMonth &&
                                    !isToday &&
                                    "text-font-disabled",
                                )}
                              >
                                {day.date()}
                              </span>

                              {/* 빈 날짜에서 바로 행사를 만들 수 있게 한다. */}
                              <button
                                type="button"
                                aria-label={`${date}에 행사 등록`}
                                onClick={() => handleOpenForm(date)}
                                className="flex size-6 items-center justify-center rounded-field text-font-disabled opacity-0 transition group-hover:opacity-100 hover:bg-surface-hover hover:text-brand"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <div className="flex flex-col gap-1">
                              {dayEvents.map((event) => (
                                <CalendarEventChip
                                  key={event.eventId}
                                  event={event}
                                  date={date}
                                  isDetailed={isDetailed || view === "WEEK"}
                                  onClick={() => openDetail(event.eventId)}
                                  onStaffClick={setDetailStaffId}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/*
                      이어지는 근무일 막대.
                      셀 위에 겹쳐 그리되, 셀이 그만큼 위쪽 여백을 비워 두므로 내용과 겹치지 않는다.
                    */}
                    {segments.map((segment) => (
                      <div
                        key={segment.key}
                        style={{
                          left: `calc(${(segment.startColumn / 7) * 100}% + 4px)`,
                          width: `calc(${(segment.span / 7) * 100}% - 8px)`,
                          top: CELL_HEADER_HEIGHT + segment.lane * BAR_LANE_HEIGHT,
                        }}
                        className="absolute"
                      >
                        <MultiDayEventBar
                          event={segment.event}
                          segmentDayCount={segment.segmentDayCount}
                          isContinuedFromPrevWeek={segment.isContinuedFromPrevWeek}
                          isContinuedToNextWeek={segment.isContinuedToNextWeek}
                          onClick={() => openDetail(segment.event.eventId)}
                        />
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      <StaffDetailModal
        staffId={detailStaffId}
        onClose={() => setDetailStaffId(null)}
      />

      <EventFormModal
        isOpen={isFormOpen}
        event={null}
        defaultDate={formDate}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
};

export default ScheduleCalendar;
