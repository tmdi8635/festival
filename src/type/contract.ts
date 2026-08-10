import {
  WAGE_TYPE_LABEL,
  formatTimeRange,
  nextDateKey,
  type DayOffset,
  type WageType,
} from "./event";
import type { JobRole } from "./staff";

/**
 * 근로계약서 도메인 타입.
 *
 * 예전에는 모든 사람에게 같은 금액이 적힌 문서를 문자로 보냈다.
 * 여기서는 세 가지를 바꾼다.
 *
 * 1) 계약서를 **문서(조항 묶음)** 로 다룬다. 통짜 문자열이 아니라 조항 단위로 갖고 있어야
 *    에이전시마다 다른 양식을 조립할 수 있고, A4 문서로 출력·PDF 저장이 가능하다.
 * 2) 인적사항 · 근로조건 · 임금은 **자동으로 채운다.** 사람이 옮겨 적으면 반드시 틀린다.
 * 3) 서명은 **종이로 받고, 그 종이를 등록한다.** (아래)
 *
 * ## 지금은 '발송'이 아니라 '등록'이다
 *
 * 최종 모습은 근로자가 계정으로 들어와 링크를 열고 동의하는 흐름이다.
 * 그러려면 문서를 보관하고 링크를 발급하는 **메인 서버**가 있어야 하는데 아직 없다.
 * 서버 없이 '발송함' 상태만 만들어 두면, 아무 데도 나가지 않은 문서가
 * 화면에서는 나간 것으로 보인다. 그 상태로 현장에 사람을 넣는 것이 가장 위험하다.
 *
 * 그래서 지금은 사람이 직접 하는 일을 그대로 옮긴다.
 * **미리보기 → 서명 전 문서 내려받기 → 종이로 배부하고 서명 → 서명본 업로드.**
 * 업로드가 끝난 시점에 계약번호가 붙고 서명완료가 된다.
 * 손에 종이가 있기 전에는 어떤 칸도 완료로 바뀌지 않는다.
 */

/**
 * 계약서 상태.
 *
 * 사람이 직접 배부하는 지금은 상태가 셋뿐이다.
 * 서명본이 올라오기 전에는 계약서 기록 자체가 없고(= 명단에서 '발급 전'),
 * 올라온 순간 계약번호와 함께 `SIGNED`로 만들어진다.
 *
 * `DRAFT`는 **재작성으로 새 차수가 생겼는데 아직 서명본을 못 받은** 자리다.
 * 번호는 이미 있고 서명만 없다. 최초 계약에는 이 상태가 나타나지 않는다.
 *
 * `SUPERSEDED`는 **재작성으로 대체된 문서**다. 삭제가 아니라 상태다.
 * 3일로 계약한 사람이 하루 만에 그만두면 원래 계약서는 사실과 맞지 않게 되는데,
 * 그렇다고 지워 버리면 "왜 3일치가 아니라 하루치를 줬는가"를 설명할 근거가 사라진다.
 * 옛 문서는 그대로 두고 더 이상 유효하지 않다고만 표시한 뒤, 새 차수를 새로 만든다.
 *
 * 서버가 붙으면 발송됨 · 반려 · 기한만료가 이 사이에 들어온다.
 * 그 전까지는 만들지 않는다. 있지도 않은 절차를 화면에 세워 두는 셈이기 때문이다.
 */
export type ContractStatus = "DRAFT" | "SIGNED" | "SUPERSEDED";

/**
 * 계약서를 다시 내는 이유.
 *
 * 처음에는 중도 종료만 다뤘는데, 실제로 재작성이 필요한 상황은 더 넓다.
 * 시급이 오르거나, 중식 제공 같은 조건이 붙거나, 쓰던 템플릿이 바뀐다.
 * 사유를 남기지 않으면 나중에 차수만 여럿인 문서를 놓고
 * "이건 왜 다시 썼지"를 아무도 답하지 못한다.
 */
export type AmendReasonType =
  | "EARLY_END"
  | "WAGE_CHANGE"
  | "CONDITION_CHANGE"
  | "OTHER";

export const AMEND_REASON_LABEL: Record<AmendReasonType, string> = {
  EARLY_END: "중도 종료",
  WAGE_CHANGE: "지급 조건 변경",
  CONDITION_CHANGE: "근무 조건 변경",
  OTHER: "기타",
};

/**
 * 사유별 자주 쓰는 문장.
 * 매번 문장을 짓게 하면 결국 "개인사정" 한 줄만 남는다.
 */
export const AMEND_REASON_PRESETS: Record<AmendReasonType, string[]> = {
  EARLY_END: [
    "본인 사정으로 잔여 근무일 중도 하차",
    "무단 이탈로 잔여 근무일 근로 미제공",
    "건강 문제로 근로 지속 불가",
    "현장 사정으로 잔여 근무일 조기 종료",
  ],
  WAGE_CHANGE: [
    "협의에 따른 시급 인상",
    "직무 변경에 따른 지급 기준 조정",
    "야간 · 연장 근로 발생으로 지급 조건 변경",
    "거래처 발주 조건 변경에 따른 단가 조정",
  ],
  CONDITION_CHANGE: [
    "중식 제공 조건 추가",
    "근무 시간 변경",
    "근무 장소 변경",
    "담당 업무 범위 변경",
  ],
  OTHER: [
    "계약서 기재 사항 정정",
    "표준 계약서 양식 변경에 따른 재발급",
  ],
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: "등록 대기",
  SIGNED: "서명완료",
  SUPERSEDED: "재작성됨",
};

/* ------------------------------------------------------------------ */
/* 템플릿                                                               */
/* ------------------------------------------------------------------ */

