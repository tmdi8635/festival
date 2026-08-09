"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useFieldArray } from "react-hook-form";
import { useClientMutation } from "@/api/client/mutateClient";
import {
  EMPTY_CLIENT_VALUES,
  clientSchema,
  type ClientSchema,
  type ClientSchemaInput,
} from "@/schema/client.schema";
import { useJobRoleLabel } from "@/store/useOrgStore";
import type { Client } from "@/type/client";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import Textarea from "@/components/ui/Textarea";

interface ClientFormModalProps {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
}

/**
 * 거래처 등록 · 수정 모달.
 *
 * 직무별 청구 단가가 있어야 행사마다 마진을 계산할 수 있다.
 * 단가 없이 발주만 받다 보면 남는지 밑지는지 알 수 없다.
 */
const ClientFormModal = ({ isOpen, client, onClose }: ClientFormModalProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const { createMutation, updateMutation } = useClientMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    // 입력 타입(coerce 전)과 출력 타입(coerce 후)이 달라 제네릭 세 개를 모두 넘긴다.
  } = useForm<ClientSchemaInput, unknown, ClientSchema>({
    resolver: zodResolver(clientSchema),
    defaultValues: EMPTY_CLIENT_VALUES,
  });

  const { fields } = useFieldArray({ control, name: "billingRates" });

  useEffect(() => {
    if (!isOpen) return;

    reset(
      client
        ? {
            name: client.name,
            businessNumber: client.businessNumber,
            managerName: client.managerName,
            managerPhone: client.managerPhone,
            managerEmail: client.managerEmail,
            billingRates: client.billingRates,
            isActive: client.isActive,
            memo: client.memo,
          }
        : EMPTY_CLIENT_VALUES,
    );
  }, [isOpen, client, reset]);

  const onSubmit = handleSubmit((values) => {
    if (client) {
      updateMutation.mutate(
        { clientId: client.clientId, body: values },
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
      title={client ? "거래처 수정" : "거래처 등록"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {client ? "저장" : "등록"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="거래처명" required error={errors.name?.message}>
            <Input {...register("name")} hasError={Boolean(errors.name)} />
          </FormField>

          <FormField
            label="사업자등록번호"
            error={errors.businessNumber?.message}
          >
            <Input
              {...register("businessNumber")}
              placeholder="000-00-00000"
              hasError={Boolean(errors.businessNumber)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="담당자" required error={errors.managerName?.message}>
            <Input
              {...register("managerName")}
              hasError={Boolean(errors.managerName)}
            />
          </FormField>

          <FormField
            label="담당자 연락처"
            required
            error={errors.managerPhone?.message}
          >
            <Input
              {...register("managerPhone")}
              placeholder="01012345678"
              hasError={Boolean(errors.managerPhone)}
            />
          </FormField>

          <FormField label="담당자 이메일" error={errors.managerEmail?.message}>
            <Input
              {...register("managerEmail")}
              hasError={Boolean(errors.managerEmail)}
            />
          </FormField>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-font-1">
            직무별 청구 단가 (시급)
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-field border border-border-main p-3">
            {fields.map((field, index) => (
              <label key={field.id} className="flex flex-col gap-1.5">
                <span className="text-[13px] text-font-2">
                  {jobRoleLabel(field.role)}
                </span>
                <Input
                  type="number"
                  {...register(`billingRates.${index}.rate`)}
                  rightSlot={<span className="text-[13px] text-font-2">원</span>}
                />
              </label>
            ))}
          </div>

          <p className="text-[12px] text-font-2">
            인건비와 비교해 행사별 마진을 계산합니다.
          </p>
        </div>

        <FormField label="메모" error={errors.memo?.message}>
          <Textarea
            {...register("memo")}
            rows={3}
            placeholder="예) 정산이 익월 15일로 늦다. 출입증 명단 사전 제출 필수."
          />
        </FormField>

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <div className="flex items-center justify-between rounded-field border border-border-main px-4 py-3">
              <div>
                <p className="text-[14px] text-font-1">거래 중</p>
                <p className="mt-0.5 text-[12px] text-font-2">
                  끄면 행사 등록 시 선택지에서 뒤로 밀립니다.
                </p>
              </div>
              <Switch
                label="거래 여부"
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

export default ClientFormModal;
