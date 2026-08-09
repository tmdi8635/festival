import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { AdminProfile } from "@/store/useAdminStore";

export const getCurrentAdmin = async () => {
  const response = await adminAxios.get<AdminProfile>("/admin/me");

  return response.data;
};

/**
 * 지금 로그인한 담당자와 권한.
 *
 * 권한 목록을 화면이 들고 있으면 직책을 바꿔도 그 사람 화면은 그대로다.
 * 서버에서 받아 스토어로 흘려 넣어야 "권한을 뺐는데 아직 버튼이 보인다"가 없어진다.
 */
export const useCurrentAdminQuery = () => {
  return useQuery<AdminProfile, AppError>({
    queryKey: ["get-current-admin"],
    queryFn: getCurrentAdmin,
  });
};
