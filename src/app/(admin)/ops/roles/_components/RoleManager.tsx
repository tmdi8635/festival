"use client";

import { useState } from "react";
import { useAdminRoleListQuery } from "@/api/ops/getAdminRoleList";
import { useAdminRoleMutation } from "@/api/ops/mutateAdminRole";
import { Plus, ShieldCheck, Trash, Users } from "@/icons";
import { showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import { useHasPermission } from "@/store/useAdminStore";
import type { AdminRole } from "@/type/ops";
import {
  ALL_PERMISSIONS,
  PERMISSION_ACTION_HINT,
  PERMISSION_ACTION_LABEL,
  PERMISSION_RESOURCES,
  normalizePermissions,
  permissionKey,
  type PermissionAction,
  type PermissionKey,
  type PermissionResource,
} from "@/type/permission";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import Textarea from "@/components/ui/Textarea";
import { PermissionDenied } from "@/components/domain/PermissionGate";

const RESOURCE_KEYS = Object.keys(
  PERMISSION_RESOURCES,
) as PermissionResource[];

/**
 * 직책 · 권한 설정.
 *
 * **권한은 사람이 아니라 직책이 갖는다.** 담당자는 직책에 들어갈 뿐이다.
 * 사람마다 권한을 주면 담당자가 열 명일 때 설정도 열 번, 점검도 열 번이고,
 * 규칙이 바뀌면 열 곳을 고쳐야 한다. 한 곳만 빠뜨리면 그 사람만 조용히 다른 권한을 갖는다.
 *
 * "정산을 승인할 수 있는 사람이 누구인가"를 물었을 때
 * 직책이면 하나만 열어 보면 되고, 사람마다면 전원을 훑어야 한다.
 */
const RoleManager = () => {
  const canRead = useHasPermission("role:read");
  const canWrite = useHasPermission("role:write");
  const canDelete = useHasPermission("role:delete");

  const { data, isLoading } = useAdminRoleListQuery();
  const { createMutation, updateMutation, deleteMutation } =
    useAdminRoleMutation();

  const roles = data?.items ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /** 편집 전에는 서버 값을 그대로 쓰고, 손대면 draft가 화면을 담당한다. (가이드 7장) */
  const [draft, setDraft] = useState<AdminRole | null>(null);

  const selected =
    roles.find((role) => role.roleId === (selectedId ?? roles[0]?.roleId)) ??
    null;
  const editing = draft ?? selected;
  const isDirty = draft !== null;

  const patch = (next: Partial<AdminRole>) =>
    editing && setDraft({ ...editing, ...next });

  const togglePermission = (
    resource: PermissionResource,
    action: PermissionAction,
  ) => {
    if (!editing) return;

    const key = permissionKey(resource, action);
    const has = editing.permissions.includes(key);

    /*
      끌 때는 `read`를 끄면 그 자료의 나머지도 함께 꺼진다.
      볼 수 없는데 고칠 수 있는 상태는 뜻이 없고, 그대로 두면
      화면은 막혔는데 API는 열린 어정쩡한 직책이 만들어진다.
    */
    const next = has
      ? editing.permissions.filter((item) =>
          action === "read" ? !item.startsWith(`${resource}:`) : item !== key,
        )
      : normalizePermissions([...editing.permissions, key]);

    patch({ permissions: next });
  };

  const toggleResource = (resource: PermissionResource) => {
    if (!editing) return;

    const all = PERMISSION_RESOURCES[resource].actions.map((action) =>
      permissionKey(resource, action),
    );
    const hasAll = all.every((key) => editing.permissions.includes(key));

    patch({
      permissions: hasAll
        ? editing.permissions.filter((key) => !all.includes(key))
        : normalizePermissions([...editing.permissions, ...all]),
    });
  };

  const handleSave = async () => {
    if (!editing) return;

    try {
      await updateMutation.mutateAsync({
        roleId: editing.roleId,
        body: {
          name: editing.name,
          description: editing.description,
          permissions: editing.permissions,
        },
      });
      setDraft(null);
    } catch (error) {
      showErrorToast(error);
    }
  };

  const handleCreate = async () => {
    try {
      const created = await createMutation.mutateAsync({
        name: `새 직책 ${roles.length}`,
        description: "",
        permissions: ["event:read"],
      });

      setSelectedId(created.roleId);
      setDraft(null);
    } catch (error) {
      showErrorToast(error);
    }
  };

  const handleDelete = (role: AdminRole) =>
    openConfirm({
      title: `'${role.name}' 직책을 삭제할까요?`,
      description: "이 직책에 속한 담당자가 없어야 지울 수 있습니다.",
      warning: "삭제한 직책은 되돌릴 수 없습니다.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: () =>
        deleteMutation
          .mutateAsync(role.roleId)
          .then(() => {
            setSelectedId(null);
            setDraft(null);
          })
          .catch(showErrorToast),
    });

  if (!canRead) {
    return <PermissionDenied required="role:read" />;
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-card" />;
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* ------------------------------ 직책 목록 ----------------------------- */}
      <Card
        noPadding
        className="w-full lg:w-72 lg:shrink-0"
        title="직책"
        action={
          canWrite && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus size={14} />}
              isLoading={createMutation.isPending}
              onClick={handleCreate}
            >
              추가
            </Button>
          )
        }
      >
        <ul className="flex flex-col">
          {roles.map((role) => {
            const isActive = role.roleId === editing?.roleId;

            return (
              <li key={role.roleId}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(role.roleId);
                    setDraft(null);
                  }}
                  className={cn(
                    "flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition",
                    isActive
                      ? "border-brand bg-surface-selected"
                      : "border-transparent hover:bg-surface-hover",
                  )}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "text-[14px] font-medium",
                        isActive ? "text-brand" : "text-font-1",
                      )}
                    >
                      {role.name}
                    </span>
                    {role.isSuperAdmin && (
                      <Badge tone="brand" leftIcon={<ShieldCheck size={11} />}>
                        전권
                      </Badge>
                    )}
                  </span>

                  <span className="flex items-center gap-1 text-[12px] text-font-2 tabular-nums">
                    <Users size={12} />
                    {role.memberCount}명 ·{" "}
                    {role.isSuperAdmin
                      ? "모든 권한"
                      : `권한 ${role.permissions.length}개`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ----------------------------- 권한 편집 ----------------------------- */}
      {!editing ? (
        <Card className="flex-1">
          <EmptyState
            title="직책을 선택하세요."
            description="왼쪽에서 직책을 고르면 권한을 볼 수 있습니다."
          />
        </Card>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card
            title={editing.name}
            description={editing.isSuperAdmin ? undefined : "이 직책이 할 수 있는 일을 정합니다."}
            action={
              !editing.isSuperAdmin &&
              canWrite && (
                <div className="flex flex-wrap items-center gap-2">
                  {isDirty && (
                    <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                      되돌리기
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!isDirty}
                    isLoading={updateMutation.isPending}
                    onClick={handleSave}
                  >
                    저장
                  </Button>
                  {canDelete && (
                    <Button
                      variant="dangerGhost"
                      size="sm"
                      leftIcon={<Trash size={14} />}
                      onClick={() => handleDelete(editing)}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              )
            }
          >
            {editing.isSuperAdmin ? (
              /*
                최고관리자는 잠근다. 권한을 뺄 수 있으면 실수 한 번으로
                "권한을 되돌릴 수 있는 사람이 아무도 없는" 상태가 만들어지고,
                그때는 코드를 고치는 것 말고 방법이 없다.
              */
              <Alert tone="info" title="최고관리자는 모든 권한을 갖습니다.">
                이 직책은 바꾸거나 지울 수 없습니다. 하나는 잠겨 있어야 권한을
                되돌릴 사람이 남습니다.
              </Alert>
            ) : (
              <div className="flex flex-col gap-3">
                <Input
                  aria-label="직책 이름"
                  value={editing.name}
                  disabled={!canWrite}
                  onChange={(event) => patch({ name: event.target.value })}
                />
                <Textarea
                  aria-label="직책 설명"
                  rows={2}
                  value={editing.description}
                  disabled={!canWrite}
                  placeholder="이 직책이 무슨 일을 하는지 적어 두면 담당자를 배정할 때 헷갈리지 않습니다."
                  onChange={(event) =>
                    patch({ description: event.target.value })
                  }
                />
              </div>
            )}
          </Card>

          {!editing.isSuperAdmin && (
            <Card noPadding title="권한">
              {/*
                자료(행) × 행위(열)로 놓는다. 목록으로 늘어놓으면
                "이 직책이 정산에 대해 무엇을 할 수 있나"를 보려고 전체를 훑어야 한다.
              */}
              <div className="overflow-x-auto scrollbar-thin">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[minmax(0,1fr)_repeat(6,72px)] items-center gap-2 border-b border-border-main bg-subtle px-4 py-2.5 text-[12px] font-medium text-font-2">
                    <span>자료</span>
                    {(
                      [
                        "read",
                        "write",
                        "delete",
                        "approve",
                        "pay",
                        "send",
                      ] as PermissionAction[]
                    ).map((action) => (
                      <span
                        key={action}
                        className="text-center"
                        title={PERMISSION_ACTION_HINT[action]}
                      >
                        {PERMISSION_ACTION_LABEL[action]}
                      </span>
                    ))}
                  </div>

                  <ul className="divide-y divide-border-main">
                    {RESOURCE_KEYS.map((resource) => {
                      const def = PERMISSION_RESOURCES[resource];
                      const granted = def.actions.filter((action) =>
                        editing.permissions.includes(
                          permissionKey(resource, action),
                        ),
                      );

                      return (
                        <li
                          key={resource}
                          className="grid grid-cols-[minmax(0,1fr)_repeat(6,72px)] items-center gap-2 px-4 py-2.5"
                        >
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => toggleResource(resource)}
                            className="min-w-0 text-left transition hover:opacity-70 disabled:cursor-not-allowed"
                            title="이 자료의 권한을 한 번에 켜고 끕니다."
                          >
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[13px] font-medium text-font-1">
                                {def.label}
                              </span>
                              {/* 개인정보 · 금전은 좁게 열어야 하는 자료라 표시해 둔다. */}
                              {def.isSensitive && (
                                <Badge tone="warning">민감</Badge>
                              )}
                            </span>
                            <span className="block truncate text-[12px] text-font-2">
                              {def.description}
                            </span>
                          </button>

                          {(
                            [
                              "read",
                              "write",
                              "delete",
                              "approve",
                              "pay",
                              "send",
                            ] as PermissionAction[]
                          ).map((action) => {
                            const supported = def.actions.includes(action);

                            return (
                              <span
                                key={action}
                                className="flex items-center justify-center"
                              >
                                {supported ? (
                                  <Checkbox
                                    aria-label={`${def.label} ${PERMISSION_ACTION_LABEL[action]}`}
                                    disabled={!canWrite}
                                    checked={granted.includes(action)}
                                    onChange={() =>
                                      togglePermission(resource, action)
                                    }
                                  />
                                ) : (
                                  /* 그 자료에 없는 행위는 빈칸이 아니라 선으로 둔다. 꺼진 것과 구분돼야 한다. */
                                  <span className="text-font-disabled">–</span>
                                )}
                              </span>
                            );
                          })}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border-main px-4 py-3 text-[12px] text-font-2">
                <span className="tabular-nums">
                  {editing.permissions.length} / {ALL_PERMISSIONS.length}개 권한
                </span>
                <span>
                  · &lsquo;등록 · 수정&rsquo;을 켜면 &lsquo;조회&rsquo;도 함께
                  켜집니다. 볼 수 없는데 고칠 수 있는 상태는 뜻이 없습니다.
                </span>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default RoleManager;
