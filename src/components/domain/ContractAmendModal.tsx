"use client";

import { useState } from "react";
import { useContractMutation } from "@/api/contract/mutateContract";
import { ATTENDANCE_STATUS_TONE } from "@/constants/staffOptions";
import { Warning } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  WAGE_TYPE_LABEL,
  type EventDetail,
  toTimeInput,
} from "@/type/event";
import {
  AMEND_REASON_LABEL,
  AMEND_REASON_PRESETS,
  summarizeContractWork,
  type AmendReasonType,
  type Contract,
  type ContractWorkDay,
} from "@/type/contract";
import { ATTENDANCE_STATUS_LABEL } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

const REASON_TYPE_OPTIONS = (
  Object.keys(AMEND_REASON_LABEL) as AmendReasonType[]
).map((value) => ({ label: AMEND_REASON_LABEL[value], value }));

interface ContractAmendModalProps {
  /** 재작성할 계약서. 가장 최근 차수여야 한다. */
  contract: Contract | null;
  /**
   * 행사 상세.
   *
   * 있으면 근태 · 실제 출퇴근을 함께 보여 주고, 새 계약서의 금액도
   * 배치의 **현재 금액**으로 미리 계산한다. (서버가 하는 계산과 같아진다)
   * 계약서 관리 화면처럼 행사를 들고 있지 않은 곳에서는 비워 둔다.
   */
  event?: EventDetail;
  onClose: () => void;
}

/**
 * 중도 종료 · 계약서 재작성.
 *
 * 3일로 계약한 사람이 하루 만에 그만두는 일은 드물지 않다.
 * 예전에는 이걸 세 화면에서 따로 처리했다.
 * 배치를 지우고, 계약서를 새로 써서 다시 받고, 정산 금액을 손으로 깎았다.
 * 하나만 빠뜨려도 **계약서에는 3일치, 통장에는 1일치**가 되어 분쟁이 된다.
 *
 * 그래서 "실제로 나온 날이 어디까지인가" 하나만 고르게 하고
 * 나머지(배치 취소 · 계약서 재작성 · 정산 재계산)는 시스템이 한 번에 처리한다.
 *
 * 옛 계약서는 지우지 않는다. 왜 금액이 달라졌는지를 설명할 근거이므로
 * '재작성됨' 상태로 남기고 새 차수를 그 위에 얹는다.
 */
