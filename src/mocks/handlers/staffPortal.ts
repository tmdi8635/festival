import { HttpResponse, delay, http } from "msw";
import type {
  MyApplication,
  MyContract,
  MyContractHistoryItem,
  MyDocumentFormValues,
  MyHealthCertFormValues,
  MyPayroll,
  MyPosting,
  MyPostingPosition,
  MyProfile,
  MyProfileFormValues,
  MySummary,
  MyTodo,
  MyWork,
} from "@/type/my";
import type { Contract } from "@/type/contract";
import type { Application, JobPosting, PostingPosition } from "@/type/recruit";
import type { Assignment, EventDetail } from "@/type/event";
import type { StaffDetail } from "@/type/staff";
import { buildDocumentHash } from "@/type/contract";
import {
  GENDER_PREFERENCE_LABEL,
  applyCheckTimeRule,
  calculateBasePay,
  calculateDistanceMeters,
  calculateScheduledWorkHours,
  findPosition,
  matchesGenderPreference,
  resolveAssignmentSchedule,
  resolveCheckTimeWindow,
  resolveEarlyLeaveMinutes,
  resolveLateMinutes,
  resolveStaffCancelPolicy,
  resolveWorkHours,
  toCheckDateTime,
  toDateKey,
} from "@/type/event";
import { isClosedWork } from "@/type/my";
import type { CheckLocation } from "@/type/event";
import { hasValidHealthCert, healthCertExpiresAt } from "@/type/staff";
import {
  contractsByStaff,
  findContract,
  findContractTemplate,
} from "../db/contract";
import {
  events,
  findConflictEvent,
  findEvent,
  positionWorkDates,
  recalculateEventCounts,
  syncStaffReputationCounts,
} from "../db/event";
import { payrollItems, syncPayrollWithAssignment } from "../db/payroll";
import { operationSettings } from "../db/ops";
import {
  applications,
  findActiveApplications,
  findActivePositionApplication,
  findPosting,
  postings,
  recalculatePostingCounts,
} from "../db/recruit";
import {
  findStaff,
  refreshHealthCertState,
  snapshotStaffDocuments,
  staffList,
  syncStaffDocuments,
} from "../db/staff";
import { markAssignmentsSigned } from "./contract";
import { formatDateTime } from "@/lib/dayjs";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  badRequest,
  findStaffRequester,
  nextId,
  notFound,
  requireStaff,
} from "../utils";

/**
 * 스태프 포털 목업.
 *
 * 대부분은 `/my/*`이고, **공고만 `/postings`**로 따로 선다. 공고는 로그인하지
 * 않아도 볼 수 있는 자료라, `/my`(본인 것) 아래에 두면 그 규칙이 흐려진다.
 *
 * 관리자 API와 **주소부터 가른다.** `/admin/*`은 `requirePermission`이 관리자 권한 키로
 * 판정하는 곳이고, 여기는 "본인 것인가" 하나만 본다. 한 주소에 두 규칙을 얹으면
 * 언젠가 반드시 헷갈리고, 그때 새는 것은 남의 계좌와 평판이다.
 *
 * 모든 핸들러가 `requireStaff(request)`로 시작하고, **`staffId`를 쿼리에서 받지 않는다.**
 * 쿼리로 받는 순간 주소만 알면 누구나 남의 자료를 꺼낼 수 있는 문이 된다.
 */

/**
 * 응답에 담을 것만 골라 담는다. `StaffDetail`을 그대로 내리지 않는다.
 *
 * 메모(주의 메모 포함) · 블랙리스트 사유 · 누적 지급액은 본인이 볼 자료가 아니다.
 * 화면에서 걸러 내는 방식은 화면이 늘어나면 반드시 한 곳을 빠뜨린다.
 */
export const toMyProfile = (staff: StaffDetail): MyProfile => ({
  staffId: staff.staffId,
  name: staff.name,
  phoneNumber: staff.phoneNumber,
  profileImageUrl: staff.profileImageUrl,
  birthDate: staff.birthDate,
  gender: staff.gender,
  status: staff.status,
  employment: staff.employment,
  roles: staff.roles,
  region: staff.region,
  district: staff.district,
  address: staff.address,
  emergencyContact: staff.emergencyContact,
  height: staff.height,
  clothingSize: staff.clothingSize,

  bankName: staff.bankName,
  accountNumber: staff.accountNumber,
  accountHolder: staff.accountHolder,
  idCardImageUrl: staff.idCardImageUrl,
  bankBookImageUrl: staff.bankBookImageUrl,
  reviews: staff.reviews,
  documentReviewState: staff.documentReviewState,

  healthCertImageUrl: staff.healthCertImageUrl,
  healthCertIssuedAt: staff.healthCertIssuedAt,
  healthCertExpiresAt: healthCertExpiresAt(staff.healthCertIssuedAt),
  /* 만료는 날짜가 지나면 저절로 생긴다. 내리기 직전에 다시 구한다. */
  healthCertState: refreshHealthCertState(staff),

  workCount: staff.workCount,
  totalWorkHours: staff.totalWorkHours,
  /*
    평판은 **점수 하나만** 내린다. 좋아요 · 별로예요 건수도 담지 않는다.
    (`MyProfile.reputationScore` 주석 — 누가 어느 날 평가했는지 거꾸로 읽힌다)
  */
  reputationScore: staff.reputationScore,
  lastWorkedAt: staff.lastWorkedAt,
  createdAt: staff.createdAt,
});

/* ------------------------------------------------------------------ */
/* 조립기                                                               */
/* ------------------------------------------------------------------ */

/**
 * 배치 한 건을 **현장에서 필요한 한 장**으로 만든다.
 *
 * 행사 정보를 여기서 합쳐 넣는다. 배치만 내리면 화면이 행사를 한 번 더 부르게 되고,
 * 목록 스무 줄이면 조회가 스무 번 나간다. 관리자 명단이 배치에 이름 · 번호를
 * 복사해 두는 것과 같은 이유다. (`type/event.ts`의 `Assignment` 주석)
 */
const toMyWork = (event: EventDetail, assignment: Assignment): MyWork => {
  /* 시각은 행사가 아니라 **이 배치의 포지션**이 갖는다. (B타임은 21시에 시작한다) */
  const schedule = resolveAssignmentSchedule(event, assignment);
  const scheduled = {
    ...schedule,
    breakMinutes: assignment.actualBreakMinutes ?? schedule.breakMinutes,
  };

  /* 출퇴근이 찍혔으면 실제 시간, 아니면 예정 시간. 정산과 같은 함수다. */
  const { workHours } = resolveWorkHours(assignment, scheduled);

  return {
    assignmentId: assignment.assignmentId,
    eventId: event.eventId,
    eventTitle: event.title,
    clientName: event.clientName,
    workDate: assignment.workDate,
    role: assignment.role,
    positionId: assignment.positionId,
    positionName: findPosition(event, assignment.positionId)?.name ?? "",
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    endDayOffset: schedule.endDayOffset,
    breakMinutes: scheduled.breakMinutes,
    venue: event.venue,
    address: event.address,
    meetingPoint: event.meetingPoint,
    dressCode: event.dressCode,
    belongings: event.belongings,
    managerName: event.managerName,
    managerPhone: event.managerPhone,

    wageType: assignment.wageType,
    wage: assignment.wage,
    payAmount: calculateBasePay(
      assignment.wageType,
      assignment.wage,
      workHours,
    ),
    workHours,

    attendance: assignment.attendance,
    checkInAt: assignment.checkInAt,
    checkOutAt: assignment.checkOutAt,
    /*
      저장된 `lateMinutes`를 그대로 내리지 않는다.

      본인이 찍는 경로는 그 값을 0으로 두고 출근 시각에만 사실을 남긴다.
      저장값을 읽으면 새로 찍은 지각 건이 화면에서 정시로 보인다.
    */
    lateMinutes: resolveLateMinutes(
      assignment.workDate,
      schedule.startTime,
      assignment.checkInAt,
    ),

    ...resolveCheckAvailability(event, assignment),
    venueLatitude: event.latitude,
    venueLongitude: event.longitude,

    /* 그날 받은 평가(`reputationVerdict`)는 내리지 않는다. (`MyWork` 주석) */
    isContractSigned: assignment.isContractSigned,

    description: event.description,
    stage: resolveMyWorkStage(event, assignment),
    ...resolveCancelAvailability(event, assignment),
    staffCanceledAt: assignment.staffCanceledAt,
    staffCancelReason: assignment.staffCancelReason,
  };
};

/**
 * 본인 기준의 진행 단계.
 *
 * 정산 건이 있으면 **정산 상태가 이긴다.** 근무를 마친 사람이 궁금한 것은
 * 출퇴근을 찍었는지가 아니라 돈이 언제 들어오는지다.
 * 정산은 행사 × 사람 한 건이라, 그 건이 이 날을 품고 있는지로 찾는다.
 */