/**
 * 조항 종류.
 *
 * 자유 문장으로 두면 편하지만, 그러면 시급·이름 같은 핵심 값이
 * 사람의 오타에 걸린다. 반드시 정확해야 하는 세 덩어리는 표로 고정하고
 * 값은 시스템이 채운다. 나머지 문구만 에이전시가 자유롭게 쓴다.
 */
export type ClauseKind = "PARTIES" | "WORK_CONDITION" | "WAGE" | "TEXT";

export const CLAUSE_KIND_LABEL: Record<ClauseKind, string> = {
  PARTIES: "당사자 인적사항 (자동)",
  WORK_CONDITION: "근로조건 (자동)",
  WAGE: "임금 (자동)",
  TEXT: "자유 조항",
};

export const CLAUSE_KIND_HINT: Record<ClauseKind, string> = {
  PARTIES: "사업주와 근로자의 이름 · 생년월일 · 연락처 · 주소가 자동으로 들어갑니다.",
  WORK_CONDITION: "근무일 · 시간 · 장소 · 직무가 배치 정보에서 자동으로 들어갑니다.",
  WAGE: "지급 기준(시급 · 일급) · 금액 · 총 지급액 · 원천징수가 자동으로 계산돼 들어갑니다.",
  TEXT: "본문을 직접 씁니다. {{변수}}를 넣으면 발송 시점에 실제 값으로 바뀝니다.",
};

/** 계약서 조항 한 개 */
export interface ContractClause {
  clauseId: string;
  /** 조항 제목. "제1조 (근로계약기간)"처럼 그대로 출력된다. */
  title: string;
  kind: ClauseKind;
  /** TEXT 조항의 본문. 자동 조항은 비워 둔다. */
  body: string;
}

/**
 * 계약서 템플릿.
 *
 * 에이전시마다 양식이 다르므로 조항을 자유롭게 넣고 빼고 순서를 바꾼다.
 * 한 번 만들어 두면 계약서를 만들 때 골라 쓰기만 하면 된다.
 */
export interface ContractTemplate {
  templateId: number;
  name: string;
  /** 이 템플릿이 적용되는 직무. 비우면 전 직무 공통이다. */
  targetRoles: JobRole[];

  /** 문서 상단에 찍히는 제목 */
  documentTitle: string;

  /** 사업주(갑) 정보. 계약서마다 같으므로 템플릿이 들고 있는다. */
  companyName: string;
  companyRepresentative: string;
  companyRegistrationNumber: string;
  companyAddress: string;
  companyPhone: string;

  /** 조항 목록. 위에서부터 순서대로 출력된다. */
  clauses: ContractClause[];

  /** 서명란 위에 들어가는 확인 문구 */
  agreementNote: string;
  /** 미성년자 계약처럼 친권자 서명란이 더 필요한 경우 */
  requiresGuardianSignature: boolean;

