# 디자인 시스템

> 모든 화면은 이 문서의 규칙만 조합해서 만든다.
> 새로운 색·간격·모서리·그림자 값을 화면에서 직접 만들어 쓰지 않는다.
> 토큰 정의는 `src/app/globals.css`, 컴포넌트는 `src/components/ui/`에 있다.

---

## 1. 색상 토큰

Tailwind v4 `@theme inline`으로 CSS 변수를 유틸리티 클래스에 매핑하므로,
화면에서는 **항상 시맨틱 클래스**를 쓴다.

| 용도 | 클래스 | 라이트 | 다크 |
|---|---|---|---|
| 브랜드 | `text-brand` `bg-brand` | `#4f46e5` | `#7c74f2` |
| 브랜드 hover | `bg-brand-hover` | `#4338ca` | `#8d86f5` |
| 브랜드 배경(약) | `bg-brand-opacity` | 10% | 14% |
| 페이지 타이틀 | `text-font-0` | `#0b0d17` | `#f5f6fa` |
| 본문 | `text-font-1` | `#1a1d29` | `#ecedf5` |
| 보조 설명 | `text-font-2` | `#5a6072` | `#989db8` |
| 비활성 | `text-font-disabled` | `#a1a7b8` | `#5c6180` |
| 반전(브랜드 위) | `text-font-4` | `#ffffff` | `#0d0e11` |
| 경계선 | `border-border-main` | `#e5e7ec` | `#262a3d` |
| 강한 경계선 | `border-border-strong` | `#d3d7e0` | `#343a52` |
| 워크스페이스 배경 | `bg-bg-base` | `#f6f7f9` | `#0e1018` |
| 카드/사이드바 | `bg-surface` | `#ffffff` | `#151827` |
| 카드 hover | `bg-surface-hover` | `#f2f3f7` | `#1c2032` |
| 선택 상태 | `bg-surface-selected` | `#eceefb` | `#232746` |
| 테이블 헤더 | `bg-subtle` | `#f9fafb` | `#191d2d` |

**상태 색상** — 성공 `success`, 경고 `warning`, 위험 `danger`, 정보 `info`,
중립 `neutral`. 각각 `text-*` / `bg-*-bg` 쌍으로 쓴다.

### 1.1 상태 색 의미 고정

이 도구에서 색은 장식이 아니라 **판단 신호**다. 아래 대응을 화면마다 바꾸지 않는다.

| 상황 | 색 | 쓰이는 곳 |
|---|---|---|
| 사람이 아예 없다 · 노쇼 · 계약서 미완료 · 계좌 미등록 | `danger` | 캘린더 칩, 배치 현황, 정산 |
| 인원이 부족하다 · 지각 · 서류 미제출 · 미지급 | `warning` | 캘린더 칩, 서류 관리, 정산 |
| 채워졌다 · 정상 출근 · 서명 완료 · 지급 완료 | `success` | 전 화면 |
| 초과 배치 · 대기 인력 · 발송됨 | `info` | 배치, 계약서 |
| 진행 중 · 모집중 공고 | `brand` | 행사 상태 |

충원 상태 색은 `FILL_STATE_*` 상수(`src/constants/eventOptions.ts`)로만 쓴다.
캘린더 · 행사 목록 · 행사 상세가 같은 색을 써야 한 눈에 읽힌다.

금지: `text-gray-500`, `bg-white`, `border-gray-200` 같은 Tailwind 기본 팔레트
직접 사용. 다크 테마에서 깨진다.

---

## 2. 타이포그래피

`letter-spacing: -0.025em`, `line-height: 1.4`는 `body`에 전역 적용되어 있다.

| 역할 | 클래스 |
|---|---|
| 페이지 타이틀 | `text-[28px] font-bold text-font-0` |
| 페이지 설명 | `text-[14px] text-font-2` |
| 섹션 타이틀 | `text-[17px] font-semibold text-font-0` |
| 카드 타이틀 | `text-[15px] font-semibold text-font-1` |
| 본문 | `text-[14px] text-font-1` |
| 보조/캡션 | `text-[13px] text-font-2` |
| 표 헤더 | `text-[13px] font-medium text-font-2` |
| 숫자 지표 | `text-[26px] font-bold text-font-0 tabular-nums` |

숫자를 세로로 정렬해야 하는 곳(표의 금액·수량, 지표)은 반드시 `tabular-nums`.

---

## 3. 간격 스케일

4의 배수만 쓴다. 화면에서 임의 값(`p-[13px]`)을 만들지 않는다.

