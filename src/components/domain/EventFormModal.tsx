"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useClientListQuery } from "@/api/client/getClientList";
import { useHasPermission } from "@/store/useAdminStore";
import { useEventMutation } from "@/api/event/mutateEvent";
import {
  BREAK_MINUTE_OPTIONS,
  GENDER_PREFERENCE_OPTIONS,
  WAGE_TYPE_OPTIONS,
} from "@/constants/eventOptions";
import { useGeolocation } from "@/hooks/useGeolocation";
import { MapPin, Plus, Trash } from "@/icons";
import {
  EMPTY_EVENT_VALUES,
  EMPTY_POSITION_DRAFT,
  eventCreateSchema,
  eventSchema,
  type EventSchema,
  type EventSchemaInput,
} from "@/schema/event.schema";
import {
  jobRoleBillingRate,
  jobRoleDefaultWage,
  useActiveJobRoles,
  useJobRoleLabel,
  useJobRoleOptions,
} from "@/store/useOrgStore";
import {
  WAGE_TYPE_UNIT,
  calculateWorkHours,
  formatTimeRange,
  guessDayOffset,
  resolveEventDates,
  type DayOffset,
  type EventDetail,
  type EventRecurrence,
  type GenderPreference,
  type WageType,
} from "@/type/event";
import type { JobRole, JobRoleView } from "@/type/staff";
import AmountInput from "@/components/ui/AmountInput";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import TimeInput from "@/components/ui/TimeInput";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";
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

/** 폼의 포지션 줄 한 건 (입력 타입) */
type PositionDraftInput = EventSchemaInput["positions"][number];

/** 기본 근무시간을 따라가는 포지션 칸 */
type BaseTimeKey = "startTime" | "endTime" | "endDayOffset" | "breakMinutes";

/**
 * 서버 값 → 폼 값.
 *
 * 포지션은 수정 폼에서 받지 않는다. 행사 상세의 포지션 카드가 하나씩 고친다.
 * (통째로 다시 보내면 배치가 걸린 포지션을 지우는 요청이 아무렇지 않게 만들어진다)
 */
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
  /* 숫자 → 입력창 문자열. 미설정은 빈 칸이어야 0과 구분된다. */
  latitude: event.latitude ?? "",
  longitude: event.longitude ?? "",
  managerName: event.managerName,
  managerPhone: event.managerPhone,
  description: event.description,
  meetingPoint: event.meetingPoint,
  dressCode: event.dressCode,
  belongings: event.belongings,
  breakMinutes: event.breakMinutes,
  memo: event.memo,
  positions: [],
});

/**
 * 직무 하나로 포지션 줄을 깐다.
 *
 * 금액 · 청구 단가는 기준 설정의 직무 단가가 초기값이다. 거래처에서 가져오지 않는다 —
 * 단가를 부르는 쪽은 우리다. 시각은 지금 적어 둔 기본 근무시간을 따른다.
 */
const buildPositionDraft = (
  role: Pick<JobRoleView, "code" | "name">,
  base: Pick<PositionDraftInput, BaseTimeKey>,
  name: string,
  requiredCount: number,
): PositionDraftInput => {
  const preset = jobRoleDefaultWage(role.code);

  return {
    ...EMPTY_POSITION_DRAFT,
    ...base,
    name,
    jobRole: role.code,
    wageType: preset.wageType,
    wage: preset.wage,
    billingRate: jobRoleBillingRate(role.code),
    requiredCount,
  };
};

/**
 * 폼 한 덩어리.
 *
 * 예전에는 스무 개 남짓한 칸이 한 줄로 쭉 이어져 있었다. 그러다 보니
 * 성격이 다른 값들이(일정과 복장이) 나란히 붙어 있었다. 발주서를 보고 옮겨 적는
 * 사람은 거래처 이야기 · 일정 이야기 · 현장 이야기를 묶음으로 읽는다.
 */
