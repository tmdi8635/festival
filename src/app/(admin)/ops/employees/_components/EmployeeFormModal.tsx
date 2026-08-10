"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useEmployeeRoleListQuery } from "@/api/employee/getEmployeeList";
import { useEmployeeMutation } from "@/api/employee/mutateEmployee";
import {
  EMPTY_EMPLOYEE_VALUES,
  employeeSchema,
  type EmployeeSchema,
  type EmployeeSchemaInput,
} from "@/schema/employee.schema";
import {
  DEFAULT_BASE_MONTHLY_HOURS,
  EMPLOYEE_POSITION_OPTIONS,
  type Employee,
  type EmployeePosition,
} from "@/type/employee";
import { GENDER_LABEL, type Gender } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";
import Textarea from "@/components/ui/Textarea";

interface EmployeeFormModalProps {
  isOpen: boolean;
  employee: Employee | null;
  onClose: () => void;
}

const GENDER_OPTIONS = (["FEMALE", "MALE"] as Gender[]).map((gender) => ({
  label: GENDER_LABEL[gender],
  value: gender,
}));

/**
 * 직원 등록 · 수정.
 *
 * 세 덩어리를 받는다. **인적사항 · 회사 직책 · 시스템 권한**이다.
 * 서류 · 계좌 · 활동 지역 · 가능 직무는 받지 않는다. 계약서를 쓰지 않고
 * 시급 정산도 하지 않아 그 값들이 어디에도 쓰이지 않기 때문이다.
 */
