import { z } from "zod";
import { JOB_ROLE_CODES } from "@/type/staff";

/** 내부 담당자 폼 스키마 */
export const managerSchema = z.object({
  name: z.string().min(2, "이름을 2자 이상 입력해 주세요."),
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  phoneNumber: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, "010으로 시작하는 숫자만 입력해 주세요."),
  roleId: z.number().int().positive("직책을 선택해 주세요."),
  isActive: z.boolean(),
});

export type ManagerSchema = z.infer<typeof managerSchema>;

export const EMPTY_MANAGER_VALUES: ManagerSchema = {
  name: "",
  email: "",
  phoneNumber: "",
  roleId: 0,
  isActive: true,
};

/**
 * 직무 단가 설정 한 줄.
 *
 * 직무를 **만드는** 스키마가 아니다. 직무 목록은 시스템이 정하고
 * (`JOB_ROLE_CATALOG`) 사용자는 이 세 값만 고친다.
 * 그래서 코드는 목록으로 검증하고, 이름은 아예 받지 않는다.
 */
export const jobRoleSchema = z.object({
  code: z.enum(JOB_ROLE_CODES),
  defaultWageType: z.enum(["HOURLY", "DAILY"]),
  /** 인력에게 지급하는 금액 */
  defaultWage: z.coerce
    .number()
    .int("정수로 입력해 주세요.")
    .min(0, "0 이상이어야 합니다."),
  /** 대행사에 청구하는 시급. 0은 '아직 안 정함'이다. */
  billingRate: z.coerce
    .number()
    .int("정수로 입력해 주세요.")
    .min(0, "0 이상이어야 합니다."),
  isActive: z.boolean(),
});

export type JobRoleSchema = z.output<typeof jobRoleSchema>;
