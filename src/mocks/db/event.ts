import type {
  Assignment,
  AssignmentStatus,
  DayOffset,
  EventDayPlan,
  EventDetail,
  EventPosition,
  EventRecurrence,
  EventRoleSlot,
  EventStatus,
  GenderPreference,
  WageType,
} from "@/type/event";
import {
  aggregateDayPlans,
  buildPositionSlot,
  calculateWorkHours,
  comparePositionOrder,
  findPosition,
  matchesGenderPreference,
  resolveEventDates,
  resolvePositionWorkDates,
  toCheckDateTime,
  SINGLE_RECURRENCE,
} from "@/type/event";
import type {
  AttendanceStatus,
  JobRole,
  ReputationVerdict,
} from "@/type/staff";
import {
  buildReputationScore,
  calculateReputationDelta,
  resolveAttendancePenalty,
  findJobRoleCatalogEntry,
  hasValidHealthCert,
  reputationTagsOf,
  resolveTagVerdict,
} from "@/type/staff";
import { clients } from "./client";
import { operationSettings } from "./ops";
import {
  EVENT_MANAGER_POOL,
  assignableStaff,
  everWorkedStaff,
  staffList,
} from "./staff";
import { DEMO_STAFF_ID } from "../demo";
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

/**
 * 행사 장소.
 *
 * 좌표는 실제 값이다. 본인이 출근을 찍을 때 반경 안에 있는지 재는 데 쓰인다.
 *
 * **두 곳은 좌표를 비워 뒀다.** 좌표가 없으면 위치를 확인하지 않고 그냥 찍히는데,
 * 그 길이 화면에서 확인되지 않으면 좌표를 깜빡한 행사에서 무슨 일이 벌어지는지
 * 아무도 모른 채로 배포된다.
 */
