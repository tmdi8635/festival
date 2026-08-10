import type {
  Gender,
  JobRole,
  StaffDetail,
  StaffMemo,
  StaffStatus,
} from "@/type/staff";
import { REPUTATION_BASE_SCORE, resolveStaffStatus } from "@/type/staff";
import type { EmployeePosition } from "@/type/employee";
import { REGION_DISTRICTS } from "@/constants/regionOptions";
import { dateFromToday, daysAgo, pickOne, randomInt } from "../utils";

const FAMILY_NAMES = [
  "김",
  "이",
  "박",
  "최",
  "정",
  "강",
  "조",
  "윤",
  "장",
  "임",
  "한",
  "오",
  "서",
  "신",
  "권",
];

const GIVEN_NAMES = [
  "서연",
  "민준",
  "지우",
  "예린",
  "도현",
  "하윤",
  "시우",
  "수아",
  "지훈",
  "채원",
  "건우",
  "유진",
  "태윤",
  "다인",
  "현우",
  "소율",
  "준서",
  "나연",
  "은서",
  "재원",
];

/**
 * 활동 지역은 시/도 + 시·군·구 두 값으로 나뉜다.
 * 행사가 몰리는 수도권 위주로 뿌려야 배치 후보 화면이 실제처럼 읽힌다.
 */
const REGION_POOL = ["서울", "서울", "서울", "경기", "경기", "인천"];

const BANKS = ["국민", "신한", "우리", "하나", "카카오뱅크", "농협", "토스뱅크"];

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL"];

/**
 * 맡을 수 있는 직무를 정한다.
 *
 * 팀장은 현장을 여러 번 겪어 본 사람이 맡으므로 누적 근무 횟수로 가른다.
 * (예전에는 등급으로 갈랐는데, 등급제를 걷어내면서 근거가 되는 값만 남겼다)
 */
const resolveRoles = (workCount: number, seed: number): JobRole[] => {
  const roles: JobRole[] = ["STAFF"];

  if (workCount >= 15) roles.push("SUPERVISOR");

  if (seed % 7 === 0) roles.push("MC");
  if (seed % 5 === 0) roles.push("MODEL");
  if (seed % 6 === 0) roles.push("SOUND");
  if (seed % 4 === 0) roles.push("SETUP");

  return roles;
};

/** 메모 ID는 전체 인력에서 하나의 시퀀스를 쓴다. */
let memoSequence = 0;

const createMemo = (
  staffId: number,
  content: string,
  isWarning: boolean,
  daysBefore: number,
): StaffMemo => ({
  memoId: (memoSequence += 1),
  staffId,
  content,
  isWarning,
  author: "운영자",
  createdAt: daysAgo(daysBefore),
});

const POSITIVE_MEMOS = [
  "현장 정리가 빠르고 신규 인력 인수인계를 잘한다. 리더 후보로 본다.",
  "거래처 담당자가 다음에도 같은 사람으로 보내 달라고 요청했다.",
  "동선 파악이 빨라 첫 방문 현장에서도 헤매지 않는다.",
];

const WARNING_MEMOS = [
  "집합 시간 10분 지각. 다음 배치 전에 한 번 더 공지할 것.",
  "복장 규정(검정 슬랙스)을 지키지 않아 현장에서 재구매했다.",
  "휴게 시간을 초과해 사용했다는 슈퍼바이저 피드백이 있었다.",
];

/**
 * 인력 목업 62명.
 *
 * 오픈카톡방 1,500명 중 실제로 반복 투입되는 인원 규모를 가정했다.
 * 목록 필터(상태 · 서류 · 직무)를 모두 눈으로 확인할 수 있도록
 * 블랙리스트 · 서류 미제출(=대기중) 사례를 의도적으로 섞는다.
 */
