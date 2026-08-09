"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useClientListQuery } from "@/api/client/getClientList";
import { useEventMutation } from "@/api/event/mutateEvent";
import {
  BREAK_MINUTE_OPTIONS,
  WAGE_TYPE_OPTIONS,
} from "@/constants/eventOptions";
import { Plus, Trash } from "@/icons";
import {
  EMPTY_EVENT_VALUES,
  eventSchema,
  type EventSchema,
  type EventSchemaInput,
} from "@/schema/event.schema";
import {
  jobRoleDefaultWage,
  sortByJobRole,
  useActiveJobRoles,
  useJobRoleOptions,
} from "@/store/useOrgStore";
import {
  WAGE_TYPE_UNIT,
  calculateWorkHours,
  guessDayOffset,
  resolveEventDates,
  type DayOffset,
  type EventDetail,
  type EventRecurrence,
  type WageType,
} from "@/type/event";
import type { JobRole } from "@/type/staff";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import DayOffsetField from "./DayOffsetField";
import Textarea from "@/components/ui/Textarea";
import RecurrenceField from "./RecurrenceField";

interface EventFormModalProps {
  isOpen: boolean;
  /** 값이 있으면 수정, 없으면 신규 등록 */
  event: EventDetail | null;
  onClose: () => void;
  /** 캘린더에서 빈 날짜를 눌러 열었을 때 채워 넣을 날짜 */
  defaultDate?: string;
}

/** 서버 값 → 폼 값. 직무 슬롯의 확정 인원은 서버가 다시 계산한다. */
const toFormValues = (event: EventDetail): EventSchemaInput => ({
  title: event.title,
  clientId: event.clientId,
  startDate: event.startDate,
  endDate: event.endDate,
  recurrence: event.recurrence,
  startTime: event.startTime,
  endTime: event.endTime,
  endDayOffset: event.endDayOffset,
  venue: event.venue,
  address: event.address,
  managerName: event.managerName,
  description: event.description,
  meetingPoint: event.meetingPoint,
  dressCode: event.dressCode,
  belongings: event.belongings,
  breakMinutes: event.breakMinutes,
  clientBillingRate: event.clientBillingRate,
  memo: event.memo,
  // 직무 슬롯도 기준 설정 순서로 세워 둔다. 화면마다 자리가 달라지면 안 된다.
  roles: sortByJobRole(event.roles, (slot) => slot.role),
});

/**
 * 행사 등록 · 수정 모달.
 *
 * 발주는 직무 단위로 들어오므로 직무 슬롯을 자유롭게 추가 · 삭제할 수 있게 한다.
 * 저장하는 순간 캘린더에 `(0/1) (0/10)` 형태로 나타난다.
 */
