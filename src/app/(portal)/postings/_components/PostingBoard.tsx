"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMyPostingListQuery } from "@/api/my/getMyRecruit";
import { useMyProfileQuery } from "@/api/my/getMyProfile";
import { APPLICATION_STATUS_TONE } from "@/constants/recruitOptions";
import { Calendar, ChevronRight, Close, MapPin } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { useStaffSessionStore } from "@/store/useStaffSessionStore";
import { WAGE_TYPE_LABEL, formatTimeRange, toDateKey } from "@/type/event";
import type { MyPosting } from "@/type/my";
import { APPLICATION_STATUS_LABEL } from "@/type/recruit";
import { hasValidHealthCert, type Gender } from "@/type/staff";
import type { SelectOption } from "@/components/ui";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import Switch from "@/components/ui/Switch";
import PostingDetailModal from "@/app/(portal)/_components/PostingDetailModal";

/**
 * 비회원의 성별 선택지. **'그 성별이 지원할 수 있는 공고'** 라는 뜻이다.
 * '남성'이라고만 적으면 남성만 뽑는 공고로 읽혀, 성별 무관 공고가 사라진 줄 안다.
 */
const GUEST_GENDER_OPTIONS: SelectOption[] = [
  { label: "성별 전체", value: "" },
  { label: "남성 지원 가능", value: "MALE" },
  { label: "여성 지원 가능", value: "FEMALE" },
];

/** 카드에 세우는 포지션 수. 넘치면 "외 N개"로 줄이고 상세에서 전부 본다 */
const VISIBLE_POSITION_COUNT = 3;

/** 근무일이 여러 날이면 "09.12 외 2일"로 줄인다. 카드에 열 줄을 세울 수 없다. */
const describeWorkDates = (workDates: string[]): string => {
  if (workDates.length === 0) return "-";

  const first = formatDate(workDates[0]);

  return workDates.length === 1 ? first : `${first} 외 ${workDates.length - 1}일`;
};

interface PostingCardProps {
  posting: MyPosting;
  /** 조건 토글. 켜져 있으면 내가 설 수 없는 자리는 카드에서 뺀다 */
  onlyMine: boolean;
  onOpen: (posting: MyPosting) => void;
}

/**
 * 공고 한 장 = **행사 하나.**
 *
 * 예전에는 공고가 행사 × 직무라 한 행사가 '팀장 공고' · '스태프 공고'로 쪼개져 섰다.
 * 같은 행사가 두 줄 서면 다른 일인 줄 알고 둘 다 지원한다. 지금은 행사 한 장에
 * 포지션(시간대 · 금액)을 몰아 적고, 지원은 상세에서 포지션을 골라 한다.
 *
 * 모집 인원은 적지 않는다. 응답에 아예 없다(`MyPosting`).
 */