export const staffList: StaffDetail[] = Array.from(
  { length: 62 },
  (_, index) => {
    const seed = index + 1;
    const staffId = seed;

    const name = `${pickOne(seed * 3, FAMILY_NAMES)}${pickOne(seed * 7, GIVEN_NAMES)}`;
    const gender: Gender = seed % 3 === 0 ? "MALE" : "FEMALE";

    // 오래된 인력일수록 근무 횟수가 많도록 index에 비례시킨다.
    const workCount =
      index < 4
        ? randomInt(seed * 11, 72, 118)
        : index < 12
          ? randomInt(seed * 11, 36, 68)
          : index < 26
            ? randomInt(seed * 11, 15, 34)
            : index < 44
              ? randomInt(seed * 11, 5, 14)
              : randomInt(seed * 11, 0, 4);

    // 노쇼는 드물어야 의미가 있다. 11명 중 1명꼴로만 만든다.
    const noShowCount = seed % 11 === 0 ? randomInt(seed * 13, 1, 3) : 0;
    const lateCount = seed % 4 === 0 ? randomInt(seed * 17, 1, 4) : 0;

    /*
      평가 건수는 여기서 정하지 않는다.

      실제 평가는 배치 한 건마다 붙는데, 그 배치는 행사 목업(`./event`)이 만든다.
      여기서 그럴듯한 숫자를 따로 지어 두면 인력 상세의 평판 점수(이 값)와
      바로 아래 평가 목록(배치에서 온 값)이 서로 다른 이야기를 한다.
      실제로 "좋아요 13 · 별로 0"이라고 적어 놓고 목록에는 별로예요가 보였다.

      그래서 0으로 두고, 행사 목업이 다 만들어진 뒤
      `syncStaffReputationCounts()`가 배치에서 세어 채운다.
    */
    const goodCount = 0;
    const badCount = 0;

    const roles = resolveRoles(workCount, seed);

    // 노쇼 2회 이상이면 블랙리스트.
    const isBlacklisted = noShowCount >= 2;

    /*
      신분증 · 통장사본.

      새로 등록된 사람만 빠뜨리는 게 아니다. 오래 안 나온 사람의 서류를
      정리하면서 지우는 일도 있어서, 근무 이력이 있는 사람 중에도
      서류가 빠진 경우를 섞어 둔다. 이들이 곧 '대기중'으로 잡힌다.
    */
    const hasIdCard = !(workCount < 3 && seed % 3 === 0) && seed % 29 !== 0;
    const hasBankBook = !(workCount < 5 && seed % 4 === 1) && seed % 17 !== 0;

    /*
      상태는 **서류가 정한다.** 여기서 직접 고르지 않는다.
      화면·핸들러와 같은 함수를 써야 "서류를 지웠는데 목록은 활동중"이 안 생긴다.
    */
    const status: StaffStatus = resolveStaffStatus({
      isDocumentComplete: hasIdCard && hasBankBook,
      employment: "FREELANCER",
      status: isBlacklisted ? "BLACKLIST" : undefined,
    });

    const birthYear = randomInt(seed * 19, 1990, 2006);
    const birthDate = `${birthYear}-${String(randomInt(seed * 23, 1, 12)).padStart(2, "0")}-${String(randomInt(seed * 29, 1, 28)).padStart(2, "0")}`;

    const region = pickOne(seed * 61, REGION_POOL);
    const district = pickOne(seed * 149, REGION_DISTRICTS[region]);

    const memos: StaffMemo[] = [];

    if (isBlacklisted) {
      memos.push(
        createMemo(
          staffId,
          "행사 당일 연락 두절. 대체 인력을 급히 투입했고 거래처 항의가 있었다.",
          true,
          randomInt(seed * 31, 20, 90),
        ),
      );
    }

    if (lateCount > 0) {
      memos.push(
        createMemo(
          staffId,
          pickOne(seed * 37, WARNING_MEMOS),
          true,
          randomInt(seed * 41, 10, 120),
        ),
      );
    }

    if (workCount >= 30) {
      memos.push(
        createMemo(
          staffId,
          pickOne(seed * 43, POSITIVE_MEMOS),
          false,
          randomInt(seed * 47, 5, 150),
        ),
      );
    }

    const staff: StaffDetail = {
      staffId,
      name,
      phoneNumber: `010${String(randomInt(seed * 53, 2000, 9999))}${String(randomInt(seed * 59, 1000, 9999))}`,
      profileImageUrl: `https://picsum.photos/seed/staff-${staffId}/200/200`,
      birthDate,
      gender,
      status,
      employment: "FREELANCER",
      roles,
      region,
      district,
      isDocumentComplete: hasIdCard && hasBankBook,
      workCount,
      totalWorkHours: workCount * randomInt(seed * 67, 6, 10),
      noShowCount,
      lateCount,
      /*
        평판 점수도 여기서 짓지 않는다. 기준점에서 시작해 두고,
        행사 목업이 만들어진 뒤 `syncStaffReputationCounts()`가
        배치에 붙은 평가에서 다시 센다.
      */
      reputationScore: REPUTATION_BASE_SCORE,
      goodCount,
      badCount,
      isFavorite: workCount >= 40 && noShowCount === 0 && seed % 2 === 0,
      /* 한참 안 나온 사람도 섞어 둬야 '최근 근무' 칸이 뜻을 갖는다. */
      lastWorkedAt:
        workCount === 0
          ? undefined
          : seed % 11 === 0
            ? daysAgo(randomInt(seed * 71, 190, 320))
            : daysAgo(randomInt(seed * 71, 1, 45)),
      createdAt: daysAgo(randomInt(seed * 73, 30, 900)),

      bankName: pickOne(seed * 79, BANKS),
      accountNumber: `${randomInt(seed * 83, 100, 999)}${randomInt(seed * 89, 100000, 999999)}${randomInt(seed * 97, 10, 99)}`,
      accountHolder: name,
      idCardImageUrl: hasIdCard
        ? `https://picsum.photos/seed/idcard-${staffId}/600/380`
        : "",
      bankBookImageUrl: hasBankBook
        ? `https://picsum.photos/seed/bankbook-${staffId}/600/380`
        : "",
      address: `${region} ${district} ${randomInt(seed * 101, 1, 90)}길 ${randomInt(seed * 103, 1, 40)}`,
      emergencyContact: `010${String(randomInt(seed * 107, 2000, 9999))}${String(randomInt(seed * 109, 1000, 9999))}`,
      height: gender === "FEMALE" ? randomInt(seed * 113, 158, 175) : randomInt(seed * 113, 170, 187),
      clothingSize: pickOne(seed * 127, CLOTHING_SIZES),
      blacklistReason: isBlacklisted
        ? "행사 당일 무단 불참(노쇼) 2회 이상 발생"
        : undefined,
      blacklistedAt: isBlacklisted
        ? daysAgo(randomInt(seed * 131, 15, 80))
        : undefined,
      totalPaidAmount: workCount * randomInt(seed * 137, 90_000, 160_000),
      memos,
    };

    return staff;
  },
);


