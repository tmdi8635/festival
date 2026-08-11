import { HttpResponse } from "msw";
import { BASE_PATH } from "@/lib/basePath";
import {
  hasPermission,
  permissionLabel,
  type PermissionKey,
} from "@/type/permission";
import { adminRoles, employees } from "./db/ops";
import { DEFAULT_PAGE_SIZE, PageResponse } from "@/type/api";

/**
 * 목업 핸들러가 가로챌 주소. 모든 핸들러가 같은 값을 쓴다.
 *
 * 목업이 켜져 있을 때는 **빈 문자열**, 즉 지금 열려 있는 페이지와 같은 출처다.
 * `http://localhost:8080`을 그대로 두면 내 컴퓨터에서만 맞고,
 * 폰이나 터널로 열었을 때 두 가지 이유로 데이터가 통째로 비어 버린다.
 *
 * 1. 폰에서 `localhost`는 **그 폰 자신**이다. 8080에는 아무것도 없다.
 * 2. HTTPS로 열린 페이지에서 평문 HTTP를 부르면 브라우저가 혼합 콘텐츠로 막는다.
 *    이건 서비스 워커보다 앞단이라 MSW가 가로챌 기회조차 없다.
 *
 * 실제 서버에 붙일 때는 목업을 끄고(`NEXT_PUBLIC_API_MOCKING`),
 * 그때 `NEXT_PUBLIC_BASE_URI`가 쓰인다. (`api/index.ts`)
 *
 * 깃허브 페이지처럼 하위 경로에 올라가면 접두사가 붙는다.
 * 보내는 쪽(`api/index.ts`)과 **같은 값**이어야 핸들러가 주소를 알아본다.
 */
export const BASE_URI = BASE_PATH;

/** 대상이 없을 때 돌려주는 공통 응답 */
export const notFound = (message: string) =>
  HttpResponse.json({ code: "NOT_FOUND", message }, { status: 404 });

/** 요청 값이 잘못됐을 때 돌려주는 공통 응답 */
export const badRequest = (message: string, code = "BAD_REQUEST") =>
  HttpResponse.json({ code, message }, { status: 400 });

/** 목업 응답 지연 시간 (로딩 상태를 눈으로 확인하기 위한 값) */
export const MOCK_DELAY_MS = 250;

/** 배열을 목록 API 응답 형태로 감싼다. */
export const paginate = <T>(
  items: T[],
  url: URL,
): PageResponse<T> => {
  const page = Number(url.searchParams.get("page") ?? 1);
  const size = Number(url.searchParams.get("size") ?? DEFAULT_PAGE_SIZE);
  const start = (page - 1) * size;

  return {
    content: items.slice(start, start + size),
    page,
    size,
    totalCount: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
  };
};

/** 검색어가 대상 필드 중 하나라도 포함되는지 확인한다. */
export const matchesKeyword = (keyword: string, ...fields: string[]) => {
  if (!keyword) return true;

  const lowered = keyword.toLowerCase();

  return fields.some((field) => field?.toLowerCase().includes(lowered));
};

/** 목업 데이터의 다음 ID를 만든다. */
export const nextId = <T>(items: T[], key: keyof T): number =>
  items.reduce((max, item) => Math.max(max, Number(item[key]) || 0), 0) + 1;

/** 시드 데이터용 상대 일시 문자열 */
export const daysAgo = (days: number, hour = 12): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);

  return date.toISOString();
};

/**
 * 오늘 기준 상대 날짜를 `YYYY-MM-DD`로 만든다.
 *
 * 행사 일정은 항상 "오늘" 주변에 있어야 캘린더가 비어 보이지 않는다.
 * 고정 날짜를 박으면 시간이 지날수록 목업이 과거로 밀리므로 상대 날짜만 쓴다.
 */
