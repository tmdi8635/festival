import { z } from "zod";

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
  /*
    청구 단가는 여기 없다.

    단가를 부르는 쪽은 에이전시다. 대행사가 직무별 인원수로 견적을 요청하면
    우리가 단가를 매겨 답한다. 그래서 단가는 '운영 > 기준 설정'이 갖고,
    행사 등록 시 초기값으로 깔린 뒤 행사별로 고쳐진다.
  */
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
  isActive: true,
  memo: "",
};
