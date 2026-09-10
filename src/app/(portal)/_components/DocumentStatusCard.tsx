"use client";

import Link from "next/link";
import { DOCUMENT_REVIEW_STATE_TONE } from "@/constants/staffOptions";
import { ChevronRight } from "@/icons";
import {
  DOCUMENT_LANES,
  DOCUMENT_LANE_LABEL,
  DOCUMENT_REVIEW_STATE_LABEL,
  type StaffDocumentReviews,
} from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

interface DocumentStatusCardProps {
  reviews: StaffDocumentReviews;
  /** 내 정보 화면에서는 이미 그 화면이므로 링크를 걸지 않는다 */
  href?: string;
}

/**
 * 서류 두 갈래의 심사 상태.
 *
 * **반려 사유를 반드시 함께 보여 준다.** 사유 없이 "반려"만 뜨면 같은 사진을
 * 다시 올리게 되고, 그 왕복이 담당자에게 그대로 돌아온다.
 */
const DocumentStatusCard = ({ reviews, href }: DocumentStatusCardProps) => {
  const body = (
    <div className="flex flex-col gap-3">
      {DOCUMENT_LANES.map((lane) => {
        const review = reviews[lane];

        return (
          <div key={lane} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] text-font-1">
                {DOCUMENT_LANE_LABEL[lane]}
              </span>
              <Badge tone={DOCUMENT_REVIEW_STATE_TONE[review.state]}>
                {DOCUMENT_REVIEW_STATE_LABEL[review.state]}
              </Badge>
            </div>

            {review.state === "REJECTED" && review.rejectReason && (
              <p className="rounded-field bg-danger-bg px-3 py-2 text-[12px] leading-relaxed text-danger">
                {review.rejectReason}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );

  if (!href) return <Card title="서류 · 계좌">{body}</Card>;

  return (
    <Card noPadding>
      <Link
        href={href}
        className="flex flex-col gap-3 p-5 transition hover:bg-surface-hover"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-font-1">
            서류 · 계좌
          </span>
          <ChevronRight size={16} />
        </div>

        {body}
      </Link>
    </Card>
  );
};

export default DocumentStatusCard;
