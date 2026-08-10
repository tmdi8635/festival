"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Building,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
} from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { resolveBillingRate } from "@/type/client";
import { cn, formatCurrency, formatWithCommas } from "@/lib/utils";
import { useJobRoleComparator, useJobRoleLabel } from "@/store/useOrgStore";
import {
  GENDER_PREFERENCE_LABEL,
  WAGE_TYPE_LABEL,
  describeRecurrence,
  formatTimeRange,
  groupConsecutiveDates,
  summarizeEventCost,
  type EventDetail,
} from "@/type/event";
import { formatPhoneNumber, type JobRole } from "@/type/staff";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import GenderMark from "@/components/domain/GenderMark";
import { useHasPermission } from "@/store/useAdminStore";

/** 라벨 · 값 한 줄. 개요에서만 쓴다. */
const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  /*
    좁은 화면에서는 라벨을 값 위에 올린다.
    96px짜리 라벨 칸을 그대로 두면 값에 남는 자리가 240px뿐이라
    장소 · 거래처처럼 긴 값이 서너 줄로 접혀 오히려 읽기 어렵다.
  */
  <div className="flex flex-col gap-0.5 border-b border-border-main py-2.5 last:border-b-0 sm:flex-row sm:gap-3">
    <p className="text-[13px] text-font-2 sm:w-24 sm:shrink-0">{label}</p>
    <div className="min-w-0 text-[14px] text-font-1 sm:flex-1">{value}</div>
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
  const canAssign = useHasPermission("assignment:write");

  /*
    펼친 직무들.

    **여럿을 한꺼번에 열 수 있어야 한다.** 담당자가 여기서 하는 일이
    "팀장 명단과 스태프 명단을 나란히 놓고 보는 것"이라, 하나를 열 때
    보던 것이 닫히면 눈으로 대조할 방법이 사라진다.
  */
  const [openRoles, setOpenRoles] = useState<JobRole[]>([]);

  const toggleRole = (role: JobRole) =>
    setOpenRoles((prev) =>
      prev.includes(role)
        ? prev.filter((item) => item !== role)
        : [...prev, role],
    );

  const jobRoleLabel = useJobRoleLabel();
  // 발주 목록도 기준 설정에서 정한 직무 순서로 세운다.
  const compareRoles = useJobRoleComparator();
  const sortedRoles = [...event.roles].sort((a, b) =>
    compareRoles(a.role, b.role),
  );
  const { dailyWorkHours, laborCost, revenue, margin } =
    summarizeEventCost(event);

  /** 이 행사에서 그 직무를 얼마에 청구하는지. 안 정했으면 0이다. */
  const billingRateOf = (role: JobRole) =>
    resolveBillingRate(event.billingRates, role);

  /*
    직무 하나에 실제로 서는 사람들.

    발주 숫자(`16/20명`)만 보고 "그래서 누가 오는데"를 확인하려면 일별 근무자 탭까지
    가야 했다. 개요에서 얼굴 · 이름 · 번호까지는 보여야 그 자리에서 전화를 건다.
    같은 사람이 여러 날 나와도 한 줄이다. 사람을 세는 자리이지 배치를 세는 자리가 아니다.
  */
  const membersOf = (role: JobRole) =>
    [
      ...new Map(
        event.assignments
          .filter(
            (assignment) =>
              assignment.role === role && assignment.status === "CONFIRMED",
          )
          .map((assignment) => [assignment.staffId, assignment]),
      ).values(),
    ].sort((a, b) => a.staffName.localeCompare(b.staffName));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card
        title="발주 조건"
        className="sm:col-span-2"
        bodyClassName="px-4 py-1 sm:px-5"
      >
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
              {event.clientName}
            </span>
          }
        />
        <DetailRow
          label="담당 매니저"
          value={
            <span className="flex flex-wrap items-center gap-1.5">
              {event.managerName}
              <span className="flex items-center gap-1 text-[13px] text-font-2 tabular-nums">
                <Phone size={13} />
                {formatPhoneNumber(event.managerPhone)}
              </span>
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
            /* 직무마다 따로 접고 편다. 하나를 열었다고 보던 것이 닫히면 대조가 안 된다. */
            const isOpen = openRoles.includes(slot.role);
            const members = membersOf(slot.role);

            return (
              <div
                key={slot.role}
                className="rounded-field border border-border-main"
              >
                {/*
                  펼침 버튼과 '채우기'는 **형제**다.
                  버튼 안의 버튼은 유효하지 않은 HTML이라 하이드레이션이 깨진다.

                  다만 형제로 떼어 놓으니 이번엔 hover가 어색해졌다.
                  펼침 버튼에만 배경이 깔려서 '채우기' 왼쪽까지만 색이 차고
                  단추 자리는 그대로 남아, 한 줄이 두 조각으로 보였다.

                  그래서 **hover를 바깥 줄에 건다.** 어디에 커서를 올려도 줄
                  전체가 한 덩어리로 반응하고, 안쪽 버튼은 자기 배경을 갖지 않는다.
                  실제로 눌리는 자리는 그대로 둘이라 HTML도 멀쩡하다.
                */}
                <div className="group flex items-center gap-1 rounded-field transition-colors hover:bg-surface-hover">
                  <button
                    type="button"
                    onClick={() => toggleRole(slot.role)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-field px-3 py-2 text-left"
                  >
                    <ChevronRight
                      size={14}
                      className={cn(
                        "shrink-0 text-font-2 transition-transform",
                        isOpen && "rotate-90",
                        members.length === 0 && "opacity-0",
                      )}
                    />

                  {/*
                    인원수를 직무명과 **같은 줄에** 둔다.

                    바깥으로 빼면 아래 금액 줄이 그만큼 좁아져서
                    좁은 카드에서 "시급 12,…"로 잘린다. 금액은 잘리면 뜻이 없다.
                  */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="min-w-0 flex-1 truncate text-[14px] text-font-1">
                          {jobRoleLabel(slot.role)}
                        </p>
                        <span
                          className={`shrink-0 text-[14px] font-medium whitespace-nowrap tabular-nums ${
                            isShort ? "text-danger" : "text-success"
                          }`}
                        >
                          {slot.assignedCount}/{slot.requiredCount}명
                        </span>
                      </div>

                      <p className="truncate text-[12px] text-font-2 tabular-nums">
                        {WAGE_TYPE_LABEL[slot.wageType]}{" "}
                        {formatWithCommas(slot.wage)}원
                        {/*
                          우리가 주는 금액 옆에 거래처에서 받는 금액을 나란히 둔다.
                          이 두 숫자의 차이가 이 직무 한 명당 마진이라, 떨어뜨려
                          놓으면 발주를 받아 놓고 밑지는 자리를 알아채지 못한다.
                        */}
                        {billingRateOf(slot.role) > 0 && (
                          <span className="ml-1.5">
                            · 청구 {formatWithCommas(billingRateOf(slot.role))}원
                          </span>
                        )}
                        {/* 조건이 걸린 발주만 적는다. 강제가 아니라 안내다. */}
                        {slot.genderPreference !== "ANY" && (
                          <span className="ml-1.5">
                            · {GENDER_PREFERENCE_LABEL[slot.genderPreference]}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>

                  {/*
                    부족한 직무는 여기서 바로 채운다. 배치 화면으로 나갈 이유가 없다.
                    줄 배경 위에 얹히므로 자기 배경을 따로 갖는다. (`relative`)
                  */}
                  {canAssign && isShort && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="relative mr-2 shrink-0"
                      onClick={() => onFillRole(slot.role)}
                    >
                      채우기
                    </Button>
                  )}
                </div>

                {/*
                  펼쳤을 때 보이는 것은 **얼굴 · 이름 · 번호** 셋뿐이다.
                  여기서 하려는 일은 "누가 오는지 확인하고 필요하면 전화하기"라
                  근태 · 금액까지 늘어놓으면 그 두 가지가 오히려 안 보인다.

                  접힘은 높이를 재지 않고 grid 1fr↔0fr로 굴린다. (`.collapsible`)
                  내용 길이와 무관하게 같은 속도로 열리고, 잘리지 않는다.
                */}
                {members.length > 0 && (
                  <div className="collapsible" data-folded={!isOpen}>
                    <div>
                      <ul className="flex flex-col gap-2 border-t border-border-main px-3 py-2.5">
                        {members.map((member) => (
                          <li
                            key={member.staffId}
                            className="flex items-center gap-2.5"
                          >
                            <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-subtle">
                              {member.staffProfileImageUrl && (
                                <Image
                                  src={member.staffProfileImageUrl}
                                  alt=""
                                  fill
                                  sizes="32px"
                                  className="object-cover"
                                  unoptimized
                                />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="flex items-center gap-1 truncate text-[13px] text-font-1">
                                {member.staffName}
                                <GenderMark gender={member.staffGender} size={11} />
                              </p>
                              <p className="truncate text-[12px] text-font-2 tabular-nums">
                                {formatPhoneNumber(member.staffPhone)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
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
