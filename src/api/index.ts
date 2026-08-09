import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  AppError,
} from "@/type/api";

const BASE_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_BASE_URI,
  headers: { "Content-Type": "application/json" },
};

/** 기존 공통 응답 봉투만 골라내는 가드입니다. */
const isLegacyApiSuccessEnvelope = <T>(
  responseData: ApiSuccessResponse<T>,
): responseData is { data: T; result?: "OK" } =>
  Boolean(
    responseData &&
      typeof responseData === "object" &&
      "result" in responseData &&
      responseData.result === "OK" &&
      "data" in responseData,
  );

/** 신규 DTO 응답과 기존 { result: "OK", data } 봉투 응답을 함께 해석합니다. */
export const unwrapApiData = <T>(responseData: ApiSuccessResponse<T>): T => {
  if (isLegacyApiSuccessEnvelope(responseData)) return responseData.data;

  return responseData as T;
};

/** 응답 data를 API 함수들이 바로 사용할 DTO 형태로 정규화합니다. */
const onResponseSuccess = (response: AxiosResponse): AxiosResponse => {
  response.data = unwrapApiData(response.data);

  return response;
};

/** 화면에서 그대로 노출할 수 있는 에러 객체로 정규화합니다. */
const onResponseError = (error: AxiosError<ApiErrorResponse>) => {
  const appError: AppError = {
    code: error.response?.data?.code ?? "UNKNOWN",
    fields: error.response?.data?.fields ?? {},
    message: error.response?.data?.message ?? "요청 처리에 실패했습니다.",
  };

  return Promise.reject(Object.assign(new Error(appError.message), appError));
};

/** 요청 인터셉터 */
const onRequest = (
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig => {
  // TODO: 관리자 로그인이 붙으면 여기에서 Authorization 헤더를 주입한다.
  return config;
};

export const adminAxios: AxiosInstance = axios.create(BASE_CONFIG);

adminAxios.interceptors.request.use(onRequest);
adminAxios.interceptors.response.use(onResponseSuccess, onResponseError);