| 위치 | 값 |
|---|---|
| 페이지 좌우 패딩 | `px-8` (32px) |
| 페이지 상하 패딩 | `py-7` (28px) |
| 카드 내부 패딩 | `p-5` (20px) / 밀집형 `p-4` |
| 카드 사이 간격 | `gap-4` (16px) |
| 섹션 사이 간격 | `gap-6` (24px) |
| 폼 필드 사이 | `gap-4` |
| 인라인 요소 사이 | `gap-2` (8px) |
| 표 셀 패딩 | `px-4 py-3.5` |

---

## 4. 모서리 / 그림자

깊이는 **표면 계층 순서로만** 커진다. 같은 계층에 다른 그림자를 섞지 않는다.

| 계층 | 모서리 | 그림자 |
|---|---|---|
| 입력/버튼/뱃지 | `rounded-field` (10px) | 없음 |
| 카드/패널/표 | `rounded-card` (14px) | `shadow-card` |
| 드롭다운/툴팁/토스트 | `rounded-field` | `shadow-popover` |
| 모달/다이얼로그 | `rounded-modal` (18px) | `shadow-modal` |

카드는 `border border-border-main` + `shadow-card`를 **함께** 쓴다.
그림자만으로 경계를 만들지 않는다(다크 테마에서 안 보임).

---

## 5. 인터랙션 (hover / focus / active / disabled)

전역 `--default-transition-duration: 0.2s`가 적용되어 있다.
전환은 `transition` 또는 `transition-colors`만 쓰고 duration을 임의 지정하지 않는다.

### 5.1 규칙

| 상태 | 규칙 |
|---|---|
| 클릭 가능 | `cursor-pointer` **필수**. `button`은 전역 CSS로 이미 적용됨. `div`/`tr`/`label`을 클릭 대상으로 쓸 땐 직접 명시 |
| hover | 배경 한 단계 진하게(`hover:bg-surface-hover`) 또는 브랜드 계열 `hover:bg-brand-hover`. **크기 변경 금지** |
| active | `active:scale-[0.98]` — 버튼과 카드형 클릭 대상에만 |
| focus | 전역 `:focus-visible` 링을 그대로 사용. 개별 `focus:ring` 재정의 금지 |
| focus (입력) | `focus:border-brand focus:ring-2 focus:ring-brand-opacity`. **`input`/`textarea`/`select`의 브라우저 outline은 전역에서 꺼 두었다.** 컴포넌트의 테두리+ring과 겹쳐 링이 두 겹으로 보이기 때문이다 |
| disabled | `disabled:cursor-not-allowed disabled:opacity-50`. 색을 따로 바꾸지 않는다 |
| 선택됨 | `bg-surface-selected text-brand` (사이드바·탭·슬롯 공통) |

### 5.2 카드형 클릭 대상

```
"cursor-pointer transition hover:border-brand hover:shadow-card-hover active:scale-[0.99]"
```

### 5.3 표 행

```
"transition-colors hover:bg-surface-hover"
```
행 전체가 클릭 가능하면 `cursor-pointer`를 함께 준다.

---

## 6. 애니메이션

과한 모션을 쓰지 않는다. 아래 4가지 외에는 추가하지 않는다.

| 이름 | 용도 | 값 |
|---|---|---|
| `animate-fade-in` | 콘텐츠 최초 등장 | opacity 0→1, 0.2s |
| `animate-slide-up` | 모달·드롭다운·토스트 등장 | translateY 8px→0, 0.2s |
| `skeleton` | 로딩 플레이스홀더 | shimmer 1.4s infinite |
| `grid-template-rows` 전환 | 사이드바 서브메뉴 펼침 | `grid-rows-[0fr]` ↔ `grid-rows-[1fr]`, 0.2s |

- 페이지 전환 애니메이션은 넣지 않는다(운영 도구는 즉시성이 우선).
- **admin은 framer-motion을 쓰지 않는다.** 아래 두 문제를 겪고 전부 CSS로 옮겼고,
  현재 의존성에서도 제거된 상태다. 다시 도입하려면 이 항목을 먼저 확인한다.
- **접힘/펼침에 `height: "auto"` 애니메이션을 쓰지 않는다.**
  높이를 직접 측정하는 방식이라 목록 개수가 바뀔 때 내용이 잘린다.
  대신 `grid-template-rows` 전환을 쓴다(`Sidebar.tsx` 참고).
- **모달·드롭다운에 `AnimatePresence`를 쓰지 않는다.**
  exit 애니메이션이 끝나도 포털 안의 노드가 언마운트되지 않는 경우가 있고,
  그러면 `opacity: 0`인 오버레이가 화면에 남아 페이지 전체의 클릭을 막는다.
  등장은 CSS 키프레임(`animate-fade-in` / `animate-slide-up`), 종료는 즉시 제거로 처리한다.
  (`Modal.tsx`, `Dropdown.tsx` 참고)

