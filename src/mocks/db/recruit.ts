import type {
  Application,
  ApplicationStatus,
  JobPosting,
  PostingPosition,
  PostingPositionTarget,
  PostingStatus,
} from "@/type/recruit";
import { ACTIVE_APPLICATION_STATUSES } from "@/type/recruit";
import { jobRoleLabel } from "@/store/useOrgStore";
import {
  GENDER_PREFERENCE_LABEL,
  WAGE_TYPE_LABEL,
  findPosition,
  formatTimeRange,
  matchesGenderPreference,
  type EventDetail,
} from "@/type/event";
import { hasValidHealthCert } from "@/type/staff";
import { formatKoreanDate } from "@/lib/dayjs";
import { DEMO_STAFF_ID } from "../demo";
import { dateFromToday, pickOne, randomInt, toIsoDateTime } from "../utils";
import {
  NIGHT_MARKET_EVENT_TITLE,
  events,
  findConflictEvent,
  findEvent,
} from "./event";
import { assignableStaff, findStaff } from "./staff";

const APPLICANT_NOTES = [
  "행사 경험 3회 있습니다. 종일 가능합니다.",
  "오후 2시부터 가능합니다. 오전은 학교 수업이 있습니다.",
  "지난달 같은 브랜드 팝업 참여했습니다.",
  "당일 종일 가능하고 설치까지 도와드릴 수 있습니다.",
  "처음 지원합니다. 성실히 하겠습니다.",
  "친구와 2명 함께 지원 가능합니다.",
];

const NEW_APPLICANT_NAMES = [
  "홍지아",
  "남기훈",
  "표수린",
  "구본재",
  "황예나",
  "석민호",
  "천하람",
  "양소희",
];

/**
 * 모집 포지션 한 건을 **행사 포지션에서 채운다.**
 *
 * 공고가 갖는 값은 모집 인원뿐이다. 이름 · 시각 · 금액 · 조건은 행사 포지션이 원본이라
 * 응답을 만들 때마다 여기서 다시 읽는다. 사본을 들고 있으면 행사에서 단가를
 * 고친 뒤에도 공고에는 옛 금액이 남아, 지원자가 본 금액과 계약서의 금액이 달라진다.
 */
export const toPostingPosition = (
  event: EventDetail,
  target: PostingPositionTarget,
  counts: { applicantCount: number; confirmedCount: number } = {
    applicantCount: 0,
    confirmedCount: 0,
  },
): PostingPosition | undefined => {
  const position = findPosition(event, target.positionId);

  if (!position) return undefined;

  return {
    positionId: position.positionId,
    name: position.name,
    jobRole: position.jobRole,
    startTime: position.startTime,
    endTime: position.endTime,
    endDayOffset: position.endDayOffset,
    breakMinutes: position.breakMinutes,
    wageType: position.wageType,
    wage: position.wage,
    genderPreference: position.genderPreference,
    requiresHealthCert: position.requiresHealthCert,
    requiredCount: target.requiredCount,
    ...counts,
  };
};

/**
 * 포지션별로 **하루에 몇 명이 모자라는지**.
 *
 * 여러 날 행사에서 합계로 세면 "3일 × 2명 = 6명 부족"이 되는데, 공고로 뽑는 것은
 * 사흘을 다 나올 **사람 두 명**이다. 그래서 날마다 모자란 수 중 가장 큰 값을 쓴다.
 */
export const shortageByPosition = (
  event: EventDetail,
): PostingPositionTarget[] =>
  event.positions
    .map((position) => ({
      positionId: position.positionId,
      requiredCount: Math.max(
        0,
        ...event.days.map((day) => {
          const slot = day.roles.find(
            (item) => item.positionId === position.positionId,
          );

          return slot ? slot.requiredCount - slot.assignedCount : 0;
        }),
      ),
    }))
    .filter((target) => target.requiredCount > 0);

/**
 * 관리자 쪽 공고 제목. 모자란 자리를 그대로 적는다. (`행사명 · A타임 2명 · 인형탈 1명`)
 *
 * 담당자가 무엇을 채워야 하는지 보려고 붙인 **내부 표기**라 포털에는 나가지 않는다.
 */
export const buildPostingTitle = (
  eventTitle: string,
  positions: Pick<PostingPosition, "name" | "requiredCount">[],
): string =>
  [
    eventTitle,
    ...positions.map((position) => `${position.name} ${position.requiredCount}명`),
  ].join(" · ");

