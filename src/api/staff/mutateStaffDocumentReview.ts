import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type {
  DocumentLane,
  DocumentReviewState,
  StaffDetail,
} from "@/type/staff";

export interface ReviewStaffDocumentRequest {
  staffId: number;
  lane: DocumentLane;
  state: Extract<DocumentReviewState, "APPROVED" | "REJECTED">;
  /** 반려할 때만. 5자 미만이면 서버가 거절한다 */
  rejectReason?: string;
}

export const reviewStaffDocument = async ({
  staffId,
  ...body
}: ReviewStaffDocumentRequest) => {
  const response = await adminAxios.patch<StaffDetail>(
    `/admin/staff/${staffId}/documents/review`,
    body,
  );

  return response.data;
};

/**
 * 서류 승인 · 반려.
 *
 * 이 한 번으로 인력 상태(대기중 ↔ 활동중)와 확정 배치 가능 여부가 함께 움직인다.
 * 그래서 되돌릴 범위가 인력 목록 하나로 끝나지 않는다 — 배치 후보와 대시보드의
 * 할 일까지 같은 값을 보고 있다.
 */
export const useStaffDocumentReviewMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<StaffDetail, AppError, ReviewStaffDocumentRequest>({
    mutationFn: reviewStaffDocument,
    onSuccess: (staff, variables) => {
      showAppToast(
        "success",
        variables.state === "APPROVED"
          ? `${staff.name}님의 서류를 승인했습니다.`
          : `${staff.name}님의 서류를 반려했습니다.`,
      );

      void queryClient.invalidateQueries({ queryKey: ["get-staff-list"] });
      void queryClient.invalidateQueries({ queryKey: ["get-staff-detail"] });
      void queryClient.invalidateQueries({
        queryKey: ["get-assignment-candidates"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["get-dashboard-summary"],
      });
    },
  });
};
