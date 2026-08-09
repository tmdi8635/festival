import type { BadgeTone, SelectOption } from "@/components/ui";
import {
  APPLICATION_STATUS_LABEL,
  POSTING_STATUS_LABEL,
  type ApplicationStatus,
  type PostingStatus,
} from "@/type/recruit";

export const POSTING_STATUS_TONE: Record<PostingStatus, BadgeTone> = {
  DRAFT: "neutral",
  OPEN: "brand",
  CLOSED: "neutral",
  FILLED: "success",
};

export const POSTING_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 상태", value: "" },
  ...(["DRAFT", "OPEN", "CLOSED", "FILLED"] as const).map((status) => ({
    label: POSTING_STATUS_LABEL[status],
    value: status,
  })),
];

export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  CANCELED: "neutral",
};

export const APPLICATION_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 상태", value: "" },
  ...(["PENDING", "ACCEPTED", "REJECTED", "CANCELED"] as const).map(
    (status) => ({ label: APPLICATION_STATUS_LABEL[status], value: status }),
  ),
];