const EmployeeFormModal = ({
  isOpen,
  employee,
  onClose,
}: EmployeeFormModalProps) => {
  const { createMutation, updateMutation } = useEmployeeMutation();
  const { data: roleData } = useEmployeeRoleListQuery();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
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
            email: employee.email,
            phoneNumber: employee.phoneNumber,
            profileImageUrl: employee.profileImageUrl,
            birthDate: employee.birthDate,
            gender: employee.gender,
            address: employee.address,
            emergencyContact: employee.emergencyContact,
            hireDate: employee.hireDate,
            position: employee.position,
            roleId: employee.roleId,
            tracksWorkHours: employee.tracksWorkHours,
            baseMonthlyHours:
              employee.baseMonthlyHours || DEFAULT_BASE_MONTHLY_HOURS,
            isActive: employee.isActive,
            memo: employee.memo,
          }
        : EMPTY_EMPLOYEE_VALUES,
    );
  }, [isOpen, employee, reset]);

  const roles = roleData?.items ?? [];
  const roleId = watch("roleId");
  const selectedRole = roles.find((role) => role.roleId === Number(roleId));

  const roleOptions = roles.map((role) => ({
    label: role.isSuperAdmin ? `${role.name} (전권)` : role.name,
    value: String(role.roleId),
  }));

  const onSubmit = handleSubmit((values) => {
    if (employee) {
      updateMutation.mutate(
        { employeeId: employee.employeeId, body: values },
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
      description="인적사항과 권한을 함께 정합니다. 등록하면 행사에도 바로 배치할 수 있습니다."
      size="lg"
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
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {/* --------------------------- 인적사항 --------------------------- */}
        <section className="flex flex-col gap-4">
          <p className="text-[13px] font-semibold text-font-1">인적사항</p>

          {/*
            얼굴 사진.

            직원도 현장에 나가는 사람이라 배치 명부 · 출퇴근 명부에 얼굴로 선다.
            명부를 보는 사람은 이름보다 얼굴로 사람을 기억하고, 동명이인이 있는
            현장에서는 사진 한 장이 이름 두 줄보다 빠르다.

            여기서 올린 사진은 **인력풀 레코드까지 함께** 바뀐다.
            한쪽만 바꾸면 직원 관리와 현장 명부에 다른 얼굴이 남는다.
          */}
          <FormField
            label="프로필 사진"
            hint="배치 명부 · 출퇴근 명부에 함께 나옵니다."
            error={errors.profileImageUrl?.message}
          >
            <Controller
              control={control}
              name="profileImageUrl"
              render={({ field }) => (
                <ImageUploadField
                  value={field.value}
                  onChange={field.onChange}
                  fileType="STAFF_PROFILE"
                  aspectRatio="1 / 1"
                  className="sm:max-w-40"
                />
              )}
            />
          </FormField>

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

            <FormField label="이메일" required error={errors.email?.message}>
              <Input
                {...register("email")}
                placeholder="name@agency.co.kr"
                hasError={Boolean(errors.email)}
              />
            </FormField>

            <FormField
              label="생년월일"
              required
              error={errors.birthDate?.message}
            >
              <Input
                type="date"
                {...register("birthDate")}
                hasError={Boolean(errors.birthDate)}
              />
            </FormField>

            <FormField label="성별" required>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select
                    options={GENDER_OPTIONS}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                )}
              />
            </FormField>

            {/*
              비상 연락처.
              현장에서 사고가 났을 때 회사가 찾을 번호다. 본인 번호만 있으면
              정작 본인이 연락을 못 받는 상황에서 아무 데도 걸 수 없다.
            */}
            <FormField
              label="비상 연락처"
              error={errors.emergencyContact?.message}
            >
              <Input
                {...register("emergencyContact")}
                placeholder="01012345678"
                hasError={Boolean(errors.emergencyContact)}
              />
            </FormField>
          </div>

          <FormField label="주소" error={errors.address?.message}>
            <Input {...register("address")} placeholder="서울 마포구 ..." />
          </FormField>
        </section>

        {/* ----------------------------- 자리 ----------------------------- */}
        <section className="flex flex-col gap-4 border-t border-border-main pt-5">
          <p className="text-[13px] font-semibold text-font-1">
            회사 직책 · 근무 기준
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/*
              직책은 직무가 아니다.
              직무(팀장 · 스태프)는 행사에서 맡는 자리이고, 직책(대리 · 실장)은
              회사 안에서의 자리다. 같은 직원이 이번 행사에서는 팀장을,
              다음 행사에서는 스태프를 맡는다.
            */}
            {/*
              직책은 **고르는 값**이다.

              자유 입력이던 시절에 `팀장`과 `팀 장`과 `팀장님`이 함께 쌓였고,
              그 순간 명부를 직책 순으로 세울 방법이 사라졌다. 문자열로는
              대표가 사원보다 위라는 것을 알 방법이 없다.
            */}
            <FormField label="직책" required error={errors.position?.message}>
              <Controller
                control={control}
                name="position"
                render={({ field }) => (
                  <Select
                    options={EMPLOYEE_POSITION_OPTIONS}
                    placeholder="직책을 선택하세요"
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(event.target.value as EmployeePosition)
                    }
                    hasError={Boolean(errors.position)}
                  />
                )}
              />
            </FormField>

            <FormField label="입사일" required error={errors.hireDate?.message}>
              <Input
                type="date"
                {...register("hireDate")}
                hasError={Boolean(errors.hireDate)}
              />
            </FormField>

          </div>

          {/*
            근무시간 집계는 **켜고 끈다.**

            전원이 대상은 아니다. 대표 · 실장처럼 사무실에서 일이 굴러가게 하는
            자리는 현장 근무시간으로 평가할 수 있는 사람이 아니고, 그런 사람까지
            '직원 근무'에 세우면 채움률이 영원히 10%대인 줄이 쌓여
            정작 이번 달 무리한 사람이 묻힌다.

            끈 사람은 기준 시간을 정하지 않는다. 쓰이지 않는 값을 받아 두면
            나중에 그 숫자가 어딘가에서 진짜인 척한다.
          */}
          <Controller
            control={control}
            name="tracksWorkHours"
            render={({ field }) => (
              <div className="flex flex-col gap-3 rounded-field border border-border-main px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] text-font-1">근무시간 집계</p>
                    <p className="mt-0.5 text-[12px] text-font-2">
                      켜면 &lsquo;직원 근무&rsquo;에서 이 사람의 월 근무시간을
                      셉니다. 현장에 나가지 않는 자리는 꺼 두세요.
                    </p>
                  </div>
                  <Switch
                    label="근무시간 집계 여부"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                </div>

                {field.value && (
                  <FormField
                    label="기본 근무시간"
                    required
                    hint={`한 달 기준 · 주 40시간이면 ${DEFAULT_BASE_MONTHLY_HOURS}시간`}
                    error={errors.baseMonthlyHours?.message}
                  >
                    <Input
                      type="number"
                      {...register("baseMonthlyHours")}
                      rightSlot={
                        <span className="text-[13px] text-font-2">시간</span>
                      }
                      inputBoxClassName="sm:max-w-48"
                      hasError={Boolean(errors.baseMonthlyHours)}
                    />
                  </FormField>
                )}
              </div>
            )}
          />
        </section>

        {/* ---------------------------- 권한 ---------------------------- */}
        <section className="flex flex-col gap-4 border-t border-border-main pt-5">
          <p className="text-[13px] font-semibold text-font-1">시스템 권한</p>

          {/*
            권한을 여기서 직접 고르지 않는다. **직책을 고른다.**
            사람마다 권한을 주면 규칙이 바뀔 때 전원을 다시 손봐야 하고,
            한 명만 빠뜨리면 그 사람만 조용히 다른 권한을 갖게 된다.
          */}
          <FormField
            label="권한 직책"
            required
            hint="회사 직책과 다른 축입니다. 실장이라고 정산을 볼 수 있는 것은 아닙니다."
            error={errors.roleId?.message}
          >
            <Controller
              control={control}
              name="roleId"
              render={({ field }) => (
                <Select
                  options={roleOptions}
                  placeholder="권한 직책을 선택하세요"
                  value={String(field.value || "")}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                />
              )}
            />
          </FormField>

          {selectedRole && (
            <Alert
              tone={selectedRole.isSuperAdmin ? "warning" : "info"}
              title={`'${selectedRole.name}'이 할 수 있는 일`}
            >
              {selectedRole.description}
            </Alert>
          )}
        </section>

        {/* ---------------------------- 그 밖 ---------------------------- */}
        <section className="flex flex-col gap-4 border-t border-border-main pt-5">
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
                    끄면 퇴사 처리됩니다. 로그인과 새 배치가 막히고, 지나간 행사
                    기록은 그대로 남습니다.
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
        </section>
      </form>
    </Modal>
  );
};

export default EmployeeFormModal;
