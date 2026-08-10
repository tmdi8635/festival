import { z } from "zod";
import {
  resolveEventDates,
  type DayOffset,
  type EventRecurrence,
} from "@/type/event";

/** 직무 코드는 기준 설정에서 만들어지므로 고정 목록으로 검증하지 않는다. */
const jobRoleCode = z.string().min(1, "직무를 선택해 주세요.");

/** 행사 등록 · 수정 폼 스키마 */
export const eventRoleSlotSchema = z
  .object({
    role: jobRoleCode,
    requiredCount: z.coerce
      .number()
      .int("정수로 입력해 주세요.")
      .min(1, "1명 이상이어야 합니다.")
      .max(200, "한 직무에 200명을 넘길 수 없습니다."),
    assignedCount: z.coerce.number().int().min(0).default(0),
    wageType: z.enum(["HOURLY", "DAILY"]),
    wage: z.coerce
      .number()
      .int("정수로 입력해 주세요.")
      .min(1, "금액을 입력해 주세요."),
    /*
      성별 조건. 검증하지 않는다 — 어떤 값이든 배치를 막지 않는 표시일 뿐이다.
      기본값을 둬서 예전 데이터나 빠뜨린 요청도 '무관'으로 떨어지게 한다.
    */
    genderPreference: z.enum(["ANY", "MALE", "FEMALE"]).default("ANY"),
  })
  .superRefine((slot, ctx) => {
    /*
      최저시급은 시급으로 줄 때만 따진다.
      일급은 시간과 무관하게 합의하는 금액이라 같은 잣대를 댈 수 없다.
      (10만원짜리 반나절 일을 최저시급 미달로 막으면 아무것도 등록하지 못한다)
    */
    if (slot.wageType === "HOURLY" && slot.wage < 10_030) {
      ctx.addIssue({
        code: "custom",
        path: ["wage"],
        message: "2026년 최저시급(10,030원) 이상이어야 합니다.",
      });
    }
  });

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
    startTime: z.string().min(1, "시작 시각을 입력해 주세요."),
    endTime: z.string().min(1, "종료 시각을 입력해 주세요."),
    /*
      종료가 며칠 뒤인지. 방송 현장은 24시간을 넘겨 일하는 날이 드물지 않아
      "13:00~14:00"이 한 시간인지 25시간인지를 이 값으로만 가를 수 있다.
    */
    endDayOffset: z.coerce
      .number()
      .int()
      .min(0)
      .max(2) as unknown as z.ZodType<DayOffset>,
    venue: z.string().min(1, "장소명을 입력해 주세요."),
    address: z.string().min(1, "주소를 입력해 주세요."),
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
    clientBillingRate: z.coerce
      .number()
      .int("정수로 입력해 주세요.")
      .min(0, "0 이상이어야 합니다."),
    memo: z.string().max(500, "500자 이내로 입력해 주세요."),
    roles: z
      .array(eventRoleSlotSchema)
      .min(1, "직무를 한 개 이상 추가해 주세요."),
  })
  // 종료일이 시작일보다 앞서면 캘린더에서 행사가 사라지므로 폼에서 먼저 막는다.
  .refine((values) => values.endDate >= values.startDate, {
    path: ["endDate"],
    message: "종료일은 시작일과 같거나 이후여야 합니다.",
  })
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
  .refine(
    (values) =>
      new Set(values.roles.map((slot) => slot.role)).size ===
      values.roles.length,
    {
      path: ["roles"],
      message: "같은 직무를 두 번 넣을 수 없습니다.",
    },
  );

/**
 * 폼 값 타입.
 *
 * `z.coerce`를 쓰는 필드는 입력 타입(unknown)과 출력 타입(number)이 다르다.
 * react-hook-form에는 입력 타입을, 제출 핸들러에는 출력 타입을 넘겨야 하므로 둘 다 내보낸다.
 */
export type EventSchema = z.output<typeof eventSchema>;
export type EventSchemaInput = z.input<typeof eventSchema>;

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
  managerName: "",
  managerPhone: "",
  description: "",
  meetingPoint: "",
  dressCode: "상의 흰색 셔츠 · 하의 검정 슬랙스 · 검정 단화",
  belongings: "신분증",
  breakMinutes: 0,
  clientBillingRate: 17000,
  memo: "",
  roles: [
    {
      role: "SUPERVISOR",
      requiredCount: 1,
      assignedCount: 0,
      wageType: "HOURLY" as const,
      wage: 18000,
      genderPreference: "ANY" as const,
    },
    {
      role: "STAFF",
      requiredCount: 10,
      assignedCount: 0,
      wageType: "HOURLY" as const,
      wage: 12000,
      genderPreference: "ANY" as const,
    },
  ],
};
