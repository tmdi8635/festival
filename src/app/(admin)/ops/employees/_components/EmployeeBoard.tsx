"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useEmployeeListQuery,
  useEmployeeRoleListQuery,
} from "@/api/employee/getEmployeeList";
import { useEmployeeMutation } from "@/api/employee/mutateEmployee";
import { Edit, Plus, ShieldCheck, Trash, Users } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import { formatDate, formatDateTime } from "@/lib/dayjs";
import { showErrorToast } from "@/lib/toast";
import { useHasPermission } from "@/store/useAdminStore";
import { openConfirm } from "@/store/useConfirmStore";
import { type Employee } from "@/type/employee";
import { GENDER_LABEL, formatPhoneNumber } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import StaffCell from "@/components/domain/StaffCell";
import StatTile from "@/components/domain/StatTile";
import EmployeeFormModal from "./EmployeeFormModal";

const EMPLOYEE_CSV_COLUMNS: CsvColumn<Employee>[] = [
  { header: "이름", value: (row) => row.name },
  { header: "직책", value: (row) => row.position },
  { header: "권한 직책", value: (row) => row.roleName },
  { header: "이메일", value: (row) => row.email },
  { header: "연락처", value: (row) => row.phoneNumber },
  { header: "생년월일", value: (row) => row.birthDate },
  { header: "주소", value: (row) => row.address },
  { header: "비상 연락처", value: (row) => row.emergencyContact },
  { header: "입사일", value: (row) => row.hireDate },
  { header: "기본 근무시간", value: (row) => row.baseMonthlyHours },
  { header: "재직", value: (row) => (row.isActive ? "재직" : "퇴사") },
];

/**
 * 직원 관리 — **인적사항과 권한**.
 *
 * 이 화면이 답하는 질문은 "이 사람은 누구이고 무엇을 할 수 있나" 하나다.
 * 근무 집계는 옆 화면(직원 근무)이 맡는다. 한 화면에 다 넣으면
 * 인적사항을 고치러 들어와서 근무 표를 스크롤로 넘겨야 한다.
 *
 * 예전에는 '담당자 관리'와 따로 있었다. 둘 다 같은 사람을 가리켜서
 * 이름을 두 곳에서 고쳐야 했고, 한쪽에만 있는 사람이 생겼다.
 */