const EventFormModal = ({
  isOpen,
  event,
  onClose,
  defaultDate,
}: EventFormModalProps) => {
  const { data: clientData } = useClientListQuery({ page: 1, size: 100 });
  const { createMutation, updateMutation } = useEventMutation();

  // 직무는 기준 설정에서 자유롭게 바꿀 수 있으므로 목록을 스토어에서 받는다.
  const jobRoles = useActiveJobRoles();
  const jobRoleOptions = useJobRoleOptions();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    // 입력 타입(coerce 전)과 출력 타입(coerce 후)이 달라 제네릭 세 개를 모두 넘긴다.
  } = useForm<EventSchemaInput, unknown, EventSchema>({
    resolver: zodResolver(eventSchema),
    defaultValues: EMPTY_EVENT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "roles" });

  // 모달이 열릴 때만 폼을 초기화한다. 입력 중에는 서버 값이 덮어쓰지 않는다.
  useEffect(() => {
    if (!isOpen) return;

    reset(
      event
        ? toFormValues(event)
        : {
            ...EMPTY_EVENT_VALUES,
            startDate: defaultDate ?? "",
            endDate: defaultDate ?? "",
            /*
              새 행사의 기본 직무는 기준 설정의 앞 두 개로 채운다.
              직무를 통째로 바꾼 에이전시에서 없는 직무가 기본값으로 들어가면
              저장할 때야 오류를 보게 된다.
            */
            roles: jobRoles.slice(0, 2).map((role, index) => ({
              role: role.code,
              requiredCount: index === 0 ? 1 : 5,
              assignedCount: 0,
              wageType: role.defaultWageType,
              wage: role.defaultWage,
            })),
          },
    );
  }, [isOpen, event, defaultDate, reset, jobRoles]);

  const clientOptions = [
    { label: "거래처를 선택하세요", value: "0" },
    ...(clientData?.content ?? []).map((client) => ({
      label: client.name,
      value: String(client.clientId),
    })),
  ];

  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const endDayOffset = (watch("endDayOffset") ?? 0) as DayOffset;
  const breakMinutes = watch("breakMinutes");
  /*
    시각을 아직 안 넣었으면 실근무 시간을 계산하지 않는다.
    빈 값을 00:00으로 채워 넣고 계산하면 시작과 종료가 같아져
    자정을 넘긴 것으로 읽히고, 아무것도 입력하지 않은 폼에 '24시간'이 뜬다.
  */
  const hasTimeRange = Boolean(startTime && endTime);
  const workHours = hasTimeRange
    ? calculateWorkHours(
        startTime,
        endTime,
        Number(breakMinutes) || 0,
        endDayOffset,
      )
    : undefined;
  const workHoursLabel = hasTimeRange ? `${workHours}시간` : "-";

  const roleSlots = watch("roles") ?? [];
  const usedRoles = roleSlots.map((slot) => slot.role);
  // 금액 입력창의 단위(원/시간 · 원/일)를 지급 기준에 맞춰 바꾼다.
  const wageTypes = roleSlots.map((slot) => slot.wageType);
  const availableRole = jobRoles.find(
    (role) => !usedRoles.includes(role.code),
  );

  // 반복 규칙에서 나온 실제 근무일. 인원 계산과 안내 문구가 이 값을 쓴다.
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const recurrence = watch("recurrence") as EventRecurrence;
  const workDates = resolveEventDates(
    startDate ?? "",
    endDate ?? "",
    recurrence ?? EMPTY_EVENT_VALUES.recurrence,
  );

  const onSubmit = handleSubmit((values) => {
    if (event) {
      updateMutation.mutate(
        { eventId: event.eventId, body: values },
        { onSuccess: onClose },
      );

      return;
    }

    createMutation.mutate(values, { onSuccess: onClose });
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={event ? "행사 수정" : "행사 등록"}
      description="거래처에서 받은 발주 내용을 그대로 옮겨 적으면 됩니다."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            isLoading={isSubmitting}
          >
            {event ? "저장" : "등록"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="행사명" required error={errors.title?.message}>
          <Input
            {...register("title")}
            placeholder="예) A 브랜드 성수 팝업스토어 운영"
            hasError={Boolean(errors.title)}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="거래처" required error={errors.clientId?.message}>
            <Controller
              control={control}
              name="clientId"
              render={({ field }) => (
                <Select
                  options={clientOptions}
                  value={String(field.value)}
                  onChange={(changeEvent) =>
                    field.onChange(Number(changeEvent.target.value))
                  }
                  hasError={Boolean(errors.clientId)}
                />
              )}
            />
          </FormField>

          <FormField
            label="담당 매니저"
            required
            error={errors.managerName?.message}
          >
            <Input
              {...register("managerName")}
              placeholder="예) 김도윤"
              hasError={Boolean(errors.managerName)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="시작일" required error={errors.startDate?.message}>
            <Input
              type="date"
              {...register("startDate")}
              hasError={Boolean(errors.startDate)}
            />
          </FormField>

          <FormField
            label="종료일"
            required
            hint={
              recurrence?.type === "SINGLE"
                ? "하루짜리 행사는 시작일과 같습니다."
                : "반복이 끝나는 날입니다."
            }
            error={errors.endDate?.message}
          >
            <Input
              type="date"
              {...register("endDate")}
              disabled={recurrence?.type === "SINGLE"}
              hasError={Boolean(errors.endDate)}
            />
          </FormField>
        </div>

        {/*
          반복 일정.
          하루짜리보다 이어지는 행사가 오히려 흔하고, "매주 주말만"처럼
          기간만으로는 담을 수 없는 형태가 많아 규칙을 따로 입력받는다.
        */}
        <FormField label="반복 일정" required>
          <Controller
            control={control}
            name="recurrence"
            render={({ field }) => (
              <RecurrenceField
                startDate={startDate ?? ""}
                endDate={endDate ?? ""}
                value={field.value as EventRecurrence}
                onChange={field.onChange}
                onRequestEndDate={(next) =>
                  setValue("endDate", next, { shouldValidate: true })
                }
                error={
                  errors.recurrence?.message ??
                  errors.recurrence?.root?.message
                }
              />
            )}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="시작 시각" required error={errors.startTime?.message}>
            <Input
              type="time"
              {...register("startTime")}
              hasError={Boolean(errors.startTime)}
            />
          </FormField>

          <FormField label="종료 시각" required error={errors.endTime?.message}>
            <Controller
              control={control}
              name="endTime"
              render={({ field }) => (
                <Input
                  type="time"
                  value={field.value}
                  hasError={Boolean(errors.endTime)}
                  onChange={(changeEvent) => {
                    field.onChange(changeEvent.target.value);
                    /*
                      시각을 새로 고르면 날짜 넘김을 다시 추측해 깔아 준다.
                      추측은 어디까지나 초기값이고, 사람이 D+1 · D+2를 눌러 확정한다.
                    */
                    setValue(
                      "endDayOffset",
                      guessDayOffset(startTime, changeEvent.target.value),
                    );
                  }}
                />
              )}
            />
          </FormField>

          <FormField
            label="휴게시간"
            hint={`실근무 ${workHoursLabel}`}
            error={errors.breakMinutes?.message}
          >
            <Controller
              control={control}
              name="breakMinutes"
              render={({ field }) => (
                <Select
                  options={BREAK_MINUTE_OPTIONS}
                  value={String(field.value)}
                  onChange={(changeEvent) =>
                    field.onChange(Number(changeEvent.target.value))
                  }
                />
              )}
            />
          </FormField>
        </div>

        {/*
          종료가 며칠 뒤인지.

          방송 · 철야 현장은 24시간을 넘겨 일하는 날이 드물지 않다.
          `13:00~14:00`이 한 시간인지 25시간인지는 시각만으로 알 수 없어서,
          사람이 직접 고르게 한다. 여기서 정한 값이 그대로 정산 근무시간이 된다.
        */}
        <Controller
          control={control}
          name="endDayOffset"
          render={({ field }) => (
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
                {startTime || "--:--"}~{endTime || "--:--"}
                {endDayOffset > 0 ? ` (+${endDayOffset})` : ""} · 실근무{" "}
                {workHoursLabel}
              </span>
            </div>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="장소명" required error={errors.venue?.message}>
            <Input
              {...register("venue")}
              placeholder="예) 성수동 팝업 스페이스"
              hasError={Boolean(errors.venue)}
            />
          </FormField>

          <FormField label="주소" required error={errors.address?.message}>
            <Input
              {...register("address")}
              placeholder="예) 서울 성동구 연무장길 41"
              hasError={Boolean(errors.address)}
            />
          </FormField>
        </div>

        <FormField
          label="집합 장소 · 시간"
          required
          hint="공고문과 출근 안내 문자에 그대로 들어갑니다."
          error={errors.meetingPoint?.message}
        >
          <Input
            {...register("meetingPoint")}
            placeholder="예) 정문 앞 / 시작 30분 전 집합"
            hasError={Boolean(errors.meetingPoint)}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="복장" required error={errors.dressCode?.message}>
            <Input
              {...register("dressCode")}
              hasError={Boolean(errors.dressCode)}
            />
          </FormField>

          <FormField label="준비물" error={errors.belongings?.message}>
            <Input {...register("belongings")} />
          </FormField>
        </div>

        <FormField
          label="거래처 청구 시급"
          hint="인건비와 비교해 마진을 계산합니다."
          error={errors.clientBillingRate?.message}
        >
          <Input
            type="number"
            {...register("clientBillingRate")}
            rightSlot={<span className="text-[13px] text-font-2">원</span>}
            hasError={Boolean(errors.clientBillingRate)}
          />
        </FormField>

        {/*
          발주 인원은 **등록할 때만** 받는다.

          수정에서 이 값을 다시 받으면 담당자는 "여기서 고치면 반영되겠지"라고 읽는데,
          실제 발주는 근무일마다 따로 들고 있어서(`days[].roles`) 이미 만들어진 날에는
          아무 일도 일어나지 않는다. 고쳤다고 생각한 값과 화면에 보이는 값이 갈린다.

          그래서 수정에서는 아예 감춘다. 발주를 바꾸는 자리는
          일별 근무자 탭의 "발주 수정" 하나뿐이다. (가이드 13-2)
        */}
        {!event && (
          <>
          {/* 직무별 발주 인원 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-font-1">
                직무별 발주 인원
                <span className="ml-0.5 text-font-error">*</span>
              </p>

              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Plus size={14} />}
                disabled={!availableRole}
                onClick={() =>
                  availableRole &&
                  append({
                    role: availableRole.code,
                    requiredCount: 1,
                    assignedCount: 0,
                    wageType: availableRole.defaultWageType,
                    wage: availableRole.defaultWage,
                  })
                }
              >
                직무 추가
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-field border border-border-main p-3">
              {fields.map((field, index) => (
                /*
                  좁은 화면에서는 [직무][인원] / [기준][금액][삭제] 두 줄로 접힌다.
                  고정 폭만 390px가 넘어 한 줄로는 모달(308px) 안에 들어가지 못한다.
                  발주 건끼리 구분되도록 아래 선을 둔다. 두 줄짜리가 여럿 쌓이면
                  어디까지가 한 건인지 알 수 없다.
                */
                <div
                  key={field.id}
                  className="flex flex-wrap items-center gap-2 border-b border-border-main pb-2 last:border-b-0 last:pb-0 sm:flex-nowrap sm:border-b-0 sm:pb-0"
                >
                  <Controller
                    control={control}
                    name={`roles.${index}.role`}
                    render={({ field: roleField }) => (
                      <Select
                        aria-label="직무"
                        options={jobRoleOptions}
                        value={roleField.value}
                        onChange={(changeEvent) => {
                          const nextRole = changeEvent.target.value as JobRole;

                          roleField.onChange(nextRole);
                          /*
                            직무를 바꾸면 그 직무의 기본 지급 기준을 따라간다.
                            설치는 일급, 스태프는 시급처럼 관행이 달라서
                            앞 직무의 금액이 남아 있으면 거의 항상 틀린 값이 된다.
                          */
                          const preset = jobRoleDefaultWage(nextRole);

                          setValue(`roles.${index}.wageType`, preset.wageType);
                          setValue(`roles.${index}.wage`, preset.wage);
                        }}
                        selectBoxClassName="min-w-32 flex-1 sm:w-32 sm:flex-none"
                      />
                    )}
                  />

                  <Input
                    type="number"
                    aria-label="발주 인원"
                    {...register(`roles.${index}.requiredCount`)}
                    rightSlot={<span className="text-[13px] text-font-2">명</span>}
                    inputBoxClassName="w-24"
                  />

                  {/*
                    지급 기준.
                    현장 일은 시급으로만 굴러가지 않는다. 설치 · 철거처럼 시간이
                    들쭉날쭉한 일은 "하루 얼마"로 통으로 정하는 쪽이 오히려 흔하다.
                  */}
                  <Controller
                    control={control}
                    name={`roles.${index}.wageType`}
                    render={({ field: wageTypeField }) => (
                      <Select
                        aria-label="지급 기준"
                        options={WAGE_TYPE_OPTIONS}
                        value={wageTypeField.value}
                        onChange={(changeEvent) =>
                          wageTypeField.onChange(
                            changeEvent.target.value as WageType,
                          )
                        }
                        selectBoxClassName="w-24 shrink-0"
                      />
                    )}
                  />

                  <Input
                    type="number"
                    aria-label="지급 금액"
                    {...register(`roles.${index}.wage`)}
                    rightSlot={
                      <span className="text-[13px] whitespace-nowrap text-font-2">
                        {WAGE_TYPE_UNIT[wageTypes[index] ?? "HOURLY"]}
                      </span>
                    }
                    inputBoxClassName="min-w-28 flex-1"
                  />

                  <IconButton
                    label="직무 삭제"
                    icon={<Trash size={16} />}
                    tone="danger"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                  />
                </div>
              ))}

              <p className="min-h-4 text-[12px] text-font-error">
                {errors.roles?.message ??
                  errors.roles?.root?.message ??
                  errors.roles?.[0]?.wage?.message ??
                  errors.roles?.[0]?.requiredCount?.message}
              </p>

              {/*
                여러 날 진행하는 행사에서 가장 자주 나는 사고가
                "하루치 인원인 줄 알았는데 전체 인원이었다"는 오해다.
                입력한 값이 며칠에 몇 명이 되는지 여기서 못박아 둔다.
              */}
              <p className="text-[12px] text-font-2">
                위 인원은 <b>하루 기준</b>입니다.
                {workDates.length > 1 && (
                  <>
                    {" "}
                    근무일 {workDates.length}일에 같은 인원이 깔리며, 날짜별
                    편차는 행사 상세의 일자별 계획에서 조정합니다.
                  </>
                )}{" "}
                등급 가산액은 배치 시점에 자동으로 더해지니 여기에는 직무 기본
                시급만 넣으세요.
              </p>
            </div>
          </div>
          </>
        )}

        <FormField label="행사 설명" error={errors.description?.message}>
          <Textarea
            {...register("description")}
            rows={3}
            placeholder="현장 업무 내용, 거래처 요청사항 등"
          />
        </FormField>

        <FormField
          label="내부 메모"
          hint="인력에게는 보이지 않습니다."
          error={errors.memo?.message}
        >
          <Textarea {...register("memo")} rows={2} />
        </FormField>
      </form>
    </Modal>
  );
};

export default EventFormModal;
