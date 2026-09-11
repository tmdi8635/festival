"use client";

import Link from "next/link";
import { useState } from "react";
import { useMyPostingQuery, useMyApplicationMutation } from "@/api/my/getMyRecruit";
import { APPLICATION_STATUS_TONE } from "@/constants/recruitOptions";
import {
  Calendar,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  Package,
  UserCheck,
  Warning,
} from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { cn, formatCurrency } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { useStaffSessionStore } from "@/store/useStaffSessionStore";
import {
  GENDER_PREFERENCE_LABEL,
  WAGE_TYPE_LABEL,
  formatTimeRange,
} from "@/type/event";
import type { MyPosting, MyPostingLine } from "@/type/my";
import {
  APPLICATION_STATUS_LABEL,
  PARTICIPATION_LABEL,
  formatDateList,
} from "@/type/recruit";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import DateChips from "@/components/domain/DateChips";

interface PostingDetailModalProps {
  postingId: number;
  onClose: () => void;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

const DetailRow = ({ icon, label, children }: DetailRowProps) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 shrink-0 text-font-disabled">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] text-font-2">{label}</p>
      <div className="mt-0.5 text-[14px] text-font-1">{children}</div>
    </div>
  </div>
);

/** 날짜를 골라 지원하는 줄인가. 날이 하루뿐이면 고를 것이 없다. */
const isPickableLine = (line: MyPostingLine): boolean =>
  line.participation === "SPLIT" && line.workDates.length > 1;

/** 날짜 칩에서 줄을 긋는 날 — 겹치거나 지난 날. */
const blockedDatesOf = (line: MyPostingLine): string[] =>
  line.workDates.filter((date) => !line.availableDates.includes(date));

interface PositionRowProps {
  posting: MyPosting;
  line: MyPostingLine;
  isGuest: boolean;
  isBusy: boolean;
  onApply: (line: MyPostingLine) => void;
  onCancel: (line: MyPostingLine) => void;
}

/**
 * 모집 줄 한 칸 = **지원 단위.**
 *
 * 버튼을 모달 아래에 하나만 두면 "어느 시간대로 지원한 건지"가 화면에 남지 않는다.
 * 줄마다 제 버튼과 제 사정(지원함 · 못 하는 이유)을 붙인다.
 * 못 하는 이유는 서버가 판단한 한 줄(`blockReason`)을 그대로 쓴다 — 버튼만 잠가 두면
 * 고장인 줄 알고 담당자에게 전화한다.
 *
 * 같은 A타임이라도 **전일 줄과 급구 줄이 따로 선다.** 사흘을 다 나올 수 있으면
 * 전일 줄에, 하루만 되면 급구 줄에 낸다. 줄마다 무엇을 약속하는지를 배지로 말한다.
 */
