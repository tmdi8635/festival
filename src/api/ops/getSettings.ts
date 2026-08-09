import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import { hydrateOrgSettings } from "@/store/useOrgStore";
import type { AppError } from "@/type/api";
import type { OperationSettings } from "@/type/ops";

export const getSettings = async () => {
  const response = await adminAxios.get<OperationSettings>("/admin/settings");

  /*
    직무 이름 · 등급제 사용 여부는 표의 셀 하나를 그릴 때마다 필요하다.
    그때마다 쿼리 훅을 부르면 모든 컴포넌트가 훅에 묶이므로,
    응답을 받는 즉시(렌더링 밖에서) 전역 스토어에 넣어 두고 화면은 거기서 꺼내 쓴다.
  */
  hydrateOrgSettings(response.data);

  return response.data;
};

/** 기준 설정 화면과 정산 계산에서 함께 사용합니다. */
export const useSettingsQuery = () => {
  return useQuery<OperationSettings, AppError>({
    queryKey: ["get-settings"],
    queryFn: getSettings,
  });
};
