"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useStaffMutation } from "@/api/staff/mutateStaff";
import { GENDER_OPTIONS } from "@/constants/staffOptions";
import {
  REGION_OPTIONS,
  districtOptions,
} from "@/constants/regionOptions";
import {
  EMPTY_STAFF_VALUES,
  staffSchema,
  type StaffSchema,
  type StaffSchemaInput,
} from "@/schema/staff.schema";
import { useActiveJobRoles } from "@/store/useOrgStore";
import { type Gender, type StaffDetail } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";

interface StaffFormModalProps {
  isOpen: boolean;
  /** 값이 있으면 수정, 없으면 신규 등록 */
  staff: StaffDetail | null;
  onClose: () => void;
}

const BANK_OPTIONS = [
  "국민",
  "신한",
  "우리",
  "하나",
  "농협",
  "기업",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "새마을금고",
].map((bank) => ({ label: bank, value: bank }));

const toFormValues = (staff: StaffDetail): StaffSchemaInput => ({
  name: staff.name,
  phoneNumber: staff.phoneNumber,
  profileImageUrl: staff.profileImageUrl,
  birthDate: staff.birthDate,
  gender: staff.gender,
  roles: staff.roles,
  region: staff.region,
  district: staff.district,
  address: staff.address,
  emergencyContact: staff.emergencyContact,
  height: staff.height,
  clothingSize: staff.clothingSize,
  bankName: staff.bankName,
  accountNumber: staff.accountNumber,
  accountHolder: staff.accountHolder,
  idCardImageUrl: staff.idCardImageUrl,
  bankBookImageUrl: staff.bankBookImageUrl,
});

/**
 * 인력 등록 · 수정 모달.
 *
 * 신분증 · 통장사본은 첫 근무 전까지 받으면 되므로 필수로 막지 않는다.
 * 대신 서류 관리 화면에서 미제출 인력을 따로 추적한다.
 */
