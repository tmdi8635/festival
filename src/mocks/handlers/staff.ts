import { HttpResponse, delay, http } from "msw";
import type {
  DocumentLane,
  DocumentReviewState,
  JobRole,
  ReputationVerdict,
  StaffDetail,
  StaffDocumentReviews,
  StaffFormValues,
  StaffReputation,
  StaffStatus,
  StaffWorkDay,
  StaffWorkHistory,
} from "@/type/staff";
import {
  DOCUMENT_LANE_LABEL,
  REPUTATION_BASE_SCORE,
  calculateReputationDelta,
  matchesHealthCertFilter,
  resolveAttendancePenalty,
  resolveDocumentReviewState,
  resolveReputationCount,
  resolveTagVerdict,
  resolveStaffStatus,
  resubmitDocumentLane,
  type HealthCertFilter,
} from "@/type/staff";
import {
  calculateBasePay,
  calculateScheduledWorkHours,
  resolveAssignmentSchedule,
} from "@/type/event";
import { findContractByWork } from "../db/contract";
import { events } from "../db/event";
import {
  findStaff,
  refreshHealthCertState,
  snapshotStaffDocuments,
  sortedStaff,
  staffList,
  syncStaffDocuments,
} from "../db/staff";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  badRequest,
  matchesKeyword,
  nextId,
  notFound,
  paginate,
  findRequester,
  requesterCan,
  requirePermission,
} from "../utils";

