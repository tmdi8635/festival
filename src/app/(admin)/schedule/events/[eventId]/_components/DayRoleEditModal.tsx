"use client";

import { useState } from "react";
import { useEventMutation } from "@/api/event/mutateEvent";
import { WAGE_TYPE_OPTIONS } from "@/constants/eventOptions";
import { Plus, Trash } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { showErrorToast } from "@/lib/toast";
import {
  useActiveJobRoles,
  useJobRoleComparator,
  useJobRoleLabel,
  useJobRoleOptions,
} from "@/store/useOrgStore";
import {
  WAGE_TYPE_UNIT,
  type EventDayPlan,
  type EventDetail,
  type EventRoleSlot,
  type WageType,
} from "@/type/event";
import type { JobRole } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";

/** 편집 중인 한 줄. 저장할 때만 `assignedCount`를 뺀 모양으로 보낸다. */
type DraftSlot = Omit<EventRoleSlot, "assignedCount">;

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
 * 주말에만 인원을 늘리는 식이다.
 *
 * 그걸 표현할 방법이 없으면 담당자는 가장 많이 필요한 날에 맞춰 발주를 잡아 두고
 * 나머지 날은 머릿속으로 뺀다. 그러면 "인원이 덜 찬 날"을 화면이 영영 알아채지 못한다.
 */
const DayRoleEditModal = ({ event, day, onClose }: DayRoleEditModalProps) => {
  const roleLabel = useJobRoleLabel();
  const jobRoleOptions = useJobRoleOptions();
  const compareRoles = useJobRoleComparator();
  const activeJobRoles = useActiveJobRoles();
  const { dayRolesMutation } = useEventMutation();

  /*
    편집 전에는 서버 값을 그대로 쓰고, 한 번이라도 손대면 draft가 화면을 담당한다.
    (가이드 7장의 draft 패턴 — effect로 서버 값을 state에 복사하지 않는다)
  */
  const [draft, setDraft] = useState<DraftSlot[] | null>(null);
  const serverSlots: DraftSlot[] = (day?.roles ?? []).map(
    ({ role, requiredCount, wageType, wage }) => ({
      role,
      requiredCount,
      wageType,
      wage,
    }),
  );
  const slots = draft ?? serverSlots;

  const handleClose = () => {
    setDraft(null);
    onClose();
  };

  const patchSlot = (index: number, patch: Partial<DraftSlot>) =>
    setDraft(
      slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    );

  /** 아직 이 날에 없는 직무 중 기준 설정 순서로 가장 앞엣것을 넣는다. */
  const handleAdd = () => {
    const used = new Set(slots.map((slot) => slot.role));
    const next = [...activeJobRoles]
      .filter((def) => !used.has(def.code))
      .sort((a, b) => compareRoles(a.code, b.code))[0];

    if (!next) return;

    setDraft([
      ...slots,
      {
        role: next.code,
        requiredCount: 1,
        wageType: next.defaultWageType,
        wage: next.defaultWage,
      },
    ]);
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

  /** 이 직무에 이미 배치된 인원. 발주를 그 아래로 내리면 초과 배치가 된다. */
  const assignedOf = (role: JobRole) =>
    event.assignments.filter(
      (assignment) =>
        assignment.workDate === day?.date &&
        assignment.role === role &&
        assignment.status !== "CANCELED",
    ).length;

  const overAssigned = slots.filter(
    (slot) => assignedOf(slot.role) > slot.requiredCount,
  );
  const canAdd = slots.length < activeJobRoles.length;

  return (
    <Modal
      isOpen={Boolean(day)}
      onClose={handleClose}
      title="이 날의 발주 인원"
      description={day ? formatDate(day.date) : undefined}
      size="lg"
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
          다른 근무일의 발주는 그대로입니다. 설치 · 철거처럼 특정 날에만 필요한
          직무를 여기서 넣고 빼면 됩니다.
        </Alert>

        <div className="flex flex-col gap-2 rounded-field border border-border-main p-3">
          {slots.map((slot, index) => {
            const assigned = assignedOf(slot.role);

            return (
              /*
                좁은 화면에서는 [직무][인원] / [기준][금액][삭제] 두 줄로 접힌다.
                고정 폭만 390px가 넘어 한 줄로는 모달 안에 들어가지 못한다.
              */
              <div
                key={slot.role}
                className="flex flex-wrap items-center gap-2 border-b border-border-main pb-2 last:border-b-0 last:pb-0 sm:flex-nowrap sm:border-b-0 sm:pb-0"
              >
                <Select
                  aria-label="직무"
                  options={jobRoleOptions.filter(
                    (option) =>
                      option.value === slot.role ||
                      !slots.some((other) => other.role === option.value),
                  )}
                  value={slot.role}
                  onChange={(changeEvent) =>
                    patchSlot(index, {
                      role: changeEvent.target.value as JobRole,
                    })
                  }
                  selectBoxClassName="min-w-32 flex-1 sm:w-32 sm:flex-none"
                />

                <Input
                  type="number"
                  min={0}
                  aria-label={`${roleLabel(slot.role)} 발주 인원`}
                  value={slot.requiredCount}
                  onChange={(changeEvent) =>
                    patchSlot(index, {
                      requiredCount: Number(changeEvent.target.value),
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

                <Input
                  type="number"
                  min={0}
                  step={500}
                  aria-label="지급 금액"
                  value={slot.wage}
                  onChange={(changeEvent) =>
                    patchSlot(index, { wage: Number(changeEvent.target.value) })
                  }
                  rightSlot={
                    <span className="text-[13px] whitespace-nowrap text-font-2">
                      {WAGE_TYPE_UNIT[slot.wageType]}
                    </span>
                  }
                  inputBoxClassName="min-w-28 flex-1"
                />

                <IconButton
                  label="직무 빼기"
                  icon={<Trash size={16} />}
                  tone="danger"
                  disabled={assigned > 0}
                  title={
                    assigned > 0
                      ? `이미 ${assigned}명이 배치되어 있어 뺄 수 없습니다. 배치를 먼저 해제해 주세요.`
                      : "이 날의 발주에서 뺍니다."
                  }
                  onClick={() =>
                    setDraft(slots.filter((_, other) => other !== index))
                  }
                />
              </div>
            );
          })}

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus size={14} />}
            disabled={!canAdd}
            title={canAdd ? undefined : "쓸 수 있는 직무를 모두 넣었습니다."}
            onClick={handleAdd}
          >
            직무 추가
          </Button>
        </div>

        {/*
          발주를 배치보다 낮게 잡는 것 자체는 막지 않는다.
          현장에서 사람이 더 붙는 일이 실제로 흔해서 초과 배치를 허용하고 있다.
          다만 모르고 내린 것과 알고 내린 것은 다르므로 짚어 준다.
        */}
        {overAssigned.length > 0 && (
          <Alert tone="warning" title="발주보다 많이 배치된 직무가 있습니다.">
            {overAssigned
              .map(
                (slot) =>
                  `${roleLabel(slot.role)} 발주 ${slot.requiredCount}명 · 배치 ${assignedOf(slot.role)}명`,
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
