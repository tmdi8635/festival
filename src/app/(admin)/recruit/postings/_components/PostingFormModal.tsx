"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { getEventDetail, useEventDetailQuery } from "@/api/event/getEventDetail";
import { usePostingMutation } from "@/api/recruit/mutatePosting";
import { Calendar } from "@/icons";
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
  WAGE_TYPE_LABEL,
  describeRecurrence,
  formatPositionLabel,
  formatTimeRange,
  type EventDetail,
  type EventSummary,
} from "@/type/event";
import type { JobPosting, PostingPositionTarget } from "@/type/recruit";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import CopyButton from "@/components/domain/CopyButton";
import EventPickerModal from "@/components/domain/EventPickerModal";

interface PostingFormModalProps {
  isOpen: boolean;
  posting: JobPosting | null;
  onClose: () => void;
}

/**
 * 포지션별 **가장 모자란 날의** 부족 인원.
 *
 * 공고는 행사 전체를 덮지만 사람은 날마다 모자라는 수가 다르다.
 * 합계로 잡으면 사흘 행사에 하루 2명씩 모자란 자리를 6명으로 뽑아 버린다.
 * 한 사람은 그 포지션의 모든 근무일에 서므로, 가장 모자란 날의 수만큼 뽑으면 된다.
 */
const resolvePositionShortage = (
  event: EventDetail,
  positionId: number,
): number =>
  Math.max(
    0,
    ...event.days.flatMap((day) =>
      day.roles
        .filter((slot) => slot.positionId === positionId)
        .map((slot) => slot.requiredCount - slot.assignedCount),
    ),
  );

/** 모자란 포지션을 기본으로 골라 둔다. 다 찼으면 아무것도 고르지 않는다. */
const buildDefaultTargets = (event: EventDetail): PostingPositionTarget[] =>
  event.positions
    .map((position) => ({
      positionId: position.positionId,
      requiredCount: resolvePositionShortage(event, position.positionId),
    }))
    .filter((target) => target.requiredCount > 0);

/**
 * 공고 제목. `행사명 · A타임 2명 · B타임 1명`
 *
 * 관리자 목록에서 **무엇을 못 채웠는지** 한눈에 읽히게 인원을 붙인다.
 * 이 제목은 내부 표기다. 포털은 행사명(`eventTitle`)을 쓰고 인원은 내리지 않는다.
 */
const buildPostingTitle = (
  event: EventDetail,
  targets: readonly PostingPositionTarget[],
): string => {
  const parts = targets
    .map((target) => {
      const position = event.positions.find(
        (item) => item.positionId === target.positionId,
      );

      return position ? `${position.name} ${target.requiredCount}명` : "";
    })
    .filter(Boolean);

  return [event.title, ...parts].join(" · ");
};

/**
 * 공고문 초안.
 *
 * 오픈카톡방에 그대로 붙여넣는 글이다. 손으로 쓰다 보면 시급 · 집합 장소가 빠지고,
 * 무엇보다 **포지션마다 시각이 다르다는 사실**이 빠진다. 야간조 공고에 주간 시각만
 * 적히면 지원자는 당일 저녁에 끝나는 줄 안다. 포지션마다 한 줄씩 적는다.
 *
 * 모집 인원은 적지 않는다. 몇 명이 모자란지는 우리 사정이고, 적어 두면 지원자가
 * "이미 찼겠지"하고 지원하지 않는다.
 */
