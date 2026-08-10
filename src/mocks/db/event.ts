import type {
  Assignment,
  AssignmentStatus,
  DayOffset,
  EventDayPlan,
  EventDetail,
  EventRecurrence,
  EventRoleSlot,
  EventStatus,
  WageType,
} from "@/type/event";
import {
  aggregateDayPlans,
  calculateWorkHours,
  resolveEventDates,
  toCheckDateTime,
} from "@/type/event";
import type {
  AttendanceStatus,
  JobRole,
  ReputationVerdict,
} from "@/type/staff";
import {
  buildReputationScore,
  calculateReputationDelta,
  reputationTagsOf,
  resolveTagVerdict,
} from "@/type/staff";
import { clients } from "./client";
import {
  EVENT_MANAGER_POOL,
  assignableStaff,
  everWorkedStaff,
  staffList,
} from "./staff";
import { dateFromToday, randomInt, toIsoDateTime } from "../utils";

/** 행사 제목은 거래처 성격과 맞아야 화면이 실제처럼 읽힌다. */
const EVENT_TITLE_POOL = [
  "브랜드 팝업스토어 운영",
  "신제품 론칭 쇼케이스",
  "백화점 프로모션 부스",
  "F&B 시음 프로모션",
  "코엑스 산업 전시회",
  "패션위크 백스테이지",
  "대학 축제 부스 운영",
  "쇼핑몰 주말 이벤트",
  "기업 사내 행사 의전",
  "플래그십 오픈 행사",
  "뷰티 클래스 운영",
  "스포츠 브랜드 체험존",
];

const VENUES = [
  { venue: "성수동 팝업 스페이스", address: "서울 성동구 연무장길 41" },
  { venue: "코엑스 A홀", address: "서울 강남구 영동대로 513" },
  { venue: "더현대 서울 5층", address: "서울 영등포구 여의대로 108" },
  { venue: "스타필드 하남 1층 아트리움", address: "경기 하남시 미사대로 750" },
  { venue: "DDP 알림터", address: "서울 중구 을지로 281" },
  { venue: "롯데월드몰 지하 1층", address: "서울 송파구 올림픽로 300" },
  { venue: "가로수길 플래그십", address: "서울 강남구 압구정로10길 26" },
  { venue: "일산 킨텍스 3홀", address: "경기 고양시 일산서구 킨텍스로 217" },
];

/**
 * 담당 매니저.
 *
 * 직원 명부에서 그대로 가져온다. 여기에 이름 · 번호를 따로 적어 두면
 * 문자의 `{{담당자연락처}}`와 직원 명부의 번호가 서로 다른 값이 된다.
 */
const MANAGERS = EVENT_MANAGER_POOL;

const DRESS_CODES = [
  "상의 흰색 셔츠 · 하의 검정 슬랙스 · 검정 단화",
  "지급 유니폼 착용 (현장 배부) · 검정 하의",
  "올블랙 정장 · 굽 5cm 이하 구두",
  "브랜드 티셔츠 지급 · 청바지 자유",
];

const BELONGINGS = [
  "신분증, 검정 마스크, 편한 실내화",
  "신분증, 개인 텀블러, 보조 배터리",
  "신분증, 검정 볼펜, 명찰 목걸이",
];

/** 행사 유형별 직무 구성. 발주는 항상 직무 단위로 들어온다. */
const ROLE_PRESETS: { role: JobRole; requiredCount: number }[][] = [
  [
    { role: "SUPERVISOR", requiredCount: 1 },
    { role: "STAFF", requiredCount: 10 },
  ],
  [
    { role: "SUPERVISOR", requiredCount: 2 },
    { role: "STAFF", requiredCount: 14 },
  ],
  [
    { role: "SUPERVISOR", requiredCount: 2 },
    { role: "STAFF", requiredCount: 20 },
    { role: "SETUP", requiredCount: 4 },
  ],
  [
    { role: "MC", requiredCount: 1 },
    { role: "MODEL", requiredCount: 4 },
    { role: "SOUND", requiredCount: 1 },
    { role: "STAFF", requiredCount: 6 },
  ],
  [
    { role: "SUPERVISOR", requiredCount: 1 },
    { role: "STAFF", requiredCount: 5 },
  ],
];

/**
 * 직무별 기본 시급.
 *
 * 직무는 기준 설정에서 자유롭게 바꿀 수 있게 됐지만, 목업 시드는 화면이 뜨기 전에
 * 만들어지므로 여기서 초기값을 들고 있는다. (기준 설정의 기본 직무와 같은 값)
 */
