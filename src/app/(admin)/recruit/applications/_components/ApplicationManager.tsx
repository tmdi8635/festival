"use client";

import { useState } from "react";
import { useApplicationListQuery } from "@/api/recruit/getApplicationList";
import { useApplicationMutation } from "@/api/recruit/mutateApplication";
import { useHasPermission } from "@/store/useAdminStore";
import {
  APPLICATION_STATUS_FILTER_OPTIONS,
  APPLICATION_STATUS_TONE,
} from "@/constants/recruitOptions";
import { useListSearch } from "@/hooks/useListSearch";
import { Ban, Check, Plus, UserPlus, Warning } from "@/icons";
import { formatDateTime } from "@/lib/dayjs";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  APPLICATION_STATUS_LABEL,
  describeApplicationDates,
  type Application,
  type ApplicationStatus,
} from "@/type/recruit";
import { formatPhoneNumber } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import StaffDetailModal from "@/components/domain/StaffDetailModal";
import ApplicationAcceptModal from "./ApplicationAcceptModal";
import ApplicationFormModal from "./ApplicationFormModal";
import FeatureNotice from "@/components/domain/FeatureNotice";

/**
 * 지원자 관리.
 *
 * 확정 버튼 하나로 행사 배치까지 만들어진다.
 * 문자를 보고 엑셀에 옮겨 적던 단계가 없어지는 것이 이 화면의 핵심이다.
 */