const buildPostingContent = (
  event: EventDetail,
  targets: readonly PostingPositionTarget[],
): string => {
  const dates =
    event.dates.length <= 4
      ? event.dates.map((date) => formatKoreanDate(date)).join(", ")
      : `${formatKoreanDate(event.dates[0])} ~ ${formatKoreanDate(
          event.dates[event.dates.length - 1],
        )} 중 ${event.dates.length}일 (${describeRecurrence(event.recurrence, event.dayCount)})`;

  const positionLines = targets.flatMap((target) => {
    const position = event.positions.find(
      (item) => item.positionId === target.positionId,
    );

    if (!position) return [];

    const conditions = [
      position.genderPreference !== "ANY"
        ? GENDER_PREFERENCE_LABEL[position.genderPreference]
        : "",
      position.requiresHealthCert ? "보건증 필수" : "",
    ].filter(Boolean);

    return [
      `· ${formatPositionLabel(position, jobRoleLabelOf)} ${formatTimeRange(
        position.startTime,
        position.endTime,
        position.endDayOffset,
      )} (휴게 ${position.breakMinutes}분) · ${WAGE_TYPE_LABEL[position.wageType]} ${formatWithCommas(position.wage)}원${
        conditions.length > 0 ? ` · ${conditions.join(" · ")}` : ""
      }`,
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
    ...positionLines,
    "",
    "※ 지원 시 이름 · 연락처 · 지원 포지션을 남겨 주세요.",
    "※ 모든 근무일에 나올 수 있는 분을 우선합니다.",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
};

/**
 * 공고 등록 · 수정 모달.
 *
 * 공고 하나는 **행사 하나**를 덮는다. 행사를 고르면 그 안의 포지션이 펼쳐지고,
 * 모자란 포지션이 부족 인원만큼 골라진 채로 시작한다. 제목 · 공고문도 그에 맞춰
 * 자동으로 만들어지며, 사람이 고친 뒤에는 덮어쓰지 않는다.
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
            positions: posting.positions.map((position) => ({
              positionId: position.positionId,
              requiredCount: position.requiredCount,
            })),
            content: posting.content,
          }
        : EMPTY_POSTING_VALUES,
    );
  }, [isOpen, posting, reset]);

  const eventId = Number(watch("eventId")) || 0;
  const content = watch("content");
  const targets = (watch("positions") ?? []) as PostingPositionTarget[];

  /* 포지션 · 발주 현황은 행사 상세에서 온다. (고를 때 미리 받아 두므로 대개 캐시에 있다) */
  const { data: event } = useEventDetailQuery(eventId > 0 ? eventId : null);

  const eventTitle =
    pickedEvent?.title ?? event?.title ?? posting?.eventTitle ?? "";

  const handleClose = () => {
    setPickedEvent(null);
    onClose();
  };

  /**
   * 포지션 선택이 바뀌면 제목 · 공고문을 다시 만든다. **사람이 고친 뒤에는 그대로 둔다.**
   *
   * 지금 값이 직전 선택으로 자동 생성한 글과 같거나 비어 있으면 "아직 손대지 않았다"로 본다.
   * 담당자가 공고문에 한 줄 덧붙인 뒤 포지션을 하나 더 켰다고 그 줄이 사라지면 안 된다.
   */
  const applyTargets = (
    source: EventDetail,
    previous: readonly PostingPositionTarget[],
    next: PostingPositionTarget[],
  ) => {
    const currentTitle = getValues("title") ?? "";
    const currentContent = getValues("content") ?? "";

    setValue("positions", next, { shouldValidate: Boolean(errors.positions) });

    if (!currentTitle || currentTitle === buildPostingTitle(source, previous)) {
      setValue("title", buildPostingTitle(source, next), {
        shouldValidate: Boolean(errors.title),
      });
    }

    if (
      !currentContent ||
      currentContent === buildPostingContent(source, previous)
    ) {
      setValue("content", buildPostingContent(source, next), {
        shouldValidate: Boolean(errors.content),
      });
    }
  };

  /**
   * 행사를 고른다.
   *
   * 기본 선택(부족 인원)을 정하려면 날짜별 발주가 있어야 해서 행사 상세를 받아 온다.
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
      const next = buildDefaultTargets(detail);

      setValue("positions", next, { shouldValidate: false });
      setValue("title", buildPostingTitle(detail, next));
      setValue("content", buildPostingContent(detail, next));
    } catch (error) {
      showErrorToast(error, "행사 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoadingEvent(false);
    }
  };

  const handleTogglePosition = (positionId: number, checked: boolean) => {
    if (!event) return;

    const next = checked
      ? [
          ...targets,
          {
            positionId,
            requiredCount: Math.max(
              1,
              resolvePositionShortage(event, positionId),
            ),
          },
        ].sort(
          (a, b) =>
            event.positions.findIndex((item) => item.positionId === a.positionId) -
            event.positions.findIndex((item) => item.positionId === b.positionId),
        )
      : targets.filter((target) => target.positionId !== positionId);

    applyTargets(event, targets, next);
  };

  const handleChangeCount = (positionId: number, requiredCount: number) => {
    if (!event) return;

    applyTargets(
      event,
      targets,
      targets.map((target) =>
        target.positionId === positionId
          ? { ...target, requiredCount: Math.max(1, requiredCount) }
          : target,
      ),
    );
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

  const positionsError =
    errors.positions?.message ?? errors.positions?.root?.message;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={posting ? "공고 수정" : "공고 등록"}
      description="행사를 고르면 모집할 포지션과 공고문 초안이 자동으로 채워집니다."
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
          모집할 포지션.
          기본값은 **날짜별로 가장 모자란 수**다. 한 사람이 그 포지션의 모든
          근무일에 서므로, 합계로 잡으면 필요한 사람의 몇 배를 뽑게 된다.
        */}
        {eventId > 0 && (
          <FormField
            label="모집 포지션"
            required
            hint="모자란 포지션이 부족 인원만큼 골라져 있습니다. 인원은 가장 모자란 날 기준입니다."
            error={positionsError}
          >
            {!event ? (
              <p className="rounded-field border border-border-main px-3 py-3 text-[13px] text-font-2">
                포지션을 불러오는 중입니다.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-main rounded-field border border-border-main">
                {event.positions.map((position) => {
                  const target = targets.find(
                    (item) => item.positionId === position.positionId,
                  );
                  const shortage = resolvePositionShortage(
                    event,
                    position.positionId,
                  );
                  const postingPosition = posting?.positions.find(
                    (item) => item.positionId === position.positionId,
                  );

                  return (
                    <li
                      key={position.positionId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5"
                    >
                      <Checkbox
                        checked={Boolean(target)}
                        onChange={(changeEvent) =>
                          handleTogglePosition(
                            position.positionId,
                            changeEvent.target.checked,
                          )
                        }
                        aria-label={`${position.name} 모집`}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[14px] text-font-1">
                          {formatPositionLabel(position, jobRoleLabel)}
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
                              shortage > 0 ? "text-warning" : "text-success"
                            }
                          >
                            {shortage > 0 ? `최대 ${shortage}명 부족` : "충원 완료"}
                          </span>
                          {postingPosition &&
                            postingPosition.applicantCount > 0 &&
                            ` · 지원 ${postingPosition.applicantCount}명`}
                        </p>
                      </div>

                      <Input
                        type="number"
                        min={1}
                        aria-label={`${position.name} 모집 인원`}
                        value={target?.requiredCount ?? ""}
                        disabled={!target}
                        onChange={(changeEvent) =>
                          handleChangeCount(
                            position.positionId,
                            Number(changeEvent.target.value) || 1,
                          )
                        }
                        rightSlot={
                          <span className="text-[13px] text-font-2">명</span>
                        }
                        inputBoxClassName="w-24"
                      />
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
            placeholder="예) 성수 팝업스토어 · A타임 2명 · B타임 1명"
            hasError={Boolean(errors.title)}
          />
        </FormField>

        <Alert tone="info" title="공고문은 그대로 복사해 쓰는 글입니다.">
          행사 정보(근무일 · 장소 · 집합 · 복장)와 포지션별 시각 · 금액으로 초안을
          만들어 둡니다. 고친 뒤에는 포지션을 바꿔도 덮어쓰지 않습니다.
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
