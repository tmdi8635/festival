"use client";

import { useMyApplicationMutation } from "@/api/my/getMyRecruit";
import { APPLICATION_STATUS_TONE } from "@/constants/recruitOptions";
import { Calendar, MapPin } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { formatTimeRange } from "@/type/event";
import type { MyApplication } from "@/type/my";
import { APPLICATION_STATUS_LABEL } from "@/type/recruit";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

interface MyApplicationCardProps {
  application: MyApplication;
  onOpenDetail: (postingId: number) => void;
}

/** 근무일이 여러 날이면 "09.12 외 2일"로 줄인다. */
const describeWorkDates = (workDates: string[]): string => {
  if (workDates.length === 0) return "-";

  const first = formatDate(workDates[0]);

  return workDates.length === 1 ? first : `${first} 외 ${workDates.length - 1}일`;
};

/**
 * 내가 낸 지원 한 건.
 *
 * 근무 카드(`MyWorkCard`)와 **다르게 생겼다.** 저쪽은 현장으로 가는 사람이
 * 보는 화면이라 집합 장소 · 복장 · 담당자 번호까지 펼쳐 두지만, 여기는
 * 아직 확정되지 않은 자리다. 같은 밀도로 세우면 확정된 근무와 구분이 안 되고,
 * 그 오해는 그 사람이 다른 일을 거절하는 것으로 이어진다.
 *
 * 조건을 다시 보고 싶으면 상세로 들어간다 — 공고 목록에서 여는 것과 **같은 모달**이다.
 */
const MyApplicationCard = ({
  application,
  onOpenDetail,
}: MyApplicationCardProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const { cancelMutation } = useMyApplicationMutation();

  const isPending = application.status === "PENDING";

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-font-0">
              {application.eventTitle}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-font-2">
              {application.clientName} · {jobRoleLabel(application.role)}
            </p>
          </div>

          <Badge tone={APPLICATION_STATUS_TONE[application.status]}>
            {APPLICATION_STATUS_LABEL[application.status]}
          </Badge>
        </div>

        <dl className="flex flex-col gap-2 border-t border-border-main pt-3 text-[13px]">
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 shrink-0 text-font-disabled">
              <Calendar size={15} />
            </dt>
            <dd className="min-w-0 text-font-1">
              {describeWorkDates(application.workDates)}{" "}
              <span className="tabular-nums">
                {formatTimeRange(
                  application.startTime,
                  application.endTime,
                  application.endDayOffset,
                )}
              </span>
            </dd>
          </div>

          {application.venue && (
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 shrink-0 text-font-disabled">
                <MapPin size={15} />
              </dt>
              <dd className="min-w-0 truncate text-font-1">
                {application.venue}
              </dd>
            </div>
          )}
        </dl>

        {isPending && (
          <p className="text-[12px] text-font-2">
            담당자가 확인하고 있습니다. 확정되면 &lsquo;예정&rsquo;으로 옮겨집니다.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 border-t border-border-main pt-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onOpenDetail(application.postingId)}
          >
            상세 보기
          </Button>

          {/*
            취소는 검토 대기일 때만 뜬다. 확정된 뒤에 화면에서 혼자 빠질 수 있으면
            담당자는 전날에야 사람이 사라진 것을 알게 된다.

            빨강을 꽉 채우지 않는다. 자기 지원을 무르는 일은 위험하지 않은데,
            삭제와 같은 무게로 칠해 두면 눌러도 되는지 망설이게 된다.
          */}
          {isPending && (
            <Button
              variant="dangerSoft"
              fullWidth
              disabled={cancelMutation.isPending}
              onClick={() =>
                openConfirm({
                  title: "지원을 취소할까요?",
                  description: application.eventTitle,
                  confirmText: "지원 취소",
                  tone: "danger",
                  onConfirm: () =>
                    cancelMutation.mutate(application.applicationId),
                })
              }
            >
              지원 취소
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MyApplicationCard;