---

## 7. 컴포넌트 규격

### 7.1 Button

| variant | 용도 | 스타일 |
|---|---|---|
| `primary` | 저장·생성 등 주요 행동 | `bg-brand text-font-4 hover:bg-brand-hover` |
| `secondary` | 보조 행동 | `bg-surface border border-border-main hover:bg-surface-hover` |
| `ghost` | 표 안 아이콘 버튼, 취소 | `hover:bg-surface-hover` |
| `danger` | 삭제·차단 | `bg-danger text-white hover:opacity-90` |
| `dangerGhost` | 표 안 삭제 | `text-danger hover:bg-danger-bg` |

| size | 높이 | 패딩 | 폰트 |
|---|---|---|---|
| `sm` | 32px | `px-3` | 13px |
| `md` | 40px | `px-4` | 14px |
| `lg` | 48px | `px-6` | 15px |

공통: `rounded-field font-medium transition active:scale-[0.98]`,
로딩 중에는 스피너를 좌측에 두고 `disabled` 처리.
**한 화면에 primary 버튼은 하나만.**

### 7.2 Card / Box

```
"rounded-card border border-border-main bg-surface shadow-card"
```
헤더가 있으면 `px-5 py-4 border-b border-border-main`, 본문은 `p-5`.

### 7.3 Table

- 컨테이너는 Card 규격. 표 자체는 `w-full text-[14px]`
- 헤더: `bg-subtle text-font-2 text-[13px] font-medium`, 셀 `px-4 py-3`
- 행: `border-t border-border-main`, `hover:bg-surface-hover`
- 빈 상태는 표 안에서 `EmptyState`로 대체한다
- 로딩은 행 개수만큼 `skeleton` 행을 보여준다(레이아웃 점프 방지)

### 7.4 Modal

- 오버레이 `bg-overlay backdrop-blur-[2px]`, `animate-fade-in`
- 패널 `rounded-modal bg-surface shadow-modal animate-slide-up`
- 너비: `sm` 400 / `md` 520 / `lg` 720 / `xl` 960
- 구조 고정: 헤더(타이틀 + 닫기) → 본문(`max-h-[70vh] overflow-y-auto scrollbar-thin`) → 푸터(우측 정렬, 취소 → 확인 순)
- ESC / 오버레이 클릭으로 닫힌다. **파괴적 작업 모달은 오버레이 클릭으로 닫지 않는다.**

### 7.5 ConfirmDialog

파괴적 작업(삭제, 블랙리스트 지정, 행사 취소, 지급 완료 처리)은 반드시 확인 다이얼로그를 거친다.

- `tone`: `danger` | `default`
- 본문에 **대상 이름을 명시**한다. ("'김서연'님을 배치 대상에서 제외합니다.")
- 되돌릴 수 없는 작업은 경고 문구를 `text-font-error`로 추가한다.
- 확인 버튼 문구는 "삭제", "블랙리스트 지정"처럼 **동작 이름**을 쓴다. "확인" 금지.
- 되돌리기 어려운 작업은 `warning`에 **그래서 무엇을 먼저 해야 하는지**를 적는다.
  ("이체를 먼저 끝낸 뒤 눌러 주세요.")

### 7.6 Alert (인라인 배너)

화면 상단에 상시 노출되는 안내. 토스트와 역할이 다르다.

| tone | 용도 |
|---|---|
| `info` | 기능 설명, 연동 전 안내 |
| `warning` | 주의가 필요한 상태 |
| `danger` | 실패·장애 |
| `success` | 완료 상태 |

`rounded-field border px-4 py-3 text-[13px]` + 좌측 아이콘 + `bg-*-bg`.

### 7.7 Toast (Stack Alarm)

- `sonner` 단일 창구. `showAppToast(type, message, { description })`로만 호출한다.
- 위치 `top-center`, 동시 노출 **최대 3개**, 3초 후 자동 소멸, 닫기 버튼 상시.
- **비동기 작업 결과는 전부 토스트로 알린다.** 성공도 예외 없이 알린다.
- 폼 검증 오류는 토스트가 아니라 필드 하단 메시지로 표시한다.

### 7.8 Badge

`rounded-full px-2.5 py-1 text-[12px] font-medium` + `bg-*-bg text-*`
상태 표기 전용. 클릭 가능한 요소로 쓰지 않는다.

### 7.9 ImageUploadField

이미지를 받는 곳은 **URL 입력창을 만들지 않고 반드시 이 컴포넌트를 쓴다.**

- 클릭 선택 + 드래그앤드롭 둘 다 지원한다.
- 파일을 고르면 즉시 업로드하고, 받은 URL을 `onChange`로 넘긴다.
  폼은 URL 문자열만 다루므로 스키마는 `z.string().min(1)`이면 된다.
