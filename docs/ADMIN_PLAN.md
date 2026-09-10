# 관리자 프론트엔드 설계서

> `docs/PLAN.md`(기능 계획서)를 프론트엔드 관점으로 확장한 문서다.
> 메뉴 분류 기준, 라우트 구조, 화면별 책임, 목업 전략을 정의한다.

---

## 1. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router) | |
| 런타임 | React 19.2.3 | React Compiler 린트 사용 |
| 스타일 | Tailwind CSS v4 (`@theme inline`) | 설정 파일 없이 CSS 변수로 토큰 정의 |
| 서버 상태 | TanStack Query v5 | |
| 클라이언트 상태 | zustand | `useXxxStore` 네이밍 |
| HTTP | axios (인터셉터 포함 인스턴스) | `NEXT_PUBLIC_BASE_URI` |
| 폼 | react-hook-form + zod + `@hookform/resolvers` | |
| 토스트 | sonner | |
| 애니메이션 | CSS 키프레임 (`globals.css`) | 운영 도구는 모션이 최소라 별도 라이브러리를 두지 않는다 |
| 날짜 | dayjs (`relativeTime` + ko locale) | 캘린더 격자도 dayjs로 직접 계산 |
| 차트 | recharts | 대시보드 매출 추이 전용 |
| 목업 | MSW v2 | 서버 미연동 구간 전체를 목업으로 구동 |
| 폰트 | pretendard | |

캘린더는 라이브러리를 쓰지 않는다. 필요한 것이 "월 격자 + 날짜별 카드"뿐이고,
카드 안에 직무별 충원 칩을 넣어야 해서 외부 캘린더 컴포넌트의 제약이 오히려 크다.

---

## 2. 메뉴 분류 기준

좌측 메뉴는 화면 개수만큼 늘리지 않는다. 아래 기준을 고정한다.

1. **1뎁스 = 업무 흐름 단위.** 일정 → 모집 → 인사 → 계약 → 정산 순으로 실제 처리 순서를 따른다.
   "무슨 데이터냐"가 아니라 "언제 하는 일이냐"로 묶는다.
2. **2뎁스 = 사람이 앉아서 처리하는 화면 단위.** 한 화면에서 끝나는 일이 하나여야 한다.
3. **하위가 1개뿐인 도메인은 2뎁스를 만들지 않고 1뎁스 단독 메뉴로 둔다.** (대시보드 · 정산 · 거래처)
4. **외부 연동이 필요한 기능도 메뉴에 노출하되 `연동 전` 배지를 단다.**
   화면은 미리 만들어 두고, 전송 구간만 나중에 갈아 끼운다.
5. **권한이 다른 기능은 같은 도메인이어도 분리한다.** (정산의 계좌 열람 · 담당자 관리)

---

## 3. 메뉴 트리 & 라우트

| # | 1뎁스 | 2뎁스 | 라우트 | 화면 책임 |
|---|---|---|---|---|
| 1 | 대시보드 | — | `/` | 오늘 현장 · 미충원 · 밀린 계약/정산 · 할 일 목록 |
| 2 | 행사 일정 | 캘린더 | `/schedule` | 월간 · 주간 격자, 직무별 충원 칩 |
| | | 행사 목록 | `/schedule/events` | 검색 · 기간 · 미충원 필터, CSV |
| | | 배치 · 근태 현황 | `/schedule/assignments` | 사람 기준 배치 조회, 근태 · 평가 |
| 3 | 모집 | 공고 관리 | `/recruit/postings` | 공고문 자동 생성 · 복사 |
| | | 지원자 관리 | `/recruit/applications` | 확정 시 배치 자동 생성 |
| 4 | 인사관리 | 인력풀 | `/staff` | 목록 · 상세(4탭) · 등록/수정 |
| | | 서류 관리 | `/staff/documents` | 본인이 올린 신분증 · 통장사본 **승인 · 반려** |
| | | 블랙리스트 | `/staff/blacklist` | 지정 목록 + 지정 후보 |
| 5 | 근로계약 | 계약서 관리 | `/contracts` | 명단 · 전자서명 요청 · 서명본 등록 · 재작성 |
| | | 계약서 템플릿 | `/contracts/templates` | 직무별 양식 · 변수 검증 |
| 6 | 정산 | — | `/payroll` | 지급액 계산 · 조정 · 은행 이체 파일 |
| 7 | 거래처 | — | `/clients` | 청구 단가 · 마진율 |
| 8 | 공지 · 발송 | 문자 발송 | `/messages` | 대상 선정 · 변수 미리보기 (연동 전) |
| | | 발송 이력 | `/messages/history` | 언제 누구에게 무엇을 |
| | | 메시지 템플릿 | `/messages/templates` | 상황별 문구 |
| 9 | 운영 | 담당자 관리 | `/ops/managers` | 계정 · 권한 |
| | | 기준 설정 | `/ops/settings` | 시급 · 수당 · 승급 · 블랙리스트 기준 |
| | | 운영 로그 | `/ops/logs` | 변경 이력 자동 적재 |

