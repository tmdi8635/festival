"use client";

import { useMemo, useState } from "react";
import { useEventMutation, type DayRoleInput } from "@/api/event/mutateEvent";
import { WAGE_TYPE_OPTIONS } from "@/constants/eventOptions";
import { Plus, Trash } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { showErrorToast } from "@/lib/toast";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  WAGE_TYPE_UNIT,
  comparePositionOrder,
  findPosition,
  formatPositionLabel,
  formatTimeRange,
  type EventDayPlan,
  type EventDetail,
  type WageType,
} from "@/type/event";
import Alert from "@/components/ui/Alert";
import AmountInput from "@/components/ui/AmountInput";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";

interface DayRoleEditModalProps {
  event: EventDetail;
  /** null이면 닫힌 상태 */
  day: EventDayPlan | null;
  onClose: () => void;
}

/**
 * 근무일 하나의 발주 인원을 고친다.
 *
 * 행사 폼에서 정하는 발주는 **모든 날에 같은 인원을 깔아 주는 초기값**일 뿐이다.
 * 현장은 날마다 필요한 사람이 다르다 — 설치는 첫날만, 철거는 마지막 날만,
 * 주말에만 야간조를 붙이는 식이다.
 *
 * 한 줄의 키는 **포지션**이다. 포지션의 이름 · 시각 · 조건은 행사 상세 개요의
 * 포지션 카드에서 고치고, 여기서는 "그날 그 자리에 몇 명 · 얼마"만 정한다.
 */
