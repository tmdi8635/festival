import type { WageType, DayOffset } from "./event";
import type { JobRole } from "./staff";

/**
 * 공고 · 지원 도메인 타입.
 *
 * 지금은 오픈카톡방에 공고를 올리고 문자로 지원을 받는다.
 * 여기서는 공고문을 시스템이 만들어 주고(복사해서 붙여넣기), 지원자는 목록으로 관리한다.
 * 앱이 붙으면 지원 등록만 자동화되고 이후 흐름은 그대로 쓸 수 있다.
 */

export type PostingStatus = "DRAFT" | "OPEN" | "CLOSED" | "FILLED";

export const POSTING_STATUS_LABEL: Record<PostingStatus, string> = {
  DRAFT: "작성중",
  OPEN: "모집중",
  CLOSED: "마감",
  FILLED: "충원완료",
};

export interface JobPosting {
  postingId: number;
  eventId: number;
  eventTitle: string;
  clientName: string;
  title: string;
  role: JobRole;
  requiredCount: number;
  applicantCount: number;
  /** 지원자 중 확정된 인원 */
  confirmedCount: number;
  /** 공고에 적는 지급 기준 (시급 · 일급) */
  wageType: WageType;
  /** 공고에 적는 금액. 시급이면 시간당, 일급이면 하루치다. */
  wage: number;
  /** 대표 근무일 = 첫날. 목록 정렬과 중복 지원 판정에 쓴다. */
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
  startTime: string;
  endTime: string;
  /** 종료가 며칠 뒤인지. 새벽에 끝나는 현장을 그냥 적으면 지원자가 오해한다. */
  endDayOffset: DayOffset;
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

export interface Application {
  applicationId: number;
  postingId: number;
  postingTitle: string;
  eventId: number;
  eventTitle: string;
  workDate: string;
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
  role: JobRole;
  requiredCount: number;
  wageType: WageType;
  wage: number;
  content: string;
}
