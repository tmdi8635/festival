"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMyProfileMutation } from "@/api/my/mutateMyProfile";
import {
  BANK_OPTIONS,
  DOCUMENT_REVIEW_STATE_TONE,
} from "@/constants/staffOptions";
import {
  myDocumentSchema,
  type MyDocumentSchema,
  type MyDocumentSchemaInput,
} from "@/schema/my.schema";
import type { MyProfile } from "@/type/my";
import {
  DOCUMENT_LANES,
  DOCUMENT_LANE_LABEL,
  DOCUMENT_REVIEW_STATE_LABEL,
} from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface MyDocumentFormProps {
  profile: MyProfile;
}

/**
 * 서류 · 계좌 제출.
 *
 * 인적사항과 **한 폼에 두지 않는다.** 저장했을 때 벌어지는 일이 다르기 때문이다.
 * 이쪽은 내면 승인 대기로 들어가고 그동안 근무를 확정할 수 없다.
 * 한 버튼에 묶으면 이름만 고친 사람의 서류 승인이 이유 없이 풀린다.
 */
const MyDocumentForm = ({ profile }: MyDocumentFormProps) => {
  const { documentMutation } = useMyProfileMutation();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<MyDocumentSchemaInput, unknown, MyDocumentSchema>({
    resolver: zodResolver(myDocumentSchema),
    defaultValues: {
      idCardImageUrl: profile.idCardImageUrl,
      bankBookImageUrl: profile.bankBookImageUrl,
      bankName: profile.bankName,
      accountNumber: profile.accountNumber,
      /* 예금주는 보통 본인이다. 비워 두면 다들 자기 이름을 다시 친다. */
      accountHolder: profile.accountHolder || profile.name,
    },
  });

  const onSubmit = handleSubmit((values) => documentMutation.mutate(values));

  const rejected = DOCUMENT_LANES.filter(
    (lane) => profile.reviews[lane].state === "REJECTED",
  );

  return (
    <Card
      title="서류 · 계좌"
      description="담당자 승인 후 근무를 확정할 수 있습니다."
      action={
        <Button
          form="my-document-form"
          type="submit"
          disabled={!isDirty || documentMutation.isPending}
        >
          제출
        </Button>
      }
    >
      <form
        id="my-document-form"
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        {/* 갈래별 심사 상태. 반려 사유가 없으면 같은 사진을 다시 올리게 된다. */}
        <div className="flex flex-col gap-2 rounded-field bg-subtle p-3">
          {DOCUMENT_LANES.map((lane) => {
            const review = profile.reviews[lane];

            return (
              <div key={lane} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-font-1">
                    {DOCUMENT_LANE_LABEL[lane]}
                  </span>
                  <Badge tone={DOCUMENT_REVIEW_STATE_TONE[review.state]}>
                    {DOCUMENT_REVIEW_STATE_LABEL[review.state]}
                  </Badge>
                </div>

                {review.state === "REJECTED" && review.rejectReason && (
                  <p className="text-[12px] leading-relaxed text-danger">
                    {review.rejectReason}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {rejected.length > 0 && (
          <Alert tone="danger" title="반려된 서류가 있습니다.">
            사유를 확인하고 다시 올려 주세요. 다시 내면 담당자가 확인합니다.
          </Alert>
        )}

        <Alert tone="info" title="정산에만 사용합니다.">
          신분증 사본은 주민등록번호 뒷자리를 가린 채로 올려 주세요.
        </Alert>

        <FormField label="신분증 사본" required>
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

        <FormField label="통장 사본" required>
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

        <FormField label="은행" required error={errors.bankName?.message}>
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
          required
          error={errors.accountNumber?.message}
        >
          <Input
            {...register("accountNumber")}
            inputMode="numeric"
            hasError={Boolean(errors.accountNumber)}
          />
        </FormField>

        <FormField
          label="예금주"
          hint="다르면 이체가 반송됩니다"
          required
          error={errors.accountHolder?.message}
        >
          <Input {...register("accountHolder")} />
        </FormField>
      </form>
    </Card>
  );
};

export default MyDocumentForm;
