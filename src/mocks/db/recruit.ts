import type {
  Application,
  ApplicationStatus,
  JobPosting,
  PostingLine,
  PostingStatus,
  PostingTarget,
} from "@/type/recruit";
import {
  ACTIVE_APPLICATION_STATUSES,
  applicationDates,
  formatDateList,
  formatLineLabel,
  resolveLineDates,
  suggestPostingTargets,
} from "@/type/recruit";
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
 * 모집 줄 한 건을 **행사 포지션에서 채운다.**
 *
 * 공고가 갖는 값은 인원 · 참여 방식 · 날짜뿐이다. 이름 · 시각 · 금액 · 조건은 행사
 * 포지션이 원본이라 응답을 만들 때마다 여기서 다시 읽는다. 사본을 들고 있으면 행사에서
 * 단가를 고친 뒤에도 공고에는 옛 금액이 남아, 지원자가 본 금액과 계약서의 금액이 달라진다.
 */
export const toPostingLine = (
  event: EventDetail,
  target: PostingTarget,
  counts: { applicantCount: number; confirmedCount: number } = {
    applicantCount: 0,
    confirmedCount: 0,
  },
): PostingLine | undefined => {
  const position = findPosition(event, target.positionId);

  if (!position) return undefined;

  return {
    targetId: target.targetId,
    positionId: position.positionId,
    requiredCount: target.requiredCount,
    participation: target.participation,
    dates: target.dates,
    isUrgent: target.isUrgent,
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
    workDates: resolveLineDates(event, target),
    ...counts,
  };
};

/**
 * 관리자 쪽 공고 제목. 모자란 자리를 그대로 적는다.
 * (`행사명 · A타임 전일 2명 · [급구] A타임 09.13 1명`)
 *
 * 담당자가 무엇을 채워야 하는지 보려고 붙인 **내부 표기**라 포털에는 나가지 않는다.
 */
export const buildPostingTitle = (
  eventTitle: string,
  lines: Parameters<typeof formatLineLabel>[0][],
  eventDayCount: number,
): string =>
  [eventTitle, ...lines.map((line) => formatLineLabel(line, eventDayCount))].join(
    " · ",
  );

/** 근무일을 공고문 한 줄로. 여러 날이면 전부 적는다 — 하루짜리로 읽히면 안 된다. */
const describePostingDates = (dates: string[]): string =>
  dates.length <= 5
    ? dates.map((date) => formatKoreanDate(date)).join(", ")
    : `${formatKoreanDate(dates[0])} ~ ${formatKoreanDate(dates[dates.length - 1])} 중 ${dates.length}일`;

/**
 * 공고문에서 줄이 여는 날을 설명한다.
 *
 * **전일인지 날짜를 고르는지를 말로 적는다.** 오픈카톡방에서 공고를 본 사람은
 * 앱의 배지를 보지 못한다. "3일 중 하루만 되는데 지원해도 되나요?"라는 문의가
 * 줄마다 쏟아지는 것은 이 한 줄이 없어서다.
 */
const describeLineDatesForContent = (line: PostingLine): string => {
  if (line.workDates.length <= 1) return "";

  return line.participation === "FULL"
    ? `  └ 전 일정(${formatDateList(line.workDates)}) 모두 가능하신 분만`
    : `  └ ${formatDateList(line.workDates)} 중 가능한 날을 골라 지원 (하루도 가능)`;
};

/**
 * 오픈카톡방에 그대로 붙여넣을 공고문을 만든다.
 *
 * 지금은 대표가 매번 손으로 쓰는 글이다. 행사 정보에서 자동으로 만들어 두면
 * 시급 · 집합 장소 같은 필수 항목이 빠지는 실수를 없앨 수 있다.
 *
 * 줄마다 **시각 · 금액 · 조건 · 날짜를 한 줄씩** 적는다. 행사 시간 하나만 적으면
 * B타임(야간)에 지원한 사람이 낮 근무인 줄 알고 온다.
 */
