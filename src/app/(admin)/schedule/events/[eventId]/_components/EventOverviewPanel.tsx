"use client";

import { Building, Calendar, Clock, MapPin } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency, formatWithCommas } from "@/lib/utils";
import { useJobRoleComparator, useJobRoleLabel } from "@/store/useOrgStore";
import {
  WAGE_TYPE_LABEL,
  describeRecurrence,
  formatTimeRange,
  groupConsecutiveDates,
  summarizeEventCost,
  type EventDetail,
} from "@/type/event";
import type { JobRole } from "@/type/staff";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

/** 라벨 · 값 한 줄. 개요에서만 쓴다. */
const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex gap-3 border-b border-border-main py-2.5 last:border-b-0">
    <p className="w-24 shrink-0 text-[13px] text-font-2">{label}</p>
    <div className="min-w-0 flex-1 text-[14px] text-font-1">{value}</div>
  </div>
);

interface EventOverviewPanelProps {
  event: EventDetail;
  /** 부족한 직무에서 바로 배치 모달을 연다. */
  onFillRole: (role?: JobRole) => void;
}

/**
 * 개요 탭.
 *
 * 거래처에 다시 물어보지 않아도 되도록 발주 조건을 전부 한 화면에 둔다.
 * 집합 장소 · 복장 · 준비물은 안내 문구로 그대로 나가므로 여기서 확인한다.
 */
const EventOverviewPanel = ({ event, onFillRole }: EventOverviewPanelProps) => {
  const jobRoleLabel = useJobRoleLabel();
  // 발주 목록도 기준 설정에서 정한 직무 순서로 세운다.
  const compareRoles = useJobRoleComparator();
  const sortedRoles = [...event.roles].sort((a, b) =>
    compareRoles(a.role, b.role),
  );
  const { dailyWorkHours, laborCost, revenue, margin } =
    summarizeEventCost(event);

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card title="발주 조건" className="col-span-2" bodyClassName="px-5 py-1">
        <DetailRow
          label="반복"
          value={
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-font-2" />
              {describeRecurrence(event.recurrence, event.dayCount)} ·{" "}
              {formatDate(event.startDate)} ~ {formatDate(event.endDate)} (
              {groupConsecutiveDates(event.dates).length}개 구간)
            </span>
          }
        />
        <DetailRow
          label="근무 시간"
          value={
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-font-2" />
              {formatTimeRange(
                event.startTime,
                event.endTime,
                event.endDayOffset,
              )}{" "}
              (하루 실근무 {dailyWorkHours}시간 · 휴게 {event.breakMinutes}분)
            </span>
          }
        />
        <DetailRow
          label="장소"
          value={
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-font-2" />
              {event.venue} · {event.address}
            </span>
          }
        />
        <DetailRow label="집합" value={event.meetingPoint} />
        <DetailRow label="복장" value={event.dressCode} />
        <DetailRow label="준비물" value={event.belongings || "-"} />
        <DetailRow
          label="거래처"
          value={
            <span className="flex items-center gap-1.5">
              <Building size={14} className="text-font-2" />
              {event.clientName} · 청구 시급{" "}
              {formatCurrency(event.clientBillingRate)}
            </span>
          }
        />
        <DetailRow label="설명" value={event.description || "-"} />
        <DetailRow label="내부 메모" value={event.memo || "-"} />
      </Card>

      <div className="flex flex-col gap-4">
        <Card
          title="직무별 발주"
          description="전체 근무일을 합친 인원입니다."
          bodyClassName="flex flex-col gap-2"
        >
          {sortedRoles.map((slot) => {
            const isShort = slot.assignedCount < slot.requiredCount;

            return (
              <div
                key={slot.role}
                className="flex items-center gap-2 rounded-field border border-border-main px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-font-1">
                    {jobRoleLabel(slot.role)}
                  </p>
                  <p className="text-[12px] text-font-2 tabular-nums">
                    {WAGE_TYPE_LABEL[slot.wageType]}{" "}
                    {formatWithCommas(slot.wage)}원
                  </p>
                </div>

                <span
                  className={`shrink-0 text-[14px] font-medium tabular-nums ${
                    isShort ? "text-danger" : "text-success"
                  }`}
                >
                  {slot.assignedCount}/{slot.requiredCount}명
                </span>

                {/* 부족한 직무는 여기서 바로 채운다. 배치 화면으로 나갈 이유가 없다. */}
                {isShort && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onFillRole(slot.role)}
                  >
                    채우기
                  </Button>
                )}
              </div>
            );
          })}
        </Card>

        {/*
          금액은 배치 건(=사람×날짜) 단위로 쌓인다.
          여러 날 하는 행사에서 하루치로만 보면 마진 판단이 어긋난다.
        */}
        <Card title="예상 금액" bodyClassName="flex flex-col gap-1">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-font-2">예상 매출</span>
            <span className="text-[14px] text-font-1 tabular-nums">
              {formatCurrency(revenue)}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-border-main py-1.5">
            <span className="text-[13px] text-font-2">예상 인건비</span>
            <span className="text-[14px] text-font-1 tabular-nums">
              -{formatCurrency(laborCost)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-font-2">예상 마진</span>
            <span
              className={`text-[18px] font-bold tabular-nums ${
                margin >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatCurrency(margin)}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EventOverviewPanel;
