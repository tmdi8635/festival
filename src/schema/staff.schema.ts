import { z } from "zod";
import { JOB_ROLE_CODES } from "@/type/staff";

/**
 * 인력 등록 · 수정 폼 스키마.
 *
 * 신분증 · 통장사본은 등록 시점에 없을 수 있다.
 * (첫 근무 전까지 받으면 되므로 필수로 막지 않고 서류 관리 화면에서 추적한다)
 */
export const staffSchema = z.object({
  name: z
    .string()
    .min(2, "이름을 2자 이상 입력해 주세요.")
    .max(20, "20자 이내로 입력해 주세요."),
  phoneNumber: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, "010으로 시작하는 숫자만 입력해 주세요."),
  profileImageUrl: z.string(),
  birthDate: z.string().min(1, "생년월일을 선택해 주세요."),
  gender: z.enum(["MALE", "FEMALE"]),
  /* 직무는 시스템이 정한 목록이다. 없는 코드가 인력에 붙으면 배치에서 사라진다. */
  roles: z
    .array(z.enum(JOB_ROLE_CODES))
    .min(1, "가능한 직무를 한 개 이상 선택해 주세요."),
  // 자유 입력이던 활동 지역을 시/도 + 시·군·구 두 단계 선택으로 바꿨다.
  region: z.string().min(1, "활동 지역(시/도)을 선택해 주세요."),
  district: z.string().min(1, "시·군·구를 선택해 주세요."),
  address: z.string().max(100, "100자 이내로 입력해 주세요."),
  emergencyContact: z
    .string()
    .refine(
      (value) => value === "" || /^01[016789]\d{7,8}$/.test(value),
      "010으로 시작하는 숫자만 입력해 주세요.",
    ),
  height: z.coerce
    .number()
    .min(0)
    .max(230, "확인이 필요한 값입니다.")
    .optional(),
  clothingSize: z.string().optional(),
  bankName: z.string(),
  accountNumber: z
    .string()
    .refine(
      (value) => value === "" || /^\d{8,20}$/.test(value),
      "계좌번호는 숫자만 입력해 주세요.",
    ),
  accountHolder: z.string(),
  idCardImageUrl: z.string(),
  bankBookImageUrl: z.string(),
});

export type StaffSchema = z.output<typeof staffSchema>;
export type StaffSchemaInput = z.input<typeof staffSchema>;

export const EMPTY_STAFF_VALUES: StaffSchemaInput = {
  name: "",
  phoneNumber: "",
  profileImageUrl: "",
  birthDate: "",
  gender: "FEMALE",
  roles: ["STAFF"],
  region: "",
  district: "",
  address: "",
  emergencyContact: "",
  height: undefined,
  clothingSize: "",
  bankName: "",
  accountNumber: "",
  accountHolder: "",
  idCardImageUrl: "",
  bankBookImageUrl: "",
};

/** 인력 메모 스키마 */
export const staffMemoSchema = z.object({
  content: z
    .string()
    .min(2, "메모를 2자 이상 입력해 주세요.")
    .max(300, "300자 이내로 입력해 주세요."),
  isWarning: z.boolean(),
});

export type StaffMemoSchema = z.infer<typeof staffMemoSchema>;

/** 블랙리스트 지정 스키마. 사유 없이 지정하지 못하게 막는다. */
export const blacklistSchema = z.object({
  reason: z
    .string()
    .min(5, "사유를 5자 이상 구체적으로 남겨 주세요.")
    .max(300, "300자 이내로 입력해 주세요."),
});

export type BlacklistSchema = z.infer<typeof blacklistSchema>;
