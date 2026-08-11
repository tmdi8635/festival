import type {
  AttendanceStatus,
  Gender,
  JobRole,
  ReputationVerdict,
} from "./staff";

/**
 * 행사 한 건의 직무별 **청구** 단가 (시급).
 *
 * 기준 설정에 정해 둔 단가(`JobRoleDef.billingRate`)가 행사 등록 시
 * 초기값으로 깔리고, 현장 사정에 따라 여기서 고쳐진다.
 *
 * **없어도 된다.** 정하지 않은 직무는 아예 목록에 넣지 않는다.
 * 그 상태에서는 마진이 계산되지 않을 뿐 나머지는 전부 그대로 굴러간다.
 * (0을 넣으면 '0원에 청구하기로 했다'가 되어 버려 미설정과 구분되지 않는다)
 */
export interface BillingRate {
  role: JobRole;
  /** 대행사에 청구하는 시급 */
  rate: number;
}

/** 그 직무의 청구 단가. 정하지 않았으면 0이다. */
export const resolveBillingRate = (
  billingRates: readonly BillingRate[],
  role: JobRole,
): number => billingRates.find((item) => item.role === role)?.rate ?? 0;

/** 정하지 않은 단가(0)는 저장하지 않는다. 0원 청구와 미설정을 갈라 둔다. */
export const compactBillingRates = (
  billingRates: readonly BillingRate[],
): BillingRate[] => billingRates.filter((item) => item.rate > 0);

/**
 * 행사 · 인력 배치 도메인 타입.
 *
 * 발주(requiredCount)와 확정(assignedCount)을 직무별로 따로 들고 있어야
 * 캘린더에서 `팀장 (0/1) · 스태프 (5/10)` 형태를 그릴 수 있다.
 */

export type EventStatus =
  | "DRAFT"
  | "RECRUITING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "SETTLEMENT"
  | "DONE"
  | "CANCELED";

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "작성중",
  RECRUITING: "모집중",
  CONFIRMED: "배치완료",
  IN_PROGRESS: "진행중",
  SETTLEMENT: "정산대기",
  DONE: "완료",
  CANCELED: "취소",
};

/** 상태 전환은 이 순서로만 진행한다. (취소는 어느 단계에서나 가능) */
export const EVENT_STATUS_FLOW: readonly EventStatus[] = [
  "DRAFT",
  "RECRUITING",
  "CONFIRMED",
  "IN_PROGRESS",
  "SETTLEMENT",
  "DONE",
];

/* ------------------------------------------------------------------ */
/* 반복 일정                                                            */
/* ------------------------------------------------------------------ */

/**
 * 행사 반복 방식.
 *
 * 현장 일정은 하루짜리보다 여러 날 이어지는 쪽이 오히려 흔하고,
 * 그중에도 "쭉 이어서"와 "매주 주말만"은 성격이 전혀 다르다.
 * 기간(startDate~endDate)만으로는 후자를 표현할 수 없어서 규칙을 따로 둔다.
 *
 * - SINGLE      하루만
 * - CONSECUTIVE 시작일부터 종료일까지 매일 (연일 행사)
 * - WEEKLY      기간 안에서 특정 요일만 (매주 · 격주 · 주말만 · 평일만)
 * - CUSTOM      날짜를 직접 찍어서 지정 (불규칙한 일정)
 */
export type RecurrenceType = "SINGLE" | "CONSECUTIVE" | "WEEKLY" | "CUSTOM";

export const RECURRENCE_TYPE_LABEL: Record<RecurrenceType, string> = {
  SINGLE: "하루만",
  CONSECUTIVE: "연일 (기간 내 매일)",
  WEEKLY: "매주 반복",
  CUSTOM: "날짜 직접 선택",
};

/** 0=일요일 ~ 6=토요일. Date.getDay()와 같은 기준을 쓴다. */
export const WEEKDAY_LABELS: readonly string[] = [
  "일",
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
];

export interface EventRecurrence {
  type: RecurrenceType;
  /** WEEKLY 전용. 반복할 요일 (0=일 ~ 6=토) */
  weekdays: number[];
  /** WEEKLY 전용. 몇 주 간격인지. 1=매주, 2=격주 */
  intervalWeeks: number;
  /** CUSTOM 전용. 직접 고른 근무일 */
  dates: string[];
  /**
   * 반복 결과에서 빼는 날짜.
   *
   * "매주 주말인데 추석 연휴만 쉰다" 같은 예외를 규칙을 깨지 않고 표현한다.
   */
  excludeDates: string[];
}

/** 하루짜리 행사의 기본 반복 규칙 */
export const SINGLE_RECURRENCE: EventRecurrence = {
  type: "SINGLE",
  weekdays: [],
  intervalWeeks: 1,
  dates: [],
  excludeDates: [],
};

/**
 * 폼에서 고르는 반복 프리셋.
 *
 * 사용자는 "주말만"을 고르고 싶지 요일 배열을 조립하고 싶지 않다.
 * 자주 쓰는 조합을 버튼으로 만들어 두고, 세부 조정은 그다음에 하게 한다.
 */
export type RecurrencePreset =
  | "SINGLE"
  | "CONSECUTIVE"
  | "WEEKEND"
  | "WEEKDAY"
  | "WEEKLY"
  | "CUSTOM";

export const RECURRENCE_PRESET_LABEL: Record<RecurrencePreset, string> = {
  SINGLE: "하루만",
  CONSECUTIVE: "연일",
  WEEKEND: "주말만",
  WEEKDAY: "평일만",
  WEEKLY: "매주 특정 요일",
  CUSTOM: "직접 선택",
};

export const RECURRENCE_PRESET_HINT: Record<RecurrencePreset, string> = {
  SINGLE: "당일치기 행사",
  CONSECUTIVE: "전시 · 페어처럼 기간 내내 이어지는 행사",
  WEEKEND: "기간 내 토 · 일요일에만 진행",
  WEEKDAY: "기간 내 월~금에만 진행",
  WEEKLY: "요일과 간격을 직접 지정",
  CUSTOM: "달력에서 근무일을 하나씩 지정",
};

