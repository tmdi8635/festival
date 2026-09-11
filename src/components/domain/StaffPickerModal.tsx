"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useAssignmentCandidateQuery } from "@/api/event/getAssignmentCandidates";
import { useAssignmentMutation } from "@/api/event/mutateAssignment";
import { useOfferMutation } from "@/api/offer/mutateOffer";
import type { PostingParticipation } from "@/type/recruit";
import Textarea from "@/components/ui/Textarea";
import type { EmploymentType } from "@/type/employee";
import { useJobRoleComparator, useJobRoleLabel } from "@/store/useOrgStore";
import { Sparkle, Star, Warning } from "@/icons";
import { cn } from "@/lib/utils";
import {
  formatPositionLabel,
  formatTimeRange,
  findPosition,
  GENDER_PREFERENCE_LABEL,
  WEEKDAY_LABELS,
  describeRecurrence,
  resolvePositionWorkDates,
  type AssignmentStatus,
  type EventDetail,
  type GenderPreference,
} from "@/type/event";
import {
  DOCUMENT_REVIEW_STATE_LABEL,
  HEALTH_CERT_STATE_LABEL,
  formatRegion,
  hasValidHealthCert,
  REQUIRED_DOCUMENT_LABEL,
  type Gender,
  type HealthCertFilter,
} from "@/type/staff";
import {
  GENDER_FILTER_OPTIONS,
  HEALTH_CERT_FILTER_OPTIONS,
} from "@/constants/staffOptions";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import GenderMark from "./GenderMark";
import RatingStat from "./RatingStat";

interface StaffPickerModalProps {
  event: EventDetail | null;
  /** 모달을 열 때 미리 골라 둘 포지션 (부족한 자리에서 바로 열 수 있게) */
  initialPositionId?: number;
  /**
   * 모달을 열 때 미리 골라 둘 근무일.
   *
   * 일자별 근무자 화면에서 "이 날 한 명 더"를 누르면 그날만 선택된 채로 열려야 한다.
   * 비우면 행사의 모든 근무일이 대상이다.
   */
  initialDates?: string[];
  /** '포털로 제안'으로 열지. 행사 상세의 보낸 제안 탭에서 연다 */
  initialStatus?: PickerStatus;
  onClose: () => void;
}

/** 배치 상태 + 포털 제안. 제안은 배치가 아니라 `WorkOffer`로 간다 */
type PickerStatus = AssignmentStatus | "OFFER";

/*
  '제안 단계'(PROPOSED 배치)는 **포털로 제안**으로 바뀌었다.

  예전의 제안 배치는 본인에게 물어볼 길이 없는 메모였다. 그런데 포털은 그것을 근무로
  보여 줘서, 본인은 제안받은 날을 확정된 날로 알았다. 이제 제안은 본인이 수락 · 거절하는
  별도 기록이고, 수락하는 순간 확정 배치가 된다. (`PROPOSED` 상태 자체는 타입에 남긴다)
*/
const ASSIGNMENT_STATUS_OPTIONS = [
  { label: "확정 배치", value: "CONFIRMED" },
  { label: "대기 인력", value: "WAITLIST" },
  { label: "포털로 제안", value: "OFFER" },
];

const OFFER_PARTICIPATION_OPTIONS: { label: string; value: PostingParticipation }[] = [
  { label: "모든 날 수락만 (전일)", value: "FULL" },
  { label: "날짜 골라 수락 (분할)", value: "SPLIT" },
];

/**
 * 고용 형태 필터.
 *
 * 직원은 직무 조건에 걸리지 않아 어느 직무를 골라도 후보에 **섞여** 있다.
 * 그런데 목록은 추천 점수 순이라, 인력풀이 수십 명이면 우리 사람이 중간
 * 어딘가에 흩어져 "직원은 어떻게 넣나"가 된다. 여기서 한 번에 세워 볼 수 있게 한다.
 */
