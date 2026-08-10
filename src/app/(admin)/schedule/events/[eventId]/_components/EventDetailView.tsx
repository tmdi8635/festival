"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useContractListQuery } from "@/api/contract/getContractList";
import { useEventDetailQuery } from "@/api/event/getEventDetail";
import { useEventMutation } from "@/api/event/mutateEvent";
import { useHasPermission } from "@/store/useAdminStore";
import { usePayrollSummaryQuery } from "@/api/payroll/getPayrollSummary";
import {
  EVENT_STATUS_OPTIONS,
  EVENT_STATUS_TONE,
} from "@/constants/eventOptions";
import {
  Ban,
  Calendar,
  ChevronLeft,
  Clock,
  Edit,
  MapPin,
  Plus,
  Trash,
} from "@/icons";
import { formatDateRange } from "@/lib/dayjs";
import { cn, formatCurrency } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import {
  formatTimeRange,
  EVENT_STATUS_LABEL,
  describeRecurrence,
  summarizeEventCost,
  summarizeEventProgress,
  type EventStatus,
} from "@/type/event";
import type { JobRole } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dropdown, { type DropdownItem } from "@/components/ui/Dropdown";
import EmptyState from "@/components/ui/EmptyState";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import Tabs, { type TabItem } from "@/components/ui/Tabs";
import PageHeader from "@/components/layout/PageHeader";
import EventFormModal from "@/components/domain/EventFormModal";
import MessageComposer from "@/components/domain/MessageComposer";
import RoleSlotChips from "@/components/domain/RoleSlotChips";
import StaffDetailModal from "@/components/domain/StaffDetailModal";
import StaffPickerModal from "@/components/domain/StaffPickerModal";
import EventAttendancePanel from "./EventAttendancePanel";
import EventContractPanel from "./EventContractPanel";
import EventDailyPanel from "./EventDailyPanel";
import EventNoticePanel from "./EventNoticePanel";
import EventOverviewPanel from "./EventOverviewPanel";
import EventPayrollPanel from "./EventPayrollPanel";

export type EventTab =
  | "OVERVIEW"
  | "DAILY"
  | "ATTENDANCE"
  | "CONTRACT"
  | "PAYROLL"
  | "MESSAGE"
  | "NOTICE";

const EVENT_TABS: EventTab[] = [
  "OVERVIEW",
  "DAILY",
  "ATTENDANCE",
  "CONTRACT",
  "PAYROLL",
  "MESSAGE",
  "NOTICE",
];

/** 잘못된 `?tab=` 값이 들어와도 개요로 떨어지게 한다. */
const isEventTab = (value: string | null): value is EventTab =>
  value !== null && EVENT_TABS.includes(value as EventTab);

