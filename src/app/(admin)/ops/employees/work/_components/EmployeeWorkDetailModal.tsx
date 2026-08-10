"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Calendar, Clock, ExternalLink } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import {
  confirmedHoursOf,
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
import Switch from "@/components/ui/Switch";

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

/**
 * 예정분 막대.
 *
 * 확정분과 **같은 색 계열로는 안 된다.** 옅게만 칠하면 화면 밝기나 사람에 따라
 * 경계가 안 보여서, 결국 하나의 막대로 읽고 전부 확정된 근무로 착각한다.
 * 그래서 색을 바꾸고(브랜드 컬러) 빗금을 넣어 **두 번 다르게** 만든다.
 * 빗금은 색을 구분하기 어려운 사람에게도 남는 신호다.
 */
const SCHEDULED_BAR_CLASS =
  "bg-brand/45 bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgba(255,255,255,0.55)_5px_10px)]";

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
    <span className={cn("text-[17px] font-bold tabular-nums", TEXT_TONE[tone])}>
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
 *
 * ## 확정과 예정을 한 막대 안에서 가른다
 *
 * 이 달의 근무에는 두 가지가 섞여 있다. 이미 출퇴근이 찍힌 **확정된 시간**과,
 * 아직 오지 않았거나 기록되지 않아 **발주 시간으로 센 시간**이다.
 * 두 개를 더해서 하나로 보여 주면 "이 사람은 이번 달에 이만큼 일했다"로 읽히고,
 * 그 숫자로 다음 달 배치를 정하게 된다. 반대로 예정을 빼 버리면 월초에는
 * 모두가 텅 빈 것처럼 보여 **이미 잡혀 있는 일정**이 안 보인다.
 *
 * 그래서 한 막대 안에 이어 그리되 색과 무늬를 다르게 하고, 예정을 셈에서
 * 뺄지 말지는 **토글로 사람이 정한다.** 배치를 짜는 중이면 켜서 보고,
 * 실제로 얼마나 일했는지 확인할 때는 끈다.
 */