export const buildPostingContent = (
  event: EventDetail,
  lines: PostingLine[],
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
    ...lines.flatMap((line) => {
      const conditions = [
        line.genderPreference !== "ANY"
          ? GENDER_PREFERENCE_LABEL[line.genderPreference]
          : "",
        line.requiresHealthCert ? "보건증 필수" : "",
      ].filter(Boolean);
      const dateLine = describeLineDatesForContent(line);

      return [
        /*
          새벽에 끝나는 현장은 "21:00 ~ 06:00"으로만 적으면 지원자가
          당일 오전에 끝나는 줄 안다. 며칠 뒤에 끝나는지를 반드시 함께 적는다.
        */
        `- ${line.isUrgent ? "[급구] " : ""}${line.name} (${jobRoleLabel(line.jobRole)}) ${line.requiredCount}명 · ${formatTimeRange(line.startTime, line.endTime, line.endDayOffset)} · ${WAGE_TYPE_LABEL[line.wageType]} ${line.wage.toLocaleString("ko-KR")}원`,
        ...(dateLine ? [dateLine] : []),
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
    `지원: 앱의 공고에서 포지션을 골라 지원하거나, 성함 / 나이 / 희망 포지션 · 가능한 날 / 연락처를 담당자(${event.managerName})에게 보내주세요.`,
  ].join("\n");

/** 공고 안에서 다음 줄 번호. 지운 번호는 다시 쓰지 않는다 — 지원이 옛 번호를 들고 있을 수 있다. */
export const nextTargetId = (posting: Pick<JobPosting, "lines">): number =>
  Math.max(0, ...posting.lines.map((line) => line.targetId)) + 1;

let postingSequence = 0;
let applicationSequence = 0;

/**
 * 야시장은 포털에서 공고를 직접 눌러 보는 행사다. 여기에 **급구 줄**을 하나 세운다.
 *
 * 발주가 날마다 같아서 부족 계산만으로는 급구 줄이 생기지 않는다. 그런데 급구는
 * 이 기능의 절반이라, 눌러 볼 것이 없으면 화면은 멀쩡한데 확인할 방법이 없다.
 * 마지막 날 A타임에 노쇼가 난 상황으로 둔다.
 */
const nightMarketUrgentTarget = (
  event: EventDetail,
): Omit<PostingTarget, "targetId">[] => {
  const lastDate = event.dates[event.dates.length - 1];

  if (event.title !== NIGHT_MARKET_EVENT_TITLE || !lastDate) return [];

  return [
    {
      positionId: 1,
      requiredCount: 1,
      participation: "SPLIT",
      dates: [lastDate],
      isUrgent: true,
    },
  ];
};

/**
 * 공고 목업. **행사 하나에 공고 하나**다.
 *
 * 아직 인원이 덜 찬 미래 행사에 대해서만 만든다. 모자란 자리가 곧 모집 줄이다.
 * (`suggestPostingTargets` — 공고 폼의 초기값과 같은 규칙)
 */
export const postings: JobPosting[] = events
  .filter(
    (event) =>
      event.status === "RECRUITING" &&
      event.totalAssigned < event.totalRequired,
  )
  .map((event) => {
    postingSequence += 1;

    const lines = [...suggestPostingTargets(event), ...nightMarketUrgentTarget(event)]
      .map((target, index) => toPostingLine(event, { ...target, targetId: index + 1 }))
      .filter((line): line is PostingLine => Boolean(line));

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
      title: buildPostingTitle(event.title, lines, event.dates.length),
      lines,
      requiredCount: lines.reduce((sum, item) => sum + item.requiredCount, 0),
      applicantCount: 0,
      confirmedCount: 0,
      workDate: event.startDate,
      /* 근무일은 행사가 정한다. 기간이 아니라 반복 규칙의 결과다. (`resolveEventDates`) */
      workDates: event.dates,
      venue: event.venue,
      status,
      content: buildPostingContent(event, lines),
      publishedAt:
        status === "OPEN"
          ? toIsoDateTime(event.createdAt.slice(0, 10), "10:00")
          : undefined,
      closedAt: undefined,
      createdAt: event.createdAt,
    } satisfies JobPosting;
  })
  .filter((posting) => posting.lines.length > 0);

/**
 * 분할 줄에 낸 시드 지원의 날짜. 줄의 날 중 일부를 고른 것처럼 만든다.
 * 전부 고른 지원만 있으면 '3일 중 2일 신청'이 화면에 한 번도 나오지 않는다.
 */
const pickSeedDates = (line: PostingLine, seed: number): string[] => {
  if (line.participation === "FULL" || line.workDates.length <= 1) {
    return line.workDates;
  }

  const count = randomInt(seed * 13, 1, line.workDates.length);

  return line.workDates.slice(0, count);
};

/**
 * 지원 목업.
 *
 * 기존 인력과 신규 지원자를 섞는다. 신규는 서류부터 받아야 하는 대상이므로
 * 화면에서 바로 구분되어야 한다.
 *
 * 시드는 한 사람당 한 공고에 한 건만 넣는다. **규칙이 그런 것은 아니다** —
 * 여러 줄에 걸어 두는 것은 허용되고, 확정되면 같은 날 나머지가 자동으로 지워진다.
 * 그건 야시장 공고에서 직접 지원해 보며 확인한다. (`buildDemoApplications`)
 */
export const applications: Application[] = postings
  .filter((posting) => posting.status === "OPEN")
  .flatMap((posting) => {
    const applicantCount = randomInt(posting.postingId * 3, 1, 6);
    const appliedStaffIds = new Set<number>();

    return Array.from({ length: applicantCount }, (_, index): Application | undefined => {
      const seed = posting.postingId * 100 + index;
      const line = pickOne(seed * 17, posting.lines);
      const pool = assignableStaff().filter(
        (staff) =>
          staff.staffId !== DEMO_STAFF_ID &&
          staff.roles.includes(line.jobRole) &&
          matchesGenderPreference(line.genderPreference, staff.gender) &&
          (!line.requiresHealthCert ||
            hasValidHealthCert(staff.healthCertState)),
      );
      const isExistingStaff = seed % 4 !== 0 && pool.length > 0;
      const staff = isExistingStaff
        ? pool[randomInt(seed, 0, pool.length - 1)]
        : undefined;

      /* 같은 사람이 같은 행사에 두 번 지원한 목록은 서버가 막는 상태다. */
      if (staff && appliedStaffIds.has(staff.staffId)) return undefined;
      if (staff) appliedStaffIds.add(staff.staffId);

      const requestedDates = pickSeedDates(line, seed);

      if (requestedDates.length === 0) return undefined;

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
        ? requestedDates
            .map((date) => findConflictEvent(staff.staffId, date, posting.eventId))
            .find(Boolean)
        : undefined;

      return {
        applicationId: applicationSequence,
        postingId: posting.postingId,
        postingTitle: posting.title,
        eventId: posting.eventId,
        eventTitle: posting.eventTitle,
        workDate: requestedDates[0],
        targetId: line.targetId,
        positionId: line.positionId,
        positionName: line.name,
        role: line.jobRole,
        participation: line.participation,
        requestedDates,
        confirmedDates: status === "ACCEPTED" ? requestedDates : undefined,
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
 * **그중 하나는 분할 줄에 일부 날만 낸 지원이다.** '3일 중 2일 신청'이 본인 카드와
 * 관리자 확정 모달에서 어떻게 읽히는지 확인할 거리가 있어야 한다.
 *
 * 포지션 행사(야시장)는 **비워 둔다.** 거기서 줄을 골라 직접 지원해 보는 것이
 * 이 기능을 확인하는 길이다.
 */
const buildDemoApplications = () => {
  const staff = findStaff(DEMO_STAFF_ID);

  if (!staff) return;

  const candidates = postings
    .filter(
      (posting) =>
        posting.status === "OPEN" &&
        posting.eventTitle !== NIGHT_MARKET_EVENT_TITLE &&
        !applications.some(
          (application) =>
            application.staffId === DEMO_STAFF_ID &&
            application.eventId === posting.eventId,
        ),
    )
    .flatMap((posting) =>
      posting.lines
        .filter(
          (line) =>
            line.workDates.length > 0 &&
            staff.roles.includes(line.jobRole) &&
            matchesGenderPreference(line.genderPreference, staff.gender) &&
            !line.requiresHealthCert,
        )
        .map((line) => ({ posting, line })),
    );

  /* 분할 줄(여러 날)을 먼저 하나, 그 다음은 다른 행사의 아무 줄이나 하나. */
  const split = candidates.find(
    ({ line }) => line.participation === "SPLIT" && line.workDates.length > 1,
  );
  const other = candidates.find(
    ({ posting }) => posting.eventId !== split?.posting.eventId,
  );
  const targets = [split, other].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );

  targets.forEach(({ posting, line }, index) => {
    applicationSequence += 1;

    /* 분할 줄은 마지막 날을 빼고 낸다. 전부 고른 지원으로는 차이가 보이지 않는다. */
    const requestedDates =
      line.participation === "SPLIT" && line.workDates.length > 1
        ? line.workDates.slice(0, -1)
        : line.workDates;

    applications.push({
      applicationId: applicationSequence,
      postingId: posting.postingId,
      postingTitle: posting.title,
      eventId: posting.eventId,
      eventTitle: posting.eventTitle,
      workDate: requestedDates[0],
      targetId: line.targetId,
      positionId: line.positionId,
      positionName: line.name,
      role: line.jobRole,
      participation: line.participation,
      requestedDates,
      staffId: staff.staffId,
      applicantName: staff.name,
      phoneNumber: staff.phoneNumber,
      isExistingStaff: true,
      status: "PENDING",
      note: "",
      conflictEventTitle: requestedDates
        .map((date) => findConflictEvent(staff.staffId, date, posting.eventId))
        .find(Boolean)?.title,
      appliedAt: toIsoDateTime(dateFromToday(-(index + 1)), "20:10"),
    } satisfies Application);
  });
};

buildDemoApplications();

/**
 * 공고의 줄을 행사에서 다시 채우고, 지원자 수 · 확정 수를 다시 센다.
 *
 * 행사에서 포지션을 고치거나 지웠을 때, 지원이 오갈 때 모두 이 함수를 거친다.
 * 지워진 포지션의 줄은 공고에서 빠진다. (배치 · 지원이 걸린 포지션은 행사 쪽에서 못 지운다)
 */
export const recalculatePostingCounts = () => {
  postings.forEach((posting) => {
    const event = findEvent(posting.eventId);
    const related = applications.filter(
      (application) => application.postingId === posting.postingId,
    );

    const countOf = (targetId: number) => {
      const own = related.filter((application) => application.targetId === targetId);

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
      posting.lines = posting.lines
        .map((line) => toPostingLine(event, line, countOf(line.targetId)))
        .filter((line): line is PostingLine => Boolean(line));
      posting.eventTitle = event.title;
      posting.workDates = event.dates;
      posting.workDate = event.dates[0] ?? posting.workDate;
      posting.venue = event.venue;
    }

    posting.requiredCount = posting.lines.reduce(
      (sum, line) => sum + line.requiredCount,
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
 * 여러 줄에 걸어 둘 수 있다. 예전에는 행사당 하나로 막았는데, 그러면
 * A타임에 넣어 두고 기다리는 동안 B타임이 차 버려도 손쓸 방법이 없었다.
 * 지원은 자리를 잡는 것이 아니라 **의사를 알리는 것**이라 여러 자리에 낼 수 있고,
 * 확정은 하나만 된다 — 담당자가 하나를 확정하면 같은 날에 걸린 나머지 지원은
 * 지워진다. (`dropOverlappingApplications`)
 */
export const findActiveApplications = (staffId: number, eventId: number) =>
  applications.filter(
    (application) =>
      application.staffId === staffId &&
      application.eventId === eventId &&
      ACTIVE_APPLICATION_STATUSES.includes(application.status),
  );

/** 이 사람이 **이 줄**에 낸 살아 있는 지원. 같은 줄에 두 번은 못 낸다. */
export const findActiveLineApplication = (
  staffId: number,
  eventId: number,
  targetId: number,
) =>
  findActiveApplications(staffId, eventId).find(
    (application) => application.targetId === targetId,
  );

/**
 * 확정된 날에 걸린 이 사람의 **나머지 검토 대기 지원을 지운다.** 지운 것의 이름을 돌려준다.
 *
 * 한 사람이 여러 자리에 걸어 둘 수 있게 하면서 정리를 담당자 손에 맡기면
 * 반드시 하나가 남는다. 남은 지원은 나중에 다른 담당자가 확정을 눌러
 * 같은 날 두 곳에 세우려다 막히거나(그때는 이유를 모른다), 본인 화면에
 * '검토대기'로 계속 떠 있어 다른 일을 잡지 못하게 한다.
 *
 * **'지원취소'로 남기지 않고 지운다.** 본인이 무른 것과 시스템이 정리한 것이
 * 같은 낱말로 목록에 나란히 서면, 본인은 자기가 취소한 적 없는 건을 보고
 * 누가 내렸는지 묻게 된다. 애초에 낼 수 없었던 지원으로 두는 편이 맞다.
 *
 * 날짜는 줄 전체가 아니라 **그 지원이 신청한 날**로 본다. 분할 줄에 둘째 날만 낸
 * 지원은 첫날이 확정되어도 살아 있어야 한다.
 */
export const dropOverlappingApplications = (
  staffId: number,
  dates: readonly string[],
  exceptApplicationId?: number,
): { dropped: string[]; trimmed: string[] } => {
  const confirmed = new Set(dates);
  const dropped: string[] = [];
  const trimmed: string[] = [];

  /* 뒤에서부터 지운다. 앞에서 지우면 남은 항목의 자리가 밀린다. */
  for (let index = applications.length - 1; index >= 0; index -= 1) {
    const other = applications[index];

    if (
      other.applicationId === exceptApplicationId ||
      other.staffId !== staffId ||
      other.status !== "PENDING"
    ) {
      continue;
    }

    if (!applicationDates(other).some((date) => confirmed.has(date))) continue;

    const label = `${other.eventTitle} '${other.positionName}'`;

    /*
      **날짜를 골라 낸 지원은 겹친 날만 뺀다.** 남은 날은 여전히 그 사람이 나오겠다고
      한 날이다. 사흘 낸 지원을 하루 겹쳤다고 통째로 지우면, 담당자는 나머지 이틀에
      그 사람이 있었다는 것을 영영 모른다. 전일 지원은 일부만 남길 수 없어 지운다.
    */
    if (other.participation === "SPLIT") {
      const remaining = other.requestedDates.filter((date) => !confirmed.has(date));

      if (remaining.length > 0) {
        other.requestedDates = remaining;
        other.workDate = remaining[0];
        trimmed.unshift(label);
        continue;
      }
    }

    applications.splice(index, 1);
    dropped.unshift(label);
  }

  return { dropped, trimmed };
};
