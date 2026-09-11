"use client";

import { useState } from "react";
import Image from "next/image";
import { useStaffDetailQuery } from "@/api/staff/getStaffDetail";
import { useStaffDocumentReviewMutation } from "@/api/staff/mutateStaffDocumentReview";
import {
  DOCUMENT_REVIEW_STATE_TONE,
  HEALTH_CERT_STATE_TONE,
} from "@/constants/staffOptions";
import { Eye, EyeOff } from "@/icons";
import { formatDate, formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_LANES,
  DOCUMENT_LANE_LABEL,
  DOCUMENT_REVIEW_STATE_LABEL,
  HEALTH_CERT_STATE_LABEL,
  formatPhoneNumber,
  healthCertExpiresAt,
  type DocumentLane,
} from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import Textarea from "@/components/ui/Textarea";

interface StaffDocumentReviewModalProps {
  staffId: number | null;
  onClose: () => void;
}

/**
 * 서류 심사 — 승인 · 반려.
 *
 * **사본을 보지 않고는 누를 수 없게** 만든다. 목록에서 바로 승인 버튼을 누를 수 있으면
 * 아무도 열어 보지 않고 전부 승인하게 되고, 그러면 심사 단계가 있는 것과 없는 것이 같아진다.
 * 그래서 승인·반려는 사본이 화면에 떠 있는 이 모달 안에만 있다.
 *
 * 사본은 기본으로 가려 둔다. 옆자리에서 보이는 화면에 남의 신분증이 떠 있을 이유가 없다.
 */
