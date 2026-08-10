"use client";

import { useState } from "react";
import { useSettingsQuery } from "@/api/ops/getSettings";
import { usePayrollMutation } from "@/api/payroll/mutatePayroll";
import { ATTENDANCE_STATUS_LABEL } from "@/type/staff";
import { calculatePayroll, DEFAULT_WITHHOLDING_RATE } from "@/type/payroll";
import type { PayrollItem, PayrollWorkDay } from "@/type/payroll";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { WAGE_TYPE_LABEL, toTimeInput } from "@/type/event";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";

interface PayrollAdjustModalProps {
  payroll: PayrollItem | null;
  onClose: () => void;
}

/** 근무일 내역 표의 컬럼 폭. 머리글과 각 행이 같은 정의를 쓴다. */
const DAY_GRID = "grid grid-cols-[1fr_120px_100px_80px_90px] gap-2";

/** 계산 결과 한 줄 */
const AmountRow = ({
  label,
  value,
  isStrong = false,
}: {
  label: string;
  value: string;
  isStrong?: boolean;
}) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-[13px] text-font-2">{label}</span>
    <span
      className={
        isStrong
          ? "text-[15px] font-semibold text-font-0 tabular-nums"
          : "text-[14px] text-font-1 tabular-nums"
      }
    >
      {value}
    </span>
  </div>
);

/**
 * 지급액 조정 모달.
 *
 * 정산 한 건은 **행사 하나에 나온 날 전체**다. 그래서 이 화면이 하는 일이
 * 하나 더 늘었다. 합계 금액이 어느 날들을 더해 나온 값인지 보여 주는 것이다.
 * 총액만 띄우면 "사흘치가 맞나"를 확인할 방법이 없어, 담당자는 결국
 * 근태 탭과 이 화면을 오가며 손으로 검산하게 된다.
 *
 * 식대 · 교통비처럼 현장에서 생기는 추가 지급과,
 * 지각 · 중도 이탈로 인한 차감을 여기서 손본다.
 *
 * 근무시간은 여기서 고치지 않는다. 실제 출퇴근은 **근태 기록**에서 남기고,
 * 이 화면은 그 결과로 계산된 금액을 보여 준다. (두 곳에서 고치면 값이 어긋난다)
 *
 * 연장 · 야간수당은 금액을 직접 고치지 않는다. 대신 **붙일지 말지**를 고른다.
 * 조건만 맞으면 무조건 붙던 예전 방식은 거래처와 협의해 빼기로 한 건을
 * 표현할 수 없어서, 담당자가 결국 차감액에 억지로 적어 넣고 있었다.
 */
