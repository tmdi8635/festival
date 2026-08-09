import { HttpResponse, delay, http } from "msw";
import type {
  MessageLog,
  MessagePurpose,
  MessageTemplate,
  MessageTemplateFormValues,
  SendMessageRequest,
} from "@/type/message";
import { findEvent } from "../db/event";
import {
  findMessageTemplate,
  messageLogs,
  messageTemplates,
} from "../db/message";
import { findStaff } from "../db/staff";
import {
  BASE_URI,
  MOCK_DELAY_MS,
  badRequest,
  matchesKeyword,
  nextId,
  notFound,
  paginate,
} from "../utils";

export const messageHandlers = [
  http.get(`${BASE_URI}/admin/messages`, async ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const purpose = url.searchParams.get("purpose") as MessagePurpose | null;

    const filtered = messageLogs.filter((log) => {
      if (purpose && log.purpose !== purpose) return false;

      return matchesKeyword(
        keyword,
        log.content,
        log.eventTitle ?? "",
        log.templateName ?? "",
        log.sender,
      );
    });

    const sorted = [...filtered].sort((a, b) =>
      (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt),
    );

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(paginate(sorted, url));
  }),

  /**
   * 발송 요청.
   *
   * 실제 전송은 외부 API를 붙여야 한다. 지금은 대상 인원 · 문구 · 이력만 남기고
   * 성공 응답을 돌려준다. 전송 구간만 나중에 갈아 끼우면 화면은 그대로 쓴다.
   */
  http.post(`${BASE_URI}/admin/messages/send`, async ({ request }) => {
    const body = (await request.json()) as SendMessageRequest;

    if (body.staffIds.length === 0) {
      return badRequest("수신 대상을 한 명 이상 선택해 주세요.");
    }

    if (!body.content.trim()) {
      return badRequest("발송할 내용을 입력해 주세요.");
    }

    const event = body.eventId ? findEvent(body.eventId) : undefined;
    const template = body.templateId
      ? findMessageTemplate(body.templateId)
      : undefined;

    // 연락처가 없는 인력은 발송 실패로 집계한다.
    const failCount = body.staffIds.filter(
      (staffId) => !findStaff(staffId)?.phoneNumber,
    ).length;

    const created: MessageLog = {
      messageId: nextId(messageLogs, "messageId"),
      templateId: template?.templateId,
      templateName: template?.name,
      purpose: body.purpose,
      channel: body.channel,
      eventId: event?.eventId,
      eventTitle: event?.title,
      content: body.content,
      targetCount: body.staffIds.length,
      successCount: body.staffIds.length - failCount,
      failCount,
      status: "SENT",
      sender: "운영자",
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (template) template.usageCount += 1;

    messageLogs.unshift(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  /* ---------------------------------- 템플릿 --------------------------------- */

  http.get(`${BASE_URI}/admin/message-templates`, async ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword") ?? "";
    const purpose = url.searchParams.get("purpose") as MessagePurpose | null;

    const filtered = messageTemplates.filter((template) => {
      if (purpose && template.purpose !== purpose) return false;

      return matchesKeyword(keyword, template.name, template.content);
    });

    await delay(MOCK_DELAY_MS);

    return HttpResponse.json({ items: filtered });
  }),

  http.post(`${BASE_URI}/admin/message-templates`, async ({ request }) => {
    const body = (await request.json()) as MessageTemplateFormValues;

    const created: MessageTemplate = {
      ...body,
      templateId: nextId(messageTemplates, "templateId"),
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    messageTemplates.push(created);
    await delay(MOCK_DELAY_MS);

    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(
    `${BASE_URI}/admin/message-templates/:templateId`,
    async ({ params, request }) => {
      const template = findMessageTemplate(Number(params.templateId));
      const body = (await request.json()) as MessageTemplateFormValues;

      if (!template) return notFound("존재하지 않는 템플릿입니다.");

      Object.assign(template, body, { updatedAt: new Date().toISOString() });
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json(template);
    },
  ),

  http.delete(
    `${BASE_URI}/admin/message-templates/:templateId`,
    async ({ params }) => {
      const templateId = Number(params.templateId);
      const index = messageTemplates.findIndex(
        (template) => template.templateId === templateId,
      );

      if (index < 0) return notFound("존재하지 않는 템플릿입니다.");

      messageTemplates.splice(index, 1);
      await delay(MOCK_DELAY_MS);

      return new HttpResponse(null, { status: 204 });
    },
  ),
];
