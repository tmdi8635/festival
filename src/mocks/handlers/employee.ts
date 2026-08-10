import { HttpResponse, delay, http } from "msw";
import type {
  Employee,
  EmployeeFormValues,
  EmployeeWorkEvent,
  EmployeeWorkRow,
  EmployeeWorkSummary,
} from "@/type/employee";
import { monthKey, summarizeEmployeeHours } from "@/type/employee";
import { resolveWorkHours } from "@/type/event";
import type { StaffDetail } from "@/type/staff";
import { events } from "../db/event";
import {
  adminRoles,
  employees,
  findAdminRole,
  findEmployee,
  recalculateRoleMemberCounts,
} from "../db/ops";
import { findStaff, staffList } from "../db/staff";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  badRequest,
  matchesKeyword,
  nextId,
  notFound,
  requirePermission,
} from "../utils";

/**
 * 직원의 담당 행사 수.
 *
 * 저장해 두지 않고 조회할 때마다 센다. 저장해 두면 행사를 하나 만들 때마다
 * 직원 쪽 숫자를 같이 올려야 하고, 한 곳만 빠뜨리면 명부의 숫자가 조용히 틀린다.
 */
const countEvents = (employee: Employee) =>
  events.filter((event) => event.managerName === employee.name).length;

/**
 * 직원 한 명의 그 달 근무를 센다.
 *
 * **돈이 아니라 시간이다.** 직원은 월급을 받으므로 시급 계산이 없고,
 * 대신 "이번 달에 얼마나 현장에 나갔나"가 관리 대상이 된다.
 *
 * 출퇴근이 찍힌 날은 실제 시각으로, 아직 안 찍힌 날은 행사 예정 시간으로 센다.
 * 정산이 쓰는 규칙(`resolveWorkHours`)과 같은 함수를 쓴다. 여기서만 다르게 세면
 * 같은 근무가 정산 화면과 직원 화면에서 다른 시간으로 적힌다.
 */
const summarizeMonth = (staffId: number, month: string) => {
  const workEvents: EmployeeWorkEvent[] = [];
  const workDates = new Set<string>();

  let workedHours = 0;
  let scheduledHours = 0;

  for (const event of events) {
    if (event.status === "DRAFT" || event.status === "CANCELED") continue;

    const own = event.assignments.filter(
      (assignment) =>
        assignment.staffId === staffId &&
        assignment.status === "CONFIRMED" &&
        assignment.workDate.startsWith(month) &&
        /* 안 나온 날은 세지 않는다. 근무시간이지 배치시간이 아니다. */
        assignment.attendance !== "NO_SHOW" &&
        assignment.attendance !== "ABSENT",
    );

    if (own.length === 0) continue;

    let eventHours = 0;
    let eventScheduled = 0;

    for (const assignment of own) {
      const { workHours, isActual } = resolveWorkHours(assignment, event);

      eventHours += workHours;
      if (!isActual) eventScheduled += workHours;
      workDates.add(assignment.workDate);
    }

    workedHours += eventHours;
    scheduledHours += eventScheduled;

    workEvents.push({
      eventId: event.eventId,
      eventTitle: event.title,
      clientName: event.clientName,
      workDates: own.map((assignment) => assignment.workDate).sort(),
      workHours: Math.round(eventHours * 10) / 10,
      scheduledHours: Math.round(eventScheduled * 10) / 10,
    });
  }

  return {
    workedHours: Math.round(workedHours * 10) / 10,
    scheduledHours: Math.round(scheduledHours * 10) / 10,
    workedDays: workDates.size,
    /* 오래 붙어 있던 현장이 위다. 초과가 났을 때 먼저 봐야 하는 줄이다. */
    events: workEvents.sort((a, b) => b.workHours - a.workHours),
  };
};

