import type {
  Application,
  ApplicationStatus,
  JobPosting,
  PostingStatus,
} from "@/type/recruit";
import { jobRoleLabel } from "@/store/useOrgStore";
import {
  WAGE_TYPE_LABEL,
  formatTimeRange,
  type DayOffset,
  type WageType,
} from "@/type/event";
import { formatKoreanDate } from "@/lib/dayjs";
import { pickOne, randomInt, toIsoDateTime } from "../utils";
import { events, findConflictEvent } from "./event";
import { assignableStaff } from "./staff";

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
 * 오픈카톡방에 그대로 붙여넣을 공고문을 만든다.
 *
 * 지금은 대표가 매번 손으로 쓰는 글이다. 행사 정보에서 자동으로 만들어 두면
 * 시급 · 집합 장소 같은 필수 항목이 빠지는 실수를 없앨 수 있다.
 */
export const buildPostingContent = (params: {
  eventTitle: string;
  workDate: string;
  startTime: string;
  endTime: string;
  endDayOffset: DayOffset;
  venue: string;
  meetingPoint: string;
  role: string;
  requiredCount: number;
  wageType: WageType;
  wage: number;
  dressCode: string;
  belongings: string;
  managerName: string;
}): string =>
  [
    `[${params.eventTitle}] ${params.role} ${params.requiredCount}명 모집`,
    "",
    `📅 근무일: ${formatKoreanDate(params.workDate)}`,
    /*
      새벽에 끝나는 현장은 "18:00 ~ 04:00"으로만 적으면 지원자가
      당일 오전에 끝나는 줄 안다. 며칠 뒤에 끝나는지를 반드시 함께 적는다.
    */
    `⏰ 근무시간: ${formatTimeRange(params.startTime, params.endTime, params.endDayOffset)}`,
    `📍 장소: ${params.venue}`,
    `🚩 집합: ${params.meetingPoint}`,
    `💰 ${WAGE_TYPE_LABEL[params.wageType]}: ${params.wage.toLocaleString("ko-KR")}원 (세전, 3.3% 원천징수)`,
    `👕 복장: ${params.dressCode}`,
    `🎒 준비물: ${params.belongings}`,
    "",
    "※ 근로계약서는 확정 후 문자로 발송됩니다. 근무 전까지 서명 부탁드립니다.",
    "※ 첫 근무이신 분은 신분증 · 통장사본을 함께 보내주세요.",
    "",
    `지원: 성함 / 나이 / 경력 / 연락처를 담당자(${params.managerName})에게 보내주세요.`,
  ].join("\n");

let postingSequence = 0;
let applicationSequence = 0;

/**
 * 공고 목업.
 *
 * 아직 인원이 덜 찬 미래 행사에 대해서만 공고를 만든다.
 * 채워야 할 자리가 곧 공고이므로, 배치 현황과 자연스럽게 이어진다.
 */
export const postings: JobPosting[] = events
  .filter(
    (event) =>
      event.status === "RECRUITING" &&
      event.totalAssigned < event.totalRequired,
  )
  .flatMap((event) =>
    event.roles
      .filter((slot) => slot.assignedCount < slot.requiredCount)
      .map((slot) => {
        postingSequence += 1;

        const shortage = slot.requiredCount - slot.assignedCount;
        const status: PostingStatus =
          postingSequence % 7 === 0 ? "DRAFT" : "OPEN";

        return {
          postingId: postingSequence,
          eventId: event.eventId,
          eventTitle: event.title,
          clientName: event.clientName,
          title: `${event.title} · ${jobRoleLabel(slot.role)} ${shortage}명`,
          role: slot.role,
          requiredCount: shortage,
          applicantCount: 0,
          confirmedCount: 0,
          wageType: slot.wageType,
          wage: slot.wage,
          workDate: event.startDate,
          startTime: event.startTime,
          endTime: event.endTime,
          endDayOffset: event.endDayOffset,
          venue: event.venue,
          status,
          content: buildPostingContent({
            eventTitle: event.title,
            workDate: event.startDate,
            startTime: event.startTime,
            endTime: event.endTime,
            endDayOffset: event.endDayOffset,
            venue: event.venue,
            meetingPoint: event.meetingPoint,
            role: jobRoleLabel(slot.role),
            requiredCount: shortage,
            wageType: slot.wageType,
            wage: slot.wage,
            dressCode: event.dressCode,
            belongings: event.belongings,
            managerName: event.managerName,
          }),
          publishedAt:
            status === "OPEN"
              ? toIsoDateTime(event.createdAt.slice(0, 10), "10:00")
              : undefined,
          closedAt: undefined,
          createdAt: event.createdAt,
        } satisfies JobPosting;
      }),
  );

/**
 * 지원 목업.
 *
 * 기존 인력과 신규 지원자를 섞는다. 신규는 서류부터 받아야 하는 대상이므로
 * 화면에서 바로 구분되어야 한다.
 */
export const applications: Application[] = postings
  .filter((posting) => posting.status === "OPEN")
  .flatMap((posting) => {
    const applicantCount = randomInt(posting.postingId * 3, 1, 6);
    const pool = assignableStaff().filter((staff) =>
      staff.roles.includes(posting.role),
    );

    return Array.from({ length: applicantCount }, (_, index) => {
      applicationSequence += 1;

      const seed = posting.postingId * 100 + index;
      const isExistingStaff = seed % 4 !== 0;
      const staff = pool[randomInt(seed, 0, Math.max(0, pool.length - 1))];

      const status: ApplicationStatus =
        index === 0 && seed % 3 === 0
          ? "ACCEPTED"
          : seed % 11 === 0
            ? "REJECTED"
            : seed % 13 === 0
              ? "CANCELED"
              : "PENDING";

      const conflict =
        isExistingStaff && staff
          ? findConflictEvent(staff.staffId, posting.workDate)
          : undefined;

      return {
        applicationId: applicationSequence,
        postingId: posting.postingId,
        postingTitle: posting.title,
        eventId: posting.eventId,
        eventTitle: posting.eventTitle,
        workDate: posting.workDate,
        role: posting.role,
        staffId: isExistingStaff ? staff?.staffId : undefined,
        applicantName: isExistingStaff
          ? (staff?.name ?? "미상")
          : pickOne(seed, NEW_APPLICANT_NAMES),
        phoneNumber: isExistingStaff
          ? (staff?.phoneNumber ?? "01000000000")
          : `010${randomInt(seed * 7, 2000, 9999)}${randomInt(seed * 11, 1000, 9999)}`,
        isExistingStaff,
        status,
        note: pickOne(seed * 3, APPLICANT_NOTES),
        conflictEventTitle: conflict?.title,
        appliedAt: toIsoDateTime(
          posting.workDate,
          `${String(randomInt(seed * 5, 9, 21)).padStart(2, "0")}:00`,
        ),
        processedAt: status === "PENDING" ? undefined : posting.createdAt,
      } satisfies Application;
    });
  });

/** 공고의 지원자 수 · 확정 수를 지원 목록에서 다시 계산한다. */
export const recalculatePostingCounts = () => {
  postings.forEach((posting) => {
    const related = applications.filter(
      (application) => application.postingId === posting.postingId,
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
