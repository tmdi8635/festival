import type { Contract, ContractTemplate } from "@/type/contract";
import {
  buildContractFileName,
  contractNameTag,
  findDuplicateStaffNames,
  summarizeContractWork,
} from "@/type/contract";
import { buildPlaceholderPdfDataUrl } from "../placeholderPdf";
import {
  calculateScheduledWorkHours,
  groupAssignmentsByStaff,
} from "@/type/event";
import { daysAgo, toIsoDateTime } from "../utils";
import { events } from "./event";
import { findStaff } from "./staff";

/**
 * 사업주 정보.
 *
 * 계약서마다 같은 값이 들어가므로 템플릿이 들고 있는다.
 * 실제로는 한 번 입력해 두고 모든 템플릿이 이 값을 물려받는다.
 */
const COMPANY = {
  companyName: "휴먼커넥트 이벤트",
  companyRepresentative: "김도윤",
  companyRegistrationNumber: "312-81-40217",
  companyAddress: "서울 성동구 연무장길 41, 3층",
  companyPhone: "0221450917",
};

/**
 * 근로계약서 템플릿 목업.
 *
 * 예전 방식의 문제는 두 가지였다.
 * 하나는 모든 사람에게 같은 금액이 적힌 문서가 나간 것,
 * 다른 하나는 그 문서가 그냥 문자 본문이라 서명도 보관도 되지 않았다는 것이다.
 *
 * 그래서 조항 단위로 쪼개고, 금액 · 인적사항 · 근로조건은 자동 조항으로 고정한다.
 * 자동 조항은 사람이 손댈 수 없고 배치 정보에서 그대로 채워진다.
 */
