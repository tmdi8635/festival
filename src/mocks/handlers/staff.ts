import { HttpResponse, delay, http } from "msw";
import type {
  JobRole,
  ReputationVerdict,
  StaffDetail,
  StaffFormValues,
  StaffReputation,
  StaffStatus,
  StaffWorkDay,
  StaffWorkHistory,
} from "@/type/staff";
import {
  resolveReputationCount,
  resolveReputationScore,
} from "@/type/staff";
import {
  calculateBasePay,
  calculateScheduledWorkHours,
} from "@/type/event";
import { findContractByWork } from "../db/contract";
import { events } from "../db/event";
import {
  findStaff,
  sortedStaff,
  staffList,
} from "../db/staff";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  badRequest,
  matchesKeyword,
  nextId,
  notFound,
  paginate,
  requesterCan,
  requirePermission,
} from "../utils";

/** 목록 응답에서는 계좌 · 신분증처럼 민감한 값을 내려주지 않는다. */
const toStaffSummary = (staff: StaffDetail) => {
  const {
    bankName,
    accountNumber,
    accountHolder,
    idCardImageUrl,
    bankBookImageUrl,
    address,
    emergencyContact,
    memos,
    blacklistReason,
    blacklistedAt,
    totalPaidAmount,
    height,
    clothingSize,
    ...summary
  } = staff;

  void bankName;
  void accountNumber;
  void accountHolder;
  void idCardImageUrl;
  void bankBookImageUrl;
  void address;
  void emergencyContact;
  void memos;
  void blacklistReason;
  void blacklistedAt;
  void totalPaidAmount;
  void height;
  void clothingSize;

  return summary;
};

/**
 * 상세 응답에서 **볼 권한이 없는 값만** 덜어 낸다.
 *
 * 인력 상세 한 장에 세 가지 성격의 값이 섞여 있다.
 * 이름 · 연락처(인력), 신분증 · 통장사본(인력 서류), 계좌번호(정산)다.
 * 화면에서 계좌 칸을 감추는 것만으로는 값이 이미 응답에 실려 온 뒤라
 * 개발자도구만 열면 그대로 보인다. 실제로 지우는 곳은 여기다.
 *
 * 상세를 통째로 막지 않는 이유는, 배치하려면 이름과 연락처는 봐야 하기 때문이다.
 * 자료마다 권한을 나눠 놓고 화면 단위로 막으면 나눈 의미가 없어진다.
 */
const maskStaffDetail = (staff: StaffDetail, request: Request): StaffDetail => {
  const masked = { ...staff };

  if (!requesterCan(request, "staffDocument:read")) {
    masked.idCardImageUrl = "";
    masked.bankBookImageUrl = "";
  }

  /*
    계좌는 두 갈래로 열린다.
    이체하려면 정산 담당이 봐야 하고(`payroll:read`),
    통장사본을 받아 옮겨 적는 사람도 봐야 한다(`staffDocument:read`).
    뒤쪽을 빼면 서류 담당이 자기가 입력한 계좌를 못 보게 되고,
    그 상태로 인력 폼을 저장하면 빈 값이 올라가 계좌번호가 지워진다.
  */
  if (
    !requesterCan(request, "payroll:read") &&
    !requesterCan(request, "staffDocument:read")
  ) {
    masked.bankName = "";
    masked.accountNumber = "";
    masked.accountHolder = "";
  }

  if (!requesterCan(request, "payroll:read")) {
    masked.totalPaidAmount = 0;
  }

  if (!requesterCan(request, "blacklist:read")) {
    masked.blacklistReason = undefined;
  }

  return masked;
};

