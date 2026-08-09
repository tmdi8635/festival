# 개발 가이드

> 새 화면을 추가할 때 이 문서의 순서와 규칙을 그대로 따른다.
> 규칙은 이미 만들어진 화면들이 전부 지키고 있는 것이다. 임의로 바꾸지 않는다.

---

## 0. 절대 규칙

1. **색상·간격·모서리·그림자는 `docs/DESIGN_SYSTEM.md`의 토큰만 쓴다.**
   `text-gray-500`, `bg-white` 같은 Tailwind 기본 팔레트 직접 사용 금지.
2. **공통 UI는 `src/components/ui`에서 가져다 쓴다.** 버튼·표·모달을 화면에서 새로 만들지 않는다.
3. **주석은 한국어로, `/** */` 형식으로 단다.** 왜 그렇게 했는지를 적는다.
4. **문자열은 한국어 하드코딩.** 사내 도구이므로 i18n을 쓰지 않는다.
5. 절대 경로 `@/`만 사용한다. 상대 경로는 같은 폴더(`./`, `..`)에서만.

---

## 1. 파일·폴더 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 파일 | PascalCase.tsx | `EventManager.tsx` |
| API 파일 | camelCase.ts, `동사+리소스` | `getEventList.ts` |
| 훅 파일 | `useXxx.ts` | `useIsClient.ts` |
| 화면 전용 하위 컴포넌트 | 같은 `_components/`에 두고 `./`로 가져온다 | `AttendanceRosterRow.tsx` |
| 스토어 | `useXxxStore.ts` | `useSidebarStore.ts` |
| 타입 | camelCase.ts | `event.ts` |
| zod 스키마 | `xxx.schema.ts` | `event.schema.ts` |
| 화면 전용 컴포넌트 | 해당 라우트의 `_components/` | `app/(admin)/payroll/_components/` |
| 두 화면 이상이 쓰는 컴포넌트 | `src/components/domain/` | `StaffPickerModal.tsx` |

---

## 2. 컴포넌트 작성 규칙

```tsx
import { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

interface ExampleProps extends ComponentPropsWithoutRef<"div"> {
  title: string;
  isActive: boolean;
}

const Example = ({ title, isActive, className, ...props }: ExampleProps) => {
  return (
    <div className={cn("base-class", isActive && "active-class", className)} {...props}>
      {title}
    </div>
  );
};

export default Example;
```

- **화살표 함수 + `export default`.** (`app/**/page.tsx`만 `export default function`)
- props 타입은 `interface XxxProps`, 시그니처에서 구조분해.
- 클래스 조합은 항상 `cn()`.
- 훅을 쓰는 컴포넌트 파일 최상단에 `"use client";`.
- `page.tsx`는 서버 컴포넌트로 두고, 상태가 필요한 부분만 `_components/`의 클라이언트 컴포넌트로 분리한다.

---

## 3. API + react-query 규칙 ★

**API 함수와 react-query 훅을 같은 파일에 둔다.**
쿼리키는 별도 상수 파일 없이 `["동사-리소스", ...파라미터]` 형태의 인라인 배열을 쓴다.

```ts
// src/api/event/getEventList.ts
import { useQuery } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError, PageResponse } from "@/type/api";
import type { EventStatus, EventSummary } from "@/type/event";

export interface EventListParams {
  page: number;
  size: number;
  keyword?: string;
  status?: EventStatus;
}

export const getEventList = async (params: EventListParams) => {
  const response = await adminAxios.get<PageResponse<EventSummary>>(
    "/admin/events",
    { params },
  );

  return response.data;
};

/** 행사 목록 화면에서 검색·필터·페이지네이션과 함께 사용합니다. */
export const useEventListQuery = (params: EventListParams) => {
  return useQuery<PageResponse<EventSummary>, AppError>({
    queryKey: ["get-event-list", params],
    queryFn: () => getEventList(params),
  });
};
```

변경 API는 `mutateXxx.ts` 한 파일에 모으고, 성공 시 **토스트 + 무효화**를 함께 처리한다.