/** 폼 값을 직원 · 인력 두 레코드에 함께 적는다. */
const applyForm = (
  employee: Employee,
  staff: StaffDetail | undefined,
  body: EmployeeFormValues,
  roleName: string,
  isSuperAdmin: boolean,
) => {
  Object.assign(employee, body, { roleName, isSuperAdmin });

  if (!staff) return;

  /*
    인력 레코드도 같이 고친다.
    여기서 멈추면 명부에서 이름을 바꿔도 배치 후보 · 행사 명부에는 옛 이름이 남는다.
  */
  staff.name = body.name;
  staff.phoneNumber = body.phoneNumber;
  staff.birthDate = body.birthDate;
  staff.gender = body.gender;
  staff.address = body.address;
  staff.emergencyContact = body.emergencyContact;
  staff.accountHolder = body.name;
  staff.position = body.position;
  staff.hireDate = body.hireDate;
  staff.baseMonthlyHours = body.baseMonthlyHours;
  /* 퇴사자는 앞으로 배치되지 않아야 한다. 지나간 기록은 그대로 남는다. */
  staff.status = body.isActive ? "ACTIVE" : "RETIRED";
};

/** 이미 잡혀 있는 배치에도 이름이 박혀 있다. 함께 고치지 않으면 옛 이름이 남는다. */
const syncAssignments = (staffId: number, name: string, phone: string) => {
  for (const event of events) {
    for (const assignment of event.assignments) {
      if (assignment.staffId !== staffId) continue;

      assignment.staffName = name;
      assignment.staffPhone = phone;
    }

    if (event.mainSupervisorStaffId === staffId) {
      event.mainSupervisorName = name;
      event.mainSupervisorPhone = phone;
    }
  }
};

