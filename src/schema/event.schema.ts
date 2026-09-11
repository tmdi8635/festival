import { z } from "zod";
import {
  resolveEventDates,
  type DayOffset,
  type EventRecurrence,
} from "@/type/event";
import { JOB_ROLE_CODES } from "@/type/staff";

/**
 * 직무 코드는 시스템이 정한 목록으로만 검증한다.
 *
 * 이 값은 견적서와 계약서에 그대로 나가는 말이라, 여기서 아무 문자열이나
 * 통과시키면 대행사가 알아볼 수 없는 직무가 문서에 실린다.
 */
const jobRoleCode = z.enum(JOB_ROLE_CODES, {
  message: "직무를 선택해 주세요.",
});

const dayOffsetSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(2) as unknown as z.ZodType<DayOffset>;

/**
 * 최저시급은 시급으로 줄 때만 따진다.
 * 일급은 시간과 무관하게 합의하는 금액이라 같은 잣대를 댈 수 없다.
 * (10만원짜리 반나절 일을 최저시급 미달로 막으면 아무것도 등록하지 못한다)
 */
export const MINIMUM_HOURLY_WAGE = 10_030;

/**
 * 종료가 시작보다 이르거나 같은데 당일(D+0)로 둔 조합을 막는다.
 *
 * `21:00~06:00`을 당일로 저장하면 출근 창 · 조퇴 · 퇴근 시각 계산이 전부
 * "같은 날 아침 6시에 끝나는 근무"로 읽혀 음수가 되거나 창이 닫혀 버린다.
 * 사람이 D+1을 고르게 한다. (`DayOffsetField`)
 */
export const isValidTimeRange = (
  startTime: string,
  endTime: string,
  endDayOffset: number,
): boolean => !startTime || !endTime || endDayOffset > 0 || endTime > startTime;

export const TIME_RANGE_MESSAGE =
  "종료가 시작보다 이르면 종료일을 '다음 날(D+1)'로 골라 주세요.";

/**
 * 포지션 한 건 스키마.
 *
 * 행사 등록 폼의 포지션 줄과 행사 상세의 포지션 편집 모달이 **같은 스키마를 쓴다.**
 * 한쪽만 검증을 늘리면 다른 길로는 그 조건을 피해 저장할 수 있다.
 */
export const eventPositionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "포지션 이름을 입력해 주세요.")
      .max(20, "20자 이내로 입력해 주세요."),
    jobRole: jobRoleCode,
    startTime: z.string().min(1, "시작 시각을 입력해 주세요."),
    endTime: z.string().min(1, "종료 시각을 입력해 주세요."),
    endDayOffset: dayOffsetSchema,
    breakMinutes: z.coerce.number().int().min(0).max(240),
    wageType: z.enum(["HOURLY", "DAILY"]),
    wage: z.coerce
      .number()
      .int("정수로 입력해 주세요.")
      .min(1, "금액을 입력해 주세요."),
    /*
      청구 단가. **선택이다.** 0이면 미설정으로 보고 마진 계산에서 빠진다.
      기준 설정의 직무 단가가 초기값으로 깔린다.
    */
    billingRate: z.coerce
      .number()
      .int("정수로 입력해 주세요.")
      .min(0, "0 이상이어야 합니다."),
    genderPreference: z.enum(["ANY", "MALE", "FEMALE"]).default("ANY"),
    requiresHealthCert: z.boolean().default(false),
  })
  .superRefine((position, ctx) => {
    if (position.wageType === "HOURLY" && position.wage < MINIMUM_HOURLY_WAGE) {
      ctx.addIssue({
        code: "custom",
        path: ["wage"],
        message: "2026년 최저시급(10,030원) 이상이어야 합니다.",
      });
    }

    if (
      !isValidTimeRange(
        position.startTime,
        position.endTime,
        Number(position.endDayOffset),
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDayOffset"],
        message: TIME_RANGE_MESSAGE,
      });
    }
  });

export type EventPositionSchema = z.output<typeof eventPositionSchema>;
export type EventPositionSchemaInput = z.input<typeof eventPositionSchema>;