const VENUES: {
  venue: string;
  address: string;
  latitude?: number;
  longitude?: number;
}[] = [
  {
    venue: "성수동 팝업 스페이스",
    address: "서울 성동구 연무장길 41",
    latitude: 37.5447,
    longitude: 127.0557,
  },
  {
    venue: "코엑스 A홀",
    address: "서울 강남구 영동대로 513",
    latitude: 37.5126,
    longitude: 127.0589,
  },
  {
    venue: "더현대 서울 5층",
    address: "서울 영등포구 여의대로 108",
    latitude: 37.5259,
    longitude: 126.9284,
  },
  {
    venue: "스타필드 하남 1층 아트리움",
    address: "경기 하남시 미사대로 750",
    latitude: 37.5453,
    longitude: 127.2249,
  },
  {
    venue: "DDP 알림터",
    address: "서울 중구 을지로 281",
    latitude: 37.5665,
    longitude: 127.0092,
  },
  {
    venue: "롯데월드몰 지하 1층",
    address: "서울 송파구 올림픽로 300",
    latitude: 37.5125,
    longitude: 127.1025,
  },
  /* 좌표 미등록 — 위치 확인을 건너뛰는 길 */
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
 * 직무별 기본 지급 기준.
 *
 * 값은 **기준 설정이 갖는다.** 여기에 표를 하나 더 두면 직무를 늘렸을 때
 * 한쪽만 고쳐지고, 새 직무의 배치가 조용히 0원으로 만들어진다.
 * 정의를 못 찾을 때만 가장 흔한 형태(시급)로 떨어뜨린다.
 */
export const defaultWageOf = (
  role: JobRole,
): { wageType: WageType; wage: number } => {
  const jobRole = operationSettings.jobRoles.find(
    (item) => item.code === role,
  );

  return jobRole
    ? { wageType: jobRole.defaultWageType, wage: jobRole.defaultWage }
    : { wageType: "HOURLY", wage: 12000 };
};

/** 직무의 기본 청구 단가. 꺼 둔 직무는 청구하지 않는 것으로 본다(0). */
export const defaultBillingRateOf = (role: JobRole): number => {
  const jobRole = operationSettings.jobRoles.find(
    (item) => item.code === role,
  );

  return jobRole?.isActive ? jobRole.billingRate : 0;
};

/**
 * 배치 한 건에 적용할 지급 기준과 금액을 정한다.
 *
 * 그날 그 포지션의 발주 조건을 그대로 물려받고, 없으면 포지션 기본값,
 * 그것도 없으면 직무 기본값으로 떨어진다.
 * 사람마다 · 날마다 다르게 주기로 한 금액은 배치를 만든 뒤 언제든 고칠 수 있으므로
 * (적용 금액 변경) 여기서는 기준값만 정한다.
 *
 * 배치를 만드는 자리가 셋(인력 배치 · 지원 확정 · 계약서 재작성)이라 여기 한 곳에 둔다.
 * 여러 벌이면 같은 날 같은 포지션인데 금액이 다른 배치가 생긴다.
 */
export const resolveAssignmentWage = (
  event: EventDetail,
  date: string,
  positionId: number,
): { wageType: WageType; wage: number } => {
  const slot = event.days
    .find((day) => day.date === date)
    ?.roles.find((item) => item.positionId === positionId);

  if (slot) return { wageType: slot.wageType, wage: slot.wage };

  const position = findPosition(event, positionId);

  return position
    ? { wageType: position.wageType, wage: position.wage }
    : defaultWageOf("STAFF");
};

/**
 * 시드용 포지션을 만든다. 직무 하나당 포지션 하나, 이름은 직무 이름 그대로다.
 *
 * 기존 시드는 "직무별 발주"로 만들어져 있어서, 이렇게 옮기면 화면이 예전과 똑같이 읽힌다.
 * 시간대 · 단가가 갈리는 포지션은 따로 만든 행사(`buildNightMarketEvent`)에서 확인한다.
 */
const buildSeedPositions = (
  roles: JobRole[],
  time: {
    startTime: string;
    endTime: string;
    breakMinutes: number;
    endDayOffset: number;
  },
  seed: number,
  title: string,
): EventPosition[] =>
  roles.map((role, index) => {
    const { wageType, wage } = defaultWageOf(role);

    return {
      positionId: index + 1,
      name: findJobRoleCatalogEntry(role)?.name ?? role,
      jobRole: role,
      startTime: time.startTime,
      endTime: time.endTime,
      endDayOffset: time.endDayOffset as DayOffset,
      breakMinutes: time.breakMinutes,
      wageType,
      wage,
      billingRate: defaultBillingRateOf(role),
      genderPreference: resolveSeedGenderPreference(role, seed),
      /*
        식음료 시음 행사의 스태프는 음식을 다룬다. 보건증이 있어야 한다.
        이 한 줄이 없으면 보건증 조건이 붙은 공고가 목업에 하나도 없다.
      */
      requiresHealthCert: title.startsWith("F&B") && role === "STAFF",
      /*
        대부분은 전일만이다. 업체가 사흘을 끝까지 서는 사람을 원하는 게 보통이라서다.
        몸으로 하는 설치 · 철거와 일부 스태프 자리만 일자별로 받는다 —
        화면에서 두 경우가 모두 보여야 차이를 확인할 수 있다.
      */
      scheduleRule:
        role === "SETUP" || (role === "STAFF" && seed % 3 === 0)
          ? "SPLIT_OK"
          : "FULL_ONLY",
    };
  });

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
function resolveSeedGenderPreference(
  role: JobRole,
  seed: number,
): GenderPreference {
  if (role === "SETUP" && seed % 3 !== 0) return "MALE";
  if (role === "MODEL" && seed % 3 !== 1) return "FEMALE";

  return "ANY";
}

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
  const positions = buildSeedPositions(
    preset.map((item) => item.role),
    time,
    seed,
    title,
  );

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

    const roles: EventRoleSlot[] = preset.map(({ role, requiredCount }, presetIndex) => {
      const position = positions[presetIndex];
      const { wageType, wage } = position;

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
        대행사가 주는 자리에 따라 팀장도 스태프도 맡기 때문에
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
          positionId: position.positionId,
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

      /*
        성별 조건은 슬롯이 아니라 포지션이 갖는다. (`buildSeedPositions`)
        몸을 쓰는 설치 · 철거에 남성만, 모델 자리에 여성만을 적어 둔 발주가
        실제로 들어오므로 그 표시가 화면에서 어떻게 보이는지 확인할 수 있게 섞어 둔다.
      */
      return {
        positionId: position.positionId,
        role,
        requiredCount: dayRequiredCount,
        assignedCount,
        wageType,
        wage,
      };
    });

    return { date, roles };
  });

  const roles = aggregateDayPlans(days);
  const totalRequired = roles.reduce((sum, slot) => sum + slot.requiredCount, 0);
  const totalAssigned = roles.reduce((sum, slot) => sum + slot.assignedCount, 0);

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
    latitude: place.latitude,
    longitude: place.longitude,
    managerName: MANAGERS[index % MANAGERS.length].name,
    managerPhone: MANAGERS[index % MANAGERS.length].phoneNumber,
    positions,
    days,
    roles,
    totalRequired,
    totalAssigned,
    description: `${client.name} 발주 건입니다. 실근무 ${workHours}시간 기준이며 휴게 ${time.breakMinutes}분은 교대로 사용합니다.`,
    meetingPoint: `${place.venue} 정문 앞 / 시작 30분 전 집합`,
    dressCode: DRESS_CODES[index % DRESS_CODES.length],
    belongings: BELONGINGS[index % BELONGINGS.length],
    breakMinutes: time.breakMinutes,
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
 * 그 포지션이 **실제로 서는 날**. 발주가 있는 날만이다.
 *
 * 설치 포지션은 첫날과 마지막 날에만 발주가 있다. 행사 근무일 전체로 배치하면
 * 가운데 날에 발주 없는 설치 인원이 생긴다.
 *
 * 발주가 하루도 없으면 **빈 배열이다.** 예전에는 행사 근무일 전체로 떨어뜨렸는데,
 * 그러면 담당자가 일별 발주를 0으로 내린 뒤 남은 지원을 확정하는 순간
 * 발주 0인 자리에 전일 배치가 깔린다. 부르지 않은 사람이 모든 날에 서는 것보다
 * "설 자리가 없다"고 거절하는 편이 옳다.
 *
 * 계산은 `type/event.ts`의 `resolvePositionWorkDates`가 원본이다. 공고 폼 · 포털이
 * 같은 날짜를 봐야 해서 옮겼고, 목업 쪽 이름은 호출부를 위해 남겨 둔다.
 */
