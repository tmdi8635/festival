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
| | | 서류 관리 | `/staff/documents` | 신분증 · 통장사본 미제출 추적 |
| | | 블랙리스트 | `/staff/blacklist` | 지정 목록 + 지정 후보 |
| 5 | 근로계약 | 계약서 관리 | `/contracts` | 일괄 생성 · 발송 · 서명 처리 |
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
