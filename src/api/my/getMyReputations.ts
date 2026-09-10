import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";
import type { MyReputationSummary } from "@/type/my";

export const getMyReputations = async () => {
  const response = await adminAxios.get<MyReputationSummary>("/my/reputations");

  return response.data;
};

/**
 * 내가 받은 평가.
 *
 * 별로예요 항목도 그대로 보여 준다. 무엇 때문에 그런 평가를 받았는지 모르면
 * 고칠 수가 없다. 다만 담당자 메모는 응답에 담기지 않는다. (`MyReputation`)
 */
export const useMyReputationQuery = () =>
  useQuery<MyReputationSummary, AppError>({
    queryKey: ["get-my-reputations"],
    queryFn: getMyReputations,
  });
