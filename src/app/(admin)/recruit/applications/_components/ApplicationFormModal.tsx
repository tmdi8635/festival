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
import {
  WAGE_TYPE_LABEL,
  formatPositionLabel,
  formatTimeRange,
} from "@/type/event";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

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
 * 공고는 행사 하나를 덮고 그 안에 포지션이 여럿이라, **어느 포지션에 지원했는지**를
 * 함께 받는다. 그래야 확정할 때 그 포지션 발주가 있는 날마다 배치가 만들어진다.
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
  const selectedPosting = postings.find(
    (posting) => posting.postingId === postingId,
  );

  const postingOptions = [
    { label: "공고를 선택하세요", value: "0" },
    ...postings.map((posting) => ({
      label: `${formatDate(posting.workDate)} · ${posting.title}`,
      value: String(posting.postingId),
    })),
  ];

  /* 포지션 선택지. 이름만으로는 A · B타임의 차이가 안 보여 시각 · 금액을 붙인다. */
  const positionOptions = [
    {
      label: selectedPosting ? "포지션을 선택하세요" : "공고를 먼저 고르세요",
      value: "0",
    },
    ...(selectedPosting?.positions ?? []).map((position) => ({
      label: `${formatPositionLabel(position, jobRoleLabel)} · ${formatTimeRange(
        position.startTime,
        position.endTime,
        position.endDayOffset,
      )} · ${WAGE_TYPE_LABEL[position.wageType]} ${formatWithCommas(position.wage)}원`,
      value: String(position.positionId),
    })),
  ];

  const onSubmit = handleSubmit((values) => {
    createMutation.mutate(values, { onSuccess: onClose });
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
                    공고가 바뀌면 앞 공고의 포지션은 의미가 없다.
                    포지션이 하나뿐인 공고면 고를 것이 없으니 바로 채운다.
                  */
                  setValue(
                    "positionId",
                    nextPosting?.positions.length === 1
                      ? nextPosting.positions[0].positionId
                      : 0,
                  );
                }}
                hasError={Boolean(errors.postingId)}
              />
            )}
          />
        </FormField>

        <FormField
          label="포지션"
          required
          hint="확정하면 이 포지션 발주가 있는 근무일마다 배치됩니다."
          error={errors.positionId?.message}
        >
          <Controller
            control={control}
            name="positionId"
            render={({ field }) => (
              <Select
                options={positionOptions}
                value={String(field.value ?? 0)}
                disabled={!selectedPosting}
                onChange={(event) => field.onChange(Number(event.target.value))}
                hasError={Boolean(errors.positionId)}
              />
            )}
          />
        </FormField>

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