/**
 * 인력 등록 · 수정 요청에서 **서류 칸을 손댈 수 있는지** 본다.
 *
 * 인력 폼 한 장에 인적사항과 서류(신분증 · 통장사본 · 계좌)가 함께 들어 있다.
 * 폼 전체를 `staff:write` 하나로 받으면, 서류 권한이 없는 사람이
 * 인력 수정 화면을 통해 서류를 올릴 수 있다. 따로 뗀 권한이 뜻을 잃는다.
 *
 * 값을 무시할 뿐 요청을 거부하지는 않는다. 상세 조회에서 이미 가려 둔 값이라
 * 폼을 열어 저장하면 빈 값이 그대로 올라오는데, 이때 거부하면
 * 이름 하나 고치려던 사람이 막히고, 그대로 반영하면 **계좌번호가 지워진다.**
 * 그래서 서류 칸은 건드리지 않고 나머지만 반영한다.
 */
const DOCUMENT_FIELDS = [
  "bankName",
  "accountNumber",
  "accountHolder",
  "idCardImageUrl",
  "bankBookImageUrl",
] as const;

const omitDocumentFields = (body: StaffFormValues): StaffFormValues => {
  const next = { ...body };

  DOCUMENT_FIELDS.forEach((field) => {
    delete next[field];
  });

  return next;
};