/** 근무일을 공고문 한 줄로. 여러 날이면 전부 적는다 — 하루짜리로 읽히면 안 된다. */
const describePostingDates = (dates: string[]): string =>
  dates.length <= 5
    ? dates.map((date) => formatKoreanDate(date)).join(", ")
    : `${formatKoreanDate(dates[0])} ~ ${formatKoreanDate(dates[dates.length - 1])} 중 ${dates.length}일`;

/**
 * 오픈카톡방에 그대로 붙여넣을 공고문을 만든다.
 *
 * 지금은 대표가 매번 손으로 쓰는 글이다. 행사 정보에서 자동으로 만들어 두면
 * 시급 · 집합 장소 같은 필수 항목이 빠지는 실수를 없앨 수 있다.
 *
 * 포지션마다 **시각 · 금액 · 조건을 한 줄씩** 적는다. 행사 시간 하나만 적으면
 * B타임(야간)에 지원한 사람이 낮 근무인 줄 알고 온다.
 */
export const buildPostingContent = (
  event: EventDetail,
  positions: PostingPosition[],
): string =>
  [
    `[${event.title}] 포지션별 모집`,
    "",
    `📅 근무일: ${describePostingDates(event.dates)}`,
    `📍 장소: ${event.venue}`,
    `🚩 집합: ${event.meetingPoint}`,
    `👕 복장: ${event.dressCode}`,
    `🎒 준비물: ${event.belongings}`,
    "",
    "■ 모집 포지션",
    ...positions.flatMap((position) => {
      const conditions = [
        position.genderPreference !== "ANY"
          ? GENDER_PREFERENCE_LABEL[position.genderPreference]
          : "",
        position.requiresHealthCert ? "보건증 필수" : "",
      ].filter(Boolean);

      return [
        /*
          새벽에 끝나는 현장은 "21:00 ~ 06:00"으로만 적으면 지원자가
          당일 오전에 끝나는 줄 안다. 며칠 뒤에 끝나는지를 반드시 함께 적는다.
        */
        `- ${position.name} (${jobRoleLabel(position.jobRole)}) ${position.requiredCount}명 · ${formatTimeRange(position.startTime, position.endTime, position.endDayOffset)} · ${WAGE_TYPE_LABEL[position.wageType]} ${position.wage.toLocaleString("ko-KR")}원`,
        ...(conditions.length > 0 ? [`  └ 조건: ${conditions.join(" / ")}`] : []),
      ];
    }),
    "",
    /*
      업체가 적어 둔 안내는 **조건 아래, 정형 문구 위**에 붙인다.
      맨 아래에 두면 원천징수 · 계약서 안내에 묻혀 아무도 읽지 않고,
      맨 위에 두면 근무일 · 장소를 찾으러 온 사람이 매번 지나쳐야 한다.
    */
    ...(event.description ? [event.description, ""] : []),
    "💰 금액은 세전이며 3.3% 원천징수 후 지급됩니다.",
    "※ 근로계약서는 확정 후 앱에서 전자서명으로 받습니다.",
    "※ 첫 근무이신 분은 신분증 · 통장사본을 함께 보내주세요.",
    "",
    `지원: 앱의 공고에서 포지션을 골라 지원하거나, 성함 / 나이 / 희망 포지션 / 연락처를 담당자(${event.managerName})에게 보내주세요.`,
  ].join("\n");

let postingSequence = 0;
let applicationSequence = 0;

/**
 * 공고 목업. **행사 하나에 공고 하나**다.
 *
 * 아직 인원이 덜 찬 미래 행사에 대해서만 만든다. 모자란 포지션이 곧 모집 포지션이다.
 */
export const postings: JobPosting[] = events
  .filter(
    (event) =>
      event.status === "RECRUITING" &&
      event.totalAssigned < event.totalRequired,
  )
  .map((event) => {
    postingSequence += 1;

    const positions = shortageByPosition(event)
      .map((target) => toPostingPosition(event, target))
      .filter((position): position is PostingPosition => Boolean(position));

    /* 포지션 행사는 늘 모집중으로 둔다. 포털에서 포지션별 지원을 눌러 볼 자리다. */
    const status: PostingStatus =
      postingSequence % 7 === 0 && event.title !== NIGHT_MARKET_EVENT_TITLE
        ? "DRAFT"
        : "OPEN";

    return {
      postingId: postingSequence,
      eventId: event.eventId,
      eventTitle: event.title,
      clientName: event.clientName,
      title: buildPostingTitle(event.title, positions),
      positions,
      requiredCount: positions.reduce((sum, item) => sum + item.requiredCount, 0),
      applicantCount: 0,
      confirmedCount: 0,
      workDate: event.startDate,
      /* 근무일은 행사가 정한다. 기간이 아니라 반복 규칙의 결과다. (`resolveEventDates`) */
      workDates: event.dates,
      venue: event.venue,
      status,
      content: buildPostingContent(event, positions),
      publishedAt:
        status === "OPEN"
          ? toIsoDateTime(event.createdAt.slice(0, 10), "10:00")
          : undefined,
      closedAt: undefined,
      createdAt: event.createdAt,
    } satisfies JobPosting;
  })
  .filter((posting) => posting.positions.length > 0);

