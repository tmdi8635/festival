# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

인력 에이전시(행사 스태프) 통합 관리 시스템의 **관리자 프론트엔드**다. 서버는 아직 없고,
MSW 목업이 전체 API를 대신한다. 화면·데이터·규칙이 목업만으로 실제처럼 동작하는 것이 현재 목표다.

## 먼저 읽을 문서

작업 전에 아래를 읽는다. 이 파일은 큰 그림만 담고, 실제 규칙은 문서에 있다.

| 문서 | 무엇 |
|---|---|
| `docs/DEVELOPMENT_GUIDE.md` | **코드 규칙의 단일 원본.** 새 화면·API·목업을 만들 때 순서와 규칙을 그대로 따른다 |
| `docs/DESIGN_SYSTEM.md` | 색·간격·모서리·타이포 토큰. 화면에서 새 값을 만들지 않는다 |
| `docs/PLAN.md` | 왜 만드는가 (As-Is 운영 방식, 도메인 모델) |
| `docs/ADMIN_PLAN.md` | 메뉴 분류 기준, 라우트 구조, 화면별 책임 |

## 명령어

```bash
npm run dev
```

빌드 · 검사 (완료 기준은 `docs/DEVELOPMENT_GUIDE.md` 14장):

```bash
npx tsc --noEmit && npx eslint src && npm run build
```

테스트 러너는 없다. 검증은 **타입·린트·빌드 + 목업으로 화면을 실제로 돌려 보는 것**이다.
`npm run lint`는 인자 없는 `eslint`라 대상이 다르다. 검사는 위 한 줄을 그대로 쓴다.
브라우저 확인은 `.claude/launch.json`의 `hr-admin` 설정으로 preview를 띄워서 한다.

환경 변수(`.env.local`)는 두 개뿐이다.
`NEXT_PUBLIC_API_MOCKING=enabled`면 MSW가 뜨고 요청은 **같은 출처**로 나간다.
목업을 끌 때만 `NEXT_PUBLIC_BASE_URI`가 쓰인다. (`src/api/index.ts`, `src/mocks/utils.ts`)

## 폴더 구조

```
src/app/(admin)/     라우트. page.tsx는 서버 컴포넌트, 상태는 _components/의 클라이언트 컴포넌트
src/api/<domain>/    API 함수 + react-query 훅을 같은 파일에 둔다 (getXxx.ts / mutateXxx.ts)
src/mocks/db/        도메인별 시드 배열 (모듈 스코프. 변경 API가 실제로 이 배열을 고친다)
src/mocks/handlers/  도메인별 MSW 핸들러
src/type/            타입 + 계산 순수 함수 (계산식의 단일 원본)
src/schema/          zod 스키마 (xxx.schema.ts)
src/components/ui/   공통 UI. 화면에서 버튼·표·모달을 새로 만들지 않는다
src/components/domain/ 두 화면 이상이 쓰는 도메인 컴포넌트
src/components/layout/ 사이드바 · 헤더 · 명령 팔레트 · 기준 설정 로더
src/constants/       선택지 목록 · CSV 열 정의 · 메뉴(menu.tsx)
src/hooks/           화면 공통 훅 (useListSearch · useSelection · useMediaQuery …)
src/lib/             순수 유틸 (cn · csv · dayjs · toast · 계약서/PDF 파일)
src/store/           zustand (useAdminStore 권한 · useOrgStore 기준 설정 ·
                     useConfirmStore 확인창 · useSidebar/useViewportStore 화면 상태)
```

`src/components/ui/index.ts`와 `domain/index.ts`는 배럴이다. `@/components/ui`에서 한 번에 가져온다.

## 큰 그림 — 여러 파일을 읽어야 보이는 것

### 배치(Assignment)가 중심이고, 계산식은 `src/type/`에 있다