---

## 3-1. 스태프 포털 (`/my`)

관리자의 반대쪽 절반이다. `docs/PLAN.md` 5장이 "근로자용 앱 — 다음 단계"로 미뤄 뒀던 것이고,
배포용 서버로 옮기면서 프론트 쪽을 먼저 만들었다. 라우트 그룹은 `src/app/(portal)/`이다.

| 라우트 | 화면 책임 |
|---|---|
| `/my` | 홈. 다음 근무 · 할 일(서류 반려 · 서명 대기 · 지원 결과) · 이번 달 예상 지급액 |
| `/my/schedule` | 내 일정. **예정 / 신청 / 종료** 탭. 집합 장소 · 복장 · 준비물 · 담당자 전화 · **출퇴근 체크** |
| `/postings` | 공고 열람 · 지원. **로그인 없이 열린다** (`/my` 밖에 있는 유일한 화면) |
| `/my/contracts` | 내 계약서. 전문을 읽고 **전자서명**하거나 사유를 적어 되돌려 보낸다 |
| `/my/profile` | 인적사항 수정(즉시) · 서류·계좌 제출(승인 대상) · 받은 평가 |
| `/my/payroll` | 정산 내역. 왜 이 금액인지 펼쳐 본다. 계좌는 뒤 4자리만 |

### 관리자와 갈라 두는 것

| 축 | 관리자 | 포털 |
|---|---|---|
| 주소 | `/admin/*` | `/my/*` (공고만 공개 `/postings`) |
| 신원 | `X-Admin-Id` → `findRequester()` | `X-Staff-Id` → `findStaffRequester()` |
| 판정 | `requirePermission(권한 키)` | `requireStaff()` — "본인 것인가" 하나만 본다 |
| 셸 | 사이드바 + 명령 팔레트 | 하단 탭 5개 (`constants/staffMenu.tsx`) |
| 응답 | `StaffDetail` 등 도메인 타입 | `type/my.ts`의 전용 DTO |

**`/my/*` 핸들러는 `X-Admin-Id`를 절대 보지 않는다.** 목업 관리자 계정이 늘 있어서
그 헤더는 포털에서도 함께 실려 오는데, 여기서 받기 시작하면 본인 것만 보여 줘야 할
주소가 관리자 권한으로 열린다.

**`staffId`를 쿼리로 받지 않는다.** 받는 순간 주소만 알면 남의 계좌와 평판을 꺼낼 수 있다.
남의 자료는 403이 아니라 **404**로 답한다 — 403은 "그 번호의 자료가 있긴 하다"를 알려 준다.

### 공고만 공개다

공고는 로그인하지 않아도 볼 수 있다. 처음 보는 사람에게 가입부터 시키면
어떤 일이 있는지도 모른 채 나가고, 그러면 공고를 올린 뜻이 없다.

그래서 **주소부터 `/my` 밖에 둔다.** `/my`는 "본인 것"이라는 뜻이고, 그 안에
누구나 볼 수 있는 자료를 섞으면 다음 사람이 같은 규칙으로 계좌를 붙인다.
핸들러는 `requireStaff` 대신 `findStaffRequester`를 쓴다 — 신원이 있으면
지원 여부 · 겹치는 일정까지 채우고, 없으면 공고만 내린다.