const resolveMyWorkStage = (
  event: EventDetail,
  assignment: Assignment,
): MyWork["stage"] => {
  if (assignment.attendance === "NO_SHOW") return "NO_SHOW";
  if (assignment.attendance === "ABSENT") return "ABSENT";
  if (assignment.status === "CANCELED") return "CANCELED";

  const payroll = payrollItems.find(
    (item) =>
      item.eventId === event.eventId &&
      item.staffId === assignment.staffId &&
      item.workDates.includes(assignment.workDate),
  );

  if (payroll) {
    if (payroll.status === "PAID") return "PAID";
    if (payroll.status === "APPROVED") return "APPROVED";
    if (payroll.status === "HOLD") return "HOLD";

    return "SETTLEMENT";
  }

  if (assignment.checkInAt && !assignment.checkOutAt) {
    return assignment.workDate < toDateKey(new Date()) ? "WORKED" : "WORKING";
  }

  if (
    assignment.checkOutAt ||
    assignment.attendance !== "PENDING" ||
    assignment.workDate < toDateKey(new Date())
  ) {
    return "WORKED";
  }

  return "CONFIRMED";
};

/**
 * 지금 본인이 취소할 수 있는지, 하면 노쇼로 남는지.
 *
 * 판정은 목록 버튼과 취소 요청이 **같은 함수**(`resolveStaffCancelPolicy`)로 한다.
 * 화면만 잠그면 버튼은 눌리는데 거절되거나, 되는데 버튼이 없는 상태가 된다.
 */
const resolveCancelAvailability = (
  event: EventDetail,
  assignment: Assignment,
): Pick<MyWork, "canCancel" | "cancelDeadline" | "isLateCancel"> => {
  const policy = resolveStaffCancelPolicy(
    assignment.workDate,
    resolveAssignmentSchedule(event, assignment),
  );

  return {
    canCancel:
      assignment.status === "CONFIRMED" &&
      assignment.attendance === "PENDING" &&
      !assignment.checkInAt &&
      !policy.hasStarted,
    cancelDeadline: policy.deadline.toISOString(),
    isLateCancel: policy.isLate,
  };
};

/**
 * 지금 출퇴근을 찍을 수 있는지와, 못 찍으면 왜인지.
 *
 * 판정을 화면에 맡기지 않는다. 서버가 막는 조건과 화면이 잠그는 조건이 갈리면
 * 눌리는데 거부당하거나, 눌리지 않는데 사실은 가능한 상태가 된다.
 */
const resolveCheckAvailability = (
  event: EventDetail,
  assignment: Assignment,
): Pick<MyWork, "canCheckIn" | "canCheckOut" | "checkBlockReason"> => {
  if (assignment.status !== "CONFIRMED") {
    return {
      canCheckIn: false,
      canCheckOut: false,
      checkBlockReason: "확정된 근무가 아닙니다.",
    };
  }

  if (assignment.checkInAt && assignment.checkOutAt) {
    return { canCheckIn: false, canCheckOut: false };
  }

  /*
    24시간 이내에 취소한 근무는 확정 상태로 남지만(노쇼 흐름을 타려고) 나가지 않는 날이다.
    여기서 막지 않으면 취소해 놓고 출근을 찍을 수 있다.
  */
  if (assignment.attendance === "NO_SHOW" || assignment.attendance === "ABSENT") {
    return {
      canCheckIn: false,
      canCheckOut: false,
      checkBlockReason: "취소 · 노쇼로 기록된 근무입니다.",
    };
  }

  const rule = operationSettings.attendance;
  const window = resolveCheckTimeWindow(
    assignment.workDate,
    resolveAssignmentSchedule(event, assignment),
    rule.checkInWindowBeforeHours,
    rule.checkInWindowAfterHours,
  );

  if (!window.isOpen) {
    const isBefore = new Date() < window.opensAt;

    return {
      canCheckIn: false,
      canCheckOut: false,
      checkBlockReason: isBefore
        ? `근무 시작 ${rule.checkInWindowBeforeHours}시간 전부터 찍을 수 있습니다.`
        : "출퇴근을 찍을 수 있는 시간이 지났습니다. 담당자에게 문의해 주세요.",
    };
  }

  return {
    canCheckIn: !assignment.checkInAt,
    canCheckOut: Boolean(assignment.checkInAt) && !assignment.checkOutAt,
  };
};

/**
 * 내 배치 한 건을 행사와 함께 찾는다.
 *
 * 남의 배치는 **없는 것으로 답한다.** 번호를 하나씩 올려 보며 누가 어느 현장에
 * 나가는지 훑을 수 있는 문을 만들지 않는다. (계약서와 같은 규칙)
 */
const findMyAssignment = (staffId: number, assignmentId: number) => {
  for (const event of events) {
    const assignment = event.assignments.find(
      (item) => item.assignmentId === assignmentId,
    );

    if (assignment) {
      return assignment.staffId === staffId ? { event, assignment } : undefined;
    }
  }

  return undefined;
};

/**
 * 현장 근처인지 확인한다.
 *
 * **행사에 좌표가 없거나 반경이 0이면 확인하지 않는다.** 좌표를 깜빡한 행사에서
 * 전원이 출근을 못 찍으면 그 순간 현장 전체가 멈춘다. 검증은 돕는 장치이지
 * 일을 막는 장치가 아니다.
 *
 * 반경 밖이면 **얼마나 떨어졌는지** 함께 돌려준다. "위치가 확인되지 않았습니다"만으로는
 * GPS가 튄 것인지 장소를 잘못 온 것인지 본인도 알 수 없다.
 */
const verifyLocation = (
  event: EventDetail,
  body: { latitude?: number; longitude?: number },
  radiusMeters: number,
): { location?: CheckLocation } | { error: Response } => {
  const hasVenue =
    typeof event.latitude === "number" && typeof event.longitude === "number";

  if (!hasVenue || radiusMeters <= 0) {
    /* 확인하지 않는다. 보내 준 좌표가 있으면 근거로만 남긴다. */
    return {
      location:
        typeof body.latitude === "number" && typeof body.longitude === "number"
          ? { latitude: body.latitude, longitude: body.longitude }
          : undefined,
    };
  }

  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return {
      error: badRequest(
        "위치를 확인할 수 없어 출퇴근을 기록할 수 없습니다. 담당자에게 문의해 주세요.",
        "LOCATION_REQUIRED",
      ),
    };
  }

  const distanceMeters = calculateDistanceMeters(
    body.latitude,
    body.longitude,
    event.latitude!,
    event.longitude!,
  );

  if (distanceMeters > radiusMeters) {
    return {
      error: badRequest(
        `현장에서 ${distanceMeters}m 떨어져 있습니다. ${radiusMeters}m 안에서 찍어 주세요.`,
        "OUT_OF_RANGE",
      ),
    };
  }

  return {
    location: {
      latitude: body.latitude,
      longitude: body.longitude,
      distanceMeters,
    },
  };
};

/**
 * 내 배치를 전부 모은다.
 *
 * 담당자가 뺀 배치는 담지 않는다 — 나가지 않기로 한 날이다.
 * **본인이 취소한 건은 담는다.** 언제 무슨 이유로 취소했고 그게 노쇼로 남았는지는
 * 본인이 확인할 수 있어야 한다. 목록에서 사라지면 점수가 왜 깎였는지 설명할 곳이 없다.
 */
const myWorks = (staffId: number): MyWork[] =>
  events
    .flatMap((event) =>
      event.assignments
        .filter(
          (assignment) =>
            assignment.staffId === staffId &&
            (assignment.status !== "CANCELED" ||
              Boolean(assignment.staffCanceledAt)),
        )
        .map((assignment) => toMyWork(event, assignment)),
    )
    .sort((a, b) => a.workDate.localeCompare(b.workDate));

/**
 * 남의 계약서는 **없는 것으로 답한다.** (404이지 403이 아니다)
 *
 * 403은 "그 번호의 계약서가 있긴 하다"를 알려 준다. 번호를 하나씩 올려 보며
 * 누가 어느 행사에 나가는지 훑을 수 있는 문이 된다.
 */
const findMyContract = (staffId: number, contractId: number) => {
  const contract = findContract(contractId);

  return contract?.staffId === staffId ? contract : undefined;
};

const toMyContract = (contract: Contract): MyContract => ({
  contractId: contract.contractId,
  contractNumber: contract.contractNumber,
  eventId: contract.eventId,
  eventTitle: contract.eventTitle,
  clientName: contract.clientName,
  role: contract.role,
  positionNames: contract.positionNames ?? [],
  workDates: contract.workDates,
  totalWage: contract.totalWage,
  status: contract.status,
  revision: contract.revision,
  sentAt: contract.sentAt,
  signedAt: contract.signedAt,
  rejectedReason: contract.rejectedReason,
  revisionRequests: contract.revisionRequests ?? [],
  amendReason: contract.amendReason,
  amendReasonType: contract.amendReasonType,
  /*
    종이로 받아 둔 건은 본인 화면에서 다시 서명받지 않는다.
    이미 서명한 문서에 또 서명하라고 하면, 본인은 앞선 서명이 무효가 된 줄 안다.
  */
  isPaperSigned: Boolean(contract.signedFile) && !contract.signature,
});