const ApplicationManager = () => {
  const jobRoleLabel = useJobRoleLabel();
  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  const [status, setStatus] = useState<ApplicationStatus | "">("PENDING");
  const [onlyNewApplicant, setOnlyNewApplicant] = useState(false);
  const [detailStaffId, setDetailStaffId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  /** 확정 모달을 연 지원. 어느 날을 확정할지 거기서 정한다. */
  const [acceptTarget, setAcceptTarget] = useState<Application | null>(null);

  const { data, isLoading } = useApplicationListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    status: status || undefined,
    onlyNewApplicant: onlyNewApplicant || undefined,
  });

  /*
    확정은 그 자리에서 행사 배치까지 만든다. 그래서 모집 권한만으로는 부족하고
    배치 권한이 함께 있어야 한다. (서버도 같은 기준으로 두 번 본다)
  */
  const canWrite = useHasPermission("recruit:write");
  const canAssign = useHasPermission("assignment:write");

  const { statusMutation } = useApplicationMutation();

  const handleReject = (application: Application) => {
    openConfirm({
      title: "지원을 반려할까요?",
      description: `'${application.applicantName}'님의 지원을 반려 처리합니다.`,
      confirmText: "반려",
      tone: "danger",
      onConfirm: () =>
        statusMutation.mutateAsync({
          applicationId: application.applicationId,
          status: "REJECTED",
        }),
    });
  };

  const columns: TableColumn<Application>[] = [
    {
      key: "applicant",
      header: "지원자",
      render: (application) => (
        <div className="flex min-w-0 items-center gap-2">
          <TableCellStack
            primary={application.applicantName}
            secondary={
              <span className="tabular-nums">
                {formatPhoneNumber(application.phoneNumber)}
              </span>
            }
          />
          {!application.isExistingStaff && (
            <Badge tone="info" leftIcon={<UserPlus size={11} />}>
              신규
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "event",
      header: "행사 / 근무일",
      render: (application) => (
        <TableCellStack
          primary={application.eventTitle}
          secondary={
            /*
              신청한 날을 적는다. 첫날 하나만 적으면 전일 지원과 하루 지원이
              같은 줄로 보여서, 확정을 누르기 전에는 며칠이 들어가는지 모른다.
            */
            <span className="tabular-nums">
              {describeApplicationDates(application)}
            </span>
          }
        />
      ),
    },
    {
      /*
        지원은 **포지션**에 한다. 같은 행사라도 A타임 · B타임은 시각 · 금액이 달라
        직무만 적으면 확정했을 때 어느 자리로 들어가는지 알 수 없다.
      */
      key: "position",
      header: "포지션",
      render: (application) => (
        <TableCellStack
          primary={application.positionName || jobRoleLabel(application.role)}
          secondary={
            application.positionName &&
            application.positionName !== jobRoleLabel(application.role)
              ? jobRoleLabel(application.role)
              : undefined
          }
        />
      ),
    },
    {
      key: "note",
      header: "지원 메모",
      render: (application) => (
        <p className="max-w-72 truncate text-[13px] text-font-2">
          {application.note || "-"}
        </p>
      ),
    },
    {
      key: "conflict",
      header: "중복 확인",
      align: "center",
      render: (application) =>
        application.conflictEventTitle ? (
          <Badge tone="danger" leftIcon={<Warning size={11} />}>
            일정 겹침
          </Badge>
        ) : (
          <span className="text-[13px] text-font-disabled">-</span>
        ),
    },
    {
      key: "status",
      header: "상태",
      render: (application) => (
        <Badge tone={APPLICATION_STATUS_TONE[application.status]}>
          {APPLICATION_STATUS_LABEL[application.status]}
        </Badge>
      ),
    },
    {
      key: "appliedAt",
      header: "지원 일시",
      numeric: true,
      render: (application) => (
        <span className="text-[13px] text-font-2">
          {formatDateTime(application.appliedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "160px",
      align: "right",
      render: (application) => (
        <div
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {canWrite && canAssign && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Check size={14} />}
              disabled={application.status !== "PENDING"}
              onClick={() => setAcceptTarget(application)}
            >
              확정
            </Button>
          )}
          {canWrite && (
            <Button
              size="sm"
              variant="dangerGhost"
              leftIcon={<Ban size={14} />}
              disabled={application.status !== "PENDING"}
              onClick={() => handleReject(application)}
            >
              반려
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <FeatureNotice
        feature="RECRUIT"
        fallback="카톡 · 문자로 받은 지원은 인력풀에 직접 등록한 뒤 행사 상세에서 배치해 주세요."
      />
      <Alert tone="info" title="확정하면 배치까지 한 번에 끝납니다.">
        지원자가 신청한 날에 자동으로 배치됩니다. 날짜를 골라 낸 지원은 일부만
        확정할 수 있고, 전일 지원은 하루라도 다른 행사와 겹치면 시스템이 막습니다.
      </Alert>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={keyword}
              onSearch={handleSearch}
              placeholder="지원자 · 연락처 · 행사명 검색"
            />

            <Checkbox
              label="신규 지원자만"
              boxClassName="whitespace-nowrap"
              checked={onlyNewApplicant}
              onChange={withPageReset((event) => setOnlyNewApplicant(event.target.checked))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="상태 필터"
              options={APPLICATION_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={withPageReset((event) => setStatus(event.target.value as ApplicationStatus | ""))}
              selectBoxClassName="w-32"
            />

            {canWrite && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={15} />}
                onClick={() => setIsFormOpen(true)}
              >
                지원 등록
              </Button>
            )}
          </div>
        </div>

        <Table
          columns={columns}
          rows={data?.content ?? []}
          getRowKey={(application) => String(application.applicationId)}
          isLoading={isLoading}
          onRowClick={(application) =>
            application.staffId && setDetailStaffId(application.staffId)
          }
          emptyTitle="검토할 지원이 없습니다."
          emptyDescription="문자로 받은 지원을 '지원 등록'으로 옮겨 적을 수 있습니다."
        />

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={DEFAULT_PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      <ApplicationFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />

      {acceptTarget && (
        <ApplicationAcceptModal
          key={acceptTarget.applicationId}
          application={acceptTarget}
          onClose={() => setAcceptTarget(null)}
        />
      )}

      <StaffDetailModal
        staffId={detailStaffId}
        onClose={() => setDetailStaffId(null)}
      />
    </>
  );
};

export default ApplicationManager;
