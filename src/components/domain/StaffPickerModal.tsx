"use client";

import Image from "next/image";
import { useState } from "react";
import { useAssignmentCandidateQuery } from "@/api/event/getAssignmentCandidates";
import { useAssignmentMutation } from "@/api/event/mutateAssignment";
import { useJobRoleLabel, useJobRoleOptions } from "@/store/useOrgStore";
import { Sparkle, Star, Warning } from "@/icons";
import { cn } from "@/lib/utils";
import {
  formatTimeRange,
  WEEKDAY_LABELS,
  describeRecurrence,
  type AssignmentStatus,
  type EventDetail,
} from "@/type/event";
import { formatRegion, type JobRole } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import RatingStat from "./RatingStat";

interface StaffPickerModalProps {
  event: EventDetail | null;
  /** 모달을 열 때 미리 선택해 둘 직무 (부족한 직무에서 바로 열 수 있게) */
  initialRole?: JobRole;
  /**
   * 모달을 열 때 미리 골라 둘 근무일.
   *
   * 일자별 근무자 화면에서 "이 날 한 명 더"를 누르면 그날만 선택된 채로 열려야 한다.
   * 비우면 행사의 모든 근무일이 대상이다.
   */
  initialDates?: string[];
  onClose: () => void;
}

const ASSIGNMENT_STATUS_OPTIONS = [
  { label: "확정 배치", value: "CONFIRMED" },
  { label: "대기 인력", value: "WAITLIST" },
  { label: "제안 단계", value: "PROPOSED" },
];

/**
 * 인력 배치 모달.
 *
 * 대표가 머릿속으로 하던 판단(누굴 넣지)을 화면이 대신 정렬해 준다.
 * - 즐겨찾기 → 해당 거래처 경험 → 평판 → 누적 근무 순으로 추천 점수를 매긴다.
 * - 같은 날 다른 행사에 확정된 사람은 기본적으로 목록에서 빼고,
 *   굳이 봐야 할 때만 켜서 보되 선택은 막는다. (중복 배치가 현장 펑크의 주원인이다)
 */
