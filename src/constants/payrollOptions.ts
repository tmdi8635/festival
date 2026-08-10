import type { BadgeTone, SelectOption } from "@/components/ui";
import { PAYROLL_STATUS_LABEL, type PayrollStatus } from "@/type/payroll";

export const PAYROLL_STATUS_TONE: Record<PayrollStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "info",
  PAID: "success",
  HOLD: "danger",
};

/**
 * 상태가 뜻하는 것. **배지 옆에 그대로 적는다.**
 *
 * `정산대기 · 지급승인 · 지급완료`는 글자만 봐서는 순서도 뜻도 알기 어렵다.
 * 특히 '지급완료'는 "시스템이 돈을 보냈다"로 읽히기 쉬운데, 실제로는
 * **사람이 이체를 끝낸 뒤 눌러 두는 기록**이다. 그 오해가 남아 있으면
 * 아무도 안 누르거나, 이체 전에 눌러 두고 잊는다.
 */
export const PAYROLL_STATUS_HINT: Record<PayrollStatus, string> = {
  PENDING:
    "금액은 계산됐고 아직 아무도 승인하지 않았습니다. 이 단계에서 금액을 고칩니다.",
  APPROVED:
    "금액이 확정됐습니다. 이체 파일을 내려받아 은행에서 이체하세요.",
  PAID: "이미 이체가 끝났다는 기록입니다. 미지급 금액에서 빠집니다.",
  HOLD: "계좌 미등록 · 노쇼 등으로 지금은 내보낼 수 없습니다.",
};

export const PAYROLL_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 상태", value: "" },
  ...(["PENDING", "APPROVED", "PAID", "HOLD"] as const).map((status) => ({
    label: PAYROLL_STATUS_LABEL[status],
    value: status,
  })),
];
