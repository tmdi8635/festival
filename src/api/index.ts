import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { useAdminStore } from "@/store/useAdminStore";
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  AppError,
} from "@/type/api";

/**
 * 목업이 켜져 있으면 요청을 **같은 출처**로 보낸다.
 *
 * 어차피 MSW가 가로채므로 주소가 어디를 가리키는지는 뜻이 없는데,
 * `http://localhost:8080`으로 두면 폰·터널에서 열었을 때 요청이 아예 나가지 못한다.
 * (자세한 이유는 `mocks/utils.ts`의 `BASE_URI` 주석)
 */
const isMockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

const BASE_CONFIG = {
  baseURL: isMockingEnabled ? "" : process.env.NEXT_PUBLIC_BASE_URI,
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
  /*
    누가 보낸 요청인지 싣는다.

    권한 판정은 **화면이 아니라 서버가** 해야 한다. 화면에서 버튼을 감추는 것은
    실수를 줄이는 장치일 뿐이고, 주소창에 직접 치거나 화면이 오래 열려 있는 사이
    권한이 바뀌면 그대로 통과한다.

    로그인이 붙으면 이 줄이 Authorization 헤더로 바뀌고, 서버가 토큰에서
    담당자를 꺼낸다. 판정 로직은 그대로 산다.
  */
  const { admin } = useAdminStore.getState();

  if (admin) config.headers.set("X-Admin-Id", String(admin.managerId));

  return config;
};

export const adminAxios: AxiosInstance = axios.create(BASE_CONFIG);

adminAxios.interceptors.request.use(onRequest);
adminAxios.interceptors.response.use(onResponseSuccess, onResponseError);
