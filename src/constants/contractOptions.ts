import type { BadgeTone, SelectOption } from "@/components/ui";
import {
  CONTRACT_STATUS_LABEL,
  type ContractStatus,
} from "@/type/contract";

export const CONTRACT_STATUS_TONE: Record<ContractStatus, BadgeTone> = {
  /*
    등록 대기는 재작성해 놓고 서명본을 아직 못 받은 자리다.
    지금 손이 가야 하는 것이라 눈에 걸리게 둔다.
  */
  DRAFT: "warning",
  /*
    보낸 뒤 기다리는 중이다. 담당자가 지금 할 일은 없으므로 경고색을 쓰지 않는다.
    (`info`는 이 시스템에서 '진행 중이지만 손댈 것은 없음'을 뜻한다)
  */
  SENT: "info",
  /* 되돌아온 건은 담당자가 고쳐서 다시 보내야 움직인다. 가장 급한 줄이다. */
  REJECTED: "danger",
  SIGNED: "success",
  /*
    재작성으로 대체된 문서는 '문제'가 아니라 '지나간 것'이다.
    빨강으로 두면 처리해야 할 일이 남은 것처럼 보여 목록에서 눈을 끈다.
  */
  SUPERSEDED: "neutral",
};

export const CONTRACT_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { label: "전체 상태", value: "" },
  ...(["REJECTED", "DRAFT", "SENT", "SIGNED", "SUPERSEDED"] as const).map((status) => ({
    label: CONTRACT_STATUS_LABEL[status],
    value: status,
  })),
];
