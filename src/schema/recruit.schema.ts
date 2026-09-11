import { z } from "zod";

/**
 * 공고 등록 · 수정 폼 스키마.
 *
 * 공고는 **행사 하나**를 덮고, 그 안에서 모집할 포지션을 고른다.
 * 이름 · 시각 · 금액은 행사 포지션이 원본이라 여기서 받지 않는다.
 * 공고가 따로 들고 있으면 행사에서 단가를 고쳤을 때 공고만 옛 금액으로 남는다.
 */
export const postingSchema = z.object({
  eventId: z.coerce.number().int().min(1, "행사를 선택해 주세요."),
  title: z.string().min(2, "공고 제목을 2자 이상 입력해 주세요."),
  positions: z
    .array(
      z.object({
        positionId: z.coerce.number().int().min(1),
        requiredCount: z.coerce
          .number()
          .int("정수로 입력해 주세요.")
          .min(1, "1명 이상이어야 합니다."),
      }),
    )
    .min(1, "모집할 포지션을 한 개 이상 골라 주세요."),
  content: z.string().min(20, "공고문을 20자 이상 입력해 주세요."),
});

export type PostingSchema = z.output<typeof postingSchema>;
export type PostingSchemaInput = z.input<typeof postingSchema>;

export const EMPTY_POSTING_VALUES: PostingSchemaInput = {
  eventId: 0,
  title: "",
  positions: [],
  content: "",
};

/** 문자로 받은 지원을 손으로 등록할 때 쓰는 스키마 */
export const applicationSchema = z.object({
  postingId: z.coerce.number().int().min(1, "공고를 선택해 주세요."),
  /* 문자로 받은 지원도 어느 포지션인지 정해 둬야 확정할 때 배치가 만들어진다. */
  positionId: z.coerce.number().int().min(1, "포지션을 선택해 주세요."),
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
  positionId: 0,
  applicantName: "",
  phoneNumber: "",
  note: "",
};
