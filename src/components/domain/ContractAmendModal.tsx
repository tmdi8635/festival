"use client";

import { useMemo, useState } from "react";
import { useContractMutation } from "@/api/contract/mutateContract";
import { useEventDetailQuery } from "@/api/event/getEventDetail";
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
   * 이미 들고 있는 화면에서만 넘긴다. 없으면 계약서의 `eventId`로 직접 부른다.
   * 근태 · 실제 출퇴근을 함께 보여 주고, 새 계약서의 금액도 배치의
   * **현재 금액**으로 미리 계산하려면 반드시 있어야 하는 값이다.
   */
  event?: EventDetail;
  onClose: () => void;
}

/**
 * 계약서 재작성.
 *
 * 3일로 계약한 사람이 하루 만에 그만두는 일은 드물지 않다. 그리고 그만큼
 * **이틀 계약한 사람이 사흘째도 나오게 되는 일**도 흔하다.
 * 예전에는 이걸 세 화면에서 따로 처리했다.
 * 배치를 지우고, 계약서를 새로 써서 다시 받고, 정산 금액을 손으로 깎았다.
 * 하나만 빠뜨려도 **계약서에는 3일치, 통장에는 1일치**가 되어 분쟁이 된다.
 *
 * 그래서 "이 사람이 실제로 며칠을 일하는가" 하나만 고르게 하고
 * 나머지(배치 취소 · 배치 추가 · 계약서 재작성 · 정산 재계산)는
 * 시스템이 한 번에 처리한다.
 *
 * 그래서 근무일 목록은 계약서에 적힌 날이 아니라 **행사의 근무일 전체**다.
 * 계약서에 적힌 날만 세워 두면 늘어난 날을 체크할 자리가 아예 없어서,
 * 담당자는 계약서를 지우고 처음부터 다시 쓰게 된다. (그러면 이력이 사라진다)
 *
 * 옛 계약서는 지우지 않는다. 왜 금액이 달라졌는지를 설명할 근거이므로
 * '재작성됨' 상태로 남기고 새 차수를 그 위에 얹는다.
 */