/* ------------------------------------------------------------------ */
/* 우리 직원                                                            */
/* ------------------------------------------------------------------ */

/**
 * 에이전시 직원.
 *
 * **직원과 담당자는 같은 사람이다.** 예전에는 계정 · 권한을 가진 '담당자'와
 * 현장에 나가는 '직원'이 따로 있었는데, 둘 다 같은 사람이라 이름을 두 곳에서
 * 고쳐야 했다. 그래서 한 사람으로 합쳤다.
 *
 * 인력풀에 **함께** 넣는다. 따로 두면 배치 · 출퇴근 · 캘린더를 전부 두 벌로
 * 만들어야 한다. 다른 점은 `employment` 하나이고, 그 값이 계약서와 정산을 갈라 낸다.
 * 계정 · 권한 쪽 값(이메일 · 직책)은 `mocks/db/ops.ts`가 이 목록에서 만든다.
 *
 * 앞의 여섯은 사무실에서 행사를 굴리는 사람들이고(행사의 담당 매니저로도 뜬다),
 * 뒤의 여섯은 현장에 자주 나가는 사람들이다. 이렇게 섞어 둬야
 * 근무 집계 화면에서 "많이 뛴 사람과 거의 안 뛴 사람"이 함께 보인다.
 */
export interface EmployeeSeed {
  name: string;
  /** 회사 직책. 고정 목록에서만 고른다. (`EMPLOYEE_POSITIONS`) */
  position: EmployeePosition;
  email: string;
  /** 고정 번호. 행사의 담당 매니저 연락처와 어긋나면 안 되는 값이다. */
  phoneNumber: string;
  /** 근속 개월 수. 입사일을 여기서 만든다. */
  months: number;
  baseHours: number;
  /** 직책(권한 묶음) ID. `mocks/db/ops.ts`의 `adminRoles`와 맞춘다. */
  roleId: number;
  isActive?: boolean;
  /**
   * 근무시간 집계 대상인지. 기본값은 대상이다.
   * 대표 · 실장처럼 현장 시간으로 평가할 수 없는 자리만 꺼 둔다.
   */
  tracksWorkHours?: boolean;
}