```ts
export const useEventMutation = () => {
  const queryClient = useQueryClient();

  // 행사는 캘린더 · 목록 · 대시보드에 동시에 보이므로 함께 무효화한다.
  const invalidateEvent = () => {
    queryClient.invalidateQueries({ queryKey: ["get-event-list"] });
    queryClient.invalidateQueries({ queryKey: ["get-event-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["get-dashboard-summary"] });
  };

  const statusMutation = useMutation<
    EventDetail,
    AppError,
    { eventId: number; status: EventStatus }
  >({
    mutationFn: ({ eventId, status }) => updateEventStatus(eventId, status),
    onSuccess: () => {
      showAppToast("success", "행사 상태를 변경했습니다.");
      invalidateEvent();
    },
  });

  return { statusMutation };
};
```

**무효화 범위는 화면 기준으로 정한다.** 배치를 하나 넣으면 행사 상세뿐 아니라
캘린더 · 배치 현황 · 대시보드의 숫자가 전부 바뀐다. 관련 쿼리키를 빠짐없이 넣는다.

- 에러 토스트는 따로 붙이지 않는다. axios 인터셉터가 `AppError`로 정규화하고,
  화면에서 필요할 때만 `showErrorToast(error)`를 쓴다.
- `staleTime` 기본값(5분)은 `ReactQueryProvider`에 있으므로 개별 훅에서 다시 지정하지 않는다.

---

## 4. MSW 목업 규칙

- 도메인별 시드 데이터는 `src/mocks/db/<domain>.ts`에 **모듈 스코프 배열**로 둔다.
  의존 순서는 `client → staff → event → contract/payroll/recruit → message/ops`다.
- 핸들러는 `src/mocks/handlers/<domain>.ts`에 `export const <domain>Handlers = [...]`로 만든다.
  (`handlers/index.ts`에 이미 등록되어 있다.)
- **POST/PUT/DELETE는 시드 배열을 실제로 변경한다.** 새로고침 전까지 CRUD가 진짜처럼 동작해야 한다.
- 응답 지연은 `MOCK_DELAY_MS`, 페이지네이션은 `paginate(items, url)`,
  검색은 `matchesKeyword(keyword, ...fields)`, 새 ID는 `nextId(items, "xxxId")`를 쓴다.
- 난수는 `randomInt(seed, min, max)` / `pickOne(seed, items)`처럼 **seed 기반**으로만 만든다.
  `Math.random()`을 쓰면 렌더링마다 값이 바뀌어 확인이 어렵다.
- **날짜는 고정 문자열을 쓰지 않는다.** `dateFromToday(offset)`으로 오늘 기준 상대값을 만든다.
  고정 날짜를 박으면 시간이 지날수록 캘린더가 비어 보인다.
- **서버가 막아야 하는 규칙은 목업도 막는다.** (중복 배치, 기본 템플릿 삭제, 대표 계정 삭제)
  화면에서만 막으면 서버 연동 후 동작이 달라진다.

---

## 5. 목록 화면 표준 구조

검색어 · 페이지 상태는 **직접 만들지 않는다.** `useListSearch()`가 갖고 있다.

```tsx
"use client";

const XxxManager = () => {
  // 전역 검색(⌘K)에서 넘어온 검색어를 초기값으로 쓰고, 화면에서 검색하면 그 값이 우선한다.
  const { page, setPage, keyword, handleSearch, withPageReset } = useListSearch();
  const [status, setStatus] = useState<XxxStatus | "">("");

  const { data, isLoading } = useXxxListQuery({ page, size: DEFAULT_PAGE_SIZE, keyword, status });

  const columns: TableColumn<Xxx>[] = [ ... ];

  return (
    <Card noPadding>
      {/* 1. 필터 바 */}
      <div className="flex items-center justify-between gap-3 border-b border-border-main px-5 py-3.5">
        <SearchInput value={keyword} onSearch={handleSearch} />
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={withPageReset((event) => setStatus(event.target.value as XxxStatus | ""))}
        />
      </div>

      {/* 2. 표 */}
      <Table columns={columns} rows={data?.content ?? []} getRowKey={(row) => String(row.xxxId)} isLoading={isLoading} />

      {/* 3. 페이지네이션 */}
      <Pagination page={page} totalCount={data?.totalCount ?? 0} pageSize={DEFAULT_PAGE_SIZE} onChange={setPage} />
    </Card>
  );
};
```