/** 프리셋을 실제 반복 규칙으로 바꾼다. */
export const buildRecurrenceFromPreset = (
  preset: RecurrencePreset,
  base: Partial<EventRecurrence> = {},
): EventRecurrence => {
  const common = {
    intervalWeeks: base.intervalWeeks ?? 1,
    dates: base.dates ?? [],
    excludeDates: base.excludeDates ?? [],
  };

  switch (preset) {
    /*
      하루짜리로 되돌리면 제외일을 버린다.
      하나뿐인 근무일을 제외하면 근무일이 0일인 행사가 되는데,
      "하루만"에는 제외를 되돌릴 자리가 없어서 손쓸 방법이 없어진다.
    */
    case "SINGLE":
      return {
        ...common,
        type: "SINGLE",
        weekdays: [],
        intervalWeeks: 1,
        excludeDates: [],
      };
    case "CONSECUTIVE":
      return { ...common, type: "CONSECUTIVE", weekdays: [] };
    case "WEEKEND":
      return { ...common, type: "WEEKLY", weekdays: [0, 6] };
    case "WEEKDAY":
      return { ...common, type: "WEEKLY", weekdays: [1, 2, 3, 4, 5] };
    case "WEEKLY":
      return {
        ...common,
        type: "WEEKLY",
        weekdays: base.weekdays?.length ? base.weekdays : [6],
      };
    case "CUSTOM":
      return { ...common, type: "CUSTOM", weekdays: [] };
  }
};

/** 반복 규칙을 프리셋으로 되돌린다. (수정 폼에서 어떤 버튼을 켤지 정할 때) */
export const resolvePresetFromRecurrence = (
  recurrence: EventRecurrence,
): RecurrencePreset => {
  if (recurrence.type === "SINGLE") return "SINGLE";
  if (recurrence.type === "CONSECUTIVE") return "CONSECUTIVE";
  if (recurrence.type === "CUSTOM") return "CUSTOM";

  const sorted = [...recurrence.weekdays].sort((a, b) => a - b).join(",");

  if (recurrence.intervalWeeks === 1 && sorted === "0,6") return "WEEKEND";
  if (recurrence.intervalWeeks === 1 && sorted === "1,2,3,4,5") return "WEEKDAY";

  return "WEEKLY";
};

/** 반복 규칙을 한 줄 문구로 만든다. 목록 · 캘린더 툴팁에서 쓴다. */
export const describeRecurrence = (
  recurrence: EventRecurrence,
  dayCount: number,
): string => {
  switch (recurrence.type) {
    case "SINGLE":
      return "하루";
    case "CONSECUTIVE":
      return `연일 ${dayCount}일`;
    case "CUSTOM":
      return `지정일 ${dayCount}일`;
    case "WEEKLY": {
      const days = [...recurrence.weekdays]
        .sort((a, b) => a - b)
        .map((weekday) => WEEKDAY_LABELS[weekday])
        .join("·");
      const interval =
        recurrence.intervalWeeks > 1 ? `${recurrence.intervalWeeks}주마다` : "매주";

      return `${interval} ${days} (${dayCount}일)`;
    }
  }
};

/* ------------------------------------------------------------------ */
/* 인원 계획                                                            */
/* ------------------------------------------------------------------ */

/**
 * 지급 기준.
 *
 * 현장 일이 시급으로만 굴러가지는 않는다.
 * "이 행사 설치는 하루 15만원"처럼 시간과 상관없이 하루치를 통으로 정하는 일이 흔하고,
 * 그렇게 정했으면 **그 금액이 합의된 전부**다. 일찍 끝나도 늦게 끝나도 같은 돈이다.
 *
 * - HOURLY 시급 × 실근무시간. 연장 · 야간수당이 붙을 수 있다.
 * - DAILY  하루치 정액. 시간을 곱하지 않고, 연장 · 야간을 따로 얹지 않는다.
 *          더 줄 돈이 생기면 정산의 기타수당으로 넣는다.
 */
export type WageType = "HOURLY" | "DAILY";

/**
 * 하루치 정액은 '일당'이 아니라 '일급'으로 적는다.
 * 시급 · 주급 · 월급과 같은 계열의 말이라 나란히 놓았을 때 뜻이 바로 통한다.
 */
export const WAGE_TYPE_LABEL: Record<WageType, string> = {
  HOURLY: "시급",
  DAILY: "일급",
};

/** 금액 입력창 우측에 붙는 단위 */
export const WAGE_TYPE_UNIT: Record<WageType, string> = {
  HOURLY: "원 / 시간",
  DAILY: "원 / 일",
};

/**
 * 발주에 걸린 성별 조건.
 *
 * 컨퍼런스 안내는 여성만, 설치 · 철거는 남성만 뽑는 일이 실제로 있다.
 * 보통은 무관이지만, 조건이 있는 날 그것을 모르고 사람을 넣으면
 * 현장에서 되돌려야 한다. 그래서 발주에 미리 적어 둔다.
 *
 * **이 값은 아무것도 막지 않는다.** 현장은 유동적이라 '남성만'으로 받은 자리에
 * 여성을 넣는 일도, 그 반대도 늘 있다. 시스템이 그것을 막으면 담당자는
 * 조건을 아예 안 적게 되고, 그러면 적어 둔 의미까지 사라진다.
 * 반드시 지켜야 하는 조건이라면 **내부 메모로 따로** 남긴다.
 *
 * 지금은 화면에 표시하고 배치 후보 필터의 초기값으로만 쓴다.
 * 나중에 공고를 띄우게 되면 그때 공고문에 실린다.
 */
export type GenderPreference = "ANY" | "MALE" | "FEMALE";

export const GENDER_PREFERENCE_LABEL: Record<GenderPreference, string> = {
  ANY: "성별 무관",
  MALE: "남성만",
  FEMALE: "여성만",
};

/** 발주 슬롯에 배지로 붙일 짧은 말. '무관'은 붙이지 않으므로 없다. */
export const GENDER_PREFERENCE_BADGE: Record<GenderPreference, string> = {
  ANY: "",
  MALE: "남성",
  FEMALE: "여성",
};

/** 직무별 발주 · 확정 현황 */
export interface EventRoleSlot {
  role: JobRole;
  /** 거래처에서 발주받은 인원 */
  requiredCount: number;
  /** 실제로 확정(픽스)된 인원. 대기 인원은 포함하지 않는다. */
  assignedCount: number;
  /** 이 직무를 시급으로 줄지, 하루 통으로 줄지 */
  wageType: WageType;
  /**
   * 이 직무의 기본 금액.
   * 시급이면 시간당, 일급이면 하루치다. 등급 가산액은 시급일 때만 더해진다.
   */
  wage: number;
  /** 성별 조건. 표시 · 추천용이고 **배치를 막지 않는다.** */
  genderPreference: GenderPreference;
}

/**
 * 행사 하루치 인원 계획.
 *
 * 전시처럼 여러 날 이어지는 행사는 날마다 필요한 인원이 다르다.
 * (첫날은 설치 인원이 더 붙고, 마지막 날은 철거가 붙는 식)
 * 그래서 발주 인원은 행사 단위가 아니라 **일자 단위**로 들고 있는다.
 *
 * 행사 전체의 `roles`는 이 값들을 합산한 결과다.
 */