/**
 * 지원 목업.
 *
 * 기존 인력과 신규 지원자를 섞는다. 신규는 서류부터 받아야 하는 대상이므로
 * 화면에서 바로 구분되어야 한다.
 *
 * 시드는 한 사람당 한 공고에 한 건만 넣는다. **규칙이 그런 것은 아니다** —
 * 여러 자리에 걸어 두는 것은 허용되고, 확정되면 같은 날 나머지가 자동 취소된다.
 * 그건 야시장 공고에서 직접 지원해 보며 확인한다. (`buildDemoApplications`)
 */
export const applications: Application[] = postings
  .filter((posting) => posting.status === "OPEN")
  .flatMap((posting) => {
    const applicantCount = randomInt(posting.postingId * 3, 1, 6);
    const appliedStaffIds = new Set<number>();

    return Array.from({ length: applicantCount }, (_, index): Application | undefined => {
      const seed = posting.postingId * 100 + index;
      const position = pickOne(seed * 17, posting.positions);
      const pool = assignableStaff().filter(
        (staff) =>
          staff.staffId !== DEMO_STAFF_ID &&
          staff.roles.includes(position.jobRole) &&
          matchesGenderPreference(position.genderPreference, staff.gender) &&
          (!position.requiresHealthCert ||
            hasValidHealthCert(staff.healthCertState)),
      );
      const isExistingStaff = seed % 4 !== 0 && pool.length > 0;
      const staff = isExistingStaff
        ? pool[randomInt(seed, 0, pool.length - 1)]
        : undefined;

      /* 같은 사람이 같은 행사에 두 번 지원한 목록은 서버가 막는 상태다. */
      if (staff && appliedStaffIds.has(staff.staffId)) return undefined;
      if (staff) appliedStaffIds.add(staff.staffId);

      applicationSequence += 1;

      const status: ApplicationStatus =
        index === 0 && seed % 3 === 0
          ? "ACCEPTED"
          : seed % 11 === 0
            ? "REJECTED"
            : seed % 13 === 0
              ? "CANCELED"
              : "PENDING";

      const conflict = staff
        ? findConflictEvent(staff.staffId, posting.workDate, posting.eventId)
        : undefined;

      return {
        applicationId: applicationSequence,
        postingId: posting.postingId,
        postingTitle: posting.title,
        eventId: posting.eventId,
        eventTitle: posting.eventTitle,
        workDate: posting.workDate,
        positionId: position.positionId,
        positionName: position.name,
        role: position.jobRole,
        staffId: staff?.staffId,
        applicantName: staff?.name ?? pickOne(seed, NEW_APPLICANT_NAMES),
        phoneNumber:
          staff?.phoneNumber ??
          `010${randomInt(seed * 7, 2000, 9999)}${randomInt(seed * 11, 1000, 9999)}`,
        isExistingStaff: Boolean(staff),
        status,
        note: pickOne(seed * 3, APPLICANT_NOTES),
        conflictEventTitle: conflict?.title,
        appliedAt: toIsoDateTime(
          dateFromToday(-randomInt(seed * 5, 1, 6)),
          `${String(randomInt(seed * 5, 9, 21)).padStart(2, "0")}:00`,
        ),
        processedAt: status === "PENDING" ? undefined : posting.createdAt,
      } satisfies Application;
    }).filter((application): application is Application => Boolean(application));
  });

/* --------------------------- 데모 보정 --------------------------- */

/**
 * 포털 기본 접속자에게 **검토 대기 지원 두 건**을 보장한다. (`mocks/demo.ts`)
 *
 * 일정 화면의 '신청' 탭과 지원 취소는 검토 대기 건이 있어야 눌러 볼 수 있는데,
 * 시드는 지원자를 난수로 고르므로 이 사람이 한 건도 안 낸 상태가 자주 나온다.
 *
 * 포지션 행사(야시장)는 **비워 둔다.** 거기서 포지션을 골라 직접 지원해 보는 것이
 * 이 기능을 확인하는 길이다.
 */