export const contractTemplates: ContractTemplate[] = [
  {
    templateId: 1,
    name: "일용직 표준 근로계약서 (공통)",
    targetRoles: [],
    documentTitle: "표준 근로계약서 (일용직)",
    ...COMPANY,
    clauses: [
      { clauseId: "parties", title: "제1조 (당사자)", kind: "PARTIES", body: "" },
      {
        clauseId: "work-condition",
        title: "제2조 (근로조건)",
        kind: "WORK_CONDITION",
        body: "",
      },
      { clauseId: "wage", title: "제3조 (임금)", kind: "WAGE", body: "" },
      {
        clauseId: "duty",
        title: "제4조 (근로자의 의무)",
        kind: "TEXT",
        body: `1. 을은 집합 시간 15분 전까지 지정된 장소에 도착하여야 한다.
2. 을은 갑이 정한 복장 규정을 준수하며, 미준수로 발생한 비용은 을이 부담한다.
3. 을은 업무 중 취득한 거래처 정보 및 행사 내용을 외부에 누설하지 아니한다.
4. 을은 휴게시간을 갑이 지정한 순번에 따라 사용한다.`,
      },
      {
        clauseId: "termination",
        title: "제5조 (계약의 해지)",
        kind: "TEXT",
        body: `1. 을이 사전 통보 없이 근로를 제공하지 아니한 경우 갑은 본 계약을 즉시 해지할 수 있다.
2. 제1항의 경우 해당 일자의 임금은 지급하지 아니한다.`,
      },
      {
        clauseId: "etc",
        title: "제6조 (기타)",
        kind: "TEXT",
        body: `1. 본 계약에 명시되지 않은 사항은 근로기준법에 따른다.
2. 본 계약은 2부를 작성하여 갑과 을이 각각 1부씩 보관한다.`,
      },
    ],
    agreementNote:
      "본인은 위 근로조건을 충분히 확인하였으며, 이에 동의하여 아래와 같이 서명합니다.",
    requiresGuardianSignature: false,
    isDefault: true,
    isActive: true,
    usageCount: 412,
    updatedAt: daysAgo(40),
    createdAt: daysAgo(400),
  },
  {
    templateId: 2,
    name: "팀장 근로계약서 (현장 관리)",
    targetRoles: ["SUPERVISOR"],
    documentTitle: "표준 근로계약서 (현장 관리 직무)",
    ...COMPANY,
    clauses: [
      { clauseId: "parties", title: "제1조 (당사자)", kind: "PARTIES", body: "" },
      {
        clauseId: "work-condition",
        title: "제2조 (근로조건)",
        kind: "WORK_CONDITION",
        body: "",
      },
      {
        clauseId: "responsibility",
        title: "제3조 (관리 직무의 책임)",
        kind: "TEXT",
        body: `1. 을은 배치 인원의 출퇴근을 확인하고 근태를 갑에게 보고한다.
2. 을은 현장 이슈 발생 시 담당 매니저에게 즉시 보고한다.
3. 을은 행사 종료 후 배치 인원에 대한 평가를 제출한다.`,
      },
      { clauseId: "wage", title: "제4조 (임금)", kind: "WAGE", body: "" },
      {
        clauseId: "etc",
        title: "제5조 (기타)",
        kind: "TEXT",
        body: `1. 본 계약에 명시되지 않은 사항은 근로기준법에 따른다.
2. 관리 수당은 제4조의 시급에 이미 포함되어 있다.`,
      },
    ],
    agreementNote:
      "본인은 위 근로조건과 관리 직무의 책임을 확인하였으며, 이에 동의하여 서명합니다.",
    requiresGuardianSignature: false,
    isDefault: false,
    isActive: true,
    usageCount: 86,
    updatedAt: daysAgo(22),
    createdAt: daysAgo(310),
  },
  {
    templateId: 3,
    name: "다일 행사 근로계약서 (2일 이상)",
    targetRoles: [],
    documentTitle: "표준 근로계약서 (다일 행사)",
    ...COMPANY,
    clauses: [
      { clauseId: "parties", title: "제1조 (당사자)", kind: "PARTIES", body: "" },
      {
        clauseId: "work-condition",
        title: "제2조 (근로조건)",
        kind: "WORK_CONDITION",
        body: "",
      },
      { clauseId: "wage", title: "제3조 (임금)", kind: "WAGE", body: "" },
      {
        clauseId: "multiday",
        title: "제4조 (다일 근로의 특칙)",
        kind: "TEXT",
        // {{근무일수}}는 "3일"처럼 단위까지 채워지는 변수다. 뒤에 '일'을 또 붙이면 "3일일"이 된다.
        body: `1. 본 계약의 근로일은 총 {{근무일수}}이며, 근무일은 {{근무일}}이다.
2. 을이 일부 근로일에만 근로를 제공한 경우, 임금은 실제 근로한 일자에 대해서만 지급한다.
3. 을이 사전 협의 없이 잔여 근로일에 출근하지 아니한 경우 갑은 대체 인력 투입 비용을 청구할 수 있다.`,
      },
      {
        clauseId: "etc",
        title: "제5조 (기타)",
        kind: "TEXT",
        body: "본 계약에 명시되지 않은 사항은 근로기준법에 따른다.",
      },
    ],
    agreementNote:
      "본인은 위 근로조건과 근무일 전체를 확인하였으며, 이에 동의하여 서명합니다.",
    requiresGuardianSignature: false,
    isDefault: false,
    isActive: true,
    usageCount: 54,
    updatedAt: daysAgo(65),
    createdAt: daysAgo(280),
  },
  {
    templateId: 4,
    name: "미성년 근로계약서 (친권자 동의 포함)",
    targetRoles: [],
    documentTitle: "표준 근로계약서 (18세 미만)",
    ...COMPANY,
    clauses: [
      { clauseId: "parties", title: "제1조 (당사자)", kind: "PARTIES", body: "" },
      {
        clauseId: "work-condition",
        title: "제2조 (근로조건)",
        kind: "WORK_CONDITION",
        body: "",
      },
      { clauseId: "wage", title: "제3조 (임금)", kind: "WAGE", body: "" },
      {
        clauseId: "minor",
        title: "제4조 (연소근로자 보호)",
        kind: "TEXT",
        body: `1. 본 계약은 친권자 동의서와 가족관계증명서 제출을 전제로 효력이 발생한다.
2. 갑은 을에게 22시 이후의 근로를 시키지 아니한다.
3. 갑은 을에게 1일 7시간, 1주 35시간을 초과하는 근로를 시키지 아니한다.`,
      },
    ],
    agreementNote:
      "본인과 친권자는 위 근로조건을 확인하였으며, 이에 동의하여 서명합니다.",
    requiresGuardianSignature: true,
    isDefault: false,
    isActive: false,
    usageCount: 3,
    updatedAt: daysAgo(150),
    createdAt: daysAgo(150),
  },
];

/** 계약서 번호는 `HC-YYYYMMDD-순번` 형태로 만든다. */
export const buildContractNumber = (
  workDate: string,
  sequence: number,
): string =>
  `HC-${workDate.replace(/-/g, "")}-${String(sequence).padStart(3, "0")}`;

let contractSequence = 0;

/**
 * 근로계약서 목업.
 *
 * 실제 배치(assignment)에서 파생시켜야 계약서 화면과 행사 화면의 숫자가 어긋나지 않는다.
 * 여러 날 나오는 사람은 계약서를 날마다 만들지 않고 한 장에 근무일을 모두 적는다.
 * (현장에서도 그렇게 쓴다. 3일 행사에 계약서 3장을 받지는 않는다)
 *
 * **서명본을 등록한 사람만 계약서를 갖는다.** 아직 안 받은 사람은 기록 자체가 없고,
 * 명단에서 '발급 전'으로 나타난다. 종이를 받기도 전에 문서 기록이 생기면
 * 화면에는 계약서가 있는 것으로 보이고, 그 상태로 현장에 사람이 들어간다.
 */
