"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useEventMutation } from "@/api/event/mutateEvent";
import {
  BREAK_MINUTE_OPTIONS,
  GENDER_PREFERENCE_OPTIONS,
  WAGE_TYPE_OPTIONS,
} from "@/constants/eventOptions";
import {
  eventPositionSchema,
  type EventPositionSchema,
  type EventPositionSchemaInput,
} from "@/schema/event.schema";
import {
  jobRoleBillingRate,
  jobRoleDefaultWage,
  useJobRoleLabel,
  useJobRoleOptions,
} from "@/store/useOrgStore";
import {
  WAGE_TYPE_UNIT,
  calculateWorkHours,
  formatTimeRange,
  guessDayOffset,
  type DayOffset,
  type EventDetail,
  type EventPosition,
  type GenderPreference,
  type WageType,
} from "@/type/event";
import type { JobRole } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import AmountInput from "@/components/ui/AmountInput";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";
import TimeInput from "@/components/ui/TimeInput";
import DayOffsetField from "@/components/domain/DayOffsetField";

interface PositionFormModalProps {
  event: EventDetail;
  isOpen: boolean;
  /** 값이 있으면 수정, 없으면 추가 */
  position: EventPosition | null;
  onClose: () => void;
}

/** 서버 값 → 폼 값 */
const toFormValues = (position: EventPosition): EventPositionSchemaInput => ({
  name: position.name,
  jobRole: position.jobRole,
  startTime: position.startTime,
  endTime: position.endTime,
  endDayOffset: position.endDayOffset,
  breakMinutes: position.breakMinutes,
  wageType: position.wageType,
  wage: position.wage,
  billingRate: position.billingRate,
  genderPreference: position.genderPreference,
  requiresHealthCert: position.requiresHealthCert,
});

/**
 * 포지션 추가 · 수정 모달.
 *
 * 행사 등록 폼의 포지션 줄과 **같은 스키마**(`eventPositionSchema`)를 쓴다.
 * 한쪽만 검증을 늘리면 다른 길로 그 조건을 피해 저장할 수 있다.
 *
 * 수정은 **앞으로 만들어질 배치**의 기본값을 바꾼다. 이미 배치된 사람의 금액은
 * 그대로다(사람마다 따로 합의한 금액일 수 있다). 시각은 배치가 포지션을 따라가므로
 * 바로 바뀐다 — 그래서 저장 전에 그 사실을 적어 둔다.
 */
