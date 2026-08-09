/**
 * 문자 · 알림톡 도메인 타입.
 *
 * 실제 발송은 외부 API(알리고 · 쿨에스엠에스 등)를 붙여야 한다.
 * 지금은 발송 대상 선정 · 문구 작성 · 이력 관리까지를 시스템에서 처리하고,
 * 전송 구간만 나중에 갈아 끼운다.
 */

export type MessageChannel = "SMS" | "LMS" | "ALIMTALK";

export const MESSAGE_CHANNEL_LABEL: Record<MessageChannel, string> = {
  SMS: "단문(SMS)",
  LMS: "장문(LMS)",
  ALIMTALK: "알림톡",
};

export type MessagePurpose =
  | "RECRUIT"
  | "CONFIRM"
  | "REMINDER"
  | "CONTRACT"
  | "SETTLEMENT"
  | "ETC";

export const MESSAGE_PURPOSE_LABEL: Record<MessagePurpose, string> = {
  RECRUIT: "모집 공고",
  CONFIRM: "배치 확정",
  REMINDER: "출근 안내",
  CONTRACT: "계약서 요청",
  SETTLEMENT: "정산 안내",
  ETC: "기타",
};

export type MessageStatus = "READY" | "SENDING" | "SENT" | "FAILED";

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  READY: "발송대기",
  SENDING: "발송중",
  SENT: "발송완료",
  FAILED: "실패",
};

export interface MessageTemplate {
  templateId: number;
  name: string;
  purpose: MessagePurpose;
  channel: MessageChannel;
  /** `{{변수}}` 문법은 근로계약서 템플릿과 동일하게 쓴다. */
  content: string;
  isActive: boolean;
  usageCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface MessageTemplateFormValues {
  name: string;
  purpose: MessagePurpose;
  channel: MessageChannel;
  content: string;
  isActive: boolean;
}

export interface MessageLog {
  messageId: number;
  templateId?: number;
  templateName?: string;
  purpose: MessagePurpose;
  channel: MessageChannel;
  eventId?: number;
  eventTitle?: string;
  content: string;
  targetCount: number;
  successCount: number;
  failCount: number;
  status: MessageStatus;
  sender: string;
  sentAt?: string;
  createdAt: string;
}

/** 발송 요청 본문 */
export interface SendMessageRequest {
  channel: MessageChannel;
  purpose: MessagePurpose;
  templateId?: number;
  eventId?: number;
  content: string;
  /** 수신 대상 인력 ID 목록 */
  staffIds: number[];
}

/** 메시지 본문에서 쓸 수 있는 변수 */
export const MESSAGE_VARIABLES: { token: string; description: string }[] = [
  { token: "{{이름}}", description: "수신자 성명" },
  { token: "{{행사명}}", description: "행사 제목" },
  { token: "{{근무일}}", description: "근무 일자" },
  { token: "{{근무시간}}", description: "시작~종료 시각" },
  { token: "{{집합장소}}", description: "집합 장소 · 시간" },
  { token: "{{복장}}", description: "드레스코드" },
  { token: "{{준비물}}", description: "지참물" },
  { token: "{{직무}}", description: "배치된 직무" },
  { token: "{{시급}}", description: "적용 시급" },
  { token: "{{담당자}}", description: "담당 매니저" },
];

/** SMS 기준 바이트 수. 90바이트를 넘으면 LMS로 나간다. */
export const SMS_BYTE_LIMIT = 90;

/** 한글 2바이트로 계산한 메시지 길이 */
export const calculateMessageBytes = (content: string): number =>
  [...content].reduce(
    (total, character) => total + (character.charCodeAt(0) > 127 ? 2 : 1),
    0,
  );

/**
 * 미리보기용 변수 치환.
 * 근로계약서와 같은 `{{변수}}` 문법을 쓰므로 동작도 동일하게 맞춘다.
 */
export const renderMessagePreview = (
  content: string,
  values: Record<string, string>,
): string =>
  content.replace(/\{\{(.+?)\}\}/g, (matched, key: string) => {
    const value = values[key.trim()];

    return value === undefined ? matched : value;
  });
