import { cn } from "@/lib/utils";

interface RatingStatProps {
  /** 누적 평판 점수. 기준점은 `REPUTATION_BASE_SCORE`(1000)다. */
  reputationScore: number;
  className?: string;
}

/**
 * 평판 점수 표기. **숫자 하나다. 그게 전부다.**
 *
 * 점수는 쌓이는 값이다. 모두가 1000점에서 시작하고, 평가 항목 하나가
 * 2점씩 더하거나 뺀다. 그래서 목록에서는 두 사람의 숫자를 나란히 놓는 것만으로
 * 순서가 읽힌다.
 *
 * ## 색도 배지도 없다
 *
 * 예전에는 등급 이름을 없애고도 배지와 색은 남겨 뒀다. 그런데 초록 배지와
 * 빨간 배지는 결국 **시스템이 이 사람을 좋다/나쁘다로 판정한 것**이다.
 * 1002점을 초록으로 칠하면 두 명에게 좋아요 한 번씩 받은 사람이 화면에서
 * '괜찮은 사람'이 되고, 998점은 그 반대가 된다. 그 판단은 숫자를 보고
 * 에이전시가 하는 일이지 화면이 미리 해 줄 일이 아니다.
 *
 * 어떤 평가를 받아서 이 점수가 됐는지는 **인력 상세의 평판 탭**이 답한다.
 */
const RatingStat = ({ reputationScore, className }: RatingStatProps) => (
  <span className={cn("text-font-1 tabular-nums", className)}>
    {reputationScore}
  </span>
);

export default RatingStat;
