import type { BadgeTone, SelectOption } from "@/components/ui";
import { PAYROLL_STATUS_LABEL, type PayrollStatus } from "@/type/payroll";

export const PAYROLL_STATUS_TONE: Record<PayrollStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "info",
  PAID: "success",
  HOLD: "danger",
};

export const PAYROLL_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 상태", value: "" },
  ...(["PENDING", "APPROVED", "PAID", "HOLD"] as const).map((status) => ({
    label: PAYROLL_STATUS_LABEL[status],
    value: status,
  })),
];
