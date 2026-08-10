import { HttpResponse, delay, http } from "msw";
import type { Employee, EmployeeFormValues } from "@/type/employee";
import { DEFAULT_BASE_MONTHLY_HOURS, monthKey } from "@/type/employee";
import { resolveWorkHours } from "@/type/event";
import type { StaffDetail } from "@/type/staff";
import { events } from "../db/event";
import { employeeStaff, findStaff, staffList } from "../db/staff";
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
 * 한 직원의 그 달 근무를 센다.
 *
 * **돈이 아니라 시간이다.** 직원은 월급을 받으므로 시급 계산이 없고,
 * 대신 "이번 달에 얼마나 현장에 나갔나"가 관리 대상이 된다.
 *
 * 출퇴근이 찍힌 날은 실제 시각으로, 아직 안 찍힌 날은 행사 예정 시간으로 센다.
 * 정산이 쓰는 규칙(`resolveWorkHours`)과 같은 함수를 쓴다. 여기서만 다르게 세면
 * 같은 근무가 정산 화면과 직원 화면에서 다른 시간으로 적힌다.
 * 예정으로 센 시간은 따로 돌려줘, 화면에서 "아직 확정 아님"을 말할 수 있게 한다.
 */
const summarizeMonth = (staffId: number, month: string) => {
  let workedHours = 0;
  let scheduledHours = 0;
  const workDates = new Set<string>();
  const eventIds = new Set<number>();
  let mainSupervisorCount = 0;

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

    eventIds.add(event.eventId);

    if (event.mainSupervisorStaffId === staffId) mainSupervisorCount += 1;

    for (const assignment of own) {
      const { workHours, isActual } = resolveWorkHours(assignment, event);

      workedHours += workHours;
      if (!isActual) scheduledHours += workHours;
      workDates.add(assignment.workDate);
    }
  }

  return {
    workedHours: Math.round(workedHours * 10) / 10,
    scheduledHours: Math.round(scheduledHours * 10) / 10,
    workedDays: workDates.size,
    eventCount: eventIds.size,
    mainSupervisorCount,
  };
};

/** 인력 레코드 + 그 달 집계를 직원 한 줄로 만든다. */
const toEmployee = (staff: StaffDetail, month: string): Employee => ({
  staffId: staff.staffId,
  name: staff.name,
  phoneNumber: staff.phoneNumber,
  profileImageUrl: staff.profileImageUrl,
  position: staff.position ?? "",
  hireDate: staff.hireDate ?? staff.createdAt.slice(0, 10),
  baseMonthlyHours: staff.baseMonthlyHours ?? DEFAULT_BASE_MONTHLY_HOURS,
  isActive: staff.status === "ACTIVE",
  memo: staff.memos[0]?.content ?? "",
  month,
  ...summarizeMonth(staff.staffId, month),
});

/** 직원 레코드에만 값을 옮긴다. 인력풀 폼과 칸이 다르다. */
const applyForm = (staff: StaffDetail, body: EmployeeFormValues) => {
  staff.name = body.name;
  staff.phoneNumber = body.phoneNumber;
  staff.accountHolder = body.name;
  staff.position = body.position;
  staff.hireDate = body.hireDate;
  staff.baseMonthlyHours = body.baseMonthlyHours;
  /*
    퇴사는 지우는 것이 아니라 끄는 것이다.
    과거 행사 배치가 이 사람을 가리키고 있어, 지우면 그 줄이 이름 없는 줄이 된다.
  */
  staff.status = body.isActive ? "ACTIVE" : "RETIRED";
};

