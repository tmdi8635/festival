import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError, PageResponse } from "@/type/api";
import type { EventStatus, EventSummary } from "@/type/event";

export interface EventListParams {
  page: number;
  size: number;
  keyword?: string;
  status?: EventStatus;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  /** 발주 인원을 아직 다 채우지 못한 행사만 봅니다. */
  onlyUnderstaffed?: boolean;
}

export const getEventList = async (params: EventListParams) => {
  const response = await adminAxios.get<PageResponse<EventSummary>>(
    "/admin/events",
    { params },
  );

  return response.data;
};

/**
 * 행사 목록 화면에서 검색 · 상태/거래처 필터 · 페이지네이션과 함께 사용합니다.
 *
 * 행사 선택 모달처럼 닫혀 있는 동안에는 부를 이유가 없는 곳이 있어
 * `enabled`로 조회 시점을 늦출 수 있게 열어 둡니다.
 */
export const useEventListQuery = (
  params: EventListParams,
  enabled = true,
) => {
  return useQuery<PageResponse<EventSummary>, AppError>({
    queryKey: ["get-event-list", params],
    queryFn: () => getEventList(params),
    enabled,
  });
};
