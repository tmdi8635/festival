"use client";

import { useState } from "react";
import { useMessageTemplateListQuery } from "@/api/message/getMessageTemplateList";
import { useMessageTemplateMutation } from "@/api/message/mutateMessageTemplate";
import {
  MESSAGE_CHANNEL_TONE,
  MESSAGE_PURPOSE_FILTER_OPTIONS,
} from "@/constants/messageOptions";
import { Edit, Plus, Trash } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { openConfirm } from "@/store/useConfirmStore";
import {
  MESSAGE_CHANNEL_LABEL,
  MESSAGE_PURPOSE_LABEL,
  type MessagePurpose,
  type MessageTemplate,
} from "@/type/message";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import MessageTemplateFormModal from "./MessageTemplateFormModal";

/**
 * 메시지 템플릿 관리.
 *
 * 바쁠 때 공지가 안 나가는 이유는 대부분 "문구를 새로 써야 해서"다.
 * 상황별 문구를 미리 만들어 두면 클릭 몇 번으로 끝난다.
 */
const MessageTemplateManager = () => {
  const [keyword, setKeyword] = useState("");
  const [purpose, setPurpose] = useState<MessagePurpose | "">("");
  const [formTemplate, setFormTemplate] = useState<MessageTemplate | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data, isLoading } = useMessageTemplateListQuery({
    keyword: keyword || undefined,
    purpose: purpose || undefined,
  });
  const { deleteMutation } = useMessageTemplateMutation();

  const templates = data?.items ?? [];

  const handleDelete = (template: MessageTemplate) => {
    openConfirm({
      title: "템플릿을 삭제할까요?",
      description: `'${template.name}' 템플릿을 삭제합니다.`,
      warning: "이미 발송된 이력은 그대로 남습니다.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: () => deleteMutation.mutateAsync(template.templateId),
    });
  };

  return (
    <>
      <Alert tone="info" title="변수는 발송 시점에 채워집니다.">
        <code>{"{{이름}}"}</code>, <code>{"{{집합장소}}"}</code>처럼 적어 두면
        수신자와 행사 정보로 자동 치환됩니다.
      </Alert>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={setKeyword}
            placeholder="템플릿 이름 · 내용 검색"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="용도 필터"
              options={MESSAGE_PURPOSE_FILTER_OPTIONS}
              value={purpose}
              onChange={(event) =>
                setPurpose(event.target.value as MessagePurpose | "")
              }
              selectBoxClassName="w-36"
            />

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => {
                setFormTemplate(null);
                setIsFormOpen(true);
              }}
            >
              템플릿 추가
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-card" />
            ))}
          </div>
        )}

        {!isLoading && templates.length === 0 && (
          <EmptyState
            title="등록된 템플릿이 없습니다."
            description="자주 쓰는 공지 문구부터 만들어 두세요."
            action={
              <Button
                variant="primary"
                leftIcon={<Plus size={15} />}
                onClick={() => {
                  setFormTemplate(null);
                  setIsFormOpen(true);
                }}
              >
                템플릿 추가
              </Button>
            }
          />
        )}

        {!isLoading && templates.length > 0 && (
          <ul className="flex flex-col divide-y divide-border-main">
            {templates.map((template) => (
              <li key={template.templateId} className="flex gap-5 px-5 py-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold text-font-1">
                      {template.name}
                    </p>
                    <Badge tone="info">
                      {MESSAGE_PURPOSE_LABEL[template.purpose]}
                    </Badge>
                    <Badge tone={MESSAGE_CHANNEL_TONE[template.channel]}>
                      {MESSAGE_CHANNEL_LABEL[template.channel]}
                    </Badge>
                    {!template.isActive && <Badge tone="neutral">미사용</Badge>}
                  </div>

                  <pre className="max-h-24 overflow-hidden rounded-field border border-border-main bg-subtle px-3 py-2 text-[12px] whitespace-pre-wrap text-font-2">
                    {template.content}
                  </pre>

                  <p className="text-[12px] text-font-2 tabular-nums">
                    사용 {template.usageCount}회 · 최근 수정{" "}
                    {formatDate(template.updatedAt)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Edit size={14} />}
                    onClick={() => {
                      setFormTemplate(template);
                      setIsFormOpen(true);
                    }}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="dangerGhost"
                    leftIcon={<Trash size={14} />}
                    onClick={() => handleDelete(template)}
                  >
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MessageTemplateFormModal
        isOpen={isFormOpen}
        template={formTemplate}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
};

export default MessageTemplateManager;
