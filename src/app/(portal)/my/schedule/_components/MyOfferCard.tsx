"use client";

import { useState } from "react";
import { useMyOfferMutation } from "@/api/my/getMyOffers";
import { OFFER_STATE_TONE } from "@/constants/offerOptions";
import { Warning } from "@/icons";
import { formatDateTime } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { formatTimeRange } from "@/type/event";
import type { MyOffer } from "@/type/my";
import { OFFER_STATE_LABEL } from "@/type/offer";
import { PARTICIPATION_LABEL, formatDateList } from "@/type/recruit";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Textarea from "@/components/ui/Textarea";
import DateChips from "@/components/domain/DateChips";
import WorkInfoList from "@/app/(portal)/_components/WorkInfoList";

interface MyOfferCardProps {
  offer: MyOffer;
}

/** 날짜를 골라 수락하는 제안인가. 하루뿐이면 고를 것이 없다 */
const isPickableOffer = (offer: MyOffer): boolean =>
  offer.participation === "SPLIT" && offer.dates.length > 1;

/**
 * 날짜 칸. 일부만 수락했으면 그 사실을 붙인다 — 제안받은 날만 보이면
 * 나중에 카드를 다시 봤을 때 사흘 다 수락한 줄 안다.
 */
const describeOfferDates = (offer: MyOffer): string => {
  const accepted = offer.acceptedDates;

  if (offer.state === "ACCEPTED" && accepted) {
    return accepted.length === offer.dates.length
      ? formatDateList(accepted)
      : `${formatDateList(accepted)} (${offer.dates.length}일 중 ${accepted.length}일 수락)`;
  }

  return formatDateList(offer.dates);
};

/** 닫힌 제안의 한 줄. 왜 끝났는지 본인이 알아야 다음에 헷갈리지 않는다 */
const describeClosed = (offer: MyOffer): string | undefined => {
  if (offer.state === "DECLINED") {
    return offer.declineReason ? `거절 사유: ${offer.declineReason}` : "거절했어요.";
  }

  if (offer.state === "EXPIRED") return "응답 기한이 지났어요.";
  if (offer.state === "WITHDRAWN") return offer.closedReason ?? "제안이 닫혔어요.";

  return undefined;
};

interface OfferDateSheetProps {
  offer: MyOffer;
  isBusy: boolean;
  onClose: () => void;
  onSubmit: (dates: string[]) => void;
}

/**
 * 나올 날 고르기 — 분할 제안의 수락.
 *
 * 되는 날이 모두 켜진 채로 시작한다. 겹치거나 자리가 찬 날은 줄을 그어 잠근다.
 * 부르는 쪽이 제안마다 새로 그린다(`key`). 앞 제안에서 고른 날이 남으면 안 된다.
 */
const OfferDateSheet = ({ offer, isBusy, onClose, onSubmit }: OfferDateSheetProps) => {
  const [picked, setPicked] = useState<string[]>(offer.availableDates);
  const blocked = offer.dates.filter((date) => !offer.availableDates.includes(date));

  const handleToggle = (date: string) =>
    setPicked((prev) =>
      prev.includes(date)
        ? prev.filter((item) => item !== date)
        : [...prev, date].sort(),
    );

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title="나올 날 고르기"
      description={`${offer.eventTitle} · ${offer.positionName} ${formatTimeRange(
        offer.startTime,
        offer.endTime,
        offer.endDayOffset,
      )}`}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={picked.length === 0 || isBusy}
            isLoading={isBusy}
            onClick={() => onSubmit(picked)}
          >
            {picked.length}일 수락
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <DateChips
          size="md"
          dates={offer.dates}
          selected={picked}
          onToggle={handleToggle}
          disabledDates={blocked}
          disabledReason="다른 근무와 겹치거나 자리가 찬 날이에요"
        />
        {blocked.length > 0 && (
          <p className="text-[12px] text-font-2">
            줄이 그어진 날은 다른 근무와 겹치거나 자리가 이미 찬 날이에요.
          </p>
        )}
        <p className="text-[14px] font-medium text-font-1 tabular-nums">
          예상 {formatCurrency(offer.dailyPay * picked.length)}
          <span className="ml-1 text-[12px] font-normal text-font-2">
            세전 · {picked.length}일
          </span>
        </p>
        <Alert tone="warning" title="수락하면 바로 확정됩니다.">
          담당자 확인 없이 고른 날에 근무가 잡힙니다. 확정 뒤 취소는 근무 시작 24시간
          전까지만 되고, 그 이후는 노쇼로 남습니다.
        </Alert>
      </div>
    </BottomSheet>
  );
};

interface DeclineSheetProps {
  offer: MyOffer;
  isBusy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

/**
 * 거절 — 사유는 **선택**이다.
 *
 * 사유를 꼭 적으라고 하면 사람들은 거절 대신 무응답을 고른다. 그러면 담당자는
 * 기한이 지날 때까지 다른 사람에게 연락하지 못한다. 한 번에 누를 수 있어야 빨리 거절한다.
 */
const DeclineSheet = ({ offer, isBusy, onClose, onSubmit }: DeclineSheetProps) => {
  const [reason, setReason] = useState("");

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title="제안을 거절할까요?"
      description={`${offer.eventTitle} · ${offer.positionName}`}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            닫기
          </Button>
          <Button
            variant="dangerSoft"
            size="lg"
            fullWidth
            disabled={isBusy}
            isLoading={isBusy}
            onClick={() => onSubmit(reason)}
          >
            거절하기
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-font-2">
          사유는 적지 않아도 됩니다. 적어 주시면 다음에 맞는 자리를 먼저 연락드릴게요.
        </p>
        <Textarea
          rows={3}
          value={reason}
          onChange={(changeEvent) => setReason(changeEvent.target.value)}
          placeholder="예) 그 주에 시험이 있어요."
        />
      </div>
    </BottomSheet>
  );
};