| | 비회원 | 회원 |
|---|---|---|
| 공고 목록 · 상세 | 볼 수 있다 | 볼 수 있다 |
| 지원 · 지원 취소 | 잠긴다 | 할 수 있다 |
| 내가 할 수 있는 직무만 | **스위치 자체가 없다** | 켤 수 있다 |
| 하단 탭 | 공고 하나 | 다섯 개 |

'내 직무'가 무엇인지는 등록한 사람에게만 있는 정보다. 비회원에게 스위치를
보여 주면 켤 수는 있는데 아무것도 걸러 내지 못한다.

가리는 곳은 `StaffSessionGate` **한 곳**이다. 여섯 화면에 같은 검사를 흩어 놓으면
화면이 하나 늘 때 반드시 한 곳을 빠뜨린다. 어느 주소가 공개인지는
`STAFF_MENU`의 `isPublic`이 갖는다 — 메뉴가 화면 목록의 단일 원본이라는 규칙 그대로다.

### 목록은 필수정보만, 나머지는 상세에서

공고 카드에 세우는 것은 **누를지 말지 정하는 데 필요한 것**뿐이다 —
무슨 행사인지 · 언제 · 어디서 · 얼마. 근무일 전체 · 집합 장소 · 복장 · 준비물은
상세 모달에 있다. 카드 하나에 다 적으면 한 장이 화면 두 개 높이가 되고,
그러면 두 번째 공고부터는 아무도 스크롤해서 보지 않는다.

**모집 인원은 어디에도 없다.** DTO(`MyPosting`)에 담지 않는다.
관리자 공고 제목은 `브랜드 팝업스토어 운영 · 팀장 1명`처럼 부족한 자리 수가
붙어 있는데, 그건 담당자가 무엇을 채워야 하는지 보려고 붙인 내부 표기다.
몇 자리 남았는지가 보이면 지원이 눈치 게임이 되고, 우리가 인력을 얼마나
못 채웠는지가 그대로 밖으로 나간다. 포털은 `eventTitle`을 제목으로 쓴다.

상세 모달은 공고 목록과 **일정 > 신청** 양쪽에서 같은 것을 연다.
지원한 뒤 조건을 다시 확인하려는 사람이 실제로 많은데, 그때 보는 화면이
따로 있으면 두 곳의 내용이 조금씩 어긋나기 시작한다.

### '신청'은 공고가 아니라 일정에 있다

지원한 자리도 **본인에게는 일정이다.** 공고 화면에 두면 확인하러 갈 때마다
공고를 다시 찾아 들어가야 하고, 같은 날 두 곳에 지원한 것도 눈치채지 못한다.

탭 순서는 확정될 가능성이 높은 쪽부터다 — 예정(확정) · 신청(대기) · 종료.
신청 탭에는 **검토 대기와 반려만** 남긴다. 확정된 건은 '예정'에 근무로 서 있고
(같은 일이 두 곳에 보이면 두 자리인 줄 안다), 취소한 건은 본인이 지운 것이다.

지원 취소는 **검토 대기일 때만** 뜬다. 확정된 뒤에 화면에서 혼자 빠질 수 있으면
담당자는 전날에야 사람이 사라진 것을 알게 된다.
버튼은 연한 붉은색(`variant="dangerSoft"`)이다 — 자기 지원을 무르는 일은
위험하지 않은데 삭제와 같은 무게로 칠하면 눌러도 되는지 망설이게 되고,
회색으로 두면 옆의 '상세 보기'와 구분이 안 된다.

### 계약서는 요약이 먼저다

폰에서 A4 지면을 그대로 띄우면 글자가 손톱만 해져서, 정작 확인해야 하는
근무일 · 시간 · 금액을 읽으려고 확대와 스크롤을 반복하게 된다.
그 셋은 큰 글씨로 위에 세우고, 조항 전문은 **눌러서** 지면 그대로 편다.

그래도 **서명하려면 전문이 열린다.** 서명 버튼이 지면으로 전환하고 그 아래에
서명칸을 붙인다. 조항을 접어 둔 채 받은 서명은 나중에 "그건 못 봤다"가 되고,
서명 시점 문서의 해시를 남기는 일도 읽을 기회를 안 준 상태에서는 앞뒤가 맞지 않는다.

