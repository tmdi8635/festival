"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMessageTemplateMutation } from "@/api/message/mutateMessageTemplate";
import {
  MESSAGE_CHANNEL_OPTIONS,
  MESSAGE_PURPOSE_OPTIONS,
} from "@/constants/messageOptions";
import {
  EMPTY_MESSAGE_TEMPLATE_VALUES,
  messageTemplateSchema,
  type MessageTemplateSchema,
} from "@/schema/message.schema";
import {
  MESSAGE_VARIABLES,
  SMS_BYTE_LIMIT,
  calculateMessageBytes,
  type MessageChannel,
  type MessagePurpose,
  type MessageTemplate,
} from "@/type/message";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";
import Textarea from "@/components/ui/Textarea";

interface MessageTemplateFormModalProps {
  isOpen: boolean;
  template: MessageTemplate | null;
  onClose: () => void;
}

/** 메시지 템플릿 폼. 변수는 근로계약서와 같은 `{{변수}}` 문법을 쓴다. */
const MessageTemplateFormModal = ({
  isOpen,
  template,
  onClose,
}: MessageTemplateFormModalProps) => {
  const { createMutation, updateMutation } = useMessageTemplateMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MessageTemplateSchema>({
    resolver: zodResolver(messageTemplateSchema),
    defaultValues: EMPTY_MESSAGE_TEMPLATE_VALUES,
  });

  useEffect(() => {
    if (!isOpen) return;

    reset(
      template
        ? {
            name: template.name,
            purpose: template.purpose,
            channel: template.channel,
            content: template.content,
            isActive: template.isActive,
          }
        : EMPTY_MESSAGE_TEMPLATE_VALUES,
    );
  }, [isOpen, template, reset]);

  const content = watch("content");
  const channel = watch("channel");
  const bytes = calculateMessageBytes(content ?? "");

  const onSubmit = handleSubmit((values) => {
    if (template) {
      updateMutation.mutate(
        { templateId: template.templateId, body: values },
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
      title={template ? "템플릿 수정" : "템플릿 추가"}
      size="lg"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {template ? "저장" : "추가"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="템플릿 이름" required error={errors.name?.message}>
          <Input {...register("name")} hasError={Boolean(errors.name)} />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="용도" required error={errors.purpose?.message}>
            <Controller
              control={control}
              name="purpose"
              render={({ field }) => (
                <Select
                  options={MESSAGE_PURPOSE_OPTIONS}
                  value={field.value}
                  onChange={(event) =>
                    field.onChange(event.target.value as MessagePurpose)
                  }
                />
              )}
            />
          </FormField>

          <FormField label="발송 수단" required error={errors.channel?.message}>
            <Controller
              control={control}
              name="channel"
              render={({ field }) => (
                <Select
                  options={MESSAGE_CHANNEL_OPTIONS}
                  value={field.value}
                  onChange={(event) =>
                    field.onChange(event.target.value as MessageChannel)
                  }
                />
              )}
            />
          </FormField>
        </div>

        <Alert tone="info" title="사용할 수 있는 변수">
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {MESSAGE_VARIABLES.map((variable) => (
              <span key={variable.token} className="text-[12px]">
                <code className="rounded-[4px] bg-surface px-1 py-0.5 text-font-1">
                  {variable.token}
                </code>{" "}
                {variable.description}
              </span>
            ))}
          </div>
        </Alert>

        <FormField
          label="내용"
          required
          hint={`${bytes}바이트${channel === "SMS" ? ` / ${SMS_BYTE_LIMIT}` : ""}`}
          error={errors.content?.message}
        >
          <Textarea
            {...register("content")}
            rows={12}
            hasError={Boolean(errors.content)}
          />
        </FormField>

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <div className="flex items-center justify-between rounded-field border border-border-main px-4 py-3">
              <div>
                <p className="text-[14px] text-font-1">사용</p>
                <p className="mt-0.5 text-[12px] text-font-2">
                  끄면 발송 화면의 선택지에서 사라집니다.
                </p>
              </div>
              <Switch
                label="사용 여부"
                checked={field.value}
                onChange={field.onChange}
              />
            </div>
          )}
        />
      </form>
    </Modal>
  );
};

export default MessageTemplateFormModal;
