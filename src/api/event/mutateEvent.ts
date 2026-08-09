import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { EventDetail, EventFormValues, EventStatus } from "@/type/event";

export const createEvent = async (body: EventFormValues) => {
  const response = await adminAxios.post<EventDetail>("/admin/events", body);

  return response.data;
};

export const updateEvent = async (eventId: number, body: EventFormValues) => {
  const response = await adminAxios.put<EventDetail>(
    `/admin/events/${eventId}`,
    body,
  );

  return response.data;
};

export const updateEventStatus = async (eventId: number, status: EventStatus) => {
  const response = await adminAxios.patch<EventDetail>(
    `/admin/events/${eventId}/status`,
    { status },
  );

  return response.data;
};

export const deleteEvent = async (eventId: number) => {
  await adminAxios.delete(`/admin/events/${eventId}`);
};

/** 행사 생성 · 수정 · 상태 변경 후 캘린더와 목록을 함께 갱신합니다. */
export const useEventMutation = () => {
  const queryClient = useQueryClient();

  const invalidateEvent = () => {
    queryClient.invalidateQueries({ queryKey: ["get-event-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-detail"] });
    queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const createMutation = useMutation<EventDetail, AppError, EventFormValues>({
    mutationFn: createEvent,
    onSuccess: () => {
      showAppToast("success", "행사를 등록했습니다.");
      invalidateEvent();
    },
  });

  const updateMutation = useMutation<
    EventDetail,
    AppError,
    { eventId: number; body: EventFormValues }
  >({
    mutationFn: ({ eventId, body }) => updateEvent(eventId, body),
    onSuccess: () => {
      showAppToast("success", "행사 정보를 저장했습니다.");
      invalidateEvent();
    },
  });

  const statusMutation = useMutation<
    EventDetail,
    AppError,
    { eventId: number; status: EventStatus }
  >({
    mutationFn: ({ eventId, status }) => updateEventStatus(eventId, status),
    onSuccess: () => {
      showAppToast("success", "행사 상태를 변경했습니다.");
      invalidateEvent();
    },
  });

  const deleteMutation = useMutation<void, AppError, number>({
    mutationFn: deleteEvent,
    onSuccess: () => {
      showAppToast("success", "행사를 삭제했습니다.");
      invalidateEvent();
    },
  });

  return { createMutation, updateMutation, statusMutation, deleteMutation };
};
