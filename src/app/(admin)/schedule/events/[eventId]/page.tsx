import { Suspense } from "react";
import Skeleton from "@/components/ui/Skeleton";
import EventDetailView from "./_components/EventDetailView";
import PermissionGate from "@/components/domain/PermissionGate";

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>;
}

/**
 * 정적 내보내기(깃허브 페이지)에서는 서버가 없어서 주소를 그때그때 만들 수 없다.
 * 있을 법한 행사 번호만큼 껍데기를 미리 찍어 둔다.
 *
 * 화면에 뿌릴 내용은 어차피 브라우저에서 목업을 불러 채우므로 껍데기는 전부 같고,
 * 목업 행사 38건보다 넉넉히 잡아 시연 중에 새로 만든 행사도 열리게 한다.
 * (목업 배열은 새로고침하면 처음으로 돌아가므로 번호가 계속 늘지는 않는다)
 */
export const generateStaticParams = () =>
  Array.from({ length: 60 }, (_, index) => ({ eventId: String(index + 1) }));

/** 미리 찍어 두지 않은 번호는 404로 보낸다. (정적 내보내기의 요구 사항) */
export const dynamicParams = false;

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
    <PermissionGate required="event:read">
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <EventDetailView eventId={Number(eventId)} />
      </Suspense>
    </PermissionGate>
  );
}