const StaffDocumentReviewModal = ({
  staffId,
  onClose,
}: StaffDocumentReviewModalProps) => {
  const { data: staff, isLoading } = useStaffDetailQuery(staffId);
  const reviewMutation = useStaffDocumentReviewMutation();

  const [visibleLane, setVisibleLane] = useState<DocumentLane | null>(null);
  const [rejectingLane, setRejectingLane] = useState<DocumentLane | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  /*
    갈래별 사본. 삼항식 두 갈래로 두면 갈래가 늘 때 새 갈래가 조용히 통장사본을 보여 준다.
    (보건증 칸에 통장사본이 뜨는 사고가 실제로 그렇게 난다) 갈래마다 명시한다.
  */
  const imageOf = (lane: DocumentLane): string | undefined => {
    if (!staff) return undefined;

    const images: Record<DocumentLane, string> = {
      ID_CARD: staff.idCardImageUrl,
      BANK_ACCOUNT: staff.bankBookImageUrl,
      HEALTH_CERT: staff.healthCertImageUrl,
    };

    return images[lane] || undefined;
  };

  const healthCertExpiry = healthCertExpiresAt(staff?.healthCertIssuedAt);

  const handleReject = (lane: DocumentLane) => {
    if (!staffId) return;

    reviewMutation.mutate(
      {
        staffId,
        lane,
        state: "REJECTED",
        rejectReason: rejectReason.trim(),
      },
      {
        onSuccess: () => {
          setRejectingLane(null);
          setRejectReason("");
        },
      },
    );
  };

  return (
    <Modal
      isOpen={staffId !== null}
      onClose={onClose}
      title={staff ? `${staff.name} 서류 심사` : "서류 심사"}
      description={
        staff
          ? `${formatPhoneNumber(staff.phoneNumber)} · 누적 근무 ${staff.workCount}회`
          : undefined
      }
      size="lg"
    >
      {isLoading || !staff ? (
        <Skeleton className="h-80 w-full rounded-card" />
      ) : (
        <div className="flex flex-col gap-5">
          <Alert tone="info" title="승인하면 곧바로 배치할 수 있게 됩니다.">
            신분증 · 통장사본이 모두 승인되어야 확정 배치가 열립니다. 사본의
            이름과 계좌 예금주가 같은지 확인해 주세요. 보건증은 선택 서류라 활동
            여부에 영향이 없고, 보건증이 필요한 포지션에 지원할 때만 봅니다.
          </Alert>

          {DOCUMENT_LANES.map((lane) => {
            const review = staff.reviews[lane];
            const imageUrl = imageOf(lane);
            const isVisible = visibleLane === lane;

            return (
              <section
                key={lane}
                className="flex flex-col gap-3 rounded-card border border-border-main p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-font-1">
                      {DOCUMENT_LANE_LABEL[lane]}
                    </h3>
                    {/*
                      보건증은 승인 뒤에도 **만료**가 있다. 심사 상태만 적으면
                      1년 지난 보건증이 '승인 완료'로 보여 식음료 자리에 선다.
                    */}
                    {lane === "HEALTH_CERT" ? (
                      <Badge tone={HEALTH_CERT_STATE_TONE[staff.healthCertState]}>
                        {HEALTH_CERT_STATE_LABEL[staff.healthCertState]}
                      </Badge>
                    ) : (
                      <Badge tone={DOCUMENT_REVIEW_STATE_TONE[review.state]}>
                        {DOCUMENT_REVIEW_STATE_LABEL[review.state]}
                      </Badge>
                    )}
                    {lane === "HEALTH_CERT" && (
                      <span className="text-[12px] text-font-2">선택</span>
                    )}
                  </div>

                  {review.reviewedAt && (
                    <span className="text-[12px] text-font-2">
                      {review.reviewerName} · {formatDateTime(review.reviewedAt)}
                    </span>
                  )}
                </div>

                {/* 계좌는 통장사본과 함께 봐야 판단이 된다. 사본 옆에 적어 둔다. */}
                {lane === "BANK_ACCOUNT" && (
                  <dl className="grid grid-cols-3 gap-2 rounded-field bg-subtle px-3 py-2 text-[13px]">
                    <div>
                      <dt className="text-[12px] text-font-2">은행</dt>
                      <dd className="text-font-1">{staff.bankName || "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] text-font-2">계좌번호</dt>
                      <dd className="text-font-1 tabular-nums">
                        {staff.accountNumber || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[12px] text-font-2">예금주</dt>
                      <dd className="text-font-1">
                        {staff.accountHolder || "-"}
                      </dd>
                    </div>
                  </dl>
                )}

                {/* 보건증은 발급일이 판단의 절반이다. 사본의 날짜와 적힌 날짜가 같은지 본다. */}
                {lane === "HEALTH_CERT" && (
                  <dl className="grid grid-cols-2 gap-2 rounded-field bg-subtle px-3 py-2 text-[13px]">
                    <div>
                      <dt className="text-[12px] text-font-2">발급일</dt>
                      <dd className="text-font-1 tabular-nums">
                        {staff.healthCertIssuedAt
                          ? formatDate(staff.healthCertIssuedAt)
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[12px] text-font-2">만료일</dt>
                      <dd
                        className={cn(
                          "tabular-nums",
                          staff.healthCertState === "EXPIRED"
                            ? "text-danger"
                            : "text-font-1",
                        )}
                      >
                        {healthCertExpiry ? formatDate(healthCertExpiry) : "-"}
                      </dd>
                    </div>
                  </dl>
                )}

                {imageUrl ? (
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-field border border-border-main bg-subtle">
                    {isVisible ? (
                      <Image
                        src={imageUrl}
                        alt={DOCUMENT_LANE_LABEL[lane]}
                        fill
                        sizes="640px"
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVisibleLane(lane)}
                        className="flex size-full flex-col items-center justify-center gap-2 text-font-2 transition hover:text-font-1"
                      >
                        <EyeOff size={22} />
                        <span className="text-[13px]">눌러서 보기</span>
                      </button>
                    )}

                    {isVisible && (
                      <button
                        type="button"
                        onClick={() => setVisibleLane(null)}
                        className="absolute top-2 right-2 flex items-center gap-1.5 rounded-field bg-overlay px-2.5 py-1.5 text-[12px] text-font-4"
                      >
                        <Eye size={14} />
                        가리기
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="rounded-field bg-subtle px-3 py-6 text-center text-[13px] text-font-2">
                    아직 제출되지 않았습니다.
                  </p>
                )}

                {review.state === "REJECTED" && review.rejectReason && (
                  <p className="rounded-field bg-danger-bg px-3 py-2 text-[12px] text-danger">
                    반려 사유: {review.rejectReason}
                  </p>
                )}

                {rejectingLane === lane ? (
                  <div className="flex flex-col gap-2">
                    <FormField
                      label="반려 사유"
                      hint="본인 화면에 그대로 보입니다"
                      required
                    >
                      <Textarea
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="예) 사진이 흐려 계좌번호를 읽을 수 없습니다. 다시 올려 주세요."
                        rows={2}
                      />
                    </FormField>

                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRejectingLane(null)}
                      >
                        취소
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={
                          rejectReason.trim().length < 5 ||
                          reviewMutation.isPending
                        }
                        onClick={() => handleReject(lane)}
                      >
                        반려하기
                      </Button>
                    </div>
                  </div>
                ) : (
                  review.state !== "NONE" && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={reviewMutation.isPending}
                        onClick={() => {
                          setVisibleLane(lane);
                          setRejectingLane(lane);
                        }}
                      >
                        반려
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          review.state === "APPROVED" || reviewMutation.isPending
                        }
                        onClick={() =>
                          staffId &&
                          reviewMutation.mutate({
                            staffId,
                            lane,
                            state: "APPROVED",
                          })
                        }
                      >
                        {review.state === "APPROVED" ? "승인됨" : "승인"}
                      </Button>
                    </div>
                  )
                )}
              </section>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default StaffDocumentReviewModal;
