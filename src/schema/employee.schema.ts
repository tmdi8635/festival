import { z } from "zod";
import { DEFAULT_BASE_MONTHLY_HOURS } from "@/type/employee";

/**
 * 직원 등록 · 수정 폼 스키마.
 *
 * 인력풀 폼과 받는 것이 다르다. 서류 · 계좌 · 활동 지역 · 가능 직무를 받지 않는다.
 * 계약서를 쓰지 않고 시급 정산도 하지 않으므로 그 칸들은 채워도 쓰이지 않는다.
 * 대신 **회사 직책 · 시스템 권한(직책) · 기본 근무시간**을 받는다.
 */
export const employeeSchema = z.object({
  name: z.string().min(2, "이름을 2자 이상 입력해 주세요."),
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  phoneNumber: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, "'-' 없이 숫자만 입력해 주세요."),
  /*
    생년월일 · 주소는 비워 둘 수 있게 한다.
    급하게 계정부터 만들어야 하는 일이 실제로 있고, 필수로 막으면
    담당자는 아무 값이나 넣어 채운다. 그 값은 없느니만 못하다.
  */
  birthDate: z.string(),
  gender: z.enum(["MALE", "FEMALE"]),
  address: z.string().max(200, "200자 이내로 입력해 주세요."),
  /** 비상 연락처. 현장에서 사고가 났을 때 회사가 찾을 번호다. */
  emergencyContact: z
    .string()
    .refine(
      (value) => value === "" || /^01[016789]\d{7,8}$/.test(value),
      "'-' 없이 숫자만 입력해 주세요.",
    ),
  hireDate: z.string().min(1, "입사일을 선택해 주세요."),
  /** 회사 직책. 행사에서 맡는 직무(JobRole)와 다르다. */
  position: z.string().min(1, "직책을 입력해 주세요."),
  /** 시스템 권한 묶음 */
  roleId: z.coerce.number().int().min(1, "권한 직책을 선택해 주세요."),
  /*
    근무시간 집계 대상인지.
    대표 · 실장처럼 현장 시간으로 평가할 수 없는 자리는 꺼 둔다.
  */
  tracksWorkHours: z.boolean(),
  /*
    기준 시간을 0으로 두면 채움률이 0으로 나뉘어 뜻을 잃는다.
    사람마다 다를 수 있어(단축근무) 고정하지 않고 값만 받는다.
    집계를 끈 사람에게는 요구하지 않는다. (아래 refine)
  */
  baseMonthlyHours: z.coerce
    .number()
    .int("시간은 정수로 입력해 주세요.")
    .min(0, "0 이상으로 입력해 주세요.")
    .max(400, "월 400시간을 넘길 수 없습니다."),
  isActive: z.boolean(),
  memo: z.string().max(300, "300자 이내로 입력해 주세요."),
}).refine(
  (values) => !values.tracksWorkHours || values.baseMonthlyHours >= 1,
  {
    message: "집계 대상이면 기준 시간을 1시간 이상으로 정해 주세요.",
    path: ["baseMonthlyHours"],
  },
);

export type EmployeeSchema = z.output<typeof employeeSchema>;
export type EmployeeSchemaInput = z.input<typeof employeeSchema>;

export const EMPTY_EMPLOYEE_VALUES: EmployeeSchemaInput = {
  name: "",
  email: "",
  phoneNumber: "",
  birthDate: "",
  gender: "FEMALE",
  address: "",
  emergencyContact: "",
  hireDate: "",
  position: "",
  roleId: 0,
  tracksWorkHours: true,
  baseMonthlyHours: DEFAULT_BASE_MONTHLY_HOURS,
  isActive: true,
  memo: "",
};