- 검색어 · 필터가 바뀌면 **항상 `page`를 1로 되돌린다.** 그래서 필터 핸들러는
  `withPageReset(...)`으로 감싼다. 손으로 `setPage(1)`을 적으면 필터를 하나 늘릴 때
  빠뜨리고, 빠뜨린 그 필터만 "결과 없음"을 낸다. (데이터가 없는 게 아니라 3페이지에 있던 것이다)
- 상태 뱃지는 `Badge`, 행 액션은 `IconButton` 또는 `Dropdown`.
- 파괴적 액션은 반드시 `openConfirm({ ... })`.

### 여러 건을 골라 일괄 처리하는 목록

체크박스 선택은 `useSelection(보이는 ID 배열)`이 갖는다. 토글 · 전체선택을 다시 만들지 않는다.

```tsx
const rows = data?.content ?? [];
const { selectedIds, isAllSelected, isSelected, toggle, toggleAll, clear } =
  useSelection(rows.map((row) => row.xxxId));
```

- `isAllSelected`는 **지금 보이는 행 기준**이다. 필터로 3건만 남았는데 전체 선택이
  꺼져 보이면 담당자는 다시 누르고, 그 순간 화면 밖의 건까지 처리된다.
- **필터 · 검색을 바꿀 때 `clear()`를 함께 부른다.** 걸러져 사라진 행이 선택에 남으면
  "3건 선택"이라 적힌 채 화면에 없는 건이 처리된다.
- 묶어 보는 화면(출퇴근 명부)은 `toggleMany(ids)` · `areAllSelected(ids)`를 쓴다.

---

## 6. 폼 규칙

`react-hook-form` + `zod` + `@hookform/resolvers/zod` 조합만 쓴다.

```tsx
const { register, handleSubmit, control, reset, formState: { errors } } = useForm<XxxSchema>({
  resolver: zodResolver(xxxSchema),
  defaultValues: EMPTY_VALUES,
});
```

- 스키마는 `src/schema/xxx.schema.ts`, 에러 메시지는 한국어.
- 필드는 `FormField`로 감싸고 `error={errors.xxx?.message}`를 넘긴다.
- 체크박스·스위치처럼 비제어가 어려운 입력은 `Controller`를 쓴다.
- **이미지 필드는 URL 입력창을 만들지 않는다.** `ImageUploadField`를 `Controller`로 감싸 쓴다.

```tsx
<FormField label="신분증 사본">
  <Controller
    control={control}
    name="idCardImageUrl"
    render={({ field }) => (
      <ImageUploadField
        value={field.value}
        onChange={field.onChange}
        fileType="STAFF_ID_CARD"
        aspectRatio="16 / 10"
      />
    )}
  />
</FormField>
```

`fileType`은 서버가 보관 정책을 다르게 가져가는 기준이다.
`STAFF_PROFILE` · `STAFF_ID_CARD` · `STAFF_BANK_BOOK` · `EVENT_PHOTO` 중에서 고른다.
신분증 · 통장사본은 개인정보이므로 프로필 사진과 같은 타입으로 올리지 않는다.

업로드는 생성·수정 API와 분리되어 있다. 파일을 고르는 즉시
`POST /admin/files/upload/{fileType}`로 올려 URL을 받고, 폼은 그 URL만 들고 있다가 저장한다.
따라서 스키마는 형식 검증 없이 `z.string().min(1, "…업로드해 주세요.")`면 된다.

---

## 7. 서버 데이터를 편집할 때 (중요)