/**
 * 받은 근무 제안 한 장.
 *
 * 조건은 **근무 카드와 같은 줄**(`WorkInfoList`)로 다 보여 준다. 수락이 곧 확정이라
 * 시급 · 집합 · 복장을 보려고 다른 화면을 열게 하면 안 된다.
 * 담당자가 붙인 한마디는 조건보다 위에 둔다 — 왜 나에게 왔는지가 수락을 가른다.
 */
const MyOfferCard = ({ offer }: MyOfferCardProps) => {
  const { acceptMutation, declineMutation } = useMyOfferMutation();
  const [sheet, setSheet] = useState<"ACCEPT" | "DECLINE" | null>(null);

  const isPending = offer.state === "PENDING";
  const isBusy = acceptMutation.isPending || declineMutation.isPending;
  const closedText = describeClosed(offer);
  const dayCount = offer.dates.length;

  const handleAccept = () => {
    if (isPickableOffer(offer)) {
      setSheet("ACCEPT");
      return;
    }

    openConfirm({
      title: "제안을 수락할까요?",
      description: `${offer.eventTitle} · ${offer.positionName} · ${formatDateList(offer.dates)}`,
      warning: `${
        dayCount > 1 ? `${dayCount}일 모두 나와야 하는 제안입니다. ` : ""
      }수락하면 곧바로 확정됩니다. 확정 뒤 취소는 근무 시작 24시간 전까지만 되고, 그 이후는 노쇼로 남습니다.`,
      confirmText: "수락",
      onConfirm: () => acceptMutation.mutateAsync({ offerId: offer.offerId }),
    });
  };

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-font-0">
              {offer.eventTitle}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-font-2">
              {offer.clientName} · {offer.positionName}
            </p>
          </div>

          <Badge tone={OFFER_STATE_TONE[offer.state]}>{OFFER_STATE_LABEL[offer.state]}</Badge>
        </div>

        {isPending && (
          <div className="flex flex-wrap items-center gap-1.5">
            {dayCount > 1 && (
              <Badge tone={offer.participation === "FULL" ? "info" : "neutral"}>
                {PARTICIPATION_LABEL[offer.participation]}
              </Badge>
            )}
            <span className="text-[12px] font-medium text-warning tabular-nums">
              {formatDateTime(offer.respondBy)}까지 응답
            </span>
          </div>
        )}

        {offer.message && (
          <p className="rounded-field bg-brand-opacity px-3 py-2 text-[13px] text-brand">
            {offer.message}
          </p>
        )}

        {closedText && (
          <p className="rounded-field bg-subtle px-3 py-2 text-[12px] text-font-2">
            {closedText}
          </p>
        )}

        <div className="border-t border-border-main pt-3">
          <WorkInfoList
            info={offer}
            dateLabel={describeOfferDates(offer)}
            payNote={
              dayCount > 1
                ? `${dayCount}일 예상 ${formatCurrency(offer.totalPay)}`
                : offer.wageType === "HOURLY"
                  ? `하루 예상 ${formatCurrency(offer.dailyPay)}`
                  : undefined
            }
          />
        </div>

        {isPending && (
          <div className="flex flex-col gap-2 border-t border-border-main pt-3">
            {!offer.canAccept && offer.blockReason && (
              <p className="flex items-start gap-1.5 text-[13px] font-medium text-font-1">
                <Warning size={14} className="mt-0.5 shrink-0 text-warning" />
                {offer.blockReason}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="dangerSoft"
                fullWidth
                disabled={isBusy}
                onClick={() => setSheet("DECLINE")}
              >
                거절
              </Button>
              <Button
                variant="primary"
                fullWidth
                disabled={isBusy || !offer.canAccept}
                onClick={handleAccept}
              >
                {isPickableOffer(offer) ? "날짜 골라 수락" : "수락"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {sheet === "ACCEPT" && (
        <OfferDateSheet
          key={offer.offerId}
          offer={offer}
          isBusy={acceptMutation.isPending}
          onClose={() => setSheet(null)}
          onSubmit={(dates) =>
            acceptMutation.mutate(
              { offerId: offer.offerId, dates },
              { onSuccess: () => setSheet(null) },
            )
          }
        />
      )}

      {sheet === "DECLINE" && (
        <DeclineSheet
          key={offer.offerId}
          offer={offer}
          isBusy={declineMutation.isPending}
          onClose={() => setSheet(null)}
          onSubmit={(reason) =>
            declineMutation.mutate(
              { offerId: offer.offerId, reason },
              { onSuccess: () => setSheet(null) },
            )
          }
        />
      )}
    </Card>
  );
};

export default MyOfferCard;
