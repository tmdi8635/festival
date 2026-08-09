"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminRoleListQuery } from "@/api/ops/getAdminRoleList";
import { Controller, useForm } from "react-hook-form";
import { useManagerMutation } from "@/api/ops/mutateManager";
import {
  EMPTY_MANAGER_VALUES,
  managerSchema,
  type ManagerSchema,
} from "@/schema/ops.schema";
import { type Manager } from "@/type/ops";
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
  const router = useRouter();
  const { createMutation, updateMutation } = useManagerMutation();
  const { data: roleData } = useAdminRoleListQuery();

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
            roleId: manager.roleId,
            isActive: manager.isActive,
          }
        : EMPTY_MANAGER_VALUES,
    );
  }, [isOpen, manager, reset]);

  const roleId = watch("roleId");

  const roles = roleData?.items ?? [];
  const roleOptions = roles.map((item) => ({
    label: item.isSuperAdmin ? `${item.name} (전권)` : item.name,
    value: String(item.roleId),
  }));
  const selectedRole = roles.find((item) => item.roleId === roleId);

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

        {/*
          권한을 여기서 직접 고르지 않는다. **직책을 고른다.**
          담당자마다 권한을 주면 규칙이 바뀔 때 전원을 다시 손봐야 하고,
          한 명만 빠뜨리면 그 사람만 조용히 다른 권한을 갖게 된다.
        */}
        <FormField label="직책" required error={errors.roleId?.message}>
          <Controller
            control={control}
            name="roleId"
            render={({ field }) => (
              <Select
                options={roleOptions}
                placeholder="직책을 선택하세요"
                value={String(field.value || "")}
                onChange={(event) => field.onChange(Number(event.target.value))}
              />
            )}
          />
        </FormField>

        {selectedRole && (
          <Alert
            tone="info"
            title={`'${selectedRole.name}'이 할 수 있는 일`}
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => router.push("/ops/roles")}
              >
                직책 설정
              </Button>
            }
          >
            {selectedRole.description}
          </Alert>
        )}

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
