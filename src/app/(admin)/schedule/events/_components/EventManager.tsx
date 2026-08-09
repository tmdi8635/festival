"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useClientListQuery } from "@/api/client/getClientList";
import { useEventListQuery } from "@/api/event/getEventList";
import { useEventMutation } from "@/api/event/mutateEvent";
import {
  EVENT_STATUS_FILTER_OPTIONS,
  EVENT_STATUS_TONE,
} from "@/constants/eventOptions";
import { useBooleanParam } from "@/hooks/useBooleanParam";
import { useKeywordParam } from "@/hooks/useKeywordParam";
import { Ban, Eye, Plus, Trash } from "@/icons";
import { formatDateRange, formatDday } from "@/lib/dayjs";
import type { CsvColumn } from "@/lib/csv";
import { openConfirm } from "@/store/useConfirmStore";
import { jobRoleLabel } from "@/store/useOrgStore";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  formatTimeRange,
  EVENT_STATUS_LABEL,
  type EventStatus,
  type EventSummary,
} from "@/type/event";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import DateRangeFilter, { type DateRange } from "@/components/ui/DateRangeFilter";
import Dropdown, { type DropdownItem } from "@/components/ui/Dropdown";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import EventFormModal from "@/components/domain/EventFormModal";
import RoleSlotChips from "@/components/domain/RoleSlotChips";

/** CSV 컬럼은 표와 같은 순서로 두어 내려받은 파일이 화면과 일치하게 한다. */
const EVENT_CSV_COLUMNS: CsvColumn<EventSummary>[] = [
  { header: "행사 ID", value: (row) => row.eventId },
  { header: "행사명", value: (row) => row.title },
  { header: "거래처", value: (row) => row.clientName },
  { header: "상태", value: (row) => EVENT_STATUS_LABEL[row.status] },
  { header: "시작일", value: (row) => row.startDate },
  { header: "종료일", value: (row) => row.endDate },
  {
    header: "근무시간",
    value: (row) => formatTimeRange(row.startTime, row.endTime, row.endDayOffset),
  },
  { header: "장소", value: (row) => row.venue },
  { header: "담당 매니저", value: (row) => row.managerName },
  { header: "발주 인원", value: (row) => row.totalRequired },
  { header: "확정 인원", value: (row) => row.totalAssigned },
  {
    header: "직무별 현황",
    value: (row) =>
      row.roles
        .map(
          (slot) =>
            `${jobRoleLabel(slot.role)} ${slot.assignedCount}/${slot.requiredCount}`,
        )
        .join(" · "),
  },
];

/**
 * 행사 목록.
 *
 * 캘린더가 "언제"를 본다면 이 화면은 "무엇이 밀려 있나"를 본다.
 * 그래서 미충원 필터를 필터 바 안에 상시 노출한다.
 */
