"use client";

import { useState } from "react";
import { useApplicationListQuery } from "@/api/recruit/getApplicationList";
import { useApplicationMutation } from "@/api/recruit/mutateApplication";
import {
  APPLICATION_STATUS_FILTER_OPTIONS,
  APPLICATION_STATUS_TONE,
} from "@/constants/recruitOptions";
import { useListSearch } from "@/hooks/useListSearch";
import { Ban, Check, Plus, UserPlus, Warning } from "@/icons";
import { formatDate, formatDateTime } from "@/lib/dayjs";
import { showErrorToast } from "@/lib/toast";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  APPLICATION_STATUS_LABEL,
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

  const { data, isLoading } = useApplicationListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    status: status || undefined,
    onlyNewApplicant: onlyNewApplicant || undefined,
  });

  const { statusMutation } = useApplicationMutation();

  const handleAccept = (application: Application) => {
    openConfirm({
      title: "지원을 확정할까요?",
      description: `'${application.applicantName}'님을 '${application.eventTitle}'에 ${jobRoleLabel(application.role)}(으)로 배치합니다.`,
      warning: application.conflictEventTitle
        ? `같은 날 '${application.conflictEventTitle}'에 이미 확정되어 있어 배치가 거절될 수 있습니다.`
        : undefined,
      confirmText: "확정",
      onConfirm: () =>
        statusMutation
          .mutateAsync({
            applicationId: application.applicationId,
            status: "ACCEPTED",
          })
          // 중복 배치·미등록 인력은 서버가 막으므로 사유를 그대로 보여 준다.
          .catch((error) => showErrorToast(error)),
    });
  };

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
            <span className="tabular-nums">
              {formatDate(application.workDate)}
            </span>
          }
        />
      ),
    },
    {
      key: "role",
      header: "직무",
      render: (application) => (
        <Badge tone="neutral">{jobRoleLabel(application.role)}</Badge>
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
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Check size={14} />}
            disabled={application.status !== "PENDING"}
            onClick={() => handleAccept(application)}
          >
            확정
          </Button>
          <Button
            size="sm"
            variant="dangerGhost"
            leftIcon={<Ban size={14} />}
            disabled={application.status !== "PENDING"}
            onClick={() => handleReject(application)}
          >
            반려
          </Button>
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
        확정 시 해당 행사에 자동으로 배치되며, 같은 날 다른 행사에 이미 확정된
        인력은 시스템이 막습니다.
      </Alert>

      <Card noPadding>
        <div className="flex flex-wrap items-center justify-start gap-2.5 border-b border-border-main px-4 py-3 lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
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

          <div className="flex items-center gap-2">
            <Select
              aria-label="상태 필터"
              options={APPLICATION_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={withPageReset((event) => setStatus(event.target.value as ApplicationStatus | ""))}
              selectBoxClassName="w-32"
            />

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => setIsFormOpen(true)}
            >
              지원 등록
            </Button>
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

      <StaffDetailModal
        staffId={detailStaffId}
        onClose={() => setDetailStaffId(null)}
      />
    </>
  );
};

export default ApplicationManager;