/**
 * 직무별 기본 지급 기준.
 *
 * 설치 · 철거는 시간이 들쭉날쭉해서 현장에서 하루 얼마로 부르는 쪽이 압도적으로 흔하다.
 * 기준 설정의 기본 직무 구성(`DEFAULT_JOB_ROLES`)과 같은 값을 쓴다.
 */
export const DEFAULT_ROLE_WAGE: Record<
  string,
  { wageType: WageType; wage: number }
> = {
  SUPERVISOR: { wageType: "HOURLY", wage: 18000 },
  STAFF: { wageType: "HOURLY", wage: 12000 },
  MC: { wageType: "HOURLY", wage: 30000 },
  MODEL: { wageType: "HOURLY", wage: 22000 },
  SOUND: { wageType: "HOURLY", wage: 20000 },
  SETUP: { wageType: "DAILY", wage: 130000 },
};

/** 정의에 없는 직무가 들어와도 금액이 0원이 되지 않게 한다. */
export const defaultWageOf = (
  role: JobRole,
): { wageType: WageType; wage: number } =>
  DEFAULT_ROLE_WAGE[role] ?? { wageType: "HOURLY", wage: 12000 };

/**
 * 발주에 걸린 성별 조건. **대부분은 무관이다.**
 *
 * 조건이 붙는 자리는 현장에서 정해져 있다 — 몸을 쓰는 설치 · 철거는 남성만,
 * 안내 · 응대가 중심인 모델 자리는 여성만으로 발주가 오는 일이 흔하다.
 * 다만 늘 그런 것은 아니라서 일부만 조건을 달아 둔다.
 * 조건이 전부 붙어 있으면 화면에서 '조건이 걸린 자리'가 눈에 띄지 않는다.
 *
 * 이 값은 표시일 뿐 배치를 막지 않는다.
 */
const resolveSeedGenderPreference = (
  role: JobRole,
  seed: number,
): "ANY" | "MALE" | "FEMALE" => {
  if (role === "SETUP" && seed % 3 !== 0) return "MALE";
  if (role === "MODEL" && seed % 3 !== 1) return "FEMALE";

  return "ANY";
};

/**
 * 행사 반복 패턴 목업.
 *
 * 현장 일정은 단발보다 이어지는 쪽이 오히려 흔하다.
 * 캘린더에서 네 가지 패턴이 모두 어떻게 보이는지 확인할 수 있도록 섞어 둔다.
 */
const buildRecurrence = (
  seed: number,
  clientId: number,
): { recurrence: EventRecurrence; spanDays: number } => {
  const empty = { weekdays: [], intervalWeeks: 1, dates: [], excludeDates: [] };

  // 전시·페어 발주가 많은 거래처는 기간 내내 이어지는 연일 행사로 둔다.
  if (clientId === 3) {
    return {
      recurrence: { ...empty, type: "CONSECUTIVE" },
      spanDays: seed % 2 === 0 ? 4 : 3,
    };
  }

  // 백화점·쇼핑몰 주말 프로모션. 한 달 내내 주말만 나가는 계약이 실제로 있다.
  if (seed % 7 === 0) {
    return {
      recurrence: { ...empty, type: "WEEKLY", weekdays: [0, 6] },
      spanDays: 28,
    };
  }

  // 격주 정기 행사 (2주에 한 번 토요일)
  if (seed % 11 === 0) {
    return {
      recurrence: { ...empty, type: "WEEKLY", weekdays: [6], intervalWeeks: 2 },
      spanDays: 35,
    };
  }

  // 평일 상설 운영
  if (seed % 13 === 0) {
    return {
      recurrence: { ...empty, type: "WEEKLY", weekdays: [1, 2, 3, 4, 5] },
      spanDays: 14,
    };
  }

  if (seed % 9 === 0) {
    return { recurrence: { ...empty, type: "CONSECUTIVE" }, spanDays: 2 };
  }

  return { recurrence: { ...empty, type: "SINGLE" }, spanDays: 1 };
};

const TIME_PRESETS = [
  { startTime: "09:00", endTime: "18:00", breakMinutes: 60, endDayOffset: 0 },
  { startTime: "10:00", endTime: "20:00", breakMinutes: 60, endDayOffset: 0 },
  { startTime: "11:00", endTime: "21:00", breakMinutes: 90, endDayOffset: 0 },
  { startTime: "13:00", endTime: "22:00", breakMinutes: 60, endDayOffset: 0 },
  { startTime: "08:00", endTime: "17:00", breakMinutes: 60, endDayOffset: 0 },
];