const EventManager = () => {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const keywordParam = useKeywordParam();
  const [draftKeyword, setDraftKeyword] = useState<string | null>(null);
  const keyword = draftKeyword ?? keywordParam;

  const [status, setStatus] = useState<EventStatus | "">("");
  const [clientId, setClientId] = useState("");
  const [range, setRange] = useState<DateRange>({ startDate: "", endDate: "" });
  /** 대시보드의 '인원 미충원' 할 일에서 넘어오면 필터가 걸린 채로 열린다. */
  const understaffedParam = useBooleanParam("onlyUnderstaffed");
  const [draftUnderstaffed, setDraftUnderstaffed] = useState<boolean | null>(
    null,
  );
  const onlyUnderstaffed = draftUnderstaffed ?? understaffedParam;
  const setOnlyUnderstaffed = setDraftUnderstaffed;

  const [isFormOpen, setIsFormOpen] = useState(false);

  /** 상세는 모달이 아니라 페이지다. 행사 하나를 끝내는 작업이 모달에 담기지 않는다. */
  const openDetail = (eventId: number) =>
    router.push(`/schedule/events/${eventId}`);

  const { data, isLoading } = useEventListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    status: status || undefined,
    clientId: clientId || undefined,
    startDate: range.startDate || undefined,
    endDate: range.endDate || undefined,
    onlyUnderstaffed: onlyUnderstaffed || undefined,
  });

  const { data: clientData } = useClientListQuery({ page: 1, size: 100 });
  const { statusMutation, deleteMutation } = useEventMutation();

  const clientOptions = [
    { label: "전체 거래처", value: "" },
    ...(clientData?.content ?? []).map((client) => ({
      label: client.name,
      value: String(client.clientId),
    })),
  ];

  /** 검색·필터가 바뀌면 항상 첫 페이지로 돌아간다. */
  const handleSearch = (nextKeyword: string) => {
    setDraftKeyword(nextKeyword);
    setPage(1);
  };

  const handleCancel = (event: EventSummary) => {
    openConfirm({
      title: "행사를 취소할까요?",
      description: `'${event.title}' 행사를 취소 상태로 바꿉니다.`,
      warning:
        "배치된 인력에게는 자동으로 안내가 나가지 않습니다. 취소 문자를 따로 보내야 합니다.",
      confirmText: "취소 처리",
      tone: "danger",
      onConfirm: () =>
        statusMutation.mutateAsync({
          eventId: event.eventId,
          status: "CANCELED",
        }),
    });
  };

  const handleDelete = (event: EventSummary) => {
    openConfirm({
      title: "행사를 삭제할까요?",
      description: `'${event.title}' 행사와 배치 내역이 함께 사라집니다.`,
      warning: "되돌릴 수 없습니다. 취소 처리로 남겨 두는 편이 안전합니다.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: () => deleteMutation.mutateAsync(event.eventId),
    });
  };

  const buildRowActions = (event: EventSummary): DropdownItem[] => [
    {
      label: "상세 보기",
      icon: <Eye size={15} />,
      onSelect: () => openDetail(event.eventId),
    },
    {
      label: "행사 취소",
      icon: <Ban size={15} />,
      tone: "danger",
      disabled: event.status === "CANCELED" || event.status === "DONE",
      onSelect: () => handleCancel(event),
    },
    {
      label: "삭제",
      icon: <Trash size={15} />,
      tone: "danger",
      onSelect: () => handleDelete(event),
    },
  ];

  const columns: TableColumn<EventSummary>[] = [
    {
      key: "title",
      header: "행사",
      render: (event) => (
        <TableCellStack
          primary={event.title}
          secondary={`${event.clientName} · ${event.venue}`}
        />
      ),
    },
    {
      key: "schedule",
      header: "일정",
      numeric: true,
      render: (event) => (
        <TableCellStack
          primary={
            <span className="tabular-nums">
              {formatDateRange(event.startDate, event.endDate)}
            </span>
          }
          secondary={
            <span className="tabular-nums">
              {formatTimeRange(
                event.startTime,
                event.endTime,
                event.endDayOffset,
              )}{" "}
              · {formatDday(event.startDate)}
            </span>
          }
        />
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (event) => (
        <Badge tone={EVENT_STATUS_TONE[event.status]}>
          {EVENT_STATUS_LABEL[event.status]}
        </Badge>
      ),
    },
    {
      key: "roles",
      header: "직무별 충원",
      render: (event) => <RoleSlotChips roles={event.roles} isCompact />,
    },
    {
      key: "progress",
      header: "확정 / 발주",
      align: "right",
      numeric: true,
      render: (event) => (
        <span
          className={
            event.totalAssigned < event.totalRequired
              ? "font-medium text-danger"
              : "text-font-1"
          }
        >
          {event.totalAssigned} / {event.totalRequired}
        </span>
      ),
    },
    {
      key: "managerName",
      header: "담당",
      render: (event) => (
        <span className="text-[13px] text-font-2">{event.managerName}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "56px",
      align: "center",
      render: (event) => (
        // 행 클릭(상세 모달)과 겹치지 않도록 액션 영역에서 이벤트를 멈춘다.
        <div
          className="flex justify-center"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <Dropdown items={buildRowActions(event)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <Card noPadding>
        <div className="flex items-center justify-between gap-3 border-b border-border-main px-5 py-3.5">
          <div className="flex items-center gap-3">
            <SearchInput
              value={keyword}
              onSearch={handleSearch}
              placeholder="행사명 · 거래처 · 장소 검색"
            />

            <Checkbox
              label="미충원 행사만"
              boxClassName="whitespace-nowrap"
              checked={onlyUnderstaffed}
              onChange={(event) => {
                setOnlyUnderstaffed(event.target.checked);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <CsvExportButton
              fileName="행사목록"
              rows={data?.content ?? []}
              columns={EVENT_CSV_COLUMNS}
              disabled={isLoading}
            />

            <Select
              aria-label="거래처 필터"
              options={clientOptions}
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setPage(1);
              }}
              selectBoxClassName="w-44"
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

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => setIsFormOpen(true)}
            >
              행사 등록
            </Button>
          </div>
        </div>

        <div className="border-b border-border-main px-5 py-3">
          <DateRangeFilter
            value={range}
            onChange={(next) => {
              setRange(next);
              setPage(1);
            }}
          />
        </div>

        <Table
          columns={columns}
          rows={data?.content ?? []}
          getRowKey={(event) => String(event.eventId)}
          isLoading={isLoading}
          onRowClick={(event) => openDetail(event.eventId)}
          emptyTitle="조건에 맞는 행사가 없습니다."
          emptyDescription="기간이나 상태 필터를 바꿔서 다시 찾아보세요."
          emptyAction={
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              onClick={() => setIsFormOpen(true)}
            >
              행사 등록
            </Button>
          }
        />

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={DEFAULT_PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      {/* 목록에서는 등록만 한다. 수정은 행사 상세 페이지에서 이어서 처리한다. */}
      <EventFormModal
        isOpen={isFormOpen}
        event={null}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
};

export default EventManager;
