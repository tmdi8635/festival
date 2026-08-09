/** 화면에서 그대로 노출할 수 있도록 정규화된 에러 객체 */
export interface AppError {
  code: string;
  fields: Record<string, string>;
  message: string;
}

/** 서버 공통 성공 응답 봉투 */
export type ApiSuccessResponse<T> = T | { data: T; result?: "OK" };

/** 서버 공통 에러 응답 */
export interface ApiErrorResponse {
  code?: string;
  message?: string;
  fields?: Record<string, string>;
}

/** 목록 API 공통 요청 파라미터 */
export interface PageParams {
  /** 1부터 시작한다. */
  page: number;
  size: number;
  keyword?: string;
}

/** 목록 API 공통 응답 */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
}

/** 목록 화면 기본 페이지 크기 */
export const DEFAULT_PAGE_SIZE = 20;
