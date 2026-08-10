"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentAdminQuery } from "@/api/ops/getCurrentAdmin";
import { useManagerListQuery } from "@/api/ops/getManagerList";
import { Users } from "@/icons";
import { cn } from "@/lib/utils";
import { useAdminStore } from "@/store/useAdminStore";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import IconButton from "@/components/ui/IconButton";

/**
 * 담당자 전환 — **테스트용**.
 *
 * 로그인이 아직 없어서, 권한을 나눠 놓아도 그 효과를 볼 방법이 없다.
 * 직책별로 화면이 어떻게 달라지는지 직접 확인할 수 있어야
 * "이 직책에 이 권한을 줘도 되는가"를 판단할 수 있다.
 *
 * 로그인이 붙으면 이 컴포넌트를 헤더에서 빼면 된다.
 * 권한 판정은 `useAdminStore`가 하고 있어서 나머지 코드는 이걸 모른다.
 */
const AdminAccountSwitcher = () => {
  const queryClient = useQueryClient();
  const { admin, setAdmin } = useAdminStore();
  const [isOpen, setIsOpen] = useState(false);

  /* 목록 조회는 `admin:read`가 없으면 스스로 나가지 않는다. (`usePermittedQuery`) */
  const { data: managerData } = useManagerListQuery({ keyword: "" });
  /* 서버가 내려 준 권한으로 스토어를 채운다. 화면이 직접 만들지 않는다. */
  const { data: profile } = useCurrentAdminQuery();

  useEffect(() => {
    if (profile) setAdmin(profile);
  }, [profile, setAdmin]);

  const managers = (managerData?.items ?? []).filter(
    (manager) => manager.isActive,
  );

  /*
    담당자가 바뀌면 받아 둔 자료를 되돌린다.

    **버튼을 누른 자리가 아니라 효과에서 한다.** 누른 자리에서 바로 되돌리면
    React가 아직 다시 그리기 전이라, 조회들은 이전 담당자 기준의 `enabled`를 들고 있다.
    그 상태로 다시 받으면 **새 담당자에게는 없는 권한으로 요청이 한 번 더 나가고**,
    그게 거부되어 전환하자마자 거부 안내가 뜬다. 누른 적 없는 일에 대한 거부다.
    (운영 로그를 보던 중 조회 전용으로 바꾸면 '운영 로그 > 조회' 거부가 떴다)

    효과는 다시 그린 뒤에 돈다. 그때는 볼 수 없게 된 조회가 이미 꺼져 있어 나가지 않는다.

    `clear()`가 아니라 `resetQueries()`인 이유도 있다. `clear()`는 캐시를 비우기만 해서,
    담당자 스토어를 구독하지 않는 화면은 다시 그려지지 않고 **이전 담당자의 자료를
    그대로 띄운 채로 남는다.** 실제로 조회 전용으로 바꾼 뒤에도 미지급 정산액이 남아 있었다.
  */
  const switchedTo = admin?.managerId;

  useEffect(() => {
    if (switchedTo === undefined) return;

    /*
      담당자 목록만 남긴다. 이 목록이 없으면 **다시 돌아올 수 없다.**
      `admin:read`가 없는 담당자로 바꾸면 목록 조회가 꺼지므로,
      캐시를 지워 버리면 전환 창이 빈 채로 남는다. (실제로 그렇게 갇혔다)
      남겨도 새는 자료가 없다 — 이 창에 쓰는 이름과 직책뿐이고,
      로그인이 붙으면 이 컴포넌트가 통째로 빠진다.
    */
    void queryClient.resetQueries({
      predicate: (query) => query.queryKey[0] !== "get-manager-list",
    });
  }, [switchedTo, queryClient]);

  const handleSwitch = (managerId: number) => {
    setAdmin(
      admin ? { ...admin, managerId, permissions: [], isSuperAdmin: false } : null,
    );
    setIsOpen(false);
  };

  return (
    <>
      <IconButton
        label="담당자 전환 (테스트)"
        icon={<Users size={18} />}
        onClick={() => setIsOpen(true)}
      />

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="담당자 전환"
        description="로그인이 붙기 전까지 권한을 확인하기 위한 테스트 기능입니다."
        size="md"
      >
        <ul className="flex flex-col gap-1.5">
          {managers.map((manager) => {
            const isCurrent = manager.managerId === admin?.managerId;

            return (
              <li key={manager.managerId}>
                <button
                  type="button"
                  onClick={() => handleSwitch(manager.managerId)}
                  className={cn(
                    "flex w-full flex-wrap items-center gap-2 rounded-field border px-4 py-3 text-left transition",
                    isCurrent
                      ? "border-brand bg-surface-selected"
                      : "border-border-main hover:border-brand hover:bg-surface-hover",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-opacity text-[13px] font-semibold text-brand">
                    {manager.name.slice(0, 1)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-font-1">
                      {manager.name}
                    </span>
                    <span className="block truncate text-[12px] text-font-2">
                      {manager.email}
                    </span>
                  </span>

                  <Badge tone={manager.isSuperAdmin ? "brand" : "neutral"}>
                    {manager.roleName}
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

export default AdminAccountSwitcher;
