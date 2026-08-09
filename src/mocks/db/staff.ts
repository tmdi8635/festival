import type {
  Gender,
  JobRole,
  StaffDetail,
  StaffMemo,
  StaffStatus,
} from "@/type/staff";
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
 * 목록 필터(등급 · 상태 · 서류 · 직무)를 모두 눈으로 확인할 수 있도록
 * 블랙리스트 · 휴면 · 서류 미제출 사례를 의도적으로 섞는다.
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

    // 노쇼 2회 이상이면 블랙리스트, 최근 6개월 무근무면 휴면으로 둔다.
    const isBlacklisted = noShowCount >= 2;
    const isDormant = !isBlacklisted && seed % 17 === 0 && workCount > 0;
    const isRetired = seed % 29 === 0 && workCount > 0;

    const status: StaffStatus = isBlacklisted
      ? "BLACKLIST"
      : isRetired
        ? "RETIRED"
        : isDormant
          ? "DORMANT"
          : "ACTIVE";

    // 신규 인력 일부는 아직 신분증 · 통장사본을 안 냈다.
    const hasIdCard = !(workCount < 3 && seed % 3 === 0);
    const hasBankBook = !(workCount < 5 && seed % 4 === 1);

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
      roles,
      region,
      district,
      isDocumentComplete: hasIdCard && hasBankBook,
      workCount,
      totalWorkHours: workCount * randomInt(seed * 67, 6, 10),
      noShowCount,
      lateCount,
      goodCount,
      badCount,
      isFavorite: workCount >= 40 && noShowCount === 0 && seed % 2 === 0,
      lastWorkedAt:
        workCount === 0
          ? undefined
          : isDormant || isRetired
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



/** 배치 · 계약 · 정산 목업이 공통으로 쓰는 조회 헬퍼 */
export const findStaff = (staffId: number) =>
  staffList.find((staff) => staff.staffId === staffId);

/** 오늘 기준으로 배치 가능한 인력만 추린다. (블랙리스트 · 활동종료 제외) */
export const assignableStaff = () =>
  staffList.filter(
    (staff) => staff.status === "ACTIVE" || staff.status === "DORMANT",
  );

/**
 * 지난 행사에 배치할 수 있었던 인력. **목업 시드 전용이다.**
 *
 * 블랙리스트와 활동종료는 앞으로 부르지 않는 사람이지, 과거에 일한 적이 없는
 * 사람이 아니다. 오히려 **일했기 때문에** 블랙리스트가 된 것이고,
 * 그 근거인 근태 · 평가 기록이 남아 있어야 블랙리스트 화면이 설득력을 갖는다.
 *
 * 이들을 지난 행사에서까지 빼 두면 "노쇼 2회인데 평가 기록은 없음"이 되어,
 * 화면이 무엇을 근거로 그 사람을 걸러 냈는지 설명하지 못한다.
 */
export const everWorkedStaff = () =>
  staffList.filter((staff) => staff.status !== "RETIRED" || staff.workCount > 0);

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