const EMPLOYMENT_FILTER_OPTIONS = [
  { label: "전체 인력", value: "" },
  { label: "우리 직원", value: "EMPLOYEE" },
  { label: "프리랜서", value: "FREELANCER" },
];

/**
 * 인력 배치 모달.
 *
 * 배치는 **포지션**에 선다. 같은 스태프라도 A타임 · B타임은 오는 시각 · 금액이 달라서,
 * 직무만 고르면 서버가 어느 자리로 넣어야 할지 알 수 없다.
 *
 * 대표가 머릿속으로 하던 판단(누굴 넣지)을 화면이 대신 정렬해 준다.
 * - 즐겨찾기 → 해당 거래처 경험 → 평판 → 누적 근무 순으로 추천 점수를 매긴다.
 * - 같은 날 다른 행사에 확정된 사람은 기본적으로 목록에서 빼고,
 *   굳이 봐야 할 때만 켜서 보되 선택은 막는다. (중복 배치가 현장 펑크의 주원인이다)
 */
const StaffPickerModal = ({
  event,
  initialPositionId,
  initialDates,
  initialStatus,
  onClose,
}: StaffPickerModalProps) => {
  const jobRoleLabel = useJobRoleLabel();
  // 직무 나열 순서는 기준 설정이 정한다. 코드 알파벳순이면 팀장이 맨 뒤로 밀린다.
  const compareRoles = useJobRoleComparator();

  /*
    고르기 전에는 호출부가 지정한 포지션을 그대로 쓰고, 고르면 draft가 화면을 담당한다.
    useState 초기값으로 두면 모달이 계속 마운트된 채 열고 닫히므로
    "부족한 자리의 채우기"로 다시 열어도 처음 열었을 때의 포지션이 남는다.
  */
  const [draftPositionId, setDraftPositionId] = useState<number | null>(null);
  const positions = useMemo(() => event?.positions ?? [], [event]);
  const positionId =
    draftPositionId ?? initialPositionId ?? positions[0]?.positionId ?? 0;
  const position = event ? findPosition(event, positionId) : undefined;
  /* 후보의 가능 직무 중 지금 자리의 직무를 도드라지게 하는 데 쓴다. */
  const role = position?.jobRole;

  const [keyword, setKeyword] = useState("");
  /* 포지션 · 날짜와 같은 draft 방식. 모달이 마운트된 채 열고 닫혀서 초기값이 남으면 안 된다. */
  const [draftStatus, setDraftStatus] = useState<PickerStatus | null>(null);
  const status: PickerStatus = draftStatus ?? initialStatus ?? "CONFIRMED";
  const isOffer = status === "OFFER";
  const [offerMessage, setOfferMessage] = useState("");
  const [draftParticipation, setDraftParticipation] =
    useState<PostingParticipation | null>(null);
  /* 제안 방식의 초기값은 포지션의 발주 조건이다. (전일만 받는 자리면 전일 제안) */
  const participation: PostingParticipation =
    draftParticipation ?? (position?.scheduleRule === "SPLIT_OK" ? "SPLIT" : "FULL");
  /*
    성별 필터.

    포지션에 조건이 있으면 그것이 **초기값**이 되고, 담당자가 '전체 성별'로
    되돌리면 조건과 다른 사람도 그대로 후보에 오른다.
    현장은 '남성만' 자리에 여성을 넣는 일도 늘 있어서, 필터가 그것을 막으면
    후보가 아예 안 보이는 날이 생긴다. 강제하지 않는다.
  */
  const [draftGender, setDraftGender] = useState<Gender | "" | null>(null);
  /*
    보건증 필터. 보건증이 필요한 포지션이면 '있음'이 초기값이다.
    발급을 기다리는 사람을 먼저 잡아 두는 일도 있어서 언제든 풀 수 있다.
  */
  const [draftHealthCert, setDraftHealthCert] = useState<
    HealthCertFilter | "" | null
  >(null);
  const [employment, setEmployment] = useState<EmploymentType | "">("");
  const [includeUnavailable, setIncludeUnavailable] = useState(false);
  /** 전 일정 가능자만. null이면 포지션 조건 · 고른 날에서 초기값을 정한다 */
  const [draftFullOnly, setDraftFullOnly] = useState<boolean | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  /**
   * 배치할 근무일.
   *
   * null이면 "행사의 모든 근무일"이다.
   * 반복 행사는 "주말 4주 중 2주만 가능"한 경우가 흔해서 날짜를 골라야 한다.
   * 편집을 시작하기 전에는 서버 값(전체)을 그대로 쓰고, 고르기 시작하면 draft가 담당한다.
   */
  const [draftDates, setDraftDates] = useState<string[] | null>(null);
  const eventDates = event?.dates ?? [];
  const targetDates = draftDates ?? initialDates ?? eventDates;

  /** 고른 근무일에 이 포지션의 발주 슬롯 */
  const targetSlots = (event?.days ?? [])
    .filter((day) => targetDates.includes(day.date))
    .flatMap((day) => day.roles.filter((item) => item.positionId === positionId));

  const orderGender: GenderPreference = position?.genderPreference ?? "ANY";
  const requiresHealthCert = position?.requiresHealthCert ?? false;

  const gender =
    draftGender ?? (orderGender === "ANY" ? "" : (orderGender as Gender));
  const healthCert =
    draftHealthCert ?? (requiresHealthCert ? "VALID" : "");

  /*
    전 일정 가능자만.

    업체가 전일을 원하는 포지션이고 **그 포지션의 날을 전부 골랐을 때** 켜진 채로 시작한다.
    날짜를 몇 개만 골랐다면 그 자체로 하루씩 채우는 중이라(노쇼 대타 · 급구) 끈 채로 둔다.
    성별 · 보건증처럼 초기값일 뿐이고 담당자가 언제든 바꾼다.
  */
  const isFullOnlyPosition = position?.scheduleRule === "FULL_ONLY";
  const positionDates =
    event && positionId > 0 ? resolvePositionWorkDates(event, positionId) : [];
  const coversAllPositionDates =
    positionDates.length > 1 &&
    positionDates.every((date) => targetDates.includes(date));
  const fullScheduleOnly =
    draftFullOnly ?? (isFullOnlyPosition && coversAllPositionDates);

  const { data, isLoading } = useAssignmentCandidateQuery(
    {
      eventId: event?.eventId ?? 0,
      positionId: positionId || undefined,
      keyword: keyword || undefined,
      includeUnavailable,
      fullScheduleOnly: fullScheduleOnly || undefined,
      gender: gender || undefined,
      healthCert: healthCert || undefined,
      employment: employment || undefined,
      // 고른 날 기준으로 겹침을 계산해야 "이 날만 가능한 사람"이 걸러지지 않는다.
      dates: targetDates.join(","),
    },
    Boolean(event) && positionId > 0,
  );

  const { createMutation } = useAssignmentMutation();
  const { createMutation: offerMutation } = useOfferMutation();

  const candidates = data?.items ?? [];

  /** 포지션 선택지. 이름만으로는 A타임 · B타임의 차이가 안 보여 시각을 붙인다. */
  const positionOptions = useMemo(
    () =>
      positions.map((item) => ({
        label: `${item.name} · ${formatTimeRange(
          item.startTime,
          item.endTime,
          item.endDayOffset,
        )}`,
        value: String(item.positionId),
      })),
    [positions],
  );

  const positionLabel = position
    ? formatPositionLabel(position, jobRoleLabel)
    : "포지션";

  /*
    부족 인원은 **고른 근무일 기준**으로 센다.
    행사 전체 합계로 안내하면, 일자별 근무자에서 "그 날 그 자리"를 눌러 열었을 때
    "이 날은 다 찼는데 6명이 더 필요합니다"처럼 엇갈린 말이 나온다.
  */
  const hasOrder = targetSlots.length > 0;
  const shortage = targetSlots.reduce(
    (sum, item) => sum + Math.max(0, item.requiredCount - item.assignedCount),
    0,
  );

  const handleToggle = (staffId: number) => {
    setSelectedIds((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId],
    );
  };

  const handleToggleDate = (date: string) => {
    const next = targetDates.includes(date)
      ? targetDates.filter((item) => item !== date)
      : [...targetDates, date].sort();

    setDraftDates(next);
    // 고른 날이 바뀌면 겹침 판정도 달라지므로 선택을 비운다.
    setSelectedIds([]);
  };

  const handleClose = () => {
    setSelectedIds([]);
    setDraftDates(null);
    setDraftPositionId(null);
    setDraftGender(null);
    setDraftHealthCert(null);
    setDraftFullOnly(null);
    setDraftStatus(null);
    setDraftParticipation(null);
    setOfferMessage("");
    setEmployment("");
    setKeyword("");
    onClose();
  };

  const handleSubmit = () => {
    if (!event || !positionId) return;

    /* 제안은 배치를 만들지 않는다. 본인이 수락하는 순간 서버가 확정 배치를 만든다. */
    if (status === "OFFER") {
      offerMutation.mutate(
        {
          eventId: event.eventId,
          staffIds: selectedIds,
          positionId,
          dates: targetDates,
          participation,
          message: offerMessage,
        },
        { onSuccess: () => handleClose() },
      );

      return;
    }

    createMutation.mutate(
      {
        eventId: event.eventId,
        staffIds: selectedIds,
        dates: targetDates,
        positionId,
        status,
      },
      { onSuccess: () => handleClose() },
    );
  };

  const canSubmit =
    selectedIds.length > 0 && targetDates.length > 0 && positionId > 0;

  return (
    <Modal
      isOpen={Boolean(event)}
      onClose={handleClose}
      title={isOffer ? "근무 제안" : "인력 배치"}
      description={
        event
          ? `${event.title} · ${describeRecurrence(event.recurrence, event.dayCount)}${
              position
                ? ` · ${positionLabel} ${formatTimeRange(position.startTime, position.endTime, position.endDayOffset)}`
                : ""
            }`
          : undefined
      }
      size="xl"
      onSubmit={canSubmit ? handleSubmit : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            isLoading={createMutation.isPending || offerMutation.isPending}
          >
            {isOffer ? (
              `${selectedIds.length}명에게 제안`
            ) : (
              <>
                {selectedIds.length}명 ×{" "}
                {targetDates.length === eventDates.length
                  ? "전체"
                  : `${targetDates.length}일`}{" "}
                배치
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {positions.length === 0 && (
          <Alert tone="warning" title="이 행사에 포지션이 없습니다.">
            개요 탭의 포지션 카드에서 포지션을 먼저 만들어 주세요. 배치는 포지션에
            섭니다.
          </Alert>
        )}

        {position && shortage > 0 && (
          <Alert
            tone="warning"
            title={`고른 근무일 기준 ${positionLabel} ${shortage}명이 더 필요합니다.`}
          >
            추천 순서대로 채우면 현장 적응이 빠른 인력부터 배치됩니다.
          </Alert>
        )}

        {/*
          발주를 다 채웠거나 아예 그날 발주에 없는 포지션이어도 배치를 막지 않는다.
          현장에서 "한 명 더"가 수시로 생기고, 그때마다 발주 인원을 먼저 고쳐야 한다면
          아무도 그렇게 쓰지 않는다.
        */}
        {position && shortage === 0 && (
          <Alert
            tone="info"
            title={
              hasOrder
                ? `고른 근무일의 ${positionLabel} 발주 인원은 이미 채웠습니다.`
                : `${positionLabel}은 고른 근무일의 발주에 없는 포지션입니다.`
            }
          >
            현장 상황에 따라 더 배치할 수 있습니다. 발주보다 많이 넣으면 충원
            현황에 초과로 표시됩니다.
          </Alert>
        )}

        {/*
          근무일 선택.
          반복 행사는 "주말 4주 중 2주만 가능"한 사람이 흔하다.
          전체 기간에 통째로 넣으면 결국 하루씩 손으로 빼야 한다.
        */}
        {eventDates.length > 1 && (
          <div className="flex flex-col gap-2 rounded-field border border-border-main bg-subtle px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-font-1">
                배치할 근무일
                <span className="ml-1.5 text-[12px] font-normal text-font-2">
                  고른 날에만 배치됩니다
                </span>
              </p>

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraftDates(eventDates);
                    setSelectedIds([]);
                  }}
                >
                  전체 선택
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraftDates([]);
                    setSelectedIds([]);
                  }}
                >
                  전체 해제
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {eventDates.map((date) => {
                const isPicked = targetDates.includes(date);
                const weekday =
                  WEEKDAY_LABELS[new Date(`${date}T00:00:00`).getDay()];

                return (
                  <button
                    key={date}
                    type="button"
                    aria-pressed={isPicked}
                    onClick={() => handleToggleDate(date)}
                    className={cn(
                      "rounded-field border px-2.5 py-1 text-[12px] transition tabular-nums",
                      isPicked
                        ? "border-brand bg-brand text-font-4"
                        : "border-border-main text-font-2 hover:border-brand hover:text-font-1",
                    )}
                  >
                    {date.slice(5).replace("-", ".")} ({weekday})
                  </button>
                );
              })}
            </div>

            {targetDates.length === 0 && (
              <p className="text-[12px] text-font-error">
                근무일을 한 개 이상 골라 주세요.
              </p>
            )}
          </div>
        )}

        {/*
          포털로 제안. 고른 사람 · 날짜는 배치와 같고, 방식과 한마디만 더 받는다.
          수락이 곧 확정이라 무엇을 약속하는 제안인지(전일 · 분할)가 분명해야 한다.
        */}
        {isOffer && (
          <div className="flex flex-col gap-2 rounded-field border border-brand bg-surface-selected px-4 py-3">
            <p className="text-[13px] font-medium text-font-1">
              포털로 제안 보내기
              <span className="ml-1.5 text-[12px] font-normal text-font-2">
                본인이 수락하면 곧바로 확정 배치됩니다. 응답 기한은 24시간(첫 근무 3시간
                전까지)입니다.
              </span>
            </p>
            {targetDates.length > 1 && (
              <Select
                aria-label="제안 방식"
                options={OFFER_PARTICIPATION_OPTIONS}
                value={participation}
                onChange={(changeEvent) =>
                  setDraftParticipation(
                    changeEvent.target.value as PostingParticipation,
                  )
                }
                selectBoxClassName="w-56"
              />
            )}
            <Textarea
              rows={2}
              value={offerMessage}
              onChange={(changeEvent) => setOfferMessage(changeEvent.target.value)}
              placeholder="예) 지난번 현장 잘해 주셔서 먼저 연락드려요."
            />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <SearchInput
            value={keyword}
            onSearch={setKeyword}
            placeholder="이름 · 연락처 · 지역 검색"
          />

          <div className="flex flex-wrap items-center gap-2">
            {/*
              배치할 포지션. 바꾸면 성별 · 보건증 필터의 초기값도 그 포지션을 따른다.
              앞 포지션에서 고른 필터가 남으면 조건이 없는 자리에서도 후보가 줄어든다.
            */}
            <Select
              aria-label="배치할 포지션"
              options={positionOptions}
              value={String(positionId)}
              disabled={positions.length === 0}
              onChange={(changeEvent) => {
                setDraftPositionId(Number(changeEvent.target.value));
                setDraftGender(null);
                setDraftHealthCert(null);
                setDraftFullOnly(null);
                setSelectedIds([]);
              }}
              selectBoxClassName="w-48"
            />

            {/*
              성별 필터. 포지션 조건이 초기값을 정할 뿐 **막지 않는다.**
              '전체 성별'로 되돌리면 조건과 다른 사람도 그대로 보인다.
            */}
            <Select
              aria-label="성별 필터"
              options={GENDER_FILTER_OPTIONS}
              value={gender}
              onChange={(changeEvent) => {
                setDraftGender(changeEvent.target.value as Gender | "");
                setSelectedIds([]);
              }}
              selectBoxClassName="w-28"
            />

            <Select
              aria-label="보건증 필터"
              options={HEALTH_CERT_FILTER_OPTIONS}
              value={healthCert}
              onChange={(changeEvent) => {
                setDraftHealthCert(
                  changeEvent.target.value as HealthCertFilter | "",
                );
                setSelectedIds([]);
              }}
              selectBoxClassName="w-36"
            />

            {/* 우리 직원만 세워 보는 자리. 직무 조건을 건너뛰는 사람들이라 따로 찾을 길이 있어야 한다. */}
            <Select
              aria-label="고용 형태 필터"
              options={EMPLOYMENT_FILTER_OPTIONS}
              value={employment}
              onChange={(changeEvent) => {
                setEmployment(changeEvent.target.value as EmploymentType | "");
                setSelectedIds([]);
              }}
              selectBoxClassName="w-32"
            />

            <Select
              aria-label="배치 상태"
              options={ASSIGNMENT_STATUS_OPTIONS}
              value={status}
              onChange={(changeEvent) =>
                setDraftStatus(changeEvent.target.value as PickerStatus)
              }
              selectBoxClassName="w-32"
            />
          </div>
        </div>

        {/*
          포지션에 걸린 조건을 알려 준다. **관리자의 배치는 막지 않는다.**

          현장은 유동적이라 '남성만'으로 받은 자리에 여성을 넣는 일도,
          보건증 발급을 기다리는 사람을 먼저 잡아 두는 일도 있다.
          시스템이 그것을 막으면 담당자는 조건을 아예 안 적게 된다.
        */}
        {(orderGender !== "ANY" || requiresHealthCert) && (
          <Alert
            tone="info"
            title={`이 포지션의 조건: ${[
              orderGender !== "ANY" ? GENDER_PREFERENCE_LABEL[orderGender] : "",
              requiresHealthCert ? "보건증 필요" : "",
            ]
              .filter(Boolean)
              .join(" · ")}`}
          >
            조건에 맞는 후보가 먼저 걸러져 있습니다. 조건과 다른 인력도 배치할 수
            있으니, 필요하면 위 필터를 &lsquo;전체&rsquo;로 바꿔 모든 후보를 보세요.
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Checkbox
              label="같은 날 다른 행사에 확정된 인력도 보기"
              checked={includeUnavailable}
              onChange={(changeEvent) =>
                setIncludeUnavailable(changeEvent.target.checked)
              }
            />
            {eventDates.length > 1 && (
              <Checkbox
                label="고른 날 전부 나올 수 있는 사람만"
                checked={fullScheduleOnly}
                onChange={(changeEvent) => {
                  setDraftFullOnly(changeEvent.target.checked);
                  setSelectedIds([]);
                }}
              />
            )}
          </div>
          {isFullOnlyPosition && eventDates.length > 1 && (
            <p className="text-[12px] text-font-2">
              업체가 전 일정 가능자를 원하는 자리입니다. 노쇼 대타처럼 하루만 채울 때는
              위에서 그 날만 골라 넣으세요.
            </p>
          )}
        </div>

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-field" />
            ))}
          </div>
        )}

        {!isLoading && candidates.length === 0 && (
          <EmptyState
            title="조건에 맞는 인력이 없습니다."
            description="포지션 · 필터를 바꾸거나 검색어를 지워서 다시 찾아보세요."
          />
        )}

        {!isLoading && candidates.length > 0 && (
          <ul className="flex flex-col gap-2">
            {candidates.map((candidate, index) => {
              /*
                반복 행사에서는 "일부 날만 겹치는" 사람이 대부분이다.
                고른 날이 전부 막힌 사람만 선택을 막고,
                일부만 겹치는 사람은 몇 날이 빠지는지 알려 준 뒤 고르게 한다.
              */
              const blockedDates = targetDates.filter(
                (date) =>
                  candidate.conflictDates.includes(date) ||
                  candidate.assignedDates.includes(date),
              );
              const availableCount = targetDates.length - blockedDates.length;
              /*
                서류(신분증 · 통장사본)가 없으면 **확정 배치만** 막는다.
                일을 다 시킨 뒤에 통장사본이 없다는 걸 알면 지급할 방법이 없다.
                제안 · 대기로는 그대로 담을 수 있다.
                직원은 입사할 때 회사가 서류를 이미 받았다. 여기서 다시 막지 않는다.
              */
              /*
                포털 제안도 막는다. 수락하는 순간 확정 배치가 되므로 서버가 서류 없는 사람은
                건너뛴다 — 여기서 고르게 두면 "보냈다"고 믿은 사람에게 제안이 가지 않는다.
              */
              const isDocumentBlocked =
                (status === "CONFIRMED" || status === "OFFER") &&
                !candidate.isEmployee &&
                !candidate.isDocumentApproved;
              /*
                전일 제안은 **하루라도 막히면** 보낼 수 없다(서버가 건너뛴다).
                배치처럼 "나머지 날은 건너뜁니다"로 두면 담당자는 보낸 줄 안다.
              */
              const isOfferFullBlocked =
                isOffer && participation === "FULL" && blockedDates.length > 0;
              const isFullyBlocked =
                availableCount === 0 || isDocumentBlocked || isOfferFullBlocked;
              const hasPartialConflict =
                blockedDates.length > 0 && !isFullyBlocked;
              const isSelected = selectedIds.includes(candidate.staffId);
              const hasHealthCert = hasValidHealthCert(
                candidate.healthCertState,
              );

              return (
                <li key={candidate.staffId}>
                  <label
                    className={cn(
                      "flex items-center gap-3 rounded-field border px-4 py-3 transition",
                      isFullyBlocked
                        ? "cursor-not-allowed border-border-main bg-subtle opacity-60"
                        : "cursor-pointer border-border-main hover:border-brand hover:bg-brand-opacity-3",
                      isSelected && "border-brand bg-surface-selected",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isFullyBlocked}
                      onChange={() => handleToggle(candidate.staffId)}
                    />

                    <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-subtle">
                      <Image
                        src={candidate.profileImageUrl}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[14px] font-medium text-font-1">
                          {candidate.name}
                        </p>
                        {/* 성별 조건이 걸린 포지션이 있어 이름 옆에 늘 함께 보인다. */}
                        <GenderMark gender={candidate.gender} />
                        {candidate.isFavorite && (
                          <Star size={14} className="shrink-0 text-warning" />
                        )}
                        {/*
                          우리 직원.
                          직무 조건과 무관하게 후보로 올라오기 때문에, 표시가 없으면
                          "왜 이 사람이 설치 후보에 있지"에서 담당자가 멈춘다.
                        */}
                        {candidate.isEmployee && (
                          <Badge tone="info">
                            직원{candidate.position ? ` · ${candidate.position}` : ""}
                          </Badge>
                        )}
                        {/* 상위 3명에게만 추천 표시를 붙여 눈이 분산되지 않게 한다. */}
                        {index < 3 && !isFullyBlocked && (
                          <Badge tone="brand" leftIcon={<Sparkle size={11} />}>
                            추천
                          </Badge>
                        )}
                      </div>

                      {/*
                        이 사람이 어떤 일을 할 수 있는가.
                        지금 고르는 자리 말고도 무엇이 되는지가 보여야
                        "스태프가 모자란데 이 사람은 MC도 되네" 같은 판단이 그 자리에서 된다.
                      */}
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {candidate.isEmployee && (
                          <span className="text-[11px] text-font-2">
                            모든 직무 가능
                          </span>
                        )}
                        {[...candidate.roles].sort(compareRoles).map((item) => (
                          <Badge
                            key={item}
                            /* 지금 배치하려는 자리의 직무를 도드라지게 한다. */
                            tone={item === role ? "brand" : "neutral"}
                            className="px-1.5 py-0 text-[11px]"
                          >
                            {jobRoleLabel(item)}
                          </Badge>
                        ))}
                      </div>

                      <p className="mt-0.5 truncate text-[12px] text-font-2 tabular-nums">
                        {formatRegion(candidate.region, candidate.district)} ·
                        누적 {candidate.workCount}회
                        {candidate.lateCount > 0 &&
                          ` · 지각 ${candidate.lateCount}회`}
                        {candidate.clientWorkCount > 0 &&
                          ` · 이 거래처 ${candidate.clientWorkCount}회`}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {/*
                        보건증은 **필요한 자리에서만** 적는다. 모든 후보에 붙이면
                        식음료와 무관한 자리에서도 눈이 거기 걸린다.
                      */}
                      {requiresHealthCert && (
                        <Badge tone={hasHealthCert ? "success" : "warning"}>
                          보건증{" "}
                          {HEALTH_CERT_STATE_LABEL[candidate.healthCertState]}
                        </Badge>
                      )}

                      {/*
                        무엇 때문에 막혔는지를 배지가 그대로 말한다.
                        '서류 미제출' 하나로 뭉뚱그리면, 본인이 이미 올려 둔 사람에게도
                        같은 말이 뜨고 담당자는 다시 받아 오라고 연락하게 된다.
                      */}
                      {!candidate.isEmployee &&
                        candidate.documentReviewState !== "APPROVED" && (
                          <Badge tone={isDocumentBlocked ? "danger" : "warning"}>
                            서류{" "}
                            {
                              DOCUMENT_REVIEW_STATE_LABEL[
                                candidate.documentReviewState
                              ]
                            }
                          </Badge>
                        )}

                      {/*
                        노쇼는 현장에 구멍을 내는 사고라 배치 전에 반드시 보여야 한다.
                      */}
                      {candidate.noShowCount > 0 && (
                        <Badge tone="danger">노쇼 {candidate.noShowCount}회</Badge>
                      )}

                      <RatingStat
                        reputationScore={candidate.reputationScore}
                      />
                    </div>
                  </label>

                  {isDocumentBlocked && (
                    <p className="mt-1 flex items-start gap-1 pl-4 text-[12px] text-danger">
                      <Warning size={13} className="mt-0.5 shrink-0" />
                      <span>
                        {REQUIRED_DOCUMENT_LABEL}이 없어 확정 배치할 수 없습니다.
                        인력 상세에서 서류를 등록하거나, 위 배치 상태를 &lsquo;제안
                        단계&rsquo;로 바꿔 먼저 담아 두세요.
                      </span>
                    </p>
                  )}

                  {isFullyBlocked && !isDocumentBlocked && (
                    <p className="mt-1 flex items-center gap-1 pl-4 text-[12px] text-danger">
                      <Warning size={13} />
                      고른 날에 모두 일정이 있습니다.
                      {candidate.conflictEventTitle &&
                        ` (${candidate.conflictEventTitle})`}
                    </p>
                  )}

                  {hasPartialConflict && (
                    <p className="mt-1 flex items-center gap-1 pl-4 text-[12px] text-warning">
                      <Warning size={13} />
                      {targetDates.length}일 중 {availableCount}일만 가능합니다.
                      나머지 {blockedDates.length}일은 자동으로 건너뜁니다.
                      {candidate.conflictEventTitle &&
                        ` (${candidate.conflictEventTitle})`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
};

export default StaffPickerModal;