export interface EventDayPlan {
  date: string;
  roles: EventRoleSlot[];
}

/** 캘린더 · 목록에서 쓰는 행사 요약 */
export interface EventSummary {
  eventId: number;
  title: string;
  clientId: number;
  clientName: string;
  status: EventStatus;
  /** 반복 기간의 시작. 실제 근무일은 recurrence에 따라 이 안에서 골라진다. */
  startDate: string;
  endDate: string;
  /** 반복 규칙 */
  recurrence: EventRecurrence;
  /**
   * 실제 근무일 목록 (오름차순).
   *
   * "매주 주말만"처럼 띄엄띄엄한 일정은 startDate~endDate 만으로 그릴 수 없다.
   * 캘린더 · 배치 · 정산이 전부 이 목록을 기준으로 움직인다.
   */
  dates: string[];
  /** 실제 진행 일수 = dates.length */
  dayCount: number;
  startTime: string;
  endTime: string;
  /**
   * 종료 시각이 근무일로부터 며칠 뒤인지.
   *
   * 방송 · 철야 현장은 24시간을 넘겨 일하는 날이 드물지 않다.
   * `13:00~14:00`이 한 시간짜리인지 25시간짜리인지는 이 값이 정한다.
   */
  endDayOffset: DayOffset;
  venue: string;
  address: string;
  managerName: string;
  /**
   * 담당 매니저 연락처.
   *
   * 이름만으로는 현장에서 아무것도 할 수 없다. 문자에 담당자를 적어 보내 놓고
   * 번호를 안 적으면, 현장에서 문제가 생긴 사람은 결국 아무 데도 연락하지 못한다.
   */
  managerPhone: string;
  /*
    '메인팀장'은 두지 않는다.

    직무와 별개로 "팀장 중 이 행사를 끌고 가는 한 사람"을 따로 지정하게 했는데,
    직무 목록에 이미 팀장이 있으니 **같은 것을 두 곳에서 정하는 일**이 됐다.
    배치에서 팀장을 넣고 상세에서 메인팀장을 또 고르지 않으면 명단 · 문자 ·
    캘린더 곳곳에 '지정 전'만 남았고, 그 빈칸이 무엇을 뜻하는지 아무도 몰랐다.
    현장에서 누구에게 연락하는지는 직무(팀장)와 담당 매니저로 충분하다.
  */
  /** 전체 일자를 합산한 직무별 현황 */
  roles: EventRoleSlot[];
  totalRequired: number;
  totalAssigned: number;
}

export interface EventDetail extends EventSummary {
  /** 일자별 인원 계획. 하루짜리 행사도 길이 1의 배열로 갖는다. */
  days: EventDayPlan[];
  description: string;
  /** 집합 장소 · 시간 안내 (공지 문구에 그대로 들어간다) */
  meetingPoint: string;
  dressCode: string;
  belongings: string;
  breakMinutes: number;
  /**
   * 거래처에 청구하는 **직무별** 시급. 인건비와 비교해 마진을 계산한다.
   *
   * 예전에는 행사 하나에 시급 하나였다. 그런데 팀장 · 스태프 · 설치는
   * 지급도 청구도 단가가 다르다. 하나로 묶어 두면 팀장이 많은 행사의 매출이
   * 통째로 낮게 잡히고, 그 숫자를 보고 다음 발주 단가를 정하게 된다.
   *
   * 기준 설정에 정해 둔 단가를 기본으로 가져오되(`JobRoleDef.billingRate`)
   * 행사마다 자유롭게 고친다. 발주는 늘 그때그때 다르게 들어온다.
   * 비어 있어도 된다 — 그 직무가 마진 계산에서 빠질 뿐이다.
   *
   * 거래처가 아니라 기준 설정에서 가져오는 이유: 단가를 부르는 쪽이
   * 에이전시라서다. 대행사가 직무별 인원수로 견적을 요청하면 우리가 답한다.
   */
  billingRates: BillingRate[];
  memo: string;
  assignments: Assignment[];
  createdAt: string;
  updatedAt: string;
}

export type AssignmentStatus =
  | "PROPOSED"
  | "CONFIRMED"
  | "WAITLIST"
  | "CANCELED";

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  PROPOSED: "제안",
  CONFIRMED: "확정",
  WAITLIST: "대기",
  CANCELED: "취소",
};

/**
 * 행사 하루에 배치된 인력 한 명.
 *
 * 여러 날 진행하는 행사에서 3일 전부 나오는 사람은 배치가 3건 생긴다.
 * 근태 · 정산 · 대타 교체가 모두 "그날" 단위로 일어나기 때문에,
 * 배치를 기간으로 묶으면 하루만 빠지는 상황을 표현할 수 없다.
 */
