"use client";

import { useMyApplicationMutation } from "@/api/my/getMyRecruit";
import { APPLICATION_STATUS_TONE } from "@/constants/recruitOptions";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import type { MyApplication } from "@/type/my";
import { APPLICATION_STATUS_LABEL, formatDateList } from "@/type/recruit";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import WorkInfoList from "@/app/(portal)/_components/WorkInfoList";

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
 * 날짜 칸.
 *
 * - 일부만 확정됐으면 **그 사실을 괄호로 붙인다.** 확정된 날만 적어 두면 본인은
 *   신청한 날이 다 잡힌 줄 알고, 빠진 날에 다른 일을 거절한 채 기다린다.
 * - 날짜를 골라 낸 지원은 고른 날을 전부 적는다. "09.12 외 1일"로 줄이면
 *   사흘 중 어느 이틀을 냈는지 알 수 없다.
 */
const describeApplicationDateLabel = (application: MyApplication): string => {
  const { confirmedDates, requestedDates, workDates } = application;

  if (confirmedDates && confirmedDates.length !== requestedDates.length) {
    return `${formatDateList(workDates)} (${requestedDates.length}일 신청 · ${confirmedDates.length}일 확정)`;
  }

  return application.participation === "SPLIT" && workDates.length > 1
    ? formatDateList(workDates)
    : describeWorkDates(workDates);
};

/**
 * 단가 옆에 붙는 금액 설명.
 *
 * 일급 하루짜리는 단가가 곧 금액이라 덧붙이지 않는다. 시급이면 하루 얼마인지,
 * 여러 날이면 끝까지 섰을 때 얼마인지를 적는다 — 공고 상세와 같은 숫자다.
 */
const describePay = (application: MyApplication): string | undefined => {
  const dayCount = application.workDates.length;

  if (dayCount > 1) {
    return `${dayCount}일 예상 ${formatCurrency(application.totalPay)}`;
  }

  return application.wageType === "HOURLY"
    ? `하루 예상 ${formatCurrency(application.dailyPay)}`
    : undefined;
};

/**
 * 내가 낸 지원 한 건.
 *
 * 조건은 **근무 카드와 같은 줄**(`WorkInfoList`)로 다 보여 준다. 시급 · 집합 ·
 * 복장 · 준비물을 빼 두면 무엇에 지원했는지 확인하려고 매번 상세를 다시 연다.
 * 확정된 근무와 헷갈리지 않게 하는 것은 정보를 덜어서가 아니라,
 * 상단의 상태 배지와 '담당자가 확인하고 있습니다' 안내로 한다.
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
              {/* 지원은 포지션 단위다. 어느 시간대로 냈는지가 보여야 한다. */}
              {application.clientName} ·{" "}
              {application.positionName || jobRoleLabel(application.role)}
            </p>
          </div>

          <Badge tone={APPLICATION_STATUS_TONE[application.status]}>
            {APPLICATION_STATUS_LABEL[application.status]}
          </Badge>
        </div>

        {isPending && (
          <p className="rounded-field bg-subtle px-3 py-2 text-[12px] text-font-2">
            담당자가 확인하고 있습니다. 확정되면 &lsquo;예정&rsquo;으로 옮겨집니다.
          </p>
        )}

        <div className="border-t border-border-main pt-3">
          <WorkInfoList
            info={application}
            dateLabel={describeApplicationDateLabel(application)}
            payNote={describePay(application)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border-main pt-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onOpenDetail(application.postingId)}
          >
            상세 보기
          </Button>

          {/*
            취소는 검토 대기일 때만 뜬다. 확정된 뒤에는 근무 카드의 '근무 취소'로 한다
            (24시간 규칙이 걸린다).

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
