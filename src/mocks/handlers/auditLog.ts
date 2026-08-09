import { http } from "msw";
import type { LogDomain } from "@/type/ops";
import { operationLogs } from "../db/ops";
import { BASE_URI } from "../utils";

/** 경로 앞부분 → 운영 로그 도메인 */
const DOMAIN_BY_PATH_SEGMENT: Record<string, LogDomain> = {
  events: "EVENT",
  assignments: "EVENT",
  staff: "STAFF",
  contracts: "CONTRACT",
  "contract-templates": "CONTRACT",
  payrolls: "PAYROLL",
  postings: "RECRUIT",
  applications: "RECRUIT",
  messages: "MESSAGE",
  "message-templates": "MESSAGE",
  clients: "CLIENT",
  managers: "OPS",
  settings: "OPS",
  files: "OPS",
};

/** HTTP 메서드 → 사람이 읽는 동작 이름 */
const ACTION_BY_METHOD: Record<string, string> = {
  POST: "생성",
  PUT: "수정",
  PATCH: "변경",
  DELETE: "삭제",
};

/** `/admin/events/3/assignments` → `EVENT` */
const resolveDomain = (pathname: string): LogDomain => {
  const segments = pathname.replace(/^\/admin\/?/, "").split("/");

  for (const segment of segments) {
    const domain = DOMAIN_BY_PATH_SEGMENT[segment];
    if (domain) return domain;
  }

  return "OPS";
};

/**
 * 감사 로그 기록 핸들러.
 *
 * "누가 무엇을 바꿨는지"가 남아야 대표 혼자 판단하던 일을 나눌 수 있다.
 *
 * MSW는 resolver가 아무것도 반환하지 않으면 다음 핸들러로 넘어간다.
 * 이 성질을 이용해 **모든 변경 요청을 먼저 가로채 로그만 남기고 통과**시킨다.
 * 따라서 handlers 배열에서 반드시 가장 앞에 와야 한다.
 */
export const auditLogHandlers = [
  http.all(`${BASE_URI}/admin/*`, ({ request }) => {
    const action = ACTION_BY_METHOD[request.method];

    // 조회(GET)는 감사 대상이 아니다.
    if (!action) return;

    const { pathname } = new URL(request.url);

    operationLogs.unshift({
      logId: Math.max(...operationLogs.map((log) => log.logId), 0) + 1,
      level: "INFO",
      domain: resolveDomain(pathname),
      action,
      actor: "운영자",
      message: `${request.method} ${pathname}`,
      createdAt: new Date().toISOString(),
    });

    // 반환값이 없으므로 실제 도메인 핸들러가 이어서 처리한다.
    return;
  }),
];
