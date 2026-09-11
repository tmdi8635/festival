"use client";

import { useOfferListQuery } from "@/api/offer/getOfferList";
import { useOfferMutation } from "@/api/offer/mutateOffer";
import { OFFER_STATE_TONE } from "@/constants/offerOptions";
import { Plus } from "@/icons";
import { formatDateTime } from "@/lib/dayjs";
import { useHasPermission } from "@/store/useAdminStore";
import { openConfirm } from "@/store/useConfirmStore";
import type { EventDetail } from "@/type/event";
import { OFFER_STATE_LABEL, type WorkOfferView } from "@/type/offer";
import { PARTICIPATION_LABEL, describeLineSchedule } from "@/type/recruit";
import { formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";

interface EventOfferPanelProps {
  event: EventDetail;
  /** 배치 모달을 '포털로 제안' 상태로 연다 */
  onSendOffer: () => void;
}

/**
 * 보낸 제안 — 이 행사에서 누구에게 먼저 연락했고, 누가 답했는가.
 *
 * 전화로 돌리던 때는 "누구한테 물어봤더라"가 담당자 머릿속에만 있었다. 같은 사람에게
 * 두 번 연락하거나, 거절한 사람에게 또 부탁하는 일이 여기서 없어진다.
 *
 * 수락된 제안은 곧 배치다. 여기서 되돌리지 않는다 — 배치를 빼는 것은 일별 근무자 탭의 일이다.
 * 여기서 할 수 있는 것은 **응답 대기 중인 제안을 거두는 것**뿐이다.
 */
const EventOfferPanel = ({ event, onSendOffer }: EventOfferPanelProps) => {
  const canAssign = useHasPermission("assignment:write");
  const { data, isLoading } = useOfferListQuery({ eventId: event.eventId });
  const { withdrawMutation } = useOfferMutation();

  const offers = data?.items ?? [];

  const handleWithdraw = (offer: WorkOfferView) => {
    openConfirm({
      title: "제안을 철회할까요?",
      description: `${offer.staffName} · ${offer.positionName}`,
      warning:
        "본인 화면에는 '담당자가 제안을 거두었습니다'로 바뀝니다. 먼저 연락해 두면 좋습니다.",
      confirmText: "철회",
      tone: "danger",
      onConfirm: () => withdrawMutation.mutateAsync(offer.offerId),
    });
  };

  const columns: TableColumn<WorkOfferView>[] = [
    {
      key: "staff",
      header: "인력",
      render: (offer) => (
        <TableCellStack
          primary={offer.staffName}
          secondary={
            <span className="tabular-nums">{formatPhoneNumber(offer.staffPhone)}</span>
          }
        />
      ),
    },
    {
      key: "position",
      header: "포지션 / 날짜",
      render: (offer) => (
        <TableCellStack
          primary={offer.positionName}
          secondary={
            /*
              수락한 날이 제안한 날보다 적으면(분할 제안) 그 사실을 먼저 적는다.
              제안한 날만 보이면 사흘 다 채운 줄 안다.
            */
            <span className="tabular-nums">
              {offer.acceptedDates && offer.acceptedDates.length !== offer.dates.length
                ? `${offer.dates.length}일 중 ${offer.acceptedDates.length}일 수락`
                : describeLineSchedule(offer, offer.dates)}
              {offer.dates.length > 1 && ` · ${PARTICIPATION_LABEL[offer.participation]}`}
            </span>
          }
        />
      ),
    },
    {
      key: "state",
      header: "상태",
      render: (offer) => (
        <Badge tone={OFFER_STATE_TONE[offer.state]}>{OFFER_STATE_LABEL[offer.state]}</Badge>
      ),
    },
    {
      key: "response",
      header: "응답",
      render: (offer) => (
        <TableCellStack
          primary={
            <span className="text-[13px] tabular-nums">
              {offer.state === "PENDING"
                ? `${formatDateTime(offer.respondBy)}까지`
                : offer.respondedAt
                  ? formatDateTime(offer.respondedAt)
                  : formatDateTime(offer.respondBy)}
            </span>
          }
          secondary={
            /* 거절 사유 · 닫힌 이유. 다음에 같은 사람에게 연락할지 정하는 데 쓴다. */
            offer.declineReason ?? offer.closedReason ?? undefined
          }
        />
      ),
    },
    {
      key: "message",
      header: "보낸 말",
      render: (offer) => (
        <p className="max-w-64 truncate text-[13px] text-font-2">
          {offer.message || "-"}
        </p>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "90px",
      render: (offer) =>
        canAssign && offer.state === "PENDING" ? (
          <Button
            size="sm"
            variant="dangerGhost"
            disabled={withdrawMutation.isPending}
            onClick={() => handleWithdraw(offer)}
          >
            철회
          </Button>
        ) : null,
    },
  ];

  return (
    <Card noPadding>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-main px-4 py-3 lg:px-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-font-0">보낸 제안</p>
          <p className="text-[12px] text-font-2">
            본인이 수락하면 곧바로 확정 배치됩니다. 제안은 자리를 잡지 않아서, 먼저 수락한
            사람부터 채워집니다.
          </p>
        </div>

        {canAssign && (
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus size={15} />}
            onClick={onSendOffer}
          >
            제안 보내기
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        rows={offers}
        getRowKey={(offer) => String(offer.offerId)}
        isLoading={isLoading}
        emptyTitle="보낸 제안이 없습니다."
        emptyDescription="'제안 보내기'로 먼저 연락하고 싶은 사람에게 근무를 권할 수 있습니다."
      />
    </Card>
  );
};

export default EventOfferPanel;