const DayRoleEditModal = ({ event, day, onClose }: DayRoleEditModalProps) => {
  const roleLabel = useJobRoleLabel();
  const { dayRolesMutation } = useEventMutation();

  /*
    편집 전에는 서버 값을 그대로 쓰고, 한 번이라도 손대면 draft가 화면을 담당한다.
    (가이드 7장의 draft 패턴 — effect로 서버 값을 state에 복사하지 않는다)
  */
  const [draft, setDraft] = useState<DayRoleInput[] | null>(null);
  const serverSlots = useMemo<DayRoleInput[]>(
    () =>
      [...(day?.roles ?? [])]
        .sort(comparePositionOrder(event.positions))
        .map(({ positionId, requiredCount, wageType, wage }) => ({
          positionId,
          requiredCount,
          wageType,
          wage,
        })),
    [day, event.positions],
  );
  const slots = draft ?? serverSlots;

  /** 이 날에 아직 없는 포지션. 여기서 골라 붙인다. */
  const addablePositions = useMemo(
    () =>
      event.positions.filter(
        (position) =>
          !slots.some((slot) => slot.positionId === position.positionId),
      ),
    [event.positions, slots],
  );

  const handleClose = () => {
    setDraft(null);
    onClose();
  };

  const patchSlot = (index: number, patch: Partial<DayRoleInput>) =>
    setDraft(
      slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    );

  /**
   * 포지션 하나를 이 날에 붙인다. 금액은 포지션의 기본값을 따른다.
   * (특정 날만 단가를 올리는 일은 붙인 뒤 이 줄에서 고친다)
   */
  const handleAdd = (positionId: number) => {
    const position = findPosition(event, positionId);

    if (!position) return;

    setDraft(
      [
        ...slots,
        {
          positionId,
          requiredCount: 1,
          wageType: position.wageType,
          wage: position.wage,
        },
      ].sort(comparePositionOrder(event.positions)),
    );
  };

  const handleSave = async () => {
    if (!day) return;

    try {
      await dayRolesMutation.mutateAsync({
        eventId: event.eventId,
        date: day.date,
        roles: slots,
      });
      handleClose();
    } catch (error) {
      showErrorToast(error);
    }
  };

  /** 이 포지션에 이미 배치된 인원. 발주를 그 아래로 내리면 초과 배치가 된다. */
  const assignedOf = (positionId: number) =>
    event.assignments.filter(
      (assignment) =>
        assignment.workDate === day?.date &&
        assignment.positionId === positionId &&
        assignment.status !== "CANCELED",
    ).length;

  const labelOf = (positionId: number) => {
    const position = findPosition(event, positionId);

    return position ? formatPositionLabel(position, roleLabel) : "삭제된 포지션";
  };

  /**
   * 포지션 한 줄을 이 날 발주에서 뺀다.
   *
   * 사람이 배치돼 있어도 막지 않는다. 배치는 그대로 남고 초과 배치로 표시될 뿐이라
   * 되돌릴 수 없는 일이 아니다. 다만 "이 사람들은 어떻게 되지"가 바로 떠오르는
   * 자리이므로, 배치가 있을 때만 무슨 일이 일어나는지 먼저 알려 준다.
   */
  const handleRemoveSlot = (index: number) => {
    const slot = slots[index];
    const assigned = assignedOf(slot.positionId);
    const remove = () =>
      setDraft(slots.filter((_, other) => other !== index));

    if (assigned === 0) {
      remove();
      return;
    }

    openConfirm({
      title: `'${labelOf(slot.positionId)}'을 이 날 발주에서 뺄까요?`,
      description: `이미 배치된 ${assigned}명은 그대로 남습니다. 발주가 0명이 되어 이 포지션은 '초과 배치'로 표시됩니다.`,
      warning:
        "사람까지 빼려면 일별 근무자에서 배치를 따로 해제해 주세요. 저장을 눌러야 반영됩니다.",
      confirmText: "빼기",
      tone: "danger",
      onConfirm: async () => remove(),
    });
  };

  const overAssigned = slots.filter(
    (slot) => assignedOf(slot.positionId) > slot.requiredCount,
  );

  const addOptions = [
    { label: "포지션 추가…", value: "" },
    ...addablePositions.map((position) => ({
      label: `${formatPositionLabel(position, roleLabel)} · ${formatTimeRange(
        position.startTime,
        position.endTime,
        position.endDayOffset,
      )}`,
      value: String(position.positionId),
    })),
  ];

  return (
    <Modal
      isOpen={Boolean(day)}
      onClose={handleClose}
      title="이 날의 발주 인원"
      description={day ? formatDate(day.date) : undefined}
      size="lg"
      onSubmit={slots.length === 0 ? undefined : handleSave}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            isLoading={dayRolesMutation.isPending}
            disabled={slots.length === 0}
            onClick={handleSave}
          >
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Alert tone="info" title="이 날 하루에만 적용됩니다.">
          다른 근무일의 발주는 그대로입니다. 포지션의 이름 · 시각 · 조건은 개요
          탭의 포지션 카드에서 고칩니다.
        </Alert>

        <div className="flex flex-col gap-2 rounded-field border border-border-main p-3">
          {slots.length === 0 && (
            <p className="py-2 text-center text-[13px] text-font-2">
              이 날의 발주가 비어 있습니다. 아래에서 포지션을 추가하세요.
            </p>
          )}

          {slots.map((slot, index) => {
            const assigned = assignedOf(slot.positionId);
            const position = findPosition(event, slot.positionId);

            return (
              /*
                좁은 화면에서는 [포지션] / [인원][기준][금액][삭제] 두 줄로 접힌다.
                고정 폭만 390px가 넘어 한 줄로는 모달 안에 들어가지 못한다.
              */
              <div
                key={slot.positionId}
                className="flex flex-wrap items-center gap-2 border-b border-border-main pb-2 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0 basis-full sm:basis-44 sm:shrink-0">
                  <p className="truncate text-[13px] font-medium text-font-1">
                    {labelOf(slot.positionId)}
                  </p>
                  {position && (
                    <p className="truncate text-[12px] text-font-2 tabular-nums">
                      {formatTimeRange(
                        position.startTime,
                        position.endTime,
                        position.endDayOffset,
                      )}
                      {assigned > 0 && ` · 배치 ${assigned}명`}
                    </p>
                  )}
                </div>

                <Input
                  type="number"
                  min={0}
                  aria-label={`${labelOf(slot.positionId)} 발주 인원`}
                  value={slot.requiredCount}
                  onChange={(changeEvent) =>
                    patchSlot(index, {
                      requiredCount: Math.max(
                        0,
                        Number(changeEvent.target.value) || 0,
                      ),
                    })
                  }
                  rightSlot={<span className="text-[13px] text-font-2">명</span>}
                  inputBoxClassName="w-24"
                />

                <Select
                  aria-label="지급 기준"
                  options={WAGE_TYPE_OPTIONS}
                  value={slot.wageType}
                  onChange={(changeEvent) =>
                    patchSlot(index, {
                      wageType: changeEvent.target.value as WageType,
                    })
                  }
                  selectBoxClassName="w-24 shrink-0"
                />

                <AmountInput
                  aria-label="지급 금액"
                  value={slot.wage}
                  onValueChange={(wage) => patchSlot(index, { wage })}
                  rightSlot={
                    <span className="text-[13px] whitespace-nowrap text-font-2">
                      {WAGE_TYPE_UNIT[slot.wageType]}
                    </span>
                  }
                  inputBoxClassName="min-w-28 flex-1"
                />

                {/*
                  배치된 사람이 있어도 **뺄 수 있다.**
                  빼도 사람이 사라지지는 않는다. 그 포지션은 '발주 0 · 배치 n'
                  (`1/0`)으로 초과 배치 자리에 그대로 남는다.
                */}
                <IconButton
                  label="포지션 빼기"
                  icon={<Trash size={16} />}
                  tone="danger"
                  title={
                    assigned > 0
                      ? `이 날 발주에서 뺍니다. 배치된 ${assigned}명은 그대로 남아 초과 배치로 표시됩니다.`
                      : "이 날의 발주에서 뺍니다."
                  }
                  onClick={() => handleRemoveSlot(index)}
                />
              </div>
            );
          })}

          {/*
            이 날에 없는 포지션만 고를 수 있다. 같은 포지션이 두 줄이면
            서버가 어느 줄을 믿어야 할지 알 수 없다.
            새 포지션 자체(야간조 신설 등)는 개요의 포지션 카드에서 만든다.
          */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Plus size={14} className="text-font-2" />
            <Select
              aria-label="이 날에 추가할 포지션"
              options={addOptions}
              value=""
              disabled={addablePositions.length === 0}
              onChange={(changeEvent) => {
                const positionId = Number(changeEvent.target.value);

                if (positionId) handleAdd(positionId);
              }}
              selectBoxClassName="min-w-0 flex-1"
            />
          </div>
          {addablePositions.length === 0 && (
            <p className="text-[12px] text-font-2">
              이 행사의 포지션을 모두 넣었습니다. 새 포지션은 개요 탭에서 만듭니다.
            </p>
          )}
        </div>

        {/*
          발주를 배치보다 낮게 잡는 것 자체는 막지 않는다.
          현장에서 사람이 더 붙는 일이 실제로 흔해서 초과 배치를 허용하고 있다.
          다만 모르고 내린 것과 알고 내린 것은 다르므로 짚어 준다.
        */}
        {overAssigned.length > 0 && (
          <Alert tone="warning" title="발주보다 많이 배치된 포지션이 있습니다.">
            {overAssigned
              .map(
                (slot) =>
                  `${labelOf(slot.positionId)} 발주 ${slot.requiredCount}명 · 배치 ${assignedOf(slot.positionId)}명`,
              )
              .join(" · ")}
            . 초과 배치는 그대로 두어도 됩니다. 인원을 줄이려면 배치를 먼저
            해제해 주세요.
          </Alert>
        )}
      </div>
    </Modal>
  );
};

export default DayRoleEditModal;
