"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { usePostingListQuery } from "@/api/recruit/getPostingList";
import { useApplicationMutation } from "@/api/recruit/mutateApplication";
import { formatDate } from "@/lib/dayjs";
import { formatWithCommas } from "@/lib/utils";
import {
  EMPTY_APPLICATION_VALUES,
  applicationSchema,
  type ApplicationSchema,
  type ApplicationSchemaInput,
} from "@/schema/recruit.schema";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { WAGE_TYPE_LABEL, formatTimeRange } from "@/type/event";
import { formatLineLabel } from "@/type/recruit";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import DateChips from "@/components/domain/DateChips";

interface ApplicationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 지원 등록 모달.
 *
 * 앱이 붙기 전까지는 문자로 받은 지원을 사람이 옮겨 적어야 한다.
 * 휴대폰번호로 기존 인력을 자동으로 이어 붙이므로, 이력이 끊기지 않는다.
 *
 * 공고는 행사 하나를 덮고 그 안에 모집 줄이 여럿이라, **어느 줄에 지원했는지**를
 * 함께 받는다. 날짜를 골라 받는 줄이면 문자에 적힌 가능한 날도 옮겨 적는다.
 */
const ApplicationFormModal = ({ isOpen, onClose }: ApplicationFormModalProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const { data: postingData } = usePostingListQuery({
    page: 1,
    size: 100,
    status: "OPEN",
  });
  const { createMutation } = useApplicationMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
    // 입력 타입(coerce 전)과 출력 타입(coerce 후)이 달라 제네릭 세 개를 모두 넘긴다.
  } = useForm<ApplicationSchemaInput, unknown, ApplicationSchema>({
    resolver: zodResolver(applicationSchema),
    defaultValues: EMPTY_APPLICATION_VALUES,
  });

  useEffect(() => {
    if (isOpen) reset(EMPTY_APPLICATION_VALUES);
  }, [isOpen, reset]);

  const postings = useMemo(() => postingData?.content ?? [], [postingData]);
  const postingId = Number(watch("postingId")) || 0;
  const targetId = Number(watch("targetId")) || 0;
  const selectedPosting = postings.find(
    (posting) => posting.postingId === postingId,
  );
  const selectedLine = selectedPosting?.lines.find(
    (line) => line.targetId === targetId,
  );
  /** 날짜를 받아 적어야 하는 줄인가. 전일 줄 · 하루짜리는 고를 것이 없다 */
  const needsDates =
    selectedLine?.participation === "SPLIT" && selectedLine.workDates.length > 1;

  const postingOptions = [
    { label: "공고를 선택하세요", value: "0" },
    ...postings.map((posting) => ({
      label: `${formatDate(posting.workDate)} · ${posting.title}`,
      value: String(posting.postingId),
    })),
  ];

  /* 줄 선택지. 이름만으로는 A · B타임 · 급구 줄의 차이가 안 보여 날짜 · 시각 · 금액을 붙인다. */
  const lineOptions = [
    {
      label: selectedPosting ? "모집 포지션을 선택하세요" : "공고를 먼저 고르세요",
      value: "0",
    },
    ...(selectedPosting?.lines ?? []).map((line) => ({
      label: `${formatLineLabel(line, selectedPosting?.workDates.length ?? 1)} (${jobRoleLabel(line.jobRole)}) · ${formatTimeRange(
        line.startTime,
        line.endTime,
        line.endDayOffset,
      )} · ${WAGE_TYPE_LABEL[line.wageType]} ${formatWithCommas(line.wage)}원`,
      value: String(line.targetId),
    })),
  ];

  const onSubmit = handleSubmit((values) => {
    /* 날짜를 고르는 줄인데 하루도 안 골랐으면 확정할 날이 없다. (스키마는 줄을 모른다) */
    if (needsDates && values.dates.length === 0) {
      setError("dates", { message: "문자에 적힌 가능한 날을 하루 이상 골라 주세요." });
      return;
    }

    createMutation.mutate(
      { ...values, dates: needsDates ? values.dates : [] },
      { onSuccess: onClose },
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="지원 등록"
      description="문자나 카톡으로 받은 지원을 옮겨 적습니다."
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            등록
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Alert tone="info" title="이미 등록된 번호면 기존 인력에 연결됩니다.">
          인력풀에 없는 번호로 등록하면 신규 지원자로 표시되고, 확정 전에 인사
          등록과 서류 접수가 필요합니다.
        </Alert>

        <FormField label="공고" required error={errors.postingId?.message}>
          <Controller
            control={control}
            name="postingId"
            render={({ field }) => (
              <Select
                options={postingOptions}
                value={String(field.value)}
                onChange={(event) => {
                  const nextPostingId = Number(event.target.value);
                  const nextPosting = postings.find(
                    (posting) => posting.postingId === nextPostingId,
                  );

                  field.onChange(nextPostingId);
                  /*
                    공고가 바뀌면 앞 공고의 줄 · 날짜는 의미가 없다.
                    줄이 하나뿐인 공고면 고를 것이 없으니 바로 채운다.
                  */
                  setValue(
                    "targetId",
                    nextPosting?.lines.length === 1 ? nextPosting.lines[0].targetId : 0,
                  );
                  setValue("dates", []);
                }}
                hasError={Boolean(errors.postingId)}
              />
            )}
          />
        </FormField>

        <FormField
          label="모집 포지션"
          required
          hint="확정하면 이 줄의 날짜에 배치됩니다."
          error={errors.targetId?.message}
        >
          <Controller
            control={control}
            name="targetId"
            render={({ field }) => (
              <Select
                options={lineOptions}
                value={String(field.value ?? 0)}
                disabled={!selectedPosting}
                onChange={(event) => {
                  field.onChange(Number(event.target.value));
                  setValue("dates", []);
                }}
                hasError={Boolean(errors.targetId)}
              />
            )}
          />
        </FormField>

        {needsDates && selectedLine && (
          <FormField
            label="가능한 날"
            required
            hint="문자에 적힌 날만 고르세요. 확정할 때 이 중 일부만 확정할 수 있습니다."
            error={errors.dates?.message}
          >
            <Controller
              control={control}
              name="dates"
              render={({ field }) => {
                const picked = field.value ?? [];

                return (
                  <DateChips
                    dates={selectedLine.workDates}
                    selected={picked}
                    onToggle={(date) =>
                      field.onChange(
                        picked.includes(date)
                          ? picked.filter((item) => item !== date)
                          : [...picked, date].sort(),
                      )
                    }
                  />
                );
              }}
            />
          </FormField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="지원자 이름"
            required
            error={errors.applicantName?.message}
          >
            <Input
              {...register("applicantName")}
              hasError={Boolean(errors.applicantName)}
            />
          </FormField>

          <FormField
            label="연락처"
            required
            hint="'-' 없이 숫자만"
            error={errors.phoneNumber?.message}
          >
            <Input
              {...register("phoneNumber")}
              placeholder="01012345678"
              hasError={Boolean(errors.phoneNumber)}
            />
          </FormField>
        </div>

        <FormField label="메모" error={errors.note?.message}>
          <Textarea
            {...register("note")}
            rows={3}
            placeholder="예) 오후 2시부터 가능. 같은 브랜드 팝업 경험 있음."
          />
        </FormField>
      </form>
    </Modal>
  );
};

export default ApplicationFormModal;
