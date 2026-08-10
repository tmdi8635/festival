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
    직무별 청구 단가. **필수가 아니다.**

    아직 단가를 협의하지 않은 거래처가 대부분인데, 여기서 막으면 거래처를
    만들 수 없고 그러면 행사도 못 만든다. 비워 두면 0으로 들어오고,
    저장할 때 0인 줄은 아예 떨어져 나간다. (`compactBillingRates`)
  */
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
  /*
    직무 목록은 **기준 설정이 원본**이다. 여기에 고정 목록을 깔아 두면
    직무를 갈아엎은 에이전시의 거래처 폼에 없는 직무가 뜨고, 새로 만든
    직무는 영영 안 뜬다. 폼이 열릴 때 화면이 현재 직무로 채운다.
  */
  billingRates: [],
  isActive: true,
  memo: "",
};
