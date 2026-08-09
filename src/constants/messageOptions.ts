import type { BadgeTone, SelectOption } from "@/components/ui";
import {
  MESSAGE_CHANNEL_LABEL,
  MESSAGE_PURPOSE_LABEL,
  type MessageChannel,
  type MessageStatus,
} from "@/type/message";

export const MESSAGE_STATUS_TONE: Record<MessageStatus, BadgeTone> = {
  READY: "neutral",
  SENDING: "info",
  SENT: "success",
  FAILED: "danger",
};

export const MESSAGE_CHANNEL_TONE: Record<MessageChannel, BadgeTone> = {
  SMS: "neutral",
  LMS: "info",
  ALIMTALK: "brand",
};

export const MESSAGE_PURPOSE_OPTIONS: SelectOption[] = (
  ["RECRUIT", "CONFIRM", "REMINDER", "CONTRACT", "SETTLEMENT", "ETC"] as const
).map((purpose) => ({
  label: MESSAGE_PURPOSE_LABEL[purpose],
  value: purpose,
}));

export const MESSAGE_PURPOSE_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 용도", value: "" },
  ...MESSAGE_PURPOSE_OPTIONS,
];

export const MESSAGE_CHANNEL_OPTIONS: SelectOption[] = (
  ["SMS", "LMS", "ALIMTALK"] as const
).map((channel) => ({
  label: MESSAGE_CHANNEL_LABEL[channel],
  value: channel,
}));
