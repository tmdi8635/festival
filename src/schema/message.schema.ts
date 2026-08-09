import { z } from "zod";

/** 메시지 템플릿 폼 스키마 */
export const messageTemplateSchema = z.object({
  name: z
    .string()
    .min(2, "템플릿 이름을 2자 이상 입력해 주세요.")
    .max(50, "50자 이내로 입력해 주세요."),
  purpose: z.enum([
    "RECRUIT",
    "CONFIRM",
    "REMINDER",
    "CONTRACT",
    "SETTLEMENT",
    "ETC",
  ]),
  channel: z.enum(["SMS", "LMS", "ALIMTALK"]),
  content: z
    .string()
    .min(10, "내용을 10자 이상 입력해 주세요.")
    .max(2000, "2,000자 이내로 입력해 주세요."),
  isActive: z.boolean(),
});

export type MessageTemplateSchema = z.infer<typeof messageTemplateSchema>;

export const EMPTY_MESSAGE_TEMPLATE_VALUES: MessageTemplateSchema = {
  name: "",
  purpose: "CONFIRM",
  channel: "LMS",
  content: "",
  isActive: true,
};
