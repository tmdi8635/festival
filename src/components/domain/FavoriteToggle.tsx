"use client";

import { useStaffMutation } from "@/api/staff/mutateStaff";
import { Star } from "@/icons";
import { cn } from "@/lib/utils";

interface FavoriteToggleProps {
  staffId: number;
  isFavorite: boolean;
  /** 별 크기. 표 안에서는 작게, 상세 헤더에서는 크게 쓴다. */
  size?: number;
  className?: string;
}

/**
 * 즐겨찾기 별 토글.
 *
 * 에이전시는 결국 **부르던 사람을 또 부른다.** 1,500명 중 실제로 쓰는 사람은
 * 훨씬 적고, 그 목록이 대표의 머릿속에만 있으면 담당자를 나눌 수 없다.
 *
 * 그래서 등록하는 동작이 **목록에서 별 한 번 누르는 것**이어야 한다.
 * 상세를 열고 → 버튼을 찾고 → 닫는 세 단계를 거치게 하면, 바쁠 때는
 * 아무도 하지 않아서 목록이 영영 비어 있게 된다.
 *
 * 토글은 여기 한 곳에만 둔다. 화면마다 별을 따로 그리면 어떤 화면에서는
 * 눌리고 어떤 화면에서는 안 눌리는 상태가 된다.
 */
const FavoriteToggle = ({
  staffId,
  isFavorite,
  size = 16,
  className,
}: FavoriteToggleProps) => {
  const { favoriteMutation } = useStaffMutation();

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      disabled={favoriteMutation.isPending}
      onClick={(clickEvent) => {
        // 표의 행 클릭(상세 열기)까지 함께 발동하면 별을 누를 수 없다.
        clickEvent.stopPropagation();
        favoriteMutation.mutate({ staffId, isFavorite: !isFavorite });
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-field p-1 transition",
        "hover:bg-surface-hover active:scale-90 disabled:opacity-50",
        /*
          꺼진 별도 항상 보인다. hover에서만 나타나게 하면
          "여기를 누를 수 있다"는 사실을 아무도 발견하지 못한다.
        */
        isFavorite
          ? "text-warning"
          : "text-font-disabled hover:text-warning",
        className,
      )}
    >
      {/* 켜진 별은 속을 채운다. 색만 바꾸면 작은 크기에서 켜짐/꺼짐이 구분되지 않는다. */}
      <Star size={size} fill={isFavorite ? "currentColor" : "none"} />
    </button>
  );
};

export default FavoriteToggle;
