"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, ChevronRight, Clock } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import {
  formatMonthLabel,
  resolveEmployeeHourTone,
  summarizeEmployeeHours,
  type EmployeeWorkRow,
} from "@/type/employee";
import { formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";

interface EmployeeWorkDetailModalProps {
  row: EmployeeWorkRow | null;
  onClose: () => void;
}

const TEXT_TONE = {
  default: "text-font-0",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

const BAR_TONE = {
  default: "bg-font-2",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

/** 요약 한 칸 */
const Stat = ({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof TEXT_TONE;
}) => (
  <div className="flex flex-col gap-0.5 rounded-field border border-border-main bg-surface px-3 py-2.5">
    <span className="text-[12px] text-font-2">{label}</span>
    <span
      className={cn(
        "text-[17px] font-bold tabular-nums",
        TEXT_TONE[tone],
      )}
    >
      {value}
    </span>
    {hint && <span className="text-[11px] text-font-2">{hint}</span>}
  </div>
);

/**
 * 직원 한 명의 그 달 근무 상세.
 *
 * 표 아래에 한 줄씩 붙여 놓았더니 **행사 이름과 시간이 좌우 끝으로 벌어져**
 * 눈이 가로로 왔다 갔다 해야 했고, 표 폭에 눌려 행사명이 잘렸다.
 * 여기서 하려는 일은 "초과가 났는데 어느 현장이 길었나"를 찾는 것이라,
 * 그 목록이 본문이 되는 자리가 따로 있어야 한다.
 *
 * 그래서 모달로 올리고 **행사 하나를 카드 한 장**으로 만든다.
 * 근무일 · 시간 · 예정 기준 여부가 카드 안에서 위아래로 정리되고,
 * 카드를 누르면 그 행사로 바로 넘어간다.
 */
const EmployeeWorkDetailModal = ({
  row,
  onClose,
}: EmployeeWorkDetailModalProps) => {
  const summary = row
    ? summarizeEmployeeHours(row)
    : { rate: 0, remainingHours: 0, overHours: 0, isOver: false };
  const tone = resolveEmployeeHourTone(summary.rate);

  return (
    <Modal
      isOpen={Boolean(row)}
      onClose={onClose}
      title="근무 상세"
      description={row ? `${formatMonthLabel(row.month)} 기준입니다.` : undefined}
      size="lg"
      onSubmit={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
      }
    >
      {row && (
        <div className="flex flex-col gap-4">
          {/* 누구인가. 모달을 열고 나서 "누구 거였지"를 다시 묻지 않게 한다. */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-subtle">
              {row.profileImageUrl && (
                <Image
                  src={row.profileImageUrl}
                  alt=""
                  fill
                  sizes="44px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>

            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-[16px] font-semibold text-font-0">
                {row.name}
                <Badge tone="info">{row.position}</Badge>
                {!row.isActive && <Badge tone="neutral">퇴사</Badge>}
              </p>
              <p className="mt-0.5 text-[12px] text-font-2 tabular-nums">
                {formatPhoneNumber(row.phoneNumber)}
              </p>
            </div>
          </div>

          {/* 채움 막대. 이 달을 한 줄로 요약하는 자리다. */}
          <div className="flex flex-col gap-2 rounded-card border border-border-main bg-subtle p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-[20px] font-bold tabular-nums",
                  TEXT_TONE[tone],
                )}
              >
                {row.workedHours}
                <span className="text-[15px] font-medium text-font-2">
                  {" "}
                  / {row.baseMonthlyHours}시간
                </span>
              </span>
              <span
                className={cn(
                  "text-[15px] font-semibold tabular-nums",
                  TEXT_TONE[tone],
                )}
              >
                {summary.rate}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className={cn("h-full rounded-full", BAR_TONE[tone])}
                style={{ width: `${Math.min(100, summary.rate)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
              <Stat
                label={summary.isOver ? "초과" : "남은 시간"}
                value={`${summary.isOver ? summary.overHours : summary.remainingHours}시간`}
                tone={summary.isOver ? "danger" : "default"}
              />
              <Stat label="근무일" value={`${row.workedDays}일`} />
              <Stat label="참여 행사" value={`${row.events.length}건`} />
              {/*
                출퇴근이 안 찍힌 날은 행사 예정 시간으로 셌다.
                그 사실을 적지 않으면 확정된 숫자로 읽고 다음 달 배치를 정하게 된다.
              */}
              <Stat
                label="예정 기준"
                value={`${row.scheduledHours}시간`}
                hint={
                  row.scheduledHours > 0 ? "아직 확정이 아닙니다." : "전부 확정"
                }
                tone={row.scheduledHours > 0 ? "warning" : "default"}
              />
            </div>
          </div>

          {/* 어느 현장이 길었는가. 이 모달의 본문이다. */}
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-font-1">
              <Calendar size={14} className="text-font-2" />
              참여 행사
              <span className="font-normal text-font-2">
                근무시간이 긴 순서입니다.
              </span>
            </p>

            {row.events.length === 0 ? (
              <EmptyState
                icon={<Clock size={36} />}
                title="이 달에 나간 현장이 없습니다."
                description="배치가 잡히면 여기에 행사별 근무시간이 쌓입니다."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {row.events.map((event) => (
                  <li key={event.eventId}>
                    <Link
                      href={`/schedule/events/${event.eventId}`}
                      className="flex items-center gap-3 rounded-card border border-border-main px-4 py-3 transition hover:-translate-y-px hover:border-brand hover:bg-surface-hover hover:shadow-card"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-font-1">
                          {event.eventTitle}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-font-2">
                          <span className="truncate">{event.clientName}</span>
                          <span className="tabular-nums">
                            {formatDate(event.workDates[0])}
                            {event.workDates.length > 1 &&
                              ` ~ ${formatDate(
                                event.workDates[event.workDates.length - 1],
                              )}`}
                          </span>
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[15px] font-semibold text-font-0 tabular-nums">
                          {event.workHours}시간
                        </p>
                        <p className="mt-0.5 text-[12px] text-font-2 tabular-nums">
                          {event.workDates.length}일
                          {event.scheduledHours > 0 && (
                            <span className="text-warning">
                              {" "}
                              · 예정 {event.scheduledHours}
                            </span>
                          )}
                        </p>
                      </div>

                      <ChevronRight size={16} className="shrink-0 text-font-2" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default EmployeeWorkDetailModal;