export interface Assignment {
  assignmentId: number;
  eventId: number;
  eventTitle: string;
  /** 실제로 나오는 날짜 */
  workDate: string;
  staffId: number;
  staffName: string;
  staffPhone: string;
  /**
   * 얼굴 사진.
   *
   * 명부를 보는 사람은 이름보다 얼굴로 사람을 기억한다. 특히 동명이인이 있는
   * 현장에서는 사진 한 장이 이름 두 줄보다 빠르다. 배치마다 인력을 다시 조회하면
   * 명부 한 장에 서른 번 요청이 나가므로 여기에 함께 담는다.
   */
  staffProfileImageUrl?: string;
  /**
   * 성별.
   *
   * 발주에 성별 조건이 걸리는 자리가 있어(컨퍼런스 안내 · 설치 철거)
   * 명단에서도 보여야 한다. 사진과 같은 이유로 배치에 함께 담는다 —
   * 명단 한 장에 서른 번 인력 조회가 나가면 안 된다.
   */
  staffGender?: Gender;
  /**
   * 이 사람이 우리 직원인가.
   *
   * 인력 쪽을 다시 조회하지 않고도 계약 · 정산에서 갈라낼 수 있어야 한다.
   * 계약 명단(`buildContractRoster`)과 정산 시드는 배치만 보고 도는데,
   * 여기 값이 없으면 직원에게도 계약서를 받으라고 하고 시급을 계산해 버린다.
   */
  isEmployee: boolean;
  role: JobRole;
  status: AssignmentStatus;
  /** 이 배치에 적용된 지급 기준 (행사 직무에서 그대로 내려온다) */
  wageType: WageType;
  /** 실제 적용 금액. 시급이면 시간당(등급 가산액 반영), 일급이면 하루치다. */
  wage: number;
  attendance: AttendanceStatus;
  /**
   * 실제 출근 시각 (ISO).
   *
   * 행사의 `startTime`은 **공지용 예정 시각**이다.
   * 현장에서는 조기 철수 · 연장 근무가 수시로 생기고, 그 차이가 곧 지급액 차이다.
   * 그래서 실제로 몇 시에 오고 갔는지를 따로 기록하고, 정산은 이 값을 쓴다.
   */
  checkInAt?: string;
  checkOutAt?: string;
  /** 실제 사용한 휴게 시간(분). 비어 있으면 행사 기본값을 쓴다. */
  actualBreakMinutes?: number;
  lateMinutes: number;
  /**
   * 행사 종료 후 평가. **한 번 남기면 고칠 수 없다.**
   *
   * 값이 있다는 것 자체가 "이 배치는 평가가 끝났다"는 뜻이다.
   * 고칠 수 있게 두면 나중에 이해관계가 생겼을 때 지난 평가를 손보게 되고,
   * 그 순간 쌓아 온 점수 전체가 근거를 잃는다. 잘못 남긴 평가는
   * **최고관리자가 지우고 다시 남긴다.** 지운 사실도 로그에 남는다.
   */
  reputationVerdict?: ReputationVerdict;
  /** 고른 평가 항목. 좋아요 · 별로예요가 **섞여 있을 수 있다.** */
  reputationTags?: string[];
  reputationComment?: string;
  /** 평가를 남긴 시각. 고칠 수 없으므로 이 값도 바뀌지 않는다. */
  reputationRatedAt?: string;
  /**
   * 근로계약서 서명 완료 여부. 미완료면 현장 투입 전에 처리해야 한다.
   *
   * **직원은 항상 `true`다.** 회사와 이미 근로계약이 되어 있어 행사마다 다시 쓰지 않는다.
   * 이 값을 `false`로 두면 명부 · 명단 · 대시보드 곳곳에서 영원히 처리되지 않는
   * '계약 미완'이 뜨고, 그 옆에 있는 진짜 미완이 묻힌다.
   */
  isContractSigned: boolean;
  isPaid: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 배치 묶기                                                            */
/* ------------------------------------------------------------------ */

/** 묶기에 필요한 최소한의 모양. 배치 전체를 요구하지 않아 후보 · 요약에도 쓸 수 있다. */
type GroupableAssignment = Pick<Assignment, "staffId" | "role" | "workDate">;

/**
 * 배치를 키 기준으로 묶고, 각 묶음을 근무일 순으로 세운다.
 *
 * **"사람 × 날짜"인 배치를 사람 단위로 되돌리는 일은 이 시스템 도처에서 일어난다.**
 * 계약서는 사람당 한 장이고, 정산도 사람당 한 번 이체하며, 출퇴근 명부도 사람으로 묶어 본다.
 * 예전에는 그 묶기를 다섯 군데에서 각각 `new Map()`으로 다시 짰는데,
 * 어디는 직무까지 맞추고 어디는 사람만 맞추는 차이가 생겨
 * 같은 사람의 계약서 장수와 정산 건수가 어긋났다.
 */
export const groupAssignments = <T extends GroupableAssignment>(
  assignments: T[],
  keyOf: (assignment: T) => string,
): T[][] => {
  const groups = new Map<string, T[]>();

  assignments.forEach((assignment) => {
    const key = keyOf(assignment);
    const bucket = groups.get(key);

    if (bucket) {
      bucket.push(assignment);
      return;
    }

    groups.set(key, [assignment]);
  });

  return [...groups.values()].map((bucket) =>
    [...bucket].sort((a, b) => a.workDate.localeCompare(b.workDate)),
  );
};

/**
 * 사람 × 직무로 묶는다. **계약서 · 정산 · 명부의 기본 단위다.**
 *
 * 직무까지 맞추는 것이 핵심이다. 같은 사람이 한 행사에서 날마다 다른 직무를
 * 맡는 일이 있고(첫날은 설치, 이후는 스태프), 직무가 다르면 시급도 계약도 다르다.
 * 사람만으로 묶으면 조건이 다른 이틀이 한 장의 계약서에 섞인다.
 */
export const groupAssignmentsByStaffRole = <T extends GroupableAssignment>(
  assignments: T[],
): T[][] =>
  groupAssignments(
    assignments,
    (assignment) => `${assignment.staffId}-${assignment.role}`,
  );

/**
 * 사람만으로 묶는다.
 *
 * 계약서 일괄 생성처럼 "이 사람에게 이미 문서가 나갔는가"를 볼 때 쓴다.
 * 한 행사에 같은 사람 앞으로 두 장이 나가면 서명도 두 번 받아야 한다.
 */
export const groupAssignmentsByStaff = <T extends GroupableAssignment>(
  assignments: T[],
): T[][] =>
  groupAssignments(assignments, (assignment) => String(assignment.staffId));

/**
 * 한 인력이 이 행사에서 며칠 나오는지 묶어 본 결과.
 * 여러 날 진행하는 행사의 배치 탭에서 "누가 어느 날 나오는가"를 한 줄로 보여 줄 때 쓴다.
 */
export interface AssignmentGroup {
  staffId: number;
  staffName: string;
  staffPhone: string;
  role: JobRole;
  /** 이 인력이 배치된 날짜들 (오름차순) */
  workDates: string[];
  assignments: Assignment[];
}

/** 배치 후보. 조건에 맞는 인력을 점수 순으로 추천한다. */
export interface AssignmentCandidate {
  staffId: number;
  name: string;
  phoneNumber: string;
  profileImageUrl: string;
  roles: JobRole[];
  region: string;
  district: string;
  /** 발주에 성별 조건이 걸릴 수 있어 후보 목록에서도 보여야 한다. */
  gender: Gender;
  /** 누적 평판 점수 */
  reputationScore: number;
  goodCount: number;
  badCount: number;
  workCount: number;
  noShowCount: number;
  lateCount: number;
  isFavorite: boolean;
  isDocumentComplete: boolean;
  /**
   * 우리 직원인가.
   *
   * 직원은 **직무 조건에 걸리지 않고** 후보로 올라온다. 대행사가 주는 자리에 따라
   * 팀장도 스태프도 맡기 때문이다. 화면에서도 그 사실이 보여야
   * 담당자가 "왜 이 사람이 설치 후보에 있지"에서 멈추지 않는다.
   */
  isEmployee: boolean;
  /** 직원의 직책. 후보 목록에서 누가 우리 사람인지 바로 읽힌다. */
  position?: string;
  /** 이 거래처 행사에 참여한 횟수. 많을수록 현장 적응이 빠르다. */
  clientWorkCount: number;
  /**
   * 다른 행사와 겹치는 날짜들.
   * 여러 날 진행하는 행사는 "3일 중 2일만 가능"한 경우가 흔해서, 날짜별로 알려 줘야
   * 되는 날만 골라 배치할 수 있다.
   */
  conflictDates: string[];
  /** 겹치는 날에 이미 확정된 행사명 (첫 건) */
  conflictEventTitle?: string;
  /** 이 행사에서 이미 배치된 날짜들. 중복으로 다시 넣지 않도록 표시한다. */
  assignedDates: string[];
  /** 추천 정렬에 쓰는 종합 점수 */
  matchScore: number;
}

/**
 * 행사 생성 · 수정 폼 값.
 *
 * 폼에서는 "하루치 기준 인원"만 입력받는다.
 * 여러 날짜 행사는 이 값을 모든 근무일에 복사해 깔고,
 * 날마다 다른 인원은 행사 상세의 일자별 계획에서 조정한다.
 * (등록 시점에는 날짜별 편차를 모르는 경우가 대부분이다)
 */
export interface EventFormValues {
  title: string;
  clientId: number;
  startDate: string;
  endDate: string;
  recurrence: EventRecurrence;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  venue: string;
  address: string;
  managerName: string;
  managerPhone: string;
  description: string;
  meetingPoint: string;
  dressCode: string;
  belongings: string;
  breakMinutes: number;
  billingRates: BillingRate[];
  memo: string;
  roles: EventRoleSlot[];
}

/**
 * 캘린더에 그리는 행사 하나.
 *
 * 이어지는 날짜는 한 덩어리 막대로 그리고, 띄엄띄엄한 일정은
 * 이어진 구간별로 나눠 그린다. 자르는 일은 화면이 `dates`를 보고 한다.
 */
export interface CalendarEvent {
  eventId: number;
  title: string;
  clientName: string;
  status: EventStatus;
  startDate: string;
  endDate: string;
  recurrence: EventRecurrence;
  dates: string[];
  dayCount: number;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  venue: string;
  managerName: string;
  /** 전체 근무일을 합산한 직무별 현황 */
  roles: EventRoleSlot[];
  /**
   * 일자별 인원 계획.
   *
   * 캘린더의 한 칸은 '하루'다. 그런데 반복 행사의 합계를 그대로 칸에 그리면
   * 주말만 하는 한 달짜리 행사가 하루에 80명 필요한 것처럼 보인다.
   * 칸에서는 그날의 숫자를, 막대와 상세에서는 합계를 쓴다.
   */
  days: EventDayPlan[];
  totalRequired: number;
  totalAssigned: number;
  /** 자세히 보기에서 명단을 바로 펼치기 위한 확정 배치 요약 */
  assignedStaff: CalendarAssignedStaff[];
}

/** 캘린더 자세히 보기에 나가는 배치 인력 한 명 */
export interface CalendarAssignedStaff {
  assignmentId: number;
  staffId: number;
  staffName: string;
  role: JobRole;
  workDate: string;
  status: AssignmentStatus;
}

/** 직무별 충원 상태. 캘린더 칩 색상을 결정한다. */
export type FillState = "EMPTY" | "PARTIAL" | "FULL" | "OVER";

export const resolveFillState = (
  assignedCount: number,
  requiredCount: number,
): FillState => {
  /*
    발주가 0인데 사람이 있으면 "발주에 없던 인원"이다. 초과로 본다.
    이걸 FULL로 두면 `1/0`이 초록으로 칠해져, 발주 없이 넣은 사람이
    정상적으로 채워진 자리처럼 보인다.
  */
  if (requiredCount === 0) return assignedCount > 0 ? "OVER" : "FULL";
  if (assignedCount === 0) return "EMPTY";
  if (assignedCount < requiredCount) return "PARTIAL";
  if (assignedCount > requiredCount) return "OVER";

  return "FULL";
};

/**
 * `Date`를 `YYYY-MM-DD` 문자열로 만든다.
 *
 * **절대 `toISOString().slice(0, 10)`을 쓰지 않는다.** 그건 UTC 기준이라
 * 한국(UTC+9)에서는 하루 앞의 날짜가 나온다. 자정으로 만든 `Date`를 그렇게 변환하면
 * 05-04가 05-03이 되고, "이어지는 날인가"를 묻는 비교가 **영원히 거짓이 된다.**
 * (그래서 연일 행사가 캘린더에서 하루짜리 막대 여러 개로 쪼개져 그려졌다)
 */
export const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/** 어떤 날짜의 다음 날 키. 이어지는 날짜를 묶을 때 쓴다. */
export const nextDateKey = (date: string): string => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 1);

  return toDateKey(next);
};

