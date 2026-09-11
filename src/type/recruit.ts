import type {
  DayOffset,
  EventDayPlan,
  EventPosition,
  GenderPreference,
  PositionScheduleRule,
  WageType,
} from "./event";
import { resolvePositionWorkDates } from "./event";
import type { JobRole } from "./staff";

/**
 * `2026-09-12` → `09.12`. 줄 설명에 연도까지 붙이면 사흘짜리 줄 하나가 칸을 넘친다.
 * 공고는 늘 가까운 날이라 연도는 읽는 사람이 이미 안다.
 */
const formatShortDate = (date: string): string => date.slice(5).replace("-", ".");

/**
 * 공고 · 지원 도메인 타입.
 *
 * 지금은 오픈카톡방에 공고를 올리고 문자로 지원을 받는다.
 * 여기서는 공고문을 시스템이 만들어 주고(복사해서 붙여넣기), 지원자는 목록으로 관리한다.
 * 앱이 붙으면 지원 등록만 자동화되고 이후 흐름은 그대로 쓸 수 있다.
 *
 * ## 공고 하나 = 행사 하나, 그 안에 모집 줄 여럿
 *
 * 예전에는 행사 × 직무마다 공고가 따로 나갔다. 한 행사에서 팀장 · 스태프 · 설치가
 * 모자라면 공고가 세 장이었고, 지원하는 사람 눈에는 **같은 행사가 세 번** 보였다.
 * 지금은 공고가 행사 하나를 덮고, 그 안에서 **모집 줄**마다 사람을 받는다.
 *
 * 모집 줄은 포지션 하나를 가리키지만 **포지션과 1:1이 아니다.** 같은 A타임에
 * "전일 2명"과 "09.13 하루 1명(급구)"이 나란히 설 수 있어야 한다. 업체는 대개 전 일정
 * 가능자를 원하지만, 노쇼 · 급구 때는 하루씩 뽑을 수밖에 없다. 그래서 줄은 자기 번호
 * (`targetId`)를 갖고, 지원도 포지션이 아니라 줄을 가리킨다.
 */

export type PostingStatus = "DRAFT" | "OPEN" | "CLOSED" | "FILLED";

export const POSTING_STATUS_LABEL: Record<PostingStatus, string> = {
  DRAFT: "작성중",
  OPEN: "모집중",
  CLOSED: "마감",
  FILLED: "충원완료",
};

/**
 * 모집 줄의 참여 방식.
 *
 * - `FULL`: 줄의 날짜를 **전부** 나온다. 지원자는 날짜를 고르지 않는다.
 * - `SPLIT`: 줄의 날짜 중 **나올 수 있는 날을 골라** 지원한다. (최소 하루)
 */
export type PostingParticipation = "FULL" | "SPLIT";

export const PARTICIPATION_LABEL: Record<PostingParticipation, string> = {
  FULL: "전일 참여",
  SPLIT: "날짜 골라 지원",
};

/** 포지션의 발주 조건이 곧 공고 줄의 초기값이다. */
export const participationOf = (
  rule: PositionScheduleRule,
): PostingParticipation => (rule === "FULL_ONLY" ? "FULL" : "SPLIT");

/**
 * 저장되는 모집 줄. 공고가 직접 갖는 값은 이것뿐이다.
 *
 * 이름 · 시각 · 금액은 **행사 포지션을 그대로 가리킨다.** 공고에 사본을 두면
 * 행사에서 단가를 고쳤을 때 공고만 옛 금액으로 남는다.
 */
export interface PostingTarget {
  /** 공고 안에서 유일하다. 지원이 이 번호를 가리킨다. */
  targetId: number;
  positionId: number;
  /** 이 줄에서 모집하는 인원 */
  requiredCount: number;
  participation: PostingParticipation;
  /**
   * 이 줄이 여는 날. **비우면 포지션 발주가 있는 모든 날**이다.
   *
   * 급구 줄은 여기에 모자란 날만 담는다. 전일 줄에는 두지 않는다 —
   * 사흘 중 이틀만 '전일'로 여는 것은 말이 되지 않는다.
   */
  dates?: string[];
  /** 노쇼 · 급구로 연 줄. 포털 목록에서 눈에 띄게 세운다. */
  isUrgent: boolean;
}

