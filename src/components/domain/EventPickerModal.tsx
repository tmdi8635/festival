"use client";

import { useState } from "react";
import { useEventListQuery } from "@/api/event/getEventList";
import {
  EVENT_STATUS_FILTER_OPTIONS,
  EVENT_STATUS_TONE,
} from "@/constants/eventOptions";
import { Calendar, Check, MapPin } from "@/icons";
import { formatDateRange, formatDday } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import {
  EVENT_STATUS_LABEL,
  describeRecurrence,
  type EventStatus,
  type EventSummary,
} from "@/type/event";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import RoleSlotChips from "./RoleSlotChips";

interface EventPickerModalProps {
  isOpen: boolean;
  /** 이미 고른 행사. 다시 열었을 때 표시해 준다. */
  selectedEventId?: number;
  onSelect: (event: EventSummary) => void;
  onClose: () => void;
  /** 상황에 맞는 안내를 넣는다. (계약서 생성 / 공고 등록 / 문자 발송) */
  description?: string;
}

const PAGE_SIZE = 8;

/**
 * 행사 선택 모달.
 *
 * 예전에는 드롭다운으로 골랐다. 그런데 행사명이 대개
 * "브랜드 팝업스토어 운영"처럼 비슷비슷해서, 목록에서 이름만 봐서는
 * 어느 건인지 알 수 없었다. 결국 캘린더를 따로 열어 확인하고 돌아와야 했다.
 *
 * 그래서 최근 행사부터 쭉 나열하고, 날짜 · 장소 · 충원 현황까지 함께 보여 준다.
 * 검색과 상태 필터도 붙여 행사가 쌓여도 찾을 수 있게 한다.
 */
const EventPickerModal = ({
  isOpen,
  selectedEventId,
  onSelect,
  onClose,
  description,
}: EventPickerModalProps) => {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<EventStatus | "">("");

  const { data, isLoading } = useEventListQuery(
    {
      page,
      size: PAGE_SIZE,
      keyword: keyword || undefined,
      status: status || undefined,
    },
    // 모달이 닫혀 있을 때까지 목록을 불러올 이유가 없다.
    isOpen,
  );

  const events = data?.content ?? [];

  const handleClose = () => {
    setPage(1);
    setKeyword("");
    setStatus("");
    onClose();
  };

  const handleSelect = (event: EventSummary) => {
    onSelect(event);
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="행사 선택"
      description={description ?? "최근 등록된 행사부터 보여 줍니다."}
      size="lg"
      footer={
        <Button variant="ghost" onClick={handleClose}>
          닫기
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SearchInput
            value={keyword}
            onSearch={(next) => {
              setKeyword(next);
              setPage(1);
            }}
            placeholder="행사명 · 거래처 · 장소 검색"
          />

          <Select
            aria-label="상태 필터"
            options={EVENT_STATUS_FILTER_OPTIONS}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as EventStatus | "");
              setPage(1);
            }}
            selectBoxClassName="w-32"
          />
        </div>

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-field" />
            ))}
          </div>
        )}

        {!isLoading && events.length === 0 && (
          <EmptyState
            title="조건에 맞는 행사가 없습니다."
            description="검색어나 상태 필터를 바꿔서 다시 찾아보세요."
          />
        )}

        {!isLoading && events.length > 0 && (
          <ul className="flex flex-col gap-2">
            {events.map((event) => {
              const isSelected = event.eventId === selectedEventId;
              const isUnderstaffed = event.totalAssigned < event.totalRequired;

              return (
                <li key={event.eventId}>
                  <button
                    type="button"
                    onClick={() => handleSelect(event)}
                    className={cn(
                      "flex w-full flex-col gap-2 rounded-field border px-4 py-3 text-left transition",
                      "hover:border-brand hover:bg-brand-opacity-3 active:scale-[0.995]",
                      isSelected
                        ? "border-brand bg-brand-opacity-3"
                        : "border-border-main",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-font-1">
                        {event.title}
                      </span>

                      {isSelected && (
                        <Badge tone="brand" leftIcon={<Check size={12} />}>
                          선택됨
                        </Badge>
                      )}

                      <Badge tone={EVENT_STATUS_TONE[event.status]}>
                        {EVENT_STATUS_LABEL[event.status]}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-font-2">
                      <span className="flex items-center gap-1 tabular-nums">
                        <Calendar size={13} />
                        {formatDateRange(event.startDate, event.endDate)}
                        {" · "}
                        {describeRecurrence(event.recurrence, event.dayCount)}
                      </span>

                      <span className="flex items-center gap-1">
                        <MapPin size={13} />
                        {event.venue}
                      </span>

                      <span>{event.clientName}</span>
                      <span className="tabular-nums">
                        {formatDday(event.startDate)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <RoleSlotChips roles={event.roles} isCompact />

                      <span
                        className={cn(
                          "shrink-0 text-[12px] font-medium tabular-nums",
                          isUnderstaffed ? "text-danger" : "text-success",
                        )}
                      >
                        {event.totalAssigned}/{event.totalRequired}명
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </div>
    </Modal>
  );
};

export default EventPickerModal;
