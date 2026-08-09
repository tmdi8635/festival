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

  const { data: managerData } = useManagerListQuery({ keyword: "" });
  /* 서버가 내려 준 권한으로 스토어를 채운다. 화면이 직접 만들지 않는다. */
  const { data: profile } = useCurrentAdminQuery();

  useEffect(() => {
    if (profile) setAdmin(profile);
  }, [profile, setAdmin]);

  const managers = (managerData?.items ?? []).filter(
    (manager) => manager.isActive,
  );

  const handleSwitch = (managerId: number) => {
    /*
      먼저 스토어의 담당자를 바꾸고(요청 헤더가 바뀐다) 캐시를 통째로 비운다.
      비우지 않으면 이전 담당자 권한으로 받아 둔 목록이 그대로 남아,
      바뀐 사람에게 보이면 안 되는 자료가 화면에 남는다.
    */
    setAdmin(
      admin ? { ...admin, managerId, permissions: [], isSuperAdmin: false } : null,
    );
    queryClient.clear();
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