export const EMPLOYEE_SEED: EmployeeSeed[] = [
  {
    name: "김도윤",
    position: "대표",
    email: "dy.kim@agency.co.kr",
    phoneNumber: "01033910284",
    months: 30,
    baseHours: 174,
    roleId: 1,
    /* 대표는 현장 근무시간으로 평가할 수 있는 자리가 아니다. */
    tracksWorkHours: false,
  },
  {
    name: "박서진",
    position: "실장",
    email: "sj.park@agency.co.kr",
    phoneNumber: "01048820137",
    months: 14,
    baseHours: 174,
    roleId: 2,
    tracksWorkHours: false,
  },
  {
    name: "이가온",
    position: "팀장",
    email: "gaon.lee@agency.co.kr",
    phoneNumber: "01072640918",
    months: 6,
    baseHours: 174,
    roleId: 2,
  },
  {
    name: "최유나",
    position: "사원",
    email: "yn.choi@agency.co.kr",
    phoneNumber: "01059930472",
    months: 3,
    baseHours: 174,
    roleId: 4,
  },
  {
    /* 퇴사자. 끄기만 하고 지우지 않는다는 것을 화면에서 확인할 수 있어야 한다. */
    name: "정민석",
    position: "과장",
    email: "ms.jung@agency.co.kr",
    phoneNumber: "01021170865",
    months: 18,
    baseHours: 174,
    roleId: 3,
    isActive: false,
  },
  {
    name: "한지호",
    position: "대리",
    email: "jh.han@agency.co.kr",
    phoneNumber: "01087340192",
    months: 7,
    baseHours: 174,
    roleId: 3,
  },
  {
    name: "한지섭",
    position: "실장",
    email: "js.han@agency.co.kr",
    phoneNumber: "01026205507",
    months: 71,
    baseHours: 174,
    roleId: 2,
  },
  {
    name: "오세림",
    position: "팀장",
    email: "sr.oh@agency.co.kr",
    phoneNumber: "01071362767",
    months: 46,
    baseHours: 174,
    roleId: 2,
  },
  {
    name: "배준호",
    position: "팀장",
    email: "jh.bae@agency.co.kr",
    phoneNumber: "01064468584",
    months: 38,
    baseHours: 174,
    roleId: 2,
  },
  {
    name: "문가율",
    position: "대리",
    email: "gy.moon@agency.co.kr",
    phoneNumber: "01033922477",
    months: 25,
    baseHours: 174,
    roleId: 2,
  },
  {
    name: "심우빈",
    position: "주임",
    email: "wb.shim@agency.co.kr",
    phoneNumber: "01062355160",
    months: 14,
    baseHours: 174,
    roleId: 4,
  },
  {
    /* 육아 단축근무. 기준 시간이 사람마다 다를 수 있다는 것을 화면에서 보여 준다. */
    name: "노아린",
    position: "사원",
    email: "ar.noh@agency.co.kr",
    phoneNumber: "01056924435",
    months: 8,
    baseHours: 120,
    roleId: 4,
  },
];

/**
 * 행사의 담당 매니저로 뜨는 직원.
 *
 * 행사 목업이 이 목록에서 이름 · 번호를 가져간다. 따로 적어 두면
 * 문자의 `{{담당자연락처}}`와 직원 명부의 번호가 서로 다른 값이 된다.
 */
export const EVENT_MANAGER_POOL = EMPLOYEE_SEED.slice(0, 3);

