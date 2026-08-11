"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useClientMutation } from "@/api/client/mutateClient";
import {
  EMPTY_CLIENT_VALUES,
  clientSchema,
  type ClientSchema,
  type ClientSchemaInput,
} from "@/schema/client.schema";
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
 * ## 여기에 단가는 없다
 *
 * 예전에는 거래처마다 직무별 청구 단가를 적어 두고 행사가 그걸 물려받았다.
 * 그런데 실제 거래는 반대 방향이다 — 대행사가 직무별 인원수로 견적을
 * 요청하면 **에이전시가 단가를 불러 준다.** 거래처마다 단가를 적어 두면
 * "저쪽이 정해 준 값"처럼 읽히고, 같은 직무의 우리 단가가 거래처 수만큼
 * 흩어져 어느 것이 우리 기준인지 알 수 없어진다.
 *
 * 단가는 '운영 > 기준 설정'이 원본이고, 행사 등록 시 그 값이 깔린 뒤
 * 행사별로 고쳐진다. (`EventDetail.billingRates`)
 */
const ClientFormModal = ({ isOpen, client, onClose }: ClientFormModalProps) => {
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
      onSubmit={onSubmit}
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

        {/*
          단가 칸을 여기 두지 않는 이유를 화면에도 적어 둔다.
          예전에 있던 칸이 사라지면 담당자는 "어디로 갔나"를 먼저 찾는다.
        */}
        <p className="rounded-field border border-dashed border-border-strong px-4 py-3 text-[13px] text-font-2">
          청구 단가는 거래처가 아니라 <b className="text-font-1">운영 &gt; 기준
          설정</b>에서 직무별로 정합니다. 견적 단가를 부르는 쪽이 우리이기
          때문입니다. 이 거래처에만 다른 금액을 받기로 했다면 행사 등록 화면에서
          그 행사만 고치세요.
        </p>

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
