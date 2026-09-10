import type { DayOffset, WageType } from "./event";
import type {
  AttendanceStatus,
  DocumentReviewState,
  Gender,
  JobRole,
  ReputationVerdict,
  StaffDocumentReviews,
  StaffStatus,
} from "./staff";
import type { EmploymentType } from "./employee";
import type { ApplicationStatus, PostingStatus } from "./recruit";
import type { ContractStatus } from "./contract";
import type { PayrollStatus } from "./payroll";

/**
 * 스태프 포털(`/my`)이 주고받는 자료.
 *
 * 관리자 쪽 타입을 그대로 쓰지 않는다. `StaffDetail`에는 메모 · 블랙리스트 사유 ·
 * 누적 지급액처럼 **본인이 볼 이유가 없거나 봐서는 안 되는 값**이 함께 있고,
 * 그것을 화면에서 걸러 내는 방식은 언젠가 반드시 빠뜨린다.
 * 응답에 아예 담지 않는 편이 안전하다. (`docs/DEVELOPMENT_GUIDE.md` 13-5장)
 */
export interface MyProfile {
  staffId: number;
  name: string;
  phoneNumber: string;
  profileImageUrl: string;
  birthDate: string;
  gender: Gender;
  status: StaffStatus;
  employment: EmploymentType;
  roles: JobRole[];
  region: string;
  district: string;
  address: string;
  emergencyContact: string;
  height?: number;
  clothingSize?: string;

  /* --------------------------- 서류 · 계좌 --------------------------- */

  bankName: string;
  accountNumber: string;
  accountHolder: string;
  idCardImageUrl: string;
  bankBookImageUrl: string;
  /** 갈래별 심사 기록. 반려 사유가 여기 들어 있다 */
  reviews: StaffDocumentReviews;
  documentReviewState: DocumentReviewState;

  /* ------------------------------ 지표 ------------------------------ */

  workCount: number;
  totalWorkHours: number;
  reputationScore: number;
  goodCount: number;
  badCount: number;
  lastWorkedAt?: string;
  createdAt: string;
}

/**
 * 본인이 고칠 수 있는 인적사항.
 *
 * **승인을 거치지 않고 곧바로 반영된다.** 이름 한 글자를 고치는 데도 담당자를
 * 기다려야 하면 아무도 고치지 않고, 결국 틀린 채로 남는다.
 * 돈이 나가는 근거(서류 · 계좌)만 심사를 받는다. (`MyDocumentFormValues`)
 *
 * `roles`는 **본인이 하겠다는 신고**이지 약속이 아니다. 실제로 그 자리에 세울지는
 * 배치할 때 담당자가 정하므로, 스스로 적게 두어도 잃는 것이 없다.
 */
export interface MyProfileFormValues {
  name: string;
  phoneNumber: string;
  profileImageUrl: string;
  birthDate: string;
  gender: Gender;
  roles: JobRole[];
  region: string;
  district: string;
  address: string;
  emergencyContact: string;
  height?: number;
  clothingSize?: string;
}

/** 본인이 내는 서류 · 계좌. 내면 그 갈래가 다시 승인 대기가 된다. */
export interface MyDocumentFormValues {
  idCardImageUrl: string;
  bankBookImageUrl: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

/**
 * 내 근무 한 건.
 *
 * 배치(사람 × 날짜)에 **행사 정보를 합쳐 내린다.** 배치만 받으면 몇 시에 어디로
 * 가야 하는지 알 수 없어, 화면이 행사를 한 번 더 부르게 된다.
 * 현장에 서 있는 사람에게 필요한 것은 목록이 아니라 이 한 장이다.
 */
export interface MyWork {
  assignmentId: number;
  eventId: number;
  eventTitle: string;
  clientName: string;
  workDate: string;
  role: JobRole;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  breakMinutes: number;
  venue: string;
  address: string;
  /** 집합 장소 · 복장 · 준비물. 비어 있으면 화면에서 칸 자체를 감춘다 */
  meetingPoint: string;
  dressCode: string;
  belongings: string;
  managerName: string;
  managerPhone: string;

  wageType: WageType;
  wage: number;
  /** 그날 받을(받은) 금액. `calculateBasePay`가 낸 값이다 */
  payAmount: number;
  workHours: number;

  attendance: AttendanceStatus;
  checkInAt?: string;
  checkOutAt?: string;
  /** 몇 분 늦었나. **저장값이 아니라 출근 시각에서 그때그때 구한 값**이다 */
  lateMinutes: number;

  /* ---------------------------- 출퇴근 체크 ---------------------------- */

  /** 지금 출근을 찍을 수 있는지. 시간 창과 이미 찍었는지를 함께 본 결과다 */
  canCheckIn: boolean;
  /** 지금 퇴근을 찍을 수 있는지. 출근을 먼저 찍어야 열린다 */
  canCheckOut: boolean;
  /**
   * 못 찍는 이유 한 줄.
   *
   * 버튼만 잠가 두면 본인은 고장인 줄 알고 담당자에게 전화한다.
   * 왜 잠겼는지가 버튼 옆에 적혀 있어야 기다릴 수 있다.
   */
  checkBlockReason?: string;
  /** 현장 좌표. 없으면 위치를 확인하지 않는다 */
  venueLatitude?: number;
  venueLongitude?: number;

