"use client";

import { formatTimeRange, toTimeInput } from "@/type/event";
import { ATTENDANCE_STATUS_TONE } from "@/constants/staffOptions";
import { useState } from "react";
import { Clock, MapPin, Package, Phone, UserCheck, Warning } from "@/icons";
import { formatDate, formatDday } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import type { MyWork } from "@/type/my";
import { ATTENDANCE_STATUS_LABEL, formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CheckTimeModal from "./CheckTimeModal";

interface MyWorkCardProps {
  work: MyWork;
  /** 아직 나가지 않은 근무. 집합 안내를 펼쳐 보여 준다 */
  isUpcoming?: boolean;
}

/**
 * 내 근무 한 건.
 *
 * 현장으로 가는 길에 폰으로 열어 보는 화면이라, **여기서 답이 끝나야 한다.**
 * 몇 시에 어디로 가는지, 무엇을 입고 무엇을 챙기는지, 못 찾으면 누구에게 거는지가
 * 한 장에 다 있어야 한다. 다른 화면으로 넘겨 놓으면 지하철에서 그 화면을 못 찾는다.
 */
const MyWorkCard = ({ work, isUpcoming = false }: MyWorkCardProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const [checkSide, setCheckSide] = useState<"IN" | "OUT" | null>(null);

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-font-0">
              {work.eventTitle}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-font-2">
              {work.clientName} · {jobRoleLabel(work.role)}
            </p>
          </div>

          {isUpcoming ? (
            <Badge tone="brand">{formatDday(work.workDate)}</Badge>
          ) : (
            <Badge tone={ATTENDANCE_STATUS_TONE[work.attendance]}>
              {ATTENDANCE_STATUS_LABEL[work.attendance]}
            </Badge>
          )}
        </div>

        <dl className="flex flex-col gap-2 border-t border-border-main pt-3 text-[13px]">
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 shrink-0 text-font-disabled">
              <Clock size={15} />
            </dt>
            <dd className="min-w-0 text-font-1">
              {formatDate(work.workDate)}{" "}
              <span className="tabular-nums">
                {formatTimeRange(
                  work.startTime,
                  work.endTime,
                  work.endDayOffset,
                )}
              </span>
            </dd>
          </div>

          <div className="flex items-start gap-2">
            <dt className="mt-0.5 shrink-0 text-font-disabled">
              <MapPin size={15} />
            </dt>
            <dd className="min-w-0 text-font-1">
              {work.venue}
              {work.address && (
                <span className="block text-[12px] text-font-2">
                  {work.address}
                </span>
              )}
              {/* 집합 장소는 행사장 주소와 다르다. 후문 · 지하 주차장인 경우가 흔하다. */}
              {isUpcoming && work.meetingPoint && (
                <span className="mt-1 block rounded-field bg-brand-opacity px-2 py-1 text-[12px] text-brand">
                  집합 {work.meetingPoint}
                </span>
              )}
            </dd>
          </div>

          {isUpcoming && work.dressCode && (
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 shrink-0 text-font-disabled">
                <UserCheck size={15} />
              </dt>
              <dd className="min-w-0 text-font-1">{work.dressCode}</dd>
            </div>
          )}

          {isUpcoming && work.belongings && (
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 shrink-0 text-font-disabled">
                <Package size={15} />
              </dt>
              <dd className="min-w-0 text-font-1">{work.belongings}</dd>
            </div>
          )}

          {isUpcoming && work.managerPhone && (
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 shrink-0 text-font-disabled">
                <Phone size={15} />
              </dt>
              <dd className="min-w-0">
                {/*
                  전화번호는 **눌러서 걸 수 있어야 한다.**
                  현장을 못 찾는 사람이 번호를 외워 옮겨 적을 상황이 아니다.
                */}
                <a
                  href={`tel:${work.managerPhone}`}
                  /*
                    누를 수 있는 높이를 확보한다. `-my-2`로 바깥 여백을 상쇄해
                    글줄 간격은 그대로 두고 손가락이 닿는 영역만 넓힌다.
                    현장을 못 찾은 사람이 급하게 누르는 자리라 빗나가면 안 된다.
                  */
                  className="-my-2 inline-flex min-h-10 items-center text-brand underline underline-offset-2"
                >
                  {work.managerName} {formatPhoneNumber(work.managerPhone)}
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="flex items-center justify-between gap-2 border-t border-border-main pt-3">
          <span className="text-[12px] text-font-2">
            {work.workHours.toFixed(1)}시간
            {work.lateMinutes > 0 && (
              <span className="text-warning"> · 지각 {work.lateMinutes}분</span>
            )}
          </span>
          <span className="text-[15px] font-semibold text-font-0 tabular-nums">
            {formatCurrency(work.payAmount)}
          </span>
        </div>

        {/*
          출퇴근.

          찍은 시각은 버튼이 사라진 뒤에도 남아야 한다. 눌렀는지 안 눌렀는지를
          기억에 맡기면 현장에서 한 번 더 누르러 들어온다.
        */}
        {(work.checkInAt || work.checkOutAt) && (
          <div className="flex items-center gap-3 rounded-field bg-subtle px-3 py-2 text-[13px] tabular-nums">
            <span className="text-font-1">
              <span className="text-font-2">출근 </span>
              {toTimeInput(work.checkInAt) || "-"}
            </span>
            <span className="text-font-1">
              <span className="text-font-2">퇴근 </span>
              {toTimeInput(work.checkOutAt) || "-"}
            </span>
          </div>
        )}

        {(work.canCheckIn || work.canCheckOut) && (
          <Button
            fullWidth
            onClick={() => setCheckSide(work.canCheckIn ? "IN" : "OUT")}
          >
            {work.canCheckIn ? "출근하기" : "퇴근하기"}
          </Button>
        )}

        {/*
          못 찍는 이유를 버튼 자리에 그대로 적는다.
          버튼만 사라지면 본인은 고장인 줄 알고 담당자에게 전화한다.
        */}
        {!work.canCheckIn && !work.canCheckOut && work.checkBlockReason && (
          <p className="flex items-start gap-1.5 text-[12px] text-font-2">
            <Warning size={13} className="mt-0.5 shrink-0" />
            {work.checkBlockReason}
          </p>
        )}
      </div>

      {checkSide && (
        <CheckTimeModal
          work={work}
          side={checkSide}
          onClose={() => setCheckSide(null)}
        />
      )}
    </Card>
  );
};

export default MyWorkCard;