/** 행사 등록 폼의 포지션 줄. 포지션 + 모든 근무일에 깔 초기 인원 */
export const eventPositionDraftSchema = z.intersection(
  eventPositionSchema,
  z.object({
    requiredCount: z.coerce
      .number()
      .int("정수로 입력해 주세요.")
      .min(1, "1명 이상이어야 합니다.")
      .max(200, "한 포지션에 200명을 넘길 수 없습니다."),
  }),
);

/** 반복 규칙 스키마 */
export const recurrenceSchema = z.object({
  type: z.enum(["SINGLE", "CONSECUTIVE", "WEEKLY", "CUSTOM"]),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)),
  intervalWeeks: z.coerce.number().int().min(1).max(8),
  dates: z.array(z.string()),
  excludeDates: z.array(z.string()),
});

export const eventSchema = z
  .object({
    title: z
      .string()
      .min(2, "행사명을 2자 이상 입력해 주세요.")
      .max(60, "60자 이내로 입력해 주세요."),
    clientId: z.coerce.number().int().min(1, "거래처를 선택해 주세요."),
    startDate: z.string().min(1, "시작일을 선택해 주세요."),
    endDate: z.string().min(1, "종료일을 선택해 주세요."),
    recurrence: recurrenceSchema,
    /*
      행사의 **기본 근무시간**. 새 포지션을 만들 때 초기값으로 깔리고,
      캘린더 · 목록에 행사를 대표해 적힌다. 실제 근무 시각은 포지션이 갖는다.
    */
    startTime: z.string().min(1, "시작 시각을 입력해 주세요."),
    endTime: z.string().min(1, "종료 시각을 입력해 주세요."),
    /*
      종료가 며칠 뒤인지. 방송 현장은 24시간을 넘겨 일하는 날이 드물지 않아
      "13:00~14:00"이 한 시간인지 25시간인지를 이 값으로만 가를 수 있다.
    */
    endDayOffset: dayOffsetSchema,
    venue: z.string().min(1, "장소명을 입력해 주세요."),
    address: z.string().min(1, "주소를 입력해 주세요."),
    /*
      현장 좌표. **비워 둘 수 있다.**

      넣으면 근로자가 출근을 찍을 때 반경 안에 있는지 확인하고, 비워 두면
      확인하지 않는다. 필수로 막으면 좌표를 모르는 행사를 아예 등록할 수 없다.
      빈 문자열을 `undefined`로 바꿔 두어야 0(아프리카 서쪽 바다)과 구분된다.
    */
    latitude: z
      .union([z.literal(""), z.coerce.number().min(-90).max(90)])
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    longitude: z
      .union([z.literal(""), z.coerce.number().min(-180).max(180)])
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    managerName: z.string().min(1, "담당 매니저를 입력해 주세요."),
    /*
      담당 매니저 연락처.

      공지 문자에 담당자를 적어 보내 놓고 번호를 안 적으면, 현장에서 문제가 생긴
      사람은 결국 아무 데도 연락하지 못한다. 그래서 필수로 받는다.
    */
    managerPhone: z
      .string()
      .min(1, "담당 매니저 연락처를 입력해 주세요.")
      .regex(/^01[016789][0-9]{7,8}$/, "'-' 없이 숫자만 입력해 주세요."),
    description: z.string().max(500, "500자 이내로 입력해 주세요."),
    meetingPoint: z.string().min(1, "집합 장소와 시간을 입력해 주세요."),
    dressCode: z.string().min(1, "복장 규정을 입력해 주세요."),
    belongings: z.string().max(200, "200자 이내로 입력해 주세요."),
    breakMinutes: z.coerce.number().int().min(0).max(240),
    memo: z.string().max(500, "500자 이내로 입력해 주세요."),
    /*
      포지션. 등록할 때만 받는다. 수정 폼은 이 칸을 감추고 빈 배열을 보낸다.
      (수정에서는 `isEditing` 스키마를 쓴다 — 아래)
    */
    positions: z.array(eventPositionDraftSchema),
  })
  // 종료일이 시작일보다 앞서면 캘린더에서 행사가 사라지므로 폼에서 먼저 막는다.
  .refine((values) => values.endDate >= values.startDate, {
    path: ["endDate"],
    message: "종료일은 시작일과 같거나 이후여야 합니다.",
  })
  .refine(
    (values) =>
      isValidTimeRange(
        values.startTime,
        values.endTime,
        Number(values.endDayOffset),
      ),
    { path: ["endDayOffset"], message: TIME_RANGE_MESSAGE },
  )
  .refine(
    (values) =>
      values.recurrence.type !== "WEEKLY" ||
      values.recurrence.weekdays.length > 0,
    {
      path: ["recurrence"],
      message: "반복할 요일을 한 개 이상 선택해 주세요.",
    },
  )
  /*
    규칙은 맞는데 근무일이 하나도 안 나오는 조합이 실제로 생긴다.
    ("매주 일요일"인데 기간이 월~금 5일뿐인 경우)
    이대로 저장하면 인원도 배치도 없는 빈 행사가 만들어지므로 여기서 막는다.
  */
  .refine(
    (values) =>
      resolveEventDates(
        values.startDate,
        values.endDate,
        values.recurrence as EventRecurrence,
      ).length > 0,
    {
      path: ["recurrence"],
      message:
        "이 조건으로는 근무일이 하나도 없습니다. 기간이나 반복 조건을 확인해 주세요.",
    },
  )
  /*
    같은 직무는 여러 번 넣을 수 있다(A타임 스태프 · B타임 스태프).
    막는 것은 **같은 이름**이다. 이름이 같으면 명단 · 공고 · 계약서에서 둘을 구분할 수 없다.
  */
  .refine(
    (values) =>
      new Set(values.positions.map((position) => position.name.trim())).size ===
      values.positions.length,
    {
      path: ["positions"],
      message: "같은 이름의 포지션을 두 번 넣을 수 없습니다.",
    },
  );

