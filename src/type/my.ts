import type { DayOffset, GenderPreference, WageType } from "./event";
import type {
  AttendanceStatus,
  DocumentReviewState,
  Gender,
  HealthCertState,
  JobRole,
  StaffDocumentReviews,
  StaffStatus,
} from "./staff";
import type { EmploymentType } from "./employee";
import type { ApplicationStatus } from "./recruit";
import type {
  AmendReasonType,
  ContractRevisionRequest,
  ContractStatus,
} from "./contract";
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

  /* ------------------------------ 보건증 ------------------------------ */

  healthCertImageUrl: string;
  healthCertIssuedAt?: string;
  /** 만료일. 발급일에서 구한 값이다 (`healthCertExpiresAt`) */
  healthCertExpiresAt?: string;
  healthCertState: HealthCertState;

  /* ------------------------------ 지표 ------------------------------ */

  workCount: number;
  totalWorkHours: number;
  /**
   * 평판 점수. **본인에게는 이 숫자 하나만 내린다.**
   *
   * 누가 · 어느 날 · 무슨 항목으로 평가했는지를 본인이 보게 되면, 현장에서
   * 평가를 남긴 팀장과 평가를 받은 사람이 다음 현장에서 서로 불편해진다.
   * 그러면 팀장은 솔직하게 남기지 않고, 쌓인 평가는 아무것도 말해 주지 않게 된다.
   * 건수(좋아요 · 별로예요)도 담지 않는다 — 날짜별 근무와 맞춰 보면 어느 날의
   * 평가였는지 거꾸로 읽힌다.
   */
  reputationScore: number;
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
 * 본인이 내는 보건증. **필수 서류와 따로 낸다.**
 *
 * 한 폼에 묶으면 보건증이 없는 사람은 신분증 · 계좌를 고칠 때마다
 * 비어 있는 보건증 칸에 걸려 저장을 못 한다.
 */
export interface MyHealthCertFormValues {
  healthCertImageUrl: string;
  /** 발급일. 만료(1년)를 여기서 센다 */
  healthCertIssuedAt: string;
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
  /** 선 포지션. 아래 시각은 행사가 아니라 **이 포지션의** 시각이다 */
  positionId: number;
  positionName: string;
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

  /*
    그날 받은 평가는 **내리지 않는다.** (`MyProfile.reputationScore` 주석)
    근무 한 건에 평가를 붙여 내리면, 화면에 안 그려도 응답을 열어 보는 순간
    어느 현장에서 누구에게 별로예요를 받았는지가 드러난다.
  */
  isContractSigned: boolean;

  /** 업체가 적은 현장 안내 (`EventDetail.description`). 집합 장소와 섞지 않는다 */
  description: string;

  /** 지금 어디까지 왔나. 확정 → 근무 → 정산 → 지급 (`MyWorkStage`) */
  stage: MyWorkStage;

  /* ------------------------------ 본인 취소 ------------------------------ */

  /** 지금 본인이 취소할 수 있는가. 시작 전이고 출근을 안 찍었을 때만이다 */
  canCancel: boolean;
  /** 불이익 없이 취소할 수 있는 마지막 시각 (ISO). 근무 시작 24시간 전 */
  cancelDeadline: string;
  /** 지금 취소하면 노쇼로 남는가 (`resolveStaffCancelPolicy`) */
  isLateCancel: boolean;
  /** 본인이 취소한 시각 · 사유. 취소했으면 기록으로 남아 종료 탭에 선다 */
  staffCanceledAt?: string;
  staffCancelReason?: string;
}

/**
 * 내 근무가 지금 어디까지 왔나.
 *
 * 행사 상태(`EventStatus`)를 그대로 보여 주지 않는다. '배치완료' · '진행중'은
 * 담당자의 말이고, 본인이 궁금한 것은 "나 확정됐나, 돈은 언제 들어오나"다.
 * 그래서 **배치 + 근태 + 정산 건**을 합쳐 본인 기준의 단계로 바꿔 내린다.
 */
export type MyWorkStage =
  | "CONFIRMED"
  | "WORKING"
  | "WORKED"
  | "SETTLEMENT"
  | "HOLD"
  | "APPROVED"
  | "PAID"
  | "CANCELED"
  | "NO_SHOW"
  | "ABSENT";

export const MY_WORK_STAGE_LABEL: Record<MyWorkStage, string> = {
  CONFIRMED: "근무 확정",
  WORKING: "근무 중",
  WORKED: "근무 완료",
  SETTLEMENT: "정산대기",
  HOLD: "지급보류",
  APPROVED: "지급승인",
  PAID: "지급완료",
  CANCELED: "취소",
  NO_SHOW: "노쇼",
  ABSENT: "결근",
};

/** 진행 표시의 네 칸. 단계가 몇 번째 칸에 서는지를 여기서 정한다 */
export const MY_WORK_STEPS = ["확정", "근무", "정산", "지급"] as const;

