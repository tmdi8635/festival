"use client";

import { useMyReputationQuery } from "@/api/my/getMyReputations";
import { formatReputationDelta, REPUTATION_VERDICT_LABEL } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";

/**
 * 내가 받은 평가.
 *
 * **별로예요 항목도 그대로 보여 준다.** 무엇 때문에 그런 평가를 받았는지 모르면
 * 고칠 수가 없고, 다음 배치에서 왜 안 불리는지도 알 수 없다.
 * 담당자 메모는 담기지 않는다 — 응답 자체에 없다. (`MyReputation`)
 */
const MyReputationCard = () => {
  const { data, isLoading } = useMyReputationQuery();

  if (isLoading || !data) {
    return <Skeleton className="h-40 w-full rounded-card" />;
  }

  const { items, goodCount, badCount, tagCounts } = data;

  return (
    <Card title="받은 평가" description="근무가 끝나면 담당자가 남깁니다.">
      {items.length === 0 ? (
        <EmptyState
          title="아직 받은 평가가 없습니다."
          description="근무를 마치면 여기에 쌓입니다."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="text-[14px] text-success">
              좋아요 {goodCount}
            </span>
            <span className="text-[14px] text-danger">
              별로예요 {badCount}
            </span>
          </div>

          {/* 점수보다 **어떤 항목을 받았는지**가 실제로 도움이 된다. */}
          <div className="flex flex-wrap gap-1.5">
            {tagCounts.map((tag) => (
              <Badge
                key={tag.tag}
                tone={tag.verdict === "GOOD" ? "success" : "danger"}
              >
                {tag.tag} {tag.count}
              </Badge>
            ))}
          </div>

          <ul className="flex flex-col divide-y divide-border-main border-t border-border-main">
            {items.slice(0, 5).map((item) => (
              <li
                key={item.assignmentId}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-font-1">
                    {item.eventTitle}
                  </span>
                  <span className="block text-[12px] text-font-2 tabular-nums">
                    {item.workDate}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  <Badge
                    tone={item.verdict === "GOOD" ? "success" : "danger"}
                  >
                    {REPUTATION_VERDICT_LABEL[item.verdict]}
                  </Badge>
                  <span className="text-[12px] text-font-2 tabular-nums">
                    {formatReputationDelta(item.points)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};

export default MyReputationCard;
