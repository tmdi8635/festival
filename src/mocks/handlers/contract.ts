import { HttpResponse, delay, http } from "msw";
import type {
  Contract,
  ContractStatus,
  ContractTemplate,
  ContractTemplateFormValues,
} from "@/type/contract";
import {
  buildDocumentHash,
  summarizeContractWork,
  type AmendReasonType,
} from "@/type/contract";
import {
  calculateScheduledWorkHours,
  groupAssignmentsByStaff,
} from "@/type/event";
import {
  buildContractNumber,
  contractTemplates,
  contracts,
  findContract,
  findContractTemplate,
} from "../db/contract";
import { findEvent, recalculateEventCounts } from "../db/event";
import { syncPayrollWithAssignment } from "../db/payroll";
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

export const contractHandlers = [
  http.get(`${BASE_URI}/admin/contracts`, async ({ request }) => {
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

  http.get(`${BASE_URI}/admin/contracts/:contractId`, async ({ params }) => {
    const contract = findContract(Number(params.contractId));

    await delay(MOCK_DELAY_MS);

    if (!contract) return notFound("존재하지 않는 계약서입니다.");

    return HttpResponse.json(contract);
  }),

  /**
   * 행사 배치에서 계약서를 일괄 생성한다.
   *
   * 한 명씩 손으로 만들던 작업을 없애는 것이 목적이므로,
   * 이미 계약서가 있는 배치는 건너뛰고 없는 것만 만든다.
   */
  http.post(`${BASE_URI}/admin/contracts/generate`, async ({ request }) => {
      const denied = requirePermission(request, "contract:write");

      if (denied) return denied;

    const body = (await request.json()) as {
      eventId: number;
      templateId: number;
      assignmentIds?: number[];
      /**
       * 이 직무만 발급한다. 비우면 전체.
       *
       * 한 행사 안에서도 직무마다 계약 조건이 다르다. 팀장은 책임 범위와 수당이,
       * 설치는 일급과 안전 조항이 따로 붙는다. 그래서 템플릿을 직무별로 나눠 쓰는데,
       * 발급이 '전체'뿐이면 첫 직무 템플릿으로 전원이 묶여 나가고
       * 나머지 직무는 계약서를 손으로 다시 만들어야 한다.
       */
      role?: JobRole;
    };

    const event = findEvent(body.eventId);
    const template = findContractTemplate(body.templateId);

    if (!event) return notFound("존재하지 않는 행사입니다.");
    if (!template) return badRequest("계약서 템플릿을 선택해 주세요.");

    const workHours = calculateScheduledWorkHours(event);

    /*
      계약서는 사람 한 명당 한 장이다.
      여러 날 나오는 사람에게 날짜 수만큼 계약서를 만들면 서명도 그만큼 받아야 한다.
      현장에서 그렇게 하지 않으므로, 배치를 사람 단위로 묶고 근무일을 모두 적는다.
    */
    const byStaff = groupAssignmentsByStaff(
      event.assignments.filter((assignment) => {
        if (assignment.status !== "CONFIRMED") return false;
        if (body.role && assignment.role !== body.role) return false;

        return (
          !body.assignmentIds ||
          body.assignmentIds.includes(assignment.assignmentId)
        );
      }),
    );

    // 이미 계약서가 있는 사람은 건너뛴다. 같은 행사에 두 장이 나가면 안 된다.
    const targets = byStaff.filter(
      (assignments) =>
        !contracts.some(
          (contract) =>
            contract.eventId === event.eventId &&
            contract.staffId === assignments[0].staffId,
        ),
    );

    if (targets.length === 0) {
      return badRequest(
        body.role
          ? "이 직무에는 계약서를 만들 대상이 없습니다. (확정 배치가 없거나 이미 전원 발급됨)"
          : "계약서를 만들 대상이 없습니다. (확정 배치가 없거나 이미 전원 발급됨)",
        "NO_CONTRACT_TARGET",
      );
    }

    const created: Contract[] = targets.map((assignments, index) => {
      const [first] = assignments;
      const staff = findStaff(first.staffId);

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

      const contract: Contract = {
        contractId: nextId(contracts, "contractId") + index,
        contractNumber: buildContractNumber(
          work.workDate,
          contracts.length + index + 1,
        ),
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

      contracts.unshift(contract);
      template.usageCount += 1;

      return contract;
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ created }, { status: 201 });
  }),

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
        // 서명은 옛 문서에 대한 것이다. 새 차수는 처음부터 다시 받는다.
        signature: undefined,
        sentAt: undefined,
        signedAt: undefined,
        rejectedReason: undefined,
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

  /** 상태 변경 (발송 · 서명 완료 · 반려) */
  http.patch(`${BASE_URI}/admin/contracts/status`, async ({ request }) => {
      const denied = requirePermission(request, "contract:send");

      if (denied) return denied;

    const body = (await request.json()) as {
      contractIds: number[];
      status: ContractStatus;
      rejectedReason?: string;
    };

    const updated = body.contractIds
      .map((contractId) => findContract(contractId))
      .filter((contract): contract is Contract => Boolean(contract));

    updated.forEach((contract) => {
      contract.status = body.status;

      if (body.status === "SENT") contract.sentAt = new Date().toISOString();
      if (body.status === "SIGNED") {
        contract.signedAt = new Date().toISOString();

        /*
          계약서가 완료되면 배치의 서명 여부도 함께 바뀌어야 한다.
          계약서 한 장이 여러 근무일을 덮으므로 해당 날짜의 배치를 전부 처리한다.
        */
        const event = findEvent(contract.eventId);

        event?.assignments
          .filter(
            (item) =>
              item.staffId === contract.staffId &&
              contract.workDates.includes(item.workDate),
          )
          .forEach((item) => {
            item.isContractSigned = true;
          });
      }
      if (body.status === "REJECTED") {
        contract.rejectedReason = body.rejectedReason;
      }
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ updated });
  }),

  /**
   * 전자서명 접수.
   *
   * 문자로 "네"라고 받은 회신은 나중에 근거가 되지 않는다.
   * 서명 이미지 · 성명 · 시각과 함께, 서명 당시 문서의 해시를 남긴다.
   * 나중에 템플릿을 고쳐도 그 서명이 어떤 내용에 대한 것이었는지 알 수 있어야 한다.
   */
  http.post(
    `${BASE_URI}/admin/contracts/:contractId/sign`,
    async ({ params, request }) => {
      const contract = findContract(Number(params.contractId));
      const body = (await request.json()) as {
        signedName: string;
        imageDataUrl: string;
        documentText: string;
      };

      if (!contract) return notFound("존재하지 않는 계약서입니다.");

      if (contract.status === "SIGNED") {
        return badRequest("이미 서명이 완료된 계약서입니다.");
      }

      if (contract.status === "EXPIRED") {
        return badRequest(
          "서명 기한이 지났습니다. 계약서를 다시 발송해 주세요.",
          "CONTRACT_EXPIRED",
        );
      }

      const signedAt = new Date().toISOString();

      contract.signature = {
        signedName: body.signedName,
        imageDataUrl: body.imageDataUrl,
        signedAt,
        documentHash: buildDocumentHash(body.documentText),
      };
      contract.status = "SIGNED";
      contract.signedAt = signedAt;

      const event = findEvent(contract.eventId);

      event?.assignments
        .filter(
          (item) =>
            item.staffId === contract.staffId &&
            contract.workDates.includes(item.workDate),
        )
        .forEach((item) => {
          item.isContractSigned = true;
        });

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(contract);
    },
  ),

  http.delete(`${BASE_URI}/admin/contracts/:contractId`, async ({ params }) => {
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
    async ({ params }) => {
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
    async ({ params }) => {
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