const PositionRow = ({
  posting,
  line,
  isGuest,
  isBusy,
  onApply,
  onCancel,
}: PositionRowProps) => {
  const jobRoleLabel = useJobRoleLabel();
  /* 지원은 줄마다 따로 있다. 한 행사의 여러 줄에 걸어 둘 수 있다. */
  const status = line.myApplicationStatus;
  const isMine = status !== undefined;
  const isMultiDay = posting.workDates.length > 1;
  /** 행사 근무일을 다 서지 않는 줄. 이때만 날짜를 펼친다 */
  const isPartial = line.workDates.length !== posting.workDates.length;
  const isPickable = isPickableLine(line);
  const needsHealthCert =
    !isGuest && Boolean(line.blockReason?.includes("보건증"));

  /*
    지원할 수 없는 자리는 **꺼진 것처럼 보여야 한다.**
    이유를 한 줄 적어 두는 것만으로는 눈에 걸리지 않아서, 사람들은 줄을 다 읽고
    버튼을 찾다가 없다는 걸 알게 된다. 자리 자체를 흐리게 두고 이유만 또렷하게
    남기면, 훑는 동안 지원할 수 있는 자리만 눈에 들어온다.
  */
  const isBlocked = !isMine && !line.canApply;
  const hasBadges =
    line.isUrgent ||
    (isMultiDay && line.workDates.length > 1) ||
    line.name !== jobRoleLabel(line.jobRole) ||
    line.genderPreference !== "ANY" ||
    line.requiresHealthCert;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-card border p-4",
        isMine
          ? "border-brand bg-surface-selected"
          : isBlocked
            ? "border-border-main bg-subtle"
            : line.isUrgent
              ? "border-danger"
              : "border-border-main",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          isBlocked && "opacity-45",
        )}
      >
        <p className="min-w-0 text-[15px] font-semibold text-font-0">{line.name}</p>

        {/*
          **단가만 적는다.** (시급 · 일급) 하루 얼마는 근무시간 · 휴게에 따라
          흔들리는 값이라 자리끼리 비교가 되지 않는다. 사람들이 실제로 비교하는 것은 시급이다.
        */}
        <div className="shrink-0 text-right">
          <p className="text-[12px] text-font-2">{WAGE_TYPE_LABEL[line.wageType]}</p>
          <p className="text-[17px] font-bold text-font-0 tabular-nums">
            {formatCurrency(line.wage)}
          </p>
        </div>
      </div>

      {/* 근무시간 · 휴게 · 날짜는 지원 여부를 가르는 값이라 배지보다 위에 온다. */}
      <div className={cn("flex flex-col gap-1.5", isBlocked && "opacity-45")}>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[14px] font-medium text-font-1 tabular-nums">
          <Clock size={15} className="shrink-0 text-font-disabled" />
          {formatTimeRange(line.startTime, line.endTime, line.endDayOffset)}
          <span className="text-[13px] font-normal text-font-2">
            실근무 {line.workHours.toFixed(1)}시간
            {line.breakMinutes > 0 && ` · 휴게 ${line.breakMinutes}분`}
          </span>
        </p>

        {/*
          이 줄이 **실제로 서는 날.**

          - 날짜를 고르는 줄: 칩으로 펼친다. 겹치거나 지난 날은 줄을 긋는다 —
            눌러 보고 거절당하기 전에 어느 날이 안 되는지 보여야 한다.
          - 전일 줄: 행사 근무일과 같으면 날짜를 다시 적지 않는다(위에 있다).
            다를 때만 펼치고, 모든 날 나와야 한다는 것과 전체 금액을 함께 적는다.
        */}
        {line.workDates.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[14px] font-medium text-font-2">
            <Calendar size={15} className="shrink-0 text-font-disabled" />
            아직 발주가 없는 자리예요
          </p>
        ) : isPickable ? (
          <div className="flex flex-col gap-1.5">
            <p className="flex flex-wrap items-center gap-x-1.5 text-[14px] font-medium text-font-1">
              <Calendar size={15} className="shrink-0 text-font-disabled" />
              {line.workDates.length}일 중 나올 날을 골라 지원
              <span className="text-[13px] font-normal text-font-2 tabular-nums">
                하루 예상 {formatCurrency(line.dailyPay)}
              </span>
            </p>
            <DateChips
              dates={line.workDates}
              selected={isMine ? (line.myDates ?? []) : []}
              disabledDates={isMine ? [] : blockedDatesOf(line)}
              disabledReason="다른 근무와 겹치거나 지난 날이에요"
            />
          </div>
        ) : (
          (isPartial || line.workDates.length > 1) && (
            <p className="flex flex-wrap items-center gap-x-1.5 text-[14px] font-medium text-font-1 tabular-nums">
              <Calendar size={15} className="shrink-0 text-font-disabled" />
              {isPartial
                ? formatDateList(line.workDates)
                : `${line.workDates.length}일 근무`}
              {line.workDates.length > 1 && (
                <span className="text-[13px] font-normal text-font-2">
                  모든 날 참여 · 예상 {formatCurrency(line.totalPay)}
                </span>
              )}
            </p>
          )
        )}
      </div>

      {hasBadges && (
        <div className={cn("flex flex-wrap gap-1.5", isBlocked && "opacity-45")}>
          {line.isUrgent && <Badge tone="danger">급구</Badge>}
          {isMultiDay && line.workDates.length > 1 && (
            <Badge tone={line.participation === "FULL" ? "info" : "neutral"}>
              {PARTICIPATION_LABEL[line.participation]}
            </Badge>
          )}
          {/*
            직무 배지는 **이름과 다를 때만** 단다. 대부분의 자리는 이름이 곧 직무라
            배지를 늘 달면 같은 낱말이 두 번 적힌다.
          */}
          {line.name !== jobRoleLabel(line.jobRole) && (
            <Badge tone="neutral">{jobRoleLabel(line.jobRole)}</Badge>
          )}
          {line.genderPreference !== "ANY" && (
            <Badge tone="info">{GENDER_PREFERENCE_LABEL[line.genderPreference]}</Badge>
          )}
          {line.requiresHealthCert && <Badge tone="warning">보건증 필요</Badge>}
        </div>
      )}

      {isMine && status ? (
        <div className="flex flex-col gap-2 border-t border-border-main pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone={APPLICATION_STATUS_TONE[status]}>
              지원함 · {APPLICATION_STATUS_LABEL[status]}
            </Badge>

            {/*
              검토 대기일 때만 무를 수 있다. 확정된 뒤에 화면에서 혼자 빠질 수 있으면
              담당자는 전날에야 사람이 사라진 것을 알게 된다.
            */}
            {status === "PENDING" ? (
              <Button
                size="sm"
                variant="dangerSoft"
                disabled={isBusy}
                onClick={() => onCancel(line)}
              >
                지원 취소
              </Button>
            ) : (
              <span className="text-[12px] text-font-2">
                처리된 지원은 담당자에게 문의해 주세요
              </span>
            )}
          </div>
          {isPickable && line.myDates && (
            <p className="text-[13px] text-font-1 tabular-nums">
              {status === "ACCEPTED" ? "확정된 날" : "신청한 날"}{" "}
              {formatDateList(line.myDates)}
            </p>
          )}
        </div>
      ) : line.canApply ? (
        <Button
          variant={line.isUrgent ? "primary" : "secondary"}
          fullWidth
          disabled={isBusy}
          onClick={() => onApply(line)}
        >
          {isPickable ? "날짜 골라 지원하기" : "이 포지션에 지원하기"}
        </Button>
      ) : (
        <div className="flex flex-col gap-1.5 border-t border-border-main pt-3">
          {/* 흐려 둔 자리에서 **이 줄만 또렷하다.** 왜 못 하는지는 읽혀야 한다. */}
          <p className="flex items-start gap-1.5 text-[13px] font-medium text-font-1">
            <Warning size={14} className="mt-0.5 shrink-0 text-warning" />
            {line.blockReason ?? "지금은 지원할 수 없어요."}
          </p>
          {needsHealthCert && (
            <Link
              href="/my/profile/documents?focus=health-cert"
              className="flex items-center gap-0.5 self-start text-[13px] font-medium text-brand transition hover:opacity-80"
            >
              보건증 등록하러 가기
              <ChevronRight size={14} />
            </Link>
          )}
        </div>
      )}
    </li>
  );
};

