import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { CalendarEvent, EventStatus } from "@/type/event";

export interface EventCalendarParams {
  /** 조회 시작일 (YYYY-MM-DD) */
  from: string;
  /** 조회 종료일 (YYYY-MM-DD) */
  to: string;
  clientId?: string;
  status?: EventStatus;
}

export interface EventCalendarResponse {
  items: CalendarEvent[];
}

export const getEventCalendar = async (params: EventCalendarParams) => {
  const response = await adminAxios.get<EventCalendarResponse>(
    "/admin/events/calendar",
    { params },
  );

  return response.data;
};

/**
 * 캘린더 화면 전용 조회입니다.
 * 다일 행사는 서버가 날짜별로 펴서 내려주므로 화면은 날짜로 묶기만 하면 됩니다.
 */
export const useEventCalendarQuery = (params: EventCalendarParams) => {
  return usePermittedQuery<EventCalendarResponse>("event:read", {
    queryKey: ["get-event-calendar", params],
    queryFn: () => getEventCalendar(params),
  });
};
