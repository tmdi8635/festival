import type { Assignment, EventDetail } from "@/type/event";
import { formatTimeRange, groupAssignmentsByStaff } from "@/type/event";
import { jobRoleLabel, sortByJobRole } from "@/store/useOrgStore";
import { formatPhoneNumber } from "@/type/staff";
import { formatKoreanDate } from "./dayjs";

/**
 * 행사 출근 안내 문구를 만든다.
 *
 * 지금은 대표가 매번 손으로 쓰고, 바쁘면 아예 못 보낸다.
 * 행사 정보에서 자동으로 만들어 두면 집합 장소 · 복장 같은 항목이 빠질 일이 없다.
 */
export const buildEventNotice = (event: EventDetail): string =>
  [
    `[${event.title}] 근무 안내`,
    "",
    `📅 근무일: ${formatKoreanDate(event.startDate)}${
      event.startDate === event.endDate
        ? ""
        : ` ~ ${formatKoreanDate(event.endDate)}`
    }`,
    `⏰ 근무시간: ${formatTimeRange(event.startTime, event.endTime, event.endDayOffset)} (휴게 ${event.breakMinutes}분)`,
    `📍 장소: ${event.venue}`,
    `   ${event.address}`,
    `🚩 집합: ${event.meetingPoint}`,
    `👕 복장: ${event.dressCode}`,
    `🎒 준비물: ${event.belongings}`,
    "",
    "※ 집합 시간 15분 전까지 도착 부탁드립니다.",
    "※ 근로계약서 서명이 끝나야 현장 투입이 가능합니다.",
    "",
    `문의: ${event.managerName}`,
  ].join("\n");

/**
 * 확정 인력을 **사람 단위**로 추린다.
 *
 * 배치는 사람 × 날짜라서, 사흘짜리 행사에 사흘 다 나오는 사람은 배치가 3건이다.
 * 그대로 늘어놓으면 단체 문자 수신 목록에 **같은 번호가 세 번 들어간다.**
 * 붙여넣고 보내는 순간 그 사람만 문자를 세 통 받는다.
 *
 * 나열 순서는 기준 설정에서 정한 직무 순서를 따른다. 배치가 만들어진 순서대로
 * 두면 팀장이 명단 한가운데에 박혀, 받는 쪽에서 누가 책임자인지 알 수 없다.
 */
export const confirmedRoster = (
  assignments: Assignment[],
): { assignment: Assignment; dayCount: number }[] =>
  sortByJobRole(
    groupAssignmentsByStaff(
      assignments.filter((assignment) => assignment.status === "CONFIRMED"),
    ).map((group) => ({ assignment: group[0], dayCount: group.length })),
    (item) => item.assignment.role,
    (a, b) => a.assignment.staffName.localeCompare(b.assignment.staffName),
  );

/**
 * 확정 인력의 연락처 목록을 만든다.
 * 문자 발송 연동 전까지는 이 목록을 복사해 단체 문자를 보낸다.
 */
export const buildContactList = (assignments: Assignment[]): string =>
  confirmedRoster(assignments)
    .map(
      ({ assignment, dayCount }) =>
        `${assignment.staffName} / ${formatPhoneNumber(assignment.staffPhone)} / ${jobRoleLabel(assignment.role)}${
          dayCount > 1 ? ` / ${dayCount}일` : ""
        }`,
    )
    .join("\n");

/** 문자 발송용 전화번호만 콤마로 잇는다. (문자 프로그램에 바로 붙여넣기) */
export const buildPhoneNumberList = (assignments: Assignment[]): string =>
  confirmedRoster(assignments)
    .map(({ assignment }) => formatPhoneNumber(assignment.staffPhone))
    .join(", ");
