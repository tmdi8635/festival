"use client";

import { Star } from "@/icons";
import { cn } from "@/lib/utils";
import { resolveRatingTone } from "@/constants/staffOptions";
import {
  BASE_REPUTATION_SCORE,
  calculateReputationScore,
  resolveReputationTrend,
} from "@/type/staff";
import Badge from "@/components/ui/Badge";

interface RatingStatProps {
  /** 받은 '좋아요' 수 */
  goodCount: number;
  /** 받은 '별로예요' 수 */
  badCount: number;
  /** 뱃지 형태로 그릴지, 숫자 그대로 그릴지 */
  variant?: "plain" | "badge";
  className?: string;
}

/**
 * 평판 점수 표기.
 *
 * 좋아요 비율을 그대로 보여 주면 1건 100%가 200건 95%보다 좋아 보인다.
 * 실제로 배치하고 싶은 사람은 200건 쪽이다.
 *
 * 그래서 화면에 크게 띄우는 숫자는 **평판 점수**다.
 * 모두가 기본 점수에서 출발하고, 평가가 쌓이는 만큼만 오르내린다.
 * 한 번 잘한다고 꼭대기에 서지 않고, 한 번 실수했다고 바닥으로 떨어지지도 않는다.
 *
 * 좋아요 · 별로예요 건수는 아래에 함께 적는다. 점수가 왜 그 값인지 확인할 수 있어야 한다.
 */
const RatingStat = ({
  goodCount,
  badCount,
  variant = "plain",
  className,
}: RatingStatProps) => {
  const score = calculateReputationScore(goodCount, badCount);
  const { direction, delta } = resolveReputationTrend(score);
  const total = goodCount + badCount;

  /*
    평가가 없으면 점수는 정확히 기본값이다.
    "평가 없음"이라고만 적으면 이 사람을 어디에 놓아야 할지 알 수 없으므로,
    기본 점수에서 출발했다는 사실을 그대로 보여 준다.
  */
  const detail =
    total === 0
      ? `기본 ${BASE_REPUTATION_SCORE.toFixed(1)} · 평가 없음`
      : `좋아요 ${goodCount} · 별로 ${badCount}`;

  /** 기본선에서 얼마나 움직였는지. 점수 하나만으로는 좋고 나쁨이 읽히지 않는다. */
  const trendLabel =
    direction === "FLAT"
      ? null
      : `${direction === "UP" ? "+" : ""}${delta.toFixed(1)}`;

  if (variant === "badge") {
    return (
      <div className={cn("flex flex-col items-start gap-0.5", className)}>
        <Badge tone={resolveRatingTone(score)} leftIcon={<Star size={12} />}>
          {score.toFixed(1)}
        </Badge>
        <span className="text-[11px] text-font-2 tabular-nums">{detail}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span className="inline-flex items-baseline gap-1 text-[16px] font-bold text-font-0 tabular-nums">
        <Star size={13} className="translate-y-px text-warning" />
        {score.toFixed(1)}

        {trendLabel && (
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              direction === "UP" ? "text-success" : "text-danger",
            )}
          >
            {trendLabel}
          </span>
        )}
      </span>
      <span className="text-[11px] text-font-2 tabular-nums">{detail}</span>
    </div>
  );
};

export default RatingStat;
