"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, ListLines } from "@/icons";
import { cn } from "@/lib/utils";
import MyScheduleCalendar from "./MyScheduleCalendar";
import MyScheduleList from "./MyScheduleList";

type ScheduleViewMode = "CALENDAR" | "LIST";

const VIEW_OPTIONS: {
  value: ScheduleViewMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "CALENDAR", label: "캘린더", icon: <Calendar size={16} /> },
  { value: "LIST", label: "리스트", icon: <ListLines size={16} /> },
];

/**
 * 내 일정 — **캘린더가 기본이다.**
 *
 * 리스트만 있을 때는 "이번 달에 며칠 나가나", "주말이 비었나"를 알려면 카드를
 * 끝까지 내려 보며 머릿속으로 달력을 그려야 했다. 달력은 그걸 한 장으로 답한다.
 * 다만 다음 근무 몇 건을 차례로 훑는 데는 리스트가 낫기 때문에 둘 다 둔다.
 *
 * 보기 방식은 **주소에 남긴다** (`?view=list`). 리스트로 바꿔 두고 근무 카드에서
 * 전화를 걸고 돌아오면, 다시 캘린더로 떨어져 있으면 안 된다.
 * 홈의 "지원 결과가 나왔습니다"처럼 `?tab=`으로 들어오는 링크는 리스트의 그 탭을 연다.
 */
const MyScheduleView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const viewParam = searchParams.get("view");
  /*
    직접 고른 보기가 먼저다. `?tab=`은 "리스트의 그 탭을 열어라"는 뜻이지만,
    거기서 캘린더를 누른 사람에게 탭을 이유로 리스트를 다시 씌우면 토글이 먹지 않는다.
  */
  const mode: ScheduleViewMode =
    viewParam === "list"
      ? "LIST"
      : viewParam === "calendar"
        ? "CALENDAR"
        : tabParam !== null
          ? "LIST"
          : "CALENDAR";

  const handleModeChange = (next: ScheduleViewMode) => {
    if (next === mode) return;

    /*
      보던 탭은 그대로 들고 다닌다. `?tab=APPLIED`로 들어와 캘린더를 한 번 봤다고
      해서 신청 탭이 사라지면, 돌아온 사람은 자기가 보던 자리를 다시 찾아야 한다.
    */
    const params = new URLSearchParams();

    params.set("view", next === "LIST" ? "list" : "calendar");
    if (tabParam) params.set("tab", tabParam);

    router.replace(`/my/schedule?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <div
        role="tablist"
        aria-label="일정 보기 방식"
        className="grid grid-cols-2 gap-1 rounded-field bg-subtle p-1"
      >
        {VIEW_OPTIONS.map((option) => {
          const isActive = option.value === mode;

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleModeChange(option.value)}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-field text-[14px] transition",
                isActive
                  ? "bg-surface font-semibold text-brand shadow-card"
                  : "text-font-2 hover:text-font-1",
              )}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>

      {mode === "CALENDAR" ? (
        <MyScheduleCalendar />
      ) : (
        <MyScheduleList initialTab={tabParam} />
      )}
    </>
  );
};

export default MyScheduleView;
