"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMyProfileMutation } from "@/api/my/mutateMyProfile";
import { GENDER_OPTIONS } from "@/constants/staffOptions";
import { REGION_DISTRICTS, REGION_OPTIONS } from "@/constants/regionOptions";
import { useJobRoleOptions } from "@/store/useOrgStore";
import {
  myProfileSchema,
  type MyProfileSchema,
  type MyProfileSchemaInput,
} from "@/schema/my.schema";
import type { MyProfile } from "@/type/my";
import type { JobRole } from "@/type/staff";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface MyProfileFormProps {
  profile: MyProfile;
}

/**
 * 인적사항 수정.
 *
 * **저장하면 곧바로 반영된다.** 담당자 승인을 거치지 않는다.
 * 이름 한 글자를 고치는 데도 기다려야 하면 아무도 고치지 않고, 결국 틀린 연락처로
 * 현장 안내가 나간다. 검증이 필요한 것은 돈이 나가는 근거뿐이고 그쪽은 아래 카드다.
 */
const MyProfileForm = ({ profile }: MyProfileFormProps) => {
  const jobRoleOptions = useJobRoleOptions();
  const { profileMutation } = useMyProfileMutation();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<MyProfileSchemaInput, unknown, MyProfileSchema>({
    resolver: zodResolver(myProfileSchema),
    defaultValues: {
      name: profile.name,
      phoneNumber: profile.phoneNumber,
      profileImageUrl: profile.profileImageUrl,
      birthDate: profile.birthDate,
      gender: profile.gender,
      roles: profile.roles,
      region: profile.region,
      district: profile.district,
      address: profile.address,
      emergencyContact: profile.emergencyContact,
      height: profile.height,
      clothingSize: profile.clothingSize ?? "",
    },
  });

  // 시/도를 바꾸면 그 아래 구 목록이 통째로 달라진다.
  const region = watch("region");
  const roles = watch("roles") ?? [];

  const onSubmit = handleSubmit((values) => profileMutation.mutate(values));

  return (
    <Card
      title="인적사항"
      description="저장하면 곧바로 반영됩니다."
      action={
        <Button
          form="my-profile-form"
          type="submit"
          disabled={!isDirty || profileMutation.isPending}
        >
          저장
        </Button>
      }
    >
      <form
        id="my-profile-form"
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        <FormField label="프로필 사진">
          <Controller
            control={control}
            name="profileImageUrl"
            render={({ field }) => (
              <ImageUploadField
                value={field.value}
                onChange={field.onChange}
                fileType="STAFF_PROFILE"
                aspectRatio="1 / 1"
                className="max-w-40"
              />
            )}
          />
        </FormField>

        <FormField label="이름" required error={errors.name?.message}>
          <Input {...register("name")} hasError={Boolean(errors.name)} />
        </FormField>

        <FormField
          label="휴대폰번호"
          hint="'-' 없이"
          required
          error={errors.phoneNumber?.message}
        >
          <Input
            {...register("phoneNumber")}
            inputMode="numeric"
            hasError={Boolean(errors.phoneNumber)}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="생년월일" required error={errors.birthDate?.message}>
            <Input type="date" {...register("birthDate")} />
          </FormField>

          <FormField label="성별" required error={errors.gender?.message}>
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
        </div>

        {/*
          할 수 있는 직무는 **본인이 신고한다.** 실제로 그 자리에 세울지는
          배치할 때 담당자가 정하므로, 스스로 적게 두어도 잃는 것이 없다.
          목록은 시스템이 정한 것에서만 고른다 — 대행사와 주고받는 공통 언어라
          내부 호칭을 새로 만들 수 없다.
        */}
        <FormField
          label="할 수 있는 직무"
          hint="공고 추천에 쓰입니다"
          required
          error={errors.roles?.message}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-field border border-border-main px-3 py-2.5">
            {jobRoleOptions.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                checked={roles.includes(option.value as JobRole)}
                onChange={(event) =>
                  setValue(
                    "roles",
                    event.target.checked
                      ? [...roles, option.value as JobRole]
                      : roles.filter((role) => role !== option.value),
                    { shouldDirty: true, shouldValidate: true },
                  )
                }
              />
            ))}
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="활동 지역" required error={errors.region?.message}>
            <Controller
              control={control}
              name="region"
              render={({ field }) => (
                <Select
                  options={[{ label: "선택", value: "" }, ...REGION_OPTIONS]}
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                    /* 시/도가 바뀌면 이전 구는 더 이상 존재하지 않는다. */
                    setValue("district", "", { shouldDirty: true });
                  }}
                />
              )}
            />
          </FormField>

          <FormField label="시·군·구" required error={errors.district?.message}>
            <Controller
              control={control}
              name="district"
              render={({ field }) => (
                <Select
                  options={[
                    { label: "선택", value: "" },
                    ...(REGION_DISTRICTS[region] ?? []).map((district) => ({
                      label: district,
                      value: district,
                    })),
                  ]}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  disabled={!region}
                />
              )}
            />
          </FormField>
        </div>

        <FormField label="주소" error={errors.address?.message}>
          <Input {...register("address")} />
        </FormField>

        <FormField
          label="비상 연락처"
          hint="현장에서 문제가 생겼을 때 연락할 곳"
          error={errors.emergencyContact?.message}
        >
          <Input {...register("emergencyContact")} inputMode="numeric" />
        </FormField>

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
      </form>
    </Card>
  );
};

export default MyProfileForm;