/** 진행 표시에서 몇 칸째까지 찼나. 취소 · 노쇼는 진행 표시를 그리지 않는다(-1) */
export const resolveMyWorkStep = (stage: MyWorkStage): number => {
  switch (stage) {
    case "CONFIRMED":
      return 0;
    case "WORKING":
    case "WORKED":
      return 1;
    case "SETTLEMENT":
    case "HOLD":
    case "APPROVED":
      return 2;
    case "PAID":
      return 3;
    default:
      return -1;
  }
};

/** 끝난 근무인가. 취소 · 노쇼는 날짜가 남아 있어도 더는 할 일이 없다 */
export const isClosedWork = (work: Pick<MyWork, "stage">): boolean =>
  work.stage === "CANCELED" ||
  work.stage === "NO_SHOW" ||
  work.stage === "ABSENT";

/**
 * 포털에서 보는 공고 한 건.
 *
 * **모집 인원을 담지 않는다.** 관리자 쪽 공고 제목은
 * `브랜드 팝업스토어 운영 · 팀장 1명`처럼 부족한 자리 수가 붙어 있는데,
 * 그건 담당자가 무엇을 채워야 하는지 보려고 붙인 내부 표기다.
 * 지원하는 사람에게 "몇 자리 남았나"가 보이면 눈치 게임이 되고,
 * 거래처에는 우리가 인력을 얼마나 못 채웠는지가 그대로 드러난다.
 * 그래서 제목은 **행사 이름**을 쓰고 인원은 응답에 아예 담지 않는다.
 */
export interface MyPosting {
  postingId: number;
  eventId: number;
  /** 행사 이름. 관리자 공고 제목(`posting.title`)이 아니다 */
  title: string;
  clientName: string;
  /** 근무일 전체. 다일 행사를 하루로 보여 주면 지원한 사람이 속는다 */
  workDates: string[];
  venue: string;
  address: string;
  meetingPoint: string;
  /**
   * 업체가 자유롭게 적는 현장 안내. (`EventDetail.description`)
   *
   * 집합 · 복장 · 준비물처럼 칸이 정해진 것 말고, 그 현장에만 해당하는 말이
   * 늘 있다. 칸을 안 만들어 두면 담당자는 그 말을 집합 장소 칸에 이어 붙이고,
   * 지원자는 "집합 장소"라는 라벨 아래에서 다른 이야기를 읽게 된다.
   */
  description: string;
  dressCode: string;
  belongings: string;
  /** 모집 중인 포지션. 지원은 이 중 하나를 골라서 한다 */
  positions: MyPostingPosition[];
  /** 포지션 중 하나라도 보건증이 필요한가. 목록 필터 · 배지에 쓴다 */
  requiresHealthCert: boolean;

  /* ------------------------- 로그인한 사람만 ------------------------- */

  /**
   * 아래는 **누가 보고 있는지 알 때만** 채워진다.
   *
   * 공고는 로그인하지 않아도 볼 수 있다. 우리를 처음 보는 사람이
   * 회원가입부터 해야 어떤 일이 있는지 알 수 있게 두면, 그 사람은 그냥 나간다.
   */
  /** 이 공고의 포지션 중 하나라도 지원했는가 */
  isApplied: boolean;
  /**
   * 카드에 세우는 대표 상태. 확정이 하나라도 있으면 확정이다.
   *
   * 지원 자체는 **포지션마다** 따로 있다(`MyPostingPosition.myApplication*`).
   * 목록 카드에는 한 줄만 설 수 있어서 가장 앞선 상태를 대표로 쓴다.
   */
  applicationStatus?: ApplicationStatus;
  /** 같은 날 이미 확정된 행사가 있으면 그 이름 */
  conflictEventTitle?: string;
}

/**
 * 공고 안의 포지션 한 건. **모집 인원은 여기에도 없다.** (`MyPosting` 주석)
 */
