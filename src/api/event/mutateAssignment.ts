import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type {
  Assignment,
  AssignmentStatus,
  DayOffset,
  EventDetail,
  WageType,
} from "@/type/event";
import { toCheckDateTime } from "@/type/event";
import {
  ATTENDANCE_STATUS_LABEL,
  type AttendanceStatus,
  type JobRole,
  type ReputationVerdict,
} from "@/type/staff";

export interface CreateAssignmentRequest {
  eventId: number;
  staffIds: number[];
  /**
   * 배치할 근무일.
   *
   * 비우면 행사의 모든 근무일에 넣는다.
   * 반복 행사는 "주말 4주 중 2주만 가능"한 경우가 흔해서 날짜를 골라 보낼 수 있어야 한다.
   */
  dates?: string[];
  role: JobRole;
  status: AssignmentStatus;
}

export interface CreateAssignmentResponse {
  event: EventDetail;
  /**
   * 실제로 만들어진 배치 건수.
   *
   * 배치는 사람 × 날짜로 생기므로 고른 인원 수와 다르다.
   * ("3명을 4일에" 배치하면 12건, 그중 겹치는 날은 빠진다)
   */
  createdCount: number;
  /** 같은 날 중복이라 건너뛴 인력과 일수. 화면에서 안내해야 합니다. */
  skipped: string[];
}

export const createAssignment = async ({
  eventId,
  ...body
}: CreateAssignmentRequest) => {
  const response = await adminAxios.post<CreateAssignmentResponse>(
    `/admin/events/${eventId}/assignments`,
    body,
  );

  return response.data;
};

export type UpdateAssignmentRequest = Partial<
  Pick<
    Assignment,
    | "status"
    | "role"
    | "attendance"
    | "lateMinutes"
    | "reputationVerdict"
    | "reputationTags"
    | "reputationComment"
    | "isContractSigned"
    /*
      금액은 배치 단위로 언제든 바뀔 수 있다.
      기준 설정의 시급은 행사를 만들 때 깔리는 '기준값'일 뿐,
      실제로는 사람마다 · 날마다 다르게 주기로 하는 일이 흔하다.
    */
    | "wageType"
    | "wage"
  >
> & {
  /**
   * 출퇴근 기록은 `null`로 지울 수 있어야 한다.
   * (노쇼로 바꾸면 이미 적힌 시각을 없애야 정산에 시간이 잡히지 않는다)
   * `undefined`는 "건드리지 않음", `null`은 "지움"으로 구분한다.
   */
  checkInAt?: string | null;
  checkOutAt?: string | null;
  actualBreakMinutes?: number | null;
};

export const updateAssignment = async (
  assignmentId: number,
  body: UpdateAssignmentRequest,
) => {
  const response = await adminAxios.patch<Assignment>(
    `/admin/assignments/${assignmentId}`,
    body,
  );

  return response.data;
};

export const deleteAssignment = async (assignmentId: number) => {
  await adminAxios.delete(`/admin/assignments/${assignmentId}`);
};

/**
 * 근무 평가만 지운다. 배치는 그대로 남는다.
 *
 * 평가를 고칠 수 없게 막아 둔 대신 두는 유일한 되돌리기다.
 * 서버도 최고관리자인지 확인한다 — 화면에서만 감추면 주소를 아는 사람은 통과한다.
 */
export const deleteAssignmentReputation = async (assignmentId: number) => {
  const response = await adminAxios.delete<Assignment>(
    `/admin/assignments/${assignmentId}/reputation`,
  );

  return response.data;
};

