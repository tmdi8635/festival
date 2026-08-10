import { z } from "zod";
import { DEFAULT_BASE_MONTHLY_HOURS } from "@/type/employee";

/**
 * 직원 등록 · 수정 폼 스키마.
 *
 * 인력풀 폼보다 훨씬 짧다. 직원에게는 서류 · 계좌 · 활동 지역 · 가능 직무를
 * 받지 않기 때문이다. 계약서를 쓰지 않고 시급 정산도 하지 않으므로
 * 그 칸들은 채워도 아무 데도 쓰이지 않는다.
 */
export const employeeSchema = z.object({
  name: z.string().min(2, "이름을 2자 이상 입력해 주세요."),
  phoneNumber: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, "'-' 없이 숫자만 입력해 주세요."),
  /** 직책. 직무(JobRole)가 아니라 회사 안에서의 자리다. */
  position: z.string().min(1, "직책을 입력해 주세요."),
  hireDate: z.string().min(1, "입사일을 선택해 주세요."),
  /*
    기준 시간을 0으로 두면 채움률이 0으로 나뉘어 뜻을 잃는다.
    사람마다 다를 수 있어(단축근무) 고정하지 않고 값만 받는다.
  */
  baseMonthlyHours: z.coerce
    .number()
    .int("시간은 정수로 입력해 주세요.")
    .min(1, "1시간 이상으로 입력해 주세요.")
    .max(400, "월 400시간을 넘길 수 없습니다."),
  isActive: z.boolean(),
  memo: z.string().max(300, "300자 이내로 입력해 주세요."),
});

export type EmployeeSchema = z.output<typeof employeeSchema>;
export type EmployeeSchemaInput = z.input<typeof employeeSchema>;

export const EMPTY_EMPLOYEE_VALUES: EmployeeSchemaInput = {
  name: "",
  phoneNumber: "",
  position: "",
  hireDate: "",
  baseMonthlyHours: DEFAULT_BASE_MONTHLY_HOURS,
  isActive: true,
  memo: "",
};
