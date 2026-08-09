"use client";

import {
  FILL_STATE_CHIP_CLASS,
  FILL_STATE_TEXT_CLASS,
} from "@/constants/eventOptions";
import {
  useJobRoleComparator,
  useJobRoleLabel,
  useJobRoleShortLabel,
} from "@/store/useOrgStore";
import { resolveFillState, type EventRoleSlot } from "@/type/event";
import { cn } from "@/lib/utils";

interface RoleSlotChipsProps {
  roles: EventRoleSlot[];
  /**
   * 캘린더 칸처럼 좁은 곳에서 쓰는 축약 표기.
   *
   * 예전에는 `SV` `ST` `MD` 같은 영문 이니셜을 썼는데,
   * 현장 담당자가 매번 무슨 뜻인지 되물었다. 축약도 한글로 둔다.
   */
  isCompact?: boolean;
  className?: string;
}

/**
 * 직무별 충원 현황 칩.
 *
 * `팀장 0/1` `스태프 5/10` 형태로, 확정 인원이 발주 인원에 못 미치면
 * 색으로 먼저 눈에 띈다. 캘린더 · 행사 목록 · 행사 상세가 모두 이 컴포넌트를 쓴다.
 *
 * 나열 순서는 **기준 설정에서 정한 직무 순서**다. 넘겨받은 배열 순서를 믿지 않는다.
 * 발주 슬롯은 행사마다 만들어진 순서가 제각각이라, 그대로 그리면 같은 직무가
 * 화면마다 다른 자리에 나타나 눈이 매번 다시 찾아야 한다.
 */
const RoleSlotChips = ({
  roles,
  isCompact = false,
  className,
}: RoleSlotChipsProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const jobRoleShortLabel = useJobRoleShortLabel();
  const compareRoles = useJobRoleComparator();

  const sortedRoles = [...roles].sort((a, b) => compareRoles(a.role, b.role));

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {sortedRoles.map((slot) => {
        const fillState = resolveFillState(
          slot.assignedCount,
          slot.requiredCount,
        );

        return (
          <span
            key={slot.role}
            title={`${jobRoleLabel(slot.role)} ${slot.assignedCount}/${slot.requiredCount}명`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap tabular-nums",
              FILL_STATE_CHIP_CLASS[fillState],
              FILL_STATE_TEXT_CLASS[fillState],
              !isCompact && "px-2 py-1 text-[12px]",
            )}
          >
            {isCompact ? jobRoleShortLabel(slot.role) : jobRoleLabel(slot.role)}
            <span>
              {slot.assignedCount}/{slot.requiredCount}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export default RoleSlotChips;
