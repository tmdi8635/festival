"use client";

import { useMemo, useState } from "react";
import { useMyAssignmentListQuery } from "@/api/my/getMySchedule";
import { useMyApplicationListQuery } from "@/api/my/getMyRecruit";
import { ChevronLeft, ChevronRight } from "@/icons";
import { formatKoreanDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { toDateKey } from "@/type/event";
import { isClosedWork, type MyApplication, type MyWork } from "@/type/my";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import Skeleton from "@/components/ui/Skeleton";
import MyWorkCard from "@/app/(portal)/_components/MyWorkCard";
import PostingDetailModal from "@/app/(portal)/_components/PostingDetailModal";
import MyApplicationCard from "./MyApplicationCard";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface MonthCursor {
  year: number;
  /** 0부터 (Date와 같다) */
  month: number;
}

const monthPrefix = ({ year, month }: MonthCursor) =>
  `${year}-${String(month + 1).padStart(2, "0")}`;

/**
 * 한 달치 칸. 앞뒤 빈칸을 채워 **언제나 7의 배수**가 되게 한다.
 *
 * 날짜 키는 `toDateKey`로 만든다. `toISOString()`은 한국 시간 자정을 전날로 바꿔,
 * 달력 전체가 하루씩 밀린다. (`docs/DEVELOPMENT_GUIDE.md` 12-3장)
 */
const buildMonthCells = ({ year, month }: MonthCursor): (string | null)[] => {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toDateKey(new Date(year, month, day)));
  }

  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
};

/** 날짜별로 묶는다. 한 건이 여러 날에 걸치면(지원) 그날마다 들어간다. */
const groupByDate = <T,>(items: T[], datesOf: (item: T) => string[]) => {
  const map = new Map<string, T[]>();

  items.forEach((item) => {
    datesOf(item).forEach((date) => {
      map.set(date, [...(map.get(date) ?? []), item]);
    });
  });

  return map;
};

/**
 * 내 일정 캘린더.
 *
 * - 확정된 근무는 **시작 시각**을 칸에 적는다. 점만 찍으면 몇 시에 나가는지 보려고
 *   날짜를 하나하나 눌러야 한다. 지난 근무는 흐리게 둔다.
 * - 검토 대기인 지원은 **점선**이다. 확정과 같은 모양으로 그리면 그날이 잡힌 줄 알고
 *   다른 일을 거절한다. (지원의 근무일 전체에 그린다 — 3일짜리에 지원했으면 3칸이다)
 * - 한 주는 이레다. 폭이 좁아도 **7칸을 줄이지 않는다.** (가이드 13-1장)
 * - 날짜를 누르면 아래에 그날의 근무 카드가 선다. 출근 버튼 · 담당자 전화까지
 *   리스트와 같은 카드를 쓴다 — 보는 방식만 다르고 할 수 있는 일은 같아야 한다.
 */
