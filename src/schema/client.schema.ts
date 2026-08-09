import { z } from "zod";
import { DEFAULT_JOB_ROLES } from "@/type/staff";

/** 거래처 등록 · 수정 폼 스키마 */
export const clientSchema = z.object({
  name: z.string().min(2, "거래처명을 2자 이상 입력해 주세요."),
  businessNumber: z
    .string()
    .refine(
      (value) => value === "" || /^\d{3}-\d{2}-\d{5}$/.test(value),
      "000-00-00000 형식으로 입력해 주세요.",
    ),
  managerName: z.string().min(1, "담당자명을 입력해 주세요."),
  managerPhone: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, "010으로 시작하는 숫자만 입력해 주세요."),
  managerEmail: z
    .string()
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "올바른 이메일 형식이 아닙니다.",
    ),
  billingRates: z.array(
    z.object({
      role: z.string().min(1, "직무를 선택해 주세요."),
      rate: z.coerce.number().int().min(0, "0 이상이어야 합니다."),
    }),
  ),
  isActive: z.boolean(),
  memo: z.string().max(500, "500자 이내로 입력해 주세요."),
});

export type ClientSchema = z.output<typeof clientSchema>;
export type ClientSchemaInput = z.input<typeof clientSchema>;

export const EMPTY_CLIENT_VALUES: ClientSchemaInput = {
  name: "",
  businessNumber: "",
  managerName: "",
  managerPhone: "",
  managerEmail: "",
  // 실제 직무 목록은 기준 설정에서 오므로, 폼이 열릴 때 화면이 다시 채운다.
  billingRates: DEFAULT_JOB_ROLES.map((role) => ({ role: role.code, rate: 0 })),
  isActive: true,
  memo: "",
};