const StaffPickerModal = ({
  event,
  initialRole,
  initialDates,
  onClose,
}: StaffPickerModalProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const jobRoleOptions = useJobRoleOptions();

  /*
    고르기 전에는 호출부가 지정한 직무를 그대로 쓰고, 고르면 draft가 화면을 담당한다.
    useState 초기값으로 두면 모달이 계속 마운트된 채 열고 닫히므로
    "부족한 직무의 채우기"로 다시 열어도 처음 열었을 때의 직무가 남는다.
    (직무가 통째로 바뀐 에이전시에서도 첫 직무가 늘 유효하도록 목록에서 고른다)
  */
  const [draftRole, setDraftRole] = useState<JobRole | null>(null);
  const role =
    draftRole ?? initialRole ?? jobRoleOptions[0]?.value ?? "STAFF";
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<AssignmentStatus>("CONFIRMED");
  const [includeUnavailable, setIncludeUnavailable] = useState(false);
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

  const { data, isLoading } = useAssignmentCandidateQuery(
    {
      eventId: event?.eventId ?? 0,
      role,
      keyword: keyword || undefined,
      includeUnavailable,
      // 고른 날 기준으로 겹침을 계산해야 "이 날만 가능한 사람"이 걸러지지 않는다.
      dates: targetDates.join(","),
    },
    Boolean(event),
  );

  const { createMutation } = useAssignmentMutation();

  const candidates = data?.items ?? [];

  /*
    부족 인원은 **고른 근무일 기준**으로 센다.
    행사 전체 합계로 안내하면, 일자별 근무자에서 "그 날 그 직무"를 눌러 열었을 때
    "이 날은 다 찼는데 6명이 더 필요합니다"처럼 엇갈린 말이 나온다.
  */
  const targetSlots = (event?.days ?? [])
    .filter((day) => targetDates.includes(day.date))
    .flatMap((day) => day.roles.filter((item) => item.role === role));
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
    setDraftRole(null);
    setKeyword("");
    onClose();
  };

  const handleSubmit = () => {
    if (!event) return;

    createMutation.mutate(
      {
        eventId: event.eventId,
        staffIds: selectedIds,
        dates: targetDates,
        role,
        status,
      },
      { onSuccess: () => handleClose() },
    );
  };

  return (
    <Modal
      isOpen={Boolean(event)}
      onClose={handleClose}
      title="인력 배치"
      description={
        event
          ? `${event.title} · ${describeRecurrence(event.recurrence, event.dayCount)} · ${formatTimeRange(event.startTime, event.endTime, event.endDayOffset)}`
          : undefined
      }
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={selectedIds.length === 0 || targetDates.length === 0}
            isLoading={createMutation.isPending}
          >
            {selectedIds.length}명 ×{" "}
            {targetDates.length === eventDates.length
              ? "전체"
              : `${targetDates.length}일`}{" "}
            배치
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {shortage > 0 && (
          <Alert
            tone="warning"
            title={`고른 근무일 기준 ${jobRoleLabel(role)} ${shortage}명이 더 필요합니다.`}
          >
            추천 순서대로 채우면 현장 적응이 빠른 인력부터 배치됩니다.
          </Alert>
        )}

        {/*
          발주를 다 채웠거나 아예 발주에 없는 직무여도 배치를 막지 않는다.
          현장에서 "한 명 더", "설치 인력 추가"가 수시로 생기고,
          그때마다 발주 인원을 먼저 고쳐야 한다면 아무도 그렇게 쓰지 않는다.
        */}
        {shortage === 0 && (
          <Alert
            tone="info"
            title={
              hasOrder
                ? `고른 근무일의 ${jobRoleLabel(role)} 발주 인원은 이미 채웠습니다.`
                : `${jobRoleLabel(role)}은 고른 근무일의 발주에 없는 직무입니다.`
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
            <div className="flex items-center justify-between">
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <SearchInput
            value={keyword}
            onSearch={setKeyword}
            placeholder="이름 · 연락처 · 지역 검색"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="배치할 직무"
              options={jobRoleOptions}
              value={role}
              onChange={(event) => {
                setDraftRole(event.target.value as JobRole);
                setSelectedIds([]);
              }}
              selectBoxClassName="w-36"
            />

            <Select
              aria-label="배치 상태"
              options={ASSIGNMENT_STATUS_OPTIONS}
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as AssignmentStatus)
              }
              selectBoxClassName="w-32"
            />
          </div>
        </div>

        <Checkbox
          label="같은 날 다른 행사에 확정된 인력도 보기"
          checked={includeUnavailable}
          onChange={(changeEvent) =>
            setIncludeUnavailable(changeEvent.target.checked)
          }
        />

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
            description="직무를 바꾸거나 검색어를 지워서 다시 찾아보세요."
          />
        )}

        {!isLoading && candidates.length > 0 && (
          <ul className="flex flex-col gap-2">
            {candidates.map((candidate, index) => {
              /*
                반복 행사에서는 "일부 날만 겹치는" 사람이 대부분이다.
                예전처럼 하나라도 겹치면 통째로 막아 버리면, 나올 수 있는 날까지
                놓치게 된다. 고른 날이 전부 막힌 사람만 선택을 막고,
                일부만 겹치는 사람은 몇 날이 빠지는지 알려 준 뒤 고르게 한다.
              */
              const blockedDates = targetDates.filter(
                (date) =>
                  candidate.conflictDates.includes(date) ||
                  candidate.assignedDates.includes(date),
              );
              const availableCount = targetDates.length - blockedDates.length;
              const isFullyBlocked = availableCount === 0;
              const hasPartialConflict =
                blockedDates.length > 0 && !isFullyBlocked;
              const isSelected = selectedIds.includes(candidate.staffId);

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
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[14px] font-medium text-font-1">
                          {candidate.name}
                        </p>
                        {candidate.isFavorite && (
                          <Star size={14} className="shrink-0 text-warning" />
                        )}
                        {/* 상위 3명에게만 추천 표시를 붙여 눈이 분산되지 않게 한다. */}
                        {index < 3 && !isFullyBlocked && (
                          <Badge tone="brand" leftIcon={<Sparkle size={11} />}>
                            추천
                          </Badge>
                        )}
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

                    <div className="flex shrink-0 items-center gap-2">
                      {!candidate.isDocumentComplete && (
                        <Badge tone="warning">서류 미제출</Badge>
                      )}

                      {/*
                        노쇼는 현장에 구멍을 내는 사고라 배치 전에 반드시 보여야 한다.
                        예전에는 '신뢰도' 점수 안에 묻혀 있어 눈에 띄지 않았다.
                      */}
                      {candidate.noShowCount > 0 && (
                        <Badge tone="danger">노쇼 {candidate.noShowCount}회</Badge>
                      )}

                      <RatingStat
                        goodCount={candidate.goodCount}
                        badCount={candidate.badCount}
                        variant="badge"
                      />
                    </div>
                  </label>

                  {isFullyBlocked && (
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
