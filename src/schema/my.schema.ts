import { z } from "zod";
import { JOB_ROLE_CODES } from "@/type/staff";

/**
 * 본인이 고치는 인적사항.
 *
 * 관리자 폼(`staffSchema`)과 **일부러 갈라 둔다.** 관리자 폼은 등록·수정을 한 장에서
 * 하느라 서류·계좌까지 함께 들고 있는데, 본인 화면에서는 그 둘의 처리가 다르다.
 * (인적사항은 곧바로 반영되고, 서류·계좌는 승인을 받는다)
 * 한 스키마로 묶으면 두 화면 중 하나는 늘 필요 없는 칸을 검사하게 된다.
 */
export const myProfileSchema = z.object({
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
  /*
    본인이 하겠다고 신고하는 직무. 목록은 시스템이 정한 것에서만 고른다.
    (`JOB_ROLE_CATALOG` — 대행사와 견적을 주고받는 공통 언어라 늘리거나 이름을 바꿀 수 없다)
  */
  roles: z
    .array(z.enum(JOB_ROLE_CODES))
    .min(1, "할 수 있는 직무를 한 개 이상 선택해 주세요."),
  region: z.string().min(1, "활동 지역(시/도)을 선택해 주세요."),
  district: z.string().min(1, "시·군·구를 선택해 주세요."),
  address: z.string().max(100, "100자 이내로 입력해 주세요."),
  /*
    비상 연락처는 **비워 둘 수 있다.** 현장에서 쓰러졌을 때 연락할 곳이라
    받아 두는 편이 좋지만, 없다고 지원을 막을 일은 아니다.
  */
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
});

export type MyProfileSchema = z.output<typeof myProfileSchema>;
export type MyProfileSchemaInput = z.input<typeof myProfileSchema>;

/**
 * 본인이 내는 서류 · 계좌.
 *
 * 관리자 폼과 달리 **전부 필수다.** 관리자 쪽에서는 "일단 등록해 두고 서류는 나중에"가
 * 되어야 하지만(현장에서 실제로 그렇게 돌아간다), 본인이 제출 버튼을 누르는 자리에서는
 * 반쪽만 내고 승인 대기가 되는 상태를 만들 이유가 없다. 그 상태로는 어차피 못 나간다.
 */
export const myDocumentSchema = z.object({
  idCardImageUrl: z.string().min(1, "신분증 사본을 올려 주세요."),
  bankBookImageUrl: z.string().min(1, "통장 사본을 올려 주세요."),
  bankName: z.string().min(1, "은행을 선택해 주세요."),
  accountNumber: z
    .string()
    .regex(/^\d{8,20}$/, "계좌번호는 숫자만 입력해 주세요."),
  /*
    예금주가 본인 이름과 다르면 이체가 반송된다. 이름을 그대로 받아 두고
    다른 경우에만 고치게 한다. (가족 명의 계좌를 쓰는 경우가 실제로 있다)
  */
  accountHolder: z.string().min(2, "예금주를 입력해 주세요."),
});

export type MyDocumentSchema = z.output<typeof myDocumentSchema>;
export type MyDocumentSchemaInput = z.input<typeof myDocumentSchema>;