- 업로드 전: 점선 테두리 빈 상태 + 허용 형식·용량 안내.
  업로드 중: 스피너. 업로드 후: 미리보기 위에 `변경` / `삭제` 버튼.
- 검증은 컴포넌트가 한다 — JPG·PNG·WEBP, 10MB 이하. 위반 시 토스트로 알리고 요청을 보내지 않는다.
- `aspectRatio`로 미리보기 비율을 맞춘다(프로필 `1 / 1`, 신분증·통장사본 `16 / 10`).

### 7.10 EmptyState

아이콘(40px, `text-font-disabled`) + 제목(14px) + 설명(13px) + 선택적 CTA.
"데이터가 없습니다"로 끝내지 않고 **다음 행동**을 제시한다.

---

## 8. 레이아웃 규격

```
┌──────────────┬───────────────────────────────────────┐
│  Sidebar     │  Header (48px)                        │
│  260px       ├───────────────────────────────────────┤
│  bg-surface  │  Workspace (bg-bg-base, 스크롤 영역)   │
│  1·2뎁스     │    PageHeader                         │
│              │    Content                            │
└──────────────┴───────────────────────────────────────┘
```

- 전체 높이 고정(`html, body { overflow: hidden }`), **워크스페이스만 스크롤**한다.
- 사이드바 260px 고정, 접으면 68px(아이콘만).
- 캘린더는 7열 격자를 고정하고, 월간은 칸 최소 높이 `min-h-28`, 주간은 `min-h-56`.
- 콘텐츠 최대 폭 제한 없음(표 중심 화면이 많음).
- `PageHeader`: 타이틀 + 설명 + 우측 액션 슬롯. 모든 페이지가 사용한다.

---

## 9. 사이드바 상태 규칙

| 상태 | 스타일 |
|---|---|
| 1뎁스 기본 | `text-font-1 hover:bg-surface-hover` |
| 1뎁스 활성(하위 포함) | `text-brand font-semibold` |
| 2뎁스 기본 | `text-font-2 hover:bg-surface-hover hover:text-font-1` |
| 2뎁스 활성 | `bg-surface-selected text-brand font-semibold` |
| 연동 전 배지 | `Badge tone="neutral"` |

- 현재 경로가 속한 1뎁스는 **자동으로 펼쳐진다.**
- 펼침 상태는 `useSidebarStore`(zustand)에 저장해 라우팅 간 유지한다.

---

## 10. 폼 규칙

- `react-hook-form` + `zod`(`@hookform/resolvers`) 조합만 사용한다.
- 스키마는 `src/schema/`에 도메인별로 둔다.
- 필수 항목은 라벨 우측에 `*`(`text-font-error`).
- 에러는 필드 하단 `text-[12px] text-font-error`, 레이아웃이 밀리지 않게 높이를 예약한다.
- 저장 버튼은 `isSubmitting` 동안 로딩 + `disabled`.
- 값이 바뀌지 않았으면 저장 버튼을 `disabled` 처리한다.

---

## 움직임 (transition · animation)

움직임은 **무슨 일이 일어났는지 알려 줄 때만** 쓴다. 장식으로 넣으면
하루에 수십 번 여는 화면에서 그 0.2초가 매번 기다림이 된다.

| 자리 | 표현 | 이유 |
|---|---|---|
| 목록 · 경고가 처음 그려질 때 | `.animate-rise` (0.18s) | 스켈레톤에서 자료로 툭 끊기면 "화면이 튀었다"로 읽힌다 |
| 접기 · 펴기 | `.collapsible` + `data-folded` | 바로 사라지면 무슨 일인지 다시 확인하게 된다 |
| 모달 | `.animate-fade-in` · `.animate-slide-up` | 어디서 열렸는지 |
| 상태 배지 | `transition-colors` | 같은 자리에서 색만 바뀌면 눈이 놓친다 |
| 누를 수 있는 카드 | `hover:-translate-y-px` + `hover:shadow-card` | **누를 수 있다는 신호**. 누를 수 없는 카드는 움직이지 않는다 |
| 버튼 | `active:scale-[0.98]` | 눌렸다는 확인 |

- 접힘 높이는 `max-height`로 흉내 내지 않는다. 내용이 그보다 길면 잘리고,
  짧으면 펴지는 속도가 내용 길이마다 달라진다. grid의 `1fr ↔ 0fr`을 쓴다.
- **`prefers-reduced-motion`에서는 전부 끈다.** 장식은 접근성보다 뒤에 온다.
  (`globals.css`에 전역으로 걸려 있다)
