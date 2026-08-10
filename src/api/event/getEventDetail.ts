import { adminAxios } from "..";
import { usePermittedQuery } from "../usePermittedQuery";
import type { EventDetail } from "@/type/event";

export const getEventDetail = async (eventId: number) => {
  const response = await adminAxios.get<EventDetail>(
    `/admin/events/${eventId}`,
  );

  return response.data;
};

/** 캘린더 · 목록에서 행사를 눌렀을 때 여는 상세 모달에서 사용합니다. */
export const useEventDetailQuery = (eventId: number | null) => {
  return usePermittedQuery<EventDetail>("event:read", {
    queryKey: ["get-event-detail", eventId],
    queryFn: () => getEventDetail(eventId!),
    enabled: eventId !== null,
  });
};
