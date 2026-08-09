import type { JobRole } from "./staff";

/** 거래처(발주처) 도메인 타입. 행사는 항상 거래처에 속한다. */

export interface ClientBillingRate {
  role: JobRole;
  /** 거래처에 청구하는 시급 */
  rate: number;
}

export interface Client {
  clientId: number;
  name: string;
  /** 사업자등록번호. 세금계산서 발행에 쓴다. */
  businessNumber: string;
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  /** 직무별 청구 단가. 마진 계산의 기준이다. */
  billingRates: ClientBillingRate[];
  eventCount: number;
  /** 누적 청구액 */
  totalRevenue: number;
  /** 누적 인건비 */
  totalLaborCost: number;
  isActive: boolean;
  memo: string;
  lastEventDate?: string;
  createdAt: string;
}

export interface ClientFormValues {
  name: string;
  businessNumber: string;
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  billingRates: ClientBillingRate[];
  isActive: boolean;
  memo: string;
}

/** 매출 대비 마진율(%)을 구한다. 0으로 나누지 않도록 방어한다. */
export const calculateMarginRate = (
  revenue: number,
  laborCost: number,
): number => {
  if (revenue <= 0) return 0;

  return Math.round(((revenue - laborCost) / revenue) * 1000) / 10;
};
