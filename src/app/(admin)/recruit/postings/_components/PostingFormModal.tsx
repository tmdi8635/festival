"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { usePostingMutation } from "@/api/recruit/mutatePosting";
import { WAGE_TYPE_OPTIONS } from "@/constants/eventOptions";
import { Calendar } from "@/icons";
import { cn } from "@/lib/utils";
import {
  EMPTY_POSTING_VALUES,
  postingSchema,
  type PostingSchema,
  type PostingSchemaInput,
} from "@/schema/recruit.schema";
import { useJobRoleOptions } from "@/store/useOrgStore";
import {
  WAGE_TYPE_UNIT,
  type EventSummary,
  type WageType,
} from "@/type/event";
import type { JobPosting } from "@/type/recruit";
import type { JobRole } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import CopyButton from "@/components/domain/CopyButton";
import EventPickerModal from "@/components/domain/EventPickerModal";

interface PostingFormModalProps {
  isOpen: boolean;
  posting: JobPosting | null;
  onClose: () => void;
}

/**
 * 공고 등록 · 수정 모달.
 *
 * 공고문은 행사 정보로 서버가 초안을 만들어 준다.
 * 손으로 쓰다 보면 시급 · 집합 장소가 빠지는 일이 잦아서다.
 */
const PostingFormModal = ({
  isOpen,
  posting,
  onClose,
}: PostingFormModalProps) => {
  const jobRoleOptions = useJobRoleOptions();
  const { createMutation, updateMutation } = usePostingMutation();

  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
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
            role: posting.role,
            requiredCount: posting.requiredCount,
            wageType: posting.wageType,
            wage: posting.wage,
            content: posting.content,
          }
        : EMPTY_POSTING_VALUES,
    );
  }, [isOpen, posting, reset]);

  const content = watch("content");
  // 금액 입력창의 단위를 지급 기준에 맞춰 바꾼다.
  const wageType = watch("wageType");

  const onSubmit = handleSubmit((values) => {
    if (posting) {
      updateMutation.mutate(
        { postingId: posting.postingId, body: values },
        { onSuccess: onClose },
      );

      return;
    }

    createMutation.mutate(values, { onSuccess: onClose });
  });

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={posting ? "공고 수정" : "공고 등록"}
      description="행사를 고르면 공고문 초안이 자동으로 만들어집니다."
      size="lg"
      footer={
        <>
          <CopyButton
            value={content ?? ""}
            label="공고문 복사"
            successMessage="공고문을 복사했습니다. 오픈카톡방에 붙여넣으세요."
          />
          <Button variant="ghost" onClick={onClose}>
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
                {selectedEvent ? (
                  <span className="min-w-0 flex-1 truncate text-font-1">
                    {selectedEvent.title}
                  </span>
                ) : (
                  <span className="flex-1 text-font-disabled">
                    행사를 선택하세요
                  </span>
                )}
                <span className="shrink-0 text-[13px] text-brand">
                  {field.value ? "변경" : "선택"}
                </span>
              </button>
            )}
          />
        </FormField>

        <FormField label="공고 제목" required error={errors.title?.message}>
          <Input
            {...register("title")}
            placeholder="예) 성수 팝업스토어 · 스태프 5명"
            hasError={Boolean(errors.title)}
          />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="직무" required error={errors.role?.message}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select
                  options={jobRoleOptions}
                  value={field.value}
                  onChange={(event) =>
                    field.onChange(event.target.value as JobRole)
                  }
                />
              )}
            />
          </FormField>

          <FormField
            label="모집 인원"
            required
            error={errors.requiredCount?.message}
          >
            <Input
              type="number"
              {...register("requiredCount")}
              rightSlot={<span className="text-[13px] text-font-2">명</span>}
              hasError={Boolean(errors.requiredCount)}
            />
          </FormField>

          {/* 공고에 적히는 금액. 시급인지 일급인지가 지원자에게 가장 중요한 정보다. */}
          <FormField label="지급 기준" required>
            <Controller
              control={control}
              name="wageType"
              render={({ field }) => (
                <Select
                  options={WAGE_TYPE_OPTIONS}
                  value={field.value}
                  onChange={(changeEvent) =>
                    field.onChange(changeEvent.target.value as WageType)
                  }
                />
              )}
            />
          </FormField>

          <FormField label="금액" required error={errors.wage?.message}>
            <Input
              type="number"
              {...register("wage")}
              rightSlot={
                <span className="text-[13px] whitespace-nowrap text-font-2">
                  {WAGE_TYPE_UNIT[wageType ?? "HOURLY"]}
                </span>
              }
              hasError={Boolean(errors.wage)}
            />
          </FormField>
        </div>

        <Alert tone="info" title="공고문은 그대로 복사해 쓰는 글입니다.">
          비워 두고 등록하면 행사 정보(집합 장소 · 복장 · 준비물)로 초안을
          자동으로 만들어 채웁니다.
        </Alert>

        <FormField label="공고문" required error={errors.content?.message}>
          <Textarea
            {...register("content")}
            rows={14}
            placeholder="비워 두면 행사 정보로 자동 생성됩니다."
            hasError={Boolean(errors.content)}
          />
        </FormField>
      </form>
    </Modal>

      <EventPickerModal
        isOpen={isPickerOpen}
        selectedEventId={selectedEvent?.eventId}
        description="공고를 낼 행사를 고르세요. 인원이 덜 찬 행사부터 확인하면 좋습니다."
        onSelect={(event) => {
          setSelectedEvent(event);
          setValue("eventId", event.eventId, { shouldValidate: true });
        }}
        onClose={() => setIsPickerOpen(false)}
      />
    </>
  );
};

export default PostingFormModal;