const PostingCard = ({ posting, onlyMine, onOpen }: PostingCardProps) => {
  /*
    조건 토글이 켜져 있으면 **내가 설 수 없는 자리는 아예 빼고** 보여 준다.
    공고 단위로만 걸러 두면, 스태프 자리가 하나 있다는 이유로 나머지가 전부
    남아 토글을 켜도 화면이 그대로다. 사람들이 안 보고 싶은 것은 공고가 아니라
    지원할 수 없는 자리 쪽이다. (왜 안 되는지는 상세에서 줄마다 말해 준다)
  */
  const listedPositions = useMemo(
    () =>
      onlyMine
        ? posting.positions.filter((position) => position.matchesMe)
        : posting.positions,
    [onlyMine, posting.positions],
  );
  const visiblePositions = listedPositions.slice(0, VISIBLE_POSITION_COUNT);
  const hiddenCount = listedPositions.length - visiblePositions.length;

  return (
    <button
      type="button"
      onClick={() => onOpen(posting)}
      className="flex w-full items-center gap-3 rounded-card border border-border-main bg-surface p-5 text-left shadow-card transition hover:-translate-y-px hover:border-brand hover:shadow-card-hover active:scale-[0.99]"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-2.5">
        {/*
          조건 배지(보건증 · 성별)는 카드에서 뺐다.

          공고 단위로 뭉치면 '일부 남성만'처럼 무엇에 걸린 조건인지 알 수 없는
          말이 되고, 정작 그 자리를 못 서는 사람에게도 설 수 있는 사람에게도
          아무 판단을 주지 않는다. 조건은 자리에 붙는 것이라 상세에서 줄마다 본다.
          카드에 남기는 것은 **내가 이미 지원했는가** 하나뿐이다.
        */}
        <span className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="min-w-0 truncate text-[15px] font-semibold text-font-0">
              {posting.title}
            </span>
            <span className="min-w-0 truncate text-[13px] text-font-2">
              {posting.clientName}
            </span>
          </span>

          {posting.isApplied && posting.applicationStatus && (
            <Badge
              tone={APPLICATION_STATUS_TONE[posting.applicationStatus]}
              className="shrink-0"
            >
              지원함 · {APPLICATION_STATUS_LABEL[posting.applicationStatus]}
            </Badge>
          )}
        </span>

        <span className="flex flex-col gap-1 text-[13px] text-font-1">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} className="shrink-0 text-font-disabled" />
            <span className="min-w-0 truncate tabular-nums">
              {describeWorkDates(posting.workDates)}
            </span>
          </span>

          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="shrink-0 text-font-disabled" />
            <span className="min-w-0 truncate">{posting.venue}</span>
          </span>
        </span>

        {/* 포지션 요약 — 이름 · 시간대 · 금액. 같은 행사라도 시간대마다 금액이 다르다. */}
        <span className="flex flex-col gap-1 rounded-field bg-subtle px-3 py-2">
          {visiblePositions.map((position) => (
            <span
              key={position.positionId}
              className="flex items-baseline justify-between gap-3 text-[13px]"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-font-1">{position.name}</span>{" "}
                <span className="text-font-2 tabular-nums">
                  {formatTimeRange(
                    position.startTime,
                    position.endTime,
                    position.endDayOffset,
                  )}
                </span>
              </span>
              {/*
                **단가만 적는다.** (시급 · 일급) 하루 얼마는 근무시간 · 휴게에 따라
                같이 바뀌는 값이라 자리끼리 비교가 안 되고, 목록에서는 숫자만 하나 더 늘린다.
                사람들이 실제로 비교하는 것은 시급이다.
              */}
              <span className="shrink-0 text-right text-font-1 tabular-nums">
                <span className="text-[12px] text-font-2">
                  {WAGE_TYPE_LABEL[position.wageType]}
                </span>{" "}
                {formatCurrency(position.wage)}
              </span>
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="text-[12px] text-font-2">외 포지션 {hiddenCount}개</span>
          )}
        </span>
      </span>

      <ChevronRight size={16} className="shrink-0 text-font-disabled" />
    </button>
  );
};

/**
 * 공고 열람 · 지원.
 *
 * **로그인하지 않아도 열린다.** 비회원에게는 공고만 보이고, 지원과
 * '내가 할 수 있는 직무만'은 잠긴다 — 무엇이 내 직무인지는 등록한 사람에게만
 * 있는 정보라, 켤 수 있는 것처럼 보여 놓고 아무것도 걸러 내지 못한다.
 *
 * 성별은 **회원이면 서버가 본인 성별로 거른다.** 고를 수 있게 두면 남성 회원이
 * '여성만'을 골라 지원 버튼이 전부 잠긴 목록을 보게 된다. 대신 무엇으로 걸렀는지를
 * 한 줄로 알린다 — 말없이 거르면 공고가 적은 이유를 모른다.
 * 비회원은 성별을 모르므로 직접 고른다. (고르지 않으면 전부)
 */
