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
  /**
   * 이 중 직접 입력한 번호로 나간 건수.
   *
   * 이력에서 인력풀 발송과 구분되어야 한다. 나중에 "누구에게 보냈나"를 되짚을 때
   * 인력 기록에는 없는 번호가 섞여 있다는 사실 자체를 알아야 하기 때문이다.
   */
  directCount?: number;
  status: MessageStatus;
  sender: string;
  sentAt?: string;
  createdAt: string;
}

/**
 * 발송 요청 본문.
 *
 * 수신 대상은 두 갈래다. 인력풀에서 고른 사람(`staffIds`)과
 * **손으로 친 번호**(`phoneNumbers`)다. 둘 다 필요하다.
 * 아직 인력으로 등록되지 않은 지원자, 거래처 담당자, 현장에서 급히 부른 사람에게
 * 보내야 하는 일이 실제로 있는데, 그때마다 인력을 먼저 등록하게 하면
 * 담당자는 결국 시스템 밖에서 문자를 보낸다. 그러면 이력도 남지 않는다.
 */
export interface SendMessageRequest {
  channel: MessageChannel;
  purpose: MessagePurpose;
  templateId?: number;
  eventId?: number;
  content: string;
  /** 수신 대상 인력 ID 목록 */
  staffIds: number[];
  /** 직접 입력한 휴대폰번호 ('-' 없는 숫자) */
  phoneNumbers?: string[];
}

/**
 * 메시지 본문에서 쓸 수 있는 변수.
 *
 * `example`을 함께 둔다. 토큰만 나열하면 `{{시급}}`이 `12000`으로 들어가는지
 * `시급 12,000원`으로 들어가는지 알 수 없어서, 담당자는 결국 자기에게 한 번
 * 보내 보고 확인한다. 어떤 모양으로 박히는지를 화면에서 바로 보여 준다.
 */
export interface MessageVariable {
  token: string;
  description: string;
  /** 실제로 치환됐을 때의 모양 */
  example: string;
}

export const MESSAGE_VARIABLES: MessageVariable[] = [
  { token: "{{이름}}", description: "수신자 성명", example: "김승우" },
  {
    token: "{{행사명}}",
    description: "행사 제목",
    example: "A 브랜드 성수 팝업스토어 운영",
  },
  { token: "{{근무일}}", description: "근무 일자", example: "12월 31일(수)" },
  {
    token: "{{근무시간}}",
    description: "시작~종료 시각",
    example: "09:00~18:00",
  },
  {
    token: "{{집합장소}}",
    description: "집합 장소 · 시간",
    example: "정문 앞 / 시작 30분 전 집합",
  },
  {
    token: "{{복장}}",
    description: "드레스코드",
    example: "상의 흰색 셔츠 · 하의 검정 슬랙스",
  },
  { token: "{{준비물}}", description: "지참물", example: "신분증" },
  { token: "{{직무}}", description: "배치된 직무", example: "스태프" },
  {
    token: "{{시급}}",
    description: "지급 기준 + 금액",
    example: "시급 12,000원",
  },
  { token: "{{담당자}}", description: "담당 매니저", example: "김도윤" },
  {
    token: "{{담당자연락처}}",
    description: "담당 매니저 휴대폰번호",
    example: "010-2345-0917",
  },
];

/**
 * 변수의 예시 값만 모은 묶음.
 *
 * 수신 대상을 아직 고르지 않았을 때 미리보기를 채운다.
 * 대상이 없다고 미리보기를 비워 두면, 문구를 다 쓰고 대상을 고른 **뒤에야**
 * 문장이 어색한 것을 알게 된다. 그때는 이미 보낼 준비가 끝난 뒤다.
 */
export const MESSAGE_VARIABLE_SAMPLE: Record<string, string> =
  Object.fromEntries(
    MESSAGE_VARIABLES.map((variable) => [
      variable.token.replace(/[{}]/g, ""),
      variable.example,
    ]),
  );

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