const StaffFormModal = ({ isOpen, staff, onClose }: StaffFormModalProps) => {
  const { createMutation, updateMutation } = useStaffMutation();
  const jobRoles = useActiveJobRoles();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    // 입력 타입(coerce 전)과 출력 타입(coerce 후)이 달라 제네릭 세 개를 모두 넘긴다.
  } = useForm<StaffSchemaInput, unknown, StaffSchema>({
    resolver: zodResolver(staffSchema),
    defaultValues: EMPTY_STAFF_VALUES,
  });

  useEffect(() => {
    if (!isOpen) return;

    reset(staff ? toFormValues(staff) : EMPTY_STAFF_VALUES);
  }, [isOpen, staff, reset]);

  // 시/도를 바꾸면 그 아래 구 목록이 통째로 달라진다.
  const region = watch("region");

  const onSubmit = handleSubmit((values) => {
    if (staff) {
      updateMutation.mutate(
        { staffId: staff.staffId, body: values },
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
      title={staff ? "인력 정보 수정" : "인력 등록"}
      description="휴대폰번호로 중복 등록을 막습니다. 이미 등록된 번호는 기존 인력을 수정해 주세요."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {staff ? "저장" : "등록"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="프로필 사진" hint="현장에서 인원 확인에 씁니다.">
          <Controller
            control={control}
            name="profileImageUrl"
            render={({ field }) => (
              <ImageUploadField
                value={field.value}
                onChange={field.onChange}
                fileType="STAFF_PROFILE"
                aspectRatio="1 / 1"
                className="w-40"
              />
            )}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="이름" required error={errors.name?.message}>
            <Input {...register("name")} hasError={Boolean(errors.name)} />
          </FormField>

          <FormField
            label="휴대폰번호"
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

        <div className="grid grid-cols-3 gap-4">
          <FormField label="생년월일" required error={errors.birthDate?.message}>
            <Input
              type="date"
              {...register("birthDate")}
              hasError={Boolean(errors.birthDate)}
            />
          </FormField>

          <FormField label="성별" required error={errors.gender?.message}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select
                  options={GENDER_OPTIONS}
                  value={field.value}
                  onChange={(event) =>
                    field.onChange(event.target.value as Gender)
                  }
                />
              )}
            />
          </FormField>

        </div>

        {/*
          예전에는 활동 지역이 자유 입력이라 같은 곳을 사람마다 다르게 적었다.
          (강남 / 강남구 / 서울강남) 그래서 지역으로 인력을 추리는 일이 불가능했다.
          시/도와 시·군·구를 두 단계로 고르게 해서 값을 하나로 맞춘다.
        */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="활동 지역 (시/도)"
            required
            error={errors.region?.message}
          >
            <Controller
              control={control}
              name="region"
              render={({ field }) => (
                <Select
                  options={[{ label: "선택", value: "" }, ...REGION_OPTIONS]}
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                    // 시/도가 바뀌면 이전 구는 더 이상 유효하지 않다.
                    setValue("district", "", { shouldValidate: false });
                  }}
                  hasError={Boolean(errors.region)}
                />
              )}
            />
          </FormField>

          <FormField
            label="시 · 군 · 구"
            required
            hint={region ? undefined : "시/도를 먼저 선택하세요."}
            error={errors.district?.message}
          >
            <Controller
              control={control}
              name="district"
              render={({ field }) => (
                <Select
                  options={[
                    { label: "선택", value: "" },
                    ...districtOptions(region ?? ""),
                  ]}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  disabled={!region}
                  hasError={Boolean(errors.district)}
                />
              )}
            />
          </FormField>
        </div>

        <FormField
          label="가능 직무"
          required
          hint="배치 후보 추천의 1차 조건입니다."
          error={errors.roles?.message}
        >
          <Controller
            control={control}
            name="roles"
            render={({ field }) => (
              <div className="flex flex-wrap gap-3 rounded-field border border-border-main px-3 py-2.5">
                {jobRoles.map((role) => (
                  <Checkbox
                    key={role.code}
                    label={role.name}
                    checked={field.value.includes(role.code)}
                    onChange={(event) =>
                      field.onChange(
                        event.target.checked
                          ? [...field.value, role.code]
                          : field.value.filter((item) => item !== role.code),
                      )
                    }
                  />
                ))}
              </div>
            )}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="주소" error={errors.address?.message}>
            <Input {...register("address")} />
          </FormField>

          <FormField
            label="비상 연락처"
            hint="보호자 · 가족"
            error={errors.emergencyContact?.message}
          >
            <Input {...register("emergencyContact")} placeholder="01012345678" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="키(cm)"
            hint="의전 · 모델 배치 참고용"
            error={errors.height?.message}
          >
            <Input type="number" {...register("height")} />
          </FormField>

          <FormField label="의상 사이즈" error={errors.clothingSize?.message}>
            <Input {...register("clothingSize")} placeholder="예) M" />
          </FormField>
        </div>

        <Alert tone="info" title="계좌 · 서류는 정산에만 사용합니다.">
          담당자 권한으로는 계좌 정보가 보이지 않습니다. 신분증 사본은 주민번호
          뒷자리를 가린 상태로 받아 주세요.
        </Alert>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="은행" error={errors.bankName?.message}>
            <Controller
              control={control}
              name="bankName"
              render={({ field }) => (
                <Select
                  options={[{ label: "선택", value: "" }, ...BANK_OPTIONS]}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              )}
            />
          </FormField>

          <FormField
            label="계좌번호"
            hint="'-' 없이"
            error={errors.accountNumber?.message}
          >
            <Input
              {...register("accountNumber")}
              hasError={Boolean(errors.accountNumber)}
            />
          </FormField>

          <FormField label="예금주" error={errors.accountHolder?.message}>
            <Input {...register("accountHolder")} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="신분증 사본">
            <Controller
              control={control}
              name="idCardImageUrl"
              render={({ field }) => (
                <ImageUploadField
                  value={field.value}
                  onChange={field.onChange}
                  fileType="STAFF_ID_CARD"
                  aspectRatio="16 / 10"
                />
              )}
            />
          </FormField>

          <FormField label="통장 사본">
            <Controller
              control={control}
              name="bankBookImageUrl"
              render={({ field }) => (
                <ImageUploadField
                  value={field.value}
                  onChange={field.onChange}
                  fileType="STAFF_BANK_BOOK"
                  aspectRatio="16 / 10"
                />
              )}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
};

export default StaffFormModal;