const Section = ({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-3 rounded-card border border-border-main px-4 py-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold text-font-0">{title}</h3>
        {description && (
          <p className="mt-0.5 text-[12px] text-font-2">{description}</p>
        )}
      </div>
      {action}
    </div>
    {children}
  </section>
);

/**
 * 행사 등록 · 수정 모달.
 *
 * 발주는 **포지션** 단위로 들어온다. 같은 스태프라도 A타임(09–18) · B타임(21–06)처럼
 * 시간대 · 단가가 다르면 포지션을 나눈다. 저장하는 순간 캘린더에 포지션별 충원 현황이 뜬다.
 *
 * 칸은 **성격별로 묶는다.** (거래처 · 일정 · 장소 · 포지션 · 메모)
 */
const EventFormModal = ({
  isOpen,
  event,
  onClose,
  defaultDate,
}: EventFormModalProps) => {
  const { data: clientData } = useClientListQuery({ page: 1, size: 100 });
  const { createMutation, updateMutation } = useEventMutation();

  // 직무는 기준 설정에서 켜고 끌 수 있으므로 목록을 스토어에서 받는다.
  const jobRoles = useActiveJobRoles();
  const jobRoleOptions = useJobRoleOptions();
  const jobRoleLabel = useJobRoleLabel();

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
  } = useForm<EventSchemaInput, unknown, EventSchema>({
    /*
      등록은 포지션이 한 개 이상 있어야 하고, 수정은 포지션을 받지 않는다.
      리졸버는 렌더마다 다시 읽히므로 모달이 어느 쪽으로 열렸는지에 따라 갈아 끼운다.
    */
    resolver: zodResolver(event ? eventSchema : eventCreateSchema),
    defaultValues: EMPTY_EVENT_VALUES,
  });

  /* 현장에서 좌표를 바로 채울 수 있게. 답사 때 한 번 누르면 끝난다. */
  const geo = useGeolocation();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "positions",
  });

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
              새 행사의 기본 포지션은 켜져 있는 직무의 앞 두 개로 채운다.
              직무를 꺼 둔 에이전시에서 없는 직무가 기본값으로 들어가면
              저장할 때야 오류를 보게 된다.
            */
            positions: jobRoles.slice(0, 2).map((role, index) =>
              buildPositionDraft(
                role,
                {
                  startTime: "",
                  endTime: "",
                  endDayOffset: 0,
                  breakMinutes: 0,
                },
                role.name,
                index === 0 ? 1 : 5,
              ),
            ),
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event, defaultDate, reset, jobRoles]);

  /*
    거래처를 볼 권한이 없으면 목록이 아예 오지 않는다. (`usePermittedQuery`)
    빈 목록을 그대로 두면 "거래처를 선택하세요"만 있는 칸이 되어
    담당자는 자기 잘못인 줄 알고 계속 눌러 본다. 왜 비었는지 적어 준다.
  */
  const canReadClient = useHasPermission("client:read");

  const clientOptions = [
    {
      label: canReadClient
        ? "거래처를 선택하세요"
        : "'거래처 > 조회' 권한이 필요합니다",
      value: "0",
    },
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

  const positions = watch("positions") ?? [];

  // 반복 규칙에서 나온 실제 근무일. 인원 계산과 안내 문구가 이 값을 쓴다.
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const recurrence = watch("recurrence") as EventRecurrence;
  const workDates = resolveEventDates(
    startDate ?? "",
    endDate ?? "",
    recurrence ?? EMPTY_EVENT_VALUES.recurrence,
  );

  /*
    하루짜리면 종료일은 시작일을 따라간다.

    종료일 칸은 이때 잠겨 있어서 사람이 직접 채울 수 없다.
    "하루만"을 고른 뒤 시작일을 정하면(또는 나중에 고치면) 종료일이 빈 채로 남아
    저장할 때야 "종료일을 입력하세요"에 막히는데, 잠긴 칸이라 고칠 방법이 없다.
    프리셋을 누르는 순간만 맞춰 주는 것으로는 부족해서 여기서 계속 따라붙인다.
  */
  useEffect(() => {
    if (recurrence?.type !== "SINGLE") return;
    if (!startDate || endDate === startDate) return;

    setValue("endDate", startDate, { shouldValidate: true });
  }, [recurrence?.type, startDate, endDate, setValue]);

  /**
   * 기본 근무시간을 바꾸면 **아직 손대지 않은 포지션**도 따라온다.
   *
   * 포지션 시각이 기본 근무시간과 같다는 것은 "따로 정하지 않았다"는 뜻이다.
   * 따라오지 않으면 기본 시각을 09→10시로 고친 담당자가 포지션 여섯 개를 또 고쳐야 하고,
   * 한 개를 빠뜨리면 그 사람들만 한 시간 일찍 부른다.
   * 이미 다르게 정한 포지션(B타임 야간)은 건드리지 않는다.
   */
  const followBaseTime = (key: BaseTimeKey, previous: unknown, next: unknown) => {
    if (event) return;

    (getValues("positions") ?? []).forEach((position, index) => {
      if (String(position[key] ?? "") !== String(previous ?? "")) return;

      setValue(`positions.${index}.${key}`, next as never);
    });
  };

  /** 새 포지션 줄. 쓰지 않은 이름이 나올 때까지 번호를 붙인다. */
  const handleAppendPosition = () => {
    const role = jobRoles.find((item) => item.code === "STAFF") ?? jobRoles[0];

    if (!role) return;

    const usedNames = new Set(
      (getValues("positions") ?? []).map((position) => position.name.trim()),
    );
    let name = role.name;

    for (let index = 2; usedNames.has(name); index += 1) {
      name = `${role.name} ${index}`;
    }

    append(
      buildPositionDraft(
        role,
        {
          startTime: getValues("startTime") ?? "",
          endTime: getValues("endTime") ?? "",
          endDayOffset: getValues("endDayOffset") ?? 0,
          breakMinutes: getValues("breakMinutes") ?? 0,
        },
        name,
        1,
      ),
    );
  };

  /**
   * 포지션의 직무를 바꾼다.
   *
   * 직무를 바꾸면 그 직무의 기본 지급 기준 · 청구 단가를 따라간다. 설치는 일급,
   * 스태프는 시급처럼 관행이 달라서 앞 직무의 금액이 남아 있으면 거의 항상 틀린 값이 된다.
   * 이름은 **손대지 않았을 때만**(비었거나 앞 직무 이름 그대로) 새 직무 이름으로 바꾼다.
   * 'A타임'처럼 사람이 지은 이름을 직무가 덮어쓰면 안 된다.
   */
  const handleChangeJobRole = (index: number, nextRole: JobRole) => {
    const current = getValues(`positions.${index}`);
    const preset = jobRoleDefaultWage(nextRole);

    if (!current.name.trim() || current.name === jobRoleLabel(current.jobRole)) {
      setValue(`positions.${index}.name`, jobRoleLabel(nextRole), {
        shouldValidate: Boolean(errors.positions?.[index]?.name),
      });
    }

    setValue(`positions.${index}.jobRole`, nextRole);
    setValue(`positions.${index}.wageType`, preset.wageType);
    setValue(`positions.${index}.wage`, preset.wage);
    setValue(`positions.${index}.billingRate`, jobRoleBillingRate(nextRole));
  };

  const onSubmit = handleSubmit((values) => {
    if (event) {
      updateMutation.mutate(
        /* 수정 요청의 포지션은 서버가 무시한다. 헷갈리지 않게 아예 비워 보낸다. */
        { eventId: event.eventId, body: { ...values, positions: [] } },
        { onSuccess: onClose },
      );

      return;
    }

    createMutation.mutate(values, { onSuccess: onClose });
  });

  const positionsError =
    errors.positions?.message ?? errors.positions?.root?.message;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={event ? "행사 수정" : "행사 등록"}
      description="거래처에서 받은 발주 내용을 그대로 옮겨 적으면 됩니다."
      size="lg"
      onSubmit={onSubmit}
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

        <Section
          title="거래처"
          description="발주를 준 곳과 그쪽 담당자입니다. 청구 단가는 포지션마다 정합니다."
        >
          <FormField
            label="거래처"
            required
            hint={
              canReadClient
                ? undefined
                : "거래처를 고를 수 없어 행사를 등록할 수 없습니다. 최고관리자에게 '거래처 > 조회' 권한을 요청하세요."
            }
            error={errors.clientId?.message}
          >
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

          {/*
            담당 매니저와 그 번호는 **한 줄이다.**
            이름만 적힌 줄과 번호만 적힌 줄이 따로 있으면, 옮겨 적는 사람은
            둘이 같은 사람 이야기인지 매번 확인해야 한다.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <FormField
              label="담당 매니저 연락처"
              required
              error={errors.managerPhone?.message}
            >
              <Input
                {...register("managerPhone")}
                placeholder="01012345678"
                hasError={Boolean(errors.managerPhone)}
              />
            </FormField>
          </div>
        </Section>

        <Section title="일정">
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

        {/*
          행사의 시각은 **기본 근무시간**이다.

          실제 근무 시각은 포지션마다 따로 있다(A타임 09–18 · B타임 21–06).
          여기 값은 새 포지션을 만들 때 깔리는 초기값이자 캘린더 · 목록에 행사를
          대표해 적히는 시각이다. 이 사실을 적어 두지 않으면 담당자는 여기만 고치고
          야간 포지션의 시각이 따라 바뀌었다고 믿는다.
        */}
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-medium text-font-1">
            기본 근무시간
            <span className="ml-0.5 text-font-error">*</span>
          </p>
          <p className="text-[12px] text-font-2">
            포지션마다 근무시간을 따로 정합니다. 여기 값은 새 포지션의 초기값이고
            캘린더에 대표로 적힙니다.
            {!event && " 따로 고치지 않은 포지션은 이 시각을 따라갑니다."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="시작 시각" required error={errors.startTime?.message}>
            <Controller
              control={control}
              name="startTime"
              render={({ field }) => (
                <TimeInput
                  value={field.value}
                  onChange={(nextTime) => {
                    followBaseTime("startTime", field.value, nextTime);
                    field.onChange(nextTime);
                  }}
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
                  value={field.value}
                  onBlur={field.onBlur}
                  hasError={Boolean(errors.endTime)}
                  onChange={(nextTime) => {
                    /*
                      시각을 새로 고르면 날짜 넘김을 다시 추측해 깔아 준다.
                      추측은 어디까지나 초기값이고, 사람이 D+1 · D+2를 눌러 확정한다.
                    */
                    const nextOffset = guessDayOffset(startTime, nextTime);

                    followBaseTime("endTime", field.value, nextTime);
                    followBaseTime(
                      "endDayOffset",
                      getValues("endDayOffset"),
                      nextOffset,
                    );
                    field.onChange(nextTime);
                    setValue("endDayOffset", nextOffset);
                  }}
                />
              )}
            />
          </FormField>

          {/*
            휴게시간은 **근무 시간 안에 포함된 시간**이다.

            09:00~18:00에 휴게 1시간이면 그 아홉 시간 중 한 시간을 쉰 것이라
            실근무는 8시간이다. 아홉 시간을 일하고 한 시간을 더 쉬는 것이 아니다.
          */}
          <FormField
            label="휴게시간"
            hint={`근무 시간 안에 포함 · 실근무 ${workHoursLabel}`}
            error={errors.breakMinutes?.message}
          >
            <Controller
              control={control}
              name="breakMinutes"
              render={({ field }) => (
                <Select
                  options={BREAK_MINUTE_OPTIONS}
                  value={String(field.value)}
                  onChange={(changeEvent) => {
                    const next = Number(changeEvent.target.value);

                    followBaseTime("breakMinutes", field.value, next);
                    field.onChange(next);
                  }}
                />
              )}
            />
          </FormField>
        </div>

        {/*
          종료가 며칠 뒤인지.

          방송 · 철야 현장은 24시간을 넘겨 일하는 날이 드물지 않다.
          `13:00~14:00`이 한 시간인지 25시간인지는 시각만으로 알 수 없어서,
          사람이 직접 고르게 한다.
        */}
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
                  onChange={(next) => {
                    followBaseTime("endDayOffset", field.value, next);
                    field.onChange(next);
                  }}
                  baseLabel="근무일"
                />

                <span className="ml-auto text-[12px] text-font-2 tabular-nums">
                  {formatTimeRange(
                    startTime || "--:--",
                    endTime || "--:--",
                    endDayOffset,
                  )}{" "}
                  · 실근무 {workHoursLabel}
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
        </Section>

        <Section
          title="장소 · 현장 안내"
          description="공고문과 출근 안내 문자에 그대로 들어갑니다."
        >
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

        {/*
          현장 좌표.

          지도를 넣지 않는다. 필요한 것이 "여기서 몇 미터인가" 하나뿐이라
          지도 라이브러리를 들일 이유가 없고, 담당자는 답사 때 현장에서
          버튼을 누르거나 지도 앱에서 복사한 좌표를 붙여넣는다.

          **비워 두면 위치를 확인하지 않는다.** 필수로 막으면 좌표를 모르는
          행사를 등록할 수 없고, 그러면 담당자는 아무 숫자나 넣게 된다.
        */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FormField
            label="위도"
            hint="비우면 위치 확인 안 함"
            error={errors.latitude?.message}
          >
            <Input
              {...register("latitude")}
              inputMode="decimal"
              placeholder="예) 37.5447"
              hasError={Boolean(errors.latitude)}
            />
          </FormField>

          <FormField label="경도" error={errors.longitude?.message}>
            <Input
              {...register("longitude")}
              inputMode="decimal"
              placeholder="예) 127.0557"
              hasError={Boolean(errors.longitude)}
            />
          </FormField>

          <Button
            type="button"
            variant="secondary"
            leftIcon={<MapPin size={15} />}
            isLoading={geo.isLoading}
            onClick={async () => {
              const next = await geo.request();

              if (!next) return;

              setValue("latitude", next.latitude, { shouldDirty: true });
              setValue("longitude", next.longitude, { shouldDirty: true });
            }}
          >
            현재 위치로
          </Button>
        </div>

        {geo.error && (
          <p className="text-[12px] text-danger">{geo.error.message}</p>
        )}

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

        {/*
          칸으로 정해지지 않는 당부는 **현장마다 하나씩 있다.**

          예전에는 이 칸이 '행사 설명'이라는 이름으로 내부 메모 옆에 서 있었고
          포털로 내려가지도 않았다. 그러면 담당자는 전할 말을 집합 장소 칸에
          이어 붙이게 되고, 지원자는 "집합 장소" 라벨 아래에서 다른 이야기를 읽는다.
          공고에 그대로 실리는 글이라 집합 · 복장 · 준비물과 한자리에 둔다.
        */}
        <FormField
          label="공고 안내 문구"
          hint="모집 공고에 그대로 실립니다. 인력에게 보입니다."
          error={errors.description?.message}
        >
          <Textarea
            {...register("description")}
            rows={3}
            placeholder="예) 실내 행사라 난방이 잘 됩니다. 식사는 도시락으로 제공되며 중간에 30분씩 교대로 쉽니다."
          />
        </FormField>

        </Section>

        {/*
          포지션은 **등록할 때만** 받는다.

          수정에서 이 값을 다시 받으면 담당자는 "여기서 고치면 반영되겠지"라고 읽는데,
          이미 만든 행사의 포지션은 배치 · 공고 · 계약서가 가리키고 있어 통째로 바꿀 수 없다.
          수정은 행사 상세 개요의 포지션 카드에서 하나씩, 날마다 다른 인원은
          일별 근무자 탭의 "발주 수정"에서 한다. (가이드 13-2)
        */}
        {!event && (
          <Section
            title="포지션"
            description="같은 직무라도 시간대 · 단가가 다르면 포지션을 나눕니다. (예: A타임 · B타임 야간)"
            action={
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Plus size={14} />}
                disabled={jobRoles.length === 0}
                onClick={handleAppendPosition}
                className="shrink-0"
              >
                포지션 추가
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              {fields.map((field, index) => {
                const position = positions[index] ?? field;
                const positionErrors = errors.positions?.[index];
                const wageType = (position.wageType ?? "HOURLY") as WageType;
                const positionOffset = Number(
                  position.endDayOffset ?? 0,
                ) as DayOffset;
                const hasPositionTime = Boolean(
                  position.startTime && position.endTime,
                );

                return (
                  <div
                    key={field.id}
                    className="flex flex-col gap-3 rounded-field border border-border-main p-3"
                  >
                    {/* 이름 · 직무 · 인원 · 삭제. 좁은 화면에서는 한 줄에 하나씩 쌓는다. */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-start">
                      <FormField
                        label="포지션 이름"
                        required
                        error={positionErrors?.name?.message}
                      >
                        <Input
                          {...register(`positions.${index}.name`)}
                          placeholder="예) A타임"
                          hasError={Boolean(positionErrors?.name)}
                        />
                      </FormField>

                      <FormField
                        label="직무"
                        required
                        hint="견적 · 필터에 쓰는 공통 직무"
                        error={positionErrors?.jobRole?.message}
                      >
                        <Controller
                          control={control}
                          name={`positions.${index}.jobRole`}
                          render={({ field: roleField }) => (
                            <Select
                              aria-label="직무"
                              options={jobRoleOptions}
                              value={roleField.value}
                              onChange={(changeEvent) =>
                                handleChangeJobRole(
                                  index,
                                  changeEvent.target.value as JobRole,
                                )
                              }
                            />
                          )}
                        />
                      </FormField>

                      <FormField
                        label="하루 인원"
                        required
                        error={positionErrors?.requiredCount?.message}
                      >
                        <Input
                          type="number"
                          min={1}
                          aria-label="하루 발주 인원"
                          {...register(`positions.${index}.requiredCount`)}
                          rightSlot={
                            <span className="text-[13px] text-font-2">명</span>
                          }
                          hasError={Boolean(positionErrors?.requiredCount)}
                        />
                      </FormField>

                      <IconButton
                        label="포지션 삭제"
                        icon={<Trash size={16} />}
                        tone="danger"
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                        className="justify-self-end sm:mt-7"
                      />
                    </div>

                    {/* 이 포지션의 근무 시각. 기본 근무시간이 초기값이다. */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormField
                        label="시작"
                        required
                        error={positionErrors?.startTime?.message}
                      >
                        <Controller
                          control={control}
                          name={`positions.${index}.startTime`}
                          render={({ field: timeField }) => (
                            <TimeInput
                              value={timeField.value}
                              onChange={timeField.onChange}
                              onBlur={timeField.onBlur}
                              hasError={Boolean(positionErrors?.startTime)}
                            />
                          )}
                        />
                      </FormField>

                      <FormField
                        label="종료"
                        required
                        error={positionErrors?.endTime?.message}
                      >
                        <Controller
                          control={control}
                          name={`positions.${index}.endTime`}
                          render={({ field: timeField }) => (
                            <TimeInput
                              value={timeField.value}
                              onBlur={timeField.onBlur}
                              hasError={Boolean(positionErrors?.endTime)}
                              onChange={(nextTime) => {
                                timeField.onChange(nextTime);
                                setValue(
                                  `positions.${index}.endDayOffset`,
                                  guessDayOffset(
                                    getValues(`positions.${index}.startTime`),
                                    nextTime,
                                  ),
                                );
                              }}
                            />
                          )}
                        />
                      </FormField>

                      <FormField label="휴게">
                        <Controller
                          control={control}
                          name={`positions.${index}.breakMinutes`}
                          render={({ field: breakField }) => (
                            <Select
                              aria-label="휴게시간"
                              options={BREAK_MINUTE_OPTIONS}
                              value={String(breakField.value ?? 0)}
                              onChange={(changeEvent) =>
                                breakField.onChange(
                                  Number(changeEvent.target.value),
                                )
                              }
                            />
                          )}
                        />
                      </FormField>
                    </div>

                    <Controller
                      control={control}
                      name={`positions.${index}.endDayOffset`}
                      render={({ field: offsetField }) => (
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <DayOffsetField
                              value={(offsetField.value ?? 0) as DayOffset}
                              onChange={offsetField.onChange}
                              baseLabel="근무일"
                            />
                            <span className="text-[12px] text-font-2 tabular-nums">
                              {hasPositionTime
                                ? `${formatTimeRange(
                                    position.startTime,
                                    position.endTime,
                                    positionOffset,
                                  )} · 실근무 ${calculateWorkHours(
                                    position.startTime,
                                    position.endTime,
                                    Number(position.breakMinutes) || 0,
                                    positionOffset,
                                  )}시간`
                                : "시각을 입력하세요"}
                            </span>
                          </div>
                          {positionErrors?.endDayOffset?.message && (
                            <p className="text-[12px] text-font-error">
                              {positionErrors.endDayOffset.message}
                            </p>
                          )}
                        </div>
                      )}
                    />

                    {/*
                      지급과 청구를 **한 줄에** 둔다. 두 숫자의 차이가 이 포지션 한 명당
                      마진이라, 떨어뜨려 놓으면 발주를 받아 놓고 밑지는 자리를 알아채지 못한다.
                    */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormField label="지급 기준">
                        <Controller
                          control={control}
                          name={`positions.${index}.wageType`}
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
                            />
                          )}
                        />
                      </FormField>

                      <FormField
                        label="지급 금액"
                        required
                        error={positionErrors?.wage?.message}
                      >
                        <Controller
                          control={control}
                          name={`positions.${index}.wage`}
                          render={({ field: wageField }) => (
                            <AmountInput
                              aria-label="지급 금액"
                              value={Number(wageField.value) || 0}
                              onValueChange={wageField.onChange}
                              onBlur={wageField.onBlur}
                              hasError={Boolean(positionErrors?.wage)}
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
                        error={positionErrors?.billingRate?.message}
                      >
                        <Controller
                          control={control}
                          name={`positions.${index}.billingRate`}
                          render={({ field: billingField }) => (
                            <AmountInput
                              aria-label="청구 단가"
                              value={Number(billingField.value) || 0}
                              onValueChange={billingField.onChange}
                              onBlur={billingField.onBlur}
                              hasError={Boolean(positionErrors?.billingRate)}
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
                      지원 조건. 성별은 **관리자 배치를 막지 않는다**(현장은 유동적이다).
                      다만 포털에서 본인이 지원하는 길은 막아, 조건과 다른 지원이 쌓이지 않게 한다.
                      보건증은 식음료 부스처럼 없으면 현장에 설 수 없는 자리에 켠다.
                    */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Controller
                        control={control}
                        name={`positions.${index}.genderPreference`}
                        render={({ field: genderField }) => (
                          <Select
                            aria-label="성별 조건"
                            options={GENDER_PREFERENCE_OPTIONS}
                            value={genderField.value ?? "ANY"}
                            onChange={(changeEvent) =>
                              genderField.onChange(
                                changeEvent.target.value as GenderPreference,
                              )
                            }
                            selectBoxClassName="w-32"
                          />
                        )}
                      />

                      <Controller
                        control={control}
                        name={`positions.${index}.requiresHealthCert`}
                        render={({ field: certField }) => (
                          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-font-1">
                            <Switch
                              label="보건증 필요"
                              checked={Boolean(certField.value)}
                              onChange={certField.onChange}
                            />
                            보건증 필요
                          </label>
                        )}
                      />
                    </div>
                  </div>
                );
              })}

              {positionsError && (
                <p className="text-[12px] text-font-error">{positionsError}</p>
              )}

              {/*
                여러 날 진행하는 행사에서 가장 자주 나는 사고가
                "하루치 인원인 줄 알았는데 전체 인원이었다"는 오해다.
                입력한 값이 며칠에 몇 명이 되는지 여기서 못박아 둔다.
              */}
              <p className="text-[12px] text-font-2">
                인원은 <b>하루 기준</b>입니다.
                {workDates.length > 1 && (
                  <>
                    {" "}
                    근무일 {workDates.length}일에 같은 인원이 깔리며, 날짜별
                    편차는 행사 상세의 일별 근무자 탭에서 조정합니다.
                  </>
                )}{" "}
                청구 단가는 기준 설정의 직무 단가를 기본으로 가져옵니다.
              </p>
            </div>
          </Section>
        )}

        <Section title="메모">
        <FormField
          label="내부 메모"
          hint="인력에게는 보이지 않습니다."
          error={errors.memo?.message}
        >
          <Textarea {...register("memo")} rows={2} />
        </FormField>
        </Section>
      </form>
    </Modal>
  );
};

export default EventFormModal;