interface LineDateSheetProps {
  posting: MyPosting;
  line: MyPostingLine;
  isBusy: boolean;
  onClose: () => void;
  onSubmit: (dates: string[]) => void;
}

/**
 * 나올 날 고르기 — 분할 줄의 지원.
 *
 * 폰에서 하는 일이라 모달 위의 하단 시트다. 뒤의 공고가 흐리게 남아 있어 **어느 자리의**
 * 날을 고르는지 잊지 않는다. 처음에는 고를 수 있는 날이 모두 켜진 채로 시작한다 —
 * 대부분은 되는 날을 다 내고, 안 되는 하루 이틀만 끈다.
 *
 * 부르는 쪽이 `key`로 줄 번호를 넘겨 새로 그린다. 앞 줄에서 고른 날이 남으면 안 된다.
 */
const LineDateSheet = ({
  posting,
  line,
  isBusy,
  onClose,
  onSubmit,
}: LineDateSheetProps) => {
  const [picked, setPicked] = useState<string[]>(line.availableDates);
  const blocked = blockedDatesOf(line);

  const handleToggle = (date: string) =>
    setPicked((prev) =>
      prev.includes(date)
        ? prev.filter((item) => item !== date)
        : [...prev, date].sort(),
    );

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title={`'${line.name}' 나올 날 고르기`}
      description={`${posting.title} · ${formatTimeRange(
        line.startTime,
        line.endTime,
        line.endDayOffset,
      )}`}
      footer={
        /* 서명 시트와 같은 두 칸. 한쪽만 `fullWidth`면 옆 버튼을 화면 밖으로 밀어낸다. */
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={picked.length === 0 || isBusy}
            isLoading={isBusy}
            onClick={() => onSubmit(picked)}
          >
            {picked.length}일 지원하기
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <DateChips
          size="md"
          dates={line.workDates}
          selected={picked}
          onToggle={handleToggle}
          disabledDates={blocked}
          disabledReason="다른 근무와 겹치거나 지난 날이에요"
        />
        {blocked.length > 0 && (
          <p className="text-[12px] text-font-2">
            줄이 그어진 날은 다른 근무와 겹치거나 이미 지난 날이에요.
          </p>
        )}
        <p className="text-[14px] font-medium text-font-1 tabular-nums">
          예상 {formatCurrency(line.dailyPay * picked.length)}
          <span className="ml-1 text-[12px] font-normal text-font-2">
            세전 · {picked.length}일
          </span>
        </p>
        <Alert tone="info" title="지원한다고 근무가 확정되는 것은 아닙니다.">
          담당자가 확인한 뒤 연락드립니다. 고른 날 중 일부만 확정될 수도 있어요.
        </Alert>
      </div>
    </BottomSheet>
  );
};

