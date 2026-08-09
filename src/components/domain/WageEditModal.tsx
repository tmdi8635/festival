"use client";

import { useState } from "react";
import { useSettingsQuery } from "@/api/ops/getSettings";
import { useAssignmentMutation } from "@/api/event/mutateAssignment";
import { WAGE_TYPE_OPTIONS } from "@/constants/eventOptions";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  WAGE_TYPE_LABEL,
  WAGE_TYPE_UNIT,
  calculateBasePay,
  calculateScheduledWorkHours,
  type Assignment,
  type EventDetail,
  type WageType,
} from "@/type/event";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";

interface WageEditModalProps {
  /** 금액을 고칠 배치. 이 사람의 이 날짜 건이 기준이 된다. */
  assignment: Assignment | null;
  event: EventDetail;
  onClose: () => void;
}

/**
 * 적용 금액 변경.
 *
 * 기준 설정의 직무 시급은 **기준값**일 뿐이다.
 * 행사를 만들 때 초기값으로 깔릴 뿐, 실제로는 그대로 나가는 일이 오히려 드물다.
 *
 * - 같은 스태프라도 맡는 일이 다르면 금액이 달라진다. (안내 vs 무거운 짐)
 * - 오래 나온 사람에게만 조금 더 얹어 주기로 하는 일이 흔하다.
 * - 사람이 급히 필요한 날은 그날만 단가를 올려 부른다.
 * - 첫날은 설치를 도와 일급, 나머지 날은 시급으로 서는 경우도 있다.
 *
 * 그래서 금액은 **배치 한 건(사람 × 날짜) 단위로 언제든 고칠 수 있어야 한다.**
 * 여기서 고친 금액은 정산에 곧바로 반영된다. (정산이 근무일별 금액을 각각 더한다)
 */
