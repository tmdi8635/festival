import { z } from "zod";

/**
 * 모집 줄 하나.
 *
 * 전일 줄에는 날짜를 두지 않는다 — 사흘 중 이틀만 '전일'로 여는 것은 말이 되지 않는다.
 * 분할 줄은 날짜를 비우면 전 기간이고, 지정하면 하루 이상이어야 한다.
 */
const postingLineSchema = z
  .object({
    /* 새로 추가한 줄에는 아직 번호가 없다. 서버가 붙인다. */
    targetId: z.coerce.number().int().optional(),
    positionId: z.coerce.number().int().min(1),
    requiredCount: z.coerce
      .number()
      .int("정수로 입력해 주세요.")
      .min(1, "1명 이상이어야 합니다."),
    participation: z.enum(["FULL", "SPLIT"]),
    dates: z.array(z.string()).optional(),
    isUrgent: z.boolean(),
  })
  .refine((line) => line.participation !== "FULL" || line.dates === undefined, {
    path: ["dates"],
    message: "전일 모집에는 날짜를 따로 고르지 않습니다.",
  })
  .refine((line) => line.dates === undefined || line.dates.length > 0, {
    path: ["dates"],
    message: "모집할 날을 하루 이상 골라 주세요.",
  });

/**
 * 공고 등록 · 수정 폼 스키마.
 *
 * 공고는 **행사 하나**를 덮고, 그 안에서 모집 줄을 둔다.
 * 이름 · 시각 · 금액은 행사 포지션이 원본이라 여기서 받지 않는다.
 * 공고가 따로 들고 있으면 행사에서 단가를 고쳤을 때 공고만 옛 금액으로 남는다.
 */
export const postingSchema = z
  .object({
    eventId: z.coerce.number().int().min(1, "행사를 선택해 주세요."),
    title: z.string().min(2, "공고 제목을 2자 이상 입력해 주세요."),
    lines: z.array(postingLineSchema).min(1, "모집할 포지션을 한 개 이상 골라 주세요."),
    content: z.string().min(20, "공고문을 20자 이상 입력해 주세요."),
  })
  /*
    같은 포지션에 전일 줄이 둘이면 지원자는 어느 쪽에 내야 할지 모른다.
    인원을 늘리려면 그 줄의 숫자를 고친다. 분할 줄은 날짜가 달라 여럿이어도 된다.
  */
  .refine(
    (values) => {
      const fullIds = values.lines
        .filter((line) => line.participation === "FULL")
        .map((line) => line.positionId);

      return new Set(fullIds).size === fullIds.length;
    },
    {
      path: ["lines"],
      message: "한 포지션에 전일 모집 줄은 하나만 둘 수 있습니다.",
    },
  )
  /*
    포지션 · 방식 · 날짜가 모두 같은 줄이 둘이면 지원자는 둘 중 아무 데나 내고,
    담당자는 같은 자리를 두 줄로 나눠 세게 된다. 인원을 늘리려면 그 줄의 숫자를 고친다.
  */
  .refine(
    (values) => {
      const keys = values.lines.map((line) => lineKeyOf(line));

      return new Set(keys).size === keys.length;
    },
    {
      path: ["lines"],
      message: "같은 조건의 모집 줄이 두 번 있습니다. 한 줄로 합쳐 인원을 고쳐 주세요.",
    },
  );

/** 줄이 같은 조건인지 가르는 열쇠. (포지션 · 방식 · 날짜) — 서버도 같은 열쇠로 본다 */
export const lineKeyOf = (line: {
  positionId: unknown;
  participation: string;
  dates?: string[];
}): string =>
  `${Number(line.positionId)}|${line.participation}|${[...(line.dates ?? [])].sort().join(",")}`;

export type PostingSchema = z.output<typeof postingSchema>;
export type PostingSchemaInput = z.input<typeof postingSchema>;

export const EMPTY_POSTING_VALUES: PostingSchemaInput = {
  eventId: 0,
  title: "",
  lines: [],
  content: "",
};

/** 문자로 받은 지원을 손으로 등록할 때 쓰는 스키마 */
export const applicationSchema = z.object({
  postingId: z.coerce.number().int().min(1, "공고를 선택해 주세요."),
  /* 문자로 받은 지원도 어느 줄인지 정해 둬야 확정할 때 배치가 만들어진다. */
  targetId: z.coerce.number().int().min(1, "모집 포지션을 선택해 주세요."),
  /* 분할 줄일 때만 쓴다. 하루 이상인지는 화면이 줄을 보고 따진다. */
  dates: z.array(z.string()),
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
  targetId: 0,
  dates: [],
  applicantName: "",
  phoneNumber: "",
  note: "",
};