const ContractAmendModal = ({
  contract,
  event: eventProp,
  onClose,
}: ContractAmendModalProps) => {
  const roleLabel = useJobRoleLabel();
  const { amendMutation } = useContractMutation();

  /*
    행사를 넘겨받지 못했으면 직접 부른다.

    호출부 대부분(계약서 관리 · 계약서 상세)은 행사를 들고 있지 않다.
    그래서 예전에는 근태도 금액도 못 그리고 계약서에 적힌 값만 보여 줬는데,
    그러면 "어느 날이 더 일할 수 있는 날인지"를 이 화면에서 알 수 없다.
    (권한이 없으면 응답이 오지 않고, 그때는 계약서의 근무일로만 굴러간다)
  */
  const { data: fetchedEvent } = useEventDetailQuery(
    contract?.eventId ?? null,
  );
  const event = eventProp ?? fetchedEvent;

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
   *
   * 취소된 배치도 담는다. 계약에서 뺐다가 다시 넣는 일이 있는데,
   * 빼 두면 그 날이 "배치가 아예 없던 날"로 보여 새로 만들어야 하는 줄 알게 된다.
   */
  const assignmentByDate = useMemo(
    () =>
      new Map(
        (event?.assignments ?? [])
          .filter(
            (assignment) =>
              contract !== null &&
              assignment.staffId === contract.staffId &&
              assignment.role === contract.role,
          )
          .map((assignment) => [assignment.workDate, assignment]),
      ),
    [event, contract],
  );

  /**
   * 고를 수 있는 근무일 전체.
   *
   * **행사의 근무일이 기준이다.** 계약서에 적힌 날만 세우면 늘어난 날을
   * 체크할 자리가 없고, 배치가 있는 날만 세우면 "배치는 아직 안 넣었지만
   * 계약부터 다시 쓰는" 순서를 막게 된다. 행사 근무일 밖의 날은 담지 않는다 —
   * 행사에 없는 날의 계약은 근거가 없고 정산도 만들어지지 않는다.
   *
   * 예외로 계약서에 이미 적혀 있는 날은 행사 근무일에서 빠졌더라도 남긴다.
   * 그래야 행사 일정이 줄었을 때 그 날을 계약에서 빼는 조작이 가능하다.
   */
  const candidateDates = useMemo(() => {
    const dates = new Set(contract?.workDates ?? []);

    /* 근무일의 원본은 일자별 인원 계획이다. 서버가 배치를 만들 때도 이 배열을 본다. */
    event?.days.forEach((day) => dates.add(day.date));

    return [...dates].sort();
  }, [contract, event]);

  /**
   * 근무일별 현재 지급 조건. **고를 수 있는 날 전부**를 만든다.
   *
   * 순서가 곧 우선순위다.
   * 1) 배치가 있으면 배치 값. 중도 종료를 처리하기 전에 시급을 고쳐 두는 일이
   *    흔한데, 계약서에 적힌 옛 금액으로 미리보기를 그리면 저장 직후 화면의
   *    금액이 달라져 담당자가 계산을 못 믿게 된다.
   * 2) 계약서에 적힌 값. 행사 일정이 줄어 배치가 사라진 날이 여기 걸린다.
   * 3) 그날 그 직무의 발주 조건. 아직 배치를 안 넣은 날의 금액이다.
   *    (서버가 배치를 만들 때 쓰는 값과 같아야 미리보기가 맞는다)
   */
  const currentWorkDays: ContractWorkDay[] = useMemo(
    () =>
      candidateDates.flatMap((date) => {
        const assignment = assignmentByDate.get(date);

        if (assignment) {
          return [
            {
              workDate: date,
              wageType: assignment.wageType,
              wage: assignment.wage,
            },
          ];
        }

        const contracted = contract?.workDays.find(
          (day) => day.workDate === date,
        );

        if (contracted) return [contracted];

        const slot = event?.days
          .find((day) => day.date === date)
          ?.roles.find((item) => item.role === contract?.role);

        return slot
          ? [{ workDate: date, wageType: slot.wageType, wage: slot.wage }]
          : [];
      }),
    [candidateDates, assignmentByDate, contract, event],
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
    기본 선택은 **지금 계약서에 적힌 날 그대로**다.

    행사 근무일을 전부 세워 놓았다고 해서 처음부터 다 켜 두면, 화면을 열자마자
    "며칠이 늘었습니다"가 되어 무엇이 원래 계약이었는지 알 수 없다.
    늘리는 것은 사람이 하는 판단이지 시스템이 미리 해 둘 일이 아니다.

    노쇼 · 결근으로 이미 기록된 날만 예외로 빼 둔다. 나오지 않은 날이라
    그 사실이 데이터에 이미 있다.
  */
  const defaultDates = (contract?.workDates ?? []).filter((date) => {
    const attendance = assignmentByDate.get(date)?.attendance;

    return attendance !== "NO_SHOW" && attendance !== "ABSENT";
  });

  const keptDates = draftDates ?? defaultDates;
  const removedDates = (contract?.workDates ?? []).filter(
    (date) => !keptDates.includes(date),
  );
  /** 당초 계약에 없던 날. 저장하면 배치까지 함께 만들어진다. */
  const addedDates = keptDates.filter(
    (date) => !(contract?.workDates ?? []).includes(date),
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

  /**
   * "이 날까지만 나왔다" — 중도 종료의 실제 모양이라 한 번에 고를 수 있어야 한다.
   *
   * 기준은 **지금 체크된 날**이다. 행사 근무일 전체를 기준으로 자르면
   * 계약에 없던 날까지 한꺼번에 딸려 들어와, 하차를 처리하려다 근무일이 늘어난다.
   */
  const handleKeepUntil = (date: string) =>
    setDraftDates(keptDates.filter((target) => target <= date));

  /*
    재작성할 거리가 있는가.

    예전에는 "근무일이 줄었는가"만 물었다. 그래서 시급이 올라 문서를 다시 내야 할 때
    버튼이 끝까지 꺼져 있었고, 담당자는 멀쩡한 근무일 하나를 빼서 저장한 뒤
    다시 넣는 식으로 우회해야 했다. 그 과정에서 배치가 취소되고 정산이 틀어졌다.

    이제는 **무엇이든 달라졌으면** 낼 수 있다.
    (근무일 축소 · 근무일 추가 · 금액 변경 · 남길 변경 내용)
  */
  const hasChange =
    removedDates.length > 0 ||
    addedDates.length > 0 ||
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
            {addedDates.length > 0 && (
              <>
                {" "}
                계약에 넣은 {addedDates.length}일은 <b>배치도 함께 만들어져</b>{" "}
                지급 대상에 들어갑니다.
              </>
            )}
          </Alert>

          {/*
            근무일을 하나씩 고르게 한다.
            "며칠에 그만뒀는가"만 받으면 중간에 하루 빠지고 다시 나온 경우를
            표현할 수 없는데, 그런 일이 실제로 있다.

            목록은 **행사 근무일 전체**다. 체크된 것이 지금 계약이고,
            체크를 풀면 빠지고 새로 켜면 늘어난다.
          */}
          <FormField
            label="계약에 담을 근무일"
            hint="지금 계약서에 적힌 날이 체크돼 있습니다. 체크를 풀면 계약과 지급에서 빠지고, 새로 켜면 그날 배치까지 함께 만들어집니다."
            required
          >
            <ul className="flex flex-col gap-1">
              {candidateDates.map((date) => {
                const isKept = keptDates.includes(date);
                const assignment = assignmentByDate.get(date);
                const workDay = currentWorkDays.find(
                  (day) => day.workDate === date,
                );
                /** 당초 계약에 없던 날. 켜져 있으면 이번에 늘어나는 날이다. */
                const isOutsideContract = !contract.workDates.includes(date);

                return (
                  <li
                    key={date}
                    className={cn(
                      "flex items-center gap-3 rounded-field border px-3 py-2.5 transition",
                      /*
                        네 가지 상태를 눈으로 구분한다.
                        계약에 있던 날을 끄는 것(=빼는 것)과 계약에 없던 날을
                        그냥 안 켜 둔 것은 전혀 다른 이야기인데, 둘 다 취소선을
                        그으면 "원래 3일이었나 5일이었나"를 알 수 없다.
                      */
                      isKept && isOutsideContract
                        ? "border-brand bg-brand-opacity-3"
                        : isKept
                          ? "border-border-main"
                          : isOutsideContract
                            ? "border-dashed border-border-main"
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
                          : isOutsideContract
                            ? "text-font-disabled"
                            : "text-font-disabled line-through",
                      )}
                    >
                      {formatDate(date)}
                    </span>

                    {isOutsideContract && (
                      <Badge tone={isKept ? "brand" : "neutral"}>
                        {isKept ? "추가" : "계약 밖"}
                      </Badge>
                    )}

                    {assignment ? (
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
                    ) : (
                      /*
                        배치가 없는 날은 그 사실을 적어 준다.
                        계약서만 늘리면 그날 정산 건이 만들어지지 않아,
                        문서에는 있는데 통장에는 없는 날이 생긴다.
                        저장할 때 배치까지 함께 만든다는 것을 미리 밝힌다.
                      */
                      isKept && (
                        <span className="text-[12px] text-font-2">
                          배치 없음 · 저장 시 함께 배치됩니다
                        </span>
                      )
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

                    {/*
                      '이 날까지'는 하차 처리용이다. 체크된 날에만 둔다.
                      꺼져 있는 날에서 누르면 그 뒤가 통째로 빠지는데,
                      그건 이 버튼을 누르는 사람이 기대하는 동작이 아니다.
                    */}
                    {isKept && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={workDay ? undefined : "ml-auto"}
                        onClick={() => handleKeepUntil(date)}
                        title="이 날까지만 나온 것으로 처리합니다."
                      >
                        이 날까지
                      </Button>
                    )}
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

            {/* 무엇이 빠지고 무엇이 늘었는지를 날짜로 적는다. 개수만으로는 검산이 안 된다. */}
            <span className="ml-auto flex flex-col items-end gap-0.5 text-[12px] tabular-nums">
              {removedDates.length > 0 && (
                <span className="text-danger">
                  제외 {removedDates.length}일 ·{" "}
                  {removedDates.map((date) => date.slice(5)).join(", ")}
                </span>
              )}
              {addedDates.length > 0 && (
                <span className="text-brand">
                  추가 {addedDates.length}일 ·{" "}
                  {addedDates.map((date) => date.slice(5)).join(", ")}
                </span>
              )}
            </span>
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

          {/*
            빠진 날이 없으면 물을 것도 없다.
            "빠진 0일의 배치도 함께 취소"는 아무 뜻이 없는 문장이라,
            근무일을 늘리기만 하는 재작성에서 담당자를 멈칫하게 만든다.
          */}
          {removedDates.length > 0 && (
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
          )}

          {keptDates.length === 0 && (
            <Alert tone="danger" title="근무일을 하나도 남기지 않았습니다.">
              하루도 나오지 않았다면 재작성이 아니라 <b>계약 해지</b>입니다.
              일별 근무자 탭에서 배치를 해제하고 계약서를 삭제해 주세요.
            </Alert>
          )}

          {/*
            달라진 것이 하나도 없을 때만 막는다.
            예전에는 "빠진 날이 있어야 한다"고 적어 뒀는데, 이제 근무일을 늘리거나
            금액만 바뀐 재작성도 낼 수 있어 그 문장이 거짓이 됐다.
          */}
          {!hasChange && keptDates.length > 0 && (
            <p className="flex items-center gap-1.5 text-[12px] text-font-2">
              <Warning size={14} />
              당초 계약과 달라진 것이 없습니다. 근무일을 빼거나 더하거나, 계약서에
              남길 변경 내용을 적어 주세요.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ContractAmendModal;