  /** 받은 평가. 없으면 아직 평가 전이다 */
  reputationVerdict?: ReputationVerdict;
  isContractSigned: boolean;
}

/** 포털에서 보는 공고 한 건 */
export interface MyPosting {
  postingId: number;
  eventId: number;
  title: string;
  clientName: string;
  role: JobRole;
  requiredCount: number;
  confirmedCount: number;
  status: PostingStatus;
  /** 근무일 전체. 다일 행사를 하루로 보여 주면 지원한 사람이 속는다 */
  workDates: string[];
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  venue: string;
  address: string;
  meetingPoint: string;
  dressCode: string;
  belongings: string;
  wageType: WageType;
  wage: number;
  /** 하루치 예상 지급액 (세전) */
  dailyPay: number;
  /** 내가 이미 지원했는가. 지원 버튼을 가른다 */
  isApplied: boolean;
  /** 같은 날 이미 확정된 행사가 있으면 그 이름 */
  conflictEventTitle?: string;
}

/** 내가 낸 지원 한 건 */
export interface MyApplication {
  applicationId: number;
  postingId: number;
  postingTitle: string;
  eventId: number;
  eventTitle: string;
  clientName: string;
  role: JobRole;
  workDate: string;
  status: ApplicationStatus;
  appliedAt: string;
  processedAt?: string;
}

/** 내 계약서 한 건. 문서 본문은 별도 조회로 받는다 */
export interface MyContract {
  contractId: number;
  contractNumber: string;
  eventId: number;
  eventTitle: string;
  clientName: string;
  role: JobRole;
  workDates: string[];
  totalWage: number;
  status: ContractStatus;
  revision: number;
  sentAt?: string;
  signedAt?: string;
  rejectedReason?: string;
  /** 전자서명이 아니라 종이로 받은 건인지. 본인 화면에서는 서명 버튼이 뜨지 않는다 */
  isPaperSigned: boolean;
}

/** 내 정산 한 건 (행사 × 사람) */
export interface MyPayroll {
  payrollId: number;
  eventId: number;
  eventTitle: string;
  clientName: string;
  role: JobRole;
  workDates: string[];
  totalWorkHours: number;
  basePay: number;
  overtimePay: number;
  nightPay: number;
  allowance: number;
  deduction: number;
  grossPay: number;
  withholdingTax: number;
  netPay: number;
  status: PayrollStatus;
  holdReason?: string;
  paidAt?: string;
  /**
   * 입금 계좌. **뒤 4자리만 내린다.**
   *
   * 본인 계좌라도 전부 내릴 이유가 없다. 어느 계좌로 들어오는지 확인하는 데는
   * 뒤 4자리면 충분하고, 화면이 캡처되어 돌아다니는 일은 실제로 일어난다.
   */
  accountTail: string;
  bankName: string;
}

/**
 * 내가 받은 평가 한 건.
 *
 * **항목(태그)은 보여 주고 메모는 보여 주지 않는다.**
 * 무엇 때문에 그런 평가를 받았는지 모르면 고칠 수가 없어서 항목은 열어야 하지만,
 * 메모는 담당자끼리 남기는 내부 기록이라 본인에게 그대로 가면 문장을 고르느라
 * 아무도 솔직하게 적지 않게 된다. 그러면 기록 자체가 쓸모를 잃는다.
 */
export interface MyReputation {
  assignmentId: number;
  eventId: number;
  eventTitle: string;
  clientName: string;
  workDate: string;
  role: JobRole;
  verdict: ReputationVerdict;
  tags: string[];
  points: number;
  ratedAt?: string;
}

export interface MyReputationSummary {
  items: MyReputation[];
  reputationScore: number;
  goodCount: number;
  badCount: number;
  /** 어떤 항목을 몇 번 받았는지. 점수가 왜 그 값인지 설명하는 근거다 */
  tagCounts: { tag: string; verdict: ReputationVerdict; count: number }[];
}

/** 포털 홈에서 한 번에 받는 요약 */
export interface MySummary {
  /** 다음 근무. 없으면 예정된 일이 없다 */
  nextWork?: MyWork;
  /** 이번 달 근무 일수 · 예정 지급액 (세후) */
  monthWorkCount: number;
  monthNetPay: number;
  /** 지금 손이 가야 하는 일들 */
  todos: MyTodo[];
  documentReviewState: DocumentReviewState;
}

export type MyTodoType =
  | "DOCUMENT_REJECTED"
  | "DOCUMENT_MISSING"
  | "DOCUMENT_WAITING"
  | "CONTRACT_SIGN"
  | "APPLICATION_RESULT";

/**
 * 포털 홈의 할 일 한 줄.
 *
 * **본인이 지금 할 수 있는 일만 담는다.** 승인 대기처럼 기다릴 수밖에 없는 것도
 * 함께 보여 주되(`tone: "info"`), 누르면 아무 일도 없는 줄을 만들지 않는다.
 */
export interface MyTodo {
  type: MyTodoType;
  title: string;
  description: string;
  href: string;
  tone: "danger" | "warning" | "info";
}
