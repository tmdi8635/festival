"use client";

import { useState } from "react";
import { useEventDetailQuery } from "@/api/event/getEventDetail";
import { useMessageTemplateListQuery } from "@/api/message/getMessageTemplateList";
import { useMessageMutation } from "@/api/message/mutateMessage";
import { useHasPermission } from "@/store/useAdminStore";
import {
  MESSAGE_CHANNEL_OPTIONS,
  MESSAGE_PURPOSE_OPTIONS,
} from "@/constants/messageOptions";
import { Calendar, Close, Info, Phone, Plus, Send, Star } from "@/icons";
import { formatKoreanDate } from "@/lib/dayjs";
import { cn, formatCurrency } from "@/lib/utils";
import {
  MESSAGE_VARIABLES,
  MESSAGE_VARIABLE_SAMPLE,
  SMS_BYTE_LIMIT,
  calculateMessageBytes,
  renderMessagePreview,
  type MessageChannel,
  type MessagePurpose,
} from "@/type/message";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  WAGE_TYPE_LABEL,
  byMainSupervisorFirst,
  formatTimeRange,
  type Assignment,
  type EventDetail,
  type EventSummary,
} from "@/type/event";
import { formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import EventPickerModal from "@/components/domain/EventPickerModal";
import FeatureNotice from "@/components/domain/FeatureNotice";

interface MessageComposerProps {
  /**
   * 행사가 이미 정해진 자리(행사 상세 탭)에서 넘긴다.
   *
   * 그때는 행사를 고르는 칸을 감춘다. 이미 그 행사를 보고 있는데 다시 고르게 하면
   * 다른 행사를 고를 수 있다는 뜻이 되고, 그 사고는 되돌릴 수 없다.
   */
  fixedEvent?: EventDetail;
}

/** '-'를 빼고 숫자만 남긴다. */
const toDigits = (value: string) => value.replace(/\D/g, "");

const isValidPhone = (value: string) => /^01[016789][0-9]{7,8}$/.test(value);

/**
 * 문자 발송.
 *
 * 실제 전송은 알리고 · 쿨에스엠에스 같은 외부 API를 붙여야 한다.
 * 지금은 대상 선정 · 문구 작성 · 이력 적재까지를 시스템에서 끝내고,
 * 전송 구간만 나중에 갈아 끼운다. 화면 코드는 그대로 쓴다.
 *
 * ## 두 자리에서 같은 것을 쓴다
 *
 * 메뉴의 문자 발송은 **행사를 골라서** 보내는 자리이고,
 * 행사 상세의 탭은 **지금 보고 있는 행사에** 바로 보내는 자리다.
 * 하는 일이 같으므로 화면도 하나다. 둘로 나누면 한쪽에만 변수가 추가되는 식으로
 * 조용히 갈라진다.
 */
const MessageComposer = ({ fixedEvent }: MessageComposerProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const [pickedEvent, setPickedEvent] = useState<EventSummary | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [templateId, setTemplateId] = useState("0");
  const [channel, setChannel] = useState<MessageChannel>("LMS");
  const [purpose, setPurpose] = useState<MessagePurpose>("CONFIRM");
  const [content, setContent] = useState("");
  /** 직접 입력한 번호. 인력으로 등록되지 않은 사람에게도 보내야 한다. */
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [phoneDraft, setPhoneDraft] = useState("");
  /**
   * 수신 대상 선택.
   *
   * 행사를 바꾸면 그 행사의 확정 인원 전체가 기본 선택이어야 한다.
   * 선택 상태에 행사 ID를 함께 담아 두면 effect 없이도 행사 전환을 감지할 수 있다.
   */
  const [selection, setSelection] = useState<{
    eventId: number;
    staffIds: number[];
  } | null>(null);

  const { data: fetchedEvent } = useEventDetailQuery(
    fixedEvent ? null : (pickedEvent?.eventId ?? null),
  );
  const event = fixedEvent ?? fetchedEvent;

  const { data: templateData } = useMessageTemplateListQuery();
  /*
    문구를 짜 보는 것까지는 누구나 할 수 있게 두고, 실제로 내보내는 버튼만 막는다.
    나간 문자는 회수할 수 없고 받는 쪽은 회사 이름으로 읽는다.
  */
  const canSend = useHasPermission("message:send");

  const { sendMutation } = useMessageMutation();

  const templates = (templateData?.items ?? []).filter(
    (template) => template.isActive,
  );

  /* 같은 사람이 여러 날 나와도 문자는 한 통이다. 사람 단위로 접는다. */
  const confirmedAssignments = [
    ...new Map(
      (event?.assignments ?? [])
        .filter((assignment) => assignment.status === "CONFIRMED")
        .map((assignment) => [assignment.staffId, assignment]),
    ).values(),
  ].sort(
    (a, b) =>
      byMainSupervisorFirst(event?.mainSupervisorStaffId)(a, b) ||
      a.staffName.localeCompare(b.staffName),
  );

  const selectedIds =
    selection && selection.eventId === event?.eventId
      ? selection.staffIds
      : confirmedAssignments.map((assignment) => assignment.staffId);

  const applySelection = (staffIds: number[]) =>
    setSelection({ eventId: event?.eventId ?? 0, staffIds });

  const handleSelectTemplate = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);

    const template = templates.find(
      (item) => String(item.templateId) === nextTemplateId,
    );

    if (!template) return;

    setContent(template.content);
    setChannel(template.channel);
    setPurpose(template.purpose);
  };

  const bytes = calculateMessageBytes(content);
  const isOverSmsLimit = channel === "SMS" && bytes > SMS_BYTE_LIMIT;

  /** 미리보기 기준이 되는 수신자. 아직 안 골랐으면 예시 값으로 채운다. */
  const previewTarget = confirmedAssignments.find((assignment) =>
    selectedIds.includes(assignment.staffId),
  );

  const buildValues = (assignment?: Assignment): Record<string, string> =>
    event && assignment
      ? {
          이름: assignment.staffName,
          행사명: event.title,
          근무일: formatKoreanDate(assignment.workDate),
          근무시간: formatTimeRange(
            event.startTime,
            event.endTime,
            event.endDayOffset,
          ),
          집합장소: event.meetingPoint,
          복장: event.dressCode,
          준비물: event.belongings,
          직무: jobRoleLabel(assignment.role),
          시급: `${WAGE_TYPE_LABEL[assignment.wageType]} ${formatCurrency(assignment.wage)}`,
          담당자: event.managerName,
          담당자연락처: formatPhoneNumber(event.managerPhone),
          /*
            메인팀장이 아직 없으면 '미지정'이라고 적는다.
            토큰을 그대로 두면 받는 사람이 `{{메인팀장}}`이라고 적힌 문자를 받는다.
          */
          메인팀장: event.mainSupervisorName ?? "미지정",
          메인팀장연락처: event.mainSupervisorPhone
            ? formatPhoneNumber(event.mainSupervisorPhone)
            : "미지정",
        }
      : MESSAGE_VARIABLE_SAMPLE;

  const previewValues = buildValues(previewTarget);
  const preview = renderMessagePreview(content, previewValues);

  /**
   * 변수 옆에 적는 값.
   *
   * 행사를 고른 뒤에는 **그 행사의 실제 값**을 보여 준다. 예시로만 두면
   * `{{담당자연락처}} → 010-2345-0917`처럼 이 행사와 아무 상관 없는 번호가 적혀,
   * 담당자는 그것을 보고도 자기 문자에 무엇이 들어갈지 알 수 없다.
   * 아직 안 골랐을 때만 예시로 형태를 알린다.
   */
  const valueOf = (token: string) =>
    previewValues[token.replace(/[{}]/g, "")] ?? "";

  const handleToggle = (staffId: number) => {
    applySelection(
      selectedIds.includes(staffId)
        ? selectedIds.filter((id) => id !== staffId)
        : [...selectedIds, staffId],
    );
  };

  /** 직접 친 번호를 더한다. 쉼표 · 줄바꿈으로 여러 개를 한 번에 붙여 넣을 수 있다. */
  const addPhoneNumbers = () => {
    const parsed = phoneDraft
      .split(/[\s,;]+/)
      .map(toDigits)
      .filter(Boolean);

    const valid = parsed.filter(isValidPhone);
    const invalid = parsed.filter((value) => !isValidPhone(value));

    setPhoneNumbers((prev) => [...new Set([...prev, ...valid])]);
    /* 잘못된 번호만 칸에 남긴다. 통째로 지우면 어디가 틀렸는지 알 수 없다. */
    setPhoneDraft(invalid.join(", "));
  };

  const totalCount = selectedIds.length + phoneNumbers.length;

  const handleSend = () => {
    sendMutation.mutate(
      {
        channel,
        purpose,
        templateId: templateId === "0" ? undefined : Number(templateId),
        eventId: event?.eventId,
        content,
        staffIds: selectedIds,
        phoneNumbers,
      },
      {
        onSuccess: () => {
          setContent("");
          setPhoneNumbers([]);
        },
      },
    );
  };

  const templateOptions = [
    { label: "템플릿 없이 직접 작성", value: "0" },
    ...templates.map((template) => ({
      label: template.name,
      value: String(template.templateId),
    })),
  ];

  return (
    <>
      <FeatureNotice
        feature="MESSAGE"
        fallback="아래에서 문구를 만들어 복사한 뒤, 기존에 쓰던 방식(단체 문자 · 오픈카톡방)으로 보내 주세요."
      />

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <Card
          title="수신 대상"
          description={
            fixedEvent
              ? "이 행사의 확정 인원입니다."
              : "행사 확정 인원 중에서 고릅니다."
          }
          className="col-span-2"
          noPadding
        >
          {/*
            행사명이 서로 비슷해서 드롭다운으로는 어느 건인지 알 수 없었다.
            날짜 · 장소 · 충원 현황이 함께 보이는 목록에서 고른다.
            (행사 상세에서 열었으면 고를 이유가 없으므로 이 칸은 아예 없다)
          */}
          {!fixedEvent && (
            <div className="border-b border-border-main px-5 py-3.5">
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="flex h-10 w-full items-center gap-2 rounded-field border border-border-main bg-surface px-3 text-left text-[14px] transition hover:border-brand"
              >
                <Calendar size={15} className="shrink-0 text-font-2" />
                {pickedEvent ? (
                  <span className="min-w-0 flex-1 truncate text-font-1">
                    {pickedEvent.title}
                  </span>
                ) : (
                  <span className="flex-1 text-font-disabled">
                    행사를 선택하세요
                  </span>
                )}
                <span className="shrink-0 text-[13px] text-brand">
                  {pickedEvent ? "변경" : "선택"}
                </span>
              </button>
            </div>
          )}

          {confirmedAssignments.length === 0 ? (
            <EmptyState
              title="확정된 인력이 없습니다."
              description={
                fixedEvent
                  ? "배치를 확정하면 여기에 수신 대상이 나타납니다. 아래에 번호를 직접 적어 보낼 수도 있습니다."
                  : "행사를 고르면 확정 인원이 여기에 나타납니다."
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border-main px-5 py-2.5">
                <Checkbox
                  label="전체 선택"
                  checked={
                    selectedIds.length === confirmedAssignments.length &&
                    confirmedAssignments.length > 0
                  }
                  onChange={(changeEvent) =>
                    applySelection(
                      changeEvent.target.checked
                        ? confirmedAssignments.map(
                            (assignment) => assignment.staffId,
                          )
                        : [],
                    )
                  }
                />
                <span className="text-[13px] text-font-2 tabular-nums">
                  {selectedIds.length} / {confirmedAssignments.length}명
                </span>
              </div>

              <ul className="max-h-80 divide-y divide-border-main overflow-y-auto scrollbar-thin">
                {confirmedAssignments.map((assignment) => (
                  <li key={assignment.staffId}>
                    <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 transition hover:bg-surface-hover">
                      <Checkbox
                        checked={selectedIds.includes(assignment.staffId)}
                        onChange={() => handleToggle(assignment.staffId)}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-[14px] text-font-1">
                          {assignment.staffId ===
                            event?.mainSupervisorStaffId && (
                            <Star size={11} className="shrink-0 text-brand" />
                          )}
                          {assignment.staffName}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-font-2 tabular-nums">
                          {formatPhoneNumber(assignment.staffPhone)}
                        </p>
                      </div>

                      <Badge tone="neutral">
                        {jobRoleLabel(assignment.role)}
                      </Badge>

                      {!assignment.isContractSigned && (
                        <Badge tone="danger">계약 미완</Badge>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/*
            직접 입력한 번호.

            아직 인력으로 등록되지 않은 지원자, 거래처 담당자, 현장에서 급히 부른
            사람에게 보내야 하는 일이 실제로 있다. 그때마다 인력을 먼저 등록하게 하면
            담당자는 결국 시스템 밖에서 문자를 보내고, 그러면 이력이 남지 않는다.
          */}
          <div className="flex flex-col gap-2 border-t border-border-main px-5 py-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-font-1">
              <Phone size={13} className="text-font-2" />
              번호 직접 입력
            </p>

            <div className="flex items-center gap-2">
              <Input
                value={phoneDraft}
                onChange={(changeEvent) => setPhoneDraft(changeEvent.target.value)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key !== "Enter") return;

                  /* 창의 확인 동작으로 새어 나가면 문자가 그대로 나간다. */
                  keyEvent.preventDefault();
                  keyEvent.stopPropagation();
                  addPhoneNumbers();
                }}
                placeholder="01012345678 (쉼표로 여러 개)"
                inputBoxClassName="flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Plus size={14} />}
                onClick={addPhoneNumbers}
                disabled={!phoneDraft.trim()}
              >
                추가
              </Button>
            </div>

            {phoneDraft.trim() && toDigits(phoneDraft) && (
              <p className="text-[12px] text-font-error">
                {isValidPhone(toDigits(phoneDraft))
                  ? "'추가'를 눌러 수신 대상에 넣어 주세요."
                  : "휴대폰번호 형식이 아닙니다. (01012345678)"}
              </p>
            )}

            {phoneNumbers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {phoneNumbers.map((phone) => (
                  <span
                    key={phone}
                    className="flex items-center gap-1 rounded-field border border-border-main bg-subtle py-1 pr-1 pl-2.5 text-[12px] text-font-1 tabular-nums"
                  >
                    {formatPhoneNumber(phone)}
                    <button
                      type="button"
                      aria-label={`${phone} 제외`}
                      onClick={() =>
                        setPhoneNumbers((prev) =>
                          prev.filter((item) => item !== phone),
                        )
                      }
                      className="rounded-full p-0.5 text-font-2 transition hover:bg-surface-hover hover:text-font-1"
                    >
                      <Close size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/*
              직접 친 번호에는 이름 · 직무가 없다.
              `{{이름}}`이 든 문구를 그대로 보내면 빈칸이 박힌 문자가 나간다.
            */}
            {phoneNumbers.length > 0 && content.includes("{{") && (
              <p className="text-[12px] text-font-2">
                직접 입력한 번호에는 변수를 채울 정보가 없어 <b>토큰이 그대로</b>{" "}
                나갑니다. 변수 없는 문구로 따로 보내 주세요.
              </p>
            )}
          </div>
        </Card>

        <Card title="내용 작성" className="col-span-3">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="템플릿">
                <Select
                  options={templateOptions}
                  value={templateId}
                  onChange={(changeEvent) =>
                    handleSelectTemplate(changeEvent.target.value)
                  }
                />
              </FormField>

              <FormField label="발송 수단">
                <Select
                  options={MESSAGE_CHANNEL_OPTIONS}
                  value={channel}
                  onChange={(changeEvent) =>
                    setChannel(changeEvent.target.value as MessageChannel)
                  }
                />
              </FormField>

              <FormField label="용도">
                <Select
                  options={MESSAGE_PURPOSE_OPTIONS}
                  value={purpose}
                  onChange={(changeEvent) =>
                    setPurpose(changeEvent.target.value as MessagePurpose)
                  }
                />
              </FormField>
            </div>

            <FormField
              label="내용"
              required
              hint={`${bytes}바이트${channel === "SMS" ? ` / ${SMS_BYTE_LIMIT}` : ""}`}
              error={
                isOverSmsLimit
                  ? "단문(SMS) 기준을 넘었습니다. 장문(LMS)으로 바꿔 주세요."
                  : undefined
              }
            >
              <Textarea
                value={content}
                onChange={(changeEvent) => setContent(changeEvent.target.value)}
                rows={9}
                placeholder="템플릿을 고르거나 직접 작성하세요."
                hasError={isOverSmsLimit}
              />
            </FormField>

            {/*
              변수 안내.

              토큰만 늘어놓으면 `{{시급}}`이 `12000`으로 들어가는지
              `시급 12,000원`으로 들어가는지 알 수 없다. 담당자는 결국 자기에게
              한 번 보내 보고 확인한다. 어떤 모양으로 박히는지를 옆에 적어 둔다.
            */}
            <div className="flex flex-col gap-2 rounded-field border border-border-main bg-subtle px-4 py-3">
              <span className="flex flex-wrap items-center gap-1 text-[12px] font-medium text-font-1">
                <Info size={13} />
                사용 가능한 변수 · 누르면 본문에 들어갑니다
                <span className="font-normal text-font-2">
                  {previewTarget
                    ? `(${previewTarget.staffName}님 기준 실제 값)`
                    : "(대상을 고르기 전이라 예시 값)"}
                </span>
              </span>

              <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                {MESSAGE_VARIABLES.map((variable) => (
                  <button
                    key={variable.token}
                    type="button"
                    title={variable.description}
                    onClick={() => setContent((prev) => prev + variable.token)}
                    className="flex items-baseline gap-1.5 rounded-[5px] px-1 py-0.5 text-left transition hover:bg-surface"
                  >
                    <span className="shrink-0 text-[12px] text-brand">
                      {variable.token}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-font-2">
                      → {valueOf(variable.token) || variable.example}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/*
              미리보기.

              대상이 없다고 비워 두면, 문구를 다 쓰고 대상을 고른 **뒤에야**
              문장이 어색한 것을 알게 된다. 그때는 이미 보낼 준비가 끝난 뒤다.
              그래서 대상이 없으면 예시 값으로라도 채운다.
            */}
            <div className="flex flex-col gap-1.5">
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-font-1">
                미리보기
                <span className="text-[12px] font-normal text-font-2">
                  {previewTarget
                    ? `${previewTarget.staffName}님이 받는 문자입니다.`
                    : "수신 대상을 고르기 전이라 예시 값으로 채웠습니다."}
                </span>
              </p>
              <pre
                className={cn(
                  "max-h-56 overflow-y-auto rounded-field border px-4 py-3 text-[13px] whitespace-pre-wrap scrollbar-thin",
                  content.trim()
                    ? "border-border-main bg-subtle text-font-1"
                    : "border-dashed border-border-strong text-font-disabled",
                )}
              >
                {content.trim() ? preview : "내용을 입력하면 여기에 보입니다."}
              </pre>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="text-[13px] text-font-2 tabular-nums">
                {canSend
                  ? `수신 ${totalCount}명${
                      phoneNumbers.length > 0
                        ? ` (직접 입력 ${phoneNumbers.length})`
                        : ""
                    }`
                  : "발송하려면 '공지 · 발송 > 발송' 권한이 필요합니다."}
              </span>
              {canSend && (
                <Button
                  variant="primary"
                  leftIcon={<Send size={15} />}
                  onClick={handleSend}
                  disabled={
                    totalCount === 0 ||
                    content.trim().length === 0 ||
                    isOverSmsLimit
                  }
                  isLoading={sendMutation.isPending}
                >
                  발송
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {!fixedEvent && (
        <EventPickerModal
          isOpen={isPickerOpen}
          selectedEventId={pickedEvent?.eventId}
          description="안내 문자를 보낼 행사를 고르세요. 확정 인원이 수신 대상이 됩니다."
          onSelect={setPickedEvent}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </>
  );
};

export default MessageComposer;