const employees: StaffDetail[] = EMPLOYEE_SEED.map((employee, index) => {
  const seed = 1000 + index;
  const staffId = staffList.length + index + 1;
  const gender: Gender = index % 2 === 0 ? "MALE" : "FEMALE";
  const region = pickOne(seed * 61, REGION_POOL);
  const district = pickOne(seed * 149, REGION_DISTRICTS[region]);

  return {
    staffId,
    name: employee.name,
    phoneNumber: employee.phoneNumber,
    profileImageUrl: `https://picsum.photos/seed/staff-${staffId}/200/200`,
    birthDate: `${randomInt(seed * 19, 1986, 1999)}-${String(randomInt(seed * 23, 1, 12)).padStart(2, "0")}-${String(randomInt(seed * 29, 1, 28)).padStart(2, "0")}`,
    gender,
    /* 직원은 입사할 때 회사가 서류를 받았다. 인력풀 상태는 늘 활동중이다. */
    status: "ACTIVE" as StaffStatus,
    employment: "EMPLOYEE",
    /*
      직무 목록은 비워 둔다.

      직원은 대행사가 주는 자리에 따라 어디에나 들어가므로 "가능 직무"라는 조건이
      뜻을 갖지 못한다. 그래서 후보 조회에서 직무 조건 자체를 건너뛴다.
      (`mocks/handlers/event.ts`의 후보 필터)
      여기에 전 직무를 적어 두면, 나중에 직무를 하나 추가한 날 직원만 조용히 빠진다.
    */
    roles: [],
    region,
    district,
    /*
      직원 서류는 입사할 때 회사가 이미 받았다.
      인력풀 기준으로는 미제출이지만, 확정 배치는 막히지 않는다.
      (`canConfirmAssignment` — 직원은 서류 검사를 받지 않는다)
    */
    isDocumentComplete: true,
    workCount: randomInt(seed * 11, 20, 90),
    totalWorkHours: randomInt(seed * 13, 400, 2200),
    noShowCount: 0,
    lateCount: 0,
    reputationScore: REPUTATION_BASE_SCORE,
    goodCount: 0,
    badCount: 0,
    isFavorite: false,
    lastWorkedAt: daysAgo(randomInt(seed * 71, 1, 20)),
    createdAt: daysAgo(employee.months * 30),

    bankName: pickOne(seed * 79, BANKS),
    accountNumber: `${randomInt(seed * 83, 100, 999)}${randomInt(seed * 89, 100000, 999999)}${randomInt(seed * 97, 10, 99)}`,
    accountHolder: employee.name,
    idCardImageUrl: `https://picsum.photos/seed/idcard-${staffId}/600/380`,
    bankBookImageUrl: `https://picsum.photos/seed/bankbook-${staffId}/600/380`,
    address: `${region} ${district} ${randomInt(seed * 101, 1, 90)}길 ${randomInt(seed * 103, 1, 40)}`,
    emergencyContact: `010${String(randomInt(seed * 107, 2000, 9999))}${String(randomInt(seed * 109, 1000, 9999))}`,
    height: gender === "FEMALE" ? randomInt(seed * 113, 158, 175) : randomInt(seed * 113, 170, 187),
    clothingSize: pickOne(seed * 127, CLOTHING_SIZES),
    totalPaidAmount: 0,
    memos: [],

    position: employee.position,
    hireDate: daysAgo(employee.months * 30).slice(0, 10),
    baseMonthlyHours: employee.baseHours,
  };
});

staffList.push(...employees);

/** 배치 · 계약 · 정산 목업이 공통으로 쓰는 조회 헬퍼 */
export const findStaff = (staffId: number) =>
  staffList.find((staff) => staff.staffId === staffId);

/** 우리 직원만. 운영 > 직원 관리가 쓴다. */
export const employeeStaff = () =>
  staffList.filter((staff) => staff.employment === "EMPLOYEE");

/**
 * 오늘 기준으로 배치 가능한 인력. (블랙리스트 제외)
 *
 * 대기중도 넣는다. 서류가 없으면 **확정**만 막히고 제안 · 대기로는 담을 수 있다.
 * 여기서 빼 버리면 새 인력을 부를 방법 자체가 없어진다. (`canConfirmAssignment`)
 */
export const assignableStaff = () =>
  staffList.filter((staff) => staff.status !== "BLACKLIST");

/**
 * 지난 행사에 배치할 수 있었던 인력. **목업 시드 전용이다.**
 *
 * 블랙리스트도 넣는다. 앞으로 부르지 않는 사람이지 과거에 일한 적이 없는
 * 사람이 아니다. 오히려 **일했기 때문에** 블랙리스트가 된 것이고,
 * 그 근거인 근태 · 평가 기록이 남아 있어야 블랙리스트 화면이 설득력을 갖는다.
 *
 * 대기중도 마찬가지다. 서류를 지우면 대기중으로 내려가지만 지난 근무는 남는다.
 */
export const everWorkedStaff = () => staffList;

/** 서류 미제출 인력. 대시보드 할 일 목록에 올라간다. */
export const staffMissingDocuments = () =>
  staffList.filter(
    (staff) => !staff.isDocumentComplete && staff.status === "ACTIVE",
  );

/** 최근 등록된 인력 순으로 정렬한 목록 (목록 화면 기본 정렬) */
export const sortedStaff = () =>
  [...staffList].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** 시드 데이터 생성 시점 기준 오늘 날짜 (행사 목업이 함께 참조한다) */
export const TODAY = dateFromToday(0);