  /** 기본 템플릿은 계약서 생성 시 자동 선택된다. */
  isDefault: boolean;
  isActive: boolean;
  usageCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface ContractTemplateFormValues {
  name: string;
  targetRoles: JobRole[];
  documentTitle: string;
  companyName: string;
  companyRepresentative: string;
  companyRegistrationNumber: string;
  companyAddress: string;
  companyPhone: string;
  clauses: ContractClause[];
  agreementNote: string;
  requiresGuardianSignature: boolean;
  isDefault: boolean;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/* 계약서                                                               */
/* ------------------------------------------------------------------ */

/**
 * 등록한 서명본 파일.
 *
 * 서명은 종이에 받는다. 그 종이를 스캔하거나 찍어 올린 것이 이 파일이고,
 * **이 파일이 있다는 것이 곧 서명을 받았다는 근거다.** 그래서 계약서 기록은
 * 이 파일 없이는 서명완료가 될 수 없다.
 *
 * 파일명을 함께 남긴다. 나중에 원본 폴더에서 같은 문서를 찾아야 할 때
 * 화면의 계약번호만으로는 어느 파일인지 알 수 없다.
 */
export interface ContractSignedFile {
  /** 업로드한 파일의 주소. (목업에서는 data URL) */
  url: string;
  fileName: string;
  /** `application/pdf` · `image/png` 등. 화면에서 바로 펼쳐 볼 수 있는지를 가른다. */
  mimeType: string;
  uploadedAt: string;
}

/**
 * 계약서가 덮는 근무일 하나와 그날의 지급 조건.
 *
 * 금액은 **배치 한 건(사람 × 날짜)마다 따로 정해질 수 있다.**
 * 첫날만 설치를 도와 일급을 받고 이후는 시급으로 서는 일이 실제로 있고,
 * 같은 직무라도 경력자에게만 시급을 더 얹어 주기로 하는 일이 흔하다.
 * 계약서가 대표 금액 하나만 들고 있으면 그런 건의 총 지급액을 설명할 수 없다.
 */
export interface ContractWorkDay {
  workDate: string;
  wageType: WageType;
  wage: number;
}

export interface Contract {
  contractId: number;
  /** 계약서 번호. 문자로 안내할 때 사람이 부르는 식별자다. */
  contractNumber: string;
  staffId: number;
  staffName: string;
  staffPhone: string;
  /** 계약서 본문에 자동으로 들어가는 근로자 정보 */
  staffBirthDate: string;
  staffAddress: string;
  eventId: number;
  eventTitle: string;
  clientName: string;
  venue: string;
  role: JobRole;
  templateId: number;
  templateName: string;
  /**
   * 계약 대상 근무일.
   *
   * 여러 날 진행하는 행사는 근무일이 여러 개다. 하루치만 적으면
   * 나머지 날은 계약 없이 일하는 셈이 되므로 목록으로 갖고 있는다.
   */
  workDates: string[];
  /** 근무일별 지급 조건. 날마다 금액이 다를 수 있어 목록으로 들고 있는다. */
  workDays: ContractWorkDay[];
  /** 목록·검색에서 쓰는 대표 근무일 (workDates의 첫날) */
  workDate: string;
  startTime: string;
  endTime: string;
  /** 종료 시각이 근무일로부터 며칠 뒤인지. 24시간을 넘기는 근무를 표현한다. */
  endDayOffset: DayOffset;
  breakMinutes: number;
  /** 하루 실근무시간 */
  workHours: number;
  /** 전체 근무일을 합친 실근무시간 */
  totalWorkHours: number;
  /** 대표 지급 기준 (첫 근무일 기준) */
  wageType: WageType;
  /** 대표 적용 금액. 시급이면 시간당, 일급이면 하루치다. */
  wage: number;
  /**
   * 근무일마다 지급 조건이 다른지.
   *
   * 켜져 있으면 임금 조항에 대표 금액 하나를 적으면 안 된다.
   * 총액이 `대표 금액 × 시간`과 맞지 않아, 서명받는 사람이 문서를 못 믿게 된다.
   */
  hasMixedWage: boolean;
  /**
   * 세전 총 지급액. 계약서 본문에 그대로 들어간다.
   * 근무일별 금액을 각각 구해서 더한 값이다.
   */
  totalWage: number;
  status: ContractStatus;
  /**
   * 등록한 서명본.
   *
   * 이 값이 있으면 서명완료다. 반대로 없으면, 화면에 무슨 상태가 적혀 있든
   * 서명받은 종이는 아직 아무 데도 없다는 뜻이다.
   */
  signedFile?: ContractSignedFile;
  /** 서명본을 등록한 시각 */
  registeredAt?: string;

  /* ---------------------------- 재작성(개정) 이력 --------------------------- */

  /** 계약 차수. 최초 계약이 1이고, 재작성할 때마다 1씩 올라간다. */
  revision: number;
  /** 이 문서를 대체한 새 계약서. 값이 있으면 이 문서는 더 이상 유효하지 않다. */
  supersededByContractId?: number;
  /** 이 문서가 대체한 이전 계약서. 차수를 거슬러 올라갈 때 쓴다. */
  supersededContractId?: number;
  /** 재작성 사유. "왜 금액이 달라졌는가"의 근거라 필수로 받는다. */
  amendReason?: string;
  /** 재작성 구분. 나중에 사유별로 모아 보려면 문장이 아니라 코드가 필요하다. */
  amendReasonType?: AmendReasonType;
  /**
   * 계약서에 남길 변경 내용.
   * 중식 제공처럼 금액에도 근무일에도 잡히지 않는 조건이 여기 남는다.
   */
  amendNote?: string;
  /** 재작성으로 계약에서 빠진 근무일 (중도 종료로 나오지 않은 날) */
  removedWorkDates?: string[];
  amendedAt?: string;

  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 계약 명단                                                            */
/* ------------------------------------------------------------------ */

/**
 * 명단에서 한 사람이 놓인 자리.
 * `NONE`은 "확정 배치는 됐는데 서명본이 아직 없다"는 뜻이다.
 */
export type ContractRosterState = "NONE" | ContractStatus;

/**
 * 계약 명단 한 줄. **행사 하나 × 사람 하나**다.
 *
 * 계약서 기록이 아니라 **계약해야 할 의무**를 세는 단위다.
 * 그래서 아직 아무것도 안 한 사람도 한 줄을 차지한다. 그 사람이 제일 급하다.
 *
 * 같은 사람이 행사 두 개에 나가면 줄도 두 개다. 계약서도 두 장이기 때문이다.
 * (계약은 사람이 아니라 **그 행사의 근로**에 대해 맺는다)
 */
export interface ContractRosterRow {
  /** `행사-사람`. 계약서가 없을 수 있어 계약서 번호를 키로 쓸 수 없다. */
  rowId: string;
  eventId: number;
  eventTitle: string;
  clientName: string;
  venue: string;
  staffId: number;
  staffName: string;
  staffPhone: string;
  /** 이 행사에서 맡은 직무. 첫날 설치 · 이후 스태프처럼 둘 이상일 수 있다. */
  roles: JobRole[];
  workDates: string[];
  /** 대표 근무일 = 첫날. 정렬과 목록 표시에 쓴다. */
  workDate: string;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  /** 하루 실근무시간 */
  workHours: number;
  totalWorkHours: number;
  wageType: WageType;
  wage: number;
  hasMixedWage: boolean;
  /**
   * 세전 총 지급액.
   *
   * 등록 전이라도 **배치에서 그대로 계산해** 채운다.
   * 계약서가 생기면 적힐 금액이 이 값이고, 담당자는 그것을 미리 알아야 한다.
   */
  totalWage: number;
  state: ContractRosterState;
  /** 등록된 계약서. 아직 없으면 `null`이다. */
  contract: Contract | null;
}

/** 처리 순서. 손이 더 가야 하는 쪽이 끝난 것보다 뒤에 묻히면 안 된다. */
export const CONTRACT_ROSTER_STATE_ORDER: ContractRosterState[] = [
  "NONE",
  "DRAFT",
  "SIGNED",
  "SUPERSEDED",
];

/** 계약 명단을 만들 때 필요한 행사 정보 */
export interface ContractRosterEvent {
  eventId: number;
  title: string;
  clientName: string;
  venue: string;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
}

/**
 * 확정 배치에서 계약 명단을 만든다.
 *
 * **계약서 목록에서 만들면 안 된다.** 서명본을 올려야 계약서 기록이 생기므로,
 * 아직 아무것도 안 한 사람은 계약서 목록에 아예 없다. 그게 제일 급한 사람인데도.
 *
 * 행사 상세의 탭과 계약서 관리 화면이 **이 함수 하나를** 쓴다.
 * 두 곳에서 따로 세면 "행사에서는 6명인데 전체에서는 4명"이 된다.
 *
 * 우리 직원(`isEmployee`)은 빠진다. 계약서를 쓰는 대상이 아니다.
 */
export const buildContractRoster = (
  event: ContractRosterEvent,
  assignments: readonly {
    staffId: number;
    staffName: string;
    staffPhone: string;
    role: JobRole;
    status: string;
    workDate: string;
    wageType: WageType;
    wage: number;
    /** 우리 직원이면 명단에 세우지 않는다. (아래 참조) */
    isEmployee?: boolean;
  }[],
  contracts: readonly Contract[],
  /** 하루 실근무시간. 행사에서 한 번만 구해 넘긴다. */
  dailyWorkHours: number,
): ContractRosterRow[] => {
  const byStaff = new Map<number, typeof assignments>();

  for (const assignment of assignments) {
    if (assignment.status !== "CONFIRMED") continue;

    /*
      직원은 세지 않는다.

      직원은 회사와 이미 근로계약이 되어 있고 급여도 월급으로 나간다.
      행사마다 다시 계약서를 쓰는 대상이 아니다. 명단에 세워 두면
      아무리 처리해도 '발급 전'이 줄지 않아, 그 숫자가 뜻을 잃는다.
      이 화면의 존재 이유가 "아직 못 쓴 사람 찾기"라 더더욱 섞이면 안 된다.
    */
    if (assignment.isEmployee) continue;

    byStaff.set(assignment.staffId, [
      ...(byStaff.get(assignment.staffId) ?? []),
      assignment,
    ]);
  }

  return [...byStaff.values()].map((own) => {
    const [first] = own;

    const work = summarizeContractWork(
      own.map((item) => ({
        workDate: item.workDate,
        wageType: item.wageType,
        wage: item.wage,
      })),
      dailyWorkHours,
    );

    /*
      한 사람에게 차수가 여럿일 수 있다. (재작성한 경우)
      지나간 문서(SUPERSEDED)가 대표로 잡히면 "이미 끝난 사람"으로 보이므로
      가장 높은 차수를 그 사람의 현재 상태로 삼는다.
    */
    const contract =
      contracts
        .filter(
          (item) =>
            item.eventId === event.eventId && item.staffId === first.staffId,
        )
        .sort((a, b) => b.revision - a.revision)[0] ?? null;

    return {
      rowId: `${event.eventId}-${first.staffId}`,
      eventId: event.eventId,
      eventTitle: event.title,
      clientName: event.clientName,
      venue: event.venue,
      staffId: first.staffId,
      staffName: first.staffName,
      staffPhone: first.staffPhone,
      roles: [...new Set(own.map((item) => item.role))],
      workDates: work.workDates,
      workDate: work.workDate,
      startTime: event.startTime,
      endTime: event.endTime,
      endDayOffset: event.endDayOffset,
      workHours: dailyWorkHours,
      totalWorkHours: work.totalWorkHours,
      wageType: work.wageType,
      wage: work.wage,
      hasMixedWage: work.hasMixedWage,
      totalWage: work.totalWage,
      state: contract?.status ?? "NONE",
      contract,
    };
  });
};

/** 파일명에 쓸 수 없는 글자는 폴더 구조로 읽히거나 저장 자체가 막힌다. */
const safeFileNamePart = (text: string) =>
  text.replace(/[\\/:*?"<>|()]/g, " ").replace(/\s+/g, " ").trim();

/**
 * 동명이인을 가르는 꼬리표. **휴대폰 뒤 네 자리**다.
 *
 * 한 행사에 '김민준'이 둘이면 파일명이 똑같아진다.
 * 폴더에 내려받는 순간 하나가 `...(1).pdf`로 밀리고, 그 순간
 * **어느 쪽이 누구 것인지 아는 방법이 사라진다.** 잘못 배부하면 남의 시급이 적힌
 * 계약서에 서명을 받게 된다.
 *
 * 이름이 겹치지 않으면 붙이지 않는다. 서른 명 전원에게 번호를 달면
 * 정작 조심해야 할 두 사람이 눈에 띄지 않는다.
 */
export const contractNameTag = (staffPhone: string): string =>
  staffPhone.replace(/\D/g, "").slice(-4);

/**
 * 한 행사 안에서 이름이 겹치는 사람들.
 *
 * **사람(`staffId`) 기준으로 센다.** 배치는 사람 × 날짜라서 사흘 나온 사람은
 * 세 건인데, 그걸 그대로 세면 혼자 나온 사람도 동명이인으로 잡힌다.
 */
export const findDuplicateStaffNames = (
  people: readonly { staffId: number; staffName: string }[],
): Set<string> => {
  const idsByName = new Map<string, Set<number>>();

  for (const person of people) {
    const ids = idsByName.get(person.staffName) ?? new Set<number>();

    ids.add(person.staffId);
    idsByName.set(person.staffName, ids);
  }

  return new Set(
    [...idsByName]
      .filter(([, ids]) => ids.size > 1)
      .map(([staffName]) => staffName),
  );
};

/**
 * 내려받는 계약서 파일의 이름.
 *
 * `261231_A브랜드 성수 팝업_김승우.pdf` 꼴이고,
 * 동명이인이 있으면 `261231_A브랜드 성수 팝업_김민준(7029).pdf`가 된다.
 *
 * 이 이름이 규칙이어야 하는 이유는 파일이 **브라우저 밖에서** 살기 때문이다.
 * 내려받아 출력하고, 서명받아 다시 스캔해 올리기까지 파일은 담당자의 폴더에 쌓인다.
 * 이름이 `document(3).pdf`면 서른 명짜리 행사에서 누구 것인지 열어 봐야 알고,
 * 잘못 올리면 남의 계약서가 그 사람 이름으로 등록된다.
 *
 * 규칙이 있으니 **거꾸로 읽을 수도 있다.** 서명본을 한 번에 여러 장 올릴 때
 * 파일명만 보고 누구 것인지 가려낸다. (`parseContractFileName`)
 *
 * 날짜를 앞에 두는 것은 폴더에서 이름순 정렬이 곧 날짜순이 되게 하기 위해서다.
 */
export const buildContractFileName = (
  /** 첫 근무일 (`YYYY-MM-DD`) */
  workDate: string,
  eventTitle: string,
  staffName: string,
  extension: string,
  /** 동명이인이 있을 때만 넘긴다. (`contractNameTag`) */
  nameTag?: string,
): string => {
  const date = workDate.replaceAll("-", "").slice(2);
  const name = safeFileNamePart(staffName);

  return `${date}_${safeFileNamePart(eventTitle)}_${name}${
    nameTag ? `(${nameTag})` : ""
  }.${extension}`;
};

/** 파일명에서 읽어 낸 것. 못 읽으면 `null`이다. */
export interface ParsedContractFileName {
  /** `YYMMDD` */
  date: string;
  eventTitle: string;
  staffName: string;
  /** 괄호 안의 휴대폰 뒤 네 자리. 동명이인이 아니면 없다. */
  nameTag?: string;
}

/**
 * 내려받은 파일명을 거꾸로 읽는다.
 *
 * 행사명에 `_`가 들어갈 수 있으므로 통째로 쪼개면 안 된다.
 * **맨 앞은 날짜, 맨 뒤는 이름**이고 그 사이가 전부 행사명이다.
 */
export const parseContractFileName = (
  fileName: string,
): ParsedContractFileName | null => {
  const base = fileName.replace(/\.[^.]+$/, "");
  const parts = base.split("_");

  if (parts.length < 3) return null;

  const [date] = parts;

  if (!/^\d{6}$/.test(date)) return null;

  const tail = parts[parts.length - 1];
  const matched = tail.match(/^(.+?)\((\d{4})\)$/);

  return {
    date,
    eventTitle: parts.slice(1, -1).join("_"),
    staffName: (matched ? matched[1] : tail).trim(),
    nameTag: matched?.[2],
  };
};

/**
 * 근무일 목록에서 계약서의 금액 관련 값을 한꺼번에 구한다.
 *
 * 계약서를 만드는 곳이 셋이다. (최초 일괄 생성 · 재작성 · 목업 시드)
 * 총 지급액 계산을 세 곳에 각각 두면 반드시 어긋나고, 그러면 같은 사람의
 * 1차 계약서와 2차 계약서가 서로 다른 규칙으로 계산된 금액을 갖게 된다.
 *
 * 시급 건은 하루치를 각각 반올림해서 더한다. 합계 시간에 금액을 한 번 곱하면
 * 정산(`calculatePayroll`)이 날짜별로 더한 값과 몇 원씩 어긋나, 계약서에 적힌
 * 금액과 실제 이체액이 달라진다.
 */
export const summarizeContractWork = (
  workDays: ContractWorkDay[],
  /** 하루 실근무시간 (행사 예정 시간 기준) */
  dailyWorkHours: number,
) => {
  const sorted = [...workDays].sort((a, b) =>
    a.workDate.localeCompare(b.workDate),
  );
  const [first] = sorted;

  return {
    workDays: sorted,
    workDates: sorted.map((day) => day.workDate),
    workDate: sorted[0]?.workDate ?? "",
    totalWorkHours: Math.round(dailyWorkHours * sorted.length * 10) / 10,
    wageType: first?.wageType ?? "HOURLY",
    wage: first?.wage ?? 0,
    hasMixedWage: sorted.some(
      (day) => day.wageType !== first?.wageType || day.wage !== first?.wage,
    ),
    totalWage: sorted.reduce(
      (sum, day) =>
        sum +
        (day.wageType === "DAILY"
          ? day.wage
          : Math.round(day.wage * dailyWorkHours)),
      0,
    ),
  };
};

/* ------------------------------------------------------------------ */
/* 변수 치환                                                            */
/* ------------------------------------------------------------------ */

/** 계약서 본문에서 치환할 수 있는 변수 목록 */
export const CONTRACT_VARIABLES: {
  token: string;
  description: string;
  group: string;
}[] = [
  { token: "{{이름}}", description: "근로자 성명", group: "근로자" },
  { token: "{{생년월일}}", description: "근로자 생년월일", group: "근로자" },
  { token: "{{연락처}}", description: "근로자 휴대폰번호", group: "근로자" },
  { token: "{{주소}}", description: "근로자 주소", group: "근로자" },
  { token: "{{행사명}}", description: "행사 제목", group: "근로" },
  { token: "{{근무일}}", description: "근무 일자 (여러 날이면 전부)", group: "근로" },
  { token: "{{근무기간}}", description: "첫 근무일 ~ 마지막 근무일", group: "근로" },
  { token: "{{근무일수}}", description: "총 근무 일수", group: "근로" },
  { token: "{{근무시간}}", description: "시작~종료 시각", group: "근로" },
  { token: "{{휴게시간}}", description: "휴게 시간(분)", group: "근로" },
  { token: "{{근무장소}}", description: "행사 장소", group: "근로" },
  { token: "{{직무}}", description: "배치된 직무", group: "근로" },
  { token: "{{임금}}", description: "지급 기준 + 금액 (예: 일급 150,000원)", group: "임금" },
  { token: "{{임금액}}", description: "금액만 (예: 150,000원)", group: "임금" },
  { token: "{{지급기준}}", description: "시급 또는 일급", group: "임금" },
  {
    token: "{{근무일별금액}}",
    description: "날마다 금액이 다를 때 근무일별로 적은 목록",
    group: "임금",
  },
  { token: "{{일근무시간}}", description: "하루 실근무시간", group: "임금" },
  { token: "{{총근무시간}}", description: "전체 실근무시간", group: "임금" },
  { token: "{{총지급액}}", description: "세전 총 지급액", group: "임금" },
  { token: "{{사업장명}}", description: "사업주 상호", group: "사업주" },
  { token: "{{대표자}}", description: "사업주 대표자명", group: "사업주" },
  { token: "{{사업자번호}}", description: "사업자등록번호", group: "사업주" },
  { token: "{{사업장주소}}", description: "사업장 주소", group: "사업주" },
  { token: "{{계약번호}}", description: "계약서 번호", group: "문서" },
  { token: "{{작성일}}", description: "계약서 작성일", group: "문서" },
];

/**
 * 템플릿 본문의 변수를 실제 값으로 치환한다.
 * 미리보기와 발송이 같은 결과를 내도록 한 함수만 쓴다.
 */
export const renderContractContent = (
  content: string,
  values: Record<string, string>,
): string =>
  content.replace(/\{\{(.+?)\}\}/g, (matched, key: string) => {
    const value = values[key.trim()];

    return value === undefined ? matched : value;
  });

/** 자동 조항의 표에 들어가는 한 줄 */
export interface ContractField {
  label: string;
  value: string;
}

/* ------------------------------------------------------------------ */
/* 문서 조립                                                            */
/* ------------------------------------------------------------------ */

/** 화면에 그릴 준비가 끝난 조항 */
export interface ContractDocumentSection {
  clauseId: string;
  title: string;
  kind: ClauseKind;
  /** 자동 조항이 채워 넣은 표 */
  fields: ContractField[];
  /** 자유 조항의 변수 치환이 끝난 본문 */
  body: string;
}

/** 미리보기 · 인쇄 · 서명 화면이 공유하는 최종 문서 */
export interface ContractDocument {
  documentTitle: string;
  contractNumber: string;
  companyName: string;
  companyRepresentative: string;
  companyRegistrationNumber: string;
  companyAddress: string;
  companyPhone: string;
  sections: ContractDocumentSection[];
  agreementNote: string;
  requiresGuardianSignature: boolean;
  issuedAt: string;
  /** 해시 계산과 문자 복사에 쓰는 평문 */
  plainText: string;
}

const formatMoney = (value: number) => `${value.toLocaleString("ko-KR")}원`;

/**
 * 번호가 아직 없는 문서에 찍는 문구.
 *
 * 빈칸으로 두면 인쇄본에서 "계약번호 " 뒤가 그냥 비어, 번호를 적다 만 문서로 읽힌다.
 * 이 문서가 아직 등록 전이라는 사실 자체를 종이에도 남긴다.
 */
export const UNISSUED_CONTRACT_NUMBER = "등록 시 발급";

/**
 * 근무일별 지급 조건을 한 줄로 적는다.
 *
 * 날마다 금액이 다른 계약은 "시급 12,000원" 한 줄로는 총액을 설명할 수 없다.
 * 서명하는 사람이 자기 문서의 숫자를 검산할 수 있어야 하므로 날짜별로 펼쳐 적는다.
 */
export const formatWorkDayWages = (workDays: ContractWorkDay[]): string =>
  workDays
    .map(
      (day) =>
        `${day.workDate.slice(5).replace("-", ".")} ${WAGE_TYPE_LABEL[day.wageType]} ${formatMoney(day.wage)}`,
    )
    .join(" / ");

/**
 * 계약서에 적는 대표 임금 문구.
 * 날마다 다른 건은 대표 금액을 적으면 안 되므로 그 사실을 그대로 적는다.
 */
export const describeContractWage = (contract: Contract): string =>
  contract.hasMixedWage
    ? "근무일별 상이 (아래 근무일별 금액 참조)"
    : `${WAGE_TYPE_LABEL[contract.wageType]} ${formatMoney(contract.wage)}`;

/**
 * 근무일 목록을 사람이 읽는 문구로 만든다.
 *
 * 다일 행사는 날짜가 열 개도 넘어갈 수 있다. 전부 나열하면 계약서가 읽히지 않으므로
 * 이어지는 구간은 "05.03~05.06"으로 묶고, 띄엄띄엄한 날만 따로 적는다.
 */
export const formatWorkDates = (workDates: string[]): string => {
  if (workDates.length === 0) return "-";

  const sorted = [...workDates].sort();
  const parts: string[] = [];

  let start = sorted[0];
  let previous = sorted[0];

  const flush = () => {
    parts.push(start === previous ? start : `${start} ~ ${previous}`);
  };

  sorted.slice(1).forEach((date) => {
    if (nextDateKey(previous) === date) {
      previous = date;
      return;
    }

    flush();
    start = date;
    previous = date;
  });

  flush();

  return parts.join(", ");
};

/**
 * 계약서 변수의 실제 값을 만든다.
 *
 * 자동 조항과 자유 조항이 같은 값을 쓰도록 한 곳에서만 계산한다.
 * 여기가 어긋나면 같은 문서 안에서 시급이 두 개로 적히는 사고가 난다.
 */
export const buildContractValues = (
  contract: Contract,
  template: ContractTemplate,
  jobRoleName: string,
): Record<string, string> => ({
  이름: contract.staffName,
  생년월일: contract.staffBirthDate || "-",
  연락처: contract.staffPhone,
  주소: contract.staffAddress || "-",
  행사명: contract.eventTitle,
  근무일: formatWorkDates(contract.workDates),
  근무기간:
    contract.workDates.length > 1
      ? `${contract.workDates[0]} ~ ${contract.workDates[contract.workDates.length - 1]}`
      : contract.workDates[0] ?? "-",
  근무일수: `${contract.workDates.length}일`,
  근무시간: formatTimeRange(
    contract.startTime,
    contract.endTime,
    contract.endDayOffset,
  ),
  휴게시간: String(contract.breakMinutes),
  근무장소: contract.venue || "-",
  직무: jobRoleName,
  지급기준: contract.hasMixedWage
    ? "근무일별 상이"
    : WAGE_TYPE_LABEL[contract.wageType],
  임금: describeContractWage(contract),
  임금액: contract.hasMixedWage
    ? formatWorkDayWages(contract.workDays)
    : formatMoney(contract.wage),
  근무일별금액: formatWorkDayWages(contract.workDays),
  // 시급으로 쓰던 기존 템플릿이 일급 계약서에서 엉뚱한 금액을 찍지 않도록 기준을 함께 적는다.
  시급: describeContractWage(contract),
  일근무시간: `${contract.workHours}시간`,
  총근무시간: `${contract.totalWorkHours}시간`,
  총지급액: formatMoney(contract.totalWage),
  사업장명: template.companyName,
  대표자: template.companyRepresentative,
  사업자번호: template.companyRegistrationNumber || "-",
  사업장주소: template.companyAddress,
  // 번호는 서명본을 등록할 때 붙는다. 그전에 내려받는 문서에는 아직 없다.
  계약번호: contract.contractNumber || UNISSUED_CONTRACT_NUMBER,
  작성일: contract.createdAt.slice(0, 10),
});

/** 자동 조항이 채우는 표를 만든다. */
const buildAutoFields = (
  kind: ClauseKind,
  contract: Contract,
  template: ContractTemplate,
  jobRoleName: string,
): ContractField[] => {
  switch (kind) {
    case "PARTIES":
      return [
        { label: "사업주(갑) 상호", value: template.companyName },
        { label: "대표자", value: template.companyRepresentative },
        {
          label: "사업자등록번호",
          value: template.companyRegistrationNumber || "-",
        },
        { label: "사업장 주소", value: template.companyAddress },
        { label: "근로자(을) 성명", value: contract.staffName },
        { label: "생년월일", value: contract.staffBirthDate || "-" },
        { label: "연락처", value: contract.staffPhone },
        { label: "주소", value: contract.staffAddress || "-" },
      ];

    case "WORK_CONDITION":
      return [
        { label: "행사명", value: contract.eventTitle },
        { label: "근무 장소", value: contract.venue || "-" },
        { label: "담당 직무", value: jobRoleName },
        { label: "근무일", value: formatWorkDates(contract.workDates) },
        { label: "총 근무일수", value: `${contract.workDates.length}일` },
        {
          label: "근무 시간",
          value: `${formatTimeRange(
            contract.startTime,
            contract.endTime,
            contract.endDayOffset,
          )} (휴게 ${contract.breakMinutes}분)`,
        },
        { label: "일 실근무시간", value: `${contract.workHours}시간` },
        /*
          재작성본은 그 사실이 문서 안에 남아야 한다.
          "며칠이 왜 빠졌는가"가 적혀 있지 않으면, 나중에 이 문서 한 장만 보고는
          당초 계약과 무엇이 달라졌는지 알 수 없어 분쟁의 근거가 되지 못한다.
        */
        ...(contract.revision > 1
          ? [
              {
                label: "계약 차수",
                value: `${contract.revision}차 (재작성본, 이전 계약 대체)`,
              },
              {
                label: "당초 계약에서 제외된 근무일",
                value:
                  contract.removedWorkDates?.length
                    ? formatWorkDates(contract.removedWorkDates)
                    : "-",
              },
              {
                label: "재작성 구분",
                value: contract.amendReasonType
                  ? AMEND_REASON_LABEL[contract.amendReasonType]
                  : "-",
              },
              { label: "재작성 사유", value: contract.amendReason || "-" },
              ...(contract.amendNote
                ? [{ label: "변경 내용", value: contract.amendNote }]
                : []),
            ]
          : []),
      ];

    case "WAGE":
      return [
        {
          label: contract.hasMixedWage
            ? "지급 기준"
            : WAGE_TYPE_LABEL[contract.wageType],
          value: contract.hasMixedWage
            ? "근무일별 상이"
            : formatMoney(contract.wage),
        },
        /*
          날마다 조건이 다른 건은 근무일별 금액을 그대로 펼쳐 적는다.
          이 줄이 없으면 총 지급액이 어디서 나온 숫자인지 문서만 보고 알 수 없다.
        */
        ...(contract.hasMixedWage
          ? [
              {
                label: "근무일별 금액",
                value: formatWorkDayWages(contract.workDays),
              },
            ]
          : []),
        /*
          지급액의 근거가 되는 수량을 함께 적는다.
          시급 계약은 시간이, 일급 계약은 날수가 곱해지는 값이다.
        */
        contract.wageType === "DAILY" && !contract.hasMixedWage
          ? { label: "근무일수", value: `${contract.workDates.length}일` }
          : { label: "총 실근무시간", value: `${contract.totalWorkHours}시간` },
        {
          label: "총 지급액 (세전)",
          value: formatMoney(contract.totalWage),
        },
        { label: "지급일", value: "근무 종료일로부터 7일 이내" },
        {
          label: "지급 방법",
          value:
            "을이 지정한 계좌로 입금하며, 사업소득세 3.3%를 원천징수한다.",
        },
      ];

    default:
      return [];
  }
};

/**
 * 계약서 한 장을 조립한다.
 *
 * 미리보기 · 인쇄 · 서명 화면이 서로 다른 문서를 보여 주면
 * "내가 서명한 것과 다르다"는 다툼이 생긴다. 세 화면 모두 이 함수만 쓴다.
 */
export const buildContractDocument = (
  contract: Contract,
  template: ContractTemplate,
  jobRoleName: string,
): ContractDocument => {
  const values = buildContractValues(contract, template, jobRoleName);

  const sections: ContractDocumentSection[] = template.clauses.map((clause) => ({
    clauseId: clause.clauseId,
    title: clause.title,
    kind: clause.kind,
    fields: buildAutoFields(clause.kind, contract, template, jobRoleName),
    body:
      clause.kind === "TEXT" ? renderContractContent(clause.body, values) : "",
  }));

  const plainText = [
    template.documentTitle,
    `계약번호: ${contract.contractNumber || UNISSUED_CONTRACT_NUMBER}`,
    ...sections.map((section) =>
      [
        section.title,
        ...section.fields.map((field) => `  - ${field.label}: ${field.value}`),
        section.body,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    template.agreementNote,
  ].join("\n\n");

  return {
    documentTitle: template.documentTitle,
    contractNumber: contract.contractNumber || UNISSUED_CONTRACT_NUMBER,
    companyName: template.companyName,
    companyRepresentative: template.companyRepresentative,
    companyRegistrationNumber: template.companyRegistrationNumber,
    companyAddress: template.companyAddress,
    companyPhone: template.companyPhone,
    sections,
    agreementNote: template.agreementNote,
    requiresGuardianSignature: template.requiresGuardianSignature,
    issuedAt: contract.createdAt,
    plainText,
  };
};

/* ------------------------------------------------------------------ */
/* A4 지면                                                              */
/* ------------------------------------------------------------------ */

/**
 * A4 한 장의 크기(px, 96dpi 기준)와 인쇄 여백.
 *
 * 계약서는 결국 종이로 나가는 문서다. 화면에서 길이가 얼마든 상관없이
 * 흘려 보여 주면, 조항을 잔뜩 넣은 템플릿이 인쇄 시 몇 장이 되는지,
 * 서명란이 마지막 장에 혼자 떨어지지는 않는지를 만들면서 알 수 없다.
 * 그래서 미리보기에서 지면 경계를 실제 치수로 그린다.
 * (여백 값은 globals.css의 `@page { margin: 16mm 14mm }`와 맞춰 둔 것이다)
 */
export const A4_PAGE_WIDTH = 794;
export const A4_PAGE_HEIGHT = 1123;
export const A4_PAGE_MARGIN_X = 53;
export const A4_PAGE_MARGIN_Y = 60;

/** 한 장에 실제로 글이 들어가는 높이 */
export const A4_CONTENT_HEIGHT = A4_PAGE_HEIGHT - A4_PAGE_MARGIN_Y * 2;

/** 문서 높이로 인쇄 장수를 구한다. */
export const resolveA4PageCount = (contentHeight: number): number =>
  Math.max(1, Math.ceil(contentHeight / A4_CONTENT_HEIGHT));

/**
 * 미리보기용 예시 계약서.
 *
 * 템플릿을 만드는 사람에게 필요한 것은 "내 양식이 실제 문서로 어떻게 나오는가"다.
 * 조항 제목과 본문만 나열해 보여 주면 자동 조항이 어떤 표로 채워지는지,
 * `{{변수}}`가 무엇으로 바뀌는지를 발송해 봐야 안다.
 * 그래서 그럴듯한 값이 들어간 가짜 계약서 한 건을 만들어 그대로 조립한다.
 *
 * 여러 날 · 시급 계약을 예시로 삼는다. 하루짜리로 두면 근무일수 · 총 근무시간
 * 같은 칸이 전부 1과 같아 보여 계산이 맞는지 알 수 없다.
 */
export const buildSampleContract = (): Contract => ({
  contractId: 0,
  contractNumber: "CT-SAMPLE-0001",
  staffId: 0,
  staffName: "홍길동",
  staffPhone: "010-1234-5678",
  staffBirthDate: "1998-04-12",
  staffAddress: "서울특별시 마포구 양화로 100, 3층",
  eventId: 0,
  eventTitle: "○○ 브랜드 팝업스토어 운영",
  clientName: "○○ 커뮤니케이션",
  venue: "코엑스 A홀",
  role: "STAFF",
  templateId: 0,
  templateName: "미리보기",
  workDates: ["2025-05-03", "2025-05-04", "2025-05-05"],
  workDays: [
    { workDate: "2025-05-03", wageType: "HOURLY", wage: 12000 },
    { workDate: "2025-05-04", wageType: "HOURLY", wage: 12000 },
    { workDate: "2025-05-05", wageType: "HOURLY", wage: 12000 },
  ],
  workDate: "2025-05-03",
  startTime: "09:00",
  endTime: "18:00",
  endDayOffset: 0,
  breakMinutes: 60,
  workHours: 8,
  totalWorkHours: 24,
  wageType: "HOURLY",
  wage: 12000,
  hasMixedWage: false,
  totalWage: 288000,
  status: "DRAFT",
  revision: 1,
  createdAt: new Date().toISOString(),
});

/** 기본 조항 구성. 새 템플릿을 만들 때 이 골격에서 출발한다. */
export const DEFAULT_CONTRACT_CLAUSES: ContractClause[] = [
  {
    clauseId: "parties",
    title: "제1조 (당사자)",
    kind: "PARTIES",
    body: "",
  },
  {
    clauseId: "work-condition",
    title: "제2조 (근로조건)",
    kind: "WORK_CONDITION",
    body: "",
  },
  {
    clauseId: "wage",
    title: "제3조 (임금)",
    kind: "WAGE",
    body: "",
  },
  {
    clauseId: "duty",
    title: "제4조 (근로자의 의무)",
    kind: "TEXT",
    body: `1. 을은 집합 시간 15분 전까지 지정된 장소에 도착하여야 한다.
2. 을은 갑이 정한 복장 규정을 준수한다.
3. 을은 업무 중 취득한 거래처 정보를 외부에 누설하지 아니한다.`,
  },
  {
    clauseId: "etc",
    title: "제5조 (기타)",
    kind: "TEXT",
    body: `1. 본 계약에 명시되지 않은 사항은 근로기준법에 따른다.
2. 을의 귀책사유로 근로를 제공하지 못한 경우 해당 일자의 임금은 지급하지 아니한다.`,
  },
];
