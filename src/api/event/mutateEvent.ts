import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type {
  EventDetail,
  EventFormValues,
  EventRoleSlot,
  EventStatus,
} from "@/type/event";

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

/** 근무일 하나의 발주 인원만 바꾼다. 행사 전체 발주는 건드리지 않는다. */
export const updateEventDayRoles = async (
  eventId: number,
  date: string,
  roles: Omit<EventRoleSlot, "assignedCount">[],
) => {
  const response = await adminAxios.put<EventDetail>(
    `/admin/events/${eventId}/days/${date}/roles`,
    { roles },
  );

  return response.data;
};

/**
 * 메인팀장을 지정한다. 해제할 때는 `null`을 보낸다.
 *
 * 배치와 직무는 그대로 두고 **누가 이 행사를 끌고 가는지만** 정한다.
 * 직무로 만들면 팀장 세 명 중 누가 메인인지를 표현할 수 없다.
 */
export const updateEventMainSupervisor = async (
  eventId: number,
  staffId: number | null,
) => {
  const response = await adminAxios.patch<EventDetail>(
    `/admin/events/${eventId}/main-supervisor`,
    { staffId },
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
    /*
      정산 건은 **행사 상태가 넘어가는 순간** 배치에서 만들어진다.
      (`ensurePayrollForEvent`) 여기서 함께 무효화하지 않으면 담당자가
      '정산대기로 넘기기'를 눌러도 정산 탭이 계속 비어 있고, 새로고침을
      해야 나타난다. 그 사이에 "정산이 왜 안 나오냐"가 된다.
    */
    queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-payroll-summary"] });
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

  const dayRolesMutation = useMutation<
    EventDetail,
    AppError,
    { eventId: number; date: string; roles: Omit<EventRoleSlot, "assignedCount">[] }
  >({
    mutationFn: ({ eventId, date, roles }) =>
      updateEventDayRoles(eventId, date, roles),
    onSuccess: () => {
      showAppToast("success", "이 날의 발주 인원을 저장했습니다.");
      invalidateEvent();
      // 배치 현황은 발주 대비 충원을 보여 주므로 함께 갱신한다.
      queryClient.invalidateQueries({ queryKey: ["get-assignment-list"] });
    },
  });

  /**
   * 메인팀장 지정.
   *
   * 직무를 바꾸는 것이 아니라 **자리를 정하는 것**이라 배치는 건드리지 않는다.
   * 캘린더가 이 이름을 접힌 상태에서도 보여 주므로 캘린더도 함께 갱신한다.
   */
  const mainSupervisorMutation = useMutation<
    EventDetail,
    AppError,
    { eventId: number; staffId: number | null }
  >({
    mutationFn: ({ eventId, staffId }) =>
      updateEventMainSupervisor(eventId, staffId),
    onSuccess: (event) => {
      showAppToast(
        "success",
        event.mainSupervisorName
          ? `${event.mainSupervisorName}님을 메인팀장으로 지정했습니다.`
          : "메인팀장 지정을 해제했습니다.",
      );
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

  return {
    createMutation,
    updateMutation,
    statusMutation,
    mainSupervisorMutation,
    deleteMutation,
    dayRolesMutation,
  };
};
