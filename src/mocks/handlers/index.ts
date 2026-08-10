import { auditLogHandlers } from "./auditLog";
import { clientHandlers } from "./client";
import { contractHandlers } from "./contract";
import { dashboardHandlers } from "./dashboard";
import { employeeHandlers } from "./employee";
import { eventHandlers } from "./event";
import { fileHandlers } from "./file";
import { messageHandlers } from "./message";
import { opsHandlers } from "./ops";
import { payrollHandlers } from "./payroll";
import { recruitHandlers } from "./recruit";
import { searchHandlers } from "./search";
import { staffHandlers } from "./staff";

/**
 * MSW 핸들러 모음.
 * 도메인별 파일에서 배열을 만들어 여기서 합친다.
 */
export const handlers = [
  // 감사 로그는 모든 변경 요청을 먼저 가로채야 하므로 항상 맨 앞에 둔다.
  ...auditLogHandlers,
  ...fileHandlers,
  ...searchHandlers,
  ...dashboardHandlers,
  // eventHandlers 안에서 `/admin/events/calendar`를 `/admin/events/:eventId`보다 먼저 등록한다.
  ...eventHandlers,
  ...staffHandlers,
  ...employeeHandlers,
  ...contractHandlers,
  ...payrollHandlers,
  ...recruitHandlers,
  ...messageHandlers,
  ...clientHandlers,
  ...opsHandlers,
];