/** 목록 응답에서는 계좌 · 신분증처럼 민감한 값을 내려주지 않는다. */
const toStaffSummary = (staff: StaffDetail) => {
  /* 보건증 만료는 날짜가 지나면 생긴다. 내리기 직전에 오늘 기준으로 다시 구한다. */
  refreshHealthCertState(staff);

  const {
    bankName,
    accountNumber,
    accountHolder,
    idCardImageUrl,
    bankBookImageUrl,
    healthCertImageUrl,
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
  void healthCertImageUrl;
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
    /* 보건증도 개인 서류다. 상태(유효 · 만료)는 배치에 필요해 남기고 사진만 덜어 낸다. */
    masked.healthCertImageUrl = "";
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
  "healthCertImageUrl",
  "healthCertIssuedAt",
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
    /*
      보건증 유무. 식음료 행사에 부를 사람을 고를 때 쓴다.
      '없음'에는 만료 · 승인 대기 · 반려가 함께 들어간다 — 지금 현장에 세울 수 없다는 뜻이다.
    */
    const healthCert = (url.searchParams.get("healthCert") || undefined) as
      | HealthCertFilter
      | undefined;
    const onlyFavorite = url.searchParams.get("onlyFavorite") === "true";
    const sort = url.searchParams.get("sort") ?? "RECENT";

    const filtered = sortedStaff().filter((staff) => {
      if (!matchesHealthCertFilter(refreshHealthCertState(staff), healthCert)) {
        return false;
      }

      /*
        직원은 인력풀 목록에 세우지 않는다.

        인력풀은 "이번 행사에 누구를 부를까"를 고르는 자리이고, 그 판단의 축은
        서류 · 평판 · 지급 이력이다. 직원은 그 축 어디에도 해당하지 않아서
        섞여 있으면 서류 미제출 · 정산 없음으로만 읽힌다.
        직원 명부는 운영 > 직원 관리다. (배치 후보에는 당연히 함께 나온다)
      */
      if (staff.employment === "EMPLOYEE") return false;
      if (status && staff.status !== status) return false;
      if (role && !staff.roles.includes(role)) return false;
      if (region && staff.region !== region) return false;
      if (onlyFavorite && !staff.isFavorite) return false;
      /*
        서류 필터는 심사 상태를 그대로 받는다.

        예전에는 완료 · 미제출 둘뿐이었는데, 본인이 직접 올리게 되면서
        "냈지만 아직 안 본 것"과 "되돌려 보낸 것"이 생겼다. 이 둘이
        미제출에 섞이면 서류 담당자가 무엇부터 손대야 할지 알 수 없다.
      */
      if (documentState && staff.documentReviewState !== documentState) {
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

    /*
      **즐겨찾기가 언제나 맨 위다.**

      에이전시는 결국 부르던 사람을 또 부른다. 검색을 하든 정렬을 바꾸든
      그 사람들이 먼저 보여야 하고, 그러지 않으면 담당자는 스크롤을 내리다가
      결국 이름으로 다시 검색한다. 고른 정렬 기준은 **그다음**에 적용된다.

      화면이 아니라 여기서 정렬한다. 화면에서 다시 세우면 페이지가 넘어갈 때
      "2페이지 맨 위에 또 즐겨찾기"가 되어 순서가 통째로 어긋난다.
    */
    const sorted = [...filtered].sort((a, b) => {
      const byFavorite = Number(b.isFavorite) - Number(a.isFavorite);

      if (byFavorite !== 0) return byFavorite;

      if (sort === "WORK_COUNT") return b.workCount - a.workCount;
      /* 평판순은 누적 점수 그대로다. 오래 잘해 온 사람이 위로 온다. */
      if (sort === "RATING") return b.reputationScore - a.reputationScore;
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

    refreshHealthCertState(staff);

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

        /* 시간은 배치마다 그 포지션의 예정 시간이다. 1일차 A타임 · 2일차 B타임이 섞인다. */
        const hoursOf = (assignment: (typeof mine)[number]) =>
          calculateScheduledWorkHours(
            resolveAssignmentSchedule(event, assignment),
          );
        const workHours = hoursOf(mine[0]);

        const days: StaffWorkDay[] = mine
          .map((assignment) => ({
            assignmentId: assignment.assignmentId,
            date: assignment.workDate,
            attendance: assignment.attendance,
            lateMinutes: assignment.lateMinutes,
            payAmount: calculateBasePay(
              assignment.wageType,
              assignment.wage,
              hoursOf(assignment),
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
          totalWorkHours:
            Math.round(
              mine.reduce((sum, assignment) => sum + hoursOf(assignment), 0) *
                10,
            ) / 10,
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
              /* 점수 계산은 화면 · 집계와 같은 함수를 쓴다. */
              points: calculateReputationDelta(
                assignment.reputationTags ?? [],
                assignment.reputationVerdict,
              ),
              comment: assignment.reputationComment,
              ratedAt: assignment.reputationRatedAt,
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

      /*
        근태 감점도 같은 목록에 세운다. 총점은 평가와 감점을 함께 더한 값이라,
        감점 줄이 빠지면 목록을 다 더해도 총점이 나오지 않는다.
      */
      events.forEach((event) =>
        event.assignments.forEach((assignment) => {
          if (assignment.staffId !== staffId) return;

          const penalty = resolveAttendancePenalty(assignment);

          if (!penalty) return;

          items.push({
            assignmentId: assignment.assignmentId,
            eventId: event.eventId,
            eventTitle: event.title,
            clientName: event.clientName,
            workDate: assignment.workDate,
            role: assignment.role,
            verdict: "BAD",
            tags: [],
            points: penalty.points,
            comment: assignment.staffCancelReason,
            ratedAt: assignment.staffCanceledAt,
            ratedBy: "자동 감점",
            raterType: "AGENCY",
            penaltyType: penalty.type,
          });
        }),
      );

      items.sort((a, b) => b.workDate.localeCompare(a.workDate));

      /* 항목별 집계. "별로예요 12건"만으로는 무엇이 문제인지 알 수 없다. */
      const tagMap = new Map<string, { count: number; verdict: ReputationVerdict }>();

      items.forEach((item) =>
        item.tags.forEach((tag) => {
          const current = tagMap.get(tag);

          if (current) {
            current.count += 1;
            return;
          }

          /*
            방향은 **항목 자체**에서 온다. 평가의 방향(`item.verdict`)을 쓰면,
            좋아요와 별로예요가 섞인 평가에서 항목 색이 통째로 한쪽으로 칠해진다.
          */
          tagMap.set(tag, {
            count: 1,
            verdict: resolveTagVerdict(tag) ?? item.verdict,
          });
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

    const isDocumentComplete = Boolean(
      body.idCardImageUrl && body.bankBookImageUrl,
    );

    const now = new Date().toISOString();

    /*
      함께 올린 서류는 **승인이 아니라 제출**이다.
      담당자가 대신 올렸더라도 확인은 따로 눌러야 한다. 올리는 순간 승인이 되면
      "이 서류를 누가 확인했나"에 답할 수 있는 기록이 남지 않는다.
    */
    const reviews: StaffDocumentReviews = {
      ID_CARD: resubmitDocumentLane(Boolean(body.idCardImageUrl), now),
      BANK_ACCOUNT: resubmitDocumentLane(
        Boolean(body.bankBookImageUrl && body.accountNumber),
        now,
      ),
      HEALTH_CERT: resubmitDocumentLane(Boolean(body.healthCertImageUrl), now),
    };

    const documentReviewState = resolveDocumentReviewState(reviews);

    const created: StaffDetail = {
      ...body,
      staffId: nextId(staffList, "staffId"),
      /*
        새로 등록한 사람은 서류 승인 여부에 따라 갈린다.
        방금 올린 서류는 아직 승인 전이므로 대기중에서 시작한다.
        (`resolveStaffStatus` — 화면·시드와 같은 함수)
      */
      status: resolveStaffStatus({
        documentReviewState,
        employment: "FREELANCER",
      }),
      /* 인력풀에서 만드는 사람은 프리랜서다. 직원은 운영 > 직원 관리에서 등록한다. */
      employment: "FREELANCER",
      isDocumentComplete,
      documentReviewState,
      reviews,
      /* 빈 문자열은 '발급일 없음'이다. 비교에서 날짜로 읽히지 않게 비워 둔다. */
      healthCertImageUrl: body.healthCertImageUrl ?? "",
      healthCertIssuedAt: body.healthCertIssuedAt || undefined,
      healthCertState: reviews.HEALTH_CERT.state,
      workCount: 0,
      totalWorkHours: 0,
      noShowCount: 0,
      lateCount: 0,
      reputationScore: REPUTATION_BASE_SCORE,
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

    const before = snapshotStaffDocuments(staff);

    Object.assign(staff, body);

    /* 폼은 비운 발급일을 빈 문자열로 보낸다. 날짜로 읽히지 않게 비워 둔다. */
    if (!staff.healthCertIssuedAt) staff.healthCertIssuedAt = undefined;
    if (staff.healthCertImageUrl === undefined) staff.healthCertImageUrl = "";

    // 서류가 바뀌면 심사와 상태가 따라 움직인다. 판단은 한 함수에서만 한다.
    syncStaffDocuments(staff, before);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(staff);
  }),

  /**
   * 인력 삭제.
   *
   * 지금은 등록도 수정도 전부 손으로 하는 단계라, 잘못 넣은 사람을 지울 방법이 필요하다.
   * 다만 근무 이력이 있는 사람을 지우면 정산·계약서가 주인 없는 데이터가 되므로 막는다.
   * (그런 경우는 서류를 지워 '대기중'으로 내리거나 블랙리스트로 지정한다)
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
        이 주소로 오는 일은 사실상 **블랙리스트 지정과 해제** 둘뿐이다.
        대기중 ↔ 활동중은 서류가 정하므로(`resolveStaffStatus`) 사람이 고를 값이 아니다.

        블랙리스트는 그 사람을 다시 부르지 못하게 하는 일이라 따로 뗀
        권한(`blacklist:write`)이 있어야 한다. 해제도 마찬가지다 —
        지정만 막고 해제를 열어 두면 막은 뜻이 없다.

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

      if (body.status === "BLACKLIST") {
        staff.status = "BLACKLIST";
        staff.blacklistReason = body.reason;
        staff.blacklistedAt = new Date().toISOString();
        staff.isFavorite = false;
      } else {
        // 해제하면 사유를 남겨 두지 않는다. 이력은 메모로 관리한다.
        staff.blacklistReason = undefined;
        staff.blacklistedAt = undefined;
        /*
          해제한 뒤의 상태는 **요청 값이 아니라 서류가 정한다.**
          '활동중'으로 되돌려 달라는 요청을 그대로 반영하면, 서류가 없는
          사람이 활동중으로 올라가 확정 배치에서 막히는 상태가 만들어진다.
        */
        staff.status = resolveStaffStatus({ ...staff, status: undefined });
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
        healthCertImageUrl?: string;
        healthCertIssuedAt?: string;
      };

      if (!staff) return notFound("존재하지 않는 인력입니다.");

      const before = snapshotStaffDocuments(staff);

      Object.assign(staff, body);

      /*
        바뀐 갈래는 다시 승인 대기가 되고, 상태도 따라 움직인다.
        여기서 따라 움직이지 않으면 "서류를 지웠는데 목록은 활동중"이 남고,
        그 사람을 배치하려다 확정 단계에서야 막힌다.
      */
      syncStaffDocuments(staff, before);

      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(staff);
    },
  ),

  /**
   * 서류 심사 — 승인 · 반려.
   *
   * **반려는 사유 없이 할 수 없다.** 사유 없는 반려를 받은 사람은 무엇을 다시
   * 올려야 하는지 알 수 없어 같은 사진을 다시 올리고, 그 왕복이 담당자에게 돌아온다.
   * (블랙리스트가 사유를 강제하는 것과 같은 이유다)
   */
  http.patch(
    `${BASE_URI}/admin/staff/:staffId/documents/review`,
    async ({ params, request }) => {
      const denied = requirePermission(request, "staffDocument:write");

      if (denied) return denied;

      const staff = findStaff(Number(params.staffId));
      const body = (await request.json()) as {
        lane: DocumentLane;
        state: Extract<DocumentReviewState, "APPROVED" | "REJECTED">;
        rejectReason?: string;
      };

      if (!staff) return notFound("존재하지 않는 인력입니다.");

      const review = staff.reviews[body.lane];

      if (!review) return badRequest("알 수 없는 서류 종류입니다.");

      if (review.state === "NONE") {
        return badRequest(
          `${DOCUMENT_LANE_LABEL[body.lane]}이(가) 아직 제출되지 않았습니다.`,
        );
      }

      const reason = body.rejectReason?.trim() ?? "";

      if (body.state === "REJECTED" && reason.length < 5) {
        return badRequest(
          "반려 사유를 5자 이상 적어 주세요. 무엇을 다시 올려야 하는지 알 수 있어야 합니다.",
          "REJECT_REASON_REQUIRED",
        );
      }

      staff.reviews[body.lane] = {
        ...review,
        state: body.state,
        reviewedAt: new Date().toISOString(),
        reviewerName: findRequester(request)?.name ?? "관리자",
        rejectReason: body.state === "REJECTED" ? reason : undefined,
      };

      /* 대표 상태는 필수 서류만 본다. 보건증 심사는 활동 여부를 바꾸지 않는다. */
      staff.documentReviewState = resolveDocumentReviewState(staff.reviews);
      /* 승인이 끝나야 활동중이 된다. 판단은 언제나 같은 함수에서. */
      staff.status = resolveStaffStatus(staff);
      refreshHealthCertState(staff);

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
