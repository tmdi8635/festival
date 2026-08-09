import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";

export type GlobalSearchType = "STAFF" | "EVENT" | "CLIENT";

export interface GlobalSearchItem {
  type: GlobalSearchType;
  id: number;
  /** 대표 이름 */
  title: string;
  /** 보조 설명 (활동 지역, 행사 날짜 등) */
  description: string;
  /** 선택 시 이동할 경로 */
  href: string;
}

export interface GlobalSearchResponse {
  items: GlobalSearchItem[];
}

export const getGlobalSearch = async (keyword: string) => {
  const response = await adminAxios.get<GlobalSearchResponse>("/admin/search", {
    params: { keyword },
  });

  return response.data;
};

/**
 * 전역 검색(⌘K)에서 사용하는 통합 조회입니다.
 * 인력 · 행사 · 거래처를 한 번에 찾습니다.
 */
export const useGlobalSearchQuery = (keyword: string) => {
  const trimmed = keyword.trim();

  return useQuery<GlobalSearchResponse, AppError>({
    queryKey: ["get-global-search", trimmed],
    queryFn: () => getGlobalSearch(trimmed),
    // 두 글자 미만은 결과가 너무 많아 의미가 없다.
    enabled: trimmed.length >= 2,
    staleTime: 1000 * 30,
  });
};
