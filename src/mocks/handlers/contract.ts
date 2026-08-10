import { HttpResponse, delay, http } from "msw";
import type {
  Contract,
  ContractStatus,
  ContractTemplate,
  ContractTemplateFormValues,
} from "@/type/contract";
import {
  CONTRACT_ROSTER_STATE_ORDER,
  buildContractRoster,
  summarizeContractWork,
  type AmendReasonType,
} from "@/type/contract";
import {
  calculateScheduledWorkHours,
  type Assignment,
  type EventDetail,
} from "@/type/event";
import {
  buildContractNumber,
  contractTemplates,
  contracts,
  findContract,
  findContractTemplate,
} from "../db/contract";
import { events, findEvent, recalculateEventCounts } from "../db/event";
import {
  syncPayrollWithAssignment,
  syncPayrollWithContract,
} from "../db/payroll";
import { findStaff } from "../db/staff";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  badRequest,
  matchesKeyword,
  nextId,
  notFound,
  paginate,
  requirePermission,
} from "../utils";
import type { JobRole } from "@/type/staff";

/**
 * 배치에서 계약서 한 장을 조립한다.
 *
 * 미리보기와 등록이 같은 함수를 쓴다. 두 곳에서 따로 조립하면
 * 담당자가 내려받아 서명받은 문서와, 등록 뒤에 화면에 뜨는 문서의
 * 금액이나 근무일이 어긋날 수 있다. 그러면 서명은 무엇에 대한 것인지 알 수 없다.
 *
 * 저장하지 않은 상태를 그대로 돌려주므로 `contractId`와 번호는 비어 있다.
 * 둘 다 **등록되는 순간에** 붙는다.
 */
const buildContractFrom = (
  event: EventDetail,
  assignments: Assignment[],
  template: ContractTemplate,
): Contract => {
  const [first] = assignments;
  const staff = findStaff(first.staffId);
  const workHours = calculateScheduledWorkHours(event);

  /*
    금액은 배치가 날짜별로 들고 있는 값을 그대로 옮긴다.
    같은 사람도 첫날만 설치 일급, 이후는 시급인 경우가 있어
    대표 금액 하나에 일수를 곱하면 총액이 실제와 어긋난다.
  */
  const work = summarizeContractWork(
    assignments.map((item) => ({
      workDate: item.workDate,
      wageType: item.wageType,
      wage: item.wage,
    })),
    workHours,
  );

  return {
    contractId: 0,
    contractNumber: "",
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
    ...work,
    status: "DRAFT",
    revision: 1,
    createdAt: new Date().toISOString(),
  };
};

/**
 * 계약서가 덮는 근무일의 배치를 서명 완료로 표시한다.
 *
 * 계약서 한 장이 여러 근무일을 덮으므로 해당 날짜의 배치를 전부 처리한다.
 * 이 표시가 곧 "이 사람을 현장에 넣어도 되는가"의 근거다.
 */
const markAssignmentsSigned = (contract: Contract) => {
  const event = findEvent(contract.eventId);

  if (!event) return;

  event.assignments
    .filter(
      (item) =>
        item.staffId === contract.staffId &&
        contract.workDates.includes(item.workDate),
    )
    .forEach((item) => {
      item.isContractSigned = true;
    });

  /*
    정산까지 여기서 이어 준다.

    계약서가 완료되는 것이 **정산에 오르는 두 조건 중 하나**다.
    (`isSettlementReady`) 여기서 이어 주지 않으면 계약서를 다 받아 놓고도
    정산 화면에는 그 사람이 없고, 담당자는 어디를 더 눌러야 하는지 모른다.
  */
  syncPayrollWithContract(event, contract.staffId);
};

/** 서명을 되돌린다. 정산에 올라 있던 건은 근거를 잃으므로 함께 내려간다. */
const unmarkAssignmentsSigned = (contract: Contract) => {
  const event = findEvent(contract.eventId);

  if (!event) return;

  event.assignments
    .filter(
      (item) =>
        item.staffId === contract.staffId &&
        contract.workDates.includes(item.workDate),
    )
    .forEach((item) => {
      item.isContractSigned = false;
    });

  syncPayrollWithContract(event, contract.staffId);
};

