import type { JobRole } from "./staff";

/** 거래처(발주처) 도메인 타입. 행사는 항상 거래처에 속한다. */

/**
 * 직무 하나의 청구 단가 (시급).
 *
 * **없어도 된다.** 거래처를 등록하는 시점에는 단가가 정해지지 않은 경우가
 * 대부분이고, 그것 때문에 거래처를 못 만들면 행사도 못 만든다.
 * 정하지 않은 직무는 아예 목록에 넣지 않고, 그 상태에서는 마진이
 * 계산되지 않을 뿐 나머지는 전부 그대로 굴러간다.
 */
export interface ClientBillingRate {
  role: JobRole;
  /** 거래처에 청구하는 시급 */
  rate: number;
}

/**
 * 그 직무의 청구 단가. 정하지 않았으면 0이다.
 *
 * **직무 코드로 찾는다.** 예전에는 화면마다 `"STAFF"`를 박아 놓고 그 값
 * 하나만 꺼내 썼는데, 직무는 에이전시가 기준 설정에서 자유롭게 바꾸는 값이라
 * `STAFF`가 없는 회사에서는 단가가 통째로 0이 됐다.
 */
export const resolveBillingRate = (
  billingRates: readonly ClientBillingRate[],
  role: JobRole,
): number => billingRates.find((item) => item.role === role)?.rate ?? 0;

/** 정하지 않은 단가(0)는 저장하지 않는다. 0원 청구와 미설정을 갈라 둔다. */
export const compactBillingRates = (
  billingRates: readonly ClientBillingRate[],
): ClientBillingRate[] => billingRates.filter((item) => item.rate > 0);

export interface Client {
  clientId: number;
  name: string;
  /** 사업자등록번호. 세금계산서 발행에 쓴다. */
  businessNumber: string;
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  /**
   * 직무별 청구 단가. 마진 계산의 기준값이고 **행사가 기본값으로 가져간다.**
   *
   * 비어 있어도 된다. 정해진 직무만 담긴다.
   */
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