계약서 · 정산 · 근태 · 평가가 전부 **배치(사람 × 날짜)** 에 붙는다.
지급액 · 실근무시간 · 평판 점수 같은 값은 화면에서 다시 계산하지 않고
`type/payroll.ts` `type/event.ts` `type/staff.ts` `type/contract.ts`의 순수 함수를 쓴다.
화면 · 목업 · CSV가 같은 함수를 써야 숫자가 갈리지 않는다.
(함수 목록은 `docs/DEVELOPMENT_GUIDE.md` 9장 표)

특히 주의할 층위 차이:
- 배치는 **사람 × 날짜**, 정산은 **행사 × 사람**, 계약서는 **사람당 한 장**이다.
- 행사의 실제 근무일은 기간이 아니라 `recurrence` → `resolveEventDates()`의 결과다.
- 발주의 단일 원본은 `event.days[].roles`이고 `event.roles`는 파생값이다.
- 날짜 문자열은 `toDateKey()` / `nextDateKey()`로 만든다. `toISOString()`은 KST에서 하루 밀린다.

### 직무는 시스템이 정하고, 기준 설정은 단가만 갖는다

직무(`JobRole`)는 `JOB_ROLE_CODES`의 **유니온 타입**이고 목록은 `JOB_ROLE_CATALOG`에
하드코딩돼 있다(`type/staff.ts`). 이름 · 순서는 시스템이 갖고, 기준 설정이 갖는 것은
**지급 단가 · 청구 단가 · 사용 여부**뿐이다. 사용자는 직무를 늘리거나 이름을 바꿀 수 없다.
직무는 우리 내부 호칭이 아니라 **대행사와 견적을 주고받는 공통 언어**이기 때문이다.
(부팀장 · 서브팀장 같은 내부 호칭이 견적서에 올라가면 받는 쪽이 알아볼 수 없다)

`GET /admin/settings` 응답이 `hydrateOrgSettings()` → `mergeJobRoles()`를 거쳐
카탈로그와 합쳐진 뒤 `useOrgStore`에 들어간다. 컴포넌트는 훅(`useJobRoleLabel` 등),
모듈 스코프는 순수 함수(`jobRoleLabel`)로 읽는다.
직무를 나열·정렬하는 모든 곳은 카탈로그의 순서를 따른다. `localeCompare`로 정렬하지 않는다.

**청구 단가는 거래처가 갖지 않는다.** 단가를 부르는 쪽이 에이전시라서,
기준 설정(`JobRoleDef.billingRate`)이 원본이고 행사 등록 시 초기값으로 깔린 뒤
행사별로 고쳐진다(`EventDetail.billingRates`).

기능 잠금도 여기서 온다. `featureModes`의 `ENABLED` / `MOCK` / `LOCKED`가
메뉴 노출과 화면 상단 배너를 결정한다. **아직 못 쓰는 기능을 코드에서 지우지 않고 잠근다.**

### 메뉴가 화면 목록의 단일 원본이다

`src/constants/menu.tsx`의 한 항목이 `href` · `permission` · `feature`를 함께 갖는다.
사이드바와 명령 팔레트가 같은 배열을 읽으므로, 라우트를 추가하고 여기 넣지 않으면
화면은 존재하지만 아무도 찾지 못한다. 권한(당신에게 닫힘)과 잠금(아직 없음)은 다른 축이다.

### 권한은 직책이 갖고, 네 겹으로 다룬다

`자료:행위` 키(`payroll:approve`) 하나로 판정한다. (`type/permission.ts`)
메뉴(감춤) → 화면(`PermissionGate`) → 버튼(`useHasPermission`) → **서버(`requirePermission`, 목업 핸들러)**.
앞의 셋은 실수를 줄이는 장치이고 막는 책임은 서버에 있다.
볼 수 없는 자료는 조회 자체를 걸지 않는다 — `usePermittedQuery(권한, options)`를 쓰면
부르는 쪽이 `enabled`를 기억하지 않아도 된다.
대시보드 · 통합검색처럼 성격이 다른 자료가 섞인 응답은 거부가 아니라 **덜어 내기**로 다룬다.

