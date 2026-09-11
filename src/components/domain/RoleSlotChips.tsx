"use client";

import { useMemo } from "react";
import {
  FILL_STATE_CHIP_CLASS,
  FILL_STATE_TEXT_CLASS,
} from "@/constants/eventOptions";
import { useJobRoleComparator, useJobRoleLabel } from "@/store/useOrgStore";
import {
  GENDER_PREFERENCE_BADGE,
  GENDER_PREFERENCE_LABEL,
  comparePositionOrder,
  findPosition,
  formatPositionLabel,
  resolveFillState,
  type EventPosition,
  type EventRoleSlot,
} from "@/type/event";
import { cn } from "@/lib/utils";

interface RoleSlotChipsProps {
  roles: EventRoleSlot[];
  /**
   * 행사의 포지션. 넘기면 칩에 **포지션 이름**을 적고 포지션 순서로 세운다.
   *
   * 같은 스태프라도 A타임 · B타임은 다른 자리다. 직무 이름만 적으면
   * `스태프 5/5` `스태프 0/3` 두 칩이 나란히 서서 어느 쪽이 비었는지 알 수 없다.
   */
  positions?: readonly EventPosition[];
  /** 캘린더 칸처럼 좁은 곳에서는 글자와 여백을 줄인다. */
  isCompact?: boolean;
  className?: string;
}

/**
 * 포지션별 충원 현황 칩.
 *
 * `팀장 0/1` `A타임 5/10` 형태로, 확정 인원이 발주 인원에 못 미치면
 * 색으로 먼저 눈에 띈다. 캘린더 · 행사 목록 · 행사 상세가 모두 이 컴포넌트를 쓴다.
 *
 * 나열 순서는 포지션이 있으면 **포지션 순서**(= 등록한 순서), 없으면 기준 설정의 직무 순서다.
 * 넘겨받은 배열 순서를 믿지 않는다. 날마다 칩 자리가 바뀌면 눈이 매번 다시 찾아야 한다.
 */
const RoleSlotChips = ({
  roles,
  positions,
  isCompact = false,
  className,
}: RoleSlotChipsProps) => {
  const jobRoleLabel = useJobRoleLabel();
  const compareRoles = useJobRoleComparator();

  const sortedRoles = useMemo(
    () =>
      [...roles].sort(
        positions
          ? comparePositionOrder(positions)
          : (a, b) => compareRoles(a.role, b.role),
      ),
    [roles, positions, compareRoles],
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {sortedRoles.map((slot) => {
        const fillState = resolveFillState(
          slot.assignedCount,
          slot.requiredCount,
        );
        const position = positions
          ? findPosition({ positions }, slot.positionId)
          : undefined;
        /* 칩은 좁아서 이름만 적는다. 직무 · 조건은 말풍선에서 본다. */
        const label = position?.name ?? jobRoleLabel(slot.role);
        const genderPreference = position?.genderPreference ?? "ANY";

        return (
          <span
            key={slot.positionId}
            title={[
              position
                ? formatPositionLabel(position, jobRoleLabel)
                : jobRoleLabel(slot.role),
              `${slot.assignedCount}/${slot.requiredCount}명`,
              genderPreference !== "ANY"
                ? GENDER_PREFERENCE_LABEL[genderPreference]
                : "",
              position?.requiresHealthCert ? "보건증 필요" : "",
            ]
              .filter(Boolean)
              .join(" · ")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap tabular-nums",
              FILL_STATE_CHIP_CLASS[fillState],
              FILL_STATE_TEXT_CLASS[fillState],
              !isCompact && "px-2 py-1 text-[12px]",
            )}
          >
            {label}
            <span>
              {slot.assignedCount}/{slot.requiredCount}
            </span>

            {/*
              성별 조건은 **있을 때만** 적는다. '무관'까지 그리면 거의 모든 칩에
              같은 글자가 붙어, 정작 조건이 걸린 자리가 눈에 띄지 않는다.
              강제하는 값이 아니므로 경고색을 쓰지 않는다.
            */}
            {genderPreference !== "ANY" && (
              <span className="text-font-2">
                {GENDER_PREFERENCE_BADGE[genderPreference]}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};

export default RoleSlotChips;