`useEffect`로 서버 데이터를 `useState`에 복사하면 **React Compiler 린트 에러**가 난다.
아래 draft 패턴을 쓴다.

```tsx
// 편집 전에는 서버 값을 그대로 쓰고, 편집이 시작되면 draft가 화면을 담당한다.
const [draft, setDraft] = useState<Xxx[] | null>(null);
const rows = draft ?? data ?? [];

const handleReset = () => setDraft(null);
const handleSave = () => mutation.mutate(rows, { onSuccess: () => setDraft(null) });
```

---

## 8. 외부 연동 전 화면

문자 발송처럼 외부 API가 있어야 완성되는 기능도 **화면과 데이터는 전부 동작하게 만든다.**
다만 화면 최상단에 지금 무엇이 되고 무엇이 안 되는지 명시한다.

```tsx
<Alert tone="warning" title="문자 API 연동 전입니다.">
  지금은 발송 대상 · 문구 · 이력만 시스템에 기록됩니다. 실제 문자는 아직 나가지 않으니,
  문구를 복사해 기존 방식으로 보내 주세요.
</Alert>
```

"안 되는 기능"이라고만 적지 않는다. **지금 무엇을 대신 하면 되는지**를 함께 적는다.

---

## 9. 계산 로직은 타입 파일에 둔다

지급액 · 근무일 · 실근무 시간처럼 여러 곳에서 같은 값을 계산해야 하는 것은
화면이 아니라 `src/type/`의 순수 함수로 만든다.

| 함수 | 위치 | 쓰는 곳 |
|---|---|---|
| `calculatePayroll` ★ | `type/payroll.ts` | 정산 목록 · 조정 모달 · 목업 (근무일 배열을 통째로 받는다) |
| `calculateReputationScore` ★ | `type/staff.ts` | 인력 목록 · 상세 · 배치 추천 (좋아요 · 별로예요 건수로 계산) |
| `calculateBasePay` ★ | `type/event.ts` | 계약서 · 대시보드 · 인력 이력 (하루치) |
| `resolveHourlyRate` | `type/event.ts` | 지각 공제처럼 분 단위로 따질 때 |
| `calculateWorkHours` | `type/event.ts` | 행사 폼 (시각 · 휴게 · 날짜 넘김을 직접 넘길 때) |
| `calculateScheduledWorkHours` ★ | `type/event.ts` | 행사 · 계약서에서 바로 실근무 시간 (인자 빠뜨릴 일이 없다) |
| `formatTimeRange` ★ | `type/event.ts` | 시각을 나란히 적는 **모든** 화면 (`13:00~03:00 (+1)`) |
| `toDateKey` · `nextDateKey` ★ | `type/event.ts` | `YYYY-MM-DD` 만들기 · 이어지는 날 비교 (`toISOString()` 금지) |
| `confirmedRoster` ★ | `lib/notice.ts` | 단체 문자 명단 · 연락처 (사람 단위 · 직무 순서) |
| `groupAssignmentsByStaffRole` ★ | `type/event.ts` | 계약서 · 정산 · 출퇴근 명부의 사람 단위 묶기 |
| `calculateNightHours` | `type/event.ts` | 야간수당 계산 · 정산 목업 (날짜 넘김 포함) |
| `resolveEventDates` ★ | `type/event.ts` | 행사 폼 · 목업 · 캘린더 |
| `groupConsecutiveDates` | `type/event.ts` | 캘린더 막대 구간 나누기 |
| `summarizeEventCost` | `type/event.ts` | 행사 상세 요약 · 개요 |
| `summarizeEventProgress` | `type/event.ts` | 행사 상세 요약 · 계약서 · 출퇴근 탭 |
| `resolveFillState` | `type/event.ts` | 캘린더 칩 · 충원 색상 |
| `buildContractDocument` ★ | `type/contract.ts` | 계약서 미리보기 · 인쇄 · 서명 |

화면에서 같은 식을 다시 쓰면 목업과 서버가 다른 숫자를 내놓게 된다.

---

## 10. 반복 일정 ★