const buildDemoApplications = () => {
  const staff = findStaff(DEMO_STAFF_ID);

  if (!staff) return;

  const targets = postings
    .filter(
      (posting) =>
        posting.status === "OPEN" &&
        posting.eventTitle !== NIGHT_MARKET_EVENT_TITLE,
    )
    .map((posting) => ({
      posting,
      position: posting.positions.find(
        (position) =>
          staff.roles.includes(position.jobRole) &&
          matchesGenderPreference(position.genderPreference, staff.gender) &&
          !position.requiresHealthCert,
      ),
    }))
    .filter(({ position }) => Boolean(position))
    .filter(
      ({ posting }) =>
        !applications.some(
          (application) =>
            application.staffId === DEMO_STAFF_ID &&
            application.eventId === posting.eventId,
        ),
    )
    .slice(0, 2);

  targets.forEach(({ posting, position }, index) => {
    if (!position) return;

    applicationSequence += 1;

    applications.push({
      applicationId: applicationSequence,
      postingId: posting.postingId,
      postingTitle: posting.title,
      eventId: posting.eventId,
      eventTitle: posting.eventTitle,
      workDate: posting.workDate,
      positionId: position.positionId,
      positionName: position.name,
      role: position.jobRole,
      staffId: staff.staffId,
      applicantName: staff.name,
      phoneNumber: staff.phoneNumber,
      isExistingStaff: true,
      status: "PENDING",
      note: "",
      conflictEventTitle: findConflictEvent(
        staff.staffId,
        posting.workDate,
        posting.eventId,
      )?.title,
      appliedAt: toIsoDateTime(dateFromToday(-(index + 1)), "20:10"),
    } satisfies Application);
  });
};

buildDemoApplications();

/**
 * 공고의 포지션을 행사에서 다시 채우고, 지원자 수 · 확정 수를 다시 센다.
 *
 * 행사에서 포지션을 고치거나 지웠을 때, 지원이 오갈 때 모두 이 함수를 거친다.
 * 지워진 포지션은 공고에서 빠진다. (배치 · 지원이 걸린 포지션은 행사 쪽에서 못 지운다)
 */
export const recalculatePostingCounts = () => {
  postings.forEach((posting) => {
    const event = findEvent(posting.eventId);
    const related = applications.filter(
      (application) => application.postingId === posting.postingId,
    );

    const countOf = (positionId: number) => {
      const own = related.filter(
        (application) => application.positionId === positionId,
      );

      return {
        applicantCount: own.filter(
          (application) => application.status !== "CANCELED",
        ).length,
        confirmedCount: own.filter(
          (application) => application.status === "ACCEPTED",
        ).length,
      };
    };

    if (event) {
      posting.positions = posting.positions
        .map((position) =>
          toPostingPosition(event, position, countOf(position.positionId)),
        )
        .filter((position): position is PostingPosition => Boolean(position));
      posting.eventTitle = event.title;
      posting.workDates = event.dates;
      posting.workDate = event.dates[0] ?? posting.workDate;
      posting.venue = event.venue;
    }

    posting.requiredCount = posting.positions.reduce(
      (sum, position) => sum + position.requiredCount,
      0,
    );
    posting.applicantCount = related.filter(
      (application) => application.status !== "CANCELED",
    ).length;
    posting.confirmedCount = related.filter(
      (application) => application.status === "ACCEPTED",
    ).length;
  });
};

recalculatePostingCounts();

export const findPosting = (postingId: number) =>
  postings.find((posting) => posting.postingId === postingId);

export const findApplication = (applicationId: number) =>
  applications.find(
    (application) => application.applicationId === applicationId,
  );

/**
 * 이 사람이 이 행사에 낸 **살아 있는 지원들.**
 *
 * 여러 포지션에 걸어 둘 수 있다. 예전에는 행사당 하나로 막았는데, 그러면
 * A타임에 넣어 두고 기다리는 동안 B타임이 차 버려도 손쓸 방법이 없었다.
 * 지원은 자리를 잡는 것이 아니라 **의사를 알리는 것**이라 여러 자리에 낼 수 있고,
 * 확정은 하나만 된다 — 담당자가 하나를 확정하면 같은 날에 걸린 나머지 지원은
 * 지워진다. (`handlers/recruit.ts`의 확정 처리)
 */
export const findActiveApplications = (staffId: number, eventId: number) =>
  applications.filter(
    (application) =>
      application.staffId === staffId &&
      application.eventId === eventId &&
      ACTIVE_APPLICATION_STATUSES.includes(application.status),
  );

/** 이 사람이 **이 포지션**에 낸 살아 있는 지원. 같은 자리에 두 번은 못 낸다. */
export const findActivePositionApplication = (
  staffId: number,
  eventId: number,
  positionId: number,
) =>
  findActiveApplications(staffId, eventId).find(
    (application) => application.positionId === positionId,
  );