export const contracts: Contract[] = events
  .filter((event) => event.status !== "DRAFT" && event.status !== "CANCELED")
  .flatMap((event) => {
    const workHours = calculateScheduledWorkHours(event);

    /*
      한 행사 안에서 이름이 겹치는 사람들.
      겹칠 때만 파일명에 휴대폰 뒤 네 자리를 붙인다. (`buildContractFileName`)
    */
    const duplicateNames = findDuplicateStaffNames(event.assignments);

    /** 한 사람이 여러 날 나오면 배치가 여러 건이다. 사람 단위로 묶는다. */
    return groupAssignmentsByStaff(event.assignments)
      .filter((assignments) => assignments[0].isContractSigned)
      .map((assignments, index) => {
      const [first] = assignments;
      const staff = findStaff(first.staffId);

      /*
        금액은 배치가 들고 있는 값을 날짜별로 그대로 옮긴다.
        행사 안에서 사람마다 · 날마다 시급을 고칠 수 있으므로,
        대표 금액 하나에 일수를 곱하면 실제 지급액과 어긋난다.
      */
      const work = summarizeContractWork(
        assignments.map((item) => ({
          workDate: item.workDate,
          wageType: item.wageType,
          wage: item.wage,
        })),
        workHours,
      );
      const { workDates } = work;

      const template =
        first.role === "SUPERVISOR"
          ? contractTemplates[1]
          : workDates.length > 1
            ? contractTemplates[2]
            : contractTemplates[0];

      const contractNumber = buildContractNumber(workDates[0], index + 1);

      contractSequence += 1;

      return {
        contractId: contractSequence,
        contractNumber,
        staffId: first.staffId,
        staffName: first.staffName,
        staffPhone: first.staffPhone,
        staffBirthDate: staff?.birthDate ?? "",
        staffAddress: staff?.address ?? "",
        eventId: event.eventId,
        eventTitle: event.title,
        clientName: event.clientName,
        venue: event.venue,
        role: first.role,
        templateId: template.templateId,
        templateName: template.name,
        startTime: event.startTime,
        endTime: event.endTime,
        endDayOffset: event.endDayOffset,
        breakMinutes: event.breakMinutes,
        workHours,
        // 근무일 · 총 시간 · 총액은 한 곳에서만 계산한다.
        ...work,
        status: "SIGNED",
        revision: 1,
        /*
          서명본 파일.

          이름은 **실제와 같은 규칙으로** 만든다. 담당자가 폴더에서 찾는 것이
          이 이름이고, 화면에 다른 규칙으로 적히면 규칙이 있는 줄도 모르게 된다.

          내용은 진짜 PDF 한 장을 넣는다. 빈 값으로 두면 화면의 "올린 파일 미리보기"가
          목업에서 영영 확인되지 않는데, 담당자가 제일 조심해야 하는 것이
          **누구 것이 올라갔는가**라서 그 자리를 비워 둘 수 없다.
        */
        signedFile: {
          url: buildPlaceholderPdfDataUrl([
            "SIGNED EMPLOYMENT CONTRACT (SAMPLE SCAN)",
            `Contract No. ${contractNumber}`,
            `Work date  ${workDates[0]}`,
            "",
            "This page stands in for a scanned paper copy.",
          ]),
          fileName: buildContractFileName(
            workDates[0],
            event.title,
            first.staffName,
            "pdf",
            duplicateNames.has(first.staffName)
              ? contractNameTag(first.staffPhone)
              : undefined,
          ),
          mimeType: "application/pdf",
          uploadedAt: toIsoDateTime(workDates[0], "09:30"),
        },
        registeredAt: toIsoDateTime(workDates[0], "09:30"),
        createdAt: first.createdAt,
        } satisfies Contract;
      },
    );
  });

export const findContract = (contractId: number) =>
  contracts.find((contract) => contract.contractId === contractId);

export const findContractTemplate = (templateId: number) =>
  contractTemplates.find((template) => template.templateId === templateId);

/** 인력 상세에서 이 사람의 계약서를 최근 순으로 본다. */
export const contractsByStaff = (staffId: number) =>
  contracts
    .filter((contract) => contract.staffId === staffId)
    .sort((a, b) => b.workDate.localeCompare(a.workDate));

/**
 * 특정 근무일이 포함된 계약서를 찾는다.
 *
 * 참여 이력 한 줄에 계약 상태와 계약번호를 함께 보여 주기 위한 조회다.
 * 계약서 탭을 따로 두면 "이 행사 때 계약서가 나갔나"를 확인하려고 탭을 오가야 한다.
 */
export const findContractByWork = (staffId: number, workDate: string) =>
  contracts.find(
    (contract) =>
      contract.staffId === staffId && contract.workDates.includes(workDate),
  );
