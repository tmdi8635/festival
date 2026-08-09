import { HttpResponse, delay, http } from "msw";
import type { Client, ClientFormValues } from "@/type/client";
import { clients } from "../db/client";
import { events } from "../db/event";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  matchesKeyword,
  nextId,
  notFound,
  paginate,
} from "../utils";

export const clientHandlers = [
  http.get(`${BASE_URI}/admin/clients`, async ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const isActive = url.searchParams.get("isActive") ?? "";

    const filtered = clients.filter((client) => {
      if (isActive && String(client.isActive) !== isActive) return false;

      return matchesKeyword(
        keyword,
        client.name,
        client.managerName,
        client.businessNumber,
      );
    });

    const sorted = [...filtered].sort((a, b) => b.eventCount - a.eventCount);

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(sorted, url));
  }),

  http.get(`${BASE_URI}/admin/clients/:clientId`, async ({ params }) => {
    const clientId = Number(params.clientId);
    const client = clients.find((item) => item.clientId === clientId);

    if (!client) return notFound("존재하지 않는 거래처입니다.");

    // 거래처 상세에서는 최근 행사도 함께 본다.
    const recentEvents = events
      .filter((event) => event.clientId === clientId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .slice(0, 10)
      .map(({ assignments, ...summary }) => {
        void assignments;

        return summary;
      });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ ...client, recentEvents });
  }),

  http.post(`${BASE_URI}/admin/clients`, async ({ request }) => {
    const body = (await request.json()) as ClientFormValues;

    const created: Client = {
      ...body,
      clientId: nextId(clients, "clientId"),
      eventCount: 0,
      totalRevenue: 0,
      totalLaborCost: 0,
      createdAt: new Date().toISOString(),
    };

    clients.push(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(`${BASE_URI}/admin/clients/:clientId`, async ({ params, request }) => {
    const client = clients.find(
      (item) => item.clientId === Number(params.clientId),
    );
    const body = (await request.json()) as ClientFormValues;

    if (!client) return notFound("존재하지 않는 거래처입니다.");

    Object.assign(client, body);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(client);
  }),
];