const MyScheduleCalendar = () => {
  const today = toDateKey(new Date());

  const [cursor, setCursor] = useState<MonthCursor>(() => {
    const now = new Date();

    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [selectedPostingId, setSelectedPostingId] = useState<number | null>(null);

  /* 지난 근무와 앞으로의 근무를 한 장에 그려야 하므로 `ALL`로 받는다. */
  const { data: assignmentData, isLoading: isAssignmentLoading } =
    useMyAssignmentListQuery("ALL");
  const { data: applicationData, isLoading: isApplicationLoading } =
    useMyApplicationListQuery();

  const worksByDate = useMemo(
    () =>
      groupByDate<MyWork>(assignmentData?.items ?? [], (work) => [work.workDate]),
    [assignmentData],
  );

  /* 달력에는 **아직 결과가 안 난** 지원만 그린다. 확정된 것은 근무로 이미 서 있다. */
  const pendingByDate = useMemo(
    () =>
      groupByDate<MyApplication>(
        (applicationData?.items ?? []).filter(
          (application) => application.status === "PENDING",
        ),
        (application) =>
          application.workDates.length > 0
            ? application.workDates
            : [application.workDate],
      ),
    [applicationData],
  );

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);

  const prefix = monthPrefix(cursor);
  const isCurrentMonth = today.startsWith(prefix);

  const monthSummary = useMemo(() => {
    /* 취소 · 노쇼한 날은 '확정'으로 세지 않는다. 나가지 않는 날이다. */
    const workDays = [...worksByDate.entries()].filter(
      ([date, works]) =>
        date.startsWith(prefix) && works.some((work) => !isClosedWork(work)),
    ).length;
    const pendingIds = new Set<number>();

    pendingByDate.forEach((items, date) => {
      if (!date.startsWith(prefix)) return;
      items.forEach((item) => pendingIds.add(item.applicationId));
    });

    return { workDays, pendingCount: pendingIds.size };
  }, [worksByDate, pendingByDate, prefix]);

  /*
    달을 옮기면 **그달에서 볼 만한 날**을 골라 둔다. 이번 달이면 오늘,
    다른 달이면 일정이 있는 첫날. 선택이 이전 달에 남아 있으면 아래 목록이
    화면의 달력과 다른 달을 이야기한다.
  */
  const moveTo = (next: MonthCursor) => {
    const nextPrefix = monthPrefix(next);

    setCursor(next);

    if (today.startsWith(nextPrefix)) {
      setSelectedDate(today);
      return;
    }

    const firstScheduled = [...worksByDate.keys(), ...pendingByDate.keys()]
      .filter((date) => date.startsWith(nextPrefix))
      .sort()[0];

    setSelectedDate(firstScheduled ?? null);
  };

  const moveMonth = (delta: number) => {
    const date = new Date(cursor.year, cursor.month + delta, 1);

    moveTo({ year: date.getFullYear(), month: date.getMonth() });
  };

  const goToday = () => {
    const now = new Date();

    moveTo({ year: now.getFullYear(), month: now.getMonth() });
  };

  const selectedWorks = selectedDate ? (worksByDate.get(selectedDate) ?? []) : [];
  const selectedPending = selectedDate
    ? (pendingByDate.get(selectedDate) ?? [])
    : [];

  const isLoading = isAssignmentLoading || isApplicationLoading;

  return (
    <>
      <Card bodyClassName="p-4">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-font-0 tabular-nums">
              {cursor.year}년 {cursor.month + 1}월
            </p>
            <p className="text-[12px] text-font-2 tabular-nums">
              {isLoading
                ? "일정을 불러오는 중"
                : `확정 ${monthSummary.workDays}일 · 지원 ${monthSummary.pendingCount}건`}
            </p>
          </div>

          <IconButton
            label="이전 달"
            icon={<ChevronLeft size={18} />}
            onClick={() => moveMonth(-1)}
          />
          <Button size="sm" variant="ghost" onClick={goToday} disabled={isCurrentMonth}>
            오늘
          </Button>
          <IconButton
            label="다음 달"
            icon={<ChevronRight size={18} />}
            onClick={() => moveMonth(1)}
          />
        </div>

        <div className="mt-3 grid grid-cols-7">
          {WEEKDAYS.map((weekday, index) => (
            <span
              key={weekday}
              className={cn(
                "py-1.5 text-center text-[12px] font-medium",
                index === 0 ? "text-danger" : index === 6 ? "text-info" : "text-font-2",
              )}
            >
              {weekday}
            </span>
          ))}

          {cells.map((date, index) => {
            if (!date) return <span key={`blank-${index}`} aria-hidden />;

            const weekday = index % 7;
            const works = worksByDate.get(date) ?? [];
            const pending = pendingByDate.get(date) ?? [];
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const isPast = date < today;
            /* 살아 있는 근무를 앞에 세운다. 취소한 건이 칸을 차지하면 그날 일이 없는 줄 안다. */
            const firstWork =
              works.find((work) => !isClosedWork(work)) ?? works[0];
            const isFirstClosed = firstWork ? isClosedWork(firstWork) : false;

            return (
              <button
                key={date}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${formatKoreanDate(date)}${
                  works.length > 0 ? ` 근무 ${works.length}건` : ""
                }${pending.length > 0 ? ` 지원 ${pending.length}건` : ""}`}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex min-h-16 min-w-0 flex-col items-center gap-0.5 rounded-field px-0.5 py-1 transition",
                  isSelected
                    ? "bg-surface-selected ring-1 ring-brand"
                    : "hover:bg-surface-hover",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-[13px] tabular-nums",
                    isToday
                      ? "bg-brand font-semibold text-font-4"
                      : weekday === 0
                        ? "text-danger"
                        : weekday === 6
                          ? "text-info"
                          : "text-font-1",
                    !isToday && isPast && "opacity-60",
                  )}
                >
                  {Number(date.slice(8))}
                </span>

                {firstWork && (
                  <span
                    className={cn(
                      "w-full truncate rounded-full px-0.5 text-center text-[11px] leading-4 tabular-nums",
                      isFirstClosed
                        ? "bg-danger-bg text-danger line-through"
                        : isPast
                          ? "bg-subtle text-font-2"
                          : "bg-brand-opacity font-medium text-brand",
                    )}
                  >
                    {firstWork.startTime}
                    {works.length > 1 && `+${works.length - 1}`}
                  </span>
                )}

                {pending.length > 0 && (
                  <span className="w-full truncate rounded-full border border-dashed border-warning px-0.5 text-center text-[11px] leading-4 text-warning">
                    지원
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 범례. 점선이 무슨 뜻인지 모르면 확정된 근무로 읽는다. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border-main pt-3 text-[12px] text-font-2">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-full bg-brand-opacity" />
            확정 근무
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-full bg-subtle ring-1 ring-border-main" />
            지난 근무
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-full bg-danger-bg" />
            취소 · 노쇼
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-full border border-dashed border-warning" />
            지원 · 검토 대기
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-brand" />
            오늘
          </span>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        {!selectedDate ? (
          <Card>
            <EmptyState
              title="날짜를 눌러 보세요."
              description="그날의 근무와 지원한 공고가 여기에 나옵니다."
            />
          </Card>
        ) : (
          <>
            <h2 className="text-[15px] font-semibold text-font-0">
              {formatKoreanDate(selectedDate)}
              {selectedDate === today && (
                <span className="ml-1.5 text-[13px] font-medium text-brand">오늘</span>
              )}
            </h2>

            {isLoading ? (
              <Skeleton className="h-44 w-full rounded-card" />
            ) : selectedWorks.length === 0 && selectedPending.length === 0 ? (
              <Card>
                <EmptyState
                  title="이날은 일정이 없어요."
                  description={
                    selectedDate >= today
                      ? "공고에서 원하는 자리에 지원해 보세요."
                      : "이날 선 근무가 없습니다."
                  }
                />
              </Card>
            ) : (
              <>
                {selectedWorks.map((work) => (
                  <MyWorkCard key={work.assignmentId} work={work} />
                ))}

                {selectedPending.map((application) => (
                  <MyApplicationCard
                    key={application.applicationId}
                    application={application}
                    onOpenDetail={setSelectedPostingId}
                  />
                ))}
              </>
            )}
          </>
        )}
      </section>

      {selectedPostingId !== null && (
        <PostingDetailModal
          postingId={selectedPostingId}
          onClose={() => setSelectedPostingId(null)}
        />
      )}
    </>
  );
};

export default MyScheduleCalendar;
