"use client";

import { useState } from "react";
import { useEventDetailQuery } from "@/api/event/getEventDetail";
import { useMessageTemplateListQuery } from "@/api/message/getMessageTemplateList";
import { useMessageMutation } from "@/api/message/mutateMessage";
import {
  MESSAGE_CHANNEL_OPTIONS,
  MESSAGE_PURPOSE_OPTIONS,
} from "@/constants/messageOptions";
import { Calendar, Info, Send } from "@/icons";
import { formatKoreanDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import {
  MESSAGE_VARIABLES,
  SMS_BYTE_LIMIT,
  calculateMessageBytes,
  renderMessagePreview,
  type MessageChannel,
  type MessagePurpose,
} from "@/type/message";
import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  WAGE_TYPE_LABEL,
  formatTimeRange,
  type EventSummary,
} from "@/type/event";
import { formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import EventPickerModal from "@/components/domain/EventPickerModal";
import FeatureNotice from "@/components/domain/FeatureNotice";

/**
 * 문자 발송 화면.
 *
 * 실제 전송은 알리고 · 쿨에스엠에스 같은 외부 API를 붙여야 한다.
 * 지금은 대상 선정 · 문구 작성 · 이력 적재까지를 시스템에서 끝내고,
 * 전송 구간만 나중에 갈아 끼운다. 화면 코드는 그대로 쓴다.
 */
const MessageComposer = () => {
  const jobRoleLabel = useJobRoleLabel();
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(
    null,
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [templateId, setTemplateId] = useState("0");
  const [channel, setChannel] = useState<MessageChannel>("LMS");
  const [purpose, setPurpose] = useState<MessagePurpose>("CONFIRM");
  const [content, setContent] = useState("");
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

  const { data: event } = useEventDetailQuery(
    selectedEvent?.eventId ?? null,
  );
  const { data: templateData } = useMessageTemplateListQuery();
  const { sendMutation } = useMessageMutation();

  const templates = (templateData?.items ?? []).filter(
    (template) => template.isActive,
  );

  const confirmedAssignments =
    event?.assignments.filter(
      (assignment) => assignment.status === "CONFIRMED",
    ) ?? [];

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

  /** 미리보기는 첫 번째 수신자 기준으로 채운다. */
  const previewTarget = confirmedAssignments.find((assignment) =>
    selectedIds.includes(assignment.staffId),
  );
  const preview =
    event && previewTarget
      ? renderMessagePreview(content, {
          이름: previewTarget.staffName,
          행사명: event.title,
          근무일: formatKoreanDate(event.startDate),
          근무시간: formatTimeRange(
            event.startTime,
            event.endTime,
            event.endDayOffset,
          ),
          집합장소: event.meetingPoint,
          복장: event.dressCode,
          준비물: event.belongings,
          직무: jobRoleLabel(previewTarget.role),
          시급: `${WAGE_TYPE_LABEL[previewTarget.wageType]} ${formatCurrency(previewTarget.wage)}`,
          담당자: event.managerName,
        })
      : content;

  const handleToggle = (staffId: number) => {
    applySelection(
      selectedIds.includes(staffId)
        ? selectedIds.filter((id) => id !== staffId)
        : [...selectedIds, staffId],
    );
  };

  const handleSend = () => {
    sendMutation.mutate(
      {
        channel,
        purpose,
        templateId: templateId === "0" ? undefined : Number(templateId),
        eventId: selectedEvent?.eventId,
        content,
        staffIds: selectedIds,
      },
      { onSuccess: () => setContent("") },
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
          description="행사 확정 인원 중에서 고릅니다."
          className="col-span-2"
          noPadding
        >
          {/*
            행사명이 서로 비슷해서 드롭다운으로는 어느 건인지 알 수 없었다.
            날짜 · 장소 · 충원 현황이 함께 보이는 목록에서 고른다.
          */}
          <div className="border-b border-border-main px-5 py-3.5">
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="flex h-10 w-full items-center gap-2 rounded-field border border-border-main bg-surface px-3 text-left text-[14px] transition hover:border-brand"
            >
              <Calendar size={15} className="shrink-0 text-font-2" />
              {selectedEvent ? (
                <span className="min-w-0 flex-1 truncate text-font-1">
                  {selectedEvent.title}
                </span>
              ) : (
                <span className="flex-1 text-font-disabled">
                  행사를 선택하세요
                </span>
              )}
              <span className="shrink-0 text-[13px] text-brand">
                {selectedEvent ? "변경" : "선택"}
              </span>
            </button>
          </div>

          {confirmedAssignments.length === 0 ? (
            <EmptyState
              title="확정된 인력이 없습니다."
              description="행사를 고르면 확정 인원이 여기에 나타납니다."
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

              <ul className="max-h-96 divide-y divide-border-main overflow-y-auto scrollbar-thin">
                {confirmedAssignments.map((assignment) => (
                  <li key={assignment.assignmentId}>
                    <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 transition hover:bg-surface-hover">
                      <Checkbox
                        checked={selectedIds.includes(assignment.staffId)}
                        onChange={() => handleToggle(assignment.staffId)}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] text-font-1">
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
                rows={10}
                placeholder="템플릿을 고르거나 직접 작성하세요."
                hasError={isOverSmsLimit}
              />
            </FormField>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field border border-border-main bg-subtle px-4 py-3">
              <span className="flex items-center gap-1 text-[12px] font-medium text-font-1">
                <Info size={13} />
                사용 가능한 변수
              </span>
              {MESSAGE_VARIABLES.map((variable) => (
                <button
                  key={variable.token}
                  type="button"
                  title={variable.description}
                  onClick={() => setContent((prev) => prev + variable.token)}
                  className="rounded-[5px] bg-surface px-1.5 py-0.5 text-[12px] text-font-2 transition hover:text-brand"
                >
                  {variable.token}
                </button>
              ))}
            </div>

            {previewTarget && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[13px] font-medium text-font-1">
                  미리보기 ({previewTarget.staffName}님 기준)
                </p>
                <pre className="max-h-48 overflow-y-auto rounded-field border border-border-main bg-subtle px-4 py-3 text-[13px] whitespace-pre-wrap text-font-1 scrollbar-thin">
                  {preview}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <span className="text-[13px] text-font-2 tabular-nums">
                수신 {selectedIds.length}명
              </span>
              <Button
                variant="primary"
                leftIcon={<Send size={15} />}
                onClick={handleSend}
                disabled={
                  selectedIds.length === 0 ||
                  content.trim().length === 0 ||
                  isOverSmsLimit
                }
                isLoading={sendMutation.isPending}
              >
                발송
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <EventPickerModal
        isOpen={isPickerOpen}
        selectedEventId={selectedEvent?.eventId}
        description="안내 문자를 보낼 행사를 고르세요. 확정 인원이 수신 대상이 됩니다."
        onSelect={setSelectedEvent}
        onClose={() => setIsPickerOpen(false)}
      />

    </>
  );
};

export default MessageComposer;