/** 날짜만으로 행사 상태를 정한다. 지난 행사는 정산 단계로 흘러가 있어야 자연스럽다. */
const resolveStatus = (offsetDays: number, seed: number): EventStatus => {
  // 거래처 사정으로 엎어지는 건이 실제로도 있어 미래 행사 일부를 취소로 둔다.
  if (offsetDays > 3 && seed % 19 === 0) return "CANCELED";
  if (offsetDays < -10) return "DONE";
  if (offsetDays < -1) return seed % 3 === 0 ? "DONE" : "SETTLEMENT";
  if (offsetDays === 0) return "IN_PROGRESS";
  if (offsetDays <= 5) return "CONFIRMED";
  if (offsetDays <= 25) return "RECRUITING";

  return seed % 4 === 0 ? "DRAFT" : "RECRUITING";
};

/**
 * 확정 비율을 정한다.
 *
 * 지난 행사는 100% 채워져 있고, 가까운 미래는 거의 다 찼고,
 * 먼 미래일수록 비어 있어야 캘린더에서 `(0/1) (5/10)`이 의미를 갖는다.
 */
const resolveFillRatio = (offsetDays: number, seed: number): number => {
  if (offsetDays < 0) return 1;
  if (offsetDays <= 2) return 1;
  if (offsetDays <= 7) return 0.7 + (seed % 3) * 0.1;
  if (offsetDays <= 20) return 0.3 + (seed % 4) * 0.15;

  return (seed % 3) * 0.15;
};