/** 시작일~종료일 사이의 날짜를 모두 만든다. (기간 계산의 공통 유틸) */
export const buildDateRange = (
  startDate: string,
  endDate: string,
): string[] => {
  if (!startDate || !endDate || endDate < startDate) return [];

  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);

  while (cursor <= last) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

/**
 * 반복 규칙을 실제 근무일 목록으로 편다.
 *
 * 이 함수가 반복 일정의 단일 원본이다.
 * 폼 미리보기 · 목업 · 캘린더가 전부 여기를 거쳐야 세 곳의 날짜가 어긋나지 않는다.
 */
export const resolveEventDates = (
  startDate: string,
  endDate: string,
  recurrence: EventRecurrence,
): string[] => {
  if (!startDate) return [];

  const excluded = new Set(recurrence.excludeDates);
  const withinRange = (date: string) =>
    date >= startDate && (!endDate || date <= endDate);

  switch (recurrence.type) {
    /*
      하루짜리는 제외를 보지 않는다.
      뺄 날이 하나뿐이라 제외하는 순간 근무일 0일짜리 행사가 되고,
      그건 담당자가 뜻한 것일 수 없다. 지우려면 행사를 지우는 것이 맞다.
    */
    case "SINGLE":
      return [startDate];

    case "CONSECUTIVE":
      return buildDateRange(startDate, endDate || startDate).filter(
        (date) => !excluded.has(date),
      );

    case "CUSTOM":
      // 기간 밖으로 밀려난 날짜가 남아 있으면 캘린더와 목록의 합계가 어긋난다.
      return [...new Set(recurrence.dates)]
        .filter((date) => withinRange(date) && !excluded.has(date))
        .sort();

    case "WEEKLY": {
      if (recurrence.weekdays.length === 0) return [];

      const weekdays = new Set(recurrence.weekdays);
      const interval = Math.max(1, recurrence.intervalWeeks);
      const all = buildDateRange(startDate, endDate || startDate);
      // 격주 판정은 "시작일이 속한 주"를 0주차로 두고 센다.
      const firstWeekStart = new Date(`${startDate}T00:00:00`);
      firstWeekStart.setDate(firstWeekStart.getDate() - firstWeekStart.getDay());

      return all.filter((date) => {
        if (excluded.has(date)) return false;

        const current = new Date(`${date}T00:00:00`);
        if (!weekdays.has(current.getDay())) return false;
        if (interval === 1) return true;

        const weekStart = new Date(current);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekIndex = Math.round(
          (weekStart.getTime() - firstWeekStart.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );

        return weekIndex % interval === 0;
      });
    }
  }
};

/**
 * 날짜 목록을 이어지는 구간으로 묶는다.
 *
 * 캘린더는 "며칠짜리 하나"를 막대로 보여 줘야 읽히는데,
 * 주말만 하는 행사는 토·일 두 칸씩 끊어 그려야 실제 일정과 맞는다.
 */
export const groupConsecutiveDates = (
  dates: string[],
): { start: string; end: string; dayCount: number }[] => {
  if (dates.length === 0) return [];

  const sorted = [...dates].sort();
  const groups: { start: string; end: string; dayCount: number }[] = [];

  let start = sorted[0];
  let previous = sorted[0];
  let count = 1;

  sorted.slice(1).forEach((date) => {
    if (nextDateKey(previous) === date) {
      count += 1;
    } else {
      groups.push({ start, end: previous, dayCount: count });
      start = date;
      count = 1;
    }

    previous = date;
  });

  groups.push({ start, end: previous, dayCount: count });

  return groups;
};

/**
 * 일자별 계획을 합쳐 행사 전체의 직무별 현황을 만든다.
 *
 * 캘린더 · 목록에는 합계만 보이고, 조정은 일자별로 한다.
 * 두 값이 어긋나지 않도록 합산은 항상 이 함수를 거친다.
 */
export const aggregateDayPlans = (days: EventDayPlan[]): EventRoleSlot[] => {
  const merged = new Map<JobRole, EventRoleSlot>();

  days.forEach((day) => {
    day.roles.forEach((slot) => {
      const current = merged.get(slot.role);

      if (!current) {
        merged.set(slot.role, { ...slot });
        return;
      }

      current.requiredCount += slot.requiredCount;
      current.assignedCount += slot.assignedCount;
      // 같은 직무의 시급은 날마다 같다고 보고 첫 값을 유지한다.

      /*
        성별 조건이 날마다 다르면 합계에는 '무관'으로 적는다.
        (설치는 첫날만 남성, 나머지 날은 무관인 식)
        한쪽 값을 대표로 세우면 행사 요약이 실제 발주보다 좁게 읽혀,
        조건이 없는 날까지 못 넣는 자리처럼 보인다.
      */
      if (current.genderPreference !== slot.genderPreference) {
        current.genderPreference = "ANY";
      }
    });
  });

  return [...merged.values()];
};

/* ------------------------------------------------------------------ */
/* 날짜 넘김 (D+1 · D+2)                                                 */
/* ------------------------------------------------------------------ */

/**
 * 근무 종료가 시작일로부터 며칠 뒤인지.
 *
 * 0 = 당일, 1 = 다음 날, 2 = 그 다음 날.
 *
 * 시각만 보고 추측할 수는 없다. "13시 출근 → 03시 퇴근"은 다음 날로 읽히지만
 * "13시 출근 → 다음 날 14시 퇴근"처럼 25시간을 일한 날은 어떤 규칙으로도 표현되지 않는다.
 * 방송 현장은 24시간을 통으로 넘기는 근무가 드물지 않고, 이틀을 꼬박 넘기는 일도
 * 아예 없다고 말할 수는 없다. 그래서 **사람이 직접 고르는 값**으로 둔다.
 */
export type DayOffset = 0 | 1 | 2;

export const DAY_OFFSET_LABEL: Record<DayOffset, string> = {
  0: "당일",
  1: "다음 날",
  2: "그 다음 날",
};

/** 버튼에 찍는 짧은 표기 */
export const DAY_OFFSET_CHIP_LABEL: Record<DayOffset, string> = {
  0: "당일",
  1: "D+1",
  2: "D+2",
};

export const DAY_OFFSET_VALUES: readonly DayOffset[] = [0, 1, 2];

/**
 * 시각 뒤에 붙는 날짜 넘김 표시. 당일이면 아무것도 붙이지 않는다.
 * `03:00 (+1)`처럼 읽힌다.
 */
export const dayOffsetSuffix = (dayOffset: DayOffset = 0): string =>
  dayOffset > 0 ? ` (+${dayOffset})` : "";

/**
 * 근무 시간대를 한 줄로 적는다.
 *
 * **시각을 나란히 적는 모든 화면이 이 함수를 쓴다.**
 * 예전에는 화면마다 `{startTime}~{endTime}`을 직접 썼는데, 그러면 날짜를 넘기는
 * 근무가 `13:00~03:00`으로 적혀 14시간짜리인지 마이너스인지 알 수 없었다.
 */
export const formatTimeRange = (
  startTime: string,
  endTime: string,
  endDayOffset: DayOffset = 0,
): string => `${startTime}~${endTime}${dayOffsetSuffix(endDayOffset)}`;

/** 근무 시간대를 들고 있는 것(행사 · 계약서)의 공통 모양 */
export interface ScheduledTime {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  /** 종료 시각이 시작일로부터 며칠 뒤인지 */
  endDayOffset: DayOffset;
}

/**
 * 휴게시간을 뺀 실근무 시간을 구한다.
 *
 * 며칠 뒤에 끝나는지는 `endDayOffset`이 정한다. 시각만으로는 알 수 없기 때문이다.
 * 다만 이 값이 0인데 종료가 시작보다 이르면 자정을 넘긴 것으로 본다.
 * (그렇게 두지 않으면 근무시간이 음수가 되어 아무 화면에서도 읽히지 않는다)
 */
export const calculateWorkHours = (
  startTime: string,
  endTime: string,
  breakMinutes = 0,
  endDayOffset: DayOffset = 0,
): number => {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute + endDayOffset * 24 * 60;
  const rawMinutes =
    (endTotal > startTotal ? endTotal : endTotal + 24 * 60) - startTotal;

  return Math.max(0, Math.round(((rawMinutes - breakMinutes) / 60) * 10) / 10);
};

/**
 * 근무 시간대를 들고 있는 것에서 바로 실근무 시간을 구한다.
 *
 * 호출부마다 `startTime · endTime · breakMinutes · endDayOffset` 네 개를 늘어놓으면
 * 언젠가 한 곳에서 마지막 인자를 빠뜨리고, 그 화면만 조용히 다른 숫자를 보여 준다.
 */
export const calculateScheduledWorkHours = (scheduled: ScheduledTime): number =>
  calculateWorkHours(
    scheduled.startTime,
    scheduled.endTime,
    scheduled.breakMinutes,
    scheduled.endDayOffset,
  );

/**
 * 배치 한 건(=하루)의 기본 지급액을 구한다.
 *
 * 시급이면 실근무 시간을 곱하고, 일급이면 시간과 상관없이 그대로 준다.
 * 화면 · 계약서 · 정산 · 목업이 전부 이 함수를 거쳐야 네 곳의 금액이 어긋나지 않는다.
 */
export const calculateBasePay = (
  wageType: WageType,
  wage: number,
  workHours: number,
): number => (wageType === "DAILY" ? wage : Math.round(wage * workHours));

/**
 * 시간당으로 환산한 금액.
 *
 * 지각 공제처럼 "분 단위로 얼마"를 따져야 하는 계산에 쓴다.
 * 일급은 하루치를 예정 근무시간으로 나눠야 시급과 같은 잣대가 된다.
 * (13만원짜리 일급에 시급 공제식을 그대로 대면 1분에 2,166원이 깎인다)
 */
export const resolveHourlyRate = (
  wageType: WageType,
  wage: number,
  scheduledWorkHours: number,
): number => {
  if (wageType === "HOURLY") return wage;

  return scheduledWorkHours > 0 ? Math.round(wage / scheduledWorkHours) : 0;
};

/**
 * 실제 출퇴근 기록으로 근무 시간을 구한다.
 *
 * 예정 시각이 아니라 **실제로 일한 시간**이 지급의 근거다.
 * 자정을 넘겨 퇴근하는 야간 행사도 다뤄야 하므로 ISO 일시 그대로 계산한다.
 */
export const calculateActualWorkHours = (
  checkInAt?: string,
  checkOutAt?: string,
  breakMinutes = 0,
): number | undefined => {
  if (!checkInAt || !checkOutAt) return undefined;

  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return undefined;

  const rawMinutes = (end - start) / 60000;

  return Math.max(0, Math.round(((rawMinutes - breakMinutes) / 60) * 10) / 10);
};

/**
 * 이 배치의 정산 기준 근무시간을 정한다.
 *
 * 실제 출퇴근이 기록됐으면 그 값을, 아직이면 행사 예정 시간을 쓴다.
 * 어느 쪽을 썼는지 화면에 표시해야 담당자가 "이 금액이 확정인지"를 안다.
 */
export const resolveWorkHours = (
  assignment: Pick<
    Assignment,
    "checkInAt" | "checkOutAt" | "actualBreakMinutes"
  >,
  scheduled: ScheduledTime,
): { workHours: number; isActual: boolean } => {
  const breakMinutes =
    assignment.actualBreakMinutes ?? scheduled.breakMinutes;

  const actual = calculateActualWorkHours(
    assignment.checkInAt,
    assignment.checkOutAt,
    breakMinutes,
  );

  if (actual !== undefined) return { workHours: actual, isActual: true };

  return {
    workHours: calculateScheduledWorkHours(scheduled),
    isActual: false,
  };
};

/** ISO 일시에서 `HH:mm`만 뽑는다. 출퇴근 입력창의 초기값으로 쓴다. */
export const toTimeInput = (isoDateTime?: string): string => {
  if (!isoDateTime) return "";

  const date = new Date(isoDateTime);

  if (Number.isNaN(date.getTime())) return "";

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

/**
 * 근무일 + `HH:mm`을 ISO 일시로 합친다.
 *
 * `dayOffset`은 근무일로부터 며칠 뒤인지다. 퇴근이 자정을 넘겼으면 1이다.
 */
export const toCheckDateTime = (
  workDate: string,
  time: string,
  dayOffset: DayOffset = 0,
): string | undefined => {
  if (!workDate || !time) return undefined;

  const base = new Date(`${workDate}T${time}:00`);

  if (Number.isNaN(base.getTime())) return undefined;

  if (dayOffset) base.setDate(base.getDate() + dayOffset);

  return base.toISOString();
};

/**
 * 퇴근이 며칠 뒤인지 **추측**한다.
 *
 * 퇴근 시각이 출근보다 이르면 다음 날로 본다.
 * (23시 출근 → 04시 퇴근을 음수 근무로 계산할 수는 없다)
 *
 * 어디까지나 **입력창의 초기값**을 정할 때만 쓴다. 이 추측으로는 다룰 수 없는
 * 경우가 있다. 13시 출근 → 다음 날 14시 퇴근처럼 24시간을 넘기는 근무는
 * 시각만 비교해서는 절대 나오지 않는다.
 * 그래서 화면에서는 **사람이 직접 고르는 D+1 · D+2 버튼**을 두고,
 * 이 함수는 그 버튼의 기본 선택만 정한다.
 */
export const guessDayOffset = (
  checkInTime: string,
  checkOutTime: string,
): DayOffset =>
  checkInTime && checkOutTime && checkOutTime <= checkInTime ? 1 : 0;

/**
 * 이미 기록된 퇴근 일시가 근무일로부터 며칠 뒤인지 되짚는다.
 *
 * 저장은 ISO 일시로 하고 화면은 `HH:mm` + D+n으로 다루므로, 모달을 다시 열 때
 * 둘을 이어 줄 사람이 필요하다. 이 계산을 화면마다 따로 쓰면 어떤 화면은
 * 익일 근무를 당일로 되돌려 놓고, 그대로 저장하는 순간 근무시간이 하루치 줄어든다.
 */
export const resolveCheckOutDayOffset = (
  workDate: string,
  checkOutAt?: string,
): DayOffset | undefined => {
  if (!workDate || !checkOutAt) return undefined;

  const base = new Date(`${workDate}T00:00:00`);
  const out = new Date(checkOutAt);

  if (Number.isNaN(out.getTime())) return undefined;

  out.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (out.getTime() - base.getTime()) / (24 * 60 * 60 * 1000),
  );

  return Math.min(2, Math.max(0, diffDays)) as DayOffset;
};

/**
 * 출퇴근 `HH:mm` 한 쌍으로 실근무 시간을 구한다.
 *
 * 날짜 없이 시각만 있는 입력 폼에서 "이렇게 넣으면 몇 시간인지"를 미리 보여 줄 때 쓴다.
 * 며칠 뒤에 끝나는지를 인자로 받는 것이 핵심이다. 시각만 비교해 추측하면
 * 자정을 넘기지 않는 근무와 25시간짜리 근무를 구분할 수 없다.
 */
export const calculateWorkHoursFromTimes = (
  checkInTime: string,
  checkOutTime: string,
  breakMinutes: number,
  dayOffset: DayOffset,
): number => {
  if (!checkInTime || !checkOutTime) return 0;

  const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);

    return hour * 60 + minute;
  };

  const start = toMinutes(checkInTime);
  const end = toMinutes(checkOutTime) + dayOffset * 24 * 60;

  return Math.max(0, Math.round(((end - start - breakMinutes) / 60) * 10) / 10);
};

