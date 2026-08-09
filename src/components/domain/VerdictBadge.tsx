import {
  REPUTATION_VERDICT_LABEL,
  type ReputationVerdict,
} from "@/type/staff";
import Badge from "@/components/ui/Badge";

interface VerdictBadgeProps {
  /** 비어 있으면 아직 평가하지 않은 것이다. */
  verdict?: ReputationVerdict;
  /** 평가가 없을 때 대신 보여 줄 문구. 비우면 아무것도 그리지 않는다. */
  emptyLabel?: string;
}

/**
 * 좋아요 · 별로예요 배지.
 *
 * 표 · 목록 · 이력 여러 곳에서 같은 값을 그리므로 여기 한 곳에만 둔다.
 * 화면마다 색을 따로 정하면 어떤 표에서는 '별로예요'가 경고색이고
 * 다른 표에서는 회색이 되어, 훑어볼 때 문제 건이 눈에 걸리지 않는다.
 */
const VerdictBadge = ({ verdict, emptyLabel }: VerdictBadgeProps) => {
  if (!verdict) {
    return emptyLabel ? (
      <span className="text-[13px] text-font-disabled">{emptyLabel}</span>
    ) : null;
  }

  return (
    <Badge tone={verdict === "GOOD" ? "success" : "danger"}>
      {REPUTATION_VERDICT_LABEL[verdict]}
    </Badge>
  );
};

export default VerdictBadge;