export interface MyPostingPosition {
  positionId: number;
  name: string;
  jobRole: JobRole;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  breakMinutes: number;
  /**
   * 이 자리가 **실제로 서는 날.**
   *
   * 행사의 근무일과 같지 않을 수 있다. 설치/철거는 첫날과 마지막 날에만 발주가
   * 있고, 야간 자리가 주말에만 열리는 일도 흔하다. 행사 근무일만 보여 주면
   * 사흘짜리인 줄 알고 지원한 사람이 이틀만 배치되고, 남은 하루에 잡아 둔
   * 다른 일을 이미 거절한 뒤다.
   */
  workDates: string[];
  /** 하루 실근무 시간 (휴게 제외) */
  workHours: number;
  wageType: WageType;
  wage: number;
  /** 하루치 예상 지급액 (세전) */
  dailyPay: number;
  /**
   * 이 자리를 끝까지 섰을 때의 예상 지급액 (세전).
   *
   * 열흘짜리 행사에 하루치만 적어 두면 무엇에 지원하는지 가늠할 수 없다.
   * 야간수당 · 공제는 빠진 어림값이라 화면에서 '예상'이라고 밝힌다.
   */
  totalPay: number;
  genderPreference: GenderPreference;
  requiresHealthCert: boolean;
  /**
   * 내 조건(**직무 · 성별 · 보건증**)에 맞는 자리인가. 비회원에게는 늘 `true`다.
   *
   * `canApply`와 다르다. 이쪽은 그 사람의 조건이라 오늘 바뀌지 않고,
   * 저쪽에는 날짜 겹침처럼 오늘만 막히는 것이 섞여 있다.
   * 목록의 '내가 할 수 있는 직무만'이 보는 것은 이 값이다.
   */
  matchesMe: boolean;
  /**
   * 이 자리에 낸 내 지원. **자리마다 따로 있다.**
   *
   * 한 행사의 여러 자리에 걸어 둘 수 있어서, 어느 자리가 검토 중이고 어느 자리가
   * 확정됐는지는 자리 옆에 붙어 있어야 한다. 취소도 이 번호로 한다.
   */
  myApplicationId?: number;
  myApplicationStatus?: ApplicationStatus;
  /** 이 포지션에 지금 지원할 수 있는가. 서버가 판단한 결과다 */
  canApply: boolean;
  /**
   * 못 하는 이유 한 줄. 버튼만 잠가 두면 고장인 줄 안다.
   * (`로그인 후 지원할 수 있어요` · `보건증이 필요해요` · `여성만 모집해요`)
   */
  blockReason?: string;
}

/**
 * 내가 낸 지원 한 건.
 *
 * 일정 화면의 '신청' 탭에 선다. 확정된 근무(`MyWork`)와 나란히 놓이므로
 * **카드에 필요한 만큼은 여기서 함께 내린다.** 날짜와 장소를 보려고
 * 공고를 한 번 더 부르게 두면, 목록을 여는 것만으로 조회가 열 번 나간다.
 */
export interface MyApplication {
  applicationId: number;
  postingId: number;
  postingTitle: string;
  eventId: number;
  eventTitle: string;
  clientName: string;
  role: JobRole;
  positionId: number;
  positionName: string;
  workDate: string;
  /** 근무일 전체. 카드에 "09.12 외 2일"로 줄여 쓴다 */
  workDates: string[];
  venue: string;
  address: string;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  breakMinutes: number;
  /*
    조건은 **근무 카드와 같은 만큼** 내린다. 확정되기 전이라고 시급 · 복장 · 준비물을
    빼 두면, 무엇에 지원했는지 확인하려고 매번 상세를 다시 열게 된다.
  */
  wageType: WageType;
  wage: number;
  /** 하루치 예상 지급액 (세전) */
  dailyPay: number;
  /** 이 자리를 끝까지 섰을 때의 예상 지급액 (세전) */
  totalPay: number;
  meetingPoint: string;
  description: string;
  dressCode: string;
  belongings: string;
  managerName: string;
  managerPhone: string;
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
  /** 이 계약이 덮는 포지션 이름들. 날마다 다를 수 있다 (1일차 A타임 · 2일차 B타임) */
  positionNames: string[];
  workDates: string[];
  totalWage: number;
  status: ContractStatus;
  revision: number;
  sentAt?: string;
  signedAt?: string;
  rejectedReason?: string;
  /** 이 차수에 대해 본인이 보낸 수정요청 전부. 가장 최근이 마지막이다 */
  revisionRequests: ContractRevisionRequest[];
  /** 재작성 · 재발급 사유. 2차부터 채워진다 */
  amendReason?: string;
  amendReasonType?: AmendReasonType;
  /** 전자서명이 아니라 종이로 받은 건인지. 본인 화면에서는 서명 버튼이 뜨지 않는다 */
  isPaperSigned: boolean;
}

/**
 * 같은 행사 계약서의 차수 이력 한 줄.
 *
 * 수정요청을 보내고 재발급을 받으면 문서가 두 장이 된다. 지금 문서만 보여 주면
 * "내가 뭘 고쳐 달라고 했고 그게 반영됐나"를 본인이 확인할 방법이 없다.
 */
export interface MyContractHistoryItem {
  contractId: number;
  revision: number;
  status: ContractStatus;
  totalWage: number;
  sentAt?: string;
  signedAt?: string;
  amendReason?: string;
  amendReasonType?: AmendReasonType;
  revisionRequests: ContractRevisionRequest[];
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

/*
  받은 평가 목록(`MyReputation`)은 없앴다.

  처음에는 "무엇 때문에 그런 평가를 받았는지 알아야 고칠 수 있다"며 항목까지 열었는데,
  실제로는 누가 어느 현장에서 별로예요를 눌렀는지를 본인이 짐작하게 되고,
  다음 현장에서 평가한 팀장과 평가받은 사람이 서로 불편해졌다.
  본인에게는 **점수 하나만** 내린다. (`MyProfile.reputationScore`)
*/

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
  | "HEALTH_CERT"
  | "CONTRACT_SIGN"
  | "CONTRACT_REJECTED"
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