/**
 * 같은 행사 계약서의 차수 이력. **오래된 차수부터** 세운다.
 *
 * 1차에 수정요청을 보냈고 2차가 새로 왔다는 흐름은 위에서 아래로 읽혀야 한다.
 * 아직 안 보낸 차수(`DRAFT`)는 담지 않는다 — 본인에게는 없는 문서다.
 */
const buildMyContractHistory = (
  staffId: number,
  eventId: number,
): MyContractHistoryItem[] =>
  contractsByStaff(staffId)
    .filter(
      (contract) => contract.eventId === eventId && contract.status !== "DRAFT",
    )
    .sort((a, b) => a.revision - b.revision)
    .map((contract) => ({
      contractId: contract.contractId,
      revision: contract.revision,
      status: contract.status,
      totalWage: contract.totalWage,
      sentAt: contract.sentAt,
      signedAt: contract.signedAt,
      amendReason: contract.amendReason,
      amendReasonType: contract.amendReasonType,
      revisionRequests: contract.revisionRequests ?? [],
    }));

const toMyApplication = (application: Application): MyApplication => {
  const posting = findPosting(application.postingId);
  const event = findEvent(application.eventId);
  const position = event
    ? findPosition(event, application.positionId)
    : undefined;
  const workDates = event
    ? positionWorkDates(event, application.positionId)
    : (posting?.workDates ?? [application.workDate]);
  /* 금액은 공고 상세(`toMyPosting`)와 같은 계산이다. 둘이 다르면 지원한 금액이 바뀐 줄 안다. */
  const workHours = position ? calculateScheduledWorkHours(position) : 0;
  const dailyPay = position
    ? calculateBasePay(position.wageType, position.wage, workHours)
    : 0;

  return {
    applicationId: application.applicationId,
    postingId: application.postingId,
    postingTitle: application.postingTitle,
    eventId: application.eventId,
    eventTitle: application.eventTitle,
    clientName: event?.clientName ?? "",
    role: application.role,
    positionId: application.positionId,
    positionName: position?.name ?? application.positionName,
    workDate: application.workDate,
    /* 카드가 날짜·장소를 그리려고 공고를 한 번 더 부르지 않게 함께 내린다. */
    workDates,
    venue: posting?.venue ?? event?.venue ?? "",
    address: event?.address ?? "",
    /* 시각은 지원한 포지션의 것이다. 행사 기본 시간을 적으면 B타임 지원자가 속는다. */
    startTime: position?.startTime ?? event?.startTime ?? "",
    endTime: position?.endTime ?? event?.endTime ?? "",
    endDayOffset: position?.endDayOffset ?? event?.endDayOffset ?? 0,
    breakMinutes: position?.breakMinutes ?? event?.breakMinutes ?? 0,
    wageType: position?.wageType ?? "HOURLY",
    wage: position?.wage ?? 0,
    dailyPay,
    totalPay: dailyPay * workDates.length,
    meetingPoint: event?.meetingPoint ?? "",
    description: event?.description ?? "",
    dressCode: event?.dressCode ?? "",
    belongings: event?.belongings ?? "",
    managerName: event?.managerName ?? "",
    managerPhone: event?.managerPhone ?? "",
    status: application.status,
    appliedAt: application.appliedAt,
    processedAt: application.processedAt,
  };
};

/**
 * 여러 날 중 하루라도 다른 행사에 확정돼 있으면 그 행사를 돌려준다.
 * 첫날만 보면 사흘째가 겹치는 지원이 그대로 통과한다.
 */
const findConflictOnDates = (
  staffId: number,
  dates: string[],
  eventId: number,
) => {
  for (const date of dates) {
    const conflict = findConflictEvent(staffId, date, eventId);

    if (conflict) return conflict;
  }

  return undefined;
};

/**
 * 이 사람이 **설 수 있는 자리인가** — 직무 · 성별 · 보건증.
 *
 * '지원할 수 있는가'(`resolvePositionBlock`)와 갈라 둔다. 이쪽은 그 사람의
 * 조건이라 오늘 바뀌지 않지만, 저쪽에는 날짜 겹침 · 이미 낸 지원처럼
 * 일정에 따라 오늘만 막히는 것이 섞여 있다. 목록의 '내가 할 수 있는 직무만'은
 * 앞의 것만 봐야 한다 — 겹치는 날을 빼는 것은 사용자가 따로 켜는 다른 축이다.
 *
 * 비회원은 거를 기준이 없으므로 전부 통과다.
 */
const matchesStaffConditions = (
  position: PostingPosition,
  staff: StaffDetail | undefined,
): boolean => {
  if (!staff) return true;

  return (
    staff.roles.includes(position.jobRole) &&
    matchesGenderPreference(position.genderPreference, staff.gender) &&
    (!position.requiresHealthCert ||
      hasValidHealthCert(refreshHealthCertState(staff)))
  );
};

/**
 * 이 사람이 이 포지션에 지원할 수 없는 이유. 없으면 `undefined`다.
 *
 * **목록 · 상세의 버튼과 지원 요청이 같은 함수를 쓴다.** 화면은 된다고 하는데 서버가
 * 막거나, 서버는 받는데 화면이 잠그는 상태가 생기면 둘 다 고장으로 읽힌다.
 * 순서가 곧 안내 순서다 — 본인이 어떻게 해도 안 되는 것(성별)부터 말한다.
 */
const resolvePositionBlock = (
  event: EventDetail,
  position: PostingPosition,
  staff: StaffDetail | undefined,
): string | undefined => {
  if (!staff) return "로그인하면 지원할 수 있어요.";

  /*
    다른 자리에 이미 지원했다고 막지 않는다.

    예전에는 행사당 하나로 막고 "바꾸려면 취소해 주세요"라고 했다. 그러면
    A타임에 넣어 두고 기다리는 동안 B타임이 차 버려도 손쓸 방법이 없고,
    실제로 사람들은 취소했다가 A도 B도 놓쳤다. 지원은 자리를 잡는 것이 아니라
    의사를 알리는 것이라 여러 자리에 낼 수 있고, 확정은 하나만 된다.
  */

  if (!matchesGenderPreference(position.genderPreference, staff.gender)) {
    return `${GENDER_PREFERENCE_LABEL[position.genderPreference]} 모집하는 자리예요.`;
  }

  if (
    position.requiresHealthCert &&
    !hasValidHealthCert(refreshHealthCertState(staff))
  ) {
    return staff.healthCertState === "EXPIRED"
      ? "보건증이 만료되었어요. 새 보건증을 등록해 주세요."
      : staff.healthCertState === "SUBMITTED"
        ? "보건증을 확인하고 있어요. 승인되면 지원할 수 있어요."
        : "보건증이 있어야 지원할 수 있는 자리예요.";
  }

  /*
    발주가 하루도 없는 자리는 지원을 받아 봐야 확정할 수 없다.
    (담당자가 일별 발주를 0으로 내린 뒤 공고가 남아 있는 경우다)
  */
  const workDates = positionWorkDates(event, position.positionId);

  if (workDates.length === 0) return "지금은 모집이 닫힌 자리예요.";

  /*
    같은 날 이미 확정된 행사가 있으면 미리 알린다.
    지원한 뒤 확정 단계에서 거절당하면, 본인은 왜 떨어졌는지 모른 채
    다음에도 같은 날에 또 지원한다.
  */
  const conflict = findConflictOnDates(
    staff.staffId,
    workDates,
    event.eventId,
  );

  if (conflict) return `같은 날 '${conflict.title}'에 이미 확정되어 있어요.`;

  return undefined;
};

/**
 * 공고 한 건을 포털 자료로 옮긴다.
 *
 * `staff`가 없으면 **비회원**이다. 지원 여부 · 같은 날 겹치는 행사처럼
 * 누구인지 알아야 나오는 값만 비워 두고, 공고 자체는 똑같이 내린다.
 */