export const employeeHandlers = [
  /**
   * 직원 명부.
   *
   * 인적사항 · 회사 직책 · 시스템 권한을 준다. 근무 집계는 여기 없다.
   * (`/admin/employee-work`) 한 응답에 다 담으면 인적사항을 고치러 들어온
   * 화면이 행사 목업 전체를 훑고 나서야 뜬다.
   */
  http.get(`${BASE_URI}/admin/employees`, async ({ request }) => {
    const denied = requirePermission(request, "employee:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const roleId = url.searchParams.get("roleId") ?? "";
    const includeRetired = url.searchParams.get("includeRetired") === "true";

    const items = employees
      .filter((employee) => includeRetired || employee.isActive)
      .filter((employee) => !roleId || String(employee.roleId) === roleId)
      .filter((employee) =>
        matchesKeyword(
          keyword,
          employee.name,
          employee.email,
          employee.phoneNumber,
          employee.position,
          employee.roleName,
        ),
      )
      .map((employee) => ({ ...employee, eventCount: countEvents(employee) }));

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({
      items,
      summary: {
        totalCount: items.length,
        activeCount: items.filter((employee) => employee.isActive).length,
        superAdminCount: items.filter((employee) => employee.isSuperAdmin)
          .length,
      },
    });
  }),

  /**
   * 직원 근무.
   *
   * 달 하나를 통째로 센다. 조회 기준이 언제나 달이라, 기간을 자유롭게 받는 대신
   * `YYYY-MM` 하나만 받는다. 지난 몇 년 치를 뒤져 보는 일이 흔해서
   * 화면은 연도를 먼저 고르고 그 안에서 달을 고른다.
   */
  http.get(`${BASE_URI}/admin/employee-work`, async ({ request }) => {
    const denied = requirePermission(request, "employee:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const month = url.searchParams.get("month") || monthKey();
    const keyword = url.searchParams.get("keyword") ?? "";
    const includeRetired = url.searchParams.get("includeRetired") === "true";

    const rows: EmployeeWorkRow[] = employees
      .filter((employee) => includeRetired || employee.isActive)
      .filter((employee) =>
        matchesKeyword(keyword, employee.name, employee.position),
      )
      .map((employee) => ({
        employeeId: employee.employeeId,
        staffId: employee.staffId,
        name: employee.name,
        position: employee.position,
        phoneNumber: employee.phoneNumber,
        profileImageUrl: employee.profileImageUrl,
        isActive: employee.isActive,
        month,
        baseMonthlyHours: employee.baseMonthlyHours,
        ...summarizeMonth(employee.staffId, month),
      }))
      /*
        많이 뛴 사람이 위다. 이 화면에서 먼저 손이 가야 하는 쪽이
        "기준을 넘긴 사람"이고, 그 사람의 다음 달 배치를 덜어 주는 것이
        여기서 내리는 판단이기 때문이다.
      */
      .sort(
        (a, b) =>
          b.workedHours / (b.baseMonthlyHours || 1) -
            a.workedHours / (a.baseMonthlyHours || 1) ||
          a.name.localeCompare(b.name),
      );

    const summary: EmployeeWorkSummary = {
      totalCount: rows.length,
      totalWorkedHours:
        Math.round(rows.reduce((sum, row) => sum + row.workedHours, 0) * 10) /
        10,
      totalBaseHours: rows.reduce((sum, row) => sum + row.baseMonthlyHours, 0),
      overCount: rows.filter((row) => row.workedHours > row.baseMonthlyHours)
        .length,
      underCount: rows.filter(
        (row) => summarizeEmployeeHours(row).rate < 60,
      ).length,
      totalOverHours:
        Math.round(
          rows.reduce(
            (sum, row) => sum + summarizeEmployeeHours(row).overHours,
            0,
          ) * 10,
        ) / 10,
    };

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items: rows, month, summary });
  }),

  http.post(`${BASE_URI}/admin/employees`, async ({ request }) => {
    const denied = requirePermission(request, "employee:write");

    if (denied) return denied;

    const body = (await request.json()) as EmployeeFormValues;

    if (employees.some((employee) => employee.email === body.email)) {
      return badRequest("이미 등록된 이메일입니다.", "DUPLICATED_EMAIL");
    }

    if (staffList.some((staff) => staff.phoneNumber === body.phoneNumber)) {
      return badRequest(
        "이미 등록된 휴대폰번호입니다. 인력풀에 같은 번호가 있는지 확인해 주세요.",
        "DUPLICATED_PHONE_NUMBER",
      );
    }

    const role = findAdminRole(body.roleId);

    if (!role) return badRequest("직책을 선택해 주세요.");

    /*
      직원을 만들면 **인력 레코드도 함께** 만든다.
      배치 · 출퇴근 · 캘린더가 전부 `staffId`로 돌아가므로, 이것이 없으면
      등록은 됐는데 행사에 넣을 수 없는 사람이 생긴다.
    */
    const staffId = nextId(staffList, "staffId");

    const staff: StaffDetail = {
      staffId,
      name: body.name,
      phoneNumber: body.phoneNumber,
      profileImageUrl: "",
      birthDate: body.birthDate,
      gender: body.gender,
      status: body.isActive ? "ACTIVE" : "RETIRED",
      employment: "EMPLOYEE",
      /* 직원은 직무 조건 없이 모든 자리에 들어간다. (후보 조회가 건너뛴다) */
      roles: [],
      region: "",
      district: "",
      /* 입사 서류는 회사가 이미 받았다. 배치 때 다시 막지 않는다. */
      isDocumentComplete: true,
      workCount: 0,
      totalWorkHours: 0,
      noShowCount: 0,
      lateCount: 0,
      goodCount: 0,
      badCount: 0,
      isFavorite: false,
      createdAt: new Date().toISOString(),

      bankName: "",
      accountNumber: "",
      accountHolder: body.name,
      idCardImageUrl: "",
      bankBookImageUrl: "",
      address: body.address,
      emergencyContact: body.emergencyContact,
      totalPaidAmount: 0,
      memos: [],

      position: body.position,
      hireDate: body.hireDate,
      baseMonthlyHours: body.baseMonthlyHours,
    };

    const created: Employee = {
      ...body,
      employeeId: nextId(employees, "employeeId"),
      staffId,
      profileImageUrl: "",
      roleName: role.name,
      isSuperAdmin: role.isSuperAdmin,
      eventCount: 0,
      createdAt: new Date().toISOString(),
    };

    staffList.push(staff);
    employees.push(created);
    recalculateRoleMemberCounts();
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(
    `${BASE_URI}/admin/employees/:employeeId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "employee:write");

      if (denied) return denied;

      const employee = findEmployee(Number(params.employeeId));
      const body = (await request.json()) as EmployeeFormValues;

      if (!employee) return notFound("존재하지 않는 직원입니다.");

      const isDuplicated = employees.some(
        (item) =>
          item.employeeId !== employee.employeeId && item.email === body.email,
      );

      if (isDuplicated) {
        return badRequest("이미 등록된 이메일입니다.", "DUPLICATED_EMAIL");
      }

      const role = findAdminRole(body.roleId);

      if (!role) return badRequest("직책을 선택해 주세요.");

      /*
        최고관리자를 다른 직책으로 내리거나 퇴사 처리하면 권한을 되돌릴 사람이
        사라질 수 있다. 마지막 한 명일 때만 막는다. 두 명 이상이면 한 명은 내려도 된다.
      */
      if (employee.isSuperAdmin && (!role.isSuperAdmin || !body.isActive)) {
        const superAdminCount = employees.filter(
          (item) => item.isSuperAdmin && item.isActive,
        ).length;

        if (superAdminCount <= 1) {
          return badRequest(
            "마지막 최고관리자입니다. 다른 직원을 최고관리자로 올린 뒤에 바꿔 주세요.",
            "LAST_SUPER_ADMIN",
          );
        }
      }

      applyForm(
        employee,
        findStaff(employee.staffId),
        body,
        role.name,
        role.isSuperAdmin,
      );
      syncAssignments(employee.staffId, body.name, body.phoneNumber);
      recalculateRoleMemberCounts();
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(employee);
    },
  ),

  http.delete(
    `${BASE_URI}/admin/employees/:employeeId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "employee:delete");

      if (denied) return denied;

      const employee = findEmployee(Number(params.employeeId));

      if (!employee) return notFound("존재하지 않는 직원입니다.");

      if (employee.isSuperAdmin) {
        return badRequest(
          "최고관리자 계정은 삭제할 수 없습니다.",
          "SUPER_ADMIN_LOCKED",
        );
      }

      /*
        나간 행사가 있으면 지우지 않는다.
        지우면 그 행사의 배치가 가리키는 사람이 사라져, 지난 명부와 근무 기록이
        이름만 남은 줄이 된다. 그럴 때는 퇴사 처리로 남긴다.
      */
      const hasHistory = events.some((event) =>
        event.assignments.some(
          (assignment) => assignment.staffId === employee.staffId,
        ),
      );

      if (hasHistory) {
        return badRequest(
          "행사에 배치된 기록이 있어 삭제할 수 없습니다. 수정에서 '재직 중'을 끄면 퇴사 처리됩니다.",
          "EMPLOYEE_HAS_HISTORY",
        );
      }

      employees.splice(employees.indexOf(employee), 1);

      const staffIndex = staffList.findIndex(
        (staff) => staff.staffId === employee.staffId,
      );

      if (staffIndex >= 0) staffList.splice(staffIndex, 1);

      recalculateRoleMemberCounts();
      await delay(MOCK_DELAY_MS);

      return new HttpResponse(null, { status: 204 });
    },
  ),

  /* 직책 선택지는 직원 폼에서 바로 필요하다. 직책 목록 권한과는 별개다. */
  http.get(`${BASE_URI}/admin/employee-roles`, async ({ request }) => {
    const denied = requirePermission(request, "employee:read");

    if (denied) return denied;

    recalculateRoleMemberCounts();
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({
      items: adminRoles.map((role) => ({
        roleId: role.roleId,
        name: role.name,
        description: role.description,
        isSuperAdmin: role.isSuperAdmin,
        memberCount: role.memberCount,
      })),
    });
  }),
];