const EmployeeWorkDetailModal = ({
  row,
  onClose,
}: EmployeeWorkDetailModalProps) => {
  /**
   * 예정 시간을 셈에 넣을지.
   *
   * 기본은 **켜 둔다.** 이 창을 여는 대부분의 이유가 "다음 달 배치를 어떻게
   * 할까"이고, 그 판단에는 이미 잡혀 있는 일정까지 포함한 그림이 필요하다.
   */
  const [includeScheduled, setIncludeScheduled] = useState(true);

  const confirmedHours = row ? confirmedHoursOf(row) : 0;
  const scheduledHours = row?.scheduledHours ?? 0;
  const baseHours = row?.baseMonthlyHours ?? 0;

  /** 지금 세고 있는 시간. 토글이 정한다. */
  const countedHours = includeScheduled
    ? (row?.workedHours ?? 0)
    : confirmedHours;

  const summary = summarizeEmployeeHours({
    workedHours: countedHours,
    baseMonthlyHours: baseHours,
  });
  const tone = resolveEmployeeHourTone(summary.rate);

  /*
    막대는 **기준 시간을 100%로** 잡는다.
    확정분을 먼저 깔고 그 뒤에 예정분을 이어 붙인다. 둘을 합쳐 기준을 넘기면
    막대가 가득 차고, 넘긴 만큼은 아래 '초과' 숫자가 말한다.
  */
  const toPercent = (hours: number) =>
    baseHours > 0 ? Math.min(100, (hours / baseHours) * 100) : 0;

  const confirmedPercent = toPercent(confirmedHours);
  const scheduledPercent = includeScheduled
    ? Math.max(0, toPercent(confirmedHours + scheduledHours) - confirmedPercent)
    : 0;

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
                {countedHours}
                <span className="text-[15px] font-medium text-font-2">
                  {" "}
                  / {baseHours}시간
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

            {/*
              한 막대 안에 확정 → 예정 순으로 이어 그린다.
              따로 두 줄로 그리면 둘을 더한 길이가 눈에 안 들어와서
              "합쳐서 기준을 넘겼는지"를 읽을 수 없다.
            */}
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface">
              <div
                style={{ width: `${confirmedPercent}%` }}
                className={cn("h-full", BAR_TONE[tone])}
              />
              <div
                style={{ width: `${scheduledPercent}%` }}
                className={cn("h-full", SCHEDULED_BAR_CLASS)}
              />
            </div>

            {/* 막대의 두 색이 각각 무엇인지. 범례가 없으면 무늬만 남는다. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-font-2">
              <span className="flex items-center gap-1.5">
                <i
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    BAR_TONE[tone],
                  )}
                />
                확정{" "}
                <b className="font-semibold text-font-1 tabular-nums">
                  {confirmedHours}시간
                </b>
              </span>

              <span className="flex items-center gap-1.5">
                <i
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    SCHEDULED_BAR_CLASS,
                  )}
                />
                예정(발주 기준){" "}
                <b className="font-semibold text-font-1 tabular-nums">
                  {scheduledHours}시간
                </b>
              </span>
            </div>

            {/*
              예정을 셈에 넣을지 사람이 정한다.

              배치를 짜는 중이면 이미 잡혀 있는 일정까지 봐야 하고,
              "실제로 얼마나 일했나"를 확인할 때는 확정된 것만 봐야 한다.
              한쪽으로 고정하면 반드시 다른 한쪽이 틀린 화면이 된다.
            */}
            <div className="flex items-center justify-between gap-3 rounded-field border border-border-main bg-surface px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] text-font-1">예정 시간 포함</p>
                <p className="mt-0.5 text-[12px] text-font-2">
                  출퇴근이 아직 안 찍힌 근무를 발주 시간으로 더해서 봅니다.
                </p>
              </div>

              <Switch
                label="예정 시간 포함"
                checked={includeScheduled}
                onChange={setIncludeScheduled}
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
              <Stat
                label="확정"
                value={`${confirmedHours}시간`}
                hint={
                  scheduledHours > 0
                    ? `예정 ${scheduledHours}시간 별도`
                    : "전부 확정"
                }
                tone={scheduledHours > 0 ? "warning" : "default"}
              />
            </div>
          </div>

          {/* 어느 현장에 나갔는가. 이 모달의 본문이다. */}
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-font-1">
              <Calendar size={14} className="text-font-2" />
              참여 행사
              <span className="font-normal text-font-2">
                최근에 나간 순서입니다.
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
                    {/*
                      행사는 **새 탭**으로 연다.

                      이 목록은 모달 안에 있다. 같은 탭에서 넘어가면 보고 있던
                      근무 상세가 통째로 사라지고, 돌아오려면 달을 다시 고르고
                      사람을 다시 찾아야 한다. 여기서 하는 일은 "어느 현장이
                      길었나"를 훑는 것이라 원래 화면이 남아 있어야 한다.
                    */}
                    <Link
                      href={`/schedule/events/${event.eventId}`}
                      target="_blank"
                      rel="noreferrer"
                      title="새 탭에서 행사 상세를 엽니다."
                      className="flex items-center gap-3 rounded-card border border-border-main px-4 py-3 transition hover:-translate-y-px hover:border-brand hover:bg-surface-hover hover:shadow-card"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-font-1">
                          {event.eventTitle}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-font-2">
                          <span className="truncate">{event.clientName}</span>
                          {/*
                            **이 달에 나간 날짜만** 적는다.
                            07.28~08.01 행사라면 7월에는 07.28~07.31이,
                            8월에는 08.01이 적힌다. 행사 전체 기간을 적으면
                            이 달 집계에 없는 근무까지 센 것처럼 보인다.
                          */}
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

                      <ExternalLink size={15} className="shrink-0 text-font-2" />
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