/* ------------------------------------------------------------------ */
/* 행사 단위 집계                                                       */
/* ------------------------------------------------------------------ */

/**
 * 행사 한 건의 예상 인건비 · 매출 · 마진.
 *
 * 인건비와 매출은 배치 건(=사람×날짜) 단위로 쌓인다.
 * 여러 날 하는 행사에서 하루치로만 계산하면 마진이 실제의 몇 분의 일로 나온다.
 */
export const summarizeEventCost = (event: EventDetail) => {
  const dailyWorkHours = calculateScheduledWorkHours(event);

  const laborCost = event.assignments
    .filter((assignment) => assignment.status === "CONFIRMED")
    .reduce(
      (sum, assignment) =>
        sum +
        calculateBasePay(assignment.wageType, assignment.wage, dailyWorkHours),
      0,
    );

  /*
    매출은 **직무마다** 다르게 잡힌다.

    예전에는 `확정 인원 × 시간 × 시급 하나`였는데, 팀장과 스태프의 청구
    단가가 다른 것이 현실이라 팀장이 많은 행사의 매출이 통째로 낮게 잡혔다.
    단가를 안 정한 직무는 0으로 빠진다. (마진이 실제보다 작게 보일 뿐,
    없는 매출을 지어내지는 않는다)
  */
  const revenue = Math.round(
    event.assignments
      .filter((assignment) => assignment.status === "CONFIRMED")
      .reduce(
        (sum, assignment) =>
          sum +
          dailyWorkHours *
            resolveBillingRate(event.billingRates, assignment.role),
        0,
      ),
  );

  return { dailyWorkHours, laborCost, revenue, margin: revenue - laborCost };
};

