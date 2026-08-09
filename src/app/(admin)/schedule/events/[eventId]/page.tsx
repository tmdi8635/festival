import { Suspense } from "react";
import Skeleton from "@/components/ui/Skeleton";
import EventDetailView from "./_components/EventDetailView";

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>;
}

/**
 * 행사 상세.
 *
 * 모달이 아니라 페이지인 이유는 이 화면이 곧 "행사 하나를 끝내는 자리"이기 때문이다.
 * 일자별 근무자 · 출퇴근 명부 · 근로계약서 · 정산이 모두 행사 단위로 묶여 있어야
 * 담당자가 메뉴를 옮겨 다니며 같은 행사를 다시 찾는 일이 없다.
 * (제목 · 상태 · 액션이 모두 데이터에 따라 달라지므로 헤더까지 뷰가 그린다)
 */
export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params;

  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
      <EventDetailView eventId={Number(eventId)} />
    </Suspense>
  );
}