const SUMMARY_TONE_CLASS = {
  default: "text-font-0",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

interface SummaryCellProps {
  label: string;
  value: string;
  hint: string;
  tone?: keyof typeof SUMMARY_TONE_CLASS;
  onClick: () => void;
}

/**
 * 상단 요약 한 칸.
 *
 * 숫자만 보여 주고 끝내지 않는다. 누르면 그 숫자를 처리하는 탭으로 바로 넘어간다.
 * ("계약서 미완료 3건"을 보고 계약서 메뉴를 다시 찾아 들어가는 일이 없어야 한다)
 */
const SummaryCell = ({
  label,
  value,
  hint,
  tone = "default",
  onClick,
}: SummaryCellProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-start gap-0.5 rounded-field border border-border-main bg-subtle px-4 py-3 text-left transition hover:-translate-y-px hover:border-brand hover:bg-surface-hover hover:shadow-card active:translate-y-0 active:scale-[0.99]"
  >
    <span className="text-[12px] text-font-2">{label}</span>
    <span
      className={cn(
        "text-[18px] font-bold tabular-nums",
        SUMMARY_TONE_CLASS[tone],
      )}
    >
      {value}
    </span>
    <span className="text-[12px] text-font-2">{hint}</span>
  </button>
);

interface EventDetailViewProps {
  eventId: number;
}

/**
 * 행사 상세 페이지.
 *
 * 상단은 "이 행사가 지금 어디까지 왔는가"를 한 줄로 보여 주고,
 * 탭은 실제로 처리해야 하는 단위(근무자 · 출퇴근 · 계약서 · 정산)로 나눈다.
 * 각 탭은 다른 메뉴의 목록 화면과 같은 데이터를 행사로 좁혀 놓은 것이라,
 * 여기서 끝내면 다른 화면에 다시 들어갈 일이 없다.
 */
const EventDetailView = ({ eventId }: EventDetailViewProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** 탭은 URL에 남긴다. 대시보드 · 다른 화면에서 특정 탭으로 바로 보낼 수 있어야 한다. */
  const paramTab = searchParams.get("tab");
  const [draftTab, setDraftTab] = useState<EventTab | null>(null);
  const tab = draftTab ?? (isEventTab(paramTab) ? paramTab : "OVERVIEW");

  const [pickerRole, setPickerRole] = useState<JobRole | undefined>(undefined);
  const [pickerDates, setPickerDates] = useState<string[] | undefined>(undefined);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [detailStaffId, setDetailStaffId] = useState<number | null>(null);

  const { data: event, isLoading, isError } = useEventDetailQuery(eventId);
  /*
    행사 상세는 행사 자체와 배치를 함께 다룬다.
    상태 변경 · 수정은 `event:write`, 삭제는 `event:delete`,
    사람을 붙이는 것은 `assignment:write`다.
  */
  const canWriteEvent = useHasPermission("event:write");
  const canDeleteEvent = useHasPermission("event:delete");
  const canAssign = useHasPermission("assignment:write");
  const canReadContract = useHasPermission("contract:read");
  const canReadPayroll = useHasPermission("payroll:read");
  const canReadAssignment = useHasPermission("assignment:read");
  const canReadMessage = useHasPermission("message:read");

  const { statusMutation, deleteMutation } = useEventMutation();

  /* 상단 요약과 탭 개수에 쓸 값. 목록 자체는 각 탭이 같은 쿼리키로 다시 받는다. */
  /* 권한이 없으면 조회 자체가 나가지 않는다. (`usePermittedQuery`) */
  const { data: contractData } = useContractListQuery({
    page: 1,
    size: 1,
    eventId: String(eventId),
  });
  const { data: payrollSummary } = usePayrollSummaryQuery({
    eventId: String(eventId),
  });

  const handleChangeTab = (next: EventTab) => {
    setDraftTab(next);
    // 새로고침·공유에도 같은 탭이 열리도록 URL을 맞춰 둔다. (히스토리는 쌓지 않는다)
    router.replace(`/schedule/events/${eventId}?tab=${next}`, {
      scroll: false,
    });
  };

  const handleOpenPicker = (role?: JobRole, dates?: string[]) => {
    setPickerRole(role);
    setPickerDates(dates);
    setIsPickerOpen(true);
  };

  const handleCancelEvent = () => {
    if (!event) return;

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

  const handleDeleteEvent = () => {
    if (!event) return;

    openConfirm({
      title: "행사를 삭제할까요?",
      description: `'${event.title}' 행사와 배치 내역이 함께 사라집니다.`,
      warning: "되돌릴 수 없습니다. 취소 처리로 남겨 두는 편이 안전합니다.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: async () => {
        await deleteMutation.mutateAsync(event.eventId);
        router.push("/schedule/events");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-full max-w-96" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <Card>
        <EmptyState
          icon={<Calendar size={40} />}
          title="행사를 찾을 수 없습니다."
          description="삭제됐거나 주소가 잘못됐을 수 있습니다."
          action={
            <Link href="/schedule/events">
              <Button variant="primary">행사 목록으로</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const progress = summarizeEventProgress(event.assignments);
  const { laborCost, revenue, margin, dailyWorkHours } =
    summarizeEventCost(event);

  /* 문자 수신 대상은 **사람** 수다. 배치(사람×날짜)를 그대로 세면 부풀려진다. */
  const messageTargetCount = new Set(
    event.assignments
      .filter((assignment) => assignment.status === "CONFIRMED")
      .map((assignment) => assignment.staffId),
  ).size;

  const rowActions: DropdownItem[] = [
    ...(canWriteEvent
      ? [
          {
            label: "행사 취소",
            icon: <Ban size={15} />,
            tone: "danger" as const,
            disabled: event.status === "CANCELED" || event.status === "DONE",
            onSelect: handleCancelEvent,
          },
        ]
      : []),
    ...(canDeleteEvent
      ? [
          {
            label: "삭제",
            icon: <Trash size={15} />,
            tone: "danger" as const,
            onSelect: handleDeleteEvent,
          },
        ]
      : []),
  ];

  /*
    탭도 메뉴와 같은 규칙으로 감춘다.
    행사 상세는 계약서 · 정산까지 한자리에 모아 두는 화면이라,
    권한이 없는 탭을 남겨 두면 눌러 보고 거부당하기를 반복하게 된다.
  */
  const tabs: TabItem<EventTab>[] = [
    { label: "개요", value: "OVERVIEW" },
    { label: "일별 근무자", value: "DAILY", count: event.dayCount },
    ...(canReadAssignment
      ? [
          {
            label: "출퇴근 명부",
            value: "ATTENDANCE" as const,
            count: progress.totalCount,
          },
        ]
      : []),
    ...(canReadContract
      ? [
          {
            label: "근로계약서",
            value: "CONTRACT" as const,
            count: contractData?.totalCount ?? 0,
          },
        ]
      : []),
    ...(canReadPayroll
      ? [
          {
            label: "정산",
            value: "PAYROLL" as const,
            count: payrollSummary?.totalCount ?? 0,
          },
        ]
      : []),
    /*
      문자 발송.

      메뉴의 문자 발송은 **행사를 골라서** 보내는 자리이고, 이 탭은
      **지금 보고 있는 행사에** 바로 보내는 자리다. 행사를 다시 고르는 단계가
      없어야 잘못된 행사 인원에게 나가는 사고가 생기지 않는다.
    */
    ...(canReadMessage
      ? [
          {
            label: "문자 발송",
            value: "MESSAGE" as const,
            /* 문자는 사람당 한 통이다. 사흘 나오는 사람에게 세 번 보내지 않는다. */
            count: messageTargetCount,
          },
        ]
      : []),
    { label: "안내 · 명단", value: "NOTICE" },
  ];

  /* 주소로 직접 들어온 탭이 감춰진 탭이면 개요로 되돌린다. */
  const visibleTab = tabs.some((item) => item.value === tab) ? tab : "OVERVIEW";

  return (
    <>
      {/* 목록으로 돌아가는 길을 항상 열어 둔다. 페이지로 올라오면서 닫기 버튼이 사라졌다. */}
      <Link
        href="/schedule/events"
        className="-mb-2 flex w-fit items-center gap-1 text-[13px] text-font-2 transition hover:text-brand"
      >
        <ChevronLeft size={15} />
        행사 목록
      </Link>

      <PageHeader
        title={event.title}
        description={`${event.clientName} · 담당 ${event.managerName}`}
        action={
          <>
            {canWriteEvent && (
              <>
                <Select
                  aria-label="행사 상태 변경"
                  options={EVENT_STATUS_OPTIONS}
                  value={event.status}
                  onChange={(changeEvent) =>
                    statusMutation.mutate({
                      eventId: event.eventId,
                      status: changeEvent.target.value as EventStatus,
                    })
                  }
                  selectBoxClassName="w-36"
                />

                <Button
                  variant="secondary"
                  leftIcon={<Edit size={15} />}
                  onClick={() => setIsFormOpen(true)}
                >
                  행사 수정
                </Button>
              </>
            )}

            {canAssign && (
              <Button
                variant="primary"
                leftIcon={<Plus size={15} />}
                onClick={() => handleOpenPicker()}
              >
                인력 배치
              </Button>
            )}

            {rowActions.length > 0 && <Dropdown items={rowActions} />}
          </>
        }
      />

      <Card noPadding>
        {/* 행사 기본 정보. 어느 탭에 있든 "지금 무슨 행사를 보고 있는지"가 보여야 한다. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-main px-5 py-3.5">
          <Badge tone={EVENT_STATUS_TONE[event.status]}>
            {EVENT_STATUS_LABEL[event.status]}
          </Badge>

          <span className="flex items-center gap-1.5 text-[13px] text-font-1">
            <Calendar size={14} className="text-font-2" />
            <span className="tabular-nums">
              {formatDateRange(event.startDate, event.endDate)}
            </span>
            <span className="text-font-2">
              · {describeRecurrence(event.recurrence, event.dayCount)}
            </span>
          </span>

          <span className="flex items-center gap-1.5 text-[13px] text-font-1">
            <Clock size={14} className="text-font-2" />
            <span className="tabular-nums">
              {formatTimeRange(
                event.startTime,
                event.endTime,
                event.endDayOffset,
              )}
            </span>
            <span className="text-font-2">· 하루 {dailyWorkHours}시간</span>
          </span>

          <span className="flex items-center gap-1.5 text-[13px] text-font-1">
            <MapPin size={14} className="text-font-2" />
            {event.venue}
          </span>

          <RoleSlotChips roles={event.roles} className="ml-auto" />
        </div>

        {/*
          처리 현황 요약.
          예전에는 계약서가 몇 장 남았는지 보려면 계약서 메뉴에서 행사를 다시 검색해야 했다.
          각 칸을 누르면 그 일을 끝낼 수 있는 탭으로 바로 넘어간다.
        */}
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-5">
          <SummaryCell
            label="확정 인원"
            value={`${event.totalAssigned} / ${event.totalRequired}명`}
            hint={
              progress.waitlistCount > 0
                ? `대기 ${progress.waitlistCount}명`
                : "전체 근무일 합계"
            }
            tone={
              event.totalAssigned < event.totalRequired ? "danger" : "success"
            }
            onClick={() => handleChangeTab("DAILY")}
          />
          <SummaryCell
            label="근로계약서"
            /* 분모는 계약 대상만이다. 직원은 회사와 이미 계약이 되어 있어 빠진다. */
            value={`${progress.contractSignedCount} / ${progress.contractTargetCount}건`}
            hint={
              progress.contractMissingCount > 0
                ? `미완료 ${progress.contractMissingCount}건`
                : "서명 완료"
            }
            tone={progress.contractMissingCount > 0 ? "danger" : "success"}
            onClick={() => handleChangeTab("CONTRACT")}
          />
          <SummaryCell
            label="출퇴근 기록"
            value={`${progress.checkTimeRecordedCount} / ${progress.confirmedCount}건`}
            hint={
              progress.checkTimeMissingCount > 0
                ? `미기록 ${progress.checkTimeMissingCount}건`
                : `근태 이슈 ${progress.issueCount}건`
            }
            tone={progress.checkTimeMissingCount > 0 ? "warning" : "success"}
            onClick={() => handleChangeTab("ATTENDANCE")}
          />
          <SummaryCell
            label="정산 미지급"
            value={formatCurrency(payrollSummary?.unpaidAmount ?? 0)}
            hint={
              (payrollSummary?.provisionalCount ?? 0) > 0
                ? `${payrollSummary?.provisionalCount}건 예정 기준 잠정`
                : `지급 완료 ${payrollSummary?.paidCount ?? 0}건`
            }
            tone={
              (payrollSummary?.unpaidAmount ?? 0) > 0 ? "warning" : "success"
            }
            onClick={() => handleChangeTab("PAYROLL")}
          />
          <SummaryCell
            label="예상 마진"
            value={formatCurrency(margin)}
            hint={`매출 ${formatCurrency(revenue)} · 인건비 ${formatCurrency(laborCost)}`}
            tone={margin >= 0 ? "success" : "danger"}
            onClick={() => handleChangeTab("OVERVIEW")}
          />
        </div>
      </Card>

      <Tabs items={tabs} value={visibleTab} onChange={handleChangeTab} />

      {visibleTab === "OVERVIEW" && (
        <EventOverviewPanel event={event} onFillRole={handleOpenPicker} />
      )}

      {visibleTab === "DAILY" && (
        <EventDailyPanel
          event={event}
          onAddStaff={handleOpenPicker}
          onOpenStaff={setDetailStaffId}
        />
      )}

      {visibleTab === "ATTENDANCE" && (
        <EventAttendancePanel event={event} onOpenStaff={setDetailStaffId} />
      )}

      {visibleTab === "CONTRACT" && <EventContractPanel event={event} />}

      {visibleTab === "PAYROLL" && <EventPayrollPanel event={event} />}

      {visibleTab === "MESSAGE" && <MessageComposer fixedEvent={event} />}

      {visibleTab === "NOTICE" && <EventNoticePanel event={event} />}

      <StaffPickerModal
        event={isPickerOpen ? event : null}
        initialRole={pickerRole}
        initialDates={pickerDates}
        onClose={() => setIsPickerOpen(false)}
      />

      <EventFormModal
        isOpen={isFormOpen}
        event={event}
        onClose={() => setIsFormOpen(false)}
      />

      <StaffDetailModal
        staffId={detailStaffId}
        onClose={() => setDetailStaffId(null)}
      />
    </>
  );
};

export default EventDetailView;
