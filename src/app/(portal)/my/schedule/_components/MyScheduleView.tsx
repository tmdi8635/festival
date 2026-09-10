"use client";

import { useState } from "react";
import {
  useMyAssignmentListQuery,
  type MyScheduleScope,
} from "@/api/my/getMySchedule";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Tabs, { type TabItem } from "@/components/ui/Tabs";
import MyWorkCard from "../../../_components/MyWorkCard";

const SCOPE_TABS: TabItem<MyScheduleScope>[] = [
  { label: "예정", value: "UPCOMING" },
  { label: "종료", value: "PAST" },
];

/**
 * 내 일정.
 *
 * 탭 상태를 주소에 담지 않는다. 관리자 화면은 행사 상세를 `?tab=`으로 두는데,
 * 그건 담당자끼리 링크를 주고받기 때문이다. 여기서 자기 일정을 남에게
 * 공유할 일은 없고, 주소가 길어지면 오히려 눌러 볼 것이 많아 보인다.
 */
const MyScheduleView = () => {
  const [scope, setScope] = useState<MyScheduleScope>("UPCOMING");
  const { data, isLoading } = useMyAssignmentListQuery(scope);

  const works = data?.items ?? [];
  const isUpcoming = scope === "UPCOMING";

  return (
    <>
      <Tabs items={SCOPE_TABS} value={scope} onChange={setScope} />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-card" />
          ))}
        </div>
      ) : works.length === 0 ? (
        <Card>
          <EmptyState
            title={
              isUpcoming ? "예정된 근무가 없습니다." : "지난 근무가 없습니다."
            }
            description={
              isUpcoming
                ? "공고에서 원하는 자리에 지원해 보세요."
                : "근무가 끝나면 여기에 쌓입니다."
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {works.map((work) => (
            <MyWorkCard
              key={work.assignmentId}
              work={work}
              isUpcoming={isUpcoming}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default MyScheduleView;