const toMyPosting = (
  posting: JobPosting,
  staff?: StaffDetail,
): MyPosting | undefined => {
  const event = findEvent(posting.eventId);

  if (!event) return undefined;

  /* 한 행사의 여러 자리에 걸어 둘 수 있다. 지원은 자리마다 따로 붙는다. */
  const mine = staff ? findActiveApplications(staff.staffId, posting.eventId) : [];

  const positions: MyPostingPosition[] = posting.positions.map((position) => {
    const workHours = calculateScheduledWorkHours(position);
    const blockReason = resolvePositionBlock(event, position, staff);
    const applied = mine.find(
      (application) => application.positionId === position.positionId,
    );
    const isMine = Boolean(applied);
    /* 발주가 있는 날만이다. 행사 근무일과 같지 않을 수 있다. */
    const workDates = positionWorkDates(event, position.positionId);
    const dailyPay = calculateBasePay(position.wageType, position.wage, workHours);

    return {
      positionId: position.positionId,
      name: position.name,
      jobRole: position.jobRole,
      startTime: position.startTime,
      endTime: position.endTime,
      endDayOffset: position.endDayOffset,
      breakMinutes: position.breakMinutes,
      workDates,
      workHours,
      wageType: position.wageType,
      wage: position.wage,
      /* 하루치 · 전체 예상 지급액. 화면이 다시 계산하지 않게 여기서 낸다. */
      dailyPay,
      totalPay: dailyPay * workDates.length,
      genderPreference: position.genderPreference,
      requiresHealthCert: position.requiresHealthCert,
      /* 내 조건(직무 · 성별 · 보건증)에 맞는 자리인가. 목록 토글이 이걸로 거른다 */
      matchesMe: matchesStaffConditions(position, staff),
      myApplicationId: applied?.applicationId,
      myApplicationStatus: applied?.status,
      /* 이미 지원한 포지션은 '지원함'이다. 다시 누를 버튼이 아니다. */
      canApply: !isMine && !blockReason,
      blockReason: isMine ? undefined : blockReason,
    };
  });

  const firstConflict = staff
    ? findConflictOnDates(staff.staffId, event.dates, event.eventId)
    : undefined;

  return {
    postingId: posting.postingId,
    eventId: posting.eventId,
    /*
      **행사 이름을 쓴다.** 관리자 공고 제목에는 부족한 자리 수가 붙어 있고
      (`… · 팀장 1명`), 그건 우리가 무엇을 못 채웠는지를 적어 둔 내부 표기다.
    */
    title: posting.eventTitle,
    clientName: event.clientName,
    workDates: posting.workDates,
    venue: posting.venue,
    address: event.address,
    meetingPoint: event.meetingPoint,
    description: event.description,
    dressCode: event.dressCode,
    belongings: event.belongings,
    positions,
    requiresHealthCert: positions.some((position) => position.requiresHealthCert),
    isApplied: mine.length > 0,
    /* 카드에는 한 줄만 선다. 확정이 하나라도 있으면 그게 대표다. */
    applicationStatus: mine.some((item) => item.status === "ACCEPTED")
      ? "ACCEPTED"
      : mine[0]?.status,
    conflictEventTitle: firstConflict?.title,
  };
};

/**
 * 정산 한 건. **계좌번호는 뒤 4자리만 내린다.**
 *
 * 본인 계좌라도 전부 내릴 이유가 없다. 어느 계좌로 들어오는지 확인하는 데는
 * 뒤 4자리면 충분하고, 이 화면이 캡처되어 돌아다니는 일은 실제로 일어난다.
 */
const toMyPayroll = (item: (typeof payrollItems)[number]): MyPayroll => ({
  payrollId: item.payrollId,
  eventId: item.eventId,
  eventTitle: item.eventTitle,
  clientName: item.clientName,
  role: item.role,
  workDates: item.workDates,
  totalWorkHours: item.totalWorkHours,
  basePay: item.basePay,
  overtimePay: item.overtimePay,
  nightPay: item.nightPay,
  allowance: item.allowance,
  deduction: item.deduction,
  grossPay: item.grossPay,
  withholdingTax: item.withholdingTax,
  netPay: item.netPay,
  status: item.status,
  holdReason: item.holdReason,
  paidAt: item.paidAt,
  accountTail: item.accountNumber ? item.accountNumber.slice(-4) : "",
  bankName: item.bankName,
});

