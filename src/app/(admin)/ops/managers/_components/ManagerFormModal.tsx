"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useManagerMutation } from "@/api/ops/mutateManager";
import { MANAGER_ROLE_OPTIONS } from "@/constants/opsOptions";
import {
  EMPTY_MANAGER_VALUES,
  managerSchema,
  type ManagerSchema,
} from "@/schema/ops.schema";
import {
  MANAGER_ROLE_DESCRIPTION,
  type Manager,
  type ManagerRole,
} from "@/type/ops";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";

interface ManagerFormModalProps {
  isOpen: boolean;
  manager: Manager | null;
  onClose: () => void;
}

/** 내부 담당자 폼. 권한 설명을 함께 보여 줘야 잘못 준 권한을 줄일 수 있다. */
const ManagerFormModal = ({
  isOpen,
  manager,
  onClose,
}: ManagerFormModalProps) => {
  const { createMutation, updateMutation } = useManagerMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ManagerSchema>({
    resolver: zodResolver(managerSchema),
    defaultValues: EMPTY_MANAGER_VALUES,
  });

  useEffect(() => {
    if (!isOpen) return;

    reset(
      manager
        ? {
            name: manager.name,
            email: manager.email,
            phoneNumber: manager.phoneNumber,
            role: manager.role,
            isActive: manager.isActive,
          }
        : EMPTY_MANAGER_VALUES,
    );
  }, [isOpen, manager, reset]);

  const role = watch("role");

  const onSubmit = handleSubmit((values) => {
    if (manager) {
      updateMutation.mutate(
        { managerId: manager.managerId, body: values },
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
      title={manager ? "담당자 수정" : "담당자 추가"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {manager ? "저장" : "추가"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="이름" required error={errors.name?.message}>
          <Input {...register("name")} hasError={Boolean(errors.name)} />
        </FormField>

        <FormField label="이메일" required error={errors.email?.message}>
          <Input {...register("email")} hasError={Boolean(errors.email)} />
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

        <FormField label="권한" required error={errors.role?.message}>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select
                options={MANAGER_ROLE_OPTIONS}
                value={field.value}
                onChange={(event) =>
                  field.onChange(event.target.value as ManagerRole)
                }
              />
            )}
          />
        </FormField>

        <Alert tone="info" title="이 권한으로 할 수 있는 일">
          {MANAGER_ROLE_DESCRIPTION[role]}
        </Alert>

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <div className="flex items-center justify-between rounded-field border border-border-main px-4 py-3">
              <div>
                <p className="text-[14px] text-font-1">계정 사용</p>
                <p className="mt-0.5 text-[12px] text-font-2">
                  끄면 로그인과 담당자 지정이 막힙니다.
                </p>
              </div>
              <Switch
                label="계정 사용 여부"
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

export default ManagerFormModal;