export const positionWorkDates = resolvePositionWorkDates;

/**
 * 이 사람을 이 날들에 **넣을 수 있는가** — 날마다 따로 본다.
 *
 * 지원 확정 · 제안 수락이 같은 판정을 쓴다. 전일 모집은 하루라도 막히면 통째로
 * 거절하고, 분할 모집은 막힌 날만 빼고 넣는다. 그 정책은 부르는 쪽이 정하고,
 * 여기서는 날짜를 셋으로 가르기만 한다.
 */
export const planAssignmentDates = (
  event: EventDetail,
  staffId: number,
  dates: readonly string[],
) => {
  /** 넣을 수 있는 날 */
  const available: string[] = [];
  /** 다른 행사에 확정되어 있는 날 */
  const conflicts: { date: string; title: string }[] = [];
  /** 이 행사에 이미 들어가 있는 날. 사람 × 날짜는 배치 한 건이다 */
  const already: string[] = [];

  dates.forEach((date) => {
    const isAssigned = event.assignments.some(
      (assignment) =>
        assignment.staffId === staffId &&
        assignment.workDate === date &&
        assignment.status !== "CANCELED",
    );

    if (isAssigned) {
      already.push(date);
      return;
    }

    const conflict = findConflictEvent(staffId, date, event.eventId);

    if (conflict) {
      conflicts.push({ date, title: conflict.title });
      return;
    }

    available.push(date);
  });

  return { available, conflicts, already };
};

/**
 * 확정 배치를 만든다. 넣을 날은 `planAssignmentDates`로 이미 걸러 온 것이어야 한다.
 *
 * 지원 확정과 제안 수락이 **같은 모양의 배치**를 만들어야 한다. 한쪽만 계약서 여부나
 * 금액 복사를 빠뜨리면, 어느 길로 들어왔는지에 따라 정산이 달라진다.
 */
