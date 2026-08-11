/**
 * 앱이 얹혀 있는 경로 접두사. (`next.config.ts`의 `basePath`와 같은 값)
 *
 * 깃허브 페이지처럼 `https://<계정>.github.io/festival` 하위 경로에 올라가면
 * 앱의 뿌리가 `/`가 아니다. `<Link>`와 정적 자원은 Next가 알아서 접두사를 붙이지만
 * **직접 주소를 만드는 세 곳**은 우리가 챙겨야 한다.
 *
 * 1. 서비스 워커 파일 주소 (`providers/MSWProvider.tsx`)
 * 2. 요청을 보내는 쪽 (`api/index.ts`)
 * 3. 요청을 가로채는 쪽 (`mocks/utils.ts`)
 *
 * 특히 2·3은 값이 갈리면 조용히 실패한다. 서비스 워커는 자기가 놓인 폴더
 * (`/festival/`) 아래만 가로챌 수 있어서, 요청이 `/admin/...`으로 나가면
 * 워커가 손대지 못하고 그대로 밖으로 나가 404가 된다.
 *
 * 빌드 때 문자열로 박히므로 실행 중에 바뀌지 않는다.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