/** 등록 폼에서만 쓴다. 포지션이 하나도 없으면 발주를 깔 곳이 없다. */
export const eventCreateSchema = eventSchema.refine(
  (values) => values.positions.length > 0,
  { path: ["positions"], message: "포지션을 한 개 이상 추가해 주세요." },
);

/**
 * 폼 값 타입.
 *
 * `z.coerce`를 쓰는 필드는 입력 타입(unknown)과 출력 타입(number)이 다르다.
 * react-hook-form에는 입력 타입을, 제출 핸들러에는 출력 타입을 넘겨야 하므로 둘 다 내보낸다.
 */
export type EventSchema = z.output<typeof eventSchema>;
export type EventSchemaInput = z.input<typeof eventSchema>;

/** 포지션 줄 하나의 기본값. 이름 · 직무 · 금액은 화면이 기준 설정에서 채운다. */
export const EMPTY_POSITION_DRAFT = {
  name: "",
  jobRole: "STAFF" as const,
  startTime: "",
  endTime: "",
  endDayOffset: 0 as DayOffset,
  breakMinutes: 0,
  wageType: "HOURLY" as const,
  wage: 12000,
  billingRate: 0,
  genderPreference: "ANY" as const,
  requiresHealthCert: false,
  requiredCount: 1,
};

/** 새 행사 폼의 기본값. 가장 흔한 구성(팀장 1 + 스태프 10)으로 시작한다. */
export const EMPTY_EVENT_VALUES: EventSchemaInput = {
  title: "",
  clientId: 0,
  startDate: "",
  endDate: "",
  recurrence: {
    type: "SINGLE",
    weekdays: [],
    intervalWeeks: 1,
    dates: [],
    excludeDates: [],
  },
  /*
    시간 기본값은 두지 않는다. 행사마다 천차만별이라 하나로 특정할 수 없고,
    어설픈 초기값이 깔려 있으면 고치지 않고 그대로 저장하는 사고가 오히려 늘어난다.
  */
  startTime: "",
  endTime: "",
  endDayOffset: 0,
  venue: "",
  address: "",
  latitude: "",
  longitude: "",
  managerName: "",
  managerPhone: "",
  description: "",
  meetingPoint: "",
  dressCode: "상의 흰색 셔츠 · 하의 검정 슬랙스 · 검정 단화",
  belongings: "신분증",
  breakMinutes: 0,
  memo: "",
  positions: [
    {
      ...EMPTY_POSITION_DRAFT,
      name: "팀장",
      jobRole: "SUPERVISOR",
      wage: 18000,
      requiredCount: 1,
    },
    {
      ...EMPTY_POSITION_DRAFT,
      name: "스태프",
      jobRole: "STAFF",
      wage: 12000,
      requiredCount: 10,
    },
  ],
};