/**
 * 행사 한 건의 처리 진행 상황.
 *
 * 행사 상세 화면은 "무엇이 아직 안 끝났는가"를 먼저 보여 줘야 한다.
 * 계약서 · 출퇴근 · 근태를 각각 다른 화면에서 세어 보던 것을 여기 한 곳에서 센다.
 * (상단 요약과 각 탭이 같은 값을 써야 숫자가 어긋나지 않는다)
 */
export const summarizeEventProgress = (assignments: Assignment[]) => {
  const active = assignments.filter(
    (assignment) => assignment.status !== "CANCELED",
  );
  const confirmed = active.filter(
    (assignment) => assignment.status === "CONFIRMED",
  );

  /*
    계약서는 **직원을 빼고** 센다.
    직원은 회사와 이미 근로계약이 되어 있어 행사마다 계약서를 쓰지 않는다.
    함께 세면 아무리 처리해도 '미완료 2건'이 영원히 남아, 정작 진짜 미완료가
    그 숫자에 묻힌다.
  */
  const contractTarget = confirmed.filter(
    (assignment) => !assignment.isEmployee,
  );
  const contractSignedCount = contractTarget.filter(
    (assignment) => assignment.isContractSigned,
  ).length;
  const attendanceCheckedCount = confirmed.filter(
    (assignment) => assignment.attendance !== "PENDING",
  ).length;
  const checkTimeRecordedCount = confirmed.filter(
    (assignment) => assignment.checkInAt && assignment.checkOutAt,
  ).length;
  const issueCount = confirmed.filter((assignment) =>
    ["LATE", "EARLY_LEAVE", "ABSENT", "NO_SHOW"].includes(assignment.attendance),
  ).length;

  return {
    /** 취소를 뺀 전체 배치 건수 */
    totalCount: active.length,
    confirmedCount: confirmed.length,
    waitlistCount: active.filter(
      (assignment) => assignment.status === "WAITLIST",
    ).length,
    contractSignedCount,
    /** 계약서를 받아야 하는 건수. 직원은 대상이 아니다. */
    contractTargetCount: contractTarget.length,
    contractMissingCount: contractTarget.length - contractSignedCount,
    attendanceCheckedCount,
    attendancePendingCount: confirmed.length - attendanceCheckedCount,
    checkTimeRecordedCount,
    /** 출퇴근이 안 적힌 건. 남아 있으면 정산 금액이 아직 잠정이다. */
    checkTimeMissingCount: confirmed.length - checkTimeRecordedCount,
    issueCount,
  };
};

