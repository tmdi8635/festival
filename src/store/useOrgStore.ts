import { useCallback, useMemo } from "react";
import { create } from "zustand";
import type { SelectOption } from "@/components/ui";
import type { WageType } from "@/type/event";
import type { FeatureKey, FeatureMode, OperationSettings } from "@/type/ops";
import {
  DEFAULT_JOB_ROLES,
  sortJobRoles,
  type JobRole,
  type JobRoleDef,
} from "@/type/staff";

/**
 * 에이전시 운영 기준을 화면 어디서나 동기적으로 읽기 위한 스토어.
 *
 * 직무 이름 · 나열 순서는 표의 셀 하나를 그릴 때마다 필요한데,
 * 그때마다 쿼리 훅을 부르면 컴포넌트가 전부 클라이언트 훅에 묶인다.
 * 그래서 기준 설정 응답을 받는 순간(=API 함수 안)에 여기로 흘려 넣고,
 * 화면은 `jobRoleLabel()` 같은 순수 함수로 꺼내 쓴다.
 */
interface OrgState {
  jobRoles: JobRoleDef[];
  featureModes: Record<FeatureKey, FeatureMode>;
  hydrate: (settings: OperationSettings) => void;
}

const DEFAULT_FEATURE_MODES: Record<FeatureKey, FeatureMode> = {
  RECRUIT: "MOCK",
  MESSAGE: "MOCK",
  CLIENT: "ENABLED",
};

export const useOrgStore = create<OrgState>((set) => ({
  jobRoles: sortJobRoles(DEFAULT_JOB_ROLES),
  featureModes: DEFAULT_FEATURE_MODES,
  hydrate: (settings) =>
    set({
      // 나열 순서는 여기서 한 번만 정리한다. 화면마다 다시 정렬하면 어긋난다.
      jobRoles: sortJobRoles(settings.jobRoles),
      featureModes: settings.featureModes,
    }),
}));

/**
 * 기준 설정 응답을 스토어에 반영한다.
 *
 * 렌더링 밖(API 함수)에서 부르므로 effect 안 setState 제약에 걸리지 않는다.
 */
export const hydrateOrgSettings = (settings: OperationSettings) => {
  useOrgStore.getState().hydrate(settings);
};

/** 사용 중인 직무만, 기준 설정에서 정한 순서대로 */
export const activeJobRoles = (): JobRoleDef[] =>
  useOrgStore.getState().jobRoles.filter((role) => role.isActive);

/** 화면에 나열할 직무 코드 순서 */
export const jobRoleOrder = (): JobRole[] =>
  activeJobRoles().map((role) => role.code);

const findJobRole = (code: JobRole): JobRoleDef | undefined =>
  useOrgStore.getState().jobRoles.find((role) => role.code === code);

/**
 * 직무 코드를 사람이 읽는 이름으로 바꾼다.
 *
 * 지워진 직무로 잡혀 있던 과거 배치도 표에 그대로 남아야 하므로,
 * 정의를 못 찾으면 코드를 그대로 보여 준다. (빈 칸으로 두면 이력이 사라진 것처럼 보인다)
 */
export const jobRoleLabel = (code: JobRole): string =>
  findJobRole(code)?.name ?? code;

/** 캘린더처럼 좁은 곳에서 쓰는 짧은 이름 */
export const jobRoleShortLabel = (code: JobRole): string => {
  const role = findJobRole(code);

  return role?.shortName || role?.name || code;
};

/* ------------------------------------------------------------------ */
/* 나열 순서                                                            */
/* ------------------------------------------------------------------ */

/**
 * 직무 코드의 나열 순서.
 *
 * **직무를 늘어놓는 모든 곳은 반드시 이 값을 거친다.**
 * 예전에는 화면마다 `role.localeCompare(other)`로 정렬했는데, 그건 사람이 정한
 * 순서가 아니라 **내부 코드의 알파벳순**이다. 그래서 기준 설정에서 1번으로 올려 둔
 * 팀장(`SUPERVISOR`)이 MC · MODEL · SETUP · SOUND · STAFF 뒤로 밀려 항상 맨 끝에 붙었다.
 *
 * 정의가 사라진 직무(과거 이력)는 뒤로 보낸다. 지워진 직무 때문에
 * 현재 쓰는 직무의 순서가 밀리면 안 된다.
 */
export const jobRoleIndex = (code: JobRole): number => {
  const index = useOrgStore
    .getState()
    .jobRoles.findIndex((role) => role.code === code);

  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
};

/**
 * 직무 코드 두 개의 순서를 비교한다. `sort`에 그대로 넘겨 쓴다.
 *
 * 순서가 같으면(둘 다 정의가 없는 경우) 코드로 떨어뜨려
 * 렌더마다 순서가 흔들리지 않게 한다.
 */
export const compareJobRoles = (a: JobRole, b: JobRole): number =>
  jobRoleIndex(a) - jobRoleIndex(b) || a.localeCompare(b);

/** 직무 코드 목록을 화면 순서대로 정렬한다. */
export const sortJobRoleCodes = (codes: JobRole[]): JobRole[] =>
  [...codes].sort(compareJobRoles);

