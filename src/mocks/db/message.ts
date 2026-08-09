import type { MessageLog, MessageTemplate } from "@/type/message";
import { daysAgo } from "../utils";
import { events } from "./event";

/**
 * 메시지 템플릿 목업.
 *
 * "일이 많아서 공지가 제때 안 나간다"가 핵심 문제였다.
 * 문구를 매번 새로 쓰지 않도록 상황별 템플릿을 미리 만들어 둔다.
 */
export const messageTemplates: MessageTemplate[] = [
  {
    templateId: 1,
    name: "배치 확정 안내",
    purpose: "CONFIRM",
    channel: "LMS",
    content: `[{{행사명}}] 배치 확정 안내

{{이름}}님, 아래 일정으로 확정되었습니다.

- 근무일: {{근무일}}
- 근무시간: {{근무시간}}
- 집합: {{집합장소}}
- 직무: {{직무}} / 시급 {{시급}}
- 복장: {{복장}}
- 준비물: {{준비물}}

근로계약서는 별도 링크로 보내드립니다. 근무 전날까지 서명 부탁드립니다.
문의: {{담당자}}`,
    isActive: true,
    usageCount: 218,
    updatedAt: daysAgo(12),
    createdAt: daysAgo(300),
  },
  {
    templateId: 2,
    name: "전날 출근 리마인드",
    purpose: "REMINDER",
    channel: "SMS",
    content: `[{{행사명}}] 내일 {{근무시간}} 근무입니다. 집합: {{집합장소}} / 복장: {{복장}}. 변동 시 {{담당자}}에게 연락 주세요.`,
    isActive: true,
    usageCount: 405,
    updatedAt: daysAgo(30),
    createdAt: daysAgo(300),
  },
  {
    templateId: 3,
    name: "근로계약서 서명 요청",
    purpose: "CONTRACT",
    channel: "ALIMTALK",
    content: `[근로계약서 안내]

{{이름}}님, {{행사명}}({{근무일}}) 근로계약서가 도착했습니다.
시급 {{시급}} 기준으로 작성되었습니다.

아래 링크에서 내용을 확인하고 서명해 주세요.
근무 시작 전까지 서명이 완료되어야 현장 투입이 가능합니다.`,
    isActive: true,
    usageCount: 331,
    updatedAt: daysAgo(8),
    createdAt: daysAgo(280),
  },
  {
    templateId: 4,
    name: "신규 인력 서류 요청",
    purpose: "ETC",
    channel: "LMS",
    content: `{{이름}}님, 첫 근무 전 아래 서류가 필요합니다.

1) 신분증 사본 (주민번호 뒷자리 가림 처리)
2) 통장 사본 (본인 명의)

정산은 본인 명의 계좌로만 진행되며, 서류 미제출 시 배치가 취소될 수 있습니다.
회신 부탁드립니다. - {{담당자}}`,
    isActive: true,
    usageCount: 147,
    updatedAt: daysAgo(45),
    createdAt: daysAgo(260),
  },
  {
    templateId: 5,
    name: "정산 완료 안내",
    purpose: "SETTLEMENT",
    channel: "SMS",
    content: `[{{행사명}}] {{이름}}님 정산이 완료되었습니다. 등록된 계좌로 입금되었으니 확인 부탁드립니다. 감사합니다.`,
    isActive: true,
    usageCount: 289,
    updatedAt: daysAgo(20),
    createdAt: daysAgo(240),
  },
  {
    templateId: 6,
    name: "모집 공고 (오픈카톡 공유용)",
    purpose: "RECRUIT",
    channel: "LMS",
    content: `[{{행사명}}] {{직무}} 모집

- 근무일: {{근무일}}
- 근무시간: {{근무시간}}
- 시급: {{시급}} (세전)
- 집합: {{집합장소}}
- 복장: {{복장}}

지원은 성함/나이/경력을 담아 {{담당자}}에게 보내주세요.`,
    isActive: false,
    usageCount: 62,
    updatedAt: daysAgo(90),
    createdAt: daysAgo(200),
  },
];

let messageSequence = 0;

/** 발송 이력 목업. 최근 행사 기준으로 상황별 발송이 섞여 있게 만든다. */
export const messageLogs: MessageLog[] = events
  .slice(0, 18)
  .flatMap((event, index) => {
    const template = messageTemplates[index % 5];
    messageSequence += 1;

    const targetCount = event.totalAssigned;
    const failCount = index % 6 === 0 ? 1 : 0;

    return [
      {
        messageId: messageSequence,
        templateId: template.templateId,
        templateName: template.name,
        purpose: template.purpose,
        channel: template.channel,
        eventId: event.eventId,
        eventTitle: event.title,
        content: template.content,
        targetCount,
        successCount: Math.max(0, targetCount - failCount),
        failCount,
        // 일부 실패가 있어도 발송 자체는 완료로 본다. 실패 건은 목록에서 따로 표시한다.
        status: "SENT",
        sender: event.managerName,
        sentAt: daysAgo(index * 2 + 1, 10),
        createdAt: daysAgo(index * 2 + 1, 10),
      } satisfies MessageLog,
    ];
  });

export const findMessageTemplate = (templateId: number) =>
  messageTemplates.find((template) => template.templateId === templateId);