const PayrollAdjustModal = ({ payroll, onClose }: PayrollAdjustModalProps) => {
  // 편집 전에는 서버 값을 그대로 쓰고, 편집이 시작되면 draft가 화면을 담당한다.
  const [draft, setDraft] = useState<{
    allowance: string;
    deduction: string;
    isOvertimeApplied: boolean;
    isNightPayApplied: boolean;
    isBreakDeducted: boolean;
  } | null>(null);

  const { data: settings } = useSettingsQuery();
  const { amountMutation } = usePayrollMutation();

  const allowance = draft?.allowance ?? String(payroll?.allowance ?? 0);
  const deduction = draft?.deduction ?? String(payroll?.deduction ?? 0);
  const isOvertimeApplied =
    draft?.isOvertimeApplied ?? payroll?.isOvertimeApplied ?? false;
  const isNightPayApplied =
    draft?.isNightPayApplied ?? payroll?.isNightPayApplied ?? false;
  const isBreakDeducted =
    draft?.isBreakDeducted ?? payroll?.isBreakDeducted ?? true;

  const patchDraft = (
    patch: Partial<{
      allowance: string;
      deduction: string;
      isOvertimeApplied: boolean;
      isNightPayApplied: boolean;
      isBreakDeducted: boolean;
    }>,
  ) =>
    setDraft({
      allowance,
      deduction,
      isOvertimeApplied,
      isNightPayApplied,
      isBreakDeducted,
      ...patch,
    });

  const handleClose = () => {
    setDraft(null);
    onClose();
  };

  const nextAllowance = Number(allowance) || 0;
  const nextDeduction = Number(deduction) || 0;

  /*
    미리보기 금액은 목업 · 정산 목록과 같은 함수로 계산한다.
    여기서만 따로 더하면 저장 후 숫자가 달라진다.

    근무일 배열을 그대로 넘기는 것이 핵심이다. 합계 시간만 넘기면
    연장근로(하루 8시간 기준)를 며칠에 걸쳐 판정할 수 없다.
  */
  /**
   * 이 날 실제로 돈이 매겨지는 시간.
   *
   * 휴게 공제를 끄면 그날 빠졌던 휴게시간이 되살아난다.
   * 목업이 저장할 때 쓰는 식과 **같은 모양**이어야 미리보기와 저장 결과가 맞는다.
   */
  const paidHoursOf = (day: PayrollWorkDay) =>
    isBreakDeducted || !day.isPayable
      ? day.workHours
      : Math.round((day.workHours + day.breakMinutes / 60) * 10) / 10;

  const calculated = payroll
    ? calculatePayroll({
        days: payroll.days.map((day) => ({
          workHours: paidHoursOf(day),
          nightHours: day.nightHours,
          wageType: day.wageType,
          wage: day.wage,
          isPayable: day.isPayable,
        })),
        allowance: nextAllowance,
        deduction: nextDeduction,
        withholdingRate: settings?.withholdingRate ?? DEFAULT_WITHHOLDING_RATE,
        isOvertimeApplied,
        overtimeThresholdHours: settings?.overtimeThresholdHours ?? 8,
        overtimeRate: settings?.overtimeRate ?? 0.5,
        isNightPayApplied,
        nightRate: settings?.nightRate ?? 0.5,
      })
    : null;

  const handleSubmit = () => {
    if (!payroll) return;

    amountMutation.mutate(
      {
        payrollId: payroll.payrollId,
        allowance: nextAllowance,
        deduction: nextDeduction,
        isOvertimeApplied,
        isNightPayApplied,
        isBreakDeducted,
      },
      { onSuccess: handleClose },
    );
  };

  const isDaily = payroll?.wageType === "DAILY";

  return (
    <Modal
      isOpen={Boolean(payroll)}
      onClose={handleClose}
      title="지급액 조정"
      description={
        payroll
          ? `${payroll.staffName} · ${payroll.eventTitle} · ${payroll.workDates.length}일치`
          : undefined
      }
      size="lg"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={amountMutation.isPending}
          >
            저장
          </Button>
        </>
      }
    >
      {payroll && calculated && (
        <div className="flex flex-col gap-4">
          {/*
            근무일 내역.

            이 표가 금액의 근거다. 며칠 나왔는지, 각 날 몇 시간 일했는지,
            아직 출퇴근이 안 찍힌 날은 어느 날인지가 한눈에 보여야
            "합계가 맞나"를 이 화면에서 끝낼 수 있다.
          */}
          <div className="overflow-hidden rounded-field border border-border-main">
            <div
              className={`${DAY_GRID} bg-subtle px-4 py-2 text-[12px] font-medium text-font-2`}
            >
              <span>근무일</span>
              <span>출퇴근</span>
              <span className="text-right">근무시간</span>
              <span className="text-center">근태</span>
              <span className="text-right">차감</span>
            </div>

            <div className="flex flex-col divide-y divide-border-main">
              {payroll.days.map((day) => (
                <div
                  key={day.assignmentId}
                  className={`${DAY_GRID} items-center px-4 py-2 text-[13px]`}
                >
                  <span className="text-font-1 tabular-nums">
                    {formatDate(day.workDate)}
                  </span>

                  <span className="text-font-2 tabular-nums">
                    {day.isActualTimeApplied
                      ? `${toTimeInput(day.checkInAt)}~${toTimeInput(day.checkOutAt)}`
                      : "미기록"}
                  </span>

                  <span className="text-right text-font-1 tabular-nums">
                    {paidHoursOf(day)}h
                    {/*
                      공제를 끄면 근무시간보다 길게 잡힌다.
                      그 차이가 어디서 왔는지 적지 않으면 "왜 9시간이지"가 된다.
                    */}
                    {paidHoursOf(day) !== day.workHours && (
                      <span className="ml-1 text-[11px] text-brand">
                        휴게 포함
                      </span>
                    )}
                    {day.isPayable && !day.isActualTimeApplied && (
                      <span className="ml-1 text-[11px] text-warning">예정</span>
                    )}
                  </span>

                  <span className="text-center text-[12px] text-font-2">
                    {ATTENDANCE_STATUS_LABEL[day.attendance]}
                  </span>

                  <span className="text-right tabular-nums">
                    {/* 안 나온 날은 지급 의무가 없다. 줄은 남기고 0원으로 적는다. */}
                    {!day.isPayable ? (
                      <span className="text-font-2">0원</span>
                    ) : day.deduction > 0 ? (
                      <span className="text-danger">
                        -{formatCurrency(day.deduction)}
                      </span>
                    ) : (
                      <span className="text-font-disabled">-</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border-main bg-subtle px-4 py-2.5">
              <span className="text-[13px] text-font-2">
                합계 {payroll.workDates.length}일
              </span>

              <div className="flex items-center gap-2">
                {payroll.provisionalDayCount > 0 && (
                  <Badge
                    tone="warning"
                    title="출퇴근이 기록되지 않은 날은 행사 예정 시간으로 계산했습니다. 근태 기록을 채우면 금액이 자동으로 다시 계산됩니다."
                  >
                    {payroll.provisionalDayCount}일 예정 기준
                  </Badge>
                )}
                <span className="text-[15px] font-semibold whitespace-nowrap text-font-0 tabular-nums">
                  {calculated.totalWorkHours}시간
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-field border border-border-main bg-subtle px-4 py-3">
            {/*
              기본급의 근거 식.
              시급은 모든 날의 실근무시간을 더해 곱하고, 일급은 며칠 나왔는지만 곱한다.
            */}
            <AmountRow
              label={
                isDaily
                  ? `기본급 (${WAGE_TYPE_LABEL.DAILY} ${formatCurrency(payroll.wage)} × ${payroll.workDates.length}일)`
                  : `기본급 (${formatCurrency(payroll.wage)} × ${calculated.totalWorkHours}h)`
              }
              value={formatCurrency(calculated.basePay)}
            />

            {/*
              휴게시간 공제.

              팀장은 휴게를 통으로 쉬는 자리가 아니라 쪼개 쓰거나 쉬는 중에도
              무전을 받고 현장을 돈다. 그래서 공제하지 않고 주는 에이전시가 많다.
              규칙으로 못 박지 않고 건별로 켜고 끈다 — 직무마다 · 거래처마다
              다르고, 같은 팀장이라도 행사에 따라 달라진다.

              일급 건에도 둔다. 일급은 금액이 시간과 무관하지만, 여기서 끈
              근무시간이 연장 판정과 기록에 그대로 남는다.
            */}
            <div className="flex items-center justify-between gap-3 border-t border-border-main py-2">
              <div className="min-w-0">
                <p className="text-[13px] text-font-1">휴게시간 공제</p>
                <p className="mt-0.5 text-[12px] text-font-2">
                  {isBreakDeducted
                    ? "출퇴근 시간에서 휴게시간을 뺀 시간으로 계산합니다."
                    : "휴게시간을 빼지 않고 출퇴근 시간 전체로 계산합니다."}
                </p>
              </div>

              <Switch
                label="휴게시간 공제"
                checked={isBreakDeducted}
                onChange={(checked) => patchDraft({ isBreakDeducted: checked })}
              />
            </div>

            {/*
              일급은 "하루에 얼마"로 합의한 총액이라 연장 · 야간을 따로 얹지 않는다.
              스위치를 켤 수 있게 두면 켜도 0원이라 고장 난 것처럼 보인다.
              더 줄 돈이 생기면 아래 기타 수당으로 넣는다. 그래야 이유가 남는다.
            */}
            {isDaily ? (
              <div className="border-t border-border-main py-2 text-[13px] text-font-2">
                일급 건은 연장 · 야간수당을 따로 계산하지 않습니다. 합의한 금액에
                이미 포함된 것으로 봅니다. 추가로 지급할 금액은 아래 기타 수당에
                넣어 주세요.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-t border-border-main py-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      label="연장수당 적용"
                      checked={isOvertimeApplied}
                      onChange={(checked) =>
                        patchDraft({ isOvertimeApplied: checked })
                      }
                    />
                    {/*
                      연장은 하루 단위로 판정한다. 사흘 동안 18시간 일한 사람은
                      하루도 8시간을 넘기지 않았으므로 연장수당이 붙지 않는다.
                      합계 시간으로 재면 붙어 버린다.
                    */}
                    <span className="text-[13px] text-font-2">
                      연장수당 (하루 {settings?.overtimeThresholdHours ?? 8}시간
                      초과분 {settings?.overtimeRate ?? 0.5}배)
                    </span>
                  </div>
                  <span className="text-[14px] text-font-1 tabular-nums">
                    {formatCurrency(calculated.overtimePay)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-border-main py-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      label="야간수당 적용"
                      checked={isNightPayApplied}
                      onChange={(checked) =>
                        patchDraft({ isNightPayApplied: checked })
                      }
                    />
                    <span className="text-[13px] text-font-2">
                      야간수당 (전체 야간 {payroll.nightHours}시간 ·{" "}
                      {settings?.nightRate ?? 0.5}배)
                    </span>
                  </div>
                  <span className="text-[14px] text-font-1 tabular-nums">
                    {formatCurrency(calculated.nightPay)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="기타 수당"
              hint="식대 · 교통비 등 (전체 근무일 합계)"
            >
              <Input
                type="number"
                min={0}
                step={1000}
                value={allowance}
                onChange={(event) =>
                  patchDraft({ allowance: event.target.value })
                }
                rightSlot={<span className="text-[13px] text-font-2">원</span>}
              />
            </FormField>

            <FormField label="차감액" hint="지각 · 중도 이탈 (전체 근무일 합계)">
              <Input
                type="number"
                min={0}
                step={1000}
                value={deduction}
                onChange={(event) =>
                  patchDraft({ deduction: event.target.value })
                }
                rightSlot={<span className="text-[13px] text-font-2">원</span>}
              />
            </FormField>
          </div>

          <div className="rounded-field border border-border-main px-4 py-3">
            <AmountRow
              label="세전 총액"
              value={formatCurrency(calculated.grossPay)}
            />
            <AmountRow
              label={`원천징수 (${((settings?.withholdingRate ?? DEFAULT_WITHHOLDING_RATE) * 100).toFixed(1)}%)`}
              value={`-${formatCurrency(calculated.withholdingTax)}`}
            />
            <div className="mt-1 border-t border-border-main pt-1">
              {/* 여러 날치를 한 번에 이체한다는 사실을 마지막 줄에서 못 박는다. */}
              <AmountRow
                label={`실지급액 (${payroll.workDates.length}일치 한 번에 이체)`}
                value={formatCurrency(calculated.netPay)}
                isStrong
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default PayrollAdjustModal;
