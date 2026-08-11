/** 거래처(발주처) 도메인 타입. 행사는 항상 거래처에 속한다. */

/*
  거래처는 **단가를 갖지 않는다.**

  예전에는 거래처마다 직무별 청구 단가를 적어 두고 행사가 그걸 물려받았다.
  그런데 실제 거래는 반대 방향이다 — 대행사가 직무별 인원수로 견적을 요청하면
  **에이전시가 단가를 불러 준다.** 단가 결정권자는 우리다.
  그래서 단가는 기준 설정(`JobRoleDef.billingRate`)이 갖고, 행사 등록 시
  그 값이 초기값으로 깔린 뒤 행사별로 고쳐진다. (`EventDetail.billingRates`)
*/

export interface Client {
  clientId: number;
  name: string;
  /** 사업자등록번호. 세금계산서 발행에 쓴다. */
  businessNumber: string;
  managerName: string;
  managerPhone: string;
  managerEmail: string;
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
