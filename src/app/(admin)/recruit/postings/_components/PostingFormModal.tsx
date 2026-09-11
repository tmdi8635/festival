"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { getEventDetail, useEventDetailQuery } from "@/api/event/getEventDetail";
import { usePostingMutation } from "@/api/recruit/mutatePosting";
import { Calendar, Plus } from "@/icons";
import { formatDate, formatKoreanDate } from "@/lib/dayjs";
import { showErrorToast } from "@/lib/toast";
import { cn, formatWithCommas } from "@/lib/utils";
import {
  EMPTY_POSTING_VALUES,
  postingSchema,
  type PostingSchema,
  type PostingSchemaInput,
} from "@/schema/recruit.schema";
import { jobRoleLabel as jobRoleLabelOf, useJobRoleLabel } from "@/store/useOrgStore";
import {
  GENDER_PREFERENCE_LABEL,
  SCHEDULE_RULE_LABEL,
  WAGE_TYPE_LABEL,
  describeRecurrence,
  findPosition,
  formatPositionLabel,
  formatTimeRange,
  resolvePositionWorkDates,
  type EventDetail,
  type EventPosition,
  type EventSummary,
} from "@/type/event";
import {
  formatDateList,
  formatLineLabel,
  resolveLineDates,
  suggestPostingTargets,
  type JobPosting,
  type PostingParticipation,
  type PostingTargetInput,
} from "@/type/recruit";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import CopyButton from "@/components/domain/CopyButton";
import DateChips from "@/components/domain/DateChips";
import EventPickerModal from "@/components/domain/EventPickerModal";

interface PostingFormModalProps {
  isOpen: boolean;
  posting: JobPosting | null;
  onClose: () => void;
}

const PARTICIPATION_OPTIONS: { label: string; value: PostingParticipation }[] = [
  { label: "전일 참여", value: "FULL" },
  { label: "날짜 골라 지원", value: "SPLIT" },
];

/**
 * 포지션의 **날짜별** 부족 인원.
 *
 * 모집 줄을 어떻게 나눌지가 여기서 보인다. 사흘 모두 2명이 모자라면 전일 2명이면 되지만,
 * 둘째 날만 3명이 모자라면 나머지 1명은 그 날만 여는 줄로 뽑아야 한다.
 */
const shortageByDate = (event: EventDetail, positionId: number) =>
  event.days.flatMap((day) => {
    const slot = day.roles.find(
      (item) => item.positionId === positionId && item.requiredCount > 0,
    );

    return slot
      ? [{ date: day.date, count: Math.max(0, slot.requiredCount - slot.assignedCount) }]
      : [];
  });

/** 포지션 순서 → 전일 줄 먼저. 화면 · 제목 · 공고문이 같은 순서로 읽혀야 한다. */
const sortLines = (
  event: EventDetail,
  lines: PostingTargetInput[],
): PostingTargetInput[] =>
  [...lines].sort((a, b) => {
    const order =
      event.positions.findIndex((item) => item.positionId === a.positionId) -
      event.positions.findIndex((item) => item.positionId === b.positionId);

    if (order !== 0) return order;

    return a.participation === b.participation ? 0 : a.participation === "FULL" ? -1 : 1;
  });

/** 제목 · 공고문이 쓰는 줄 한 건. 포지션이 지워졌으면 없다. */
const toLabelLine = (event: EventDetail, line: PostingTargetInput) => {
  const position = findPosition(event, line.positionId);

  return position
    ? {
        position,
        name: position.name,
        requiredCount: line.requiredCount,
        participation: line.participation,
        dates: line.dates,
        isUrgent: line.isUrgent,
        workDates: resolveLineDates(event, line),
      }
    : undefined;
};

/**
 * 공고 제목. `행사명 · A타임 전일 2명 · [급구] A타임 09.13 1명`
 *
 * 관리자 목록에서 **무엇을 못 채웠는지** 한눈에 읽히게 인원을 붙인다.
 * 이 제목은 내부 표기다. 포털은 행사명(`eventTitle`)을 쓰고 인원은 내리지 않는다.
 */
const buildPostingTitle = (
  event: EventDetail,
  lines: readonly PostingTargetInput[],
): string =>
  [
    event.title,
    ...lines.flatMap((line) => {
      const label = toLabelLine(event, line);

      return label ? [formatLineLabel(label, event.dates.length)] : [];
    }),
  ].join(" · ");