인쇄 안내(`showPrintGuide`)는 **담당자 화면에서만 켠다.**
"A4 2장을 모두 배부하고 서명받으세요", "이 조항은 한 장을 넘깁니다"는 전부
문서를 찍어서 나눠 주는 사람에게 하는 말이라, 근로자 화면에서는
할 수 있는 일이 하나도 없는 안내가 계약 내용 위에 쌓인다.

### 목업 시드 — 데모 한 사람만 결과를 고정한다

시드는 대부분 난수(seed 기반)다. 화면마다 여러 경우가 골고루 나와야 하기 때문이다.
그런데 **포털에 처음 접속했을 때의 그 한 사람**까지 난수에 맡기면,
오늘 근무가 없고 계약서는 전부 서명완료라 화면은 멀쩡한데 눌러 볼 것이
하나도 없는 상태가 실제로 나온다.

`mocks/demo.ts`의 `DEMO_STAFF_ID`에게만 다음을 보장한다.

| 무엇 | 어디서 |
|---|---|
| 서류 승인 완료 · 직무 3개 · 블랙리스트 해제 | `db/staff.ts` |
| **지금 찍을 수 있는 오늘 근무** (30분 뒤 시작, 5시간) | `db/event.ts` |
| 서명 대기 계약서 1건 · 반려 계약서 1건 | `db/contract.ts` |
| 검토 대기 지원 2건 (서로 다른 행사) | `db/recruit.ts` |

오늘 근무는 **여는 시각을 기준으로** 만든다. 30분 뒤 시작이라 출근 창
(시작 2시간 전 ~ 종료 2시간 후)은 언제 열어도 열려 있고, 아직 시작 전이라
"일찍 찍어도 예정 시각으로 올라간다"는 고지 모달이 실제로 뜬다.

**좌표는 일부러 비운다.** 좌표를 넣으면 화면을 확인하는 사람이 그 현장에
서 있지 않는 한 출근이 막힌다. 위치 검증은 좌표가 있는 다른 행사와
기준 설정의 반경으로 확인한다.

**동적 라우트를 만들지 않는다.** 정적 내보내기라 동적 라우트마다 `generateStaticParams`가
필요하다. 공고 상세 · 계약서 상세는 모달과 `?tab=` 쿼리로 처리한다.

### 서류 승인

서류는 **신분증**과 **통장사본 + 계좌 정보** 두 갈래로 심사한다. 통장사본이 계좌번호의
근거이므로 갈라 두면 사본 없이 계좌만 승인되는 자리가 생긴다.

```
본인 제출 → SUBMITTED → 관리자 승인 APPROVED  (반려하면 REJECTED + 사유 필수)
                              ↓
        resolveStaffStatus()  →  대기중 / 활동중
        canConfirmAssignment() →  확정 배치 가능 여부
```

판정 근거는 파일 유무(`isDocumentComplete`)가 아니라 **승인 여부**(`documentReviewState`)다.
서버 세 곳이 막는다 — 배치 생성 · 배치 상태 승격 · 모집 지원 확정.

### 출퇴근 — 본인이 찍는다

기록하는 권한이 근로자에게 있고, **마지막 검증은 업체가 한다.** 관리자는 근태 모달로
언제든 시각을 고칠 수 있고, 그 경로는 그대로다.

```
근로자가 포털에서 출근 → 기록 규칙 적용 → checkInAt · attendance · checkInLocation
                              ↓
           관리자가 근태 모달에서 확인 · 수정 (규칙이 다시 걸리지 않는다)
```

**기록 규칙은 기준 설정에서 업체가 정한다** (`OperationSettings.attendance`).
출근·퇴근 각각 두 축이다.

| 축 | 값 |
|---|---|
| 기준 (`base`) | `SCHEDULE` 예정 시각으로 맞춤 / `ACTUAL` 찍은 시각 그대로 |
| 단위 보정 (`rounding` · `unit`) | 없음 / 올림 · 내림 · 반올림 × 10 · 15 · 30 · 60분 |

적용 순서는 **단위 보정 → 예정 클램프**다(`applyCheckTimeRule`). 반대로 하면 맞춰 둔 값을
다시 굴려 예정 시각에서 벗어난다. `SCHEDULE`은 **한 방향으로만** 당긴다 —
출근은 이른 것만, 퇴근은 늦은 것만. 양쪽을 다 맞추면 지각과 조퇴가 화면에서 사라진다.