const PositionFormModal = ({
  event,
  isOpen,
  position,
  onClose,
}: PositionFormModalProps) => {
  const jobRoleOptions = useJobRoleOptions();
  const jobRoleLabel = useJobRoleLabel();
  const { createPositionMutation, updatePositionMutation } = useEventMutation();

  /*
    추가할 때만 쓰는 값. "모든 근무일에 N명 발주"를 켜면 포지션을 만들면서
    모든 날에 발주를 깔아 준다. 끄면 포지션만 만들고 발주는 날마다 따로 잡는다.
    (주말에만 붙는 야간조처럼 모든 날에 필요하지 않은 자리가 있다)
  */
  const [fillsAllDays, setFillsAllDays] = useState(true);
  const [requiredCount, setRequiredCount] = useState(1);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<EventPositionSchemaInput, unknown, EventPositionSchema>({
    resolver: zodResolver(eventPositionSchema),
  });

  // 모달이 열릴 때만 폼을 초기화한다. 입력 중에는 서버 값이 덮어쓰지 않는다.
  useEffect(() => {
    if (!isOpen) return;

    if (position) {
      reset(toFormValues(position));
      return;
    }

    /* 새 포지션은 행사의 기본 근무시간과 스태프 기본 단가로 시작한다. */
    const preset = jobRoleDefaultWage("STAFF");

    reset({
      name: "",
      jobRole: "STAFF",
      startTime: event.startTime,
      endTime: event.endTime,
      endDayOffset: event.endDayOffset,
      breakMinutes: event.breakMinutes,
      wageType: preset.wageType,
      wage: preset.wage,
      billingRate: jobRoleBillingRate("STAFF"),
      genderPreference: "ANY",
      requiresHealthCert: false,
    });
  }, [isOpen, position, event, reset]);

  const startTime = watch("startTime") ?? "";
  const endTime = watch("endTime") ?? "";
  const endDayOffset = Number(watch("endDayOffset") ?? 0) as DayOffset;
  const breakMinutes = Number(watch("breakMinutes") ?? 0);
  const wageType = (watch("wageType") ?? "HOURLY") as WageType;

  const hasTimeRange = Boolean(startTime && endTime);

  /** 이 포지션에 서 있는 배치. 직무를 바꿀 수 없는 이유를 설명하는 데 쓴다. */
  const assignedCount = position
    ? event.assignments.filter(
        (assignment) =>
          assignment.positionId === position.positionId &&
          assignment.status !== "CANCELED",
      ).length
    : 0;

  const handleClose = () => {
    setFillsAllDays(true);
    setRequiredCount(1);
    onClose();
  };

  /**
   * 직무를 바꾸면 그 직무의 기본 지급 · 청구 단가를 따라간다.
   * 이름은 **손대지 않았을 때만**(비었거나 앞 직무 이름 그대로) 바꾼다.
   */
  const handleChangeJobRole = (nextRole: JobRole) => {
    const current = getValues();
    const preset = jobRoleDefaultWage(nextRole);

    if (!current.name?.trim() || current.name === jobRoleLabel(current.jobRole)) {
      setValue("name", jobRoleLabel(nextRole));
    }

    setValue("jobRole", nextRole);
    setValue("wageType", preset.wageType);
    setValue("wage", preset.wage);
    setValue("billingRate", jobRoleBillingRate(nextRole));
  };

  const onSubmit = handleSubmit((values) => {
    const body = {
      ...values,
      name: values.name.trim(),
    };

    if (position) {
      updatePositionMutation.mutate(
        { eventId: event.eventId, positionId: position.positionId, body },
        { onSuccess: handleClose },
      );

      return;
    }

    createPositionMutation.mutate(
      {
        eventId: event.eventId,
        body: {
          ...body,
          requiredCount: fillsAllDays ? Math.max(1, requiredCount) : 0,
        },
      },
      { onSuccess: handleClose },
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={position ? "포지션 수정" : "포지션 추가"}
      description={event.title}
      size="lg"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {position ? "저장" : "추가"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {position && assignedCount > 0 && (
          <Alert tone="info" title={`이 포지션에 배치가 ${assignedCount}건 있습니다.`}>
            시각 · 휴게는 배치된 사람에게도 바로 적용됩니다(출퇴근 명부 · 계약서 ·
            정산의 예정 시간). 금액은 이미 배치된 사람에게는 바뀌지 않습니다. 직무는
            배치가 있는 동안 바꿀 수 없습니다.
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="포지션 이름"
            required
            hint="현장에서 부르는 이름 (A타임 · 야간조 · 인형탈)"
            error={errors.name?.message}
          >
            <Input
              {...register("name")}
              placeholder="예) B타임(야간)"
              hasError={Boolean(errors.name)}
            />
          </FormField>

          <FormField
            label="직무"
            required
            hint="대행사와 주고받는 공통 직무. 필터 · 견적에 쓰입니다."
            error={errors.jobRole?.message}
          >
            <Controller
              control={control}
              name="jobRole"
              render={({ field }) => (
                <Select
                  options={jobRoleOptions}
                  value={field.value ?? ""}
                  disabled={assignedCount > 0}
                  onChange={(changeEvent) =>
                    handleChangeJobRole(changeEvent.target.value as JobRole)
                  }
                />
              )}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="시작 시각" required error={errors.startTime?.message}>
            <Controller
              control={control}
              name="startTime"
              render={({ field }) => (
                <TimeInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.startTime)}
                />
              )}
            />
          </FormField>

          <FormField label="종료 시각" required error={errors.endTime?.message}>
            <Controller
              control={control}
              name="endTime"
              render={({ field }) => (
                <TimeInput
                  value={field.value ?? ""}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.endTime)}
                  onChange={(nextTime) => {
                    field.onChange(nextTime);
                    /* 추측은 초기값일 뿐이다. 사람이 D+1 · D+2를 눌러 확정한다. */
                    setValue(
                      "endDayOffset",
                      guessDayOffset(getValues("startTime") ?? "", nextTime),
                    );
                  }}
                />
              )}
            />
          </FormField>

          <FormField label="휴게시간" hint="근무 시간 안에 포함">
            <Controller
              control={control}
              name="breakMinutes"
              render={({ field }) => (
                <Select
                  options={BREAK_MINUTE_OPTIONS}
                  value={String(field.value ?? 0)}
                  onChange={(changeEvent) =>
                    field.onChange(Number(changeEvent.target.value))
                  }
                />
              )}
            />
          </FormField>
        </div>

        <Controller
          control={control}
          name="endDayOffset"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3 rounded-field border border-border-main px-4 py-3">
                <span className="text-[13px] font-medium text-font-1">
                  종료 시점
                </span>
                <DayOffsetField
                  value={(field.value ?? 0) as DayOffset}
                  onChange={field.onChange}
                  baseLabel="근무일"
                />
                <span className="ml-auto text-[12px] text-font-2 tabular-nums">
                  {hasTimeRange
                    ? `${formatTimeRange(startTime, endTime, endDayOffset)} · 실근무 ${calculateWorkHours(
                        startTime,
                        endTime,
                        breakMinutes,
                        endDayOffset,
                      )}시간`
                    : "시각을 입력하세요"}
                </span>
              </div>
              {errors.endDayOffset?.message && (
                <p className="text-[12px] text-font-error">
                  {errors.endDayOffset.message}
                </p>
              )}
            </div>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="지급 기준" required>
            <Controller
              control={control}
              name="wageType"
              render={({ field }) => (
                <Select
                  options={WAGE_TYPE_OPTIONS}
                  value={field.value ?? "HOURLY"}
                  onChange={(changeEvent) =>
                    field.onChange(changeEvent.target.value as WageType)
                  }
                />
              )}
            />
          </FormField>

          <FormField label="지급 금액" required error={errors.wage?.message}>
            <Controller
              control={control}
              name="wage"
              render={({ field }) => (
                <AmountInput
                  value={Number(field.value) || 0}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.wage)}
                  rightSlot={
                    <span className="text-[13px] whitespace-nowrap text-font-2">
                      {WAGE_TYPE_UNIT[wageType]}
                    </span>
                  }
                />
              )}
            />
          </FormField>

          <FormField
            label="청구 단가"
            hint="0이면 미설정 · 마진에서 빠짐"
            error={errors.billingRate?.message}
          >
            <Controller
              control={control}
              name="billingRate"
              render={({ field }) => (
                <AmountInput
                  value={Number(field.value) || 0}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.billingRate)}
                  rightSlot={
                    <span className="text-[13px] whitespace-nowrap text-font-2">
                      원 / 시간
                    </span>
                  }
                />
              )}
            />
          </FormField>
        </div>

        {/*
          지원 조건. 관리자의 배치는 막지 않고, 포털에서 본인이 지원하는 길만 막는다.
          (조건과 다른 지원이 쌓이면 담당자가 하나하나 반려해야 한다)
        */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-field border border-border-main px-4 py-3">
          <FormField label="성별 조건" className="w-40">
            <Controller
              control={control}
              name="genderPreference"
              render={({ field }) => (
                <Select
                  options={GENDER_PREFERENCE_OPTIONS}
                  value={field.value ?? "ANY"}
                  onChange={(changeEvent) =>
                    field.onChange(changeEvent.target.value as GenderPreference)
                  }
                />
              )}
            />
          </FormField>

          <Controller
            control={control}
            name="requiresHealthCert"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-font-1">
                <Switch
                  label="보건증 필요"
                  checked={Boolean(field.value)}
                  onChange={field.onChange}
                />
                <span>
                  보건증 필요
                  <span className="block text-[12px] text-font-2">
                    유효한 보건증이 있는 사람만 지원할 수 있습니다
                  </span>
                </span>
              </label>
            )}
          />
        </div>

        {/* 추가할 때만. 이미 있는 포지션의 날짜별 인원은 일별 근무자 탭에서 고친다. */}
        {!position && (
          <div className="flex flex-wrap items-center gap-3 rounded-field border border-border-main bg-subtle px-4 py-3">
            <Checkbox
              label={`모든 근무일(${event.dayCount}일)에 발주 깔기`}
              checked={fillsAllDays}
              onChange={(changeEvent) => setFillsAllDays(changeEvent.target.checked)}
            />
            <Input
              type="number"
              min={1}
              aria-label="하루 발주 인원"
              value={requiredCount}
              disabled={!fillsAllDays}
              onChange={(changeEvent) =>
                setRequiredCount(Math.max(1, Number(changeEvent.target.value) || 1))
              }
              rightSlot={<span className="text-[13px] text-font-2">명</span>}
              inputBoxClassName="w-24"
            />
            <p className="basis-full text-[12px] text-font-2">
              끄면 포지션만 만들고, 필요한 날에만 일별 근무자 탭의 &lsquo;발주
              수정&rsquo;으로 인원을 잡습니다.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default PositionFormModal;
