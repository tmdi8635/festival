"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useEmployeeMutation } from "@/api/employee/mutateEmployee";
import {
  EMPTY_EMPLOYEE_VALUES,
  employeeSchema,
  type EmployeeSchema,
  type EmployeeSchemaInput,
} from "@/schema/employee.schema";
import {
  DEFAULT_BASE_MONTHLY_HOURS,
  EMPLOYEE_POSITION_PRESETS,
  type Employee,
} from "@/type/employee";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import Textarea from "@/components/ui/Textarea";

interface EmployeeFormModalProps {
  isOpen: boolean;
  employee: Employee | null;
  onClose: () => void;
}

/**
 * 직원 등록 · 수정.
 *
 * 인력풀 폼과 칸이 다르다. 서류 · 계좌 · 활동 지역 · 가능 직무를 받지 않는다.
 * 계약서를 쓰지 않고 시급 정산도 하지 않아, 그 값들이 어디에도 쓰이지 않기 때문이다.
 * 대신 **직책**과 **기본 근무시간**을 받는다. 이 둘이 직원 관리의 전부다.
 */
const EmployeeFormModal = ({
  isOpen,
  employee,
  onClose,
}: EmployeeFormModalProps) => {
  const { createMutation, updateMutation } = useEmployeeMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
    // 입력 타입(coerce 전)과 출력 타입(coerce 후)이 달라 제네릭 세 개를 모두 넘긴다.
  } = useForm<EmployeeSchemaInput, unknown, EmployeeSchema>({
    resolver: zodResolver(employeeSchema),
    defaultValues: EMPTY_EMPLOYEE_VALUES,
  });

  useEffect(() => {
    if (!isOpen) return;

    reset(
      employee
        ? {
            name: employee.name,
            phoneNumber: employee.phoneNumber,
            position: employee.position,
            hireDate: employee.hireDate,
            baseMonthlyHours: employee.baseMonthlyHours,
            isActive: employee.isActive,
            memo: employee.memo,
          }
        : EMPTY_EMPLOYEE_VALUES,
    );
  }, [isOpen, employee, reset]);

  const onSubmit = handleSubmit((values) => {
    if (employee) {
      updateMutation.mutate(
        { staffId: employee.staffId, body: values },
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
      title={employee ? "직원 정보 수정" : "직원 등록"}
      description="직원은 행사에서 직무와 관계없이 어느 자리에나 배치할 수 있습니다."
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {employee ? "저장" : "등록"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="이름" required error={errors.name?.message}>
            <Input {...register("name")} hasError={Boolean(errors.name)} />
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

        {/*
          직책은 직무가 아니다.

          직무(팀장 · 스태프)는 행사에서 맡는 자리이고, 직책(대리 · 실장)은
          회사 안에서의 자리다. 같은 직원이 이번 행사에서는 메인팀장을,
          다음 행사에서는 스태프를 맡는다. 그래서 두 값을 섞으면 안 된다.
        */}
        <FormField
          label="직책"
          required
          hint="회사 안에서의 자리입니다. 행사에서 맡는 직무와는 다릅니다."
          error={errors.position?.message}
        >
          <Input
            {...register("position")}
            placeholder="예: 대리"
            hasError={Boolean(errors.position)}
          />
        </FormField>

        <div className="-mt-2 flex flex-wrap gap-1.5">
          {EMPLOYEE_POSITION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() =>
                setValue("position", preset, { shouldValidate: true })
              }
              className="rounded-field border border-border-main px-2.5 py-1 text-[12px] text-font-2 transition hover:border-brand hover:text-brand"
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="입사일" required error={errors.hireDate?.message}>
            <Input
              type="date"
              {...register("hireDate")}
              hasError={Boolean(errors.hireDate)}
            />
          </FormField>

          {/*
            기본 근무시간.

            이 기준이 없으면 "이번 달 82시간"이 많은 건지 적은 건지 아무도 모른다.
            사람마다 다를 수 있어(단축근무) 고정값으로 두지 않는다.
          */}
          <FormField
            label="기본 근무시간"
            required
            hint={`한 달 기준입니다. 주 40시간이면 ${DEFAULT_BASE_MONTHLY_HOURS}시간입니다.`}
            error={errors.baseMonthlyHours?.message}
          >
            <Input
              type="number"
              {...register("baseMonthlyHours")}
              rightSlot={<span className="text-[13px] text-font-2">시간</span>}
              hasError={Boolean(errors.baseMonthlyHours)}
            />
          </FormField>
        </div>

        <FormField label="메모" error={errors.memo?.message}>
          <Textarea
            {...register("memo")}
            rows={3}
            placeholder="담당 업무 · 특이사항"
          />
        </FormField>

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-3 rounded-field border border-border-main px-4 py-3">
              <div className="min-w-0">
                <p className="text-[14px] text-font-1">재직 중</p>
                <p className="mt-0.5 text-[12px] text-font-2">
                  끄면 퇴사 처리됩니다. 지나간 행사 기록은 그대로 남습니다.
                </p>
              </div>
              <Switch
                label="재직 여부"
                checked={field.value}
                onChange={field.onChange}
              />
            </div>
          )}
        />

        {/*
          직원과 프리랜서가 어디서 갈라지는지 폼에서 한 번 말해 둔다.
          이 화면에서 서류 · 계좌 칸을 못 찾아 인력풀에 또 등록하는 일이 실제로 생긴다.
        */}
        <Alert tone="info" title="직원은 계약서와 정산에서 빠집니다">
          회사와 이미 근로계약이 되어 있고 급여도 월급으로 나가므로, 행사마다
          근로계약서를 받지 않고 시급 정산 목록에도 오르지 않습니다. 대신 여기서
          이번 달 근무시간을 셉니다.
        </Alert>
      </form>
    </Modal>
  );
};

export default EmployeeFormModal;