/** `HH:mm`에 분을 더한다. 자정을 넘기면 다음 날로 넘어간 시각을 돌려준다. */
const shiftTime = (time: string, minutes: number): string => {
  const [hour, minute] = time.split(":").map(Number);
  const total = ((hour * 60 + minute + minutes) % 1440 + 1440) % 1440;

  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * 자정을 넘기는 현장.
 *
 * 방송 · 철야 건이 실제로 있고, 그런 건이 하나도 없으면 D+1 · D+2 표기가
 * 화면에서 한 번도 확인되지 않는다. 다만 **드물어야 한다.**
 * 흔하게 깔면 하루 23시간짜리 행사가 목록의 3할을 차지해
 * 인건비 · 마진 같은 숫자가 전부 현실과 동떨어져 보인다.
 */
const OVERNIGHT_PRESETS = [
  // 자정을 넘겨 새벽에 끝나는 현장
  { startTime: "18:00", endTime: "04:00", breakMinutes: 60, endDayOffset: 1 },
  // 24시간을 넘기는 철야 현장
  { startTime: "13:00", endTime: "14:00", breakMinutes: 120, endDayOffset: 1 },
];

/**
 * 근무가 끝난 배치에 평가를 하나 붙인다.
 *
 * 현장에서 모든 근무에 평가가 남지는 않으므로 일부는 비워 둔다.
 * 노쇼 · 결근 · 지각처럼 눈에 보이는 문제가 있었던 날은 '별로예요'로 기운다.
 */
const buildReputation = (
  attendance: AttendanceStatus,
  seed: number,
): {
  reputationVerdict?: ReputationVerdict;
  reputationTags?: string[];
  reputationComment?: string;
} => {
  // 3건 중 1건 정도는 평가를 남기지 못한 채 넘어간다.
  if (seed % 3 === 0) return {};

  const isBad =
    attendance === "NO_SHOW" ||
    attendance === "ABSENT" ||
    (attendance === "LATE" && seed % 2 === 0) ||
    seed % 11 === 0;

  const verdict: ReputationVerdict = isBad ? "BAD" : "GOOD";
  const pool = reputationTagsOf(verdict);

  // 항목은 선택이라 절반 정도만 골라 둔 상태로 만든다.
  const tags = seed % 2 === 0 ? [pool[seed % pool.length].tag] : [];

  /*
    가끔은 좋아요와 별로예요가 **한 평가에 함께** 담긴다.
    ("지시 이해는 빠른데 복장 규정은 안 지켰다")
    실제로 흔한 조합이라 화면이 그걸 그릴 수 있는지 목업에서 보여야 한다.
  */
  if (tags.length > 0 && seed % 7 === 0) {
    const opposite = reputationTagsOf(isBad ? "GOOD" : "BAD");

    tags.push(opposite[seed % opposite.length].tag);
  }

  return { reputationVerdict: verdict, reputationTags: tags };
};

/**
 * 실제 출퇴근 기록을 만든다.
 *
 * 예정과 똑같은 값만 넣으면 "실제 기준 정산"이 화면에서 아무 의미도 갖지 못한다.
 * 지각 · 조기 철수 · 연장 근무를 섞고, 일부는 아예 비워 둔다.
 */
const buildCheckTimes = ({
  date,
  startTime,
  endTime,
  endDayOffset,
  isDone,
  attendance,
  lateMinutes,
  seed,
}: {
  date: string;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  isDone: boolean;
  attendance: AttendanceStatus;
  lateMinutes: number;
  seed: number;
}): {
  checkInAt?: string;
  checkOutAt?: string;
  actualBreakMinutes?: number;
} => {
  // 아직 오지 않은 날과 나오지 않은 사람은 적을 것이 없다.
  if (!isDone || attendance === "NO_SHOW" || attendance === "ABSENT") {
    return {};
  }

  // 지난 근무의 1/6 정도는 아직 기록을 못 남긴 상태로 둔다.
  if (seed % 6 === 0) return {};

  const inShift = attendance === "LATE" ? lateMinutes : 0;
  const outShift =
    attendance === "EARLY_LEAVE"
      ? -randomInt(seed * 3, 60, 150)
      : seed % 5 === 0
        ? randomInt(seed * 7, 30, 90) // 연장 근무
        : seed % 4 === 0
          ? -randomInt(seed * 11, 10, 40) // 조기 철수
          : 0;

  const actualIn = shiftTime(startTime, inShift);
  const actualOut = shiftTime(endTime, outShift);

  /*
    실제 퇴근이 며칠 뒤인지는 행사에 적힌 값을 그대로 따른다.
    당일 근무인데 종료가 시작보다 이르게 나온 경우(연장으로 자정을 넘긴 경우)만
    하루를 더한다. 시각만 보고 되짚는 추측은 여기까지다.
  */
  const outDayOffset =
    endDayOffset > 0 ? endDayOffset : actualOut <= actualIn ? 1 : 0;

  return {
    checkInAt: toCheckDateTime(date, actualIn),
    checkOutAt: toCheckDateTime(date, actualOut, outDayOffset as DayOffset),
  };
};

/** 목업이 만들어진 시점의 오늘. 날짜 오프셋 계산의 기준이 된다. */
const TODAY_DATE = dateFromToday(0);

let assignmentSequence = 0;

/** 같은 사람이 같은 날 두 행사에 확정되지 않도록 배치 결과를 날짜별로 기억한다. */
const assignedByDate = new Map<string, Set<number>>();

const takeAssignedSet = (date: string) => {
  if (!assignedByDate.has(date)) assignedByDate.set(date, new Set());

  return assignedByDate.get(date)!;
};

/** 근태 결과를 만든다. 지난 행사만 실제 결과를 갖는다. */
const resolveAttendance = (
  offsetDays: number,
  seed: number,
): { attendance: AttendanceStatus; lateMinutes: number } => {
  if (offsetDays >= 0) return { attendance: "PENDING", lateMinutes: 0 };

  if (seed % 37 === 0) return { attendance: "NO_SHOW", lateMinutes: 0 };
  if (seed % 13 === 0) {
    return { attendance: "LATE", lateMinutes: randomInt(seed, 5, 35) };
  }

  return { attendance: "PRESENT", lateMinutes: 0 };
};

/**
 * 행사 목업 38건.
 *
 * 오늘을 기준으로 과거 50일 ~ 미래 40일에 뿌려 캘린더 이전/다음 달을 눌러도
 * 빈 화면이 나오지 않게 한다.
 */
export const events: EventDetail[] = Array.from({ length: 38 }, (_, index) => {
  const seed = index + 1;
  const eventId = seed;
  const title = EVENT_TITLE_POOL[index % EVENT_TITLE_POOL.length];

  // -50 ~ +40일 사이에 고르게 뿌린다.
  const offsetDays = -50 + Math.round((index * 90) / 37) + ((seed % 3) - 1);
  const startDate = dateFromToday(offsetDays);

  const client = clients[index % clients.length];
  const preset = ROLE_PRESETS[index % ROLE_PRESETS.length];
  /* 9건에 1건 정도만 철야 현장으로 둔다. 나머지는 흔한 주간 근무다. */
  const time =
    index % 9 === 4
      ? OVERNIGHT_PRESETS[(index / 9) % OVERNIGHT_PRESETS.length | 0]
      : TIME_PRESETS[index % TIME_PRESETS.length];
  const place = VENUES[index % VENUES.length];

  const status = resolveStatus(offsetDays, seed);
  const workHours = calculateWorkHours(
    time.startTime,
    time.endTime,
    time.breakMinutes,
    time.endDayOffset as DayOffset,
  );

  /*
    반복 규칙에서 실제 근무일을 뽑는다.
    "매주 주말만"처럼 띄엄띄엄한 일정은 startDate~endDate 사이의 모든 날이 아니므로,
    기간과 근무일을 따로 들고 있어야 캘린더와 배치가 어긋나지 않는다.
  */
  const { recurrence, spanDays } = buildRecurrence(seed, client.clientId);
  const endDate = dateFromToday(offsetDays + spanDays - 1);
  const dates = resolveEventDates(startDate, endDate, recurrence);

  const assignments: Assignment[] = [];

  /**
   * 일자별 인원 계획.
   *
   * 첫날은 설치가, 마지막 날은 철거가 붙어 인원이 더 필요하다.
   * 실제 발주도 이런 식으로 들어오므로 날마다 인원을 다르게 만든다.
   */
  const days: EventDayPlan[] = dates.map((date, dayIndex) => {
    const isFirstDay = dayIndex === 0;
    const isLastDay = dayIndex === dates.length - 1;
    const isMultiDay = dates.length > 1;

    /*
      주말만 하는 행사는 dayIndex와 실제 경과일이 다르다. (2일차가 6일 뒤일 수 있다)
      근태·정산이 "지난 날인가"로 갈리므로 오프셋은 날짜에서 직접 구한다.
    */
    const dayOffset = Math.round(
      (new Date(`${date}T00:00:00`).getTime() -
        new Date(`${TODAY_DATE}T00:00:00`).getTime()) /
        (24 * 60 * 60 * 1000),
    );

    const fillRatio =
      status === "CANCELED" ? 0 : resolveFillRatio(dayOffset, seed + dayIndex);

    const roles: EventRoleSlot[] = preset.map(({ role, requiredCount }) => {
      const { wageType, wage } = defaultWageOf(role);

      // 설치/철거 직무는 첫날과 마지막 날에만 필요하다.
      const dayRequiredCount =
        isMultiDay && role === "SETUP" && !isFirstDay && !isLastDay
          ? 0
          : isMultiDay && role === "STAFF" && !isFirstDay
            ? Math.max(1, requiredCount - 2)
            : requiredCount;

      const targetCount = Math.min(
        dayRequiredCount,
        Math.round(dayRequiredCount * fillRatio),
      );

      /*
        지난 행사에는 지금 블랙리스트인 사람도 넣는다.
        그 사람들은 **일했기 때문에** 걸러진 것이고, 근태 · 평가 기록이 남아 있어야
        블랙리스트 화면이 무엇을 근거로 걸러 냈는지 설명할 수 있다.
        앞으로의 행사에는 당연히 부르지 않는다.
      */
      /*
        직원은 직무 조건을 보지 않는다.
        대행사가 주는 자리에 따라 메인팀장도 스태프도 맡기 때문에
        "가능 직무"라는 조건 자체가 뜻을 갖지 못한다.
      */
      const pool = (dayOffset < 0 ? everWorkedStaff() : assignableStaff()).filter(
        (staff) =>
          staff.employment === "EMPLOYEE" || staff.roles.includes(role),
      );
      const assignedSet = takeAssignedSet(date);

      let assignedCount = 0;

      for (
        let attempt = 0;
        attempt < pool.length && assignedCount < targetCount;
        attempt += 1
      ) {
        const candidate =
          pool[
            (randomInt(seed * 7 + dayIndex * 13 + attempt, 0, pool.length - 1) +
              attempt) %
              pool.length
          ];

        if (assignedSet.has(candidate.staffId)) continue;

        assignedSet.add(candidate.staffId);
        assignedCount += 1;

        const attendanceResult = resolveAttendance(
          dayOffset,
          seed * 100 + dayIndex * 10 + assignedCount,
        );
        const isDone = dayOffset < 0;
        // 노쇼도 배치 자체는 확정 상태였으므로 상태를 되돌리지 않는다. 근태로만 구분한다.
        const assignmentStatus: AssignmentStatus = "CONFIRMED";

        assignments.push({
          assignmentId: (assignmentSequence += 1),
          eventId,
          eventTitle: title,
          workDate: date,
          staffId: candidate.staffId,
          staffName: candidate.name,
          staffPhone: candidate.phoneNumber,
          staffProfileImageUrl: candidate.profileImageUrl,
          staffGender: candidate.gender,
          isEmployee: candidate.employment === "EMPLOYEE",
          role,
          status: assignmentStatus,
          wageType,
          /*
            금액은 직무 기본값에서 출발한다.
            사람마다 · 날마다 다르게 주는 일은 행사 안에서 언제든 고칠 수 있으므로
            (적용 금액 변경) 여기서는 기준값만 깔아 둔다.
          */
          wage,
          attendance: attendanceResult.attendance,
          /*
            실제 출퇴근.

            행사에 적힌 시각은 공지용 예정 시각일 뿐이고, 현장에서는
            조기 철수 · 연장 근무가 수시로 생긴다. 그 차이가 그대로 지급액 차이가 되므로
            목업도 예정과 어긋나는 값을 섞어 둬야 정산 화면이 실제처럼 읽힌다.

            지난 근무 일부는 일부러 기록을 비워 둔다.
            "출퇴근 미기록" 필터와 '예정 기준(잠정)' 표시를 확인하기 위해서다.
          */
          ...buildCheckTimes({
            date,
            startTime: time.startTime,
            endTime: time.endTime,
            endDayOffset: time.endDayOffset as DayOffset,
            isDone,
            attendance: attendanceResult.attendance,
            lateMinutes: attendanceResult.lateMinutes,
            seed: seed * 100 + dayIndex * 10 + assignedCount,
          }),
          lateMinutes: attendanceResult.lateMinutes,
          /*
            평가는 좋아요 · 별로예요 둘 중 하나다.
            노쇼 · 결근 · 지각이 있었던 날은 '별로예요'가 붙기 쉽게 둔다.
          */
          ...(isDone
            ? buildReputation(
                attendanceResult.attendance,
                seed * 11 + assignedCount,
              )
            : {}),
          /*
            가까운 미래 행사 일부는 일부러 계약서 미서명으로 둔다. (대시보드 할 일 확인용)
            직원은 계약 대상이 아니라 언제나 완료로 둔다.
          */
          isContractSigned:
            candidate.employment === "EMPLOYEE" ||
            (isDone ? true : assignedCount % 3 !== 0),
          isPaid: dayOffset < -10,
          createdAt: toIsoDateTime(date, "09:00"),
        });
      }

      return {
        role,
        requiredCount: dayRequiredCount,
        assignedCount,
        wageType,
        wage,
        /*
          성별 조건.

          대부분은 무관이다. 몸을 쓰는 설치 · 철거에 남성만, 안내 · 응대가
          중심인 모델 자리에 여성만을 적어 둔 발주가 실제로 들어오므로
          화면에서 그 표시가 어떻게 보이는지 확인할 수 있게 섞어 둔다.
          어디까지나 **표시**이고 배치를 막지 않는다.
        */
        genderPreference: resolveSeedGenderPreference(role, seed),
      };
    });

    return { date, roles };
  });

  const roles = aggregateDayPlans(days);
  const totalRequired = roles.reduce((sum, slot) => sum + slot.requiredCount, 0);
  const totalAssigned = roles.reduce((sum, slot) => sum + slot.assignedCount, 0);

  const billingRate =
    client.billingRates.find((rate) => rate.role === "STAFF")?.rate ?? 17000;

  return {
    eventId,
    title,
    clientId: client.clientId,
    clientName: client.name,
    status,
    startDate,
    endDate,
    recurrence,
    dates,
    dayCount: dates.length,
    startTime: time.startTime,
    endTime: time.endTime,
    endDayOffset: time.endDayOffset as DayOffset,
    venue: place.venue,
    address: place.address,
    managerName: MANAGERS[index % MANAGERS.length].name,
    managerPhone: MANAGERS[index % MANAGERS.length].phoneNumber,
    /*
      메인팀장은 **팀장으로 배치된 사람 중 한 명**이다.

      대행사가 슈퍼바이저 TO를 주면 우리 직원이 메인을 잡고, 그 아래를
      프리랜서 팀장 · 시급제 알바가 채운다. 그래서 팀장 중에서도 직원을 먼저 본다.

      직무를 보지 않고 '직원이면 무조건'으로 고르면 안 된다. 직원이 그날
      스태프 자리에 들어간 행사에서 그 사람이 메인팀장이 되고, 명단은
      메인팀장을 맨 앞에 세우므로(`byMainSupervisorFirst`) **스태프 한 명이
      팀장 위에 서서 직무 순서가 깨져 보인다.** 실제로 그렇게 깨져 있었다.

      실제로는 담당자가 행사 상세에서 지정한다. (거기서는 설치 팀장처럼
      다른 직무도 고를 수 있다 — 현장에 그런 경우가 있다)
      시드가 전부 비어 있으면 캘린더에서 이 자리가 무엇을 하는지 확인할 수 없어
      여기서 그럴듯한 값을 깔아 둔다.
    */
    ...(() => {
      const supervisors = assignments.filter(
        (assignment) =>
          assignment.status === "CONFIRMED" && assignment.role === "SUPERVISOR",
      );

      const main =
        supervisors.find((assignment) => assignment.isEmployee) ??
        supervisors[0];

      return main
        ? {
            mainSupervisorStaffId: main.staffId,
            mainSupervisorName: main.staffName,
            mainSupervisorPhone: main.staffPhone,
          }
        : {};
    })(),
    days,
    roles,
    totalRequired,
    totalAssigned,
    description: `${client.name} 발주 건입니다. 실근무 ${workHours}시간 기준이며 휴게 ${time.breakMinutes}분은 교대로 사용합니다.`,
    meetingPoint: `${place.venue} 정문 앞 / 시작 30분 전 집합`,
    dressCode: DRESS_CODES[index % DRESS_CODES.length],
    belongings: BELONGINGS[index % BELONGINGS.length],
    breakMinutes: time.breakMinutes,
    clientBillingRate: billingRate,
    memo:
      seed % 4 === 0
        ? "거래처에서 지난 행사와 동일한 슈퍼바이저를 요청했습니다."
        : "",
    assignments,
    createdAt: toIsoDateTime(dateFromToday(offsetDays - 20), "10:00"),
    updatedAt: toIsoDateTime(dateFromToday(Math.min(0, offsetDays)), "18:00"),
  } satisfies EventDetail;
});

export const findEvent = (eventId: number) =>
  events.find((event) => event.eventId === eventId);

/**
 * 배치 목록을 근거로 일자별 · 전체 확정 인원을 다시 센다.
 *
 * 배치는 항상 특정 날짜에 붙으므로, 그 날짜의 계획에만 반영한다.
 * 전체 현황은 일자별 계획을 합산해서 만든다. (숫자가 두 군데서 따로 놀지 않게)
 */
export const recalculateEventCounts = (event: EventDetail) => {
  event.days = event.days.map((day) => {
    const confirmed = event.assignments.filter(
      (assignment) =>
        assignment.workDate === day.date && assignment.status === "CONFIRMED",
    );

    /*
      발주에 없던 직무로 배치한 경우에도 자리를 만들어 준다.

      "이 날만 팀장 한 명 더"처럼 발주 없이 사람을 넣는 일이 실제로 흔한데,
      발주 슬롯이 있는 직무만 그리면 그 사람이 화면 어디에도 나타나지 않는다.
      배치는 됐는데 칩도 없고 합계에도 안 잡혀서, 담당자는 넣은 게 맞는지
      명단을 열어 확인해야 한다.

      발주 0명 · 배치 1명(`1/0`)으로 세워 두면 "발주에 없던 인원"이라는 사실이
      그 자리에서 드러난다. 발주가 0이라 필요 인원 합계는 달라지지 않는다.
    */
    const extraRoles = [
      ...new Set(confirmed.map((assignment) => assignment.role)),
    ].filter((role) => !day.roles.some((slot) => slot.role === role));

    const slots = [
      ...day.roles,
      ...extraRoles.map((role) => {
        const [sample] = confirmed.filter(
          (assignment) => assignment.role === role,
        );

        return {
          role,
          requiredCount: 0,
          assignedCount: 0,
          wageType: sample.wageType,
          wage: sample.wage,
          /* 발주에 없던 직무라 조건도 없다. */
          genderPreference: "ANY" as const,
        };
      }),
    ];

    return {
      ...day,
      roles: slots.map((slot) => ({
        ...slot,
        assignedCount: confirmed.filter(
          (assignment) => assignment.role === slot.role,
        ).length,
      })),
    };
  });

  event.roles = aggregateDayPlans(event.days);
  // 실제 근무일은 일자별 계획이 단일 원본이다. 요약 필드를 여기서 다시 맞춰 둔다.
  event.dates = event.days.map((day) => day.date);
  event.dayCount = event.days.length;
  event.totalRequired = event.roles.reduce(
    (sum, slot) => sum + slot.requiredCount,
    0,
  );
  event.totalAssigned = event.roles.reduce(
    (sum, slot) => sum + slot.assignedCount,
    0,
  );
  event.updatedAt = new Date().toISOString();
};

/**
 * 기간이나 반복 규칙이 바뀌었을 때 일자별 계획을 다시 맞춘다.
 *
 * 이미 있는 날의 인원은 그대로 두고, 새로 생긴 날에만 기준 인원을 깔아 준다.
 * "주말만"에서 "연일"로 바꾸면 근무일이 통째로 달라지므로,
 * 규칙에서 다시 뽑은 날짜 목록을 기준으로 삼는다.
 */
export const syncEventDays = (
  event: EventDetail,
  baseRoles: EventRoleSlot[],
) => {
  const dates = resolveEventDates(
    event.startDate,
    event.endDate,
    event.recurrence,
  );
  const previous = new Map(event.days.map((day) => [day.date, day]));

  event.days = dates.map(
    (date) =>
      previous.get(date) ?? {
        date,
        roles: baseRoles.map((slot) => ({ ...slot, assignedCount: 0 })),
      },
  );

  // 근무일에서 빠진 날의 배치는 남겨 둘 이유가 없다.
  event.assignments = event.assignments.filter((assignment) =>
    dates.includes(assignment.workDate),
  );

  recalculateEventCounts(event);
};

/** 모든 행사의 배치를 한 줄로 편다. 배치 현황 · 정산 목업이 함께 쓴다. */
export const allAssignments = (): Assignment[] =>
  events.flatMap((event) => event.assignments);

/**
 * 특정 인력이 해당 날짜에 이미 확정된 다른 행사를 찾는다.
 *
 * 다일 행사가 섞이면 `startDate` 비교로는 잡히지 않는다.
 * 배치가 가진 실제 근무일(workDate)로 봐야 정확하다.
 */
export const findConflictEvent = (
  staffId: number,
  date: string,
  excludeEventId?: number,
) =>
  events.find(
    (event) =>
      event.eventId !== excludeEventId &&
      event.status !== "CANCELED" &&
      event.assignments.some(
        (assignment) =>
          assignment.staffId === staffId &&
          assignment.workDate === date &&
          assignment.status === "CONFIRMED",
      ),
  );

/**
 * 인력의 좋아요 · 별로예요 건수를 배치에서 다시 센다.
 *
 * **평판 점수의 원본은 배치에 붙은 평가 하나하나다.**
 * 인력 쪽에 따로 그럴듯한 숫자를 지어 두면, 상세 화면의 점수와 바로 아래
 * 평가 목록이 서로 다른 이야기를 한다. (좋아요 13 · 별로 0이라 적어 놓고
 * 목록에는 별로예요가 보이는 식이다)
 *
 * 행사 목업이 다 만들어진 다음에만 셀 수 있어서 여기서 한 번 돌린다.
 * 실제 서버라면 집계 컬럼을 두거나 조회 시점에 세면 된다.
 */
export const syncStaffReputationCounts = () => {
  const counts = new Map<
    number,
    { good: number; bad: number; delta: number }
  >();

  events.forEach((event) =>
    event.assignments.forEach((assignment) => {
      if (!assignment.reputationVerdict) return;

      const current = counts.get(assignment.staffId) ?? {
        good: 0,
        bad: 0,
        delta: 0,
      };

      const tags = assignment.reputationTags ?? [];

      /*
        건수는 **항목 단위**로 센다. 한 평가에 좋아요와 별로예요가 함께
        담기므로 평가 하나를 한쪽으로만 세면 "좋아요 5 · 별로 0"이라 적혀
        있는데 목록에는 별로예요 항목이 보이는 상태가 된다.

        항목을 하나도 안 고른 평가는 방향만 한 건으로 센다.
      */
      if (tags.length > 0) {
        tags.forEach((tag) => {
          if (resolveTagVerdict(tag) === "BAD") current.bad += 1;
          else current.good += 1;
        });
      } else if (assignment.reputationVerdict === "GOOD") {
        current.good += 1;
      } else {
        current.bad += 1;
      }

      // 점수 계산은 화면과 같은 함수를 쓴다. 따로 세면 모달의 예고와 어긋난다.
      current.delta += calculateReputationDelta(
        tags,
        assignment.reputationVerdict,
      );

      counts.set(assignment.staffId, current);
    }),
  );

  staffList.forEach((staff) => {
    const current = counts.get(staff.staffId);

    staff.goodCount = current?.good ?? 0;
    staff.badCount = current?.bad ?? 0;
    staff.reputationScore = buildReputationScore(current?.delta ?? 0);
  });
};

syncStaffReputationCounts();