**규칙은 본인이 찍는 경로에만 산다.** 관리자가 직접 적는 시각에 또 걸면
잘못 들어간 기록을 고칠 방법이 없어진다.

위치는 행사 좌표(`EventDetail.latitude` · `longitude`)와 기준 설정의 반경으로 판정한다.
**좌표가 없는 행사는 확인하지 않는다** — 좌표를 깜빡한 행사에서 전원이 못 찍으면
그 순간 현장이 멈춘다. 찍은 좌표와 거리는 `Assignment.checkInLocation`에 남는다.
막는 것이 목적이 아니라 근거를 남기는 것이 목적이다.

지각 분수(`lateMinutes`)는 **저장하지 않는다.** 늦게 온 사실은 출근 시각이 이미 말하고,
같은 사실을 두 곳에 적으면 반드시 어긋난다. 화면에 적을 때는 `resolveLateMinutes()`로 그때 구한다.

### 계약서 전자서명

종이 등록을 **대체하지 않고 나란히** 선다. `Contract`가 `signature`(전자)와
`signedFile`(종이)를 둘 다 optional로 갖고, 서명완료의 근거는 둘 중 하나라도 있으면이다.

```
관리자 발송(POST /admin/contracts/send, contract:send)
   → 계약번호 발급 + SENT
   → 본인이 /my/contracts에서 서명 → SIGNED (서명 이미지 + 문서 해시)
                          또는 반려 → REJECTED + 사유
   → 관리자가 고쳐서 다시 보내기 (같은 차수 · 같은 번호, 내용만 재조립)
```

차수(`revision`)는 **서명이 끝난 문서를 대체할 때만** 올린다. 서명 전에 고친 것은
같은 문서의 수정이라 차수를 올리지 않는다.

---

## 4. 화면 간 이동 규칙

한 화면에서 끝나지 않는 일은 **모달로 이어 붙이고 페이지를 옮기지 않는다.**
운영 도구는 맥락을 잃는 순간 손이 두 배로 든다.

**예외는 행사 상세다.** 행사는 일이 끝나는 단위이지 잠깐 들여다보는 대상이 아니다.
일별 근무자 · 출퇴근 명부 · 근로계약서 · 정산이 전부 행사 하나에 매달려 있어서
모달 한 장에 담기지 않고, 새로고침 · 공유 · 뒤로가기가 되는 주소도 있어야 한다.
그래서 행사만 페이지(`/schedule/events/[eventId]`)로 두고, 나머지는 그 위에 모달로 얹는다.

```
캘린더 ─┐
행사목록 ─┼─▶ 행사 상세 페이지 ─┬─▶ 인력 배치 모달 (후보 추천 · 중복 차단)
대시보드 ─┤   /schedule/events/  ├─▶ 근태 기록 모달
배치현황 ─┘   [eventId]?tab=…    ├─▶ 평가 모달
                                ├─▶ 계약서 상세 · 서명 모달
                                ├─▶ 지급액 조정 모달
                                └─▶ 행사 수정 폼 모달

인력풀 ────┐
서류 관리 ─┼─▶ 인력 상세 모달 ─┬─▶ 인력 수정 폼 모달
블랙리스트 ┘                  ├─▶ 블랙리스트 지정 모달
지원자 관리 ┘                 └─▶ 근무 평가 모달
```

공유되는 모달은 전부 `src/components/domain/`에 둔다.
화면별 전용 컴포넌트만 각 라우트의 `_components/`에 둔다.

---

## 5. 공통 도메인 컴포넌트

