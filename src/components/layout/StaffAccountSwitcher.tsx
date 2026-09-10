"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMyAccountListQuery } from "@/api/my/getMyProfile";
import { Users } from "@/icons";
import { cn } from "@/lib/utils";
import { useStaffSessionStore } from "@/store/useStaffSessionStore";
import { DOCUMENT_REVIEW_STATE_LABEL } from "@/type/staff";
import { DOCUMENT_REVIEW_STATE_TONE } from "@/constants/staffOptions";
import Badge from "@/components/ui/Badge";
import IconButton from "@/components/ui/IconButton";
import Modal from "@/components/ui/Modal";

/**
 * 스태프 전환 — **테스트용**.
 *
 * 로그인이 아직 없어서, 서류 심사 상태별로 이 화면이 무엇을 말하는지 볼 방법이 없다.
 * 아직 안 낸 사람 · 반려된 사람 · 승인된 사람으로 갈아 끼워 봐야
 * "이 안내가 그 사람에게 실제로 도움이 되는가"를 판단할 수 있다.
 *
 * 로그인이 붙으면 이 컴포넌트를 헤더에서 빼면 된다.
 * 신원은 `useStaffSessionStore`가 갖고 있어서 나머지 코드는 이걸 모른다.
 * (관리자 쪽 `AdminAccountSwitcher`와 같은 구조다)
 */
const StaffAccountSwitcher = () => {
  const queryClient = useQueryClient();
  const { staffId, setStaffId } = useStaffSessionStore();
  const [isOpen, setIsOpen] = useState(false);

  const { data } = useMyAccountListQuery();
  const accounts = data?.items ?? [];
  const current = accounts.find((account) => account.staffId === staffId);

  /*
    사람이 바뀌면 받아 둔 자료를 되돌린다.

    **버튼을 누른 자리가 아니라 효과에서 한다.** 누른 자리에서 바로 되돌리면
    React가 아직 다시 그리기 전이라 이전 신원 기준의 조회가 한 번 더 나가고,
    그 응답이 새 사람의 화면에 그려진다. (관리자 전환기에서 실제로 겪은 문제다)

    계정 목록만 남긴다. 이 목록이 없으면 다른 사람으로 돌아갈 수 없다.
  */
  const previousStaffId = useRef(staffId);

  useEffect(() => {
    /*
      처음 뜰 때는 되돌릴 것이 없다. 막지 않으면 첫 화면이 모든 조회를
      두 번씩 내보내고, 그동안 화면은 빈 칸으로 남는다.
    */
    if (previousStaffId.current === staffId) return;

    previousStaffId.current = staffId;

    void queryClient.resetQueries({
      predicate: (query) => query.queryKey[0] !== "get-my-accounts",
    });
  }, [staffId, queryClient]);

  const handleSwitch = (nextStaffId: number) => {
    setStaffId(nextStaffId);
    setIsOpen(false);
  };

  return (
    <>
      <IconButton
        size="lg"
        label="스태프 전환 (테스트)"
        icon={<Users size={18} />}
        onClick={() => setIsOpen(true)}
      />

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="스태프 전환"
        description="로그인이 붙기 전까지, 서류 상태별로 화면을 확인하기 위한 테스트 기능입니다."
        size="md"
      >
        <ul className="flex flex-col gap-1.5">
          {accounts.map((account) => {
            const isCurrent = account.staffId === current?.staffId;

            return (
              <li key={account.staffId}>
                <button
                  type="button"
                  onClick={() => handleSwitch(account.staffId)}
                  className={cn(
                    "flex w-full flex-wrap items-center gap-2 rounded-field border px-4 py-3 text-left transition",
                    isCurrent
                      ? "border-brand bg-surface-selected"
                      : "border-border-main hover:border-brand hover:bg-surface-hover",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-opacity text-[13px] font-semibold text-brand">
                    {account.name.slice(0, 1)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-font-1">
                      {account.name}
                    </span>
                    <span className="block truncate text-[12px] text-font-2">
                      누적 근무 {account.workCount}회
                    </span>
                  </span>

                  {/* 무엇을 확인하려고 고르는지가 이 배지다. */}
                  <Badge
                    tone={DOCUMENT_REVIEW_STATE_TONE[account.documentReviewState]}
                  >
                    서류 {DOCUMENT_REVIEW_STATE_LABEL[account.documentReviewState]}
                  </Badge>

                  {isCurrent && <Badge tone="success">현재</Badge>}
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
};

export default StaffAccountSwitcher;
