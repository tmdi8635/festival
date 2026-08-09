"use client";

import { useState } from "react";
import { useContractTemplateListQuery } from "@/api/contract/getContractTemplateList";
import { useContractMutation } from "@/api/contract/mutateContract";
import { Calendar } from "@/icons";
import { formatDateRange } from "@/lib/dayjs";
import { formatTimeRange, describeRecurrence, type EventSummary } from "@/type/event";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import EventPickerModal from "@/components/domain/EventPickerModal";

interface ContractGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 계약서 일괄 생성 모달.
 *
 * 한 명씩 만들어 보내던 일을 행사 단위로 묶는다.
 * 이미 계약서가 있는 배치는 건너뛰므로 여러 번 눌러도 중복이 생기지 않는다.
 */
const ContractGenerateModal = ({
  isOpen,
  onClose,
}: ContractGenerateModalProps) => {
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // 고르기 전에는 기본 템플릿을 그대로 쓰고, 고르면 draft가 화면을 담당한다.
  const [draftTemplateId, setDraftTemplateId] = useState<string | null>(null);

  const { data: templateData } = useContractTemplateListQuery();
  const { generateMutation } = useContractMutation();

  const templates = (templateData?.items ?? []).filter(
    (template) => template.isActive,
  );

  // 기본 템플릿이 있으면 미리 골라 둔다. 대부분의 경우 그대로 쓴다.
  const templateId =
    draftTemplateId ??
    String(
      templates.find((template) => template.isDefault)?.templateId ??
        templates[0]?.templateId ??
        0,
    );

  const handleClose = () => {
    setSelectedEvent(null);
    setDraftTemplateId(null);
    onClose();
  };

  const templateOptions = templates.map((template) => ({
    label: template.isDefault ? `${template.name} (기본)` : template.name,
    value: String(template.templateId),
  }));

  const handleSubmit = () => {
    generateMutation.mutate(
      {
        eventId: selectedEvent?.eventId ?? 0,
        templateId: Number(templateId),
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="계약서 일괄 생성"
      description="선택한 행사의 확정 인원에게 계약서를 한 번에 만듭니다."
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedEvent || templateId === "0"}
            isLoading={generateMutation.isPending}
          >
            생성
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info" title="금액은 사람마다 다르게 채워집니다.">
          등급 가산액이 반영된 적용 시급과 실근무 시간으로 총 지급액이 계산되어
          본문에 들어갑니다.
        </Alert>

        {/*
          행사 이름은 "브랜드 팝업스토어 운영"처럼 비슷비슷해서
          드롭다운에서 이름만 봐서는 어느 건인지 알 수 없었다.
          날짜 · 장소 · 충원 현황을 함께 보여 주는 목록에서 고르게 한다.
        */}
        <FormField label="행사" required>
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
        </FormField>

        <FormField label="계약서 템플릿" required>
          <Select
            options={
              templateOptions.length > 0
                ? templateOptions
                : [{ label: "사용 가능한 템플릿이 없습니다", value: "0" }]
            }
            value={templateId}
            onChange={(event) => setDraftTemplateId(event.target.value)}
          />
        </FormField>

        {selectedEvent && (
          <div className="rounded-field border border-border-main bg-subtle px-4 py-3 text-[13px] text-font-2">
            <p className="font-medium text-font-1">{selectedEvent.title}</p>
            <p className="mt-1 tabular-nums">
              {formatDateRange(selectedEvent.startDate, selectedEvent.endDate)}{" "}
              {formatTimeRange(
                selectedEvent.startTime,
                selectedEvent.endTime,
                selectedEvent.endDayOffset,
              )}{" "}
              · 확정{" "}
              {selectedEvent.totalAssigned}명
            </p>
            <p className="mt-1">
              {describeRecurrence(
                selectedEvent.recurrence,
                selectedEvent.dayCount,
              )}
              {selectedEvent.dayCount > 1 &&
                " · 여러 날 나오는 인력은 근무일을 모두 담은 계약서 한 장이 만들어집니다."}
            </p>
            <p className="mt-1">이미 계약서가 있는 인력은 건너뜁니다.</p>
          </div>
        )}
      </div>
      </Modal>

      <EventPickerModal
        isOpen={isPickerOpen}
        selectedEventId={selectedEvent?.eventId}
        description="계약서를 만들 행사를 고르세요. 확정 배치가 있는 행사만 계약서가 생성됩니다."
        onSelect={setSelectedEvent}
        onClose={() => setIsPickerOpen(false)}
      />
    </>
  );
};

export default ContractGenerateModal;