/**
 * 근무 시간대가 야간(기본 22시~06시)에 몇 시간 걸치는지 구한다.
 *
 * 야간수당을 건별로 켜고 끌 수 있게 되면서, 화면에서도 "이 건은 야간이 몇 시간"을
 * 보여 줘야 한다. 정산 목업과 화면이 같은 값을 쓰도록 여기 한 곳에만 둔다.
 */
export const calculateNightHours = (
  startTime: string,
  endTime: string,
  nightStartTime = "22:00",
  nightEndTime = "06:00",
  /** 종료가 며칠 뒤인지. 25시간 근무는 야간 구간을 두 번 지난다. */
  endDayOffset: DayOffset = 0,
): number => {
  const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);

    return hour * 60 + minute;
  };

  const start = toMinutes(startTime);
  const rawEnd = toMinutes(endTime) + endDayOffset * 24 * 60;
  const end = rawEnd > start ? rawEnd : rawEnd + 24 * 60;

  const nightStart = toMinutes(nightStartTime);
  const rawNightEnd = toMinutes(nightEndTime);
  const nightEnd = rawNightEnd > nightStart ? rawNightEnd : rawNightEnd + 24 * 60;

  // 자정을 넘기는 구간이 있어 하루(1440분)씩 밀어 가며 겹침을 모두 더한다.
  // 이틀을 넘기는 근무까지 담아야 하므로 앞뒤로 넉넉히 훑는다.
  let overlapMinutes = 0;

  [-1, 0, 1, 2, 3].forEach((offset) => {
    const shift = offset * 24 * 60;
    const from = Math.max(start, nightStart + shift);
    const to = Math.min(end, nightEnd + shift);

    overlapMinutes += Math.max(0, to - from);
  });

  return Math.round((overlapMinutes / 60) * 10) / 10;
};