export const pushConfirmedAssignments = (
  event: EventDetail,
  staff: (typeof staffList)[number],
  positionId: number,
  dates: readonly string[],
): number => {
  const position = findPosition(event, positionId);

  if (!position) return 0;

  let maxId = events.reduce(
    (max, item) =>
      item.assignments.reduce(
        (innerMax, assignment) => Math.max(innerMax, assignment.assignmentId),
        max,
      ),
    0,
  );

  dates.forEach((date) => {
    maxId += 1;

    event.assignments.push({
      assignmentId: maxId,
      eventId: event.eventId,
      eventTitle: event.title,
      workDate: date,
      staffId: staff.staffId,
      staffName: staff.name,
      staffPhone: staff.phoneNumber,
      staffProfileImageUrl: staff.profileImageUrl,
      staffGender: staff.gender,
      isEmployee: staff.employment === "EMPLOYEE",
      positionId: position.positionId,
      role: position.jobRole,
      status: "CONFIRMED",
      ...resolveAssignmentWage(event, date, position.positionId),
      attendance: "PENDING",
      lateMinutes: 0,
      /* 직원은 회사와 이미 근로계약이 되어 있어 행사마다 다시 쓰지 않는다. */
      isContractSigned: staff.employment === "EMPLOYEE",
      isPaid: false,
      createdAt: new Date().toISOString(),
    });
  });

  recalculateEventCounts(event);

  return dates.length;
};

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
      발주에 없던 포지션으로 배치한 경우에도 자리를 만들어 준다.

      "이 날만 팀장 한 명 더"처럼 발주 없이 사람을 넣는 일이 실제로 흔한데,
      발주 슬롯이 있는 포지션만 그리면 그 사람이 화면 어디에도 나타나지 않는다.
      배치는 됐는데 칩도 없고 합계에도 안 잡혀서, 담당자는 넣은 게 맞는지
      명단을 열어 확인해야 한다.

      발주 0명 · 배치 1명(`1/0`)으로 세워 두면 "발주에 없던 인원"이라는 사실이
      그 자리에서 드러난다. 발주가 0이라 필요 인원 합계는 달라지지 않는다.
    */
    const extraPositionIds = [
      ...new Set(confirmed.map((assignment) => assignment.positionId)),
    ].filter(
      (positionId) => !day.roles.some((slot) => slot.positionId === positionId),
    );

    const slots: EventRoleSlot[] = [
      ...day.roles,
      ...extraPositionIds.map((positionId) => {
        const [sample] = confirmed.filter(
          (assignment) => assignment.positionId === positionId,
        );

        return {
          positionId,
          role: sample.role,
          requiredCount: 0,
          assignedCount: 0,
          wageType: sample.wageType,
          wage: sample.wage,
        };
      }),
    ];

    return {
      ...day,
      roles: slots
        .map((slot) => ({
          ...slot,
          assignedCount: confirmed.filter(
            (assignment) => assignment.positionId === slot.positionId,
          ).length,
        }))
        /* 포지션을 등록한 순서대로. 발주 없이 끼운 자리가 맨 앞에 서지 않게 한다. */
        .sort(comparePositionOrder(event.positions)),
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
      const current = counts.get(assignment.staffId) ?? {
        good: 0,
        bad: 0,
        delta: 0,
      };

      /*
        근태 감점은 평가와 따로 붙는다. 노쇼한 날에는 평가를 남기지 않는 일이
        대부분이라, 평가가 있을 때만 세면 노쇼가 점수에 한 번도 닿지 않는다.
        저장하지 않고 여기서 매번 구하므로, 노쇼를 정상으로 고치면 감점도 사라진다.
      */
      const penalty = resolveAttendancePenalty(assignment);

      if (penalty) {
        current.delta += penalty.points;
        counts.set(assignment.staffId, current);
      }

      if (!assignment.reputationVerdict) return;

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

/* --------------------------- 포지션 행사 --------------------------- */

/** 시간대 · 단가가 갈리는 포지션을 담은 행사. 공고 · 계약서 시드가 이 이름으로 찾는다. */
export const NIGHT_MARKET_EVENT_TITLE = "한강 여름 야시장 운영";

/**
 * **포지션이 여럿인 행사**를 하나 만든다.
 *
 * 위의 시드는 직무 하나당 포지션 하나라 예전 화면과 똑같이 읽힌다. 그것만 있으면
 * 이 기능의 핵심 — 같은 스태프인데 A타임 · B타임(야간)의 시간과 시급이 다른 자리,
 * 성별 · 보건증 조건이 붙은 자리 — 을 목업에서 한 번도 확인할 수 없다.
 *
 * 한 사람은 **1일차 A타임 · 2~3일차 B타임**으로 세운다. 그 사람의 계약서가
 * "근무일별 상이"로 나오는지, 정산의 야간수당이 둘째 날부터 붙는지를 여기서 본다.
 */
const buildNightMarketEvent = () => {
  const offset = 9;
  const startDate = dateFromToday(offset);
  const endDate = dateFromToday(offset + 2);
  const recurrence: EventRecurrence = {
    type: "CONSECUTIVE",
    weekdays: [],
    intervalWeeks: 1,
    dates: [],
    excludeDates: [],
  };
  const dates = resolveEventDates(startDate, endDate, recurrence);
  const client = clients[2 % clients.length];
  const manager = EVENT_MANAGER_POOL[1];
  const eventId = Math.max(...events.map((event) => event.eventId)) + 1;

  const base = {
    breakMinutes: 60,
    endDayOffset: 0 as DayOffset,
    genderPreference: "ANY" as GenderPreference,
    requiresHealthCert: false,
    scheduleRule: "FULL_ONLY" as const,
  };

  /*
    A타임은 전일만, 야간 · 인형탈은 일자별로 받는다. 한 행사에서 두 규칙을
    나란히 보여야 포털 공고의 '전일 참여'와 '날짜 골라 지원'이 함께 선다.
  */
  const positions: EventPosition[] = [
    { ...base, positionId: 1, name: "A타임", jobRole: "STAFF", startTime: "09:00", endTime: "18:00", wageType: "HOURLY", wage: 11000, billingRate: 17000 },
    { ...base, positionId: 2, name: "B타임(야간)", jobRole: "STAFF", startTime: "21:00", endTime: "06:00", endDayOffset: 1, wageType: "HOURLY", wage: 14000, billingRate: 21000, scheduleRule: "SPLIT_OK" },
    { ...base, positionId: 3, name: "인형탈", jobRole: "COSTUME", startTime: "12:00", endTime: "18:00", wageType: "HOURLY", wage: 15000, billingRate: 23000, scheduleRule: "SPLIT_OK" },
    { ...base, positionId: 4, name: "푸드 부스", jobRole: "PROMOTER", startTime: "17:00", endTime: "23:00", breakMinutes: 30, wageType: "HOURLY", wage: 13000, billingRate: 20000, requiresHealthCert: true },
    { ...base, positionId: 5, name: "야간 경호", jobRole: "SECURITY", startTime: "20:00", endTime: "04:00", endDayOffset: 1, wageType: "HOURLY", wage: 17000, billingRate: 25000, genderPreference: "MALE" },
    { ...base, positionId: 6, name: "VIP 의전", jobRole: "PROTOCOL", startTime: "10:00", endTime: "16:00", wageType: "DAILY", wage: 110000, billingRate: 26000, genderPreference: "FEMALE" },
  ];

  /* 포지션별 [하루 발주, 하루 확정]. 전부 덜 차 있어야 공고가 선다. */
  const plan: Record<number, [number, number]> = {
    1: [4, 2],
    2: [3, 1],
    3: [2, 0],
    4: [3, 1],
    5: [2, 1],
    6: [2, 0],
  };

  const assignments: Assignment[] = [];

  const push = (
    staff: (typeof staffList)[number],
    position: EventPosition,
    date: string,
  ) => {
    takeAssignedSet(date).add(staff.staffId);
    assignments.push({
      assignmentId: (assignmentSequence += 1),
      eventId,
      eventTitle: NIGHT_MARKET_EVENT_TITLE,
      workDate: date,
      staffId: staff.staffId,
      staffName: staff.name,
      staffPhone: staff.phoneNumber,
      staffProfileImageUrl: staff.profileImageUrl,
      staffGender: staff.gender,
      isEmployee: false,
      positionId: position.positionId,
      role: position.jobRole,
      status: "CONFIRMED",
      wageType: position.wageType,
      wage: position.wage,
      attendance: "PENDING",
      lateMinutes: 0,
      isContractSigned: false,
      isPaid: false,
      createdAt: toIsoDateTime(dateFromToday(-2), "10:00"),
    });
  };

  /*
    포털 기본 접속자는 넣지 않는다. 이 공고에 직접 지원해 보는 자리로 남긴다.
    서류가 승인된 사람만 쓴다 — 확정 배치는 서류 승인이 조건이다. (`canConfirmAssignment`)
  */
  const pool = assignableStaff().filter(
    (staff) =>
      staff.employment === "FREELANCER" &&
      staff.staffId !== DEMO_STAFF_ID &&
      staff.status === "ACTIVE",
  );
  const isFree = (staffId: number, list: string[]) =>
    list.every((date) => !takeAssignedSet(date).has(staffId));

  const mixed = pool.find(
    (staff) => staff.roles.includes("STAFF") && isFree(staff.staffId, dates),
  );

  if (mixed) {
    push(mixed, positions[0], dates[0]);
    dates.slice(1).forEach((date) => push(mixed, positions[1], date));
  }

  positions.forEach((position) => {
    const [, target] = plan[position.positionId];

    dates.forEach((date) => {
      let count = assignments.filter(
        (item) =>
          item.workDate === date && item.positionId === position.positionId,
      ).length;

      for (const staff of pool) {
        if (count >= target) break;
        if (!staff.roles.includes(position.jobRole)) continue;
        if (takeAssignedSet(date).has(staff.staffId)) continue;
        if (!matchesGenderPreference(position.genderPreference, staff.gender)) continue;
        if (
          position.requiresHealthCert &&
          !hasValidHealthCert(staff.healthCertState)
        ) {
          continue;
        }

        push(staff, position, date);
        count += 1;
      }
    });
  });

  const event: EventDetail = {
    eventId,
    title: NIGHT_MARKET_EVENT_TITLE,
    clientId: client.clientId,
    clientName: client.name,
    status: "RECRUITING",
    startDate,
    endDate,
    recurrence,
    dates,
    dayCount: dates.length,
    /* 행사의 기본 근무시간. 실제 시각은 포지션마다 다르다. */
    startTime: "09:00",
    endTime: "18:00",
    endDayOffset: 0,
    venue: "여의도 한강공원 물빛광장",
    address: "서울 영등포구 여의동로 330",
    latitude: 37.5284,
    longitude: 126.9327,
    managerName: manager.name,
    managerPhone: manager.phoneNumber,
    positions,
    days: dates.map((date) => ({
      date,
      roles: positions.map((position) =>
        buildPositionSlot(position, plan[position.positionId][0]),
      ),
    })),
    roles: [],
    totalRequired: 0,
    totalAssigned: 0,
    description: `${client.name} 발주 건입니다. 주간 · 야간 교대로 운영하며 포지션마다 근무시간과 시급이 다릅니다.`,
    meetingPoint: "물빛광장 운영 본부 텐트 / 근무 시작 30분 전 집합",
    dressCode: "지급 티셔츠 · 검정 하의 · 운동화",
    belongings: "신분증, 보조배터리, (푸드 부스) 보건증",
    breakMinutes: 60,
    memo: "야간 B타임은 06시 철수 후 교통비 별도 지급 여부 확인 필요.",
    assignments,
    createdAt: toIsoDateTime(dateFromToday(-5), "10:00"),
    updatedAt: toIsoDateTime(dateFromToday(-1), "18:00"),
  };

  recalculateEventCounts(event);
  events.push(event);
};

buildNightMarketEvent();

/* --------------------------- 데모 보정 --------------------------- */

/**
 * 포털 기본 접속자에게 **지금 찍을 수 있는 근무**를 하나 만들어 준다. (`mocks/demo.ts`)
 *
 * 나머지 행사는 오늘을 기준으로 −50 ~ +40일에 흩뿌려지고 시각도 고정 프리셋이라,
 * 포털을 여는 시각이 시간 창(시작 2시간 전 ~ 종료 2시간 후) 안에 들어올지가
 * 운에 달린다. 실제로 그래서 "출퇴근을 찍을 수 있는 게 하나도 없다"가 나온다.
 *
 * 그래서 이 한 건만 **여는 시각을 기준으로** 만든다 — 한 시간 전에 시작해
 * 네 시간 뒤에 끝나는 근무. 언제 열어도 창은 열려 있다.
 *
 * **좌표를 넣지 않는다.** 좌표를 넣으면 이 화면을 확인하는 사람이 코엑스에
 * 서 있지 않는 한 출근이 막힌다. 위치 검증 자체는 다른 행사(좌표가 있는 쪽)와
 * 기준 설정의 반경으로 확인한다.
 */
/** 데모 근무의 행사 이름. 계약서 시드가 이 이름으로 찾아 쓴다. */
export const DEMO_EVENT_TITLE = "주말 야외 페스티벌 운영";

/** 연일 근무 데모 행사. 캘린더에서 여러 날에 걸친 근무를 확인하는 자리다. */
export const DEMO_CONSECUTIVE_EVENT_TITLE = "브랜드 전시회 부스 운영";

const buildDemoWork = () => {
  const demoStaff = staffList.find((staff) => staff.staffId === DEMO_STAFF_ID);

  if (!demoStaff) return;

  const today = dateFromToday(0);
  const now = new Date();

  /*
    **30분 뒤에 시작한다.**

    이미 시작한 근무로 두면 지금 찍은 시각이 그대로 들어가서, 이 기능의 핵심인
    "일찍 찍어도 예정 시각으로 올라간다"는 고지가 화면에 뜨지 않는다.
    아직 시작 전이면서 출근 창(시작 2시간 전)은 열려 있는 자리가 여기다.

    밤 11시 반이 넘어 열면 오늘 안에 시작할 수 없다. 그때만 한 시간 전 시작으로
    물러선다 — 고지는 못 보지만 최소한 찍을 수는 있다.
  */
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes =
    nowMinutes + 30 < 24 * 60 ? nowMinutes + 30 : Math.max(0, nowMinutes - 60);
  const rawEndMinutes = startMinutes + 5 * 60;
  const endDayOffset: DayOffset = rawEndMinutes >= 24 * 60 ? 1 : 0;
  const endMinutes = rawEndMinutes % (24 * 60);

  const toTime = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

  const startTime = toTime(startMinutes);
  const endTime = toTime(endMinutes);
  const breakMinutes = 60;

  /*
    같은 날 두 행사에 확정되는 일은 없어야 한다. (`assignedByDate`와 같은 규칙)
    시드가 이미 오늘 다른 현장에 넣어 뒀다면 그쪽에서 빼고 인원을 다시 센다.
  */
  events.forEach((event) => {
    const before = event.assignments.length;

    event.assignments = event.assignments.filter(
      (assignment) =>
        !(
          assignment.staffId === DEMO_STAFF_ID && assignment.workDate === today
        ),
    );

    if (event.assignments.length !== before) recalculateEventCounts(event);
  });

  const client = clients[0];
  const manager = EVENT_MANAGER_POOL[0];
  const eventId = Math.max(...events.map((event) => event.eventId)) + 1;
  const { wageType, wage } = defaultWageOf("STAFF");
  const workHours = calculateWorkHours(
    startTime,
    endTime,
    breakMinutes,
    endDayOffset,
  );
  const position: EventPosition = {
    positionId: 1,
    name: "무대 운영",
    jobRole: "STAFF",
    startTime,
    endTime,
    endDayOffset,
    breakMinutes,
    wageType,
    wage,
    billingRate: defaultBillingRateOf("STAFF"),
    genderPreference: "ANY",
    requiresHealthCert: false,
    scheduleRule: "FULL_ONLY",
  };

  const assignment: Assignment = {
    assignmentId: (assignmentSequence += 1),
    eventId,
    eventTitle: DEMO_EVENT_TITLE,
    workDate: today,
    staffId: demoStaff.staffId,
    staffName: demoStaff.name,
    staffPhone: demoStaff.phoneNumber,
    staffProfileImageUrl: demoStaff.profileImageUrl,
    staffGender: demoStaff.gender,
    isEmployee: false,
    positionId: position.positionId,
    role: "STAFF",
    status: "CONFIRMED",
    wageType,
    wage,
    attendance: "PENDING",
    lateMinutes: 0,
    /* 계약서도 아직이다. 포털에서 서명까지 이어서 확인할 수 있게 둔다. */
    isContractSigned: false,
    isPaid: false,
    createdAt: toIsoDateTime(dateFromToday(-3), "10:00"),
  };

  const roles: EventRoleSlot[] = [
    { ...buildPositionSlot(position, 4), assignedCount: 1 },
  ];

  events.push({
    eventId,
    title: DEMO_EVENT_TITLE,
    clientId: client.clientId,
    clientName: client.name,
    status: "CONFIRMED",
    startDate: today,
    endDate: today,
    recurrence: SINGLE_RECURRENCE,
    dates: [today],
    dayCount: 1,
    startTime,
    endTime,
    endDayOffset,
    venue: "홍대 걷고싶은거리 특설무대",
    address: "서울 마포구 어울마당로 지하 100",
    /* 좌표를 일부러 비운다. (위 주석) */
    managerName: manager.name,
    managerPhone: manager.phoneNumber,
    positions: [position],
    days: [{ date: today, roles }],
    roles,
    totalRequired: 4,
    totalAssigned: 1,
    description: `${client.name} 발주 건입니다. 실근무 ${workHours}시간 기준이며 휴게 ${breakMinutes}분은 교대로 사용합니다.`,
    meetingPoint: "무대 뒤편 스태프 텐트 / 시작 30분 전 집합",
    dressCode: "검정 상하의 · 운동화",
    belongings: "신분증, 보조배터리",
    breakMinutes,
    memo: "",
    assignments: [assignment],
    createdAt: toIsoDateTime(dateFromToday(-10), "10:00"),
    updatedAt: toIsoDateTime(dateFromToday(-3), "18:00"),
  });
};

buildDemoWork();

/**
 * 포털 접속자의 **연일 근무 한 건.**
 *
 * 캘린더에서 여러 날에 걸친 근무가 어떻게 보이는지는 하루짜리 근무만으로는
 * 확인할 수 없다. 난수 시드가 연달아 붙여 주기를 기다리면 어떤 날은 나오고
 * 어떤 날은 안 나와서, 캘린더를 고칠 때마다 확인할 수 있을지가 운에 달린다.
 *
 * 나흘로 둔다. 이틀은 연속인지 두 건이 우연히 붙은 것인지 구분되지 않고,
 * 나흘이면 시작 요일에 따라 주 경계에서 끊기는 경우도 종종 걸린다.
 */
const buildDemoConsecutiveWork = () => {
  const demoStaff = staffList.find((staff) => staff.staffId === DEMO_STAFF_ID);

  if (!demoStaff) return;

  const SPAN = 4;

  /* 이 사람이 이미 선 날은 피한다. 같은 날 두 곳에 확정될 수 없다. */
  const taken = new Set<string>();

  events.forEach((event) =>
    event.assignments.forEach((assignment) => {
      if (
        assignment.staffId === DEMO_STAFF_ID &&
        assignment.status !== "CANCELED"
      ) {
        taken.add(assignment.workDate);
      }
    }),
  );

  /* 오늘 이후에서 비어 있는 나흘을 찾는다. 못 찾으면 만들지 않는다. */
  let offset = -1;

  for (let start = 2; start <= 40; start += 1) {
    const window = Array.from({ length: SPAN }, (_, index) =>
      dateFromToday(start + index),
    );

    if (window.every((date) => !taken.has(date))) {
      offset = start;
      break;
    }
  }

  if (offset < 0) return;

  const startDate = dateFromToday(offset);
  const endDate = dateFromToday(offset + SPAN - 1);
  const recurrence: EventRecurrence = {
    type: "CONSECUTIVE",
    weekdays: [],
    intervalWeeks: 1,
    dates: [],
    excludeDates: [],
  };
  const dates = resolveEventDates(startDate, endDate, recurrence);
  const client = clients[1 % clients.length];
  const manager = EVENT_MANAGER_POOL[2 % EVENT_MANAGER_POOL.length];
  const eventId = Math.max(...events.map((event) => event.eventId)) + 1;
  const { wageType, wage } = defaultWageOf("STAFF");

  const position: EventPosition = {
    positionId: 1,
    name: "부스 운영",
    jobRole: "STAFF",
    startTime: "10:00",
    endTime: "19:00",
    endDayOffset: 0,
    breakMinutes: 60,
    wageType,
    wage,
    billingRate: defaultBillingRateOf("STAFF"),
    genderPreference: "ANY",
    requiresHealthCert: false,
    scheduleRule: "FULL_ONLY",
  };

  const assignments: Assignment[] = dates.map((date) => ({
    assignmentId: (assignmentSequence += 1),
    eventId,
    eventTitle: DEMO_CONSECUTIVE_EVENT_TITLE,
    workDate: date,
    staffId: demoStaff.staffId,
    staffName: demoStaff.name,
    staffPhone: demoStaff.phoneNumber,
    staffProfileImageUrl: demoStaff.profileImageUrl,
    staffGender: demoStaff.gender,
    isEmployee: false,
    positionId: position.positionId,
    role: "STAFF",
    status: "CONFIRMED",
    wageType,
    wage,
    attendance: "PENDING",
    lateMinutes: 0,
    isContractSigned: false,
    isPaid: false,
    createdAt: toIsoDateTime(dateFromToday(-2), "11:00"),
  }));

  const roles: EventRoleSlot[] = [
    { ...buildPositionSlot(position, 6), assignedCount: 1 },
  ];

  events.push({
    eventId,
    title: DEMO_CONSECUTIVE_EVENT_TITLE,
    clientId: client.clientId,
    clientName: client.name,
    status: "CONFIRMED",
    startDate,
    endDate,
    recurrence,
    dates,
    dayCount: dates.length,
    startTime: position.startTime,
    endTime: position.endTime,
    endDayOffset: position.endDayOffset,
    venue: "코엑스 C홀 브랜드 부스",
    address: "서울 강남구 영동대로 513",
    managerName: manager.name,
    managerPhone: manager.phoneNumber,
    positions: [position],
    days: dates.map((date) => ({
      date,
      roles: roles.map((slot) => ({ ...slot })),
    })),
    roles,
    totalRequired: 6 * dates.length,
    totalAssigned: dates.length,
    description:
      "나흘 내내 같은 부스를 맡습니다. 마지막 날은 철수까지 함께 진행하니 종료 시각이 한 시간 정도 늦어질 수 있습니다.",
    meetingPoint: "코엑스 C홀 3번 게이트 앞 / 시작 30분 전 집합",
    dressCode: "흰 상의 · 검정 하의",
    belongings: "신분증, 편한 신발",
    breakMinutes: position.breakMinutes,
    memo: "",
    assignments,
    createdAt: toIsoDateTime(dateFromToday(-12), "10:00"),
    updatedAt: toIsoDateTime(dateFromToday(-2), "11:00"),
  });
};

buildDemoConsecutiveWork();