export const contractHandlers = [
  http.get(`${BASE_URI}/admin/contracts`, async ({ request }) => {
    const denied = requirePermission(request, "contract:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const status = url.searchParams.get("status") as ContractStatus | null;
    const eventId = url.searchParams.get("eventId") ?? "";
    const staffId = url.searchParams.get("staffId") ?? "";
    const startDate = url.searchParams.get("startDate") ?? "";
    const endDate = url.searchParams.get("endDate") ?? "";

    const filtered = contracts.filter((contract) => {
      if (status && contract.status !== status) return false;
      if (eventId && String(contract.eventId) !== eventId) return false;
      if (staffId && String(contract.staffId) !== staffId) return false;
      if (startDate && contract.workDate < startDate) return false;
      if (endDate && contract.workDate > endDate) return false;

      return matchesKeyword(
        keyword,
        contract.staffName,
        contract.eventTitle,
        contract.contractNumber,
        contract.staffPhone,
      );
    });

    const sorted = [...filtered].sort((a, b) =>
      b.workDate.localeCompare(a.workDate),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(sorted, url));
  }),

  http.get(`${BASE_URI}/admin/contracts/:contractId`, async ({ params, request }) => {
    const denied = requirePermission(request, "contract:read");

    if (denied) return denied;

    const contract = findContract(Number(params.contractId));

    await delay(MOCK_DELAY_MS);

    if (!contract) return notFound("존재하지 않는 계약서입니다.");

    return HttpResponse.json(contract);
  }),

  /**
   * 계약 명단. **행사를 가로질러** 계약해야 할 사람을 전부 센다.
   *
   * 계약서 목록에서 세면 안 된다. 서명본을 올려야 기록이 생기므로
   * 아직 아무것도 안 한 사람은 목록에 아예 없는데, 그 사람이 제일 급하다.
   * 그래서 **확정 배치**에서 세고, 등록된 계약서를 그 위에 붙인다.
   */
  http.get(`${BASE_URI}/admin/contract-roster`, async ({ request }) => {
    const denied = requirePermission(request, "contract:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const eventId = url.searchParams.get("eventId") ?? "";
    const role = url.searchParams.get("role") ?? "";
    const startDate = url.searchParams.get("startDate") ?? "";
    const endDate = url.searchParams.get("endDate") ?? "";

    /*
      취소 · 작성중 행사는 세지 않는다.
      아직 나갈지 모르는 행사의 계약서까지 '못 받은 것'으로 세면,
      정작 이번 주에 나가는 행사의 미등록이 그 숫자에 묻힌다.
    */
    const rows = events
      .filter((event) => event.status !== "DRAFT" && event.status !== "CANCELED")
      .flatMap((event) =>
        buildContractRoster(
          event,
          event.assignments,
          contracts,
          calculateScheduledWorkHours(event),
        ),
      );

    /* 상태별 인원은 **거른 뒤가 아니라 전체 기준**이다. 상단 지표로 쓴다. */
    const stateCounts = rows.reduce(
      (counts, row) => ({ ...counts, [row.state]: counts[row.state] + 1 }),
      { NONE: 0, DRAFT: 0, SIGNED: 0, SUPERSEDED: 0 },
    );

    const filtered = rows.filter((row) => {
      if (state && row.state !== state) return false;
      if (eventId && String(row.eventId) !== eventId) return false;
      if (role && !row.roles.includes(role as JobRole)) return false;
      if (startDate && row.workDate < startDate) return false;
      if (endDate && row.workDate > endDate) return false;

      return matchesKeyword(
        keyword,
        row.staffName,
        row.eventTitle,
        row.staffPhone,
        row.clientName,
        row.contract?.contractNumber ?? "",
      );
    });

    /*
      아직 못 받은 사람이 맨 위다. 그 줄이 이 화면의 존재 이유다.
      같은 상태 안에서는 근무일이 빠른 것부터. 시간이 없는 쪽이 급하다.
    */
    const sorted = [...filtered].sort(
      (a, b) =>
        CONTRACT_ROSTER_STATE_ORDER.indexOf(a.state) -
          CONTRACT_ROSTER_STATE_ORDER.indexOf(b.state) ||
        a.workDate.localeCompare(b.workDate) ||
        a.staffName.localeCompare(b.staffName),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ ...paginate(sorted, url), stateCounts });
  }),

  /**
   * 아직 등록되지 않은 사람의 계약서 미리보기.
   *
   * 서명본을 받기 전에는 계약서 기록이 없다. 그런데 담당자는 그 전에
   * 문서를 보고 내려받아야 한다. 배부할 종이가 바로 그것이기 때문이다.
   * 그래서 **저장하지 않고 조립만 해서** 돌려준다. 번호는 아직 없다.
   */
  http.get(
    `${BASE_URI}/admin/events/:eventId/contract-draft`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "contract:read");

      if (denied) return denied;

      const url = new URL(request.url);
      const staffId = Number(url.searchParams.get("staffId"));
      const templateId = Number(url.searchParams.get("templateId"));

      const event = findEvent(Number(params.eventId));

      if (!event) return notFound("존재하지 않는 행사입니다.");

      const template =
        findContractTemplate(templateId) ??
        contractTemplates.find((item) => item.isDefault && item.isActive) ??
        contractTemplates.find((item) => item.isActive);

      if (!template) return badRequest("계약서 템플릿을 선택해 주세요.");

      const assignments = event.assignments
        .filter(
          (assignment) =>
            assignment.staffId === staffId && assignment.status === "CONFIRMED",
        )
        .sort((a, b) => a.workDate.localeCompare(b.workDate));

      if (assignments.length === 0) {
        return badRequest(
          "확정된 배치가 없습니다. 배치를 확정한 뒤 계약서를 만들어 주세요.",
        );
      }

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json({
        contract: buildContractFrom(event, assignments, template),
        template,
      });
    },
  ),

  /**
   * 여러 명분을 한 번에 조립한다. (명단에서 골라 일괄로 내려받을 때)
   *
   * 확정 배치가 없는 사람은 조용히 건너뛴다. 한 명 때문에 전체가 실패하면
   * 스물아홉 장을 못 받는다. 담당자가 세어 보면 빠진 사람은 바로 보인다.
   */
  http.post(
    `${BASE_URI}/admin/events/:eventId/contract-drafts`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "contract:read");

      if (denied) return denied;

      const body = (await request.json()) as {
        staffIds: number[];
        templateId?: number;
      };

      const event = findEvent(Number(params.eventId));

      if (!event) return notFound("존재하지 않는 행사입니다.");

      const template =
        findContractTemplate(Number(body.templateId)) ??
        contractTemplates.find((item) => item.isDefault && item.isActive) ??
        contractTemplates.find((item) => item.isActive);

      if (!template) return badRequest("계약서 템플릿을 선택해 주세요.");

      const items = body.staffIds
        .map((staffId) =>
          event.assignments
            .filter(
              (assignment) =>
                assignment.staffId === staffId &&
                assignment.status === "CONFIRMED",
            )
            .sort((a, b) => a.workDate.localeCompare(b.workDate)),
        )
        .filter((assignments) => assignments.length > 0)
        .map((assignments) => ({
          contract: buildContractFrom(event, assignments, template),
          template,
        }));

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json({ items });
    },
  ),

  /**
   * 서명받은 계약서를 등록한다.
   *
   * 서버가 없는 동안 계약을 성립시키는 요청은 이것 하나뿐이다.
   * 서명본 파일이 올라온 이 시점에 **계약번호가 붙고 서명완료가 된다.**
   * 파일 없이 완료로 바꿀 수 있는 길은 어디에도 두지 않는다.
   * 그 길이 있으면 종이가 없는 사람도 화면에서는 완료로 보이게 되고,
   * 정작 필요할 때 근거가 되는 종이가 없다.
   */
  http.post(`${BASE_URI}/admin/contracts/register`, async ({ request }) => {
    const denied = requirePermission(request, "contract:write");

    if (denied) return denied;

    const body = (await request.json()) as {
      contractId?: number;
      eventId?: number;
      staffId?: number;
      templateId?: number;
      fileUrl: string;
      fileName: string;
      mimeType: string;
    };

    if (!body.fileUrl) {
      return badRequest("서명받은 계약서 파일을 올려 주세요.");
    }

    const signedFile = {
      url: body.fileUrl,
      fileName: body.fileName,
      mimeType: body.mimeType,
      uploadedAt: new Date().toISOString(),
    };

    /*
      재작성으로 이미 다음 차수가 만들어져 있는 경우.
      번호와 이력은 그대로 두고 파일만 붙인다. 새로 만들면 차수가 또 올라가
      "2차 계약서가 두 장"이 된다.
    */
    if (body.contractId) {
      const contract = findContract(body.contractId);

      if (!contract) return notFound("존재하지 않는 계약서입니다.");

      if (contract.status === "SUPERSEDED") {
        return badRequest(
          "재작성으로 대체된 계약서입니다. 가장 최근 차수에 등록해 주세요.",
        );
      }

      contract.signedFile = signedFile;
      contract.status = "SIGNED";
      contract.registeredAt = signedFile.uploadedAt;

      markAssignmentsSigned(contract);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(contract);
    }

    const event = findEvent(Number(body.eventId));

    if (!event) return notFound("존재하지 않는 행사입니다.");

    const template =
      findContractTemplate(Number(body.templateId)) ??
      contractTemplates.find((item) => item.isDefault && item.isActive);

    if (!template) return badRequest("계약서 템플릿을 선택해 주세요.");

    const assignments = event.assignments
      .filter(
        (assignment) =>
          assignment.staffId === Number(body.staffId) &&
          assignment.status === "CONFIRMED",
      )
      .sort((a, b) => a.workDate.localeCompare(b.workDate));

    if (assignments.length === 0) {
      return badRequest("확정된 배치가 없습니다.");
    }

    // 같은 행사에 두 장이 등록되면 어느 쪽이 진짜인지 알 수 없다.
    const existing = contracts.find(
      (contract) =>
        contract.eventId === event.eventId &&
        contract.staffId === Number(body.staffId) &&
        contract.status !== "SUPERSEDED",
    );

    if (existing) {
      return badRequest(
        "이미 등록된 계약서가 있습니다. 등록을 취소한 뒤 다시 올리거나, 내용이 달라졌다면 재작성해 주세요.",
      );
    }

    /*
      번호의 순번은 계약서 ID에서 딴다.
      목록 길이로 매기면 등록을 취소해 기록이 빠졌을 때 순번이 되돌아가,
      지운 문서와 같은 번호가 다른 사람에게 다시 붙는다.
    */
    const contractId = nextId(contracts, "contractId");

    const created: Contract = {
      ...buildContractFrom(event, assignments, template),
      contractId,
      contractNumber: buildContractNumber(assignments[0].workDate, contractId),
      status: "SIGNED",
      signedFile,
      registeredAt: signedFile.uploadedAt,
      createdAt: new Date().toISOString(),
    };

    contracts.unshift(created);
    template.usageCount += 1;

    markAssignmentsSigned(created);
    recalculateEventCounts(event);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  /**
   * 등록 취소.
   *
   * 남의 서명본을 잘못 올리는 일이 실제로 생긴다. 파일명이 서로 비슷하기 때문이다.
   * 되돌릴 방법이 없으면 담당자는 계약서를 통째로 지우게 되고,
   * 재작성 차수라면 "왜 금액이 달라졌는가"의 근거까지 함께 사라진다.
   *
   * 그래서 1차는 기록째 지워 '발급 전'으로 돌리고,
   * 재작성 차수는 파일만 떼어 '등록 대기'로 돌린다. (번호와 이력은 남는다)
   */
  http.delete(
    `${BASE_URI}/admin/contracts/:contractId/registration`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "contract:write");

      if (denied) return denied;

      const contract = findContract(Number(params.contractId));

      if (!contract) return notFound("존재하지 않는 계약서입니다.");
      if (!contract.signedFile) {
        return badRequest("등록된 서명본이 없습니다.");
      }

      const event = findEvent(contract.eventId);

      unmarkAssignmentsSigned(contract);

      contract.signedFile = undefined;
      contract.registeredAt = undefined;
      contract.status = "DRAFT";

      /*
        1차 계약서는 번호 자체가 등록으로 생긴 것이다.
        파일만 떼고 번호를 남기면 "번호는 있는데 아무 종이도 없는" 문서가 되어,
        명단에서 등록 대기와 발급 전이 뒤섞인다. 기록째 지운다.
      */
      const shouldRemove = contract.revision === 1;

      if (shouldRemove) {
        contracts.splice(
          contracts.findIndex(
            (item) => item.contractId === contract.contractId,
          ),
          1,
        );
      }

      if (event) recalculateEventCounts(event);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json({ contract: shouldRemove ? null : contract });
    },
  ),

  /**
   * 계약서 재작성 (중도 종료).
   *
   * 3일로 계약한 사람이 하루 만에 그만두는 일은 드물지 않다.
   * 그때 손으로 하던 처리는 세 군데로 흩어져 있었다.
   * (1) 남은 날 배치를 지우고 (2) 계약서를 새로 써서 다시 받고
   * (3) 정산 화면에서 금액을 손으로 깎는다.
   * 어느 하나만 빠뜨려도 "계약서에는 3일, 통장에는 1일치"가 되어 분쟁이 된다.
   *
   * 그래서 셋을 한 요청으로 묶는다. 옛 계약서는 지우지 않고 `SUPERSEDED`로
   * 내려 근거로 남기고, 실제 근무일만 담은 다음 차수를 새로 만든다.
   */
  http.post(
    `${BASE_URI}/admin/contracts/:contractId/amend`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "contract:write");

      if (denied) return denied;

      const previous = findContract(Number(params.contractId));
      const body = (await request.json()) as {
        workDates: string[];
        reason: string;
        cancelsRemovedAssignments: boolean;
        templateId?: number;
        /** 재작성 사유 구분. 중도 종료 · 지급 조건 변경 · 근무 조건 변경 · 기타 */
        reasonType?: AmendReasonType;
        /** 계약서에 남길 변경 내용. (중식 제공처럼 금액에 안 잡히는 조건) */
        note?: string;
      };

      if (!previous) return notFound("존재하지 않는 계약서입니다.");

      if (previous.status === "SUPERSEDED") {
        return badRequest(
          "이미 재작성으로 대체된 계약서입니다. 가장 최근 차수를 재작성해 주세요.",
        );
      }

      const event = findEvent(previous.eventId);

      if (!event) return notFound("존재하지 않는 행사입니다.");

      const keptDates = previous.workDates
        .filter((date) => body.workDates.includes(date))
        .sort();
      const removedDates = previous.workDates.filter(
        (date) => !keptDates.includes(date),
      );

      if (keptDates.length === 0) {
        return badRequest(
          "근무일을 하나도 남기지 않으면 계약이 성립하지 않습니다. 하루도 나오지 않았다면 배치를 해제하고 계약서를 삭제해 주세요.",
        );
      }

      if (!body.reason.trim()) {
        return badRequest("재작성 사유를 입력해 주세요.");
      }

      const template =
        findContractTemplate(body.templateId ?? previous.templateId) ??
        findContractTemplate(previous.templateId);

      if (!template) return badRequest("계약서 템플릿을 선택해 주세요.");

      /*
        이 사람의 이 직무 배치만 손댄다.
        같은 사람이 날마다 다른 직무를 맡는 일이 있어(첫날 설치, 이후 스태프)
        직무까지 맞추지 않으면 계약이 덮지 않는 배치까지 취소된다.
      */
      const ownAssignments = event.assignments.filter(
        (assignment) =>
          assignment.staffId === previous.staffId &&
          assignment.role === previous.role,
      );

      let canceledCount = 0;

      if (body.cancelsRemovedAssignments) {
        ownAssignments
          .filter(
            (assignment) =>
              removedDates.includes(assignment.workDate) &&
              assignment.status !== "CANCELED",
          )
          .forEach((assignment) => {
            assignment.status = "CANCELED";
            // 나오지 않은 날이므로 계약도 덮지 않는다.
            assignment.isContractSigned = false;
            canceledCount += 1;
          });
      }

      const keptAssignments = ownAssignments
        .filter(
          (assignment) =>
            keptDates.includes(assignment.workDate) &&
            assignment.status !== "CANCELED",
        )
        .sort((a, b) => a.workDate.localeCompare(b.workDate));

      const workHours = calculateScheduledWorkHours(event);

      /*
        새 차수의 금액은 계약서를 복사하지 않고 **배치에서 다시 읽는다.**
        중도 종료를 처리하기 전에 시급을 고쳐 두는 일이 흔한데,
        옛 계약서의 금액을 그대로 옮기면 그 수정이 통째로 사라진다.
      */
      const work = summarizeContractWork(
        (keptAssignments.length > 0
          ? keptAssignments.map((assignment) => ({
              workDate: assignment.workDate,
              wageType: assignment.wageType,
              wage: assignment.wage,
            }))
          : previous.workDays.filter((day) => keptDates.includes(day.workDate))),
        workHours,
      );

      /*
        재작성 사유는 중도 종료만이 아니다.
        시급이 오르거나, 중식 제공 같은 조건이 붙거나, 템플릿이 바뀌어서
        문서를 다시 내는 일이 오히려 더 흔하다. 그래서 "근무일이 줄었는가"가 아니라
        **무엇이든 달라졌는가**로 본다.

        아무것도 달라지지 않았을 때만 막는다. 똑같은 문서를 차수만 올려 다시 내면
        근로자는 뭐가 바뀐 건지 알 수 없고, 서명만 한 번 더 받는 꼴이 된다.
      */
      const isWageChanged =
        work.workDays.length !== previous.workDays.length ||
        work.workDays.some((day) => {
          const before = previous.workDays.find(
            (target) => target.workDate === day.workDate,
          );

          return (
            !before || before.wage !== day.wage || before.wageType !== day.wageType
          );
        });
      const isTemplateChanged = template.templateId !== previous.templateId;

      if (
        removedDates.length === 0 &&
        !isWageChanged &&
        !isTemplateChanged &&
        !body.note?.trim()
      ) {
        return badRequest(
          "당초 계약과 달라진 내용이 없습니다. 지급 조건을 먼저 바꾸거나, 계약서에 남길 변경 내용을 적어 주세요.",
          "NOTHING_TO_AMEND",
        );
      }

      const staff = findStaff(previous.staffId);
      const amendedAt = new Date().toISOString();
      const revision = previous.revision + 1;

      const created: Contract = {
        ...previous,
        contractId: nextId(contracts, "contractId"),
        /*
          계약번호는 원본 번호에 차수를 붙인다.
          완전히 새 번호를 매기면 문자로 안내받은 근로자가 같은 건의
          재작성본이라는 것을 알 수 없다.
        */
        contractNumber: `${previous.contractNumber.replace(/-R\d+$/, "")}-R${revision}`,
        // 그사이 주소 · 생년월일을 채웠을 수 있어 인적사항도 다시 읽는다.
        staffBirthDate: staff?.birthDate ?? previous.staffBirthDate,
        staffAddress: staff?.address ?? previous.staffAddress,
        templateId: template.templateId,
        templateName: template.name,
        startTime: event.startTime,
        endTime: event.endTime,
        endDayOffset: event.endDayOffset,
        breakMinutes: event.breakMinutes,
        workHours,
        ...work,
        status: "DRAFT",
        /*
          서명은 옛 문서에 대한 것이다. 새 차수는 종이부터 다시 받는다.
          그래서 등록 대기(`DRAFT`)로 시작하고, 서명본을 올려야 완료가 된다.
        */
        signedFile: undefined,
        registeredAt: undefined,
        revision,
        supersededContractId: previous.contractId,
        supersededByContractId: undefined,
        amendReason: body.reason.trim(),
        amendReasonType: body.reasonType,
        amendNote: body.note?.trim() || undefined,
        removedWorkDates: removedDates,
        amendedAt,
        createdAt: amendedAt,
      };

      previous.status = "SUPERSEDED";
      previous.supersededByContractId = created.contractId;
      previous.amendedAt = amendedAt;

      contracts.unshift(created);
      template.usageCount += 1;

      /*
        남은 근무일도 서명을 다시 받아야 한다.
        옛 계약서에 대한 서명이라 그대로 두면 "계약서 완료"로 보이고,
        실제로는 아무도 서명하지 않은 문서로 현장에 나가게 된다.
      */
      keptAssignments.forEach((assignment) => {
        assignment.isContractSigned = false;
      });

      /*
        정산까지 여기서 이어 준다. 취소된 날은 지급 대상에서 빠지므로
        이 호출 한 번으로 그 사람의 정산 금액이 실제 근무일 기준으로 다시 잡힌다.
      */
      const [anyAssignment] = [...keptAssignments, ...ownAssignments];

      if (anyAssignment) syncPayrollWithAssignment(anyAssignment, event);

      recalculateEventCounts(event);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(
        { previous, created, canceledCount },
        { status: 201 },
      );
    },
  ),

  http.delete(`${BASE_URI}/admin/contracts/:contractId`, async ({ params, request }) => {
    const denied = requirePermission(request, "contract:delete");

    if (denied) return denied;

    const index = contracts.findIndex(
      (contract) => contract.contractId === Number(params.contractId),
    );

    if (index < 0) return notFound("존재하지 않는 계약서입니다.");

    contracts.splice(index, 1);
    await delay(MOCK_DELAY_MS);

    return new HttpResponse(null, { status: 204 });
  }),

  /** 계약서 본문 미리보기. 변수 치환에 필요한 값을 함께 내려준다. */
  http.get(
    `${BASE_URI}/admin/contracts/:contractId/preview`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "contract:read");

      if (denied) return denied;

      const contract = findContract(Number(params.contractId));

      if (!contract) return notFound("존재하지 않는 계약서입니다.");

      const template = findContractTemplate(contract.templateId);

      if (!template) return notFound("계약서 템플릿을 찾을 수 없습니다.");

      await delay(MOCK_DELAY_MS);

      /*
        치환된 본문 대신 계약서와 템플릿을 그대로 내려준다.
        문서 조립은 `buildContractDocument` 한 곳에서만 해야
        미리보기 · 인쇄 · 서명 화면이 같은 문서를 보여 준다.
      */
      return HttpResponse.json({ contract, template });
    },
  ),

  /* ---------------------------------- 템플릿 --------------------------------- */

  http.get(`${BASE_URI}/admin/contract-templates`, async ({ request }) => {
    const denied = requirePermission(request, "contract:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";

    const filtered = contractTemplates.filter((template) =>
      matchesKeyword(
        keyword,
        template.name,
        template.documentTitle,
        ...template.clauses.map((clause) => clause.title),
      ),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items: filtered });
  }),

  http.post(`${BASE_URI}/admin/contract-templates`, async ({ request }) => {
    const denied = requirePermission(request, "contract:write");

    if (denied) return denied;

    const body = (await request.json()) as ContractTemplateFormValues;

    // 기본 템플릿은 하나만 유지한다.
    if (body.isDefault) {
      contractTemplates.forEach((template) => {
        template.isDefault = false;
      });
    }

    const created: ContractTemplate = {
      ...body,
      templateId: nextId(contractTemplates, "templateId"),
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    contractTemplates.push(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(
    `${BASE_URI}/admin/contract-templates/:templateId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "contract:write");

      if (denied) return denied;

      const template = findContractTemplate(Number(params.templateId));
      const body = (await request.json()) as ContractTemplateFormValues;

      if (!template) return notFound("존재하지 않는 템플릿입니다.");

      if (body.isDefault) {
        contractTemplates.forEach((item) => {
          item.isDefault = false;
        });
      }

      Object.assign(template, body, { updatedAt: new Date().toISOString() });
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(template);
    },
  ),

  http.delete(
    `${BASE_URI}/admin/contract-templates/:templateId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "contract:delete");

      if (denied) return denied;

      const templateId = Number(params.templateId);
      const template = findContractTemplate(templateId);

      if (!template) return notFound("존재하지 않는 템플릿입니다.");
      if (template.isDefault) {
        return badRequest(
          "기본 템플릿은 삭제할 수 없습니다. 다른 템플릿을 기본으로 지정한 뒤 삭제해 주세요.",
        );
      }

      contractTemplates.splice(
        contractTemplates.findIndex((item) => item.templateId === templateId),
        1,
      );

      await delay(MOCK_DELAY_MS);

      return new HttpResponse(null, { status: 204 });
    },
  ),
];
