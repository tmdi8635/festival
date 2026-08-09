import type { BadgeTone, SelectOption } from "@/components/ui";
import {
  LOG_DOMAIN_LABEL,
  MANAGER_ROLE_LABEL,
  type LogLevel,
  type ManagerRole,
} from "@/type/ops";

export const MANAGER_ROLE_TONE: Record<ManagerRole, BadgeTone> = {
  OWNER: "brand",
  MANAGER: "info",
  VIEWER: "neutral",
};

export const MANAGER_ROLE_OPTIONS: SelectOption[] = (
  ["OWNER", "MANAGER", "VIEWER"] as const
).map((role) => ({ label: MANAGER_ROLE_LABEL[role], value: role }));

export const LOG_LEVEL_TONE: Record<LogLevel, BadgeTone> = {
  INFO: "neutral",
  WARN: "warning",
  ERROR: "danger",
};

export const LOG_LEVEL_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 레벨", value: "" },
  { label: "INFO", value: "INFO" },
  { label: "WARN", value: "WARN" },
  { label: "ERROR", value: "ERROR" },
];

export const LOG_DOMAIN_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 영역", value: "" },
  ...(
    [
      "EVENT",
      "STAFF",
      "CONTRACT",
      "PAYROLL",
      "RECRUIT",
      "MESSAGE",
      "CLIENT",
      "OPS",
    ] as const
  ).map((domain) => ({ label: LOG_DOMAIN_LABEL[domain], value: domain })),
];