export const staffPortalHandlers = [
  /**
   * 접속할 수 있는 인력 목록 — **테스트용**.
   *
   * 로그인이 아직 없어서, 심사 상태별로 화면이 어떻게 달라지는지 볼 방법이 없다.
   * 서류를 안 낸 사람 · 반려된 사람 · 승인된 사람으로 갈아 끼워 봐야
   * "이 화면이 그 사람에게 무엇을 말하는가"를 판단할 수 있다.
   *
   * 로그인이 붙으면 이 엔드포인트와 전환기 컴포넌트를 함께 지운다.
   * 여기서만 인증 없이 열려 있고, 이름 · 심사 상태 말고는 아무것도 내리지 않는다.
   */
  http.get(`${BASE_URI}/my/accounts`, async () => {
    const accounts = staffList
      .filter((staff) => staff.employment === "FREELANCER")
      .slice(0, 30)
      .map((staff) => ({
        staffId: staff.staffId,
        name: staff.name,
        profileImageUrl: staff.profileImageUrl,
        status: staff.status,
        documentReviewState: staff.documentReviewState,
        workCount: staff.workCount,
      }));

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items: accounts });
  }),

  /** 내 정보 */
  http.get(`${BASE_URI}/my/profile`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(toMyProfile(staff));
  }),

  /**
   * 인적사항 수정 — **승인 없이 곧바로 반영된다.**
   *
   * 이름 한 글자를 고치는 데도 담당자를 기다려야 하면 아무도 고치지 않고,
   * 결국 틀린 연락처로 현장 안내가 나간다. 검증이 필요한 것은 돈이 나가는
   * 근거(서류 · 계좌)뿐이고, 그쪽은 따로 심사를 받는다. (`PUT /my/documents`)
   */
  http.put(`${BASE_URI}/my/profile`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const body = (await request.json()) as MyProfileFormValues;

    /*
      다른 사람이 이미 쓰는 번호로는 바꿀 수 없다.
      번호는 지원 접수에서 사람을 잇는 열쇠라, 겹치면 남의 지원이 내게 붙는다.
    */
    const isDuplicated = staffList.some(
      (item) =>
        item.staffId !== staff.staffId &&
        item.phoneNumber === body.phoneNumber,
    );

    if (isDuplicated) {
      return HttpResponse.json(
        {
          code: "DUPLICATED_PHONE_NUMBER",
          message: "이미 등록된 휴대폰번호입니다. 담당자에게 문의해 주세요.",
        },
        { status: 409 },
      );
    }

    /*
      본문에 담긴 칸만 반영한다. `Object.assign(staff, body)`로 통째로 덮으면
      본문에 없는 값(계좌 · 서류 · 평판)이 `undefined`로 덮여 사라진다.
    */
    staff.name = body.name;
    staff.phoneNumber = body.phoneNumber;
    staff.profileImageUrl = body.profileImageUrl;
    staff.birthDate = body.birthDate;
    staff.gender = body.gender;
    staff.roles = body.roles;
    staff.region = body.region;
    staff.district = body.district;
    staff.address = body.address;
    staff.emergencyContact = body.emergencyContact;
    staff.height = body.height;
    staff.clothingSize = body.clothingSize;

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(toMyProfile(staff));
  }),

  /**
   * 내 계약서 목록.
   *
   * 아직 안 보낸 문서(`DRAFT`)는 **담지 않는다.** 담당자가 만들어 두기만 하고
   * 금액을 아직 못 정한 문서가 본인 화면에 뜨면, 그것을 보고 서명해 버린다.
   * 보낸 것(`SENT`)부터가 본인의 일이다.
   */
  http.get(`${BASE_URI}/my/contracts`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const items: MyContract[] = contractsByStaff(staff.staffId)
      .filter((contract) => contract.status !== "DRAFT")
      .map(toMyContract);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items });
  }),

  /**
   * 계약서 한 장의 원문 + 양식.
   *
   * 문서를 여기서 조립해 내리지 않는다. 조립에는 직무 이름이 필요한데
   * 그 이름은 기준 설정에서 오고(`useOrgStore`), 화면이 이미 그것을 들고 있다.
   * 서버가 한 번 더 조립하면 관리자 미리보기와 본인이 보는 문서가 **다른 함수**를
   * 거치게 되어, 언젠가 두 문서의 글자가 갈린다. (`GET /admin/contracts/:id/preview`도 같다)
   */
  http.get(
    `${BASE_URI}/my/contracts/:contractId/preview`,
    async ({ params, request }) => {
      const { staff, response } = requireStaff(request);

      if (!staff) return response;

      const contract = findMyContract(staff.staffId, Number(params.contractId));

      if (!contract) return notFound("존재하지 않는 계약서입니다.");

      const template = findContractTemplate(contract.templateId);

      if (!template) return notFound("계약서 양식을 찾을 수 없습니다.");

      await delay(MOCK_DELAY_MS);

      /*
        문서 조립용 원문(`contract`)과 함께 **화면용 요약 · 차수 이력**을 내린다.
        상세 페이지가 목록을 한 번 더 불러 같은 행사의 다른 차수를 찾게 두면,
        새로 고침 한 번에 조회가 두 번 나가고 둘이 어긋날 때 설명할 길이 없다.
      */
      return HttpResponse.json({
        contract,
        template,
        summary: toMyContract(contract),
        history: buildMyContractHistory(staff.staffId, contract.eventId),
      });
    },
  ),

  /**
   * 전자서명 제출.
   *
   * 서명 시점의 문서 평문을 함께 받아 **해시로 남긴다.** 서명한 뒤에 금액을 고쳐도
   * 서명 이미지는 그대로 붙어 있어서, 무엇에 서명했는지를 남기지 않으면
   * 그 문서는 아무것도 증명하지 못한다.
   *
   * 서명이 끝나면 배치의 계약 상태와 정산 대상 여부까지 함께 움직인다.
   * (`markAssignmentsSigned` — 종이 등록과 같은 함수를 쓴다)
   */
  http.post(
    `${BASE_URI}/my/contracts/:contractId/sign`,
    async ({ params, request }) => {
      const { staff, response } = requireStaff(request);

      if (!staff) return response;

      const contract = findMyContract(staff.staffId, Number(params.contractId));

      if (!contract) return notFound("존재하지 않는 계약서입니다.");

      const body = (await request.json()) as {
        signedName: string;
        imageDataUrl: string;
        documentText: string;
      };

      if (contract.status === "SIGNED") {
        return badRequest("이미 서명이 끝난 계약서입니다.");
      }

      if (contract.status === "SUPERSEDED") {
        return badRequest(
          "다시 작성된 계약서입니다. 새 차수의 문서에 서명해 주세요.",
        );
      }

      /*
        **수정요청을 보낸 문서에는 서명할 수 없다.** 본인이 틀렸다고 한 문서에 서명을
        받으면 그 서명은 무엇에 동의한 것인지 설명할 수 없다. 업체가 재발급하면
        새 차수가 서명 대기로 온다.
      */
      if (contract.status === "REJECTED") {
        return badRequest(
          "수정요청을 보낸 계약서입니다. 담당자가 다시 발급하면 새 문서에 서명할 수 있습니다.",
          "CONTRACT_REJECTED",
        );
      }

      if (contract.status !== "SENT") {
        return badRequest("아직 서명할 수 있는 계약서가 아닙니다.");
      }

      if (!body.imageDataUrl) return badRequest("서명을 입력해 주세요.");

      if ((body.signedName ?? "").trim().length < 2) {
        return badRequest("서명자 성명을 입력해 주세요.");
      }

      const signedAt = new Date().toISOString();

      contract.signature = {
        imageDataUrl: body.imageDataUrl,
        signedName: body.signedName.trim(),
        signedAt,
        documentHash: buildDocumentHash(body.documentText ?? ""),
      };
      contract.status = "SIGNED";
      contract.signedAt = signedAt;

      markAssignmentsSigned(contract);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toMyContract(contract));
    },
  ),

  /**
   * 계약서 수정요청 (상태는 반려).
   *
   * 되돌려 보낼 자리가 없으면 근로자가 할 수 있는 일은 **서명을 안 하고 버티는 것**뿐이고,
   * 담당자는 왜 서명이 안 들어오는지 알 수 없다. 사유를 받아 두면 그 자리에서 고칠 수 있다.
   *
   * **서명 대기(`SENT`)일 때만 받는다.** 이미 요청을 보낸 문서에 또 보내면 업체는
   * 같은 문서를 두 번 고치게 되고, 요청이 쌓인 순서도 흐려진다.
   * 사유는 덮어쓰지 않고 이력(`revisionRequests`)에 쌓는다.
   */
  http.post(
    `${BASE_URI}/my/contracts/:contractId/reject`,
    async ({ params, request }) => {
      const { staff, response } = requireStaff(request);

      if (!staff) return response;

      const contract = findMyContract(staff.staffId, Number(params.contractId));

      if (!contract) return notFound("존재하지 않는 계약서입니다.");

      const body = (await request.json()) as { reason: string };
      const reason = (body.reason ?? "").trim();

      if (contract.status === "SIGNED") {
        return badRequest(
          "이미 서명한 계약서입니다. 담당자에게 직접 연락해 주세요.",
        );
      }

      if (contract.status === "REJECTED") {
        return badRequest(
          "이미 수정요청을 보낸 계약서입니다. 담당자가 확인하고 있어요.",
          "ALREADY_REJECTED",
        );
      }

      if (contract.status !== "SENT") {
        return badRequest("지금은 수정요청을 보낼 수 없는 계약서입니다.");
      }

      if (reason.length < 5) {
        return badRequest(
          "어디가 다른지 5자 이상 적어 주세요. 담당자가 그대로 고칠 수 있어야 합니다.",
          "REJECT_REASON_REQUIRED",
        );
      }

      contract.status = "REJECTED";
      contract.rejectedReason = reason;
      contract.revisionRequests = [
        ...(contract.revisionRequests ?? []),
        { reason, requestedAt: new Date().toISOString() },
      ];

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toMyContract(contract));
    },
  ),

  /**
   * 서류 · 계좌 제출.
   *
   * 내면 **승인이 아니라 승인 대기**가 된다. 그 사이에는 확정 배치가 막힌다.
   * (`syncStaffDocuments` — 관리자 폼과 같은 함수를 쓴다)
   */
  http.put(`${BASE_URI}/my/documents`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const body = (await request.json()) as MyDocumentFormValues;
    const before = snapshotStaffDocuments(staff);

    staff.idCardImageUrl = body.idCardImageUrl;
    staff.bankBookImageUrl = body.bankBookImageUrl;
    staff.bankName = body.bankName;
    staff.accountNumber = body.accountNumber;
    staff.accountHolder = body.accountHolder;

    syncStaffDocuments(staff, before);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(toMyProfile(staff));
  }),

  /**
   * 보건증 제출. 필수 서류와 **따로 받는다.** (`MyHealthCertFormValues`)
   *
   * 내면 승인 대기가 되고, 승인되기 전에는 보건증이 필요한 포지션에 지원할 수 없다.
   * 발급일이 미래면 받지 않는다 — 오타 하나로 3년짜리 보건증이 된다.
   */
  http.put(`${BASE_URI}/my/health-cert`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const body = (await request.json()) as MyHealthCertFormValues;

    if (!body.healthCertImageUrl) return badRequest("보건증 사진을 올려 주세요.");

    if (!body.healthCertIssuedAt || body.healthCertIssuedAt > toDateKey(new Date())) {
      return badRequest("발급일을 오늘 이전 날짜로 선택해 주세요.");
    }

    const before = snapshotStaffDocuments(staff);

    staff.healthCertImageUrl = body.healthCertImageUrl;
    staff.healthCertIssuedAt = body.healthCertIssuedAt;

    syncStaffDocuments(staff, before);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(toMyProfile(staff));
  }),

  /* ---------------------------- 내 일정 ---------------------------- */

  /**
   * 내 근무 일정.
   *
   * `scope`로 예정 · 종료를 가른다. 한 화면에서 탭으로 오가는 자료라
   * 두 벌을 따로 받으면 같은 배치를 두 번 훑게 된다.
   *
   * 기준은 **오늘**이다. 오늘 근무는 예정에 남는다 — 현장에 서 있는 사람에게
   * 집합 장소와 담당자 번호가 필요한 순간이 바로 그날이기 때문이다.
   */
  http.get(`${BASE_URI}/my/assignments`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const scope = new URL(request.url).searchParams.get("scope") ?? "UPCOMING";
    const today = toDateKey(new Date());

    /*
      `ALL`은 캘린더용이다. 달력은 지난 근무와 앞으로의 근무를 한 장에 그려야 해서,
      두 번 나눠 받으면 같은 달이 반씩 늦게 채워진다.
    */
    /*
      취소 · 노쇼 · 결근은 날짜가 남아 있어도 **종료**다. 예정에 두면
      나가지 않을 근무가 출근 버튼 자리를 차지하고 서 있게 된다.
    */
    const items = myWorks(staff.staffId).filter((work) =>
      scope === "ALL"
        ? true
        : scope === "PAST"
          ? work.workDate < today || isClosedWork(work)
          : work.workDate >= today && !isClosedWork(work),
    );

    await delay(MOCK_DELAY_MS);

    /* 종료한 일정은 최근 것이 위로 온다. 예정은 가까운 것이 위다. */
    return HttpResponse.json({
      items: scope === "PAST" ? [...items].reverse() : items,
    });
  }),

  /* --------------------------- 출퇴근 체크 --------------------------- */

  /**
   * 본인이 출근을 찍는다.
   *
   * 검사 순서가 곧 안내 순서다 — **먼저 걸리는 것부터 말해 준다.**
   * 위치를 먼저 재고 시간이 안 됐다고 하면, 현장에 서 있는 사람은
   * GPS를 켰다 껐다 하다가 결국 담당자에게 전화한다.
   */
  http.post(
    `${BASE_URI}/my/assignments/:assignmentId/check-in`,
    async ({ params, request }) => {
      const { staff, response } = requireStaff(request);

      if (!staff) return response;

      const found = findMyAssignment(staff.staffId, Number(params.assignmentId));

      if (!found) return notFound("존재하지 않는 근무입니다.");

      const { event, assignment } = found;
      const body = (await request.json()) as {
        latitude?: number;
        longitude?: number;
      };

      if (assignment.status !== "CONFIRMED") {
        return badRequest("확정된 근무가 아닙니다.");
      }

      if (assignment.checkInAt) {
        return badRequest("이미 출근을 찍었습니다.", "ALREADY_CHECKED_IN");
      }

      /* 버튼과 같은 규칙이다 (`resolveCheckAvailability`). 취소한 근무에는 출근이 없다. */
      if (assignment.attendance === "NO_SHOW" || assignment.attendance === "ABSENT") {
        return badRequest(
          "취소 · 노쇼로 기록된 근무입니다. 담당자에게 문의해 주세요.",
          "WORK_CLOSED",
        );
      }

      const rule = operationSettings.attendance;
      /* 예정 시각은 포지션에서 온다. 행사 시간으로 재면 B타임 출근 창이 낮에 열린다. */
      const schedule = resolveAssignmentSchedule(event, assignment);
      const window = resolveCheckTimeWindow(
        assignment.workDate,
        schedule,
        rule.checkInWindowBeforeHours,
        rule.checkInWindowAfterHours,
      );

      if (!window.isOpen) {
        /*
          아직인지 지났는지를 갈라 말한다.

          지난 근무에도 "…부터 찍을 수 있습니다"라고 답하면 앞으로 열릴 것처럼
          읽혀서, 본인은 기다리다가 결국 아무것도 못 한 채로 넘어간다.
          지난 건은 담당자가 대신 적어야 하는 일이라는 것을 그 자리에서 말해야 한다.
        */
        return badRequest(
          new Date() < window.opensAt
            ? `아직 출근을 찍을 수 없습니다. ${formatDateTime(window.opensAt.toISOString())}부터 열립니다.`
            : "출퇴근을 찍을 수 있는 시간이 지났습니다. 담당자에게 문의해 주세요.",
          "OUT_OF_WINDOW",
        );
      }

      const located = verifyLocation(event, body, rule.checkInRadiusMeters);

      if ("error" in located) return located.error;

      const now = new Date().toISOString();
      const scheduledStart = toCheckDateTime(
        assignment.workDate,
        schedule.startTime,
      );

      /* 규칙은 **본인이 찍는 이 길에만** 걸린다. 관리자 입력에는 걸지 않는다. */
      const checkInAt = applyCheckTimeRule(
        now,
        scheduledStart ?? now,
        rule.checkIn,
        "IN",
      );

      assignment.checkInAt = checkInAt;
      assignment.checkInLocation = located.location;
      /*
        지각은 상태로만 남기고 분수는 적지 않는다.
        늦게 온 사실은 출근 시각이 이미 말한다. (`resolveLateMinutes`)
      */
      assignment.lateMinutes = 0;
      assignment.attendance =
        resolveLateMinutes(assignment.workDate, schedule.startTime, checkInAt) > 0
          ? "LATE"
          : "PRESENT";

      syncPayrollWithAssignment(assignment, event);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toMyWork(event, assignment));
    },
  ),

  /**
   * 본인이 퇴근을 찍는다.
   *
   * 출근 기록이 없으면 받지 않는다. 퇴근만 있는 기록은 근무시간을 계산할 수 없고,
   * 그 상태로 정산에 올라가면 0시간짜리 지급 건이 된다.
   */
  http.post(
    `${BASE_URI}/my/assignments/:assignmentId/check-out`,
    async ({ params, request }) => {
      const { staff, response } = requireStaff(request);

      if (!staff) return response;

      const found = findMyAssignment(staff.staffId, Number(params.assignmentId));

      if (!found) return notFound("존재하지 않는 근무입니다.");

      const { event, assignment } = found;
      const body = (await request.json()) as {
        latitude?: number;
        longitude?: number;
      };

      if (!assignment.checkInAt) {
        return badRequest("출근을 먼저 찍어 주세요.", "CHECK_IN_REQUIRED");
      }

      if (assignment.checkOutAt) {
        return badRequest("이미 퇴근을 찍었습니다.", "ALREADY_CHECKED_OUT");
      }

      const rule = operationSettings.attendance;
      const located = verifyLocation(event, body, rule.checkInRadiusMeters);

      if ("error" in located) return located.error;

      const now = new Date().toISOString();
      const schedule = resolveAssignmentSchedule(event, assignment);
      const scheduledEnd = toCheckDateTime(
        assignment.workDate,
        schedule.endTime,
        schedule.endDayOffset,
      );

      const checkOutAt = applyCheckTimeRule(
        now,
        scheduledEnd ?? now,
        rule.checkOut,
        "OUT",
      );

      /*
        퇴근이 출근보다 이르면 받지 않는다.
        규칙에 따라 예정 종료로 당겨졌는데 출근이 그보다 늦은 경우가 실제로 나온다.
        (예정 종료를 넘겨 출근한 철야 교대) 음수 근무시간이 정산으로 넘어가면
        지급액이 마이너스가 된다.
      */
      if (new Date(checkOutAt) <= new Date(assignment.checkInAt)) {
        return badRequest(
          "퇴근 시각이 출근 시각보다 빠릅니다. 담당자에게 문의해 주세요.",
        );
      }

      assignment.checkOutAt = checkOutAt;
      assignment.checkOutLocation = located.location;

      /* 예정보다 일찍 나갔으면 조퇴. 지각과 겹치면 지각을 남긴다 — 더 먼저 벌어진 일이다. */
      const earlyMinutes = resolveEarlyLeaveMinutes(
        assignment.workDate,
        schedule,
        checkOutAt,
      );

      if (assignment.attendance !== "LATE" && earlyMinutes > 0) {
        assignment.attendance = "EARLY_LEAVE";
      }

      syncPayrollWithAssignment(assignment, event);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toMyWork(event, assignment));
    },
  ),

  /* ---------------------------- 본인 취소 ---------------------------- */

  /**
   * 확정된 근무를 본인이 취소한다. **하루(배치 한 건) 단위다.**
   *
   * 일정은 바뀔 수 있으니 확정 뒤에도 무를 수 있어야 한다. 그렇다고 전날 밤에
   * 빠지는 것까지 똑같이 받으면, 담당자는 대타를 구할 시간 없이 현장을 연다.
   *
   * - 시작 24시간 전까지: 배치를 취소한다. 자리가 비어 발주 부족으로 드러난다.
   * - 그 이후: **노쇼로 남긴다.** 배치는 확정 그대로 두어 명단 · 대시보드의
   *   노쇼 흐름을 타고, 담당자가 대타를 세운다. 평판 감점 · 노쇼 횟수가 따라온다.
   *
   * 이미 시작한 근무는 받지 않는다. 그건 취소가 아니라 결근이고, 담당자가 적는다.
   */
  http.post(
    `${BASE_URI}/my/assignments/:assignmentId/cancel`,
    async ({ params, request }) => {
      const { staff, response } = requireStaff(request);

      if (!staff) return response;

      const found = findMyAssignment(staff.staffId, Number(params.assignmentId));

      if (!found) return notFound("존재하지 않는 근무입니다.");

      const { event, assignment } = found;
      const body = (await request.json()) as { reason?: string };
      const reason = (body.reason ?? "").trim();

      if (!reason) {
        return badRequest("취소 사유를 적어 주세요.", "REASON_REQUIRED");
      }

      if (assignment.status !== "CONFIRMED") {
        return badRequest("확정된 근무만 취소할 수 있습니다.");
      }

      if (assignment.attendance !== "PENDING" || assignment.checkInAt) {
        return badRequest("이미 근태가 기록된 근무입니다. 담당자에게 문의해 주세요.");
      }

      /* 판정은 카드의 취소 버튼과 같은 함수다. (`resolveCancelAvailability`) */
      const policy = resolveStaffCancelPolicy(
        assignment.workDate,
        resolveAssignmentSchedule(event, assignment),
      );

      if (policy.hasStarted) {
        return badRequest(
          "이미 시작한 근무는 취소할 수 없습니다. 담당자에게 바로 연락해 주세요.",
          "ALREADY_STARTED",
        );
      }

      const now = new Date().toISOString();

      assignment.staffCanceledAt = now;
      assignment.staffCancelReason = reason;

      if (policy.isLate) {
        assignment.attendance = "NO_SHOW";

        const target = findStaff(staff.staffId);

        if (target) target.noShowCount += 1;

        syncStaffReputationCounts();
      } else {
        assignment.status = "CANCELED";

        /*
          그 행사에 남은 근무가 없으면 지원도 함께 무른다. 확정된 지원이 살아 있으면
          같은 공고에 다시 지원할 수 없고, 담당자 화면에는 '확정'이 남는다.
        */
        const hasRemaining = event.assignments.some(
          (item) =>
            item.staffId === staff.staffId && item.status === "CONFIRMED",
        );

        if (!hasRemaining) {
          applications
            .filter(
              (application) =>
                application.staffId === staff.staffId &&
                application.eventId === event.eventId &&
                application.status === "ACCEPTED",
            )
            .forEach((application) => {
              application.status = "CANCELED";
              application.processedAt = now;
            });

          recalculatePostingCounts();
        }
      }

      recalculateEventCounts(event);
      syncPayrollWithAssignment(assignment, event);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toMyWork(event, assignment));
    },
  ),

  /* ----------------------------- 내 정산 ---------------------------- */

  http.get(`${BASE_URI}/my/payrolls`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const items = payrollItems
      .filter((item) => item.staffId === staff.staffId)
      .sort((a, b) => b.workDate.localeCompare(a.workDate))
      .map(toMyPayroll);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items });
  }),

  /*
    `GET /my/reputations`(받은 평가 목록)는 없앴다.
    본인에게는 점수 하나만 내린다 — `GET /my/profile`의 `reputationScore`.
    주소를 남겨 두면 화면이 안 불러도 누구든 열어 볼 수 있는 문으로 남는다.
  */

  /* ------------------------------ 공고 ------------------------------ */

  /**
   * 공고 목록 — **로그인하지 않아도 볼 수 있다.**
   *
   * 그래서 주소가 `/my`로 시작하지 않는다. `/my/*`는 "본인 것"이라는 뜻이고,
   * 그 규칙 안에 누구나 볼 수 있는 자료를 섞으면 다음 사람이 이 경로에
   * 계좌나 평판을 붙인다. 공개 자료는 공개 주소에 둔다.
   *
   * 처음 보는 사람에게 가입부터 시키면 그 사람은 그냥 나간다. 어떤 일이
   * 있는지는 먼저 보여 주고, **지원할 때** 누구인지 묻는다.
   *
   * `X-Staff-Id`가 실려 오면 지원 여부 · 겹치는 일정까지 채워 내린다.
   * `onlyMyRoles`(내가 할 수 있는 직무만)는 **회원 전용**이다 —
   * 무엇이 '내 직무'인지는 등록한 사람에게만 있는 정보라, 비회원에게는
   * 켤 수 있는 것처럼 보여 놓고 아무것도 걸러 내지 못한다.
   *
   * `OPEN`만 내린다. 작성중(`DRAFT`)은 담당자가 아직 다듬는 중이고,
   * 마감·충원완료는 지원해도 소용이 없다. 목록에 세워 두면 눌러 보고 실망할 뿐이다.
   *
   * 공고문 원문(`content`)은 내리지 않는다. 오픈카톡방에 붙여넣을 목적으로 만든
   * 문자열이라 담당자 어투가 그대로 들어 있고("지원: 성함/나이/경력을 담당자에게"),
   * 지원 버튼이 있는 화면에서는 앞뒤가 맞지 않는다.
   */
  http.get(`${BASE_URI}/postings`, async ({ request }) => {
    /* 비회원도 통과한다. 신원은 있으면 쓰고 없으면 그만이다. */
    const staff = findStaffRequester(request);
    const viewer = staff?.status === "BLACKLIST" ? undefined : staff;

    const url = new URL(request.url);
    const role = url.searchParams.get("role") ?? "";
    const onlyMyRoles = url.searchParams.get("onlyMyRoles") === "true";
    /* 이미 확정된 근무와 날짜가 겹치는 공고를 숨긴다. */
    const excludeConflicts = url.searchParams.get("excludeConflicts") === "true";
    /*
      날짜로 찾는다. **하루다.**
      "그날 비는데 일이 있나"가 이 화면의 질문이라, 기간으로 받으면
      묻지 않은 것까지 걸러 내고 고르는 손도 두 번 간다.
      다일 행사는 그날이 근무일에 들어 있으면 걸린다.
    */
    const workDate = url.searchParams.get("workDate") ?? "";
    /*
      성별은 **회원이면 본인 성별이 이긴다.** 쿼리로 다른 성별을 보내도 무시한다.
      남성인 사람이 '여성만'을 골라 볼 수 있으면 지원 버튼만 전부 잠긴 목록이 뜬다.
      비회원은 성별을 모르므로 직접 고른 값(없으면 전체)을 쓴다.
    */
    const genderParam = url.searchParams.get("gender");
    const gender =
      viewer?.gender ??
      (genderParam === "MALE" || genderParam === "FEMALE" ? genderParam : undefined);
    const today = toDateKey(new Date());

    recalculatePostingCounts();

    const items: MyPosting[] = postings
      .filter((posting) => posting.status === "OPEN")
      /* 이미 지난 공고는 목록에서 뺀다. 시드가 오늘 기준이라 시간이 지나면 생긴다. */
      .filter((posting) => posting.workDates.some((date) => date >= today))
      .filter(
        (posting) =>
          !role || posting.positions.some((position) => position.jobRole === role),
      )
      /* 고른 날에 근무가 있는 공고만. */
      .filter((posting) => !workDate || posting.workDates.includes(workDate))
      /*
        **조건은 토글 하나로 묶는다.**

        예전에는 직무 토글 · 보건증 셀렉트가 따로 있었다. 그러면 직무를 켜 놓고
        보건증을 안 켠 사람에게 지원할 수 없는 자리가 계속 섞여 나오고,
        본인은 조합을 직접 맞춰 봐야 무엇이 걸러지는지 알 수 있었다.
        지금은 "내가 설 수 있는가" 하나로 직무 · 성별 · 보건증을 함께 본다.
        (날짜 겹침은 다른 축이다 — `excludeConflicts`가 갖는다)

        비회원에게는 거를 기준 자체가 없으므로 그대로 통과한다.
      */
      .filter(
        (posting) =>
          !onlyMyRoles ||
          !viewer ||
          posting.positions.some((position) =>
            matchesStaffConditions(position, viewer),
          ),
      )
      /*
        성별 — 들어갈 수 있는 포지션이 **하나라도** 있으면 보인다.
        남성: 성별 무관 + 남성만 / 여성: 성별 무관 + 여성만 / 모름: 전부.
      */
      .filter((posting) =>
        posting.positions.some((position) =>
          matchesGenderPreference(position.genderPreference, gender),
        ),
      )
      .map((posting) => toMyPosting(posting, viewer))
      .filter((posting): posting is MyPosting => Boolean(posting))
      /*
        확정된 근무와 겹치는 공고를 숨긴다.

        지원해 봐야 서버가 막는 자리라, 켜 두면 목록이 '지금 실제로 잡을 수 있는 일'만 남는다.
        내가 이미 낸 지원은 남긴다 — 상태를 확인할 길이 이 목록뿐이다.
      */
      .filter(
        (posting) =>
          !excludeConflicts || posting.isApplied || !posting.conflictEventTitle,
      )
      .sort((a, b) => a.workDates[0].localeCompare(b.workDates[0]));

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items });
  }),

  /**
   * 공고 한 건.
   *
   * 목록에는 눌러 볼지 정하는 데 필요한 것만 세우고, 집합 장소 · 복장 · 준비물은
   * 여기서 본다. 목록 카드에 다 적으면 한 장이 화면 두 개 높이가 되어
   * 아래쪽 공고는 아무도 스크롤해서 보지 않는다.
   *
   * **마감된 공고도 내린다.** 내가 지원한 공고를 다시 열어 보는 길이
   * 이 주소 하나뿐인데, 목록과 같은 조건으로 걸러 버리면 마감된 순간
   * 내가 어디에 지원했는지 확인할 수 없게 된다.
   */
  http.get(`${BASE_URI}/postings/:postingId`, async ({ request, params }) => {
    const staff = findStaffRequester(request);
    const viewer = staff?.status === "BLACKLIST" ? undefined : staff;

    recalculatePostingCounts();

    const posting = findPosting(Number(params.postingId));
    const item = posting && posting.status !== "DRAFT"
      ? toMyPosting(posting, viewer)
      : undefined;

    if (!item) {
      return HttpResponse.json(
        { code: "POSTING_NOT_FOUND", message: "공고를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(item);
  }),

  /* ----------------------------- 내 지원 ---------------------------- */

  http.get(`${BASE_URI}/my/applications`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const items = applications
      .filter((application) => application.staffId === staff.staffId)
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
      .map(toMyApplication);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items });
  }),

  /**
   * 공고에 지원한다.
   *
   * 담당자가 문자를 받아 옮겨 적던 자리를 본인이 직접 누른다.
   * (`POST /admin/applications`는 그대로 남는다 — 문자로 지원하는 사람은 계속 있다)
   *
   * 확정까지 하지 않는다. **누구를 부를지는 담당자가 정한다.**
   * 지원이 곧 확정이면 정원을 넘겨 들어오고, 그 자리에서 배치가 만들어져
   * 서류·중복 검사를 지나쳐 버린다.
   */
  http.post(`${BASE_URI}/my/applications`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const body = (await request.json()) as {
      postingId: number;
      positionId: number;
    };
    const posting = findPosting(Number(body.postingId));
    const event = posting ? findEvent(posting.eventId) : undefined;

    if (!posting || !event) return notFound("존재하지 않는 공고입니다.");

    if (posting.status !== "OPEN") {
      return badRequest("지금은 지원할 수 없는 공고입니다.");
    }

    recalculatePostingCounts();

    const position = posting.positions.find(
      (item) => item.positionId === Number(body.positionId),
    );

    if (!position) {
      return badRequest("지원할 포지션을 골라 주세요.", "POSITION_REQUIRED");
    }

    /*
      **같은 자리에만 두 번 못 낸다.** 다른 자리는 얼마든지 걸어 둘 수 있고,
      하나가 확정되면 같은 날에 걸린 나머지는 서버가 취소한다.
    */
    if (
      findActivePositionApplication(
        staff.staffId,
        posting.eventId,
        position.positionId,
      )
    ) {
      return badRequest("이미 지원한 포지션입니다.", "DUPLICATED_APPLICATION");
    }

    /*
      성별 · 보건증 · 날짜 겹침을 **화면과 같은 함수로** 본다.
      (`resolvePositionBlock`) 화면만 잠그면 주소를 직접 부르는 순간 통과한다.
    */
    const blockReason = resolvePositionBlock(event, position, staff);

    if (blockReason) return badRequest(blockReason, "APPLY_BLOCKED");

    const created: Application = {
      applicationId: nextId(applications, "applicationId"),
      postingId: posting.postingId,
      postingTitle: posting.title,
      eventId: posting.eventId,
      eventTitle: posting.eventTitle,
      workDate: positionWorkDates(event, position.positionId)[0] ?? posting.workDate,
      positionId: position.positionId,
      positionName: position.name,
      role: position.jobRole,
      staffId: staff.staffId,
      applicantName: staff.name,
      phoneNumber: staff.phoneNumber,
      isExistingStaff: true,
      status: "PENDING",
      note: "포털에서 직접 지원",
      appliedAt: new Date().toISOString(),
    };

    applications.unshift(created);
    recalculatePostingCounts();

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(toMyApplication(created), { status: 201 });
  }),

  /**
   * 지원 취소.
   *
   * **검토 대기일 때만** 된다. 확정된 뒤에 화면에서 혼자 빠질 수 있으면
   * 담당자는 현장 전날에 사람이 사라진 것을 알게 된다. 그때는 연락해서 말해야 한다.
   */
  http.patch(
    `${BASE_URI}/my/applications/:applicationId/cancel`,
    async ({ params, request }) => {
      const { staff, response } = requireStaff(request);

      if (!staff) return response;

      const application = applications.find(
        (item) =>
          item.applicationId === Number(params.applicationId) &&
          item.staffId === staff.staffId,
      );

      if (!application) return notFound("존재하지 않는 지원 건입니다.");

      if (application.status !== "PENDING") {
        return badRequest(
          "이미 처리된 지원입니다. 담당자에게 직접 연락해 주세요.",
        );
      }

      application.status = "CANCELED";
      application.processedAt = new Date().toISOString();

      recalculatePostingCounts();

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toMyApplication(application));
    },
  ),

  /* ------------------------------ 홈 요약 ---------------------------- */

  /**
   * 포털 첫 화면.
   *
   * 여러 조회를 한 번에 묶는다. 첫 화면이 네 번 요청하면 폰에서는 그만큼 늦게 뜨고,
   * 그 사이 화면은 빈 칸 네 개로 보인다.
   *
   * 할 일은 **지금 손이 가야 하는 순서**로 담는다. 서류가 맨 앞이다 —
   * 서류가 막혀 있으면 지원해도 확정되지 않으므로, 다른 어떤 것보다 먼저다.
   */
  http.get(`${BASE_URI}/my/summary`, async ({ request }) => {
    const { staff, response } = requireStaff(request);

    if (!staff) return response;

    const today = toDateKey(new Date());
    /* 취소 · 노쇼한 근무는 세지 않는다. 다음 근무로 뜨면 안 나갈 곳을 안내하게 된다. */
    const works = myWorks(staff.staffId).filter((work) => !isClosedWork(work));
    const nextWork = works.find((work) => work.workDate >= today);

    const monthPrefix = today.slice(0, 7);
    const monthWorks = works.filter((work) =>
      work.workDate.startsWith(monthPrefix),
    );

    /*
      이번 달 예상 지급액은 **정산이 잡힌 건**에서 가져온다.
      배치의 지급액을 그냥 더하면 원천징수와 공제가 빠져 실제 입금액보다 크고,
      그 숫자를 본 사람은 돈이 덜 들어왔다고 여긴다.
    */
    const monthNetPay = payrollItems
      .filter(
        (item) =>
          item.staffId === staff.staffId &&
          item.workDates.some((date) => date.startsWith(monthPrefix)),
      )
      .reduce((sum, item) => sum + item.netPay, 0);

    const todos: MyTodo[] = [];

    /* 서류는 이제 별도 페이지에서 낸다. 내 정보(읽기) 화면에는 제출 칸이 없다. */
    const documentHref = "/my/profile/documents";

    if (staff.documentReviewState === "REJECTED") {
      todos.push({
        type: "DOCUMENT_REJECTED",
        title: "서류가 반려되었습니다",
        description: "사유를 확인하고 다시 올려 주세요.",
        href: documentHref,
        tone: "danger",
      });
    } else if (staff.documentReviewState === "NONE") {
      todos.push({
        type: "DOCUMENT_MISSING",
        title: "신분증 · 통장사본을 등록해 주세요",
        description: "서류가 승인되어야 근무를 확정할 수 있습니다.",
        href: documentHref,
        tone: "warning",
      });
    } else if (staff.documentReviewState === "SUBMITTED") {
      todos.push({
        type: "DOCUMENT_WAITING",
        title: "서류를 확인하고 있습니다",
        description: "담당자 승인 후 근무를 확정할 수 있습니다.",
        href: documentHref,
        tone: "info",
      });
    }

    /*
      보건증은 선택 서류라 '미등록'은 할 일로 세우지 않는다. 필요 없는 사람이 대부분이다.
      다만 **반려 · 만료**는 본인이 한 번 냈다는 뜻이라, 손을 봐야 하는 일로 알린다.
    */
    const healthCertState = refreshHealthCertState(staff);

    if (healthCertState === "REJECTED" || healthCertState === "EXPIRED") {
      todos.push({
        type: "HEALTH_CERT",
        title:
          healthCertState === "REJECTED"
            ? "보건증이 반려되었습니다"
            : "보건증이 만료되었습니다",
        description: "보건증이 필요한 자리에 지원하려면 새로 올려 주세요.",
        href: documentHref,
        tone: healthCertState === "REJECTED" ? "danger" : "warning",
      });
    }

    const myContracts = contractsByStaff(staff.staffId);
    const waitingContracts = myContracts.filter(
      (contract) => contract.status === "SENT",
    );

    if (waitingContracts.length > 0) {
      todos.push({
        type: "CONTRACT_SIGN",
        title: `서명할 근로계약서가 ${waitingContracts.length}건 있습니다`,
        description: "전문을 확인하고 서명해 주세요.",
        /* 한 건이면 곧바로 그 계약서로 보낸다. 목록을 한 번 더 누를 이유가 없다. */
        href:
          waitingContracts.length === 1
            ? `/my/contracts/detail?id=${waitingContracts[0].contractId}`
            : "/my/contracts",
        tone: "warning",
      });
    }

    const rejectedContracts = myContracts.filter(
      (contract) => contract.status === "REJECTED",
    );

    if (rejectedContracts.length > 0) {
      todos.push({
        type: "CONTRACT_REJECTED",
        title: `수정요청한 계약서 ${rejectedContracts.length}건을 담당자가 확인하고 있습니다`,
        description: "다시 발급되면 서명할 수 있어요.",
        href: "/my/contracts",
        tone: "info",
      });
    }

    /*
      지원 결과.

      **떨어진 건만 세운다.** 확정된 건은 신청 탭에 남지 않고(예정 탭에 근무로 선다)
      이 줄은 신청 탭으로 보내므로, 확정만 있는 사람은 눌러도 빈 화면을 본다.

      그리고 결과는 **본 뒤에는 할 일이 아니다.** 처리된 지 오래된 건까지 세우면
      이 줄은 영영 사라지지 않고, 할 일 목록 전체가 읽히지 않게 된다.
    */
    const resultCutoff = toDateKey(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );
    const rejectedApplications = applications.filter(
      (application) =>
        application.staffId === staff.staffId &&
        application.status === "REJECTED" &&
        (application.processedAt ?? "").slice(0, 10) >= resultCutoff,
    );

    if (rejectedApplications.length > 0) {
      todos.push({
        type: "APPLICATION_RESULT",
        title: `지원 ${rejectedApplications.length}건이 반려되었습니다`,
        description: "다른 공고에 다시 지원할 수 있어요.",
        href: "/my/schedule?tab=APPLIED",
        tone: "info",
      });
    }

    const summary: MySummary = {
      nextWork,
      monthWorkCount: monthWorks.length,
      monthNetPay,
      todos,
      documentReviewState: staff.documentReviewState,
    };

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(summary);
  }),
];