/** 폼이 보내는 줄. 새로 추가한 줄에는 아직 번호가 없다. */
export type PostingTargetInput = Omit<PostingTarget, "targetId"> & {
  targetId?: number;
};

/** 응답의 모집 줄. 포지션 값은 응답 때 행사 포지션에서 채운다. (저장하지 않는다) */
export interface PostingLine extends PostingTarget {
  name: string;
  jobRole: JobRole;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  breakMinutes: number;
  wageType: WageType;
  wage: number;
  genderPreference: GenderPreference;
  requiresHealthCert: boolean;
  /** 이 줄이 실제로 여는 날. (`resolveTargetDates`의 결과) */
  workDates: string[];
  applicantCount: number;
  confirmedCount: number;
}

export interface JobPosting {
  postingId: number;
  eventId: number;
  eventTitle: string;
  clientName: string;
  title: string;
  lines: PostingLine[];
  /** 모든 줄의 모집 인원 합계 */
  requiredCount: number;
  applicantCount: number;
  /** 지원자 중 확정된 인원 */
  confirmedCount: number;
  /** 대표 근무일 = 첫날. 목록 정렬에 쓴다. */
  workDate: string;
  /**
   * 근무일 전체.
   *
   * 예전에는 첫날 하나만 들고 있었다. 담당자가 공고문을 손으로 붙여넣던 동안에는
   * 문구 안에 날짜가 적혀 있어 문제가 없었지만, **본인이 화면에서 직접 보고
   * 지원하게 되면** 하루짜리 공고로 읽힌다. 3일 행사에 하루인 줄 알고 지원한 사람이
   * 이틀째에 나오지 않는 일은 이 한 칸이 없어서 생긴다.
   */
  workDates: string[];
  venue: string;
  status: PostingStatus;
  /** 오픈카톡방에 그대로 붙여넣을 공고문 */
  content: string;
  publishedAt?: string;
  closedAt?: string;
  createdAt: string;
}

export type ApplicationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELED";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDING: "검토대기",
  ACCEPTED: "확정",
  REJECTED: "반려",
  CANCELED: "지원취소",
};

/**
 * 아직 살아 있는 지원.
 *
 * 한 사람이 한 행사의 **여러 줄에 낼 수 있다.** 확정되는 순간 같은 날에
 * 걸린 나머지 지원은 **지워진다** — 사람 × 날짜는 배치 한 건이라 둘 다 확정될 수
 * 없고, 그 정리를 담당자 손에 맡기면 반드시 하나가 남는다.
 * '지원취소'로 남기지 않는 이유는 본인이 무른 것과 구분되지 않기 때문이다.
 */
export const ACTIVE_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "PENDING",
  "ACCEPTED",
];

export interface Application {
  applicationId: number;
  postingId: number;
  postingTitle: string;
  eventId: number;
  eventTitle: string;
  /** 대표 근무일 = 신청한 첫날 */
  workDate: string;
  /** 지원한 모집 줄. */
  targetId: number;
  /** 줄이 가리키는 포지션. 확정하면 이 포지션으로 배치된다. */
  positionId: number;
  positionName: string;
  role: JobRole;
  /** 지원할 때 줄의 참여 방식. 줄이 나중에 바뀌어도 이 지원은 이 방식으로 읽는다. */
  participation: PostingParticipation;
  /**
   * 나오겠다고 한 날.
   *
   * 전일 줄이면 지원 순간의 줄 날짜 전부, 분할 줄이면 본인이 고른 날이다.
   * 지원 뒤 줄이 바뀌어도 **본인이 약속한 날은 이것**이라 저장해 둔다.
   */
  requestedDates: string[];
  /**
   * 확정한 날. 담당자는 신청한 날 중 **일부만** 확정할 수 있다.
   * (사흘 신청했지만 둘째 날은 이미 찼다) 확정 전에는 비어 있다.
   */
  confirmedDates?: string[];
  /** 기존 인력이면 인력 ID가 붙는다. 신규 지원자는 값이 없다. */
  staffId?: number;
  applicantName: string;
  phoneNumber: string;
  /** 인력풀에 이미 있는 사람인지. 신규면 서류부터 받아야 한다. */
  isExistingStaff: boolean;
  status: ApplicationStatus;
  /** 지원자가 남긴 메모 (경력, 가능 시간 등) */
  note: string;
  /** 같은 날 이미 확정된 행사가 있으면 채워진다. */
  conflictEventTitle?: string;
  appliedAt: string;
  processedAt?: string;
}