const EmployeeBoard = () => {
  const canWrite = useHasPermission("employee:write");
  const canDelete = useHasPermission("employee:delete");

  const [keyword, setKeyword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [includeRetired, setIncludeRetired] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data, isLoading } = useEmployeeListQuery({
    keyword: keyword || undefined,
    roleId: roleId || undefined,
    includeRetired,
  });
  const { data: roleData } = useEmployeeRoleListQuery();
  const { deleteMutation } = useEmployeeMutation();

  const rows = data?.items ?? [];
  const summary = data?.summary;

  const roleOptions = [
    { label: "전체 권한", value: "" },
    ...(roleData?.items ?? []).map((role) => ({
      label: role.name,
      value: String(role.roleId),
    })),
  ];

  const openForm = (employee: Employee | null) => {
    setEditTarget(employee);
    setIsFormOpen(true);
  };

  const handleDelete = (employee: Employee) => {
    openConfirm({
      title: "직원을 삭제할까요?",
      description: `'${employee.name}' 직원과 계정을 함께 지웁니다.`,
      warning:
        "행사에 배치된 기록이 있으면 삭제되지 않습니다. 그때는 수정에서 '재직 중'을 꺼 퇴사 처리해 주세요.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: () =>
        deleteMutation
          .mutateAsync(employee.employeeId)
          /* 서버가 막는 이유(배치 이력 · 최고관리자)를 그대로 보여 준다. */
          .catch((error) => showErrorToast(error)),
    });
  };

  const columns: TableColumn<Employee>[] = [
    {
      key: "employee",
      header: "직원",
      render: (row) => (
        <StaffCell
          name={row.name}
          profileImageUrl={row.profileImageUrl}
          secondary={row.email}
          badge={
            <>
              <Badge tone="info">{row.position}</Badge>
              {!row.isActive && <Badge tone="neutral">퇴사</Badge>}
            </>
          }
        />
      ),
    },
    {
      key: "contact",
      header: "연락처",
      render: (row) => (
        <TableCellStack
          primary={
            <span className="tabular-nums">
              {formatPhoneNumber(row.phoneNumber)}
            </span>
          }
          secondary={
            row.emergencyContact ? (
              <span className="tabular-nums">
                비상 {formatPhoneNumber(row.emergencyContact)}
              </span>
            ) : undefined
          }
        />
      ),
    },
    {
      key: "personal",
      header: "생년월일 / 입사일",
      render: (row) => (
        <TableCellStack
          primary={
            <span className="tabular-nums">
              {row.birthDate ? formatDate(row.birthDate) : "-"}
              <span className="text-font-2"> · {GENDER_LABEL[row.gender]}</span>
            </span>
          }
          secondary={
            <span className="tabular-nums">
              입사 {row.hireDate ? formatDate(row.hireDate) : "-"}
            </span>
          }
        />
      ),
    },
    {
      /*
        시스템 권한.
        회사 직책(대리 · 실장)과 다른 축이다. 실장이라고 정산을 볼 수 있는 것도,
        사원이라고 못 보는 것도 아니라서 두 값을 따로 보여 준다.
      */
      key: "role",
      header: "시스템 권한",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <Badge
            tone={row.isSuperAdmin ? "brand" : "neutral"}
            className="w-fit"
          >
            {row.roleName}
          </Badge>
          <span className="text-[12px] text-font-2">
            {row.isSuperAdmin ? "모든 권한" : "직책 · 권한에서 정합니다."}
          </span>
        </div>
      ),
    },
    {
      key: "baseMonthlyHours",
      header: "기본 근무시간",
      align: "right",
      numeric: true,
      render: (row) => (
        <span className="tabular-nums">{row.baseMonthlyHours}시간</span>
      ),
    },
    {
      key: "lastLoginAt",
      header: "마지막 접속",
      numeric: true,
      render: (row) => (
        <span className="text-[13px] text-font-2">
          {formatDateTime(row.lastLoginAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "140px",
      align: "right",
      render: (row) => (
        <div
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {canWrite && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Edit size={14} />}
              onClick={() => openForm(row)}
            >
              수정
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="dangerGhost"
              leftIcon={<Trash size={14} />}
              disabled={row.isSuperAdmin}
              onClick={() => handleDelete(row)}
            >
              삭제
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Alert tone="info" title="직원은 행사에 바로 배치할 수 있습니다.">
        여기 등록한 사람은 인력풀에도 함께 올라가 <b>직무와 관계없이</b> 어느
        자리에나 배치됩니다. 회사와 이미 근로계약이 되어 있어 행사마다 근로계약서를
        받지 않고, 급여도 월급으로 나가 시급 정산 목록에 오르지 않습니다. 대신
        이번 달 근무시간은 <Link href="/ops/employees/work" className="text-brand underline">직원 근무</Link>에서 셉니다.
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="재직 직원"
          value={`${summary?.activeCount ?? 0}명`}
          description="퇴사자를 뺀 인원입니다."
          icon={<Users size={18} />}
        />
        <StatTile
          label="최고관리자"
          value={`${summary?.superAdminCount ?? 0}명`}
          /*
            한 명뿐이면 그 계정을 잃었을 때 권한을 되돌릴 사람이 아무도 없다.
            숫자만 띄우고 끝내면 아무도 그 사실을 눈치채지 못한다.
          */
          description={
            (summary?.superAdminCount ?? 0) <= 1
              ? "한 명뿐입니다. 이 계정을 잃으면 권한을 되돌릴 수 없습니다."
              : "모든 권한을 가진 계정입니다."
          }
          tone={(summary?.superAdminCount ?? 0) <= 1 ? "warning" : "default"}
          icon={<ShieldCheck size={18} />}
        />
        <StatTile
          label="등록 인원"
          value={`${summary?.totalCount ?? 0}명`}
          description="지금 목록에 걸린 인원입니다."
          icon={<Users size={18} />}
        />
      </div>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={setKeyword}
            placeholder="이름 · 직책 · 이메일 · 연락처 검색"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="권한 필터"
              options={roleOptions}
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              selectBoxClassName="w-36"
            />

            <Checkbox
              label="퇴사자 포함"
              checked={includeRetired}
              onChange={(event) => setIncludeRetired(event.target.checked)}
            />

            <CsvExportButton
              fileName="직원_명부"
              rows={rows}
              columns={EMPLOYEE_CSV_COLUMNS}
              disabled={isLoading || rows.length === 0}
            />

            {canWrite && (
              <Button
                variant="primary"
                leftIcon={<Plus size={15} />}
                onClick={() => openForm(null)}
              >
                직원 등록
              </Button>
            )}
          </div>
        </div>

        <Table
          columns={columns}
          rows={rows}
          getRowKey={(row) => String(row.employeeId)}
          isLoading={isLoading}
          onRowClick={canWrite ? openForm : undefined}
          emptyTitle="등록된 직원이 없습니다."
          emptyDescription="월급을 받는 우리 직원을 등록하면 계정과 권한이 함께 만들어지고, 행사에도 바로 배치할 수 있습니다."
        />
      </Card>

      <EmployeeFormModal
        isOpen={isFormOpen}
        employee={editTarget}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
};

export default EmployeeBoard;
