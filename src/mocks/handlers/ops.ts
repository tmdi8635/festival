import { HttpResponse, delay, http } from "msw";
import type {
  LogDomain,
  LogLevel,
  Manager,
  ManagerFormValues,
  OperationSettings,
} from "@/type/ops";
import { managers, operationLogs, operationSettings } from "../db/ops";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  matchesKeyword,
  nextId,
  notFound,
  paginate,
} from "../utils";

export const opsHandlers = [
  http.get(`${BASE_URI}/admin/managers`, async ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";

    const filtered = managers.filter((manager) =>
      matchesKeyword(keyword, manager.name, manager.email, manager.phoneNumber),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items: filtered });
  }),

  http.post(`${BASE_URI}/admin/managers`, async ({ request }) => {
    const body = (await request.json()) as ManagerFormValues;

    const isDuplicated = managers.some(
      (manager) => manager.email === body.email,
    );

    if (isDuplicated) {
      return HttpResponse.json(
        { code: "DUPLICATED_EMAIL", message: "이미 등록된 이메일입니다." },
        { status: 409 },
      );
    }

    const created: Manager = {
      ...body,
      managerId: nextId(managers, "managerId"),
      eventCount: 0,
      createdAt: new Date().toISOString(),
    };

    managers.push(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(
    `${BASE_URI}/admin/managers/:managerId`,
    async ({ params, request }) => {
      const manager = managers.find(
        (item) => item.managerId === Number(params.managerId),
      );
      const body = (await request.json()) as ManagerFormValues;

      if (!manager) return notFound("존재하지 않는 담당자입니다.");

      Object.assign(manager, body);
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(manager);
    },
  ),

  http.delete(`${BASE_URI}/admin/managers/:managerId`, async ({ params }) => {
    const managerId = Number(params.managerId);
    const manager = managers.find((item) => item.managerId === managerId);

    if (!manager) return notFound("존재하지 않는 담당자입니다.");

    if (manager.role === "OWNER") {
      return HttpResponse.json(
        {
          code: "OWNER_CANNOT_BE_DELETED",
          message: "대표 계정은 삭제할 수 없습니다.",
        },
        { status: 400 },
      );
    }

    managers.splice(
      managers.findIndex((item) => item.managerId === managerId),
      1,
    );

    await delay(MOCK_DELAY_MS);

    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE_URI}/admin/logs`, async ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const level = url.searchParams.get("level") as LogLevel | null;
    const domain = url.searchParams.get("domain") as LogDomain | null;

    const filtered = operationLogs.filter((log) => {
      if (level && log.level !== level) return false;
      if (domain && log.domain !== domain) return false;

      return matchesKeyword(keyword, log.message, log.actor, log.action);
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(filtered, url));
  }),

  http.get(`${BASE_URI}/admin/settings`, async () => {
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(operationSettings);
  }),

  http.put(`${BASE_URI}/admin/settings`, async ({ request }) => {
    const body = (await request.json()) as OperationSettings;

    Object.assign(operationSettings, body, {
      updatedAt: new Date().toISOString(),
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(operationSettings);
  }),
];
