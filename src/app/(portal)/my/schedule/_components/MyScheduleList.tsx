"use client";

import { useMemo, useState } from "react";
import { useMyAssignmentListQuery } from "@/api/my/getMySchedule";
import { useMyApplicationListQuery } from "@/api/my/getMyRecruit";
import { useMyOfferListQuery } from "@/api/my/getMyOffers";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Tabs, { type TabItem } from "@/components/ui/Tabs";
import MyWorkCard from "@/app/(portal)/_components/MyWorkCard";
import PostingDetailModal from "@/app/(portal)/_components/PostingDetailModal";
import MyApplicationCard from "./MyApplicationCard";
import MyOfferCard from "./MyOfferCard";

/**
 * 리스트의 탭.
 *
 * '신청'이 여기 있는 이유는, 지원한 자리도 **본인에게는 일정이기 때문**이다.
 * 공고 화면에 두면 "지원한 뒤 확인하려면 공고를 다시 찾아 들어가야" 하고,
 * 그러면 같은 날 두 곳에 지원한 것도 눈치채지 못한다.
 *
 * '제안'도 같은 이유로 여기 있다. 담당자가 먼저 권한 자리는 수락하면 바로 일정이 된다.
 *
 * 순서는 확정될 가능성이 높은 쪽부터다 — 확정(예정) · 수락만 하면 되는 것(제안) ·
 * 기다리는 것(신청) · 끝난 것(종료).
 */
type ScheduleTab = "UPCOMING" | "OFFERED" | "APPLIED" | "PAST";

const TABS: TabItem<ScheduleTab>[] = [
  { label: "예정", value: "UPCOMING" },
  { label: "제안", value: "OFFERED" },
  { label: "신청", value: "APPLIED" },
  { label: "종료", value: "PAST" },
];

const isScheduleTab = (value: string | null): value is ScheduleTab =>
  value === "UPCOMING" ||
  value === "OFFERED" ||
  value === "APPLIED" ||
  value === "PAST";

const EMPTY_TEXT: Record<ScheduleTab, { title: string; description: string }> = {
  UPCOMING: {
    title: "예정된 근무가 없습니다.",
    description: "공고에서 원하는 자리에 지원해 보세요.",
  },
  OFFERED: {
    title: "받은 제안이 없습니다.",
    description: "담당자가 먼저 근무를 권하면 여기에 옵니다.",
  },
  APPLIED: {
    title: "신청한 공고가 없습니다.",
    description: "지원하면 확정되기 전까지 여기에서 확인할 수 있습니다.",
  },
  PAST: {
    title: "지난 근무가 없습니다.",
    description: "근무가 끝나면 여기에 쌓입니다.",
  },
};

interface MyScheduleListProps {
  /** 들어오는 링크의 `?tab=`. 홈의 "지원 결과" · "받은 제안"이 해당 탭으로 보낸다 */
  initialTab: string | null;
}

/**
 * 일정 리스트.
 *
 * 탭은 주소에 담지 않는다. 자기 일정을 남에게 공유할 일은 없다.
 * 다만 **들어오는 링크는 받는다** — 첫 탭에 떨어뜨려 놓으면 결과를 직접 찾아야 한다.
 */
const MyScheduleList = ({ initialTab }: MyScheduleListProps) => {
  const [tab, setTab] = useState<ScheduleTab>(
    isScheduleTab(initialTab) ? initialTab : "UPCOMING",
  );
  const [selectedPostingId, setSelectedPostingId] = useState<number | null>(
    null,
  );

  const { data: assignmentData, isLoading: isAssignmentLoading } =
    useMyAssignmentListQuery(tab === "PAST" ? "PAST" : "UPCOMING");
  const { data: applicationData, isLoading: isApplicationLoading } =
    useMyApplicationListQuery();
  const { data: offerData, isLoading: isOfferLoading } = useMyOfferListQuery();

  const works = assignmentData?.items ?? [];

  /*
    끝난 지원은 신청 탭에 남기지 않는다. 확정된 건은 '예정'에 근무로 서 있고
    (같은 일이 두 곳에 보이면 두 자리인 줄 안다), 취소한 건은 본인이 지운 것이다.
    떨어진 건만 남겨 둔다 — 결과를 봤다는 것이 이 화면에서 확인돼야 한다.
  */
  const applications = useMemo(
    () =>
      (applicationData?.items ?? []).filter(
        (application) =>
          application.status === "PENDING" || application.status === "REJECTED",
      ),
    [applicationData],
  );

  /*
    응답 대기 제안 + 최근에 닫힌 제안. 닫힌 것을 얼마나 남길지는 **서버가 정한다**
    (`GET /my/offers` — 14일). 화면에서 지금 시각으로 거르면 렌더할 때마다 결과가 달라진다.
  */
  const offers = useMemo(() => offerData?.items ?? [], [offerData]);

  const pendingOfferCount = offers.filter((offer) => offer.state === "PENDING").length;

  const isLoading =
    tab === "APPLIED"
      ? isApplicationLoading
      : tab === "OFFERED"
        ? isOfferLoading
        : isAssignmentLoading;
  const isEmpty =
    tab === "APPLIED"
      ? applications.length === 0
      : tab === "OFFERED"
        ? offers.length === 0
        : works.length === 0;

  return (
    <>
      <Tabs
        items={TABS.map((item) =>
          item.value === "APPLIED" && applications.length > 0
            ? { ...item, count: applications.length }
            : item.value === "OFFERED" && pendingOfferCount > 0
              ? { ...item, count: pendingOfferCount }
              : item,
        )}
        value={tab}
        onChange={setTab}
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-card" />
          ))}
        </div>
      ) : isEmpty ? (
        <Card>
          <EmptyState
            title={EMPTY_TEXT[tab].title}
            description={EMPTY_TEXT[tab].description}
          />
        </Card>
      ) : tab === "APPLIED" ? (
        <div className="flex flex-col gap-3">
          {applications.map((application) => (
            <MyApplicationCard
              key={application.applicationId}
              application={application}
              onOpenDetail={setSelectedPostingId}
            />
          ))}
        </div>
      ) : tab === "OFFERED" ? (
        <div className="flex flex-col gap-3">
          {offers.map((offer) => (
            <MyOfferCard key={offer.offerId} offer={offer} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {works.map((work) => (
            <MyWorkCard key={work.assignmentId} work={work} />
          ))}
        </div>
      )}

      {selectedPostingId !== null && (
        <PostingDetailModal
          postingId={selectedPostingId}
          onClose={() => setSelectedPostingId(null)}
        />
      )}
    </>
  );
};

export default MyScheduleList;
