import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type {
  EventDetail,
  EventFormValues,
  EventPosition,
  EventRoleSlot,
  EventStatus,
} from "@/type/event";

/** 근무일 하나의 발주 한 줄. 포지션을 가리키고, 그날의 인원 · 금액을 갖는다. */
export type DayRoleInput = Pick<
  EventRoleSlot,
  "positionId" | "requiredCount" | "wageType" | "wage"
>;

/** 포지션을 만들거나 고칠 때 보내는 값. 번호는 서버가 붙인다. */
export type PositionInput = Omit<EventPosition, "positionId"> & {
  /** 추가할 때만. 모든 근무일에 이 인원으로 발주를 깐다. 0이면 깔지 않는다. */
  requiredCount?: number;
};

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
  roles: DayRoleInput[],
) => {
  const response = await adminAxios.put<EventDetail>(
    `/admin/events/${eventId}/days/${date}/roles`,
    { roles },
  );

  return response.data;
};

export const deleteEvent = async (eventId: number) => {
  await adminAxios.delete(`/admin/events/${eventId}`);
};

export const createEventPosition = async (
  eventId: number,
  body: PositionInput,
) => {
  const response = await adminAxios.post<EventDetail>(
    `/admin/events/${eventId}/positions`,
    body,
  );

  return response.data;
};

export const updateEventPosition = async (
  eventId: number,
  positionId: number,
  body: PositionInput,
) => {
  const response = await adminAxios.put<EventDetail>(
    `/admin/events/${eventId}/positions/${positionId}`,
    body,
  );

  return response.data;
};

export const deleteEventPosition = async (
  eventId: number,
  positionId: number,
) => {
  const response = await adminAxios.delete<EventDetail>(
    `/admin/events/${eventId}/positions/${positionId}`,
  );

  return response.data;
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

  /*
    포지션은 공고가 그대로 가리킨다. 이름 · 시각 · 금액을 고치면 관리자 공고 목록과
    포털 공고가 함께 바뀌어야, 지원자가 본 금액과 계약서의 금액이 갈리지 않는다.
  */
  const invalidatePosition = () => {
    invalidateEvent();
    queryClient.invalidateQueries({ queryKey: ["get-assignment-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-posting-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-my-postings"] });
    queryClient.invalidateQueries({ queryKey: ["get-my-posting"] });
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
    { eventId: number; date: string; roles: DayRoleInput[] }
  >({
    mutationFn: ({ eventId, date, roles }) =>
      updateEventDayRoles(eventId, date, roles),
    onSuccess: () => {
      showAppToast("success", "이 날의 발주 인원을 저장했습니다.");
      invalidatePosition();
    },
  });

  const deleteMutation = useMutation<void, AppError, number>({
    mutationFn: deleteEvent,
    onSuccess: () => {
      showAppToast("success", "행사를 삭제했습니다.");
      invalidateEvent();
    },
  });

  const createPositionMutation = useMutation<
    EventDetail,
    AppError,
    { eventId: number; body: PositionInput }
  >({
    mutationFn: ({ eventId, body }) => createEventPosition(eventId, body),
    onSuccess: (_, { body }) => {
      showAppToast("success", `'${body.name}' 포지션을 추가했습니다.`, {
        description:
          (body.requiredCount ?? 0) > 0
            ? `모든 근무일에 ${body.requiredCount}명씩 발주를 깔았습니다.`
            : "발주 인원은 일별 근무자 탭에서 날짜마다 잡아 주세요.",
      });
      invalidatePosition();
    },
  });

  const updatePositionMutation = useMutation<
    EventDetail,
    AppError,
    { eventId: number; positionId: number; body: PositionInput }
  >({
    mutationFn: ({ eventId, positionId, body }) =>
      updateEventPosition(eventId, positionId, body),
    onSuccess: () => {
      showAppToast("success", "포지션을 저장했습니다.", {
        description: "이미 배치된 사람의 금액은 그대로입니다. 필요하면 적용 금액을 따로 고쳐 주세요.",
      });
      invalidatePosition();
    },
  });

  const deletePositionMutation = useMutation<
    EventDetail,
    AppError,
    { eventId: number; positionId: number }
  >({
    mutationFn: ({ eventId, positionId }) =>
      deleteEventPosition(eventId, positionId),
    onSuccess: () => {
      showAppToast("success", "포지션을 삭제했습니다.");
      invalidatePosition();
    },
  });

  return {
    createMutation,
    updateMutation,
    statusMutation,
    deleteMutation,
    dayRolesMutation,
    createPositionMutation,
    updatePositionMutation,
    deletePositionMutation,
  };
};
