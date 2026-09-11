"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMyProfileMutation } from "@/api/my/mutateMyProfile";
import { formatDate } from "@/lib/dayjs";
import { myHealthCertSchema, type MyHealthCertSchema } from "@/schema/my.schema";
import { toDateKey } from "@/type/event";
import type { MyProfile } from "@/type/my";
import { HEALTH_CERT_STATE_LABEL, healthCertExpiresAt } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Input from "@/components/ui/Input";
import { HEALTH_CERT_STATE_TONE } from "@/app/(portal)/_components/DocumentStatusCard";

interface MyHealthCertFormProps {
  profile: MyProfile;
  onSaved: () => void;
}

/**
 * 보건증 제출. **선택 서류라 필수 서류와 따로 낸다.**
 *
 * 한 폼에 묶으면 보건증이 없는 사람은 신분증 · 계좌를 고칠 때마다 비어 있는
 * 보건증 칸에 걸려 저장을 못 한다. 반대로 보건증을 내는 일이 신분증 승인을
 * 다시 대기로 돌려서도 안 된다.
 *
 * 발급일을 함께 받는다. 보건증은 1년만 유효하고, 파일만 받으면 만료를 사람이
 * 사진을 열어 날짜를 읽어야 안다. 고른 발급일로 **언제까지 쓸 수 있는지**를
 * 곧바로 보여 준다 — 틀린 날짜를 고르면 그 자리에서 눈에 걸린다.
 */
const MyHealthCertForm = ({ profile, onSaved }: MyHealthCertFormProps) => {
  const { healthCertMutation } = useMyProfileMutation();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<MyHealthCertSchema>({
    resolver: zodResolver(myHealthCertSchema),
    defaultValues: {
      healthCertImageUrl: profile.healthCertImageUrl ?? "",
      healthCertIssuedAt: profile.healthCertIssuedAt ?? "",
    },
  });

  const issuedAt = useWatch({ control, name: "healthCertIssuedAt" });
  const expiresPreview = healthCertExpiresAt(issuedAt);
  const today = toDateKey(new Date());
  const state = profile.healthCertState;
  const rejectReason = profile.reviews.HEALTH_CERT?.rejectReason;

  const onSubmit = handleSubmit((values) =>
    healthCertMutation.mutate(values, { onSuccess: onSaved }),
  );

  return (
    <Card
      title="보건증"
      description="선택 서류 · 보건증이 필요한 자리에 지원할 때만 있으면 돼요."
      action={
        <Badge tone={HEALTH_CERT_STATE_TONE[state]}>
          {HEALTH_CERT_STATE_LABEL[state]}
        </Badge>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {state === "REJECTED" && (
          <Alert tone="danger" title="보건증이 반려되었습니다.">
            {rejectReason ?? "사유를 확인하고 다시 올려 주세요."}
          </Alert>
        )}

        {state === "EXPIRED" && (
          <Alert tone="warning" title="보건증이 만료되었습니다.">
            {profile.healthCertExpiresAt &&
              `${formatDate(profile.healthCertExpiresAt)}까지 유효했어요. `}
            새로 발급받은 보건증을 올려 주세요.
          </Alert>
        )}

        {state === "SUBMITTED" && (
          <Alert tone="info" title="담당자가 확인하고 있어요.">
            승인되면 보건증이 필요한 자리에 지원할 수 있어요.
          </Alert>
        )}

        {state === "APPROVED" && profile.healthCertExpiresAt && (
          <Alert tone="success" title="보건증이 유효해요.">
            {formatDate(profile.healthCertExpiresAt)}까지 쓸 수 있어요. 새로 올리면 다시
            승인을 받아요.
          </Alert>
        )}

        <FormField
          label="보건증 사진"
          required
          error={errors.healthCertImageUrl?.message}
        >
          <Controller
            control={control}
            name="healthCertImageUrl"
            render={({ field }) => (
              <ImageUploadField
                value={field.value}
                onChange={field.onChange}
                fileType="STAFF_HEALTH_CERT"
                aspectRatio="16 / 10"
                hasError={Boolean(errors.healthCertImageUrl)}
              />
            )}
          />
        </FormField>

        <FormField
          label="발급일"
          hint={
            expiresPreview && !errors.healthCertIssuedAt
              ? `${formatDate(expiresPreview)}까지 유효`
              : "보건증에 적힌 날짜"
          }
          required
          error={errors.healthCertIssuedAt?.message}
        >
          <Input
            type="date"
            max={today}
            {...register("healthCertIssuedAt")}
            hasError={Boolean(errors.healthCertIssuedAt)}
          />
        </FormField>

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          fullWidth
          disabled={!isDirty || healthCertMutation.isPending}
          isLoading={healthCertMutation.isPending}
        >
          보건증 제출
        </Button>
      </form>
    </Card>
  );
};

export default MyHealthCertForm;