요청에는 `X-Admin-Id`가 실린다(`api/index.ts`). 로그인이 붙으면 이 줄만 토큰으로 바뀐다.

### 목업은 서버처럼 행동해야 한다

`src/mocks/db/*`는 모듈 스코프 배열이고 POST/PUT/DELETE가 **실제로 배열을 바꾼다.**
서버가 막아야 할 규칙(중복 배치, 기본 템플릿 삭제, 권한)은 목업도 막는다.
날짜는 `dateFromToday(offset)`, 난수는 seed 기반(`randomInt`/`pickOne`)으로만 만든다.
핸들러 등록 순서에 의미가 있다 — 감사 로그가 맨 앞, `/events/calendar`가 `/events/:eventId`보다 먼저.

### 응답 형태와 에러

axios 인터셉터가 신규 DTO와 기존 `{ result: "OK", data }` 봉투를 함께 풀고,
에러는 `AppError`로 정규화한다. 화면에서 에러 토스트를 일일이 붙이지 않는다.
단 403만은 인터셉터가 직접 토스트를 띄운다(버튼을 눌러도 아무 일이 없으면 고장으로 읽힌다).

목록은 전부 같은 계약을 쓴다 — 요청은 `PageParams`, 응답은 `PageResponse`(`content` ·
`totalCount` · `totalPages`), **`page`는 1부터**, 기본 크기는 `DEFAULT_PAGE_SIZE`(20).
(`type/api/index.ts`, 목업 쪽은 `mocks/utils.ts`의 `paginate()`)

### 첫 화면이 그려지기 전에 두 가지가 먼저 끝난다

`MSWProvider`는 워커가 뜰 때까지 아무것도 렌더하지 않는다(첫 요청이 목업을 안 타면
데이터가 통째로 빈다). 그 뒤 `(admin)/layout.tsx`의 `OrgSettingsLoader`가 기준 설정을
한 번 불러 `useOrgStore`를 채운다. 개발 중 화면이 잠깐 비어 보이는 건 이 순서 때문이다.

## 코드 작성 시 반복해서 걸리는 것들

- **React Compiler 린트: effect 안에서 setState 금지.** 서버 데이터를 편집할 때는
  `const rows = draft ?? data ?? []` draft 패턴을 쓴다. (가이드 7장)
- 목록 화면의 검색·페이지 상태는 `useListSearch()`, 체크박스 선택은 `useSelection()`이 갖는다.
  필터 핸들러는 `withPageReset(...)`으로 감싸고, 필터가 바뀌면 선택을 `clear()`한다.
- 파생 배열(`filter`/`map`)은 `useMemo`로 감싼다. 안 그러면 "Maximum update depth exceeded"가 난다.
- 확인은 `window.confirm`이 아니라 `openConfirm()`(`store/useConfirmStore`)이다.
  대화상자는 루트의 `ConfirmDialogHost`가 하나만 띄운다.
- CSV 내보내기는 `CsvExportButton` + `constants/csvColumns.ts` + `lib/csv.ts`를 쓴다.
  열 정의를 화면에서 새로 만들지 않는다(숫자는 `type/`의 같은 함수에서 나와야 한다).
  내려받는 건 **현재 페이지에 조회된 행뿐**이다. 전체가 필요하면 서버 내보내기가 따로 있어야 한다.
- 문자열은 한국어 하드코딩(사내 도구라 i18n 없음), 주석은 한국어 `/** */`로 **왜**를 적는다.
- 임포트는 절대 경로 `@/`. 상대 경로는 같은 폴더(`./`)에서만.
- 컴포넌트는 화살표 함수 + `export default`, 클래스 조합은 항상 `cn()`.
- 폭 390px에서 가로 스크롤이 생기면 안 된다. 페이지에 최소 폭을 주지 않는다(표 안쪽은 예외).