| 컴포넌트 | 역할 | 쓰이는 곳 |
|---|---|---|
| `RoleSlotChips` | 직무별 `확정/발주` 칩 | 캘린더 · 행사 목록 · 행사 상세 |
| `VerdictBadge` | 좋아요 · 별로예요 배지 | 인력 · 배치 · 명부 |
| `FavoriteToggle` | 즐겨찾기 별 토글 | 인력풀 · 인력 상세 |
| `DayOffsetField` | 종료 시점 (당일 · D+1 · D+2) | 행사 폼 · 근태 모달 |
| `StaffCell` | 표 안의 인력 한 명 (사진 · 이름 · 연락처) | 모든 인력 표 |
| `StatTile` | 지표 타일 | 대시보드 · 목록 상단 |
| `CopyButton` | 클립보드 복사 | 공고문 · 안내 문구 · 연락처 · 계약서 본문 |
| `WageText` | 지급 기준 + 금액 (`시급 12,000원` · `일급 130,000원`) | 배치 · 출퇴근 · 계약서 · 정산 · 공고 |
| `EventFormModal` | 행사 등록 · 수정 | 캘린더 · 행사 목록 · 행사 상세 |
| `StaffPickerModal` | 배치 후보 추천 · 선택 (직무 · 근무일 지정) | 행사 상세 |
| `PayrollAdjustModal` | 지급액 조정 (수당 · 차감) | 정산 · 행사 상세 |
| `ContractDetailModal` | 계약서 미리보기 · 서명 | 계약서 관리 · 인력 상세 · 행사 상세 |
| `StaffDetailModal` | 인력 상세 4탭 | 인력풀 · 서류 · 블랙리스트 · 지원자 |
| `StaffFormModal` | 인력 등록 · 수정 | 인력풀 · 서류 관리 |
| `BlacklistModal` | 사유 필수 블랙리스트 지정 | 인력풀 · 블랙리스트 |
| `ReputationModal` | 근무 평가 (좋아요 · 별로예요 + 항목) | 배치 · 출퇴근 명부 |
| `ContractAmendModal` | 중도 종료 · 계약서 재작성 | 행사 계약서 탭 · 계약서 관리 |
| `AttendanceModal` | 근태 기록 | 행사 상세 · 배치 현황 |
| `RatingModal` | 행사 후 평가 | 행사 상세 · 배치 현황 |

---

## 6. API 설계

리소스 단위로 묶고, 화면 단위로 만들지 않는다.

```
GET    /admin/dashboard/summary

GET    /admin/events/calendar?from&to        캘린더 (다일 행사는 날짜별로 펴서 응답)
GET    /admin/events                          목록
POST   /admin/events
GET    /admin/events/{id}
PUT    /admin/events/{id}
PATCH  /admin/events/{id}/status
DELETE /admin/events/{id}
GET    /admin/events/{id}/candidates?role     배치 후보 (점수순 · 중복 표시)
POST   /admin/events/{id}/assignments         배치 (여러 명 동시)

GET    /admin/assignments                     배치 현황 (사람 기준)
PATCH  /admin/assignments/{id}                상태 · 근태 · 평가
DELETE /admin/assignments/{id}

GET    /admin/staff                           인력 목록 (민감 정보 제외)
POST   /admin/staff
GET    /admin/staff/{id}                      상세 (계좌 · 서류 포함)
PUT    /admin/staff/{id}
PATCH  /admin/staff/{id}/status               블랙리스트 포함
PATCH  /admin/staff/{id}/tier
PATCH  /admin/staff/{id}/favorite
PATCH  /admin/staff/{id}/documents
POST   /admin/staff/{id}/memos
DELETE /admin/staff/{id}/memos/{memoId}
GET    /admin/staff/{id}/histories            참여 이력

GET    /admin/tier-policies
PUT    /admin/tier-policies
POST   /admin/tier-policies/promote           조건 만족자 일괄 승급

GET    /admin/contracts
POST   /admin/contracts/generate              행사 단위 일괄 생성
PATCH  /admin/contracts/status                일괄 상태 변경
GET    /admin/contracts/{id}/preview          변수 치환용 값 응답
DELETE /admin/contracts/{id}
GET    /admin/contract-templates              (POST · PUT · DELETE)

GET    /admin/payrolls
GET    /admin/payrolls/summary                목록과 같은 필터를 받는다
PATCH  /admin/payrolls/status                 일괄 승인 · 지급 완료
PATCH  /admin/payrolls/{id}                   수당 · 차감 조정

GET    /admin/postings                        (POST · PUT · PATCH status)
GET    /admin/applications                    (POST)
PATCH  /admin/applications/{id}               확정 시 배치까지 생성

GET    /admin/messages                        (POST /send)
GET    /admin/message-templates               (POST · PUT · DELETE)

GET    /admin/clients                         (POST · PUT)
GET    /admin/clients/{id}                    최근 행사 포함

GET    /admin/managers                        (POST · PUT · DELETE)
GET    /admin/logs
GET    /admin/settings                        (PUT)

POST   /admin/contracts/send                  전자서명 요청 (번호 발급 + SENT)
PATCH  /admin/staff/{id}/documents/review     서류 승인 · 반려 (반려는 사유 필수)

--- 스태프 포털 (요청자는 X-Staff-Id 하나로만 판별한다) ---

GET    /my/accounts                           계정 전환 (테스트용. 로그인이 붙으면 삭제)
GET    /my/profile                            (PUT — 인적사항, 승인 없이 즉시 반영)
PUT    /my/documents                          서류 · 계좌 제출 → 승인 대기
GET    /my/assignments?scope=UPCOMING|PAST    내 근무 (행사 정보를 합쳐 내린다)
GET    /my/payrolls                           내 정산 (계좌는 뒤 4자리만)
GET    /my/reputations                        내 평판 (항목은 보이고 담당자 메모는 없다)
GET    /postings                              OPEN 공고만. **로그인 불필요**
GET    /postings/{id}                         공고 상세 (마감된 공고도 내린다)
GET    /my/applications                       (POST — 지원 / PATCH {id}/cancel — 취소)
GET    /my/contracts                          (GET {id}/preview — 원문 + 양식)
POST   /my/contracts/{id}/sign                전자서명 제출
POST   /my/contracts/{id}/reject              반려 (사유 필수)
POST   /my/assignments/{id}/check-in          출근 (위치 · 시간 창 검증 + 기록 규칙)
POST   /my/assignments/{id}/check-out         퇴근
GET    /my/summary                            홈 화면 요약

POST   /admin/files/upload/{fileType}         multipart, file 필드
GET    /admin/search?keyword                  인력 · 행사 · 거래처 통합
```