const WageEditModal = ({ assignment, event, onClose }: WageEditModalProps) => {
  // 편집 전에는 서버 값을 그대로 쓰고, 편집이 시작되면 draft가 화면을 담당한다.
  const [draft, setDraft] = useState<{
    wageType: WageType;
    wage: string;
    appliesToAllDates: boolean;
  } | null>(null);

  const roleLabel = useJobRoleLabel();
  const { data: settings } = useSettingsQuery();
  const { wageMutation } = useAssignmentMutation();

  const wageType = draft?.wageType ?? assignment?.wageType ?? "HOURLY";
  const wage = draft?.wage ?? String(assignment?.wage ?? 0);
  const appliesToAllDates = draft?.appliesToAllDates ?? false;

  const patchDraft = (
    patch: Partial<{
      wageType: WageType;
      wage: string;
      appliesToAllDates: boolean;
    }>,
  ) => setDraft({ wageType, wage, appliesToAllDates, ...patch });

  const handleClose = () => {
    setDraft(null);
    onClose();
  };

  /**
   * 이 사람이 이 행사에서 맡은 같은 직무의 배치들.
   *
   * 금액을 바꾸기로 했으면 대개 그 사람의 이 행사 전체가 대상이다.
   * 직무가 다르면 조건도 다른 일이므로 함께 묶지 않는다.
   */
  const siblingAssignments = assignment
    ? event.assignments
        .filter(
          (target) =>
            target.staffId === assignment.staffId &&
            target.role === assignment.role &&
            target.status !== "CANCELED",
        )
        .sort((a, b) => a.workDate.localeCompare(b.workDate))
    : [];

  const targetAssignments = appliesToAllDates
    ? siblingAssignments
    : assignment
      ? [assignment]
      : [];

  const nextWage = Number(wage) || 0;

  const scheduledWorkHours = calculateScheduledWorkHours(event);

  /** 바꾼 뒤 하루치가 얼마가 되는지. 숫자만 고치게 두면 감이 오지 않는다. */
  const nextDailyPay = calculateBasePay(wageType, nextWage, scheduledWorkHours);

  /*
    최저시급은 막지 않고 알려만 준다.
    수습 · 반나절 등 예외가 실제로 있어서 시스템이 막으면 손으로 우회하게 된다.
    (일급은 시간과 무관한 금액이라 같은 잣대를 댈 수 없어 검사하지 않는다)
  */
  const minimumWage = settings?.minimumHourlyWage ?? 0;
  const isBelowMinimum =
    wageType === "HOURLY" && nextWage > 0 && nextWage < minimumWage;

  const isUnchanged =
    assignment !== null &&
    !appliesToAllDates &&
    assignment.wageType === wageType &&
    assignment.wage === nextWage;

  const handleSubmit = () => {
    if (targetAssignments.length === 0) return;

    wageMutation.mutate(
      {
        assignmentIds: targetAssignments.map((item) => item.assignmentId),
        wageType,
        wage: nextWage,
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Modal
      isOpen={Boolean(assignment)}
      onClose={handleClose}
      title="적용 금액 변경"
      description={
        assignment
          ? `${assignment.staffName} · ${roleLabel(assignment.role)} · ${formatDate(assignment.workDate)}`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={nextWage <= 0 || isUnchanged}
            isLoading={wageMutation.isPending}
          >
            {targetAssignments.length > 1
              ? `${targetAssignments.length}일 적용`
              : "변경"}
          </Button>
        </>
      }
    >
      {assignment && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[140px_1fr] gap-4">
            <FormField label="지급 기준">
              <Select
                aria-label="지급 기준"
                options={WAGE_TYPE_OPTIONS}
                value={wageType}
                onChange={(changeEvent) =>
                  patchDraft({
                    wageType: changeEvent.target.value as WageType,
                  })
                }
              />
            </FormField>

            <FormField
              label="금액"
              hint={
                wageType === "DAILY"
                  ? "시간과 무관하게 하루에 지급하는 금액입니다."
                  : `행사 예정 ${scheduledWorkHours}시간 기준 하루 ${formatCurrency(nextDailyPay)}`
              }
            >
              <Input
                type="number"
                min={0}
                step={500}
                value={wage}
                hasError={nextWage <= 0}
                onChange={(changeEvent) =>
                  patchDraft({ wage: changeEvent.target.value })
                }
                rightSlot={
                  <span className="text-[13px] whitespace-nowrap text-font-2">
                    {WAGE_TYPE_UNIT[wageType]}
                  </span>
                }
              />
            </FormField>
          </div>

          {/* 원래 금액과 무엇이 달라지는지 나란히 보여 준다. */}
          <div className="flex items-center gap-3 rounded-field border border-border-main bg-subtle px-4 py-3 text-[13px]">
            <span className="text-font-2">현재</span>
            <span className="text-font-1 tabular-nums">
              {WAGE_TYPE_LABEL[assignment.wageType]}{" "}
              {formatCurrency(assignment.wage)}
            </span>
            <span className="text-font-disabled">→</span>
            <span className="font-semibold text-font-0 tabular-nums">
              {WAGE_TYPE_LABEL[wageType]} {formatCurrency(nextWage)}
            </span>

            {wageType === "DAILY" && (
              <Badge tone="neutral" title="일급은 연장 · 야간수당을 따로 붙이지 않습니다.">
                연장 · 야간 해당 없음
              </Badge>
            )}
          </div>

          {isBelowMinimum && (
            <Alert tone="warning" title="최저 시급보다 낮습니다.">
              기준 설정의 최저 시급은 {formatCurrency(minimumWage)}입니다.
              그래도 저장할 수 있습니다. 수습 · 반나절처럼 예외가 실제로
              있으니까요. 다만 근로기준법상 문제가 없는지는 확인해 주세요.
            </Alert>
          )}

          {/*
            여러 날 나오는 사람은 하루만 고치면 나머지 날이 옛 금액으로 남는다.
            그 상태로 정산하면 총액이 예상과 달라지므로 여기서 함께 처리하게 한다.
          */}
          {siblingAssignments.length > 1 && (
            <div className="flex flex-col gap-2 rounded-field border border-border-main px-4 py-3">
              <Checkbox
                label={`이 사람의 이 행사 근무일 ${siblingAssignments.length}일 전체에 적용`}
                checked={appliesToAllDates}
                onChange={(changeEvent) =>
                  patchDraft({ appliesToAllDates: changeEvent.target.checked })
                }
              />

              <div className="flex flex-wrap gap-1.5 pl-6">
                {siblingAssignments.map((target) => {
                  const isTarget = targetAssignments.some(
                    (item) => item.assignmentId === target.assignmentId,
                  );

                  return (
                    <span
                      key={target.assignmentId}
                      className={
                        isTarget
                          ? "rounded-[5px] bg-surface-selected px-2 py-0.5 text-[11px] font-medium text-brand tabular-nums"
                          : "rounded-[5px] bg-subtle px-2 py-0.5 text-[11px] text-font-2 tabular-nums"
                      }
                      title={
                        isTarget
                          ? "이 날짜에 새 금액이 적용됩니다."
                          : `이 날짜는 ${WAGE_TYPE_LABEL[target.wageType]} ${formatCurrency(target.wage)} 그대로입니다.`
                      }
                    >
                      {target.workDate.slice(5)}{" "}
                      {formatCurrency(isTarget ? nextWage : target.wage)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[12px] text-font-2">
            바꾼 금액은 정산에 곧바로 반영됩니다. 이미 계약서를 발송했다면 금액이
            달라지므로 <b>계약서를 다시 만들어 보내야 합니다.</b>
          </p>
        </div>
      )}
    </Modal>
  );
};

export default WageEditModal;
