import type { DayOffset } from "./event";

/** 대시보드 도메인 타입. */

/** 지금 사람이 손을 대야 하는 일 한 건 */
export interface ActionItem {
  actionId: number;
  type:
    | "UNDERSTAFFED"
    | "CHECK_TIME_MISSING"
    | "CONTRACT_MISSING"
    | "DOCUMENT_MISSING"
    | "PAYROLL_PENDING"
    | "APPLICATION_PENDING";
  title: string;
  description: string;
  /** 처리 화면 경로 */
  href: string;
  /** 남은 일수. 음수면 이미 지난 건이다. */
  daysLeft?: number;
  count: number;
}

export const ACTION_TYPE_LABEL: Record<ActionItem["type"], string> = {
  UNDERSTAFFED: "인원 미충원",
  CHECK_TIME_MISSING: "출퇴근 미기록",
  CONTRACT_MISSING: "계약서 미작성",
  DOCUMENT_MISSING: "서류 미제출",
  PAYROLL_PENDING: "정산 대기",
  APPLICATION_PENDING: "지원 검토",
};

export interface DashboardMetric {
  /** 오늘 진행되는 행사 수 */
  todayEventCount: number;
  /** 이번 주 행사 수 */
  weekEventCount: number;
  /** 오늘 현장에 나가는 인원 */
  todayStaffCount: number;
  /** 아직 채우지 못한 자리 */
  openSlotCount: number;
  /** 계약서 미서명 건수 */
  unsignedContractCount: number;
  /** 서류 미제출 인력 수 */
  incompleteDocumentCount: number;
  /** 지난 근무인데 출퇴근이 안 적힌 건수. 정산 금액이 아직 잠정이라는 뜻이다. */
  missingCheckTimeCount: number;
  /** 미지급 정산 금액 */
  unpaidAmount: number;
  /** 활동 인력 수 */
  activeStaffCount: number;
}

/** 월별 매출 · 인건비 추이 한 점 */
export interface MonthlyTrendPoint {
  month: string;
  revenue: number;
  laborCost: number;
  eventCount: number;
}

/** 오늘 · 내일 행사 요약 */
export interface UpcomingEvent {
  eventId: number;
  title: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  /** 종료가 며칠 뒤인지. 새벽에 끝나는 현장을 `18:00~04:00`으로만 적으면 뜻이 통하지 않는다. */
  endDayOffset: DayOffset;
  venue: string;
  totalRequired: number;
  totalAssigned: number;
}

/** 최근 근태 이슈 */
export interface AttendanceIssue {
  assignmentId: number;
  staffId: number;
  staffName: string;
  eventTitle: string;
  workDate: string;
  type: "LATE" | "ABSENT" | "NO_SHOW";
  lateMinutes: number;
}

export interface DashboardSummary {
  metric: DashboardMetric;
  actions: ActionItem[];
  monthlyTrend: MonthlyTrendPoint[];
  upcomingEvents: UpcomingEvent[];
  attendanceIssues: AttendanceIssue[];
}