export const dateFromToday = (offsetDays: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/** `YYYY-MM-DD` + `HH:mm`을 ISO 일시로 합친다. */
export const toIsoDateTime = (date: string, time: string): string =>
  new Date(`${date}T${time}:00`).toISOString();

/** 시드 데이터용 의사 난수. 실행마다 값이 바뀌지 않도록 seed 기반으로 만든다. */
export const pseudoRandom = (seed: number): number => {
  const value = Math.sin(seed) * 10_000;

  return value - Math.floor(value);
};

/** seed 기반 정수 난수 */
export const randomInt = (seed: number, min: number, max: number): number =>
  min + Math.floor(pseudoRandom(seed) * (max - min + 1));

/** seed 기반 배열 요소 선택 */
export const pickOne = <T>(seed: number, items: readonly T[]): T =>
  items[randomInt(seed, 0, items.length - 1)];

/* ------------------------------------------------------------------ */
/* 권한                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 요청을 보낸 직원을 찾는다. 퇴사자는 없는 사람으로 본다.
 *
 * 서버 인증이 붙기 전까지는 헤더에 실린 직원 ID를 그대로 믿는다.
 * 붙는 날 이 함수 하나만 토큰 해석으로 바꾸면 된다.
 */
export const findRequester = (request: Request) => {
  const employeeId = Number(request.headers.get("X-Admin-Id"));
  const employee = employees.find((item) => item.employeeId === employeeId);

  return employee?.isActive ? employee : undefined;
};

/**
 * 이 요청을 보낸 직원이 권한을 갖고 있는지 본다.
 *
 * **막는 책임은 서버에 있다.** 화면에서 버튼을 감추는 것은 실수를 줄이는 장치일 뿐,
 * 주소를 직접 치거나 화면이 오래 열려 있는 사이 권한이 바뀌면 그대로 통과한다.
 *
 * 거부할 때는 **무슨 권한이 필요한지**를 함께 돌려준다.
 * "권한이 없습니다"만 보여 주면 직원은 무엇을 요청해야 하는지 모르고,
 * 결국 최고관리자에게 "그냥 다 열어 달라"고 말하게 된다.
 */
export const requirePermission = (
  request: Request,
  required: PermissionKey,
): Response | null => {
  const employee = findRequester(request);

  if (!employee) {
    return HttpResponse.json(
      { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const role = adminRoles.find((item) => item.roleId === employee.roleId);

  if (hasPermission(role?.permissions, required, role?.isSuperAdmin)) {
    return null;
  }

  return HttpResponse.json(
    {
      code: "FORBIDDEN",
      message: `이 작업에는 '${permissionLabel(required)}' 권한이 필요합니다. 현재 직책은 '${employee.roleName}'입니다.`,
      fields: { requiredPermission: required, roleName: employee.roleName },
    },
    { status: 403 },
  );
};

/**
 * 최고관리자인지 확인하고, 아니면 거부한다.
 *
 * **권한 키로 표현할 수 없는 일에만** 쓴다. 지금은 근무 평가 삭제 하나다.
 * 평가는 한 번 남기면 고칠 수 없어야 공정한데, 잘못 남긴 것을 되돌릴 길은
 * 있어야 한다. 그 길을 `staff:write` 같은 일상 권한에 붙이면 결국 아무나
 * 지우게 되므로, 되돌릴 책임을 지는 한 사람에게만 연다.
 */
export const requireSuperAdmin = (request: Request): Response | null => {
  const employee = findRequester(request);

  if (!employee) {
    return HttpResponse.json(
      { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const role = adminRoles.find((item) => item.roleId === employee.roleId);

  if (role?.isSuperAdmin) return null;

  return HttpResponse.json(
    {
      code: "FORBIDDEN",
      message: `이 작업은 최고관리자만 할 수 있습니다. 현재 직책은 '${employee.roleName}'입니다.`,
      fields: { roleName: employee.roleName },
    },
    { status: 403 },
  );
};

/**
 * 권한을 갖고 있는지 **묻기만** 한다. 거부하지 않는다.
 *
 * `requirePermission`은 "이 요청을 통째로 막을까"를 정하는 자리에 쓰고,
 * 이쪽은 **응답에서 일부를 덜어 낼 때** 쓴다.
 *
 * 한 화면이 여러 자료를 섞어 보여 주는 곳이 있다. 통합검색은 인력 · 행사 · 거래처를
 * 한 번에 훑고, 대시보드는 미지급 금액과 매출 추이까지 함께 내려준다.
 * 이런 응답을 통째로 막으면 화면이 열리지 않고, 그대로 내려주면
 * 거래처를 볼 수 없는 직책이 검색창에서 거래처 이름을 읽게 된다.
 * 그래서 막는 대신 **볼 수 있는 것만 남긴다.**
 */
export const requesterCan = (
  request: Request,
  required: PermissionKey,
): boolean => {
  const employee = findRequester(request);

  if (!employee) return false;

  const role = adminRoles.find((item) => item.roleId === employee.roleId);

  return hasPermission(role?.permissions, required, role?.isSuperAdmin);
};