export const employeeHandlers = [
  /**
   * 직원 명부 + 그 달 근무 집계.
   *
   * 명부와 집계를 따로 부르지 않는다. 이 화면에서 명부만 보는 일이 없기 때문이다.
   * (관리자가 여기 들어오는 이유가 "이번 달 누가 얼마나 뛰었나"다)
   */
  http.get(`${BASE_URI}/admin/employees`, async ({ request }) => {
    const denied = requirePermission(request, "employee:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const month = url.searchParams.get("month") || monthKey();
    const keyword = url.searchParams.get("keyword") ?? "";
    const includeRetired = url.searchParams.get("includeRetired") === "true";

    const items = employeeStaff()
      .filter((staff) => includeRetired || staff.status === "ACTIVE")
      .filter((staff) =>
        matchesKeyword(
          keyword,
          staff.name,
          staff.phoneNumber,
          staff.position ?? "",
        ),
      )
      .map((staff) => toEmployee(staff, month))
      /* 적게 채운 사람이 위다. 이 화면에서 손이 가야 하는 쪽이 그쪽이다. */
      .sort(
        (a, b) =>
          a.workedHours / (a.baseMonthlyHours || 1) -
            b.workedHours / (b.baseMonthlyHours || 1) ||
          a.name.localeCompare(b.name),
      );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({
      items,
      month,
      summary: {
        totalCount: items.length,
        totalWorkedHours:
          Math.round(items.reduce((sum, item) => sum + item.workedHours, 0) * 10) /
          10,
        totalBaseHours: items.reduce(
          (sum, item) => sum + item.baseMonthlyHours,
          0,
        ),
        /* 기준을 넘긴 사람. 다음 달 배치를 덜어 줘야 하는 쪽이다. */
        overCount: items.filter(
          (item) => item.workedHours > item.baseMonthlyHours,
        ).length,
        mainSupervisorCount: items.reduce(
          (sum, item) => sum + item.mainSupervisorCount,
          0,
        ),
      },
    });
  }),

  http.post(`${BASE_URI}/admin/employees`, async ({ request }) => {
    const denied = requirePermission(request, "employee:write");

    if (denied) return denied;

    const body = (await request.json()) as EmployeeFormValues;

    if (staffList.some((staff) => staff.phoneNumber === body.phoneNumber)) {
      return badRequest(
        "이미 등록된 휴대폰번호입니다. 인력풀에 같은 번호가 있는지 확인해 주세요.",
        "DUPLICATED_PHONE_NUMBER",
      );
    }

    /*
      직원도 **인력풀 레코드로** 만든다.
      따로 두면 배치 · 출퇴근 · 캘린더를 두 벌로 만들어야 하고,
      같은 사람이 두 레코드로 갈라져 이름을 한쪽만 고치는 일이 생긴다.
    */
    const staffId = nextId(staffList, "staffId");

    const created: StaffDetail = {
      staffId,
      name: body.name,
      phoneNumber: body.phoneNumber,
      profileImageUrl: "",
      birthDate: "",
      gender: "MALE",
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
      address: "",
      emergencyContact: "",
      totalPaidAmount: 0,
      memos: [],

      position: body.position,
      hireDate: body.hireDate,
      baseMonthlyHours: body.baseMonthlyHours,
    };

    staffList.push(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(toEmployee(created, monthKey()), { status: 201 });
  }),

  http.put(
    `${BASE_URI}/admin/employees/:staffId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "employee:write");

      if (denied) return denied;

      const staff = findStaff(Number(params.staffId));
      const body = (await request.json()) as EmployeeFormValues;

      if (!staff || staff.employment !== "EMPLOYEE") {
        return notFound("존재하지 않는 직원입니다.");
      }

      const isDuplicated = staffList.some(
        (item) =>
          item.staffId !== staff.staffId &&
          item.phoneNumber === body.phoneNumber,
      );

      if (isDuplicated) {
        return badRequest(
          "이미 등록된 휴대폰번호입니다.",
          "DUPLICATED_PHONE_NUMBER",
        );
      }

      applyForm(staff, body);

      /*
        이름 · 연락처는 이미 잡혀 있는 배치에도 그대로 적혀 있다.
        여기서 함께 고치지 않으면 이번 주 행사 명부에 옛 이름이 남는다.
      */
      for (const event of events) {
        for (const assignment of event.assignments) {
          if (assignment.staffId !== staff.staffId) continue;

          assignment.staffName = staff.name;
          assignment.staffPhone = staff.phoneNumber;
        }

        if (event.mainSupervisorStaffId === staff.staffId) {
          event.mainSupervisorName = staff.name;
          event.mainSupervisorPhone = staff.phoneNumber;
        }
      }

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(toEmployee(staff, monthKey()));
    },
  ),
];
