"use client";

import { cn } from "@/lib/utils";
import { resolveRatingTone } from "@/constants/staffOptions";
import {
  REPUTATION_BASE_SCORE,
  REPUTATION_TIER_LABEL,
  formatReputationDelta,
  resolveReputationTier,
} from "@/type/staff";
import Badge from "@/components/ui/Badge";

interface RatingStatProps {
  /** 누적 평판 점수. 기준점은 `REPUTATION_BASE_SCORE`(1000)다. */
  reputationScore: number;
  /** 받은 '좋아요' 항목 수 */
  goodCount: number;
  /** 받은 '별로예요' 항목 수 */
  badCount: number;
  /** 뱃지 형태로 그릴지, 숫자 그대로 그릴지 */
  variant?: "plain" | "badge";
  className?: string;
}

/**
 * 평판 점수 표기.
 *
 * 점수는 **쌓이는 값**이다. 모두가 1000점에서 시작하고, 평가 한 건이
 * 항목마다 정해진 만큼 더하고 뺀다. (칭찬 +1~+5 / 불만 −5~−10)
 *
 * 예전에는 5점 만점 안을 오가는 평균이었는데, 3.9와 4.1의 차이가 무엇인지
 * 아무도 설명하지 못했다. 좁은 구간에 전원이 몰려 있어 목록을 점수순으로
 * 세워도 순서가 거의 바뀌지 않았고, 한 번 크게 사고를 친 사람도
 * 몇 건만 더 받으면 평균이 도로 올라왔다.
 *
 * 누적으로 두면 **잘한 것도 잘못한 것도 남는다.** 오래 쌓아 온 사람과
 * 이제 막 시작한 사람이 구분되고, 노쇼 한 번의 −10이 지워지지 않는다.
 *
 * `1009점`이라는 숫자만으로는 좋은지 알 수 없으므로 **등급 이름과
 * 기준점 대비 증감을 항상 함께** 적는다.
 */
const RatingStat = ({
  reputationScore,
  goodCount,
  badCount,
  variant = "plain",
  className,
}: RatingStatProps) => {
  const tier = resolveReputationTier(reputationScore);
  const delta = reputationScore - REPUTATION_BASE_SCORE;
  const total = goodCount + badCount;

  /*
    평가가 없으면 점수는 정확히 기준점이다.
    "평가 없음"이라고만 적으면 이 사람을 어디에 놓아야 할지 알 수 없으므로,
    기준점에서 출발했다는 사실을 그대로 보여 준다.
  */
  const detail =
    total === 0
      ? "평가 없음 · 기준점"
      : `좋아요 ${goodCount} · 별로 ${badCount}`;

  if (variant === "badge") {
    return (
      <div className={cn("flex flex-col items-start gap-0.5", className)}>
        <Badge tone={resolveRatingTone(reputationScore)}>
          <span className="tabular-nums">{reputationScore}</span>
          <span className="ml-1">{REPUTATION_TIER_LABEL[tier]}</span>
        </Badge>
        <span className="text-[11px] text-font-2 tabular-nums">{detail}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span className="inline-flex items-baseline gap-1 text-[16px] font-bold text-font-0 tabular-nums">
        {reputationScore}

        {/* 기준점에서 어느 쪽으로 움직였는지. 숫자만으로는 방향이 안 읽힌다. */}
        {delta !== 0 && (
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              delta > 0 ? "text-success" : "text-danger",
            )}
          >
            {formatReputationDelta(delta)}
          </span>
        )}
      </span>
      <span className="text-[11px] text-font-2 tabular-nums">{detail}</span>
    </div>
  );
};

export default RatingStat;