/** 배치 추가 · 변경 · 해제 후 행사 상세와 캘린더를 함께 갱신합니다. */
export const useAssignmentMutation = () => {
  const queryClient = useQueryClient();

  const invalidateAssignment = () => {
    queryClient.invalidateQueries({ queryKey: ["get-event-detail"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["get-assignment-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-assignment-candidates"] });
    queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  /*
    평가를 남기거나 지우면 그 사람의 평판 점수가 바뀌고, 평판은 배치 후보
    추천 순서를 결정한다. 인력 목록 · 상세 · 평판 · 이력을 함께 무효화하지
    않으면 화면마다 다른 점수가 남는다.
  */
  const invalidateReputation = () => {
    invalidateAssignment();
    queryClient.invalidateQueries({ queryKey: ["get-staff-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-staff-detail"] });
    queryClient.invalidateQueries({ queryKey: ["get-staff-reputations"] });
    queryClient.invalidateQueries({ queryKey: ["get-staff-histories"] });
  };

  const createMutation = useMutation<
    CreateAssignmentResponse,
    AppError,
    CreateAssignmentRequest
  >({
    mutationFn: createAssignment,
    /*
      배치 건수는 서버가 세어서 내려 준다.
      고른 인원 수로 계산하면 여러 날 행사에서 "3명을 4일에" 넣은 결과가 3건으로 보인다.
    */
    onSuccess: ({ createdCount, skipped }) => {
      showAppToast("success", `${createdCount}건을 배치했습니다.`, {
        description:
          skipped.length > 0
            ? `중복 일정으로 제외: ${skipped.join(", ")}`
            : undefined,
      });
      invalidateAssignment();
    },
  });

  const attendanceMutation = useMutation<
    Assignment,
    AppError,
    {
      assignmentId: number;
      attendance: AttendanceStatus;
      lateMinutes?: number;
      /** 실제 출퇴근 시각. null을 보내면 기록을 지우고 예정 시간으로 되돌린다. */
      checkInAt?: string | null;
      checkOutAt?: string | null;
      actualBreakMinutes?: number | null;
    }
  >({
    mutationFn: ({ assignmentId, ...body }) =>
      updateAssignment(assignmentId, body),
    onSuccess: (assignment) => {
      showAppToast(
        "success",
        assignment.checkInAt && assignment.checkOutAt
          ? "근태와 실제 출퇴근을 기록했습니다. 정산 금액이 다시 계산됩니다."
          : "근태를 기록했습니다.",
      );
      invalidateAssignment();
      queryClient.invalidateQueries({ queryKey: ["get-staff-detail"] });
      queryClient.invalidateQueries({ queryKey: ["get-staff-histories"] });
      // 실제 근무시간이 바뀌면 지급액이 바뀐다. 정산 화면도 함께 갱신한다.
      queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-payroll-summary"] });
    },
  });

  /**
   * 일괄 근태 처리.
   *
   * 행사가 끝나면 20~30명의 근태를 한 명씩 눌러 기록해야 했다.
   * 여러 날 행사면 그 수가 날짜만큼 곱해진다. (30명 × 3일 = 90번)
   *
   * 그런데 근태 결과만 일괄로 찍을 수 있으면 반쪽이다.
   * **지급액을 정하는 것은 실제 출퇴근 시각**이라, 시각을 건별로만 넣을 수 있으면
   * 결국 90건을 하나씩 열어야 한다. 그래서 시각 · 휴게시간까지 함께 받는다.
   *
   * 출퇴근 시각은 `HH:mm`으로 받아 **각 배치의 자기 근무일에 붙인다.**
   * ISO 일시를 그대로 받으면 사흘짜리 행사의 세 건이 전부 같은 날로 기록된다.
   *
   * 건별 훅을 반복 호출하면 토스트가 인원 수만큼 뜨고 무효화도 그만큼 일어난다.
   * 여기서 한 번에 보내고, 결과도 한 번만 알린다.
   * (서버가 붙으면 mutationFn만 단일 요청으로 바꾸면 된다)
   */
  const bulkAttendanceMutation = useMutation<
    Assignment[],
    AppError,
    {
      /** 대상 배치. 근무일이 저마다 달라 시각을 붙일 때 함께 필요하다. */
      assignments: Pick<Assignment, "assignmentId" | "workDate">[];
      attendance: AttendanceStatus;
      lateMinutes?: number;
      /** `HH:mm`. 비우면 출퇴근 시각은 건드리지 않는다. */
      checkInTime?: string;
      checkOutTime?: string;
      /**
       * 퇴근이 근무일로부터 며칠 뒤인지 (0 · 1 · 2).
       * 시각만으로는 알 수 없어 사람이 고른 값을 받는다.
       */
      checkOutDayOffset?: DayOffset;
      actualBreakMinutes?: number;
      /** 켜면 기록된 출퇴근을 지우고 예정 시간 기준으로 되돌린다. */
      shouldClearCheckTime?: boolean;
    }
  >({
    mutationFn: ({
      assignments,
      attendance,
      lateMinutes,
      checkInTime,
      checkOutTime,
      checkOutDayOffset,
      actualBreakMinutes,
      shouldClearCheckTime,
    }) =>
      Promise.all(
        assignments.map(({ assignmentId, workDate }) => {
          const body: UpdateAssignmentRequest = {
            attendance,
            lateMinutes: lateMinutes ?? 0,
          };

          if (shouldClearCheckTime) {
            body.checkInAt = null;
            body.checkOutAt = null;
            body.actualBreakMinutes = null;
          } else if (checkInTime && checkOutTime) {
            body.checkInAt = toCheckDateTime(workDate, checkInTime);
            /*
              퇴근 날짜는 넘겨받은 값으로만 정한다.
              시각만 보고 추측하면 "13시 출근 → 다음 날 03시 퇴근"과
              "13시 출근 → 당일 23시 퇴근"을 구분할 수 없고,
              24시간을 넘기는 근무는 아예 표현되지 않는다.
            */
            body.checkOutAt = toCheckDateTime(
              workDate,
              checkOutTime,
              checkOutDayOffset ?? 0,
            );
            body.actualBreakMinutes = actualBreakMinutes;
          }

          return updateAssignment(assignmentId, body);
        }),
      ),
    onSuccess: (updated, { attendance, checkInTime, shouldClearCheckTime }) => {
      const hasTime = Boolean(checkInTime) && !shouldClearCheckTime;

      showAppToast(
        "success",
        `${updated.length}건을 '${ATTENDANCE_STATUS_LABEL[attendance]}'으로 기록했습니다.`,
        {
          description: hasTime
            ? "실제 출퇴근까지 함께 기록해 정산 금액이 다시 계산됩니다."
            : shouldClearCheckTime
              ? "출퇴근 기록을 지워 행사 예정 시간 기준으로 되돌렸습니다."
              : "실제 출퇴근 시각은 아직 비어 있어 정산은 예정 시간 기준입니다.",
        },
      );
      invalidateAssignment();
      queryClient.invalidateQueries({ queryKey: ["get-staff-detail"] });
      queryClient.invalidateQueries({ queryKey: ["get-staff-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-staff-histories"] });
      queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-payroll-summary"] });
    },
  });

  /**
   * 적용 금액 변경.
   *
   * 한 사람의 여러 근무일에 같은 금액을 물리는 일이 대부분이라
   * (기준을 바꾸기로 했으면 대개 그 사람의 이 행사 전체가 대상이다)
   * 배치 ID 목록을 받아 한 번에 처리하고 결과도 한 번만 알린다.
   *
   * 금액이 바뀌면 정산 금액이 곧바로 따라와야 한다.
   * 여기서 정산 쿼리를 함께 무효화하지 않으면 화면마다 다른 금액이 남는다.
   */
  const wageMutation = useMutation<
    Assignment[],
    AppError,
    { assignmentIds: number[]; wageType: WageType; wage: number }
  >({
    mutationFn: ({ assignmentIds, wageType, wage }) =>
      Promise.all(
        assignmentIds.map((assignmentId) =>
          updateAssignment(assignmentId, { wageType, wage }),
        ),
      ),
    onSuccess: (updated) => {
      showAppToast(
        "success",
        `${updated.length}건의 적용 금액을 변경했습니다.`,
        { description: "정산 금액이 함께 다시 계산됩니다." },
      );
      invalidateAssignment();
      queryClient.invalidateQueries({ queryKey: ["get-payroll-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-payroll-summary"] });
      // 계약서에 적힌 금액과 달라졌을 수 있어 계약 목록도 다시 읽는다.
      queryClient.invalidateQueries({ queryKey: ["get-contract-list"] });
    },
  });

  /**
   * 근무 평가 (좋아요 · 별로예요).
   *
   * 평가가 바뀌면 그 사람의 평판 점수가 바뀌고, 평판은 배치 후보 추천 순서를
   * 결정한다. 인력 목록 · 상세 · 후보 목록을 함께 무효화하지 않으면
   * 화면마다 다른 점수가 남는다.
   */
  const reputationMutation = useMutation<
    Assignment,
    AppError,
    {
      assignmentId: number;
      verdict: ReputationVerdict;
      tags: string[];
      comment?: string;
    }
  >({
    mutationFn: ({ assignmentId, verdict, tags, comment }) =>
      updateAssignment(assignmentId, {
        reputationVerdict: verdict,
        reputationTags: tags,
        reputationComment: comment,
      }),
    onSuccess: () => {
      showAppToast("success", "평가를 남겼습니다.", {
        description: "평판 점수와 배치 후보 추천에 반영됩니다. 평가는 고칠 수 없습니다.",
      });
      invalidateReputation();
    },
  });

  /**
   * 근무 평가 삭제. **최고관리자만 쓴다.**
   *
   * 평가는 고칠 수 없다. 고칠 수 있게 두면 나중에 이해관계가 생겼을 때
   * 지난 평가를 손보게 되고, 그 순간 쌓아 온 점수 전체가 근거를 잃는다.
   * 그래도 잘못 남긴 것을 되돌릴 길은 있어야 해서, 되돌릴 책임을 지는
   * 한 사람에게만 연다. 지운 뒤 다시 남길 수 있다.
   */
  const deleteReputationMutation = useMutation<Assignment, AppError, number>({
    mutationFn: deleteAssignmentReputation,
    onSuccess: () => {
      showAppToast("success", "평가를 지웠습니다.", {
        description: "평판 점수에서 함께 빠졌습니다. 다시 남길 수 있습니다.",
      });
      invalidateReputation();
    },
  });

  const statusMutation = useMutation<
    Assignment,
    AppError,
    { assignmentId: number; status: AssignmentStatus }
  >({
    mutationFn: ({ assignmentId, status }) =>
      updateAssignment(assignmentId, { status }),
    onSuccess: () => {
      showAppToast("success", "배치 상태를 변경했습니다.");
      invalidateAssignment();
    },
  });

  const deleteMutation = useMutation<void, AppError, number>({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      showAppToast("success", "배치를 해제했습니다.");
      invalidateAssignment();
    },
  });

  return {
    createMutation,
    attendanceMutation,
    bulkAttendanceMutation,
    wageMutation,
    reputationMutation,
    deleteReputationMutation,
    statusMutation,
    deleteMutation,
  };
};
