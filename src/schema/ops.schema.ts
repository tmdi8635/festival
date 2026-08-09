import { z } from "zod";

/** 내부 담당자 폼 스키마 */
export const managerSchema = z.object({
  name: z.string().min(2, "이름을 2자 이상 입력해 주세요."),
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  phoneNumber: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, "010으로 시작하는 숫자만 입력해 주세요."),
  role: z.enum(["OWNER", "MANAGER", "VIEWER"]),
  isActive: z.boolean(),
});

export type ManagerSchema = z.infer<typeof managerSchema>;

export const EMPTY_MANAGER_VALUES: ManagerSchema = {
  name: "",
  email: "",
  phoneNumber: "",
  role: "MANAGER",
  isActive: true,
};

/**
 * 직무 정의 폼 스키마.
 *
 * 직무는 배치 · 계약 · 정산이 전부 코드로 참조한다.
 * 코드가 겹치면 다른 직무의 이력이 섞이므로 형식과 중복을 여기서 막는다.
 */
export const jobRoleSchema = z.object({
  code: z
    .string()
    .min(2, "코드를 2자 이상 입력해 주세요.")
    .max(20, "20자 이내로 입력해 주세요.")
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "영문 대문자 · 숫자 · 밑줄만 쓸 수 있습니다. (예: FLOOR_LEAD)",
    ),
  name: z
    .string()
    .min(1, "직무 이름을 입력해 주세요.")
    .max(20, "20자 이내로 입력해 주세요."),
  shortName: z.string().max(6, "6자 이내로 입력해 주세요."),
  defaultWageType: z.enum(["HOURLY", "DAILY"]),
  defaultWage: z.coerce
    .number()
    .int("정수로 입력해 주세요.")
    .min(0, "0 이상이어야 합니다."),
  isActive: z.boolean(),
});

export type JobRoleSchema = z.output<typeof jobRoleSchema>;

/** 새 직무를 추가할 때의 기본값 */
export const EMPTY_JOB_ROLE_VALUES = {
  code: "",
  name: "",
  shortName: "",
  defaultWageType: "HOURLY" as const,
  defaultWage: 12000,
  isActive: true,
};
