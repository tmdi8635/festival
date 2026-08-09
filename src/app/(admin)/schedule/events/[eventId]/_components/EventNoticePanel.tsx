"use client";

import { formatDate } from "@/lib/dayjs";
import {
  buildContactList,
  buildEventNotice,
  buildPhoneNumberList,
  confirmedRoster,
} from "@/lib/notice";
import { useJobRoleLabel } from "@/store/useOrgStore";
import type { EventDetail } from "@/type/event";
import { formatPhoneNumber } from "@/type/staff";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import CopyButton from "@/components/domain/CopyButton";

interface EventNoticePanelProps {
  event: EventDetail;
}

/**
 * 안내 · 명단 탭.
 *
 * 출근 안내는 지금도 대표가 매번 손으로 쓰고, 바쁘면 아예 못 보낸다.
 * 행사 정보에서 문구를 만들어 두면 집합 장소 · 복장 같은 항목이 빠질 일이 없다.
 * 문자 발송 연동 전까지는 여기서 복사해 기존 방식으로 보낸다.
 */
const EventNoticePanel = ({ event }: EventNoticePanelProps) => {
  const jobRoleLabel = useJobRoleLabel();

  /*
    복사되는 명단과 **똑같은 목록**을 화면에도 그린다.
    화면은 배치(사람 × 날짜)를 그대로 늘어놓고 복사본만 사람 단위로 묶으면,
    "79건이라 적혀 있는데 붙여넣으니 43명"이 되어 어느 쪽을 믿을지 알 수 없다.
  */
  const roster = confirmedRoster(event.assignments);

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card
        title="출근 안내 문구"
        description="집합 · 복장 · 준비물이 행사 정보에서 그대로 채워집니다."
        action={
          <CopyButton
            value={buildEventNotice(event)}
            successMessage="안내 문구를 복사했습니다."
          />
        }
      >
        <pre className="max-h-[520px] overflow-y-auto rounded-field border border-border-main bg-subtle px-4 py-3 text-[13px] whitespace-pre-wrap text-font-1 scrollbar-thin">
          {buildEventNotice(event)}
        </pre>
      </Card>

      <Card
        title="확정 인력 연락처"
        description={`확정 ${roster.length}명 · 단체 문자에 그대로 붙여넣을 수 있습니다.`}
        action={
          <div className="flex items-center gap-2">
            <CopyButton
              value={buildPhoneNumberList(event.assignments)}
              label="번호만 복사"
              successMessage="연락처를 복사했습니다."
            />
            <CopyButton
              value={buildContactList(event.assignments)}
              label="명단 복사"
              successMessage="명단을 복사했습니다."
            />
          </div>
        }
        noPadding
      >
        {roster.length === 0 ? (
          <EmptyState
            title="확정된 인력이 없습니다."
            description="배치를 먼저 끝내면 명단을 복사할 수 있습니다."
          />
        ) : (
          <ul className="max-h-[520px] divide-y divide-border-main overflow-y-auto scrollbar-thin">
            {roster.map(({ assignment, dayCount }) => (
              <li
                key={assignment.staffId}
                className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px] text-font-1"
              >
                <span className="min-w-0 truncate">
                  {assignment.staffName} · {jobRoleLabel(assignment.role)} ·{" "}
                  <span className="text-font-2 tabular-nums">
                    {formatDate(assignment.workDate)}
                    {dayCount > 1 && ` 외 ${dayCount - 1}일`}
                  </span>
                </span>
                <span className="shrink-0 text-font-2 tabular-nums">
                  {formatPhoneNumber(assignment.staffPhone)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default EventNoticePanel;
