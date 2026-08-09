"use client";

import { useState } from "react";

/**
 * 체크박스로 여러 건을 골라 일괄 처리하는 목록의 선택 상태.
 *
 * 배치 · 계약서 · 정산은 전부 "표에서 여러 건을 골라 한 번에 처리"하는 화면이고,
 * 여섯 곳이 같은 토글 · 전체선택 로직을 각자 다시 쓰고 있었다.
 * 같은 코드를 여섯 번 쓰면 여섯 번 다 고쳐야 하는데, 실제로는 늘 몇 곳이 빠진다.
 *
 * `isAllSelected`가 "현재 보이는 행 기준"인 것이 중요하다.
 * 필터를 걸어 3건만 보이는데 전체 선택이 꺼져 보이면 담당자는 다시 누르고,
 * 그 순간 화면 밖의 건까지 처리된다. **선택은 눈에 보이는 것만 따른다.**
 *
 * 필터를 바꿀 때는 `clear()`를 함께 부른다. 걸러져 사라진 행이 선택에 남아 있으면
 * "3건 선택"이라 적힌 채로 화면에 없는 건이 처리된다.
 */
export const useSelection = (visibleIds: number[]) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const isAllSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const isSelected = (id: number) => selectedIds.includes(id);

  const toggle = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );

  /** 보이는 행 전체를 켜고 끈다. */
  const toggleAll = () => setSelectedIds(isAllSelected ? [] : visibleIds);

  /**
   * 묶음 하나를 통째로 켜고 끈다.
   * 사흘 나온 사람을 세 번 눌러야 할 이유가 없다.
   */
  const toggleMany = (ids: number[]) => {
    const isGroupSelected = ids.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) =>
      isGroupSelected
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])],
    );
  };

  const areAllSelected = (ids: number[]) =>
    ids.length > 0 && ids.every((id) => selectedIds.includes(id));

  const clear = () => setSelectedIds([]);

  return {
    selectedIds,
    setSelectedIds,
    isAllSelected,
    isSelected,
    areAllSelected,
    toggle,
    toggleAll,
    toggleMany,
    clear,
  };
};