const PostingBoard = () => {
  const staffId = useStaffSessionStore((state) => state.staffId);
  const isGuest = staffId === null;

  const [onlyMyRoles, setOnlyMyRoles] = useState(false);
  const [excludeConflicts, setExcludeConflicts] = useState(false);
  const [guestGender, setGuestGender] = useState<Gender | "">("");
  const [workDate, setWorkDate] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  /** 오늘. 지난 날은 지원할 수 없어서 달력에서 막는다 */
  const today = toDateKey(new Date());

  const { data: profile } = useMyProfileQuery();
  const { data, isLoading } = useMyPostingListQuery({
    onlyMyRoles: isGuest ? false : onlyMyRoles,
    excludeConflicts: isGuest ? false : excludeConflicts,
    gender: isGuest ? guestGender : "",
    workDate,
  });

  const postings = data?.items ?? [];
  const isDocumentApproved = profile?.documentReviewState === "APPROVED";
  const hasFilter =
    workDate !== "" ||
    (isGuest ? guestGender !== "" : onlyMyRoles || excludeConflicts);

  const resetFilters = () => {
    setOnlyMyRoles(false);
    setExcludeConflicts(false);
    setGuestGender("");
    setWorkDate("");
  };

  /*
    조건 토글이 보건증까지 함께 보므로, 보건증이 없는 사람은 그 자리들이
    말없이 사라진다. 왜 줄었는지 한 줄로 알린다.
  */
  const lacksHealthCert =
    !isGuest &&
    onlyMyRoles &&
    profile !== undefined &&
    !hasValidHealthCert(profile.healthCertState);

  return (
    <>
      {isGuest ? (
        <Alert tone="info" title="지금은 둘러보는 중입니다.">
          공고는 로그인하지 않아도 볼 수 있습니다. 지원하려면 로그인해 주세요.
        </Alert>
      ) : (
        profile &&
        !isDocumentApproved && (
          <Alert tone="warning" title="서류를 먼저 등록해 주세요.">
            신분증 · 통장사본이 승인되어야 근무를 확정할 수 있습니다.
          </Alert>
        )
      )}

      <div className="flex flex-col gap-3 rounded-card border border-border-main bg-surface p-4 shadow-card">
        {/*
          날짜로 찾는다. **하루만 고른다. 지난 날은 고를 수 없다.**

          "다음 주 화요일에 비는데 그날 일이 있나"가 이 화면에서 가장 흔한 질문이라,
          기간으로 받으면 묻지 않은 것까지 걸러 내고 고르는 손도 두 번 간다.
          지난 날은 지원할 수 없는 날이라 달력에서 아예 막아 둔다 —
          고를 수 있게 두면 0건이 뜨고, 그건 공고가 없다는 뜻으로 읽힌다.
        */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="근무일로 찾기"
            value={workDate}
            min={today}
            onChange={(event) => setWorkDate(event.target.value)}
            inputBoxClassName="w-full min-w-0"
          />

          {workDate && (
            <IconButton
              label="날짜 조건 지우기"
              icon={<Close size={16} />}
              size="lg"
              onClick={() => setWorkDate("")}
            />
          )}
        </div>

        {/* Switch가 button이라 label로 감싸지 않는다. 라벨은 Switch가 직접 받는다. */}
        {!isGuest && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] text-font-1">내가 할 수 있는 직무만</p>
                <p className="text-[12px] text-font-2">
                  등록한 직무 · 성별 · 보건증 조건을 함께 봅니다
                </p>
              </div>
              <Switch
                label="내가 할 수 있는 직무만 보기"
                checked={onlyMyRoles}
                onChange={setOnlyMyRoles}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border-main pt-3">
              <div className="min-w-0">
                <p className="text-[14px] text-font-1">확정된 근무일 제외</p>
                <p className="text-[12px] text-font-2">
                  이미 잡힌 근무와 날짜가 겹치는 공고를 숨깁니다
                </p>
              </div>
              <Switch
                label="확정된 근무일과 겹치는 공고 숨기기"
                checked={excludeConflicts}
                onChange={setExcludeConflicts}
              />
            </div>
          </>
        )}

        {isGuest && (
          <Select
            aria-label="성별"
            options={GUEST_GENDER_OPTIONS}
            value={guestGender}
            onChange={(event) => setGuestGender(event.target.value as Gender | "")}
            selectBoxClassName="flex-1"
          />
        )}

        {lacksHealthCert && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-warning">
            쓸 수 있는 보건증이 없어 보건증이 필요한 자리는 빼고 보여 주고 있어요.
            <Link
              href="/my/profile/documents?focus=health-cert"
              className="font-medium text-brand underline underline-offset-2"
            >
              보건증 등록
            </Link>
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full rounded-card" />
          ))}
        </div>
      ) : postings.length === 0 ? (
        <Card>
          <EmptyState
            title="조건에 맞는 공고가 없습니다."
            description={
              hasFilter
                ? "조건을 풀면 다른 자리도 볼 수 있습니다."
                : "새 공고가 올라오면 여기에 표시됩니다."
            }
            action={
              hasFilter && (
                <Button size="sm" onClick={resetFilters}>
                  조건 초기화
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {postings.map((posting) => (
            <li key={posting.postingId}>
              <PostingCard
                posting={posting}
                onlyMine={!isGuest && onlyMyRoles}
                onOpen={(item) => setSelectedId(item.postingId)}
              />
            </li>
          ))}
        </ul>
      )}

      {selectedId !== null && (
        <PostingDetailModal
          postingId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
};

export default PostingBoard;