/**
 * 직무를 들고 있는 객체 목록을 직무 순서로 정렬한다.
 *
 * 배치 · 정산 · 계약처럼 "직무 다음에 이름" 순으로 늘어놓는 자리가 많아,
 * 두 번째 기준까지 함께 받는다.
 */
export const sortByJobRole = <T>(
  items: T[],
  pickRole: (item: T) => JobRole,
  tieBreak?: (a: T, b: T) => number,
): T[] =>
  [...items].sort(
    (a, b) =>
      compareJobRoles(pickRole(a), pickRole(b)) ||
      (tieBreak ? tieBreak(a, b) : 0),
  );

/**
 * 행사 등록 시 초기값으로 깔 지급 기준과 금액.
 *
 * 직무마다 관행이 다르다. (설치 · 철거는 대개 하루 얼마, 스태프는 시급)
 * 정의를 못 찾으면 가장 흔한 형태인 시급으로 떨어뜨린다.
 */
export const jobRoleDefaultWage = (
  code: JobRole,
): { wageType: WageType; wage: number } => {
  const role = findJobRole(code);

  return {
    wageType: role?.defaultWageType ?? "HOURLY",
    wage: role?.defaultWage ?? 12000,
  };
};

/** 기능의 현재 운영 모드 */
export const featureMode = (key: FeatureKey): FeatureMode =>
  useOrgStore.getState().featureModes[key] ?? "ENABLED";

/** MOCK 모드는 화면을 열되 저장을 막고 배너를 띄운다. */
export const isFeatureMock = (key: FeatureKey): boolean =>
  featureMode(key) === "MOCK";

/** 잠긴 기능은 메뉴에서 감춘다. */
export const isFeatureLocked = (key: FeatureKey): boolean =>
  featureMode(key) === "LOCKED";

/* ------------------------------------------------------------------ */
/* 화면용 훅                                                            */
/* ------------------------------------------------------------------ */

/**
 * 컴포넌트에서 직무 라벨을 그릴 때 쓰는 훅.
 *
 * 순수 함수(`jobRoleLabel`)만 쓰면 기준 설정이 나중에 도착했을 때
 * 이미 그려진 표가 옛 이름을 그대로 달고 있게 된다.
 * 훅으로 스토어를 구독해 두면 직무를 바꾸는 즉시 모든 화면이 따라온다.
 */
export const useJobRoles = (): JobRoleDef[] =>
  useOrgStore((state) => state.jobRoles);

/*
  파생 배열은 반드시 메모이제이션한다.

  `filter`/`map`은 렌더마다 새 배열을 만든다. 그 배열이 `useEffect`의 의존성이나
  `useForm`의 `reset` 인자로 흘러 들어가면 렌더 → 이펙트 → 렌더가 무한히 돈다.
  (실제로 행사 등록 폼에서 이 문제가 났다)
*/
export const useActiveJobRoles = (): JobRoleDef[] => {
  const jobRoles = useJobRoles();

  return useMemo(
    () => jobRoles.filter((role) => role.isActive),
    [jobRoles],
  );
};

/** 직무 코드 → 이름 변환 함수. 직무 목록이 바뀌면 함수도 새로 만들어진다. */
export const useJobRoleLabel = () => {
  const jobRoles = useJobRoles();

  return useCallback(
    (code: JobRole) =>
      jobRoles.find((role) => role.code === code)?.name ?? code,
    [jobRoles],
  );
};

/** 좁은 곳에 쓰는 짧은 이름 변환 함수 */
export const useJobRoleShortLabel = () => {
  const jobRoles = useJobRoles();

  return useCallback((code: JobRole) => {
    const role = jobRoles.find((item) => item.code === code);

    return role?.shortName || role?.name || code;
  }, [jobRoles]);
};

/**
 * 직무 순서 비교 함수. 직무 목록이 바뀌면 함수도 새로 만들어져 화면이 따라온다.
 *
 * 순수 함수(`compareJobRoles`)는 CSV · 목업처럼 렌더 밖에서 쓰고,
 * 표를 그리는 컴포넌트는 이 훅을 쓴다.
 */
export const useJobRoleComparator = () => {
  const jobRoles = useJobRoles();

  return useCallback(
    (a: JobRole, b: JobRole) => {
      const indexOf = (code: JobRole) => {
        const index = jobRoles.findIndex((role) => role.code === code);

        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
      };

      return indexOf(a) - indexOf(b) || a.localeCompare(b);
    },
    [jobRoles],
  );
};

/** 직무 선택 드롭다운 · 체크박스에 쓰는 선택지 */
export const useJobRoleOptions = (): SelectOption[] => {
  const roles = useActiveJobRoles();

  return useMemo(
    () => roles.map((role) => ({ label: role.name, value: role.code })),
    [roles],
  );
};

/** 앞에 "전체 직무"가 붙은 필터용 선택지 */
export const useJobRoleFilterOptions = (): SelectOption[] => {
  const options = useJobRoleOptions();

  return useMemo(
    () => [{ label: "전체 직무", value: "" }, ...options],
    [options],
  );
};

/** 기능 운영 모드 (MOCK 배너 · 메뉴 잠금 판단에 쓴다) */
export const useFeatureMode = (key: FeatureKey): FeatureMode =>
  useOrgStore((state) => state.featureModes[key] ?? "ENABLED");