행사는 하루짜리가 기본이 아니다. **연일 · 매주 · 격주 · 주말만 · 직접 지정**이 모두 온다.

- 기간(`startDate`~`endDate`)은 **반복이 도는 범위**일 뿐이다.
  실제 근무일은 `recurrence`에서 `resolveEventDates()`로 뽑은 `dates`다.
- 배치 · 근태 · 정산 · 계약은 전부 **근무일(`workDate`) 단위**로 움직인다.
  기간으로 묶으면 "3일 중 하루만 빠지는" 상황을 표현할 수 없다.
- 캘린더의 한 칸은 **하루**다. 칸에는 그날의 `days[].roles`를 그리고,
  합계(`totalRequired`/`totalAssigned`)는 막대와 상세에서만 쓴다.
  (합계를 칸에 그리면 주말만 하는 한 달짜리 행사가 하루에 80명 필요한 것처럼 보인다)
- 이어지는 날은 `groupConsecutiveDates()`로 묶어 막대 하나로 그린다.

---

## 11. 직무 · 기능은 설정에서 온다 ★

에이전시마다 운영 방식이 달라서 코드에 고정하지 않는다.

```tsx
// ❌ 하드코딩된 직무
import { JOB_ROLE_LABEL, JOB_ROLE_ORDER } from "@/type/staff";

// ✅ 기준 설정에서 온 값
import {
  useJobRoleLabel,
  useJobRoleOptions,
  useJobRoleComparator,
} from "@/store/useOrgStore";
```

- `JobRole`은 **문자열 코드**다. 이름 · 시급 · 사용 여부는 기준 설정이 갖고 있다.
  코드는 **사람이 정하지 않는다.** 오타 하나가 과거 배치 · 계약 · 정산을 통째로 끊어
  놓기 때문에 `nextJobRoleCode()`가 자동으로 붙이고, 화면에는 이름만 보인다.
- **직무를 나열하는 모든 곳은 기준 설정의 순서를 따른다.**
  컴포넌트는 `useJobRoleComparator()`, 모듈 스코프는 `compareJobRoles()` ·
  `sortJobRoleCodes()` · `sortByJobRole()`를 쓴다.
  절대 `role.localeCompare(other)`로 정렬하지 않는다. 그건 사람이 정한 순서가 아니라
  **내부 코드의 알파벳순**이고, 그래서 1번으로 올려 둔 팀장(`SUPERVISOR`)이
  MC · MODEL · SETUP · SOUND · STAFF 뒤로 밀려 늘 맨 끝에 붙었다.
  자주 쓰는 직무를 위로 올리는 조작은 기준 설정에서 위/아래 버튼으로 한다.
- 컴포넌트에서는 **훅**(`useJobRoleLabel`)을 쓴다. 설정이 바뀌면 화면이 따라온다.
  모듈 스코프(CSV 컬럼 등)에서만 순수 함수(`jobRoleLabel`)를 쓴다.
- 파생 배열(`filter`/`map`)은 **반드시 `useMemo`로 감싼다.**
  렌더마다 새 배열이 만들어져 `useEffect` 의존성에 들어가면 무한 루프가 난다.

기능 잠금은 `featureModes`로 다룬다.

| 모드 | 메뉴 | 화면 |
|---|---|---|
| `ENABLED` | 그대로 | 그대로 |
| `MOCK` | `MOCK` 배지 | 상단에 `<FeatureNotice>` 배너 |
| `LOCKED` | 감춤 (전역 검색에서도 제외) | — |

아직 쓸 수 없는 기능을 **코드에서 지우지 않는다.** 잠그기만 한다.

---

## 12. 지급 기준 — 시급과 일급 ★

현장 일이 시급으로만 굴러가지 않는다.
"이 행사 설치는 하루 15만원"처럼 시간과 무관하게 하루치를 통으로 정하는 경우가 흔하다.

- 지급 기준은 **직무별 발주(`EventRoleSlot`)가 갖는다.** 배치 · 계약서 · 정산이 그 값을 물려받는다.
  직무 기본값은 기준 설정(`JobRoleDef.defaultWageType`)에 있고, 행사마다 다시 고를 수 있다.