export interface PostingFormValues {
  eventId: number;
  title: string;
  lines: PostingTargetInput[];
  content: string;
}

/* ------------------------------------------------------------------ */
/* 계산                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 모집 줄이 여는 날.
 *
 * 포지션 발주가 있는 날 ∩ 줄이 지정한 날. 발주를 0으로 내린 날은 줄에 적혀 있어도
 * 빠진다 — 설 자리가 없는 날에 지원을 받으면 확정할 곳이 없다.
 * `today`를 넘기면 지난 날도 뺀다(지원 · 확정 쪽). 관리자 표시는 넘기지 않는다.
 */
export const resolveTargetDates = (
  target: Pick<PostingTarget, "dates">,
  positionDates: readonly string[],
  today?: string,
): string[] => {
  const picked = target.dates
    ? positionDates.filter((date) => target.dates!.includes(date))
    : [...positionDates];

  return today ? picked.filter((date) => date >= today) : picked;
};

/** 행사에서 바로 줄의 날짜를 구한다. */
export const resolveLineDates = (
  event: { days: readonly EventDayPlan[] },
  target: Pick<PostingTarget, "positionId" | "dates">,
  today?: string,
): string[] =>
  resolveTargetDates(
    target,
    resolvePositionWorkDates(event, target.positionId),
    today,
  );

/** 지원이 가리키는 날. 확정되면 확정한 날, 그 전에는 신청한 날이다. */
export const applicationDates = (
  application: Pick<Application, "requestedDates" | "confirmedDates">,
): string[] => application.confirmedDates ?? application.requestedDates;

/**
 * 지원이 가리키는 날을 한 마디로. 관리자 지원 목록과 포털 신청 카드가 같은 말을 쓴다.
 *
 * 일부만 확정됐으면 **그 사실을 먼저 적는다.** "09.12 · 09.13"만 보여 주면 본인은
 * 신청한 사흘이 다 잡힌 줄 알고 빠진 하루에 현장에 나온다.
 */
export const describeApplicationDates = (
  application: Pick<Application, "participation" | "requestedDates" | "confirmedDates">,
): string => {
  const requested = application.requestedDates;
  const confirmed = application.confirmedDates;

  if (confirmed && confirmed.length !== requested.length) {
    return `${requested.length}일 신청 · ${confirmed.length}일 확정`;
  }

  if (requested.length === 0) return "-";
  if (requested.length === 1) return formatShortDate(requested[0]);

  return application.participation === "FULL"
    ? `전일 ${requested.length}일`
    : formatDateList(requested);
};

/** `09.12 · 09.13` */
export const formatDateList = (dates: readonly string[]): string =>
  dates.map((date) => formatShortDate(date)).join(" · ");

/**
 * 줄이 여는 날을 한 마디로. 목록 칸 · 공고 제목 · 공고문이 같은 말을 쓴다.
 *
 * - 하루짜리: `09.12`
 * - 전일: `전일 3일`
 * - 날짜를 지정한 분할 줄: `09.12 · 09.13`
 * - 전 기간 분할 줄: `3일 중 선택`
 */
