"use client";

import { ReactNode } from "react";
import type { BadgeTone } from "@/components/ui";
import { DOCUMENT_REVIEW_STATE_TONE } from "@/constants/staffOptions";
import { formatDate } from "@/lib/dayjs";
import type { MyProfile } from "@/type/my";
import {
  DOCUMENT_LANE_LABEL,
  DOCUMENT_REVIEW_STATE_LABEL,
  HEALTH_CERT_STATE_LABEL,
  REQUIRED_DOCUMENT_LANES,
  type HealthCertState,
} from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

/**
 * 보건증 상태별 색. 심사 상태 색에 **만료**가 하나 더 붙는다.
 *
 * 만료는 경고색이다. 한 번 승인받았던 사람이라 반려처럼 붉힐 일은 아니지만,
 * 새로 내기 전까지 보건증이 필요한 자리에는 설 수 없다.
 */
export const HEALTH_CERT_STATE_TONE: Record<HealthCertState, BadgeTone> = {
  ...DOCUMENT_REVIEW_STATE_TONE,
  EXPIRED: "warning",
};

/** 계좌번호는 뒤 4자리만 보인다. 화면이 캡처되어 돌아다니는 일은 실제로 일어난다. */
export const maskAccountNumber = (accountNumber: string): string =>
  accountNumber ? `****${accountNumber.slice(-4)}` : "";

interface DocumentStatusCardProps {
  profile: MyProfile;
  /** 제목 줄 우측 (수정 링크) */
  action?: ReactNode;
}

const RejectReason = ({ reason }: { reason?: string }) =>
  reason ? (
    <p className="rounded-field bg-danger-bg px-3 py-2 text-[12px] leading-relaxed text-danger">
      {reason}
    </p>
  ) : null;

/**
 * 서류 세 갈래의 심사 상태 — 신분증 · 통장사본(계좌) · 보건증.
 *
 * **반려 사유를 반드시 함께 보여 준다.** 사유 없이 "반려"만 뜨면 같은 사진을
 * 다시 올리게 되고, 그 왕복이 담당자에게 그대로 돌아온다.
 *
 * 보건증은 필수가 아니라서 **따로 적는다.** 미등록이어도 붉히지 않고, 만료일을 함께
 * 보여 준다 — 1년짜리 서류라 "언제까지 쓸 수 있나"가 상태만큼 중요하다.
 */
const DocumentStatusCard = ({ profile, action }: DocumentStatusCardProps) => {
  const healthReview = profile.reviews.HEALTH_CERT;
  const accountTail = maskAccountNumber(profile.accountNumber);

  return (
    <Card title="서류 · 계좌" action={action}>
      <div className="flex flex-col gap-4">
        {REQUIRED_DOCUMENT_LANES.map((lane) => {
          const review = profile.reviews[lane];

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

              {/* 계좌는 통장사본과 한 묶음으로 심사한다. 어느 계좌인지 여기서 확인한다. */}
              {lane === "BANK_ACCOUNT" && (
                <p className="text-[13px] text-font-2 tabular-nums">
                  {profile.bankName && accountTail
                    ? `${profile.bankName} ${accountTail} · 예금주 ${profile.accountHolder || "-"}`
                    : "등록된 계좌가 없어요"}
                </p>
              )}

              {review.state === "REJECTED" && (
                <RejectReason reason={review.rejectReason} />
              )}
            </div>
          );
        })}

        <div className="flex flex-col gap-1.5 border-t border-border-main pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] text-font-1">
              {DOCUMENT_LANE_LABEL.HEALTH_CERT}
              <span className="ml-1.5 text-[12px] text-font-2">선택</span>
            </span>
            <Badge tone={HEALTH_CERT_STATE_TONE[profile.healthCertState]}>
              {HEALTH_CERT_STATE_LABEL[profile.healthCertState]}
            </Badge>
          </div>

          <p className="text-[13px] text-font-2 tabular-nums">
            {profile.healthCertState === "NONE"
              ? "식음료처럼 보건증이 필요한 자리에 지원할 때만 있으면 돼요"
              : profile.healthCertExpiresAt
                ? `${formatDate(profile.healthCertExpiresAt)}까지 유효${
                    profile.healthCertState === "EXPIRED" ? "했어요 · 새로 올려 주세요" : ""
                  }`
                : "발급일이 없어요"}
          </p>

          {profile.healthCertState === "REJECTED" && (
            <RejectReason reason={healthReview?.rejectReason} />
          )}
        </div>
      </div>
    </Card>
  );
};

export default DocumentStatusCard;
