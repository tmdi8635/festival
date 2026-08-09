import type { CsvColumn } from "@/lib/csv";
import { jobRoleLabel } from "@/store/useOrgStore";
import { CONTRACT_STATUS_LABEL, type Contract } from "@/type/contract";
import {
  ASSIGNMENT_STATUS_LABEL,
  WAGE_TYPE_LABEL,
  formatTimeRange,
  toTimeInput,
  type Assignment,
} from "@/type/event";
import {
  ATTENDANCE_STATUS_LABEL,
  REPUTATION_VERDICT_LABEL,
  formatPhoneNumber,
} from "@/type/staff";

/**
 * CSV 컬럼 조각.
 *
 * 같은 데이터를 여러 화면에서 내려받는다. 배치는 배치 현황 · 일별 근무자 ·
 * 출퇴근 명부 세 곳에서, 계약서는 행사 탭과 계약서 관리 두 곳에서 나간다.
 *
 * 예전에는 화면마다 컬럼 배열을 통째로 새로 적었다. 그래서 필드를 하나 늘릴 때마다
 * (계약 차수를 넣을 때가 그랬다) 어떤 화면의 CSV에는 들어가고 어떤 화면에는 빠졌고,
 * 두 파일을 받아 비교하는 사람은 같은 건인데 열이 다른 표를 마주했다.
 *
 * 그래서 **의미 단위의 조각**으로 잘라 두고, 화면은 필요한 조각을 이어 붙이기만 한다.
 * 조각 안의 표기(날짜 넘김 · 라벨)를 고치면 모든 화면이 함께 따라온다.
 */

/* ------------------------------------------------------------------ */
/* 배치                                                                 */
/* ------------------------------------------------------------------ */

/** 누가 · 언제 · 무슨 일을 했는가 */
export const ASSIGNMENT_WHO_COLUMNS: CsvColumn<Assignment>[] = [
  { header: "근무일", value: (row) => row.workDate },
  { header: "이름", value: (row) => row.staffName },
  { header: "연락처", value: (row) => formatPhoneNumber(row.staffPhone) },
  { header: "직무", value: (row) => jobRoleLabel(row.role) },
];

/** 배치 상태와 근태 · 실제 출퇴근. 정산의 근거가 되는 값이다. */
export const ASSIGNMENT_ATTENDANCE_COLUMNS: CsvColumn<Assignment>[] = [
  { header: "배치 상태", value: (row) => ASSIGNMENT_STATUS_LABEL[row.status] },
  { header: "근태", value: (row) => ATTENDANCE_STATUS_LABEL[row.attendance] },
  { header: "지각(분)", value: (row) => row.lateMinutes },
  { header: "출근", value: (row) => toTimeInput(row.checkInAt) },
  { header: "퇴근", value: (row) => toTimeInput(row.checkOutAt) },
];

/** 이 사람을 이 날 얼마에 쓰는가 */
export const ASSIGNMENT_WAGE_COLUMNS: CsvColumn<Assignment>[] = [
  { header: "지급 기준", value: (row) => WAGE_TYPE_LABEL[row.wageType] },
  { header: "적용 금액", value: (row) => row.wage },
];

export const ASSIGNMENT_CONTRACT_COLUMNS: CsvColumn<Assignment>[] = [
  { header: "계약서", value: (row) => (row.isContractSigned ? "완료" : "미완료") },
];

/** 좋아요 · 별로예요와 그 사유 */
export const ASSIGNMENT_REPUTATION_COLUMNS: CsvColumn<Assignment>[] = [
  {
    header: "평가",
    value: (row) =>
      row.reputationVerdict
        ? REPUTATION_VERDICT_LABEL[row.reputationVerdict]
        : "",
  },
  { header: "평가 항목", value: (row) => row.reputationTags?.join(" · ") ?? "" },
];

/* ------------------------------------------------------------------ */
/* 계약서                                                               */
/* ------------------------------------------------------------------ */

export const CONTRACT_WHO_COLUMNS: CsvColumn<Contract>[] = [
  { header: "계약번호", value: (row) => row.contractNumber },
  { header: "이름", value: (row) => row.staffName },
  { header: "연락처", value: (row) => formatPhoneNumber(row.staffPhone) },
  { header: "직무", value: (row) => jobRoleLabel(row.role) },
];

/** 며칠짜리 계약인지. 금액의 근거가 되는 수량이다. */
export const CONTRACT_WORK_COLUMNS: CsvColumn<Contract>[] = [
  { header: "근무일", value: (row) => row.workDates.join(" ") },
  { header: "근무일수", value: (row) => row.workDates.length },
  {
    header: "근무시간",
    value: (row) => formatTimeRange(row.startTime, row.endTime, row.endDayOffset),
  },
  { header: "일 실근무시간", value: (row) => row.workHours },
  { header: "총 실근무시간", value: (row) => row.totalWorkHours },
];

export const CONTRACT_WAGE_COLUMNS: CsvColumn<Contract>[] = [
  {
    header: "지급 기준",
    value: (row) =>
      row.hasMixedWage ? "근무일별 상이" : WAGE_TYPE_LABEL[row.wageType],
  },
  { header: "금액", value: (row) => (row.hasMixedWage ? "" : row.wage) },
  {
    // 날마다 다르게 준 건은 총액이 어디서 나왔는지 이 열이 없으면 검산할 수 없다.
    header: "근무일별 금액",
    value: (row) =>
      row.hasMixedWage
        ? row.workDays
            .map(
              (day) =>
                `${day.workDate} ${WAGE_TYPE_LABEL[day.wageType]} ${day.wage}`,
            )
            .join(" / ")
        : "",
  },
  { header: "총 지급액", value: (row) => row.totalWage },
];

export const CONTRACT_STATUS_COLUMNS: CsvColumn<Contract>[] = [
  { header: "상태", value: (row) => CONTRACT_STATUS_LABEL[row.status] },
  { header: "템플릿", value: (row) => row.templateName },
];

/** 중도 종료로 다시 쓴 계약. "왜 금액이 달라졌는가"의 근거다. */
export const CONTRACT_REVISION_COLUMNS: CsvColumn<Contract>[] = [
  { header: "계약 차수", value: (row) => row.revision },
  { header: "재작성 사유", value: (row) => row.amendReason ?? "" },
  {
    header: "제외된 근무일",
    value: (row) => row.removedWorkDates?.join(" ") ?? "",
  },
];
