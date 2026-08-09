import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAxios } from "..";
import { showAppToast } from "@/lib/toast";
import type { AppError } from "@/type/api";
import type {
  StaffDetail,
  StaffFormValues,
  StaffMemo,
  StaffStatus,
} from "@/type/staff";

export const createStaff = async (body: StaffFormValues) => {
  const response = await adminAxios.post<StaffDetail>("/admin/staff", body);

  return response.data;
};

export const updateStaff = async (staffId: number, body: StaffFormValues) => {
  const response = await adminAxios.put<StaffDetail>(
    `/admin/staff/${staffId}`,
    body,
  );

  return response.data;
};

export interface UpdateStaffStatusRequest {
  status: StaffStatus;
  /** 블랙리스트로 전환할 때만 사용합니다. 운영 기록으로 남으므로 필수입니다. */
  reason?: string;
}

export const updateStaffStatus = async (
  staffId: number,
  body: UpdateStaffStatusRequest,
) => {
  const response = await adminAxios.patch<StaffDetail>(
    `/admin/staff/${staffId}/status`,
    body,
  );

  return response.data;
};

export const updateStaffFavorite = async (
  staffId: number,
  isFavorite: boolean,
) => {
  const response = await adminAxios.patch<StaffDetail>(
    `/admin/staff/${staffId}/favorite`,
    { isFavorite },
  );

  return response.data;
};

export interface UpdateStaffDocumentRequest {
  idCardImageUrl?: string;
  bankBookImageUrl?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
}

export const updateStaffDocuments = async (
  staffId: number,
  body: UpdateStaffDocumentRequest,
) => {
  const response = await adminAxios.patch<StaffDetail>(
    `/admin/staff/${staffId}/documents`,
    body,
  );

  return response.data;
};

export const createStaffMemo = async (
  staffId: number,
  body: { content: string; isWarning: boolean },
) => {
  const response = await adminAxios.post<StaffMemo>(
    `/admin/staff/${staffId}/memos`,
    body,
  );

  return response.data;
};

export const deleteStaffMemo = async (staffId: number, memoId: number) => {
  await adminAxios.delete(`/admin/staff/${staffId}/memos/${memoId}`);
};

/**
 * 인력 삭제.
 *
 * 등록을 손으로 하는 단계라 잘못 넣은 사람을 지울 방법이 필요하다.
 * 다만 근무 이력이 있으면 서버가 막는다. 정산과 계약서가 주인을 잃기 때문이다.
 */
export const deleteStaff = async (staffId: number) => {
  await adminAxios.delete(`/admin/staff/${staffId}`);
};

/** 인력 등록 · 수정 · 상태 변경 후 목록과 상세를 함께 갱신합니다. */
export const useStaffMutation = () => {
  const queryClient = useQueryClient();

  const invalidateStaff = () => {
    queryClient.invalidateQueries({ queryKey: ["get-staff-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-staff-detail"] });
    queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const createMutation = useMutation<StaffDetail, AppError, StaffFormValues>({
    mutationFn: createStaff,
    onSuccess: () => {
      showAppToast("success", "인력을 등록했습니다.");
      invalidateStaff();
    },
  });

  const updateMutation = useMutation<
    StaffDetail,
    AppError,
    { staffId: number; body: StaffFormValues }
  >({
    mutationFn: ({ staffId, body }) => updateStaff(staffId, body),
    onSuccess: () => {
      showAppToast("success", "인력 정보를 저장했습니다.");
      invalidateStaff();
    },
  });

  const statusMutation = useMutation<
    StaffDetail,
    AppError,
    { staffId: number; body: UpdateStaffStatusRequest }
  >({
    mutationFn: ({ staffId, body }) => updateStaffStatus(staffId, body),
    onSuccess: (staff) => {
      showAppToast(
        "success",
        staff.status === "BLACKLIST"
          ? "블랙리스트로 지정했습니다."
          : "인력 상태를 변경했습니다.",
      );
      invalidateStaff();
    },
  });

  const favoriteMutation = useMutation<
    StaffDetail,
    AppError,
    { staffId: number; isFavorite: boolean }
  >({
    mutationFn: ({ staffId, isFavorite }) =>
      updateStaffFavorite(staffId, isFavorite),
    onSuccess: (staff) => {
      showAppToast(
        "success",
        staff.isFavorite
          ? "즐겨찾기에 추가했습니다."
          : "즐겨찾기에서 뺐습니다.",
      );
      invalidateStaff();
    },
  });

  const documentMutation = useMutation<
    StaffDetail,
    AppError,
    { staffId: number; body: UpdateStaffDocumentRequest }
  >({
    mutationFn: ({ staffId, body }) => updateStaffDocuments(staffId, body),
    onSuccess: () => {
      showAppToast("success", "서류 정보를 저장했습니다.");
      invalidateStaff();
    },
  });

  const memoMutation = useMutation<
    StaffMemo,
    AppError,
    { staffId: number; content: string; isWarning: boolean }
  >({
    mutationFn: ({ staffId, content, isWarning }) =>
      createStaffMemo(staffId, { content, isWarning }),
    onSuccess: () => {
      showAppToast("success", "메모를 남겼습니다.");
      invalidateStaff();
    },
  });

  const deleteMutation = useMutation<void, AppError, number>({
    mutationFn: deleteStaff,
    onSuccess: () => {
      showAppToast("success", "인력을 삭제했습니다.");
      invalidateStaff();
    },
  });

  const memoDeleteMutation = useMutation<
    void,
    AppError,
    { staffId: number; memoId: number }
  >({
    mutationFn: ({ staffId, memoId }) => deleteStaffMemo(staffId, memoId),
    onSuccess: () => {
      showAppToast("success", "메모를 삭제했습니다.");
      invalidateStaff();
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    statusMutation,
    favoriteMutation,
    documentMutation,
    memoMutation,
    memoDeleteMutation,
  };
};
