import { z } from "zod";

/** 공고 등록 · 수정 폼 스키마 */
export const postingSchema = z.object({
  eventId: z.coerce.number().int().min(1, "행사를 선택해 주세요."),
  title: z.string().min(2, "공고 제목을 2자 이상 입력해 주세요."),
  role: z.string().min(1, "직무를 선택해 주세요."),
  requiredCount: z.coerce
    .number()
    .int("정수로 입력해 주세요.")
    .min(1, "1명 이상이어야 합니다."),
  wageType: z.enum(["HOURLY", "DAILY"]),
  wage: z.coerce
    .number()
    .int("정수로 입력해 주세요.")
    .min(1, "금액을 입력해 주세요."),
  content: z.string().min(20, "공고문을 20자 이상 입력해 주세요."),
});

export type PostingSchema = z.output<typeof postingSchema>;
export type PostingSchemaInput = z.input<typeof postingSchema>;

export const EMPTY_POSTING_VALUES: PostingSchemaInput = {
  eventId: 0,
  title: "",
  role: "STAFF",
  requiredCount: 1,
  wageType: "HOURLY" as const,
  wage: 12000,
  content: "",
};

/** 문자로 받은 지원을 손으로 등록할 때 쓰는 스키마 */
export const applicationSchema = z.object({
  postingId: z.coerce.number().int().min(1, "공고를 선택해 주세요."),
  applicantName: z.string().min(2, "지원자 이름을 입력해 주세요."),
  phoneNumber: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, "010으로 시작하는 숫자만 입력해 주세요."),
  note: z.string().max(300, "300자 이내로 입력해 주세요."),
});

export type ApplicationSchema = z.output<typeof applicationSchema>;
export type ApplicationSchemaInput = z.input<typeof applicationSchema>;

export const EMPTY_APPLICATION_VALUES: ApplicationSchemaInput = {
  postingId: 0,
  applicantName: "",
  phoneNumber: "",
  note: "",
};