export const describeLineSchedule = (
  line: Pick<PostingTarget, "participation" | "dates">,
  workDates: readonly string[],
): string => {
  if (workDates.length === 0) return "발주 없음";
  if (workDates.length === 1) return formatShortDate(workDates[0]);
  if (line.participation === "FULL") return `전일 ${workDates.length}일`;

  if (!line.dates) return `${workDates.length}일 중 선택`;

  /*
    지정한 날이 많으면 **첫날 외 n일**로 줄인다. 열흘짜리 행사에서 여섯 날을 늘어놓으면
    공고 제목 · 목록 칸이 표 밖으로 밀려난다. 날짜 전부는 공고 폼 · 포털 칩에서 본다.
  */
  return workDates.length <= 3
    ? formatDateList(workDates)
    : `${formatShortDate(workDates[0])} 외 ${workDates.length - 1}일`;
};

/**
 * 공고 제목 · 공고문의 줄 한 마디. `A타임 전일 2명` · `[급구] A타임 09.13 1명`
 *
 * 하루짜리 행사는 날짜를 붙이지 않는다. 행사 날짜가 이미 그 하루다.
 */
export const formatLineLabel = (
  line: Pick<
    PostingLine,
    "name" | "requiredCount" | "participation" | "dates" | "isUrgent" | "workDates"
  >,
  eventDayCount: number,
): string =>
  [
    line.isUrgent ? "[급구]" : "",
    line.name,
    eventDayCount > 1 ? describeLineSchedule(line, line.workDates) : "",
    `${line.requiredCount}명`,
  ]
    .filter(Boolean)
    .join(" ");

/**
 * 공고를 새로 쓸 때 깔아 둘 모집 줄.
 *
 * 날마다 모자란 수가 다르다는 것이 출발점이다. 사흘 모두 2명씩 모자라면 전일 2명이면
 * 되지만, 첫날 2 · 둘째 날 3 · 셋째 날 2가 모자라면 "전일 2명 + 둘째 날 하루 1명"이다.
 *
 * - 전일만 받는 포지션: 모든 날에 공통으로 모자란 수(최솟값)를 **전일 줄**로,
 *   그보다 더 모자란 날은 그 날들만 여는 **분할 줄**로. 전 일정 가능자로
 *   못 채우는 몫은 하루씩 뽑는 것 말고는 방법이 없다.
 * - 일자별 가능 포지션: 분할 줄 하나(인원 = 가장 많이 모자란 날). 날짜는 지원자가 고른다.
 *
 * **급구는 붙이지 않는다.** 날마다 부족이 고르지 않은 것은 발주가 원래 그런 것일 수도 있고,
 * 급한지 아닌지는 노쇼 같은 사정을 아는 담당자만 안다. 전부 급구로 깔면 급구 배지가
 * 아무것도 가리키지 않게 된다. (공고 폼에서 담당자가 직접 여는 날짜 줄은 급구로 시작한다)
 */
export const suggestPostingTargets = (event: {
  positions: readonly Pick<EventPosition, "positionId" | "scheduleRule">[];
  days: readonly EventDayPlan[];
}): Omit<PostingTarget, "targetId">[] =>
  event.positions.flatMap((position) => {
    const shortages = event.days.flatMap((day) => {
      const slot = day.roles.find(
        (item) => item.positionId === position.positionId && item.requiredCount > 0,
      );

      return slot
        ? [{ date: day.date, count: Math.max(0, slot.requiredCount - slot.assignedCount) }]
        : [];
    });

    const most = Math.max(0, ...shortages.map((item) => item.count));

    if (most === 0) return [];

    if (position.scheduleRule === "SPLIT_OK" || shortages.length === 1) {
      return [
        {
          positionId: position.positionId,
          requiredCount: most,
          participation: shortages.length === 1 ? "FULL" : "SPLIT",
          isUrgent: false,
        },
      ];
    }

    const common = Math.min(...shortages.map((item) => item.count));
    const extra = shortages.filter((item) => item.count > common);
    const lines: Omit<PostingTarget, "targetId">[] = [];

    if (common > 0) {
      lines.push({
        positionId: position.positionId,
        requiredCount: common,
        participation: "FULL",
        isUrgent: false,
      });
    }

    if (extra.length > 0) {
      lines.push({
        positionId: position.positionId,
        requiredCount: Math.max(...extra.map((item) => item.count - common)),
        participation: "SPLIT",
        dates: extra.map((item) => item.date),
        isUrgent: false,
      });
    }

    return lines;
  });