/**
 * 공고문 초안.
 *
 * 오픈카톡방에 그대로 붙여넣는 글이다. 손으로 쓰다 보면 시급 · 집합 장소가 빠지고,
 * 무엇보다 **포지션마다 시각이 다르다는 사실**이 빠진다. 야간조 공고에 주간 시각만
 * 적히면 지원자는 당일 저녁에 끝나는 줄 안다. 줄마다 한 줄씩 적는다.
 *
 * 그리고 **전일인지 날짜를 고르는지를 말로 적는다.** 카톡방에서 본 사람은 앱의
 * 배지를 보지 못한다. 적어 두지 않으면 "하루만 되는데 지원해도 되나요?"가 줄마다 온다.
 *
 * 모집 인원은 적지 않는다. 몇 명이 모자란지는 우리 사정이고, 적어 두면 지원자가
 * "이미 찼겠지"하고 지원하지 않는다.
 */
const buildPostingContent = (
  event: EventDetail,
  lines: readonly PostingTargetInput[],
): string => {
  const dates =
    event.dates.length <= 4
      ? event.dates.map((date) => formatKoreanDate(date)).join(", ")
      : `${formatKoreanDate(event.dates[0])} ~ ${formatKoreanDate(
          event.dates[event.dates.length - 1],
        )} 중 ${event.dates.length}일 (${describeRecurrence(event.recurrence, event.dayCount)})`;

  const lineTexts = lines.flatMap((line) => {
    const label = toLabelLine(event, line);

    if (!label) return [];

    const { position, workDates } = label;
    const conditions = [
      position.genderPreference !== "ANY"
        ? GENDER_PREFERENCE_LABEL[position.genderPreference]
        : "",
      position.requiresHealthCert ? "보건증 필수" : "",
    ].filter(Boolean);
    const dateNote =
      workDates.length <= 1
        ? ""
        : line.participation === "FULL"
          ? `   └ 전 일정(${formatDateList(workDates)}) 모두 가능하신 분만`
          : `   └ ${formatDateList(workDates)} 중 가능한 날을 골라 지원 (하루도 가능)`;

    return [
      `· ${line.isUrgent ? "[급구] " : ""}${formatPositionLabel(position, jobRoleLabelOf)} ${formatTimeRange(
        position.startTime,
        position.endTime,
        position.endDayOffset,
      )} (휴게 ${position.breakMinutes}분) · ${WAGE_TYPE_LABEL[position.wageType]} ${formatWithCommas(position.wage)}원${
        conditions.length > 0 ? ` · ${conditions.join(" · ")}` : ""
      }`,
      ...(dateNote ? [dateNote] : []),
    ];
  });

  return [
    `[모집] ${event.title}`,
    "",
    `📅 근무일: ${dates}`,
    `📍 장소: ${event.venue}`,
    `   ${event.address}`,
    `🚩 집합: ${event.meetingPoint}`,
    `👕 복장: ${event.dressCode}`,
    event.belongings ? `🎒 준비물: ${event.belongings}` : "",
    "",
    "💼 모집 포지션",
    ...lineTexts,
    "",
    "※ 지원 시 이름 · 연락처 · 지원 포지션 · 가능한 날을 남겨 주세요.",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
};

/**
 * 새 줄의 초기값.
 *
 * - 전일 줄: 모든 날에 공통으로 모자란 수.
 * - 날짜 지정 줄: 모자란 날만 골라 두고, 인원은 그중 가장 많이 모자란 수.
 *   전일만 받는 포지션에 여는 날짜 줄은 그 자체로 예외라 **급구**로 시작한다.
 */
const buildNewLine = (
  event: EventDetail,
  position: EventPosition,
  participation: PostingParticipation,
): PostingTargetInput => {
  const shortages = shortageByDate(event, position.positionId);

  if (participation === "FULL") {
    return {
      positionId: position.positionId,
      requiredCount: Math.max(1, Math.min(...shortages.map((item) => item.count), 99)),
      participation: "FULL",
      isUrgent: false,
    };
  }

  const shortDates = shortages.filter((item) => item.count > 0);
  const positionDates = shortages.map((item) => item.date);
  const dates = shortDates.length > 0 ? shortDates.map((item) => item.date) : positionDates;

  return {
    positionId: position.positionId,
    requiredCount: Math.max(1, ...shortDates.map((item) => item.count)),
    participation: "SPLIT",
    /* 모든 날을 고른 것과 같으면 날짜를 비운다(= 전 기간, 지원자가 고른다). */
    dates: dates.length === positionDates.length ? undefined : dates,
    isUrgent: position.scheduleRule === "FULL_ONLY",
  };
};

/**
 * 공고 등록 · 수정 모달.
 *
 * 공고 하나는 **행사 하나**를 덮는다. 행사를 고르면 포지션마다 모집 줄이 깔린 채로
 * 시작한다(`suggestPostingTargets` — 목업 시드와 같은 규칙). 제목 · 공고문도 그에 맞춰
 * 자동으로 만들어지며, 사람이 고친 뒤에는 덮어쓰지 않는다.
 *
 * 한 포지션에 줄이 여럿일 수 있다. 업체가 원하는 전 일정 가능자는 전일 줄로,
 * 노쇼 · 급구로 하루만 비는 자리는 그 날만 여는 줄로 뽑는다.
 */
const PostingFormModal = ({
  isOpen,
  posting,
  onClose,
}: PostingFormModalProps) => {
  const queryClient = useQueryClient();
  const jobRoleLabel = useJobRoleLabel();
  const { createMutation, updateMutation } = usePostingMutation();

  /*
    피커에서 고른 행사. 수정으로 열었을 때는 비어 있고, 그때는 공고의 행사를 쓴다.
    예전에는 이 값만 보고 버튼을 그려서 **수정 모달에서 '행사를 선택하세요'가 떴다.**
  */
  const [pickedEvent, setPickedEvent] = useState<EventSummary | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
    // 입력 타입(coerce 전)과 출력 타입(coerce 후)이 달라 제네릭 세 개를 모두 넘긴다.
  } = useForm<PostingSchemaInput, unknown, PostingSchema>({
    resolver: zodResolver(postingSchema),
    defaultValues: EMPTY_POSTING_VALUES,
  });

  useEffect(() => {
    if (!isOpen) return;

    reset(
      posting
        ? {
            eventId: posting.eventId,
            title: posting.title,
            lines: posting.lines.map((line) => ({
              targetId: line.targetId,
              positionId: line.positionId,
              requiredCount: line.requiredCount,
              participation: line.participation,
              dates: line.dates,
              isUrgent: line.isUrgent,
            })),
            content: posting.content,
          }
        : EMPTY_POSTING_VALUES,
    );
  }, [isOpen, posting, reset]);

  const eventId = Number(watch("eventId")) || 0;
  const content = watch("content");
  const lines = (watch("lines") ?? []) as PostingTargetInput[];

  /* 포지션 · 발주 현황은 행사 상세에서 온다. (고를 때 미리 받아 두므로 대개 캐시에 있다) */
  const { data: event } = useEventDetailQuery(eventId > 0 ? eventId : null);

  const eventTitle =
    pickedEvent?.title ?? event?.title ?? posting?.eventTitle ?? "";
  const isMultiDay = (event?.dates.length ?? 0) > 1;

  const handleClose = () => {
    setPickedEvent(null);
    onClose();
  };

  /**
   * 줄이 바뀌면 제목 · 공고문을 다시 만든다. **사람이 고친 뒤에는 그대로 둔다.**
   *
   * 지금 값이 직전 줄로 자동 생성한 글과 같거나 비어 있으면 "아직 손대지 않았다"로 본다.
   * 담당자가 공고문에 한 줄 덧붙인 뒤 줄을 하나 더 넣었다고 그 줄이 사라지면 안 된다.
   */
  const applyLines = (
    source: EventDetail,
    previous: readonly PostingTargetInput[],
    next: PostingTargetInput[],
  ) => {
    const sorted = sortLines(source, next);
    const currentTitle = getValues("title") ?? "";
    const currentContent = getValues("content") ?? "";

    setValue("lines", sorted, { shouldValidate: Boolean(errors.lines) });

    if (!currentTitle || currentTitle === buildPostingTitle(source, previous)) {
      setValue("title", buildPostingTitle(source, sorted), {
        shouldValidate: Boolean(errors.title),
      });
    }

    if (
      !currentContent ||
      currentContent === buildPostingContent(source, previous)
    ) {
      setValue("content", buildPostingContent(source, sorted), {
        shouldValidate: Boolean(errors.content),
      });
    }
  };

  /**
   * 행사를 고른다.
   *
   * 기본 줄(부족 인원)을 정하려면 날짜별 발주가 있어야 해서 행사 상세를 받아 온다.
   * 효과(effect)로 기다리지 않고 여기서 곧바로 받는다 — 받는 동안 폼이 비어 보이지
   * 않도록 버튼에 불러오는 중을 띄운다.
   */
  const handleSelectEvent = async (summary: EventSummary) => {
    setPickedEvent(summary);
    setValue("eventId", summary.eventId, { shouldValidate: true });
    setIsLoadingEvent(true);

    try {
      const detail = await queryClient.fetchQuery({
        queryKey: ["get-event-detail", summary.eventId],
        queryFn: () => getEventDetail(summary.eventId),
      });

      /* 행사를 바꾸면 앞 행사의 제목 · 공고문은 뜻이 없으므로 새로 만든다. */
      const next = sortLines(detail, suggestPostingTargets(detail));

      setValue("lines", next, { shouldValidate: false });
      setValue("title", buildPostingTitle(detail, next));
      setValue("content", buildPostingContent(detail, next));
    } catch (error) {
      showErrorToast(error, "행사 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoadingEvent(false);
    }
  };

  const handleAddLine = (
    position: EventPosition,
    participation: PostingParticipation,
  ) => {
    if (!event) return;

    applyLines(event, lines, [...lines, buildNewLine(event, position, participation)]);
  };

  const handleUpdateLine = (index: number, patch: Partial<PostingTargetInput>) => {
    if (!event) return;

    applyLines(
      event,
      lines,
      lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  };

  const handleRemoveLine = (index: number) => {
    if (!event) return;

    applyLines(
      event,
      lines,
      lines.filter((_, lineIndex) => lineIndex !== index),
    );
  };

  /** 참여 방식을 바꾸면 날짜는 전 기간으로 되돌린다. 전일 줄에는 날짜가 없다. */
  const handleChangeParticipation = (
    index: number,
    participation: PostingParticipation,
  ) => handleUpdateLine(index, { participation, dates: undefined });

  const handleToggleLineDate = (index: number, date: string) => {
    if (!event) return;

    const line = lines[index];
    const positionDates = resolvePositionWorkDates(event, line.positionId);
    const current = line.dates ?? positionDates;
    const next = current.includes(date)
      ? current.filter((item) => item !== date)
      : [...current, date].sort();

    /* 모든 날을 고른 것은 전 기간과 같다. 그때는 비워서 지원자가 날짜를 고르게 둔다. */
    handleUpdateLine(index, {
      dates: next.length === positionDates.length ? undefined : next,
    });
  };

  const onSubmit = handleSubmit((values) => {
    if (posting) {
      updateMutation.mutate(
        { postingId: posting.postingId, body: values },
        { onSuccess: handleClose },
      );

      return;
    }

    createMutation.mutate(values, { onSuccess: handleClose });
  });

  const linesError = errors.lines?.message ?? errors.lines?.root?.message;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={posting ? "공고 수정" : "공고 등록"}
      description="행사를 고르면 모집 줄과 공고문 초안이 자동으로 채워집니다."
      size="lg"
      onSubmit={onSubmit}
      footer={
        <>
          <CopyButton
            value={content ?? ""}
            label="공고문 복사"
            successMessage="공고문을 복사했습니다. 오픈카톡방에 붙여넣으세요."
          />
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {posting ? "저장" : "등록"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {/*
          행사명이 서로 비슷해서 드롭다운으로는 구분이 되지 않았다.
          날짜 · 장소 · 충원 현황이 함께 보이는 목록에서 고른다.
          공고는 행사당 하나라, 수정에서 행사를 바꾸는 일은 드물지만 막지는 않는다.
        */}
        <FormField label="행사" required error={errors.eventId?.message}>
          <Controller
            control={control}
            name="eventId"
            render={({ field }) => (
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className={cn(
                  "flex h-10 w-full items-center gap-2 rounded-field border bg-surface px-3 text-left text-[14px] transition hover:border-brand",
                  errors.eventId ? "border-danger" : "border-border-main",
                )}
              >
                <Calendar size={15} className="shrink-0 text-font-2" />
                {eventTitle ? (
                  <span className="min-w-0 flex-1 truncate text-font-1">
                    {eventTitle}
                  </span>
                ) : (
                  <span className="flex-1 text-font-disabled">
                    행사를 선택하세요
                  </span>
                )}
                <span className="shrink-0 text-[13px] text-brand">
                  {isLoadingEvent
                    ? "불러오는 중"
                    : Number(field.value)
                      ? "변경"
                      : "선택"}
                </span>
              </button>
            )}
          />
        </FormField>

        {/*
          모집 줄. 포지션마다 날짜별 부족을 보여 주고, 그 아래에 줄을 둔다.
          전일 줄 하나로 다 채울 수 없는 날(노쇼 · 급구)은 그 날만 여는 줄을 더한다.
        */}
        {eventId > 0 && (
          <FormField
            label="모집 줄"
            required
            hint={
              isMultiDay
                ? "전일 줄은 모든 날 나오는 사람만, 날짜 줄은 고른 날 중 나올 날을 골라 지원합니다."
                : "모자란 포지션이 부족 인원만큼 골라져 있습니다."
            }
            error={linesError}
          >
            {!event ? (
              <p className="rounded-field border border-border-main px-3 py-3 text-[13px] text-font-2">
                포지션을 불러오는 중입니다.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-main rounded-field border border-border-main">
                {event.positions.map((position) => {
                  const shortages = shortageByDate(event, position.positionId);
                  const positionDates = shortages.map((item) => item.date);
                  const positionLines = lines
                    .map((line, index) => ({ line, index }))
                    .filter(({ line }) => line.positionId === position.positionId);
                  const hasFullLine = positionLines.some(
                    ({ line }) => line.participation === "FULL",
                  );
                  const totalShortage = Math.max(0, ...shortages.map((item) => item.count));

                  return (
                    <li
                      key={position.positionId}
                      className="flex flex-col gap-2.5 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5 text-[14px] text-font-1">
                            {formatPositionLabel(position, jobRoleLabel)}
                            {isMultiDay && (
                              <Badge tone="neutral">
                                {SCHEDULE_RULE_LABEL[position.scheduleRule]}
                              </Badge>
                            )}
                            {position.genderPreference !== "ANY" && (
                              <Badge tone="info">
                                {GENDER_PREFERENCE_LABEL[position.genderPreference]}
                              </Badge>
                            )}
                            {position.requiresHealthCert && (
                              <Badge tone="warning">보건증</Badge>
                            )}
                          </p>
                          <p className="text-[12px] text-font-2 tabular-nums">
                            {formatTimeRange(
                              position.startTime,
                              position.endTime,
                              position.endDayOffset,
                            )}{" "}
                            · {WAGE_TYPE_LABEL[position.wageType]}{" "}
                            {formatWithCommas(position.wage)}원 ·{" "}
                            <span
                              className={
                                totalShortage > 0 ? "text-warning" : "text-success"
                              }
                            >
                              {positionDates.length === 0
                                ? "발주 없음"
                                : totalShortage > 0
                                  ? `최대 ${totalShortage}명 부족`
                                  : "충원 완료"}
                            </span>
                          </p>
                          {/* 날마다 모자란 수. 급구 줄을 어느 날에 열지 여기서 읽는다. */}
                          {isMultiDay && totalShortage > 0 && (
                            <p className="mt-0.5 text-[12px] text-font-2 tabular-nums">
                              날짜별 부족{" "}
                              {shortages
                                .map((item) => `${item.date.slice(5).replace("-", ".")} ${item.count}`)
                                .join(" · ")}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<Plus size={14} />}
                            disabled={hasFullLine || positionDates.length === 0}
                            onClick={() => handleAddLine(position, "FULL")}
                          >
                            {isMultiDay ? "전일 모집" : "모집"}
                          </Button>
                          {isMultiDay && (
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<Plus size={14} />}
                              disabled={positionDates.length === 0}
                              onClick={() => handleAddLine(position, "SPLIT")}
                            >
                              날짜 지정 모집
                            </Button>
                          )}
                        </div>
                      </div>

                      {positionLines.map(({ line, index }) => {
                        const postingLine = posting?.lines.find(
                          (item) => item.targetId === line.targetId,
                        );
                        const lineDateError =
                          errors.lines?.[index]?.dates?.message;

                        return (
                          <div
                            key={line.targetId ?? `new-${index}`}
                            className={cn(
                              "flex flex-col gap-2 rounded-field border px-3 py-2.5",
                              line.isUrgent
                                ? "border-danger bg-danger-bg"
                                : "border-border-main bg-subtle",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {isMultiDay && (
                                <Select
                                  aria-label="참여 방식"
                                  options={PARTICIPATION_OPTIONS}
                                  value={line.participation}
                                  onChange={(changeEvent) =>
                                    handleChangeParticipation(
                                      index,
                                      changeEvent.target.value as PostingParticipation,
                                    )
                                  }
                                  selectBoxClassName="w-36"
                                />
                              )}
                              <Input
                                type="number"
                                min={1}
                                aria-label={`${position.name} 모집 인원`}
                                value={line.requiredCount ?? ""}
                                onChange={(changeEvent) =>
                                  handleUpdateLine(index, {
                                    requiredCount: Math.max(
                                      1,
                                      Number(changeEvent.target.value) || 1,
                                    ),
                                  })
                                }
                                rightSlot={
                                  <span className="text-[13px] text-font-2">명</span>
                                }
                                inputBoxClassName="w-24"
                              />
                              <Checkbox
                                label="급구"
                                checked={line.isUrgent}
                                onChange={(changeEvent) =>
                                  handleUpdateLine(index, {
                                    isUrgent: changeEvent.target.checked,
                                  })
                                }
                              />
                              {postingLine && postingLine.applicantCount > 0 && (
                                <span className="text-[12px] text-font-2">
                                  지원 {postingLine.applicantCount}명
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="dangerGhost"
                                className="ml-auto"
                                onClick={() => handleRemoveLine(index)}
                              >
                                빼기
                              </Button>
                            </div>

                            {isMultiDay && line.participation === "FULL" && (
                              <p className="text-[12px] text-font-2">
                                {positionDates.length}일 모두 나오는 사람만 지원할 수 있습니다.
                              </p>
                            )}

                            {isMultiDay && line.participation === "SPLIT" && (
                              <div className="flex flex-col gap-1.5">
                                <p className="text-[12px] text-font-2">
                                  {line.dates
                                    ? "고른 날에만 모집합니다. 지원자는 그중 나올 날을 고릅니다."
                                    : "모든 날을 열어 둡니다. 지원자가 나올 날을 고릅니다."}
                                </p>
                                <DateChips
                                  dates={positionDates}
                                  selected={line.dates ?? positionDates}
                                  onToggle={(date) => handleToggleLineDate(index, date)}
                                />
                                {lineDateError && (
                                  <p className="text-[12px] text-font-error">
                                    {lineDateError}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </li>
                  );
                })}
              </ul>
            )}
          </FormField>
        )}

        <FormField
          label="공고 제목"
          required
          hint="관리자 목록에만 보이는 제목입니다. 포털에는 행사명이 나갑니다."
          error={errors.title?.message}
        >
          <Input
            {...register("title")}
            placeholder="예) 성수 팝업스토어 · A타임 전일 2명 · [급구] A타임 09.13 1명"
            hasError={Boolean(errors.title)}
          />
        </FormField>

        <Alert tone="info" title="공고문은 그대로 복사해 쓰는 글입니다.">
          행사 정보(근무일 · 장소 · 집합 · 복장)와 줄마다 시각 · 금액 · 날짜로 초안을
          만들어 둡니다. 고친 뒤에는 줄을 바꿔도 덮어쓰지 않습니다.
          {event && event.dates.length > 0 && (
            <>
              {" "}
              근무일 {formatDate(event.dates[0])}
              {event.dates.length > 1 &&
                ` ~ ${formatDate(event.dates[event.dates.length - 1])} (${event.dates.length}일)`}
            </>
          )}
        </Alert>

        <FormField label="공고문" required error={errors.content?.message}>
          <Textarea
            {...register("content")}
            rows={14}
            placeholder="행사를 고르면 자동으로 채워집니다."
            hasError={Boolean(errors.content)}
          />
        </FormField>
      </form>
    </Modal>

      <EventPickerModal
        isOpen={isPickerOpen}
        selectedEventId={eventId || undefined}
        description="공고를 낼 행사를 고르세요. 인원이 덜 찬 행사부터 확인하면 좋습니다."
        onSelect={(selected) => {
          void handleSelectEvent(selected);
        }}
        onClose={() => setIsPickerOpen(false)}
      />
    </>
  );
};

export default PostingFormModal;