export const staffHandlers = [
  http.get(`${BASE_URI}/admin/staff`, async ({ request }) => {
    const denied = requirePermission(request, "staff:read");

    if (denied) return denied;

    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const status = url.searchParams.get("status") as StaffStatus | null;
    const role = url.searchParams.get("role") as JobRole | null;
    const region = url.searchParams.get("region") ?? "";
    const documentState = url.searchParams.get("documentState") ?? "";
    const onlyFavorite = url.searchParams.get("onlyFavorite") === "true";
    const sort = url.searchParams.get("sort") ?? "RECENT";

    const filtered = sortedStaff().filter((staff) => {
      if (status && staff.status !== status) return false;
      if (role && !staff.roles.includes(role)) return false;
      if (region && staff.region !== region) return false;
      if (onlyFavorite && !staff.isFavorite) return false;
      if (documentState === "COMPLETE" && !staff.isDocumentComplete) {
        return false;
      }
      if (documentState === "INCOMPLETE" && staff.isDocumentComplete) {
        return false;
      }

      return matchesKeyword(
        keyword,
        staff.name,
        staff.phoneNumber,
        staff.region,
        staff.district,
        String(staff.staffId),
      );
    });

    // 배치할 사람을 고를 때와 관리 대상을 볼 때의 정렬 기준이 다르다.
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "WORK_COUNT") return b.workCount - a.workCount;
      /*
        평판순은 평판 점수로 정렬한다.
        단순 평균으로 줄 세우면 "딱 한 번 5.0을 받은 신입"이 목록 맨 위에 온다.
      */
      if (sort === "RATING") {
        return resolveReputationScore(b) - resolveReputationScore(a);
      }
      if (sort === "RATING_COUNT") {
        return (
          resolveReputationCount(b) - resolveReputationCount(a)
        );
      }
      if (sort === "LAST_WORKED") {
        return (b.lastWorkedAt ?? "").localeCompare(a.lastWorkedAt ?? "");
      }

      return b.createdAt.localeCompare(a.createdAt);
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(sorted.map(toStaffSummary), url));
  }),

  http.get(`${BASE_URI}/admin/staff/:staffId`, async ({ params, request }) => {
    const denied = requirePermission(request, "staff:read");

    if (denied) return denied;

    const staff = findStaff(Number(params.staffId));

    await delay(MOCK_DELAY_MS);

    if (!staff) return notFound("존재하지 않는 인력입니다.");

    return HttpResponse.json(maskStaffDetail(staff, request));
  }),

  /** 인력이 참여한 행사 이력. 블랙리스트 판단의 근거 화면이다. */
  http.get(
    `${BASE_URI}/admin/staff/:staffId/histories`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "staff:read");

      if (denied) return denied;

      const staffId = Number(params.staffId);
      const staff = findStaff(staffId);

      if (!staff) return notFound("존재하지 않는 인력입니다.");

      /*
        참여 이력은 **행사 단위**로 묶는다.

        배치는 "사람 × 날짜"라서 3일 나온 행사는 배치가 3건이다.
        그대로 나열하면 같은 행사가 하루짜리 세 줄로 흩어져
        "이 행사에 며칠 나왔나"가 보이지 않는다.

        계약서도 사람 × 행사 한 장이라 이 묶음과 단위가 같아,
        계약 상태를 한 줄에 붙이기도 자연스럽다.
      */
      const byEvent = new Map<number, StaffWorkHistory>();

      events.forEach((event) => {
        const mine = event.assignments.filter(
          (assignment) => assignment.staffId === staffId,
        );

        if (mine.length === 0) return;

        const workHours = calculateScheduledWorkHours(event);

        const days: StaffWorkDay[] = mine
          .map((assignment) => ({
            assignmentId: assignment.assignmentId,
            date: assignment.workDate,
            attendance: assignment.attendance,
            lateMinutes: assignment.lateMinutes,
            payAmount: calculateBasePay(
              assignment.wageType,
              assignment.wage,
              workHours,
            ),
            verdict: assignment.reputationVerdict,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const workDates = days.map((day) => day.date);
        const contract = findContractByWork(staffId, workDates[0]);

        /*
          여러 날 나온 행사의 대표 평가.
          하루라도 '별로예요'가 있으면 그쪽으로 잡는다.
          평균을 내면 "사흘 중 하루 문제"가 통계 속으로 사라진다.
        */
        const verdicts = days
          .map((day) => day.verdict)
          .filter((value): value is ReputationVerdict => Boolean(value));
        const verdict = verdicts.includes("BAD")
          ? "BAD"
          : verdicts.includes("GOOD")
            ? "GOOD"
            : undefined;

        byEvent.set(event.eventId, {
          historyId: `${event.eventId}-${staffId}`,
          eventId: event.eventId,
          eventTitle: event.title,
          clientName: event.clientName,
          role: mine[0].role,
          workDates,
          workDate: workDates[0],
          dayCount: workDates.length,
          workHours,
          totalWorkHours: Math.round(workHours * workDates.length * 10) / 10,
          payAmount: days.reduce((sum, day) => sum + day.payAmount, 0),
          days,
          verdict,
          reputationComment: mine.find((item) => item.reputationComment)
            ?.reputationComment,
          contractId: contract?.contractId,
          contractNumber: contract?.contractNumber,
          contractStatus: contract?.status,
        });
      });

      const histories = [...byEvent.values()].sort((a, b) =>
        b.workDate.localeCompare(a.workDate),
      );

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json({ items: histories });
    },
  ),

  /**
   * 받은 평가 내역.
   *
   * 평균 점수만 보여 주면 "왜 이 점수인지"를 알 수 없어 판단에 쓰이지 못한다.
   * 어느 행사에서 누구에게 어떤 평가를 받았는지 그대로 보여 준다.
   */
  http.get(
    `${BASE_URI}/admin/staff/:staffId/reputations`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "staff:read");

      if (denied) return denied;

      const staffId = Number(params.staffId);
      const staff = findStaff(staffId);

      if (!staff) return notFound("존재하지 않는 인력입니다.");

      const items: StaffReputation[] = events
        .flatMap((event) =>
          event.assignments
            .filter(
              (assignment) =>
                assignment.staffId === staffId &&
                assignment.reputationVerdict !== undefined,
            )
            .map((assignment) => ({
              assignmentId: assignment.assignmentId,
              eventId: event.eventId,
              eventTitle: event.title,
              clientName: event.clientName,
              workDate: assignment.workDate,
              role: assignment.role,
              verdict: assignment.reputationVerdict!,
              tags: assignment.reputationTags ?? [],
              comment: assignment.reputationComment,
              ratedBy: event.managerName,
              /*
                지금은 에이전시(담당 매니저)가 남기는 평가뿐이다.
                스태프 상호평가를 열면 여기에 PEER가 섞여 들어오고,
                화면은 그때 주체별로 나눠 보여 주기만 하면 된다.
              */
              raterType: "AGENCY" as const,
            })),
        )
        .sort((a, b) => b.workDate.localeCompare(a.workDate));

      /* 항목별 집계. "별로예요 12건"만으로는 무엇이 문제인지 알 수 없다. */
      const tagMap = new Map<string, { count: number; verdict: ReputationVerdict }>();

      items.forEach((item) =>
        item.tags.forEach((tag) => {
          const current = tagMap.get(tag);

          if (current) {
            current.count += 1;
            return;
          }

          tagMap.set(tag, { count: 1, verdict: item.verdict });
        }),
      );

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json({
        items,
        goodCount: staff.goodCount,
        badCount: staff.badCount,
        tagCounts: [...tagMap.entries()]
          .map(([tag, value]) => ({ tag, ...value }))
          .sort((a, b) => b.count - a.count),
      });
    },
  ),

  http.post(`${BASE_URI}/admin/staff`, async ({ request }) => {
      const denied = requirePermission(request, "staff:write");

      if (denied) return denied;

    const raw = (await request.json()) as StaffFormValues;
    const body = requesterCan(request, "staffDocument:write")
      ? raw
      : omitDocumentFields(raw);

    const isDuplicated = staffList.some(
      (staff) => staff.phoneNumber === body.phoneNumber,
    );

    if (isDuplicated) {
      return HttpResponse.json(
        {
          code: "DUPLICATED_PHONE_NUMBER",
          message: "이미 등록된 휴대폰번호입니다. 기존 인력을 확인해 주세요.",
        },
        { status: 409 },
      );
    }

    const created: StaffDetail = {
      ...body,
      staffId: nextId(staffList, "staffId"),
      status: "ACTIVE",
      isDocumentComplete: Boolean(body.idCardImageUrl && body.bankBookImageUrl),
      workCount: 0,
      totalWorkHours: 0,
      noShowCount: 0,
      lateCount: 0,
      goodCount: 0,
      badCount: 0,
      isFavorite: false,
      totalPaidAmount: 0,
      memos: [],
      createdAt: new Date().toISOString(),
    };

    staffList.unshift(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(`${BASE_URI}/admin/staff/:staffId`, async ({ params, request }) => {
      const denied = requirePermission(request, "staff:write");

      if (denied) return denied;

    const staff = findStaff(Number(params.staffId));
    const raw = (await request.json()) as StaffFormValues;
    const body = requesterCan(request, "staffDocument:write")
      ? raw
      : omitDocumentFields(raw);

    if (!staff) return notFound("존재하지 않는 인력입니다.");

    Object.assign(staff, body);
    staff.isDocumentComplete = Boolean(
      staff.idCardImageUrl && staff.bankBookImageUrl,
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(staff);
  }),

  /**
   * 인력 삭제.
   *
   * 지금은 등록도 수정도 전부 손으로 하는 단계라, 잘못 넣은 사람을 지울 방법이 필요하다.
   * 다만 근무 이력이 있는 사람을 지우면 정산·계약서가 주인 없는 데이터가 되므로 막는다.
   * (그런 경우는 '활동종료'로 상태만 바꾸는 것이 맞다)
   */
  http.delete(`${BASE_URI}/admin/staff/:staffId`, async ({ params, request }) => {
    const denied = requirePermission(request, "staff:delete");

    if (denied) return denied;

    const staffId = Number(params.staffId);
    const index = staffList.findIndex((staff) => staff.staffId === staffId);

    if (index < 0) return notFound("존재하지 않는 인력입니다.");

    const hasAssignment = events.some((event) =>
      event.assignments.some((assignment) => assignment.staffId === staffId),
    );

    if (hasAssignment) {
      return badRequest(
        "배치 이력이 있어 삭제할 수 없습니다. 더 이상 부르지 않을 인력이라면 '활동종료'로 바꿔 주세요.",
        "STAFF_HAS_HISTORY",
      );
    }

    staffList.splice(index, 1);
    await delay(MOCK_DELAY_MS);

    return new HttpResponse(null, { status: 204 });
  }),

  /** 상태 변경 (블랙리스트 지정 · 해제 포함) */
  http.patch(
    `${BASE_URI}/admin/staff/:staffId/status`,
    async ({ params, request }) => {
      const staff = findStaff(Number(params.staffId));
      const body = (await request.json()) as {
        status: StaffStatus;
        reason?: string;
      };

      /*
        같은 주소지만 요구하는 권한이 둘이다.
        '활동종료'로 바꾸는 것은 인력 정보 수정이고,
        블랙리스트에 넣거나 빼는 것은 그 사람을 다시 부르지 못하게 하는 일이라
        따로 뗀 권한(`blacklist:write`)이 있어야 한다.
        해제도 마찬가지다 — 지정만 막고 해제를 열어 두면 막은 뜻이 없다.

        **없는 대상이라도 권한부터 본다.** 404를 먼저 돌려주면
        권한이 없는 사람이 아무 번호나 넣어 보며 "몇 번이 존재하는지"를 알아낼 수 있다.
      */
      const touchesBlacklist =
        body.status === "BLACKLIST" || staff?.status === "BLACKLIST";

      const denied = requirePermission(
        request,
        touchesBlacklist ? "blacklist:write" : "staff:write",
      );

      if (denied) return denied;

      if (!staff) return notFound("존재하지 않는 인력입니다.");

      staff.status = body.status;

      if (body.status === "BLACKLIST") {
        staff.blacklistReason = body.reason;
        staff.blacklistedAt = new Date().toISOString();
        staff.isFavorite = false;
      } else {
        // 해제하면 사유를 남겨 두지 않는다. 이력은 메모로 관리한다.
        staff.blacklistReason = undefined;
        staff.blacklistedAt = undefined;
      }

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(staff);
    },
  ),


  /** 즐겨찾기 토글 */
  http.patch(
    `${BASE_URI}/admin/staff/:staffId/favorite`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "staff:write");

      if (denied) return denied;

      const staff = findStaff(Number(params.staffId));
      const { isFavorite } = (await request.json()) as { isFavorite: boolean };

      if (!staff) return notFound("존재하지 않는 인력입니다.");

      staff.isFavorite = isFavorite;
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(staff);
    },
  ),

  /** 서류(신분증 · 통장사본) 갱신 */
  http.patch(
    `${BASE_URI}/admin/staff/:staffId/documents`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "staffDocument:write");

      if (denied) return denied;

      const staff = findStaff(Number(params.staffId));
      const body = (await request.json()) as {
        idCardImageUrl?: string;
        bankBookImageUrl?: string;
        bankName?: string;
        accountNumber?: string;
        accountHolder?: string;
      };

      if (!staff) return notFound("존재하지 않는 인력입니다.");

      Object.assign(staff, body);
      staff.isDocumentComplete = Boolean(
        staff.idCardImageUrl && staff.bankBookImageUrl,
      );

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(staff);
    },
  ),

  http.post(
    `${BASE_URI}/admin/staff/:staffId/memos`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "staff:write");

      if (denied) return denied;

      const staff = findStaff(Number(params.staffId));
      const body = (await request.json()) as {
        content: string;
        isWarning: boolean;
      };

      if (!staff) return notFound("존재하지 않는 인력입니다.");

      const maxMemoId = staffList.reduce(
        (max, item) =>
          item.memos.reduce((innerMax, memo) => Math.max(innerMax, memo.memoId), max),
        0,
      );

      const memo = {
        memoId: maxMemoId + 1,
        staffId: staff.staffId,
        content: body.content,
        isWarning: body.isWarning,
        author: "운영자",
        createdAt: new Date().toISOString(),
      };

      staff.memos.unshift(memo);
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(memo, { status: 201 });
    },
  ),

  http.delete(
    `${BASE_URI}/admin/staff/:staffId/memos/:memoId`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "staff:write");

      if (denied) return denied;

      const staff = findStaff(Number(params.staffId));

      if (!staff) return notFound("존재하지 않는 인력입니다.");

      staff.memos = staff.memos.filter(
        (memo) => memo.memoId !== Number(params.memoId),
      );

      await delay(MOCK_DELAY_MS);

      return new HttpResponse(null, { status: 204 });
    },
  ),

];