- 금액 필드 이름은 `wage`다. `hourlyWage`로 두면 일급일 때 이름이 거짓이 된다.
- **금액이 나가는 자리에는 기준을 함께 적는다.** (`WageText` 컴포넌트)
  숫자만 있으면 12만원이 시급인지 일급인지 자릿수로 짐작해야 한다.
- 기본급은 항상 `calculateBasePay(wageType, wage, workHours)`로 구한다.
  화면에서 `wage * workHours`를 다시 쓰면 일급 건의 금액이 몇 배로 튄다.

일급에는 아래 규칙이 따라붙는다. **"하루에 얼마"는 이미 합의된 총액**이기 때문이다.

| 항목 | 시급 | 일급 |
|---|---|---|
| 하루 기본급 | 금액 × 실근무시간 | 금액 그대로 (시간 무관) |
| 정산 기본급 | 금액 × **모든 근무일 실근무시간 합** | 금액 × **지급 대상 일수** |
| 연장 · 야간수당 | 설정 · 건별 토글에 따라 | **계산하지 않는다.** 화면에도 '해당 없음'으로 적는다 |
| 지각 공제 | 시급 기준 분할 | `resolveHourlyRate()`로 시간당 환산 후 분할 |
| 최저시급 검증 | 적용 | 적용하지 않는다 (시간과 무관한 금액이라 잣대가 다르다) |
| 계약서 총액 | 금액 × 총 실근무시간 | 금액 × 근무일수 |

금액은 **배치 한 건(사람 × 날짜)마다** 다를 수 있다. 기준 설정의 직무 시급은
행사를 만들 때 깔리는 초기값일 뿐이고, 사람마다 · 날마다 다르게 주는 일이 오히려 흔하다.
계약서도 `workDays`로 날짜별 금액을 들고 있어야 총액을 설명할 수 있다. (`hasMixedWage`)

일급 건에 더 줄 돈이 생기면 정산의 **기타수당**으로 넣는다. 그래야 왜 더 줬는지가 남는다.

**용어는 '일당'이 아니라 '일급'으로 쓴다.** 시급 · 주급 · 월급과 같은 계열의 말이라
나란히 놓았을 때 뜻이 바로 통한다. (`WAGE_TYPE_LABEL`)

기준과 금액은 **한 줄에 가로로** 놓는다. (`[일급] 130,000원`)
두 줄로 쌓으면 행 높이가 값마다 들쭉날쭉해지고, 눈이 금액을 먼저 잡은 뒤
기준을 찾아 아래로 한 번 더 내려가야 한다.

---

## 12-1. 정산은 행사 단위다 ★

**정산 한 건은 "행사 × 사람"이다.** 배치는 사람×날짜라서 사흘짜리 행사에
사흘 다 나온 사람은 배치가 3건인데, 정산까지 3건으로 쪼개면 담당자는
한 사람에게 세 번 이체하거나 세 줄을 손으로 더해 한 번 이체한다. 둘 다 틀린다.
실제로 돈이 나가는 단위는 **계약서 한 장이 덮는 기간 전체**다.

- `PayrollItem`은 `workDates` · `days`(근무일별 내역)를 들고 있고, 금액은 전부 합계다.
- 계산은 `calculatePayroll({ days, ... })` 한 곳에서만 한다.
  **합계 시간 하나만 넘기면 안 된다.** 연장근로는 *하루* 8시간 기준이라,
  사흘 동안 18시간 일한 사람에게 합계로 재면 하루도 초과하지 않았는데 수당이 붙는다.
- 하루라도 출퇴근이 비어 있으면 그 건은 잠정이다. (`provisionalDayCount`)
  승인 화면에서 반드시 짚어 준다.
- 근태가 바뀌면 그 사람의 **근무일 전체**를 다시 계산한다. (`syncPayrollWithAssignment`)
  바뀐 하루만 고치면 총액과 근무일별 내역이 어긋난다.