const ContractAmendModal = ({
  contract,
  event,
  onClose,
}: ContractAmendModalProps) => {
  const roleLabel = useJobRoleLabel();
  const { amendMutation } = useContractMutation();

  // 열기 전에는 계약서의 근무일 전체가 기준이고, 손대기 시작하면 draft가 화면을 담당한다.
  const [draftDates, setDraftDates] = useState<string[] | null>(null);
  const [reason, setReason] = useState("");
  /**
   * 재작성 사유 구분.
   *
   * 기본을 중도 종료로 두지 않는다. 재작성이 필요한 상황은 시급 인상 ·
   * 중식 제공 추가처럼 근무일이 그대로인 경우가 오히려 더 흔한데,
   * 기본값이 중도 종료면 담당자는 "여긴 하차용 화면"이라 읽고 되돌아 나간다.
   */
  const [reasonType, setReasonType] = useState<AmendReasonType>("WAGE_CHANGE");
  /** 금액에도 근무일에도 잡히지 않는 변경 내용. (중식 제공 등) */
  const [note, setNote] = useState("");
  const [cancelsRemovedAssignments, setCancelsRemovedAssignments] =
    useState(true);

  /**
   * 이 계약서가 덮는 배치들. 근태 · 현재 금액의 출처다.
   * 직무까지 맞춘다. 같은 사람이 날마다 다른 직무를 맡는 일이 있다.
   */
  const assignmentByDate = new Map(
    (event?.assignments ?? [])
      .filter(
        (assignment) =>
          contract !== null &&
          assignment.staffId === contract.staffId &&
          assignment.role === contract.role,
      )
      .map((assignment) => [assignment.workDate, assignment]),
  );

  /**
   * 근무일별 현재 지급 조건.
   *
   * 배치가 있으면 배치 값을 쓴다. 중도 종료를 처리하기 전에 시급을 고쳐 두는
   * 일이 흔한데, 계약서에 적힌 옛 금액으로 미리보기를 그리면
   * 저장 직후 화면의 금액이 달라져 담당자가 계산을 못 믿게 된다.
   */
  const currentWorkDays: ContractWorkDay[] = (contract?.workDays ?? []).map(
    (day) => {
      const assignment = assignmentByDate.get(day.workDate);

      return assignment
        ? {
            workDate: day.workDate,
            wageType: assignment.wageType,
            wage: assignment.wage,
          }
        : day;
    },
  );

  /** 계약서 작성 이후 적용 금액이 바뀐 날. 새 계약서에는 바뀐 금액이 들어간다. */
  const changedWageDates = (contract?.workDays ?? []).filter((day) => {
    const current = currentWorkDays.find(
      (target) => target.workDate === day.workDate,
    );

    return (
      current &&
      (current.wageType !== day.wageType || current.wage !== day.wage)
    );
  });

  /*
    기본 선택은 데이터가 정한다.
    노쇼 · 결근으로 이미 기록된 날은 나오지 않은 날이므로 처음부터 빼 둔다.
    (그 외에는 전부 남긴다. 시스템이 마음대로 근무일을 지우면 안 된다)
  */
  const defaultDates = (contract?.workDates ?? []).filter((date) => {
    const attendance = assignmentByDate.get(date)?.attendance;

    return attendance !== "NO_SHOW" && attendance !== "ABSENT";
  });

  const keptDates = draftDates ?? defaultDates;
  const removedDates = (contract?.workDates ?? []).filter(
    (date) => !keptDates.includes(date),
  );

  const dailyWorkHours = contract?.workHours ?? 0;
  const nextWork = summarizeContractWork(
    currentWorkDays.filter((day) => keptDates.includes(day.workDate)),
    dailyWorkHours,
  );
  const difference = nextWork.totalWage - (contract?.totalWage ?? 0);

  const handleClose = () => {
    setDraftDates(null);
    setReason("");
    setReasonType("WAGE_CHANGE");
    setNote("");
    setCancelsRemovedAssignments(true);
    onClose();
  };

  const handleToggleDate = (date: string) =>
    setDraftDates(
      keptDates.includes(date)
        ? keptDates.filter((target) => target !== date)
        : [...keptDates, date].sort(),
    );

  /** "이 날까지만 나왔다" — 중도 종료의 실제 모양이라 한 번에 고를 수 있어야 한다. */
  const handleKeepUntil = (date: string) =>
    setDraftDates(
      (contract?.workDates ?? []).filter((target) => target <= date),
    );

  /*
    재작성할 거리가 있는가.

    예전에는 "근무일이 줄었는가"만 물었다. 그래서 시급이 올라 문서를 다시 내야 할 때
    버튼이 끝까지 꺼져 있었고, 담당자는 멀쩡한 근무일 하나를 빼서 저장한 뒤
    다시 넣는 식으로 우회해야 했다. 그 과정에서 배치가 취소되고 정산이 틀어졌다.

    이제는 **무엇이든 달라졌으면** 낼 수 있다.
    (근무일 축소 · 금액 변경 · 남길 변경 내용)
  */
  const hasChange =
    removedDates.length > 0 ||
    changedWageDates.length > 0 ||
    note.trim().length > 0;

  const canSubmit =
    contract !== null &&
    keptDates.length > 0 &&
    hasChange &&
    reason.trim().length > 0;

  const handleSubmit = () => {
    if (!contract || !canSubmit) return;

    amendMutation.mutate(
      {
        contractId: contract.contractId,
        workDates: keptDates,
        reason: reason.trim(),
        cancelsRemovedAssignments,
        reasonType,
        note: note.trim() || undefined,
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Modal
      isOpen={Boolean(contract)}
      onClose={handleClose}
      title="계약서 재작성"
      description={
        contract
          ? `${contract.contractNumber} · ${contract.staffName} · ${roleLabel(contract.role)}`
          : undefined
      }
      size="lg"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            isLoading={amendMutation.isPending}
          >
            {contract ? `${contract.revision + 1}차 계약서 만들기` : "재작성"}
          </Button>
        </>
      }
    >
      {contract && (
        <div className="flex flex-col gap-4">
          {/*
            경고 문구를 상황에 맞춘다.
            근무일을 그대로 두는 재작성(시급 인상 등)에서 "배치가 취소된다"고 적으면
            겁이 나서 저장을 못 누른다. 실제로 일어나는 일만 적는다.
          */}
          <Alert tone="warning" title="이 처리가 바꾸는 것">
            지금 계약서는 <b>재작성됨</b>으로 내려가고,{" "}
            {contract.revision + 1}차 계약서가 새로 만들어집니다.{" "}
            <b>서명은 처음부터 다시</b> 받아야 하며, 금액은 배치의 현재 지급
            조건으로 다시 계산됩니다.
            {removedDates.length > 0 && (
              <>
                {" "}
                계약에서 뺀 {removedDates.length}일은 지급 대상에서도
                제외됩니다.
              </>
            )}
          </Alert>

          {/*
            근무일을 하나씩 고르게 한다.
            "며칠에 그만뒀는가"만 받으면 중간에 하루 빠지고 다시 나온 경우를
            표현할 수 없는데, 그런 일이 실제로 있다.
          */}
          <FormField
            label="계약에 담을 근무일"
            hint="그대로 두면 근무일은 바뀌지 않습니다. 체크를 푼 날만 계약과 지급에서 빠집니다."
            required
          >
            <ul className="flex flex-col gap-1">
              {contract.workDates.map((date) => {
                const isKept = keptDates.includes(date);
                const assignment = assignmentByDate.get(date);
                const workDay = currentWorkDays.find(
                  (day) => day.workDate === date,
                );

                return (
                  <li
                    key={date}
                    className={cn(
                      "flex items-center gap-3 rounded-field border px-3 py-2.5 transition",
                      isKept
                        ? "border-border-main"
                        : "border-dashed border-border-main bg-subtle",
                    )}
                  >
                    <Checkbox
                      aria-label={`${formatDate(date)} 근로 제공`}
                      checked={isKept}
                      onChange={() => handleToggleDate(date)}
                    />

                    <span
                      className={cn(
                        "w-32 shrink-0 text-[13px] tabular-nums",
                        isKept
                          ? "text-font-1"
                          : "text-font-disabled line-through",
                      )}
                    >
                      {formatDate(date)}
                    </span>

                    {assignment && (
                      <>
                        <Badge
                          tone={ATTENDANCE_STATUS_TONE[assignment.attendance]}
                        >
                          {ATTENDANCE_STATUS_LABEL[assignment.attendance]}
                        </Badge>

                        <span className="text-[12px] text-font-2 tabular-nums">
                          {assignment.checkInAt && assignment.checkOutAt
                            ? `${toTimeInput(assignment.checkInAt)}~${toTimeInput(assignment.checkOutAt)}`
                            : "출퇴근 미기록"}
                        </span>
                      </>
                    )}

                    {workDay && (
                      <span
                        className={cn(
                          "ml-auto text-[13px] tabular-nums",
                          isKept ? "text-font-1" : "text-font-disabled",
                        )}
                      >
                        {WAGE_TYPE_LABEL[workDay.wageType]}{" "}
                        {formatCurrency(workDay.wage)}
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className={workDay ? undefined : "ml-auto"}
                      onClick={() => handleKeepUntil(date)}
                      title="이 날까지만 나온 것으로 처리합니다."
                    >
                      이 날까지
                    </Button>
                  </li>
                );
              })}
            </ul>
          </FormField>

          {/*
            계약서를 만든 뒤 시급을 고친 건이 있으면 알려 준다.
            새 차수는 배치의 현재 금액으로 만들어지므로, 모르고 넘어가면
            "왜 총액이 예상과 다르지"가 된다.
          */}
          {changedWageDates.length > 0 && (
            <Alert tone="info" title="계약서 작성 이후 적용 금액이 바뀐 날이 있습니다.">
              {changedWageDates
                .map((day) => formatDate(day.workDate))
                .join(", ")}
              {" · "}새 계약서에는 <b>현재 적용 금액</b>이 들어갑니다.
            </Alert>
          )}

          {/* 금액이 얼마나 달라지는지가 이 화면의 결론이다. */}
          <div className="flex items-center gap-3 rounded-field border border-border-main bg-subtle px-4 py-3 text-[13px]">
            <span className="text-font-2">
              당초 {contract.workDates.length}일
            </span>
            <span className="text-font-1 tabular-nums">
              {formatCurrency(contract.totalWage)}
            </span>
            <span className="text-font-disabled">→</span>
            <span className="text-font-2">{keptDates.length}일</span>
            <span className="font-semibold text-font-0 tabular-nums">
              {formatCurrency(nextWork.totalWage)}
            </span>

            {difference !== 0 && (
              <Badge tone={difference < 0 ? "danger" : "info"}>
                {difference < 0 ? "▼" : "▲"}{" "}
                {formatCurrency(Math.abs(difference))}
              </Badge>
            )}

            {removedDates.length > 0 && (
              <span className="ml-auto text-[12px] text-font-2 tabular-nums">
                제외 {removedDates.length}일 ·{" "}
                {removedDates.map((date) => date.slice(5)).join(", ")}
              </span>
            )}
          </div>

          {/*
            무엇 때문에 다시 쓰는지를 먼저 고르게 한다.
            사유 문장만 받으면 나중에 차수가 여럿인 문서를 놓고
            "이건 하차인가 시급 조정인가"를 문장에서 읽어 내야 한다.
          */}
          <FormField
            label="재작성 구분"
            hint="이력에 남아 나중에 사유별로 모아 볼 수 있습니다."
          >
            <Select
              aria-label="재작성 구분"
              options={REASON_TYPE_OPTIONS}
              value={reasonType}
              onChange={(changeEvent) => {
                setReasonType(changeEvent.target.value as AmendReasonType);
                // 구분을 바꾸면 이전 구분의 예시 문장이 남아 있으면 안 된다.
                setReason("");
              }}
            />
          </FormField>

          <FormField
            label="계약서에 남길 변경 내용"
            hint="중식 제공처럼 금액에도 근무일에도 잡히지 않는 조건을 적습니다."
          >
            <Textarea
              rows={2}
              value={note}
              onChange={(changeEvent) => setNote(changeEvent.target.value)}
              placeholder="예) 2일차부터 중식 제공 / 집합 장소 정문 → 후문 변경"
            />
          </FormField>

          <FormField
            label="재작성 사유"
            hint="계약서 본문과 이력에 그대로 남습니다. 나중에 금액을 설명할 근거입니다."
            required
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {AMEND_REASON_PRESETS[reasonType].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className={cn(
                      "rounded-field border px-2.5 py-1 text-[12px] transition hover:border-brand active:scale-[0.98]",
                      reason === preset
                        ? "border-brand bg-brand-opacity-3 text-brand"
                        : "border-border-main text-font-2",
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <Textarea
                rows={3}
                value={reason}
                hasError={reason.trim().length === 0}
                onChange={(changeEvent) => setReason(changeEvent.target.value)}
                placeholder="예) 2일차 오전 본인 사정으로 중도 하차, 잔여 근무일 근로 미제공"
              />
            </div>
          </FormField>

          <div className="flex flex-col gap-2 rounded-field border border-border-main px-4 py-3">
            <Checkbox
              label={`계약에서 빠진 ${removedDates.length}일의 배치도 함께 취소`}
              checked={cancelsRemovedAssignments}
              onChange={(changeEvent) =>
                setCancelsRemovedAssignments(changeEvent.target.checked)
              }
            />
            <p className="pl-6 text-[12px] text-font-2">
              끄면 계약서만 다시 만들어지고 배치는 그대로 남습니다. 그날 대타를
              따로 넣을 예정이 아니라면 켜 두세요. 배치가 남아 있으면 그 날짜가
              계속 미충원이 아닌 것으로 잡힙니다.
            </p>
          </div>

          {keptDates.length === 0 && (
            <Alert tone="danger" title="근무일을 하나도 남기지 않았습니다.">
              하루도 나오지 않았다면 재작성이 아니라 <b>계약 해지</b>입니다.
              일별 근무자 탭에서 배치를 해제하고 계약서를 삭제해 주세요.
            </Alert>
          )}

          {removedDates.length === 0 && (
            <p className="flex items-center gap-1.5 text-[12px] text-font-2">
              <Warning size={14} />
              당초 계약과 근무일이 같습니다. 빠진 날이 있어야 재작성할 수
              있습니다.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ContractAmendModal;
