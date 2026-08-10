import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useHasPermission } from "@/store/useAdminStore";
import type { AppError } from "@/type/api";
import type { PermissionKey } from "@/type/permission";

/**
 * 권한이 있을 때만 실제로 부르는 조회.
 *
 * **볼 수 없는 자료는 묻지도 않는다.**
 *
 * 서버가 403으로 막으면 자료는 새지 않는다. 그런데 화면은 담당자가 누르지도 않은 일에
 * 대해 거부 안내를 띄운다. 행사 목록 화면이 거래처 필터를 채우려고 거래처를 부르는데,
 * 거래처를 볼 수 없는 담당자에게는 화면을 열 때마다
 * "'거래처 > 조회' 권한이 필요합니다"가 뜬다. 누른 적이 없으니 고장으로 읽힌다.
 *
 * 이걸 화면마다 `enabled`로 막으면 **부르는 쪽이 하나만 빠뜨려도 다시 뜬다.**
 * 화면은 계속 늘어나고, 한 화면이 여러 자료를 섞어 쓰는 일도 흔하다.
 * 그래서 판정을 조회 쪽에 둔다. 조회는 자기가 어느 자료를 부르는지 알고 있고,
 * 그 자료는 하나뿐이다. 부르는 쪽은 권한을 몰라도 된다.
 *
 * 막는 책임은 여전히 서버에 있다. (`requirePermission`)
 * 이건 **쓸모없는 요청을 아예 만들지 않기 위한 것**이지 보안 장치가 아니다.
 */
export const usePermittedQuery = <TData>(
  permission: PermissionKey,
  options: UseQueryOptions<TData, AppError, TData, QueryKey>,
): UseQueryResult<TData, AppError> => {
  const allowed = useHasPermission(permission);

  return useQuery<TData, AppError, TData, QueryKey>({
    ...options,
    enabled: (options.enabled ?? true) && allowed,
  });
};