- 기간 필터는 "근무일 중 하나라도 걸치는가"로 본다.
  첫날만 보면 달을 넘겨 이어지는 행사가 조회에서 통째로 사라진다.

---

## 12-2. 평점이 아니라 좋아요 · 별로예요 ★

별점 5단계는 남기는 사람마다 기준이 달라서 — 누구의 3점은 다른 사람의 4점이다 —
모아 놓으면 평균만 남고 뜻이 사라진다. 현장에서 실제로 내리는 판단은
**"또 부를 것인가"** 하나이고, 그건 누가 눌러도 같은 뜻이다.

그래서 평가는 `ReputationVerdict`(`GOOD` · `BAD`) 하나로 받고,
왜 그렇게 봤는지는 **고르기만 하면 되는 항목**(`REPUTATION_TAGS`)으로 남긴다.
코멘트만 받으면 대부분 비워 두고, 비워 둔 평가는 나중에 아무것도 설명하지 못한다.

화면에 크게 띄우는 숫자는 `calculateReputationScore(goodCount, badCount)`가 낸
**평판 점수**다. 좋아요 비율을 그대로 쓰면 표본 수를 버려서
"1건 100%"가 "200건 95%"보다 위에 온다. 그래서 기본 비율(`BASE_GOOD_RATIO` 0.72,
5점 만점으로 3.6)에서 출발해 평가가 쌓이는 만큼만 그쪽으로 끌려가게 한다.

- 정렬 · 뱃지 색 · 배치 추천 점수가 모두 이 값을 쓴다.
- 좋아요 · 별로예요 건수는 항상 작게 함께 적는다. 점수가 왜 그 값인지 확인할 수 있어야 한다.
- **인력의 집계 건수는 배치에 붙은 평가에서만 나온다.** (`syncStaffReputationCounts`)
  따로 들고 있으면 상세의 점수와 바로 아래 평가 목록이 서로 다른 이야기를 한다.

### 평가 주체를 남기는 이유

`StaffReputation.raterType`은 지금 전부 `AGENCY`다. 그래도 자리를 비워 두지 않는다.

에이전시 · 현장 팀장이 보는 모습과 **같이 일한 스태프가 겪는 모습은 다르다.**
관리자 눈에는 일 잘하는 사람인데 옆 사람에게는 매우 불쾌한 경험을 주는 일이
실제로 자주 있고, 지금 구조로는 그게 아예 드러나지 않는다.
나중에 **스태프 상호평가**를 열면 여기에 `PEER`가 섞여 들어오고,
화면은 그때 주체별로 나눠 보여 주기만 하면 된다.

---

## 12-3. 날짜는 `toISOString()`으로 만들지 않는다 ★

`new Date("2026-05-04T00:00:00").toISOString().slice(0, 10)`은 **2026-05-03**이다.
한국은 UTC+9라 자정으로 만든 `Date`를 UTC로 바꾸면 전날 15시가 되기 때문이다.

이 한 줄 때문에 "이어지는 날인가"를 묻는 비교가 **영원히 거짓**이었고,
연일 8일짜리 행사가 캘린더에서 하루짜리 막대 여덟 개로 쪼개져 그려졌다.
계약서의 근무일도 `05-03 ~ 05-05`로 묶이지 않고 날짜를 전부 나열했다.

- `YYYY-MM-DD` 문자열이 필요하면 **`toDateKey(date)`** 를 쓴다. (`type/event.ts`)
- 다음 날 키가 필요하면 **`nextDateKey(dateString)`** 를 쓴다.
- 날짜 비교는 `YYYY-MM-DD` 문자열끼리 한다. `Date` 객체로 비교하면 시각이 섞인다.

---

## 12-4. 날짜를 넘기는 근무 (D+1 · D+2) ★

`13:00~14:00`이 한 시간짜리인지 25시간짜리인지 **시각만으로는 알 수 없다.**
방송 현장은 24시간을 통으로 넘기는 근무가 드물지 않고, 이틀을 넘기는 일도
아예 없다고는 할 수 없다.

