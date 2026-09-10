import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { MyProfile } from "@/type/my";
import type { DocumentReviewState, StaffStatus } from "@/type/staff";

/**
 * 포털 조회는 `usePermittedQuery`를 쓰지 않는다.
 *
 * 그 훅은 **관리자 권한 키**로 요청을 켜고 끈다. 포털에서 쓰면 서류 권한이 없는
 * 직책으로 보고 있을 때 본인 자료 조회까지 꺼진다. 여기서 가리는 기준은
 * 권한이 아니라 "내 것인가"이고, 그 판단은 서버가 한다. (`requireStaff`)
 */
export const getMyProfile = async () => {
  const response = await adminAxios.get<MyProfile>("/my/profile");

  return response.data;
};

export const useMyProfileQuery = () =>
  useQuery<MyProfile, AppError>({
    queryKey: ["get-my-profile"],
    queryFn: getMyProfile,
  });

/** 전환기가 쓰는 계정 한 줄 — 테스트용 */
export interface MyAccount {
  staffId: number;
  name: string;
  profileImageUrl: string;
  status: StaffStatus;
  documentReviewState: DocumentReviewState;
  workCount: number;
}

export const getMyAccounts = async () => {
  const response = await adminAxios.get<{ items: MyAccount[] }>("/my/accounts");

  return response.data;
};

/** 로그인이 붙으면 이 훅과 전환기 컴포넌트를 함께 지운다. */
export const useMyAccountListQuery = () =>
  useQuery<{ items: MyAccount[] }, AppError>({
    queryKey: ["get-my-accounts"],
    queryFn: getMyAccounts,
  });
