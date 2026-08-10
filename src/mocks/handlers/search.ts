import { HttpResponse, delay, http } from "msw";
import type { GlobalSearchItem } from "@/api/search/getGlobalSearch";
import { formatDate } from "@/lib/dayjs";
import { clients } from "../db/client";
import { events } from "../db/event";
import { staffList } from "../db/staff";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  matchesKeyword,
  requesterCan,
} from "../utils";

/** 종류별 최대 노출 수. 한 종류가 결과를 독점하지 않게 한다. */
const LIMIT_PER_TYPE = 5;

export const searchHandlers = [
  http.get(`${BASE_URI}/admin/search`, async ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";

    if (keyword.trim().length < 2) {
      return HttpResponse.json({ items: [] });
    }

    /*
      통합검색은 권한을 우회하는 지름길이 되기 쉽다.

      거래처 메뉴가 감춰져 있어도 검색창에 두 글자만 치면 거래처 이름과
      담당자가 그대로 나온다. 화면을 막아 놓고 검색을 열어 두면
      막은 쪽이 뜻을 잃는다.

      결과를 통째로 막지 않고 **볼 수 있는 종류만** 남긴다.
      검색은 여러 자료를 한 번에 훑는 자리라, 하나가 막혔다고
      나머지까지 못 찾게 할 이유가 없다.
    */
    const canSeeStaff = requesterCan(request, "staff:read");
    const canSeeEvent = requesterCan(request, "event:read");
    const canSeeClient = requesterCan(request, "client:read");

    const staffItems: GlobalSearchItem[] = (canSeeStaff ? staffList : [])
      .filter((staff) =>
        matchesKeyword(
          keyword,
          staff.name,
          staff.phoneNumber,
          String(staff.staffId),
        ),
      )
      .slice(0, LIMIT_PER_TYPE)
      .map((staff) => ({
        type: "STAFF",
        id: staff.staffId,
        title: staff.name,
        description: `${staff.region} · 누적 ${staff.workCount}회`,
        href: `/staff?keyword=${encodeURIComponent(staff.name)}`,
      }));

    const eventItems: GlobalSearchItem[] = (canSeeEvent ? events : [])
      .filter((event) =>
        matchesKeyword(keyword, event.title, event.venue, event.clientName),
      )
      .slice(0, LIMIT_PER_TYPE)
      .map((event) => ({
        type: "EVENT",
        id: event.eventId,
        title: event.title,
        description: `${formatDate(event.startDate)} · ${event.venue}`,
        href: `/schedule/events?keyword=${encodeURIComponent(event.title)}`,
      }));

    const clientItems: GlobalSearchItem[] = (canSeeClient ? clients : [])
      .filter((client) =>
        matchesKeyword(keyword, client.name, client.managerName),
      )
      .slice(0, LIMIT_PER_TYPE)
      .map((client) => ({
        type: "CLIENT",
        id: client.clientId,
        title: client.name,
        description: `담당 ${client.managerName} · 행사 ${client.eventCount}건`,
        href: `/clients?keyword=${encodeURIComponent(client.name)}`,
      }));

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({
      items: [...staffItems, ...eventItems, ...clientItems],
    });
  }),
];