그래서 종료가 며칠 뒤인지를 **사람이 고르는 값**(`DayOffset` 0 · 1 · 2)으로 둔다.
행사의 `endDayOffset`, 출퇴근의 퇴근 시점이 모두 같은 타입을 쓰고,
입력은 `<DayOffsetField>` 하나로만 받는다.

- 추측(`guessDayOffset`)은 **입력창의 초기값**을 정할 때만 쓴다.
  시각만 비교하는 규칙으로는 25시간 근무를 절대 표현할 수 없다.
- 시각을 나란히 적을 때는 반드시 `formatTimeRange()`를 쓴다.
  직접 `{startTime}~{endTime}`으로 적으면 날짜 넘김이 사라진다.
- 저장은 ISO 일시로 하고 화면은 `HH:mm` + D+n으로 다룬다.
  둘을 잇는 계산은 `toCheckDateTime()` · `resolveCheckOutDayOffset()` 뿐이다.
- 시간이 **밖으로 나가는 글**(공고문 · 출근 안내 문자 · 계약서)에서 특히 중요하다.
  `18:00 ~ 04:00`만 적힌 공고를 보고 지원한 사람은 당일 오전에 끝나는 줄 안다.

---

## 12-5. 사람에게 보내는 명단은 사람 단위로 ★

배치는 사람 × 날짜다. 확정 인원을 그대로 늘어놓아 단체 문자 수신 목록으로 쓰면
**사흘 나오는 사람은 같은 번호가 세 번 들어가고, 문자를 세 통 받는다.**

- 명단 · 연락처는 `confirmedRoster()`(`lib/notice.ts`)로 만든다.
  사람 단위로 묶고 기준 설정의 직무 순서로 세운다.
- 화면에 보이는 목록과 복사되는 목록은 **같은 함수**를 써야 한다.
  "79건이라 적혀 있는데 붙여넣으니 41명"이 되면 어느 쪽도 믿을 수 없다.

---

## 13. 행사 상세는 페이지다 ★

행사는 **일이 끝나는 단위**다. 일별 근무자 · 출퇴근 명부 · 근로계약서 · 정산이
전부 행사 하나에 매달려 있고, 담당자는 그 넷을 오가며 한 행사를 마무리한다.
그래서 행사 상세만 모달이 아니라 페이지(`/schedule/events/[eventId]`)로 둔다.

- 다른 메뉴(계약서 관리 · 정산 · 배치 현황)는 **여러 행사를 가로질러 볼 때** 쓴다.
  같은 데이터를 행사로 좁혀 놓은 화면이 행사 상세의 탭이다.
- 탭은 `?tab=` 쿼리로 남긴다. 새로고침 · 공유 · 다른 화면에서의 딥링크가 되어야 한다.
  (읽을 때는 `useSearchParams`, 바꿀 때는 `router.replace` + draft 패턴. 7장 참고)
- 상단 요약(확정 인원 · 계약서 · 출퇴근 · 미지급 · 마진)은 **누르면 그 일을 처리하는 탭으로** 넘긴다.
  숫자만 보여 주고 처리는 다른 메뉴에서 하게 만들면 페이지로 올린 의미가 없다.
- 탭 안의 목록은 목록 화면 표준 구조(5장)를 따르되, 행사 하나 분량이므로
  페이지네이션 대신 큰 `size`로 한 번에 받고 필요한 필터만 남긴다.

---

## 14. 완료 기준

- `npx tsc --noEmit` 통과
- `npx eslint src` 에러 0 (react-hook-form `watch()` 관련 경고는 허용)
- React Compiler 린트: **effect 안에서 setState 금지.** 7장의 draft 패턴을 쓴다
- 화면에서 목록 조회 / 생성 / 수정 / 삭제가 목업으로 실제 동작
- 로딩·빈 상태·에러 상태가 모두 표시됨
- `npm run build` 통과
- 브라우저 콘솔 에러 0 (특히 "Maximum update depth exceeded")