### 응답 규칙

- 목록은 `{ content, page, size, totalCount, totalPages }`.
- 고정 개수 목록(템플릿 · 담당자)은 `{ items }`.
- 에러는 `{ code, message, fields }`. axios 인터셉터가 `AppError`로 정규화한다.
- **목록 응답에는 민감 정보를 넣지 않는다.** 계좌 · 신분증은 상세 응답에만 있다.

---

## 7. 목업(MSW) 전략

| 원칙 | 이유 |
|---|---|
| 날짜는 전부 **오늘 기준 상대값** (`dateFromToday`) | 고정 날짜를 박으면 시간이 지날수록 캘린더가 과거로 밀린다 |
| 난수는 **seed 기반** (`randomInt` · `pickOne`) | 렌더링마다 값이 바뀌면 확인이 불가능하다 |
| 시드 데이터는 **서로에게서 파생**시킨다 | 계약서 · 정산이 배치에서 나와야 화면 간 숫자가 어긋나지 않는다 |
| POST/PUT/DELETE는 **배열을 실제로 변경**한다 | 새로고침 전까지 CRUD가 진짜처럼 동작해야 한다 |
| 서버가 막아야 할 것은 **목업도 막는다** | 중복 배치 · 기본 템플릿 삭제 · 대표 계정 삭제 |

행사 목업은 오늘 기준 **−50일 ~ +40일**에 뿌린다.
지난 행사는 100% 충원 + 근태 기록이 있고, 먼 미래일수록 비어 있다.
그래야 캘린더에서 `SV 0/1`이 의미를 갖고, 정산 · 계약서 화면에도 데이터가 생긴다.

---

## 8. 서버 연동 시 바꿔야 할 곳

| 대상 | 파일 | 작업 |
|---|---|---|
| 목업 끄기 | `.env.local` | `NEXT_PUBLIC_API_MOCKING` 비우고 `NEXT_PUBLIC_BASE_URI` 교체 |
| 인증 헤더 | `src/api/index.ts`의 `onRequest` | Authorization 주입 |
| 로그인 가드 | `src/app/(admin)/layout.tsx` | 세션 확인 후 리다이렉트 |
| 로그인 사용자 | `src/store/useAdminStore.ts` | `MOCK_ADMIN` → `setAdmin` 호출로 교체 |
| 문자 발송 | `POST /admin/messages/send` | 외부 API 호출로 교체 (요청 · 응답 형태 유지) |

화면 코드는 손대지 않는다. 위 5곳만 바꾸면 그대로 동작하도록 설계했다.
