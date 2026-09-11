import type { WageType, DayOffset, GenderPreference } from "./event";
import type { JobRole } from "./staff";

/**
 * 공고 · 지원 도메인 타입.
 *
 * 지금은 오픈카톡방에 공고를 올리고 문자로 지원을 받는다.
 * 여기서는 공고문을 시스템이 만들어 주고(복사해서 붙여넣기), 지원자는 목록으로 관리한다.
 * 앱이 붙으면 지원 등록만 자동화되고 이후 흐름은 그대로 쓸 수 있다.
 *
 * ## 공고 하나 = 행사 하나
 *
 * 예전에는 행사 × 직무마다 공고가 따로 나갔다. 한 행사에서 팀장 · 스태프 · 설치가
 * 모자라면 공고가 세 장이었고, 지원하는 사람 눈에는 **같은 행사가 세 번** 보였다.
 * 지금은 공고가 행사 하나를 덮고, 그 안에서 **포지션별로** 모집한다.
 * 지원자는 공고를 열어 자기가 설 포지션 하나를 골라 지원한다.
 */

export type PostingStatus = "DRAFT" | "OPEN" | "CLOSED" | "FILLED";

export const POSTING_STATUS_LABEL: Record<PostingStatus, string> = {
  DRAFT: "작성중",
  OPEN: "모집중",
  CLOSED: "마감",
  FILLED: "충원완료",
};

/**
 * 공고 안의 모집 포지션 한 건.
 *
 * 이름 · 시각 · 금액은 **행사 포지션을 그대로 가리킨다.** 공고에 사본을 두면
 * 행사에서 단가를 고쳤을 때 공고만 옛 금액으로 남는다. 응답을 만들 때 채운다.
 */
export interface PostingPosition {
  positionId: number;
  /** 아래는 응답 때 행사 포지션에서 채운다. (저장하지 않는다) */
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
  /** 이 포지션에서 모집하는 인원 (공고가 갖는 값) */
  requiredCount: number;
  applicantCount: number;
  confirmedCount: number;
}

/** 저장되는 모집 포지션. 공고가 직접 갖는 값은 이것뿐이다. */
export interface PostingPositionTarget {
  positionId: number;
  requiredCount: number;
}

export interface JobPosting {
  postingId: number;
  eventId: number;
  eventTitle: string;
  clientName: string;
  title: string;
  positions: PostingPosition[];
  /** 모든 포지션의 모집 인원 합계 */
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
 * 한 사람이 한 행사의 **여러 포지션에 낼 수 있다.** 확정되는 순간 같은 날에
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
  /** 대표 근무일 = 그 포지션의 첫 근무일 */
  workDate: string;
  /** 지원한 포지션. 확정하면 이 포지션으로 배치된다. */
  positionId: number;
  positionName: string;
  role: JobRole;
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
  positions: PostingPositionTarget[];
  content: string;
}
