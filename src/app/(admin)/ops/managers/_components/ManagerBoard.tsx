"use client";

import { useState } from "react";
import { useManagerListQuery } from "@/api/ops/getManagerList";
import { useManagerMutation } from "@/api/ops/mutateManager";
import { Edit, Plus, Trash } from "@/icons";
import { formatDateTime } from "@/lib/dayjs";
import { showErrorToast } from "@/lib/toast";
import { openConfirm } from "@/store/useConfirmStore";
import {
  type Manager,
} from "@/type/ops";
import { formatPhoneNumber } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SearchInput from "@/components/ui/SearchInput";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import ManagerFormModal from "./ManagerFormModal";

/**
 * 담당자 관리.
 *
 * 이 시스템의 목적 자체가 "대표 한 사람에게 몰린 일을 나누는 것"이다.
 * 매니저 계정을 만들고 권한을 나누는 것이 그 첫 단계다.
 */
const ManagerBoard = () => {
  const [keyword, setKeyword] = useState("");
  const [formManager, setFormManager] = useState<Manager | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data, isLoading } = useManagerListQuery({
    keyword: keyword || undefined,
  });
  const { deleteMutation } = useManagerMutation();

  const handleDelete = (manager: Manager) => {
    openConfirm({
      title: "담당자를 삭제할까요?",
      description: `'${manager.name}' 계정을 삭제합니다.`,
      warning: "담당하던 행사는 남으며, 담당자명만 그대로 표시됩니다.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: () =>
        deleteMutation
          .mutateAsync(manager.managerId)
          // 대표 계정 삭제는 서버가 막으므로 사유를 그대로 보여 준다.
          .catch((error) => showErrorToast(error)),
    });
  };

  const columns: TableColumn<Manager>[] = [
    {
      key: "name",
      header: "담당자",
      render: (manager) => (
        <TableCellStack primary={manager.name} secondary={manager.email} />
      ),
    },
    {
      key: "phoneNumber",
      header: "연락처",
      numeric: true,
      render: (manager) => formatPhoneNumber(manager.phoneNumber),
    },
    {
      key: "role",
      header: "권한",
      render: (manager) => (
        <div className="flex flex-col gap-1">
          <Badge tone={manager.isSuperAdmin ? "brand" : "neutral"} className="w-fit">
            {manager.roleName}
          </Badge>
          <span className="text-[12px] text-font-2">
            {manager.isSuperAdmin ? "모든 권한" : "직책 설정에서 권한을 봅니다."}
          </span>
        </div>
      ),
    },
    {
      key: "eventCount",
      header: "담당 행사",
      align: "right",
      numeric: true,
      render: (manager) => `${manager.eventCount}건`,
    },
    {
      key: "isActive",
      header: "상태",
      align: "center",
      render: (manager) =>
        manager.isActive ? (
          <Badge tone="success">사용중</Badge>
        ) : (
          <Badge tone="neutral">중지</Badge>
        ),
    },
    {
      key: "lastLoginAt",
      header: "마지막 접속",
      numeric: true,
      render: (manager) => (
        <span className="text-[13px] text-font-2">
          {formatDateTime(manager.lastLoginAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "140px",
      align: "right",
      render: (manager) => (
        <div
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Edit size={14} />}
            onClick={() => {
              setFormManager(manager);
              setIsFormOpen(true);
            }}
          >
            수정
          </Button>
          <Button
            size="sm"
            variant="dangerGhost"
            leftIcon={<Trash size={14} />}
            disabled={manager.isSuperAdmin}
            onClick={() => handleDelete(manager)}
          >
            삭제
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Alert tone="info" title="로그인 연동 전입니다.">
        지금은 계정 정보만 관리합니다. 서버 인증이 붙으면 여기서 만든 계정으로
        바로 로그인할 수 있고, 권한에 따라 계좌 · 정산 화면이 가려집니다.
      </Alert>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={setKeyword}
            placeholder="이름 · 이메일 · 연락처 검색"
          />

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => {
              setFormManager(null);
              setIsFormOpen(true);
            }}
          >
            담당자 추가
          </Button>
        </div>

        <Table
          columns={columns}
          rows={data?.items ?? []}
          getRowKey={(manager) => String(manager.managerId)}
          isLoading={isLoading}
          emptyTitle="등록된 담당자가 없습니다."
          emptyDescription="업무를 나누려면 매니저 계정부터 만들어 주세요."
        />
      </Card>

      <ManagerFormModal
        isOpen={isFormOpen}
        manager={formManager}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
};

export default ManagerBoard;
