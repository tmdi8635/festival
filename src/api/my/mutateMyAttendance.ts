import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type { MyWork } from "@/type/my";
import { toTimeInput } from "@/type/event";

export interface CheckTimeRequest {
  assignmentId: number;
  /** 행사에 좌표가 없으면 보내지 않아도 된다 */
  latitude?: number;
  longitude?: number;
}

export const checkIn = async ({ assignmentId, ...body }: CheckTimeRequest) => {
  const response = await adminAxios.post<MyWork>(
    `/my/assignments/${assignmentId}/check-in`,
    body,
  );

  return response.data;
};

export const checkOut = async ({ assignmentId, ...body }: CheckTimeRequest) => {
  const response = await adminAxios.post<MyWork>(
    `/my/assignments/${assignmentId}/check-out`,
    body,
  );

  return response.data;
};

/**
 * 본인이 찍는 출퇴근.
 *
 * 한 번 찍으면 근무시간과 지급액이 곧바로 달라진다. 그래서 되돌릴 범위가
 * 포털 안에서 끝나지 않는다 — 관리자의 배치 현황 · 행사 상세 · 정산까지 같은 값을 본다.
 */
export const useMyAttendanceMutation = () => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["get-my-assignments"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["get-my-payrolls"] });
    void queryClient.invalidateQueries({ queryKey: ["get-assignment-list"] });
    void queryClient.invalidateQueries({ queryKey: ["get-event-detail"] });
    void queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
    void queryClient.invalidateQueries({ queryKey: ["get-payroll-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const checkInMutation = useMutation<MyWork, AppError, CheckTimeRequest>({
    mutationFn: checkIn,
    onSuccess: (work) => {
      /*
        기록된 시각을 토스트에 그대로 적는다.

        규칙에 따라 찍은 시각과 다르게 들어갈 수 있고, 그 사실은 모달에서 이미
        알렸지만 마지막으로 한 번 더 못 박는다. 나중에 "8시에 찍었는데 왜 8시지"를
        묻게 되는 자리라, 확인한 흔적이 본인에게도 남아야 한다.
      */
      showAppToast("success", "출근을 기록했습니다.", {
        description: `${toTimeInput(work.checkInAt)} 출근 · ${work.eventTitle}`,
      });
      invalidate();
    },
  });

  const checkOutMutation = useMutation<MyWork, AppError, CheckTimeRequest>({
    mutationFn: checkOut,
    onSuccess: (work) => {
      showAppToast("success", "퇴근을 기록했습니다.", {
        description: `${toTimeInput(work.checkOutAt)} 퇴근 · 수고하셨습니다.`,
      });
      invalidate();
    },
  });

  return { checkInMutation, checkOutMutation };
};
