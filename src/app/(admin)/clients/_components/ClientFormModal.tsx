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
import { useActiveJobRoles } from "@/store/useOrgStore";
import { compactBillingRates, resolveBillingRate } from "@/type/client";
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
 * ## 청구 단가는 지금 쓰는 직무를 따라간다
 *
 * 예전에는 코드에 박힌 기본 직무 목록(`DEFAULT_JOB_ROLES`)으로 칸을 깔았다.
 * 직무는 에이전시가 기준 설정에서 자유롭게 고치는 값인데, 그러면 이름을
 * 바꾼 직무는 옛 이름으로 남고 새로 만든 직무는 **아예 칸이 생기지 않는다.**
 * 그래서 지금 켜져 있는 직무로 매번 다시 깐다.
 *
 * ## 비워 둬도 된다
 *
 * 단가가 있어야 마진이 계산되지만, 단가를 아직 협의하지 않은 거래처가
 * 훨씬 많다. 여기서 막으면 거래처를 못 만들고 그러면 행사도 못 만든다.
 * 비운 직무는 저장되지 않고, 마진만 계산되지 않는다.
 */
const ClientFormModal = ({ isOpen, client, onClose }: ClientFormModalProps) => {
  const jobRoles = useActiveJobRoles();
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

    /*
      칸은 **지금 켜져 있는 직무**로 깔고, 저장된 단가를 그 위에 얹는다.
      꺼진 직무의 단가는 지우지 않고 그냥 안 보여 준다. (지난 행사가 쓴다)
    */
    const billingRates = jobRoles.map((role) => {
      const rate = resolveBillingRate(client?.billingRates ?? [], role.code);

      /* 안 정한 단가는 `0`이 아니라 빈 칸이다. 0원 청구와 미설정은 다르다. */
      return { role: role.code, rate: rate > 0 ? rate : "" };
    });

    reset(
      client
        ? {
            name: client.name,
            businessNumber: client.businessNumber,
            managerName: client.managerName,
            managerPhone: client.managerPhone,
            managerEmail: client.managerEmail,
            billingRates,
            isActive: client.isActive,
            memo: client.memo,
          }
        : { ...EMPTY_CLIENT_VALUES, billingRates },
    );
  }, [isOpen, client, reset, jobRoles]);

  const onSubmit = handleSubmit((values) => {
    // 비워 둔 직무(0원)는 저장하지 않는다. '0원 청구'와 '아직 안 정함'은 다르다.
    const body = {
      ...values,
      billingRates: compactBillingRates(values.billingRates),
    };

    if (client) {
      updateMutation.mutate(
        { clientId: client.clientId, body },
        { onSuccess: onClose },
      );

      return;
    }

    createMutation.mutate(body, { onSuccess: onClose });
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

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-font-1">
            직무별 청구 단가 (시급)
            <span className="ml-1.5 text-[12px] font-normal text-font-2">
              선택
            </span>
          </p>

          {fields.length === 0 ? (
            <p className="rounded-field border border-border-main px-4 py-3 text-[13px] text-font-2">
              사용 중인 직무가 없습니다. 운영 &gt; 기준 설정에서 직무를 먼저
              만들어 주세요.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-field border border-border-main p-3">
              {fields.map((field, index) => (
                <label key={field.id} className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-font-2">
                    {jobRoles[index]?.name ?? field.role}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="미설정"
                    {...register(`billingRates.${index}.rate`)}
                    rightSlot={
                      <span className="text-[13px] text-font-2">원</span>
                    }
                  />
                </label>
              ))}
            </div>
          )}

          <p className="text-[12px] text-font-2">
            행사를 등록할 때 이 값을 기본으로 가져오고, 행사마다 자유롭게 고칠
            수 있습니다. 비워 두면 그 직무는 마진 계산에서 빠집니다.
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
