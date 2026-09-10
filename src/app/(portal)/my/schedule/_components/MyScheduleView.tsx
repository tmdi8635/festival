"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMyAssignmentListQuery } from "@/api/my/getMySchedule";
import { useMyApplicationListQuery } from "@/api/my/getMyRecruit";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Tabs, { type TabItem } from "@/components/ui/Tabs";
import MyWorkCard from "../../../_components/MyWorkCard";
import PostingDetailModal from "../../../_components/PostingDetailModal";
import MyApplicationCard from "./MyApplicationCard";

/**
 * 일정 화면의 탭.
 *
 * '신청'이 여기 있는 이유는, 지원한 자리도 **본인에게는 일정이기 때문**이다.
 * 공고 화면에 두면 "지원한 뒤 확인하려면 공고를 다시 찾아 들어가야" 하고,
 * 그러면 같은 날 두 곳에 지원한 것도 눈치채지 못한다.
 *
 * 순서는 확정될 가능성이 높은 쪽부터다 — 확정(예정) · 대기(신청) · 끝난 것(종료).
 */
type ScheduleTab = "UPCOMING" | "APPLIED" | "PAST";

const TABS: TabItem<ScheduleTab>[] = [
  { label: "예정", value: "UPCOMING" },
  { label: "신청", value: "APPLIED" },
  { label: "종료", value: "PAST" },
];

const isScheduleTab = (value: string | null): value is ScheduleTab =>
  value === "UPCOMING" || value === "APPLIED" || value === "PAST";

/**
 * 내 일정.
 *
 * 탭 상태를 주소에 담지 않는다. 관리자 화면은 행사 상세를 `?tab=`으로 두는데,
 * 그건 담당자끼리 링크를 주고받기 때문이다. 여기서 자기 일정을 남에게
 * 공유할 일은 없고, 주소가 길어지면 오히려 눌러 볼 것이 많아 보인다.
 *
 * 다만 **들어오는 링크는 받는다.** 홈의 "지원 결과가 나왔습니다"가 신청 탭으로
 * 보내야 하는데, 첫 탭에 떨어뜨려 놓으면 결과를 직접 찾아야 한다.
 */
const MyScheduleView = () => {
  const initialTab = useSearchParams().get("tab");
  const [tab, setTab] = useState<ScheduleTab>(
    isScheduleTab(initialTab) ? initialTab : "UPCOMING",
  );
  const [selectedPostingId, setSelectedPostingId] = useState<number | null>(
    null,
  );

  const isApplied = tab === "APPLIED";

  const { data: assignmentData, isLoading: isAssignmentLoading } =
    useMyAssignmentListQuery(tab === "PAST" ? "PAST" : "UPCOMING");
  const { data: applicationData, isLoading: isApplicationLoading } =
    useMyApplicationListQuery();

  const works = assignmentData?.items ?? [];

  /*
    끝난 지원은 신청 탭에 남기지 않는다. 확정된 건은 '예정'에 근무로 서 있고
    (같은 일이 두 곳에 보이면 두 자리인 줄 안다), 취소한 건은 본인이 지운 것이다.
    떨어진 건만 남겨 둔다 — 결과를 봤다는 것이 이 화면에서 확인돼야 한다.
  */
  const applications = (applicationData?.items ?? []).filter(
    (application) =>
      application.status === "PENDING" || application.status === "REJECTED",
  );

  const isLoading = isApplied ? isApplicationLoading : isAssignmentLoading;
  const isEmpty = isApplied ? applications.length === 0 : works.length === 0;

  const emptyText: Record<ScheduleTab, { title: string; description: string }> =
    {
      UPCOMING: {
        title: "예정된 근무가 없습니다.",
        description: "공고에서 원하는 자리에 지원해 보세요.",
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

  return (
    <>
      <Tabs
        items={TABS.map((item) =>
          item.value === "APPLIED" && applications.length > 0
            ? { ...item, count: applications.length }
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
            title={emptyText[tab].title}
            description={emptyText[tab].description}
          />
        </Card>
      ) : isApplied ? (
        <div className="flex flex-col gap-3">
          {applications.map((application) => (
            <MyApplicationCard
              key={application.applicationId}
              application={application}
              onOpenDetail={setSelectedPostingId}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {works.map((work) => (
            <MyWorkCard
              key={work.assignmentId}
              work={work}
              isUpcoming={tab === "UPCOMING"}
            />
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

export default MyScheduleView;