/**
 * 공고 상세 — 행사 한 건과 그 안의 모집 줄들.
 *
 * 지원은 **줄을 골라서** 한다. 같은 행사라도 A타임(09~18)과 B타임(21~06)은
 * 전혀 다른 일이고 금액도 다르다. 같은 A타임이라도 전일 줄과 하루짜리 급구 줄이
 * 따로 선다. 여러 줄에 지원해 둘 수 있고, 하나가 확정되면 같은 날 나머지는 사라진다.
 *
 * **화면이 아니라 모달인 이유**는 포털이 정적으로 내보내지기 때문이다.
 * 공고 번호마다 페이지를 미리 찍을 수 없다.
 *
 * 공고 목록과 일정의 '신청'에서 같은 모달을 연다. 볼 수 있는 화면이 둘이면
 * 두 곳의 내용이 조금씩 어긋나기 시작한다.
 *
 * 지원한 뒤에도 닫지 않는다. 방금 누른 줄이 '지원함'으로 바뀌는 것을 그 자리에서
 * 봐야 제대로 들어갔는지 안다.
 */
const PostingDetailModal = ({ postingId, onClose }: PostingDetailModalProps) => {
  const staffId = useStaffSessionStore((state) => state.staffId);
  const { data: posting, isLoading } = useMyPostingQuery(postingId);
  const { applyMutation, cancelMutation } = useMyApplicationMutation();
  /** 날짜를 고르는 중인 줄. 있으면 하단 시트가 뜬다 */
  const [sheetLine, setSheetLine] = useState<MyPostingLine | null>(null);

  const isGuest = staffId === null;
  const isBusy = applyMutation.isPending || cancelMutation.isPending;

  /* 행사 근무일을 다 서지 않는 줄이 섞여 있으면 위에서 미리 알린다. */
  const hasPartialLine = Boolean(
    posting?.lines.some(
      (line) => line.workDates.length !== posting.workDates.length || isPickableLine(line),
    ),
  );

  const handleApply = (target: MyPosting, line: MyPostingLine) => {
    if (isPickableLine(line)) {
      setSheetLine(line);
      return;
    }

    const isFullMultiDay =
      line.participation === "FULL" && line.workDates.length > 1;

    openConfirm({
      title: `'${line.name}'에 지원할까요?`,
      description: `${target.title} · ${formatTimeRange(
        line.startTime,
        line.endTime,
        line.endDayOffset,
      )}`,
      /*
        확정이 아니라는 것을 누르기 전에 말해 둔다.
        여러 자리에 걸어 둘 수 있게 된 만큼, 하나가 확정되면 같은 날 나머지가
        사라진다는 것도 함께 알린다 — 모르면 없어진 지원을 고장으로 읽는다.
        전일 줄이면 **모든 날 나와야 한다는 것**을 맨 앞에 적는다.
      */
      warning: `${
        isFullMultiDay
          ? `${formatDateList(line.workDates)} ${line.workDates.length}일을 모두 나와야 하는 자리입니다. `
          : ""
      }지원한다고 근무가 확정되는 것은 아닙니다. 담당자가 확인한 뒤 연락드립니다. 여러 자리에 지원해 두어도 되고, 한 자리가 확정되면 같은 날의 다른 지원은 사라집니다.`,
      confirmText: "지원하기",
      onConfirm: () =>
        applyMutation.mutate({
          postingId: target.postingId,
          targetId: line.targetId,
          /* 하루짜리 분할 줄(급구)은 고를 것 없이 그 하루다. */
          dates: line.participation === "SPLIT" ? line.availableDates : undefined,
        }),
    });
  };

  const handleCancel = (target: MyPosting, line: MyPostingLine) => {
    const applicationId = line.myApplicationId;

    if (!applicationId) return;

    openConfirm({
      title: "지원을 취소할까요?",
      description: `${target.title} · ${line.name}`,
      confirmText: "지원 취소",
      tone: "danger",
      onConfirm: () => cancelMutation.mutate(applicationId),
    });
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={posting?.title ?? "공고"}
        description={posting ? posting.clientName : undefined}
        size="md"
        footer={
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
        }
      >
        {isLoading || !posting ? (
          <Skeleton className="h-72 w-full rounded-card" />
        ) : (
          <div className="flex flex-col gap-5">
            {isGuest && (
              <Alert tone="info" title="로그인하면 지원할 수 있어요.">
                공고는 로그인하지 않아도 볼 수 있습니다. 지원은 담당자가 계정을 만들어 드린
                뒤에 할 수 있습니다.
              </Alert>
            )}

            {!isGuest && !posting.isApplied && posting.conflictEventTitle && (
              <Alert tone="warning" title="같은 기간에 확정된 근무가 있어요.">
                &lsquo;{posting.conflictEventTitle}&rsquo;와 날짜가 겹칩니다. 전 일정을
                나와야 하는 자리에는 지원할 수 없고, 날짜를 고르는 자리는 겹치지 않는 날로
                지원할 수 있어요.
              </Alert>
            )}

            <div className="flex flex-col gap-3.5">
              <DetailRow
                icon={<Calendar size={16} />}
                label={`근무일 ${posting.workDates.length}일`}
              >
                {/*
                  다일 행사는 날짜를 **전부** 적는다. "09.12 외 2일"로 줄인 채로
                  지원하면, 나머지 이틀이 언제인지 모르고 다른 일을 잡는다.
                  며칠을 비워야 하는지가 지원 여부를 가르는 값이라 작게 적지 않는다.
                */}
                <ul className="flex flex-wrap gap-1.5">
                  {posting.workDates.map((date) => (
                    <li
                      key={date}
                      className="rounded-field bg-subtle px-2.5 py-1 text-[15px] font-semibold tabular-nums"
                    >
                      {formatDate(date)}
                    </li>
                  ))}
                </ul>
                {hasPartialLine && (
                  <p className="mt-1.5 text-[12px] text-font-2">
                    자리마다 서는 날이 다릅니다. 아래에서 확인해 주세요.
                  </p>
                )}
              </DetailRow>

              <DetailRow icon={<MapPin size={16} />} label="장소">
                {posting.venue}
                {posting.address && (
                  <span className="block text-[13px] text-font-2">{posting.address}</span>
                )}
              </DetailRow>

              {/*
                업체가 전하는 말은 **장소에서 떼어 낸다.**

                집합 장소는 행사장 주소와 다른 값인데(후문 · 지하 주차장이 흔하다)
                장소 칸 아래에 붙여 두면 주소의 부연으로 읽힌다. 그리고 현장마다
                칸으로 정해지지 않는 당부가 늘 하나씩 있어서, 담당자는 그것마저
                집합 칸에 이어 붙이게 된다. 안내는 안내끼리 한 자리에 모은다.
              */}
              {(posting.meetingPoint || posting.description) && (
                <DetailRow icon={<Info size={16} />} label="안내">
                  <div className="flex flex-col gap-1.5">
                    {posting.meetingPoint && (
                      <span className="block rounded-field bg-brand-opacity px-2.5 py-1.5 text-[14px] font-medium text-brand">
                        집합 {posting.meetingPoint}
                      </span>
                    )}
                    {posting.description && (
                      <span className="block whitespace-pre-line text-[14px] text-font-1">
                        {posting.description}
                      </span>
                    )}
                  </div>
                </DetailRow>
              )}
            </div>

            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-font-0">
                  모집 {posting.lines.length}건
                </h3>
                <p className="text-[12px] text-font-2">여러 자리에 지원해도 돼요</p>
              </div>

              <ul className="flex flex-col gap-2">
                {posting.lines.map((line) => (
                  <PositionRow
                    key={line.targetId}
                    posting={posting}
                    line={line}
                    isGuest={isGuest}
                    isBusy={isBusy}
                    onApply={(target) => handleApply(posting, target)}
                    onCancel={(target) => handleCancel(posting, target)}
                  />
                ))}
              </ul>
            </section>

            {(posting.dressCode || posting.belongings) && (
              <div className="flex flex-col gap-3.5 border-t border-border-main pt-4">
                {posting.dressCode && (
                  <DetailRow icon={<UserCheck size={16} />} label="복장">
                    {posting.dressCode}
                  </DetailRow>
                )}

                {posting.belongings && (
                  <DetailRow icon={<Package size={16} />} label="준비물">
                    {posting.belongings}
                  </DetailRow>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {posting && sheetLine && (
        <LineDateSheet
          key={sheetLine.targetId}
          posting={posting}
          line={sheetLine}
          isBusy={applyMutation.isPending}
          onClose={() => setSheetLine(null)}
          onSubmit={(dates) =>
            applyMutation.mutate(
              { postingId: posting.postingId, targetId: sheetLine.targetId, dates },
              { onSuccess: () => setSheetLine(null) },
            )
          }
        />
      )}
    </>
  );
};

export default PostingDetailModal;
