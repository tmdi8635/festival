"use client";

import { useState } from "react";
import { useListSearch } from "@/hooks/useListSearch";
import { useStaffListQuery } from "@/api/staff/getStaffList";
import { useStaffMutation } from "@/api/staff/mutateStaff";
import { useHasPermission } from "@/store/useAdminStore";
import { Ban, ShieldAlert, Warning } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleComparator, useJobRoleLabel } from "@/store/useOrgStore";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import { type Staff, type StaffDetail } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Table, { type TableColumn } from "@/components/ui/Table";
import BlacklistModal from "@/components/domain/BlacklistModal";
import RatingStat from "@/components/domain/RatingStat";
import StaffCell from "@/components/domain/StaffCell";
import StaffDetailModal from "@/components/domain/StaffDetailModal";
import StatTile from "@/components/domain/StatTile";

/** 이 횟수부터 블랙리스트 후보로 올린다. 기준 설정 화면에서 바꿀 수 있다. */
const NO_SHOW_THRESHOLD = 2;

/**
 * 블랙리스트.
 *
 * 기존에는 대표 머릿속에만 있던 목록이다.
 * 여기서는 (1) 이미 지정된 인력과 (2) 노쇼 기록이 기준을 넘어 후보가 된 인력을
 * 함께 보여 준다. 판단은 사람이 하되, 놓치지는 않게 한다.
 */
const BlacklistManager = () => {
  const jobRoleLabel = useJobRoleLabel();
  // 직무는 기준 설정에서 정한 순서로 나열한다.
  const compareRoles = useJobRoleComparator();
  const { page, setPage, keyword, handleSearch } = useListSearch();

  const [detailStaffId, setDetailStaffId] = useState<number | null>(null);
  const [blacklistTarget, setBlacklistTarget] = useState<StaffDetail | null>(
    null,
  );

  const { data, isLoading } = useStaffListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    status: "BLACKLIST",
  });

  /** 아직 지정되지 않았지만 노쇼 기록이 기준을 넘은 인력 */
  const { data: candidateData } = useStaffListQuery({
    page: 1,
    size: 50,
    status: "ACTIVE",
    // 노쇼가 쌓인 사람을 찾는 화면이므로 평판이 낮은 순으로 먼저 본다.
    sort: "RATING",
  });

  const candidates = (candidateData?.content ?? []).filter(
    (staff) => staff.noShowCount >= NO_SHOW_THRESHOLD,
  );

  /*
    지정과 해제는 같은 권한으로 본다.
    해제만 열어 두면 지정을 막은 뜻이 없어진다 — 지운 뒤 다시 부르면 되기 때문이다.
  */
  const canWrite = useHasPermission("blacklist:write");

  const { statusMutation } = useStaffMutation();

  const handleRelease = (staff: Staff) => {
    openConfirm({
      title: "블랙리스트를 해제할까요?",
      description: `'${staff.name}'님을 다시 배치 대상으로 되돌립니다.`,
      confirmText: "해제",
      onConfirm: () =>
        statusMutation.mutateAsync({
          staffId: staff.staffId,
          body: { status: "ACTIVE" },
        }),
    });
  };

  const columns: TableColumn<Staff>[] = [
    {
      key: "staff",
      header: "인력",
      render: (staff) => (
        <StaffCell
          name={staff.name}
          phoneNumber={staff.phoneNumber}
          profileImageUrl={staff.profileImageUrl}
        />
      ),
    },
    {
      key: "roles",
      header: "가능 직무",
      render: (staff) => (
        <div className="flex flex-wrap gap-1">
          {[...staff.roles]
            .sort(compareRoles)
            .slice(0, 3)
            .map((role) => (
              <Badge key={role} tone="neutral">
                {jobRoleLabel(role)}
              </Badge>
            ))}
        </div>
      ),
    },
    {
      key: "workCount",
      header: "누적 근무",
      align: "right",
      numeric: true,
      render: (staff) => `${staff.workCount}회`,
    },
    {
      key: "issues",
      header: "지각 / 노쇼",
      align: "right",
      numeric: true,
      render: (staff) => (
        <span className="font-medium text-danger">
          {staff.lateCount} / {staff.noShowCount}
        </span>
      ),
    },
    {
      /*
        예전에는 '신뢰도' 합성 점수를 보여 줬는데, 무엇 때문에 깎였는지
        알 수 없어 지정 판단에 쓰이지 못했다.
        옆 칸의 지각/노쇼 횟수와 함께 평점을 그대로 보여 준다.
      */
      key: "rating",
      header: "평판",
      align: "center",
      render: (staff) => (
        <RatingStat
          reputationScore={staff.reputationScore}
          goodCount={staff.goodCount}
          badCount={staff.badCount}
          variant="badge"
        />
      ),
    },
    {
      key: "lastWorkedAt",
      header: "최근 근무",
      numeric: true,
      render: (staff) => (
        <span className="text-[13px] text-font-2">
          {formatDate(staff.lastWorkedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "120px",
      align: "right",
      render: (staff) => (
        <div
          className="flex justify-end"
          onClick={(event) => event.stopPropagation()}
        >
          {canWrite && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleRelease(staff)}
            >
              해제
            </Button>
          )}
        </div>
      ),
    },
  ];

  const candidateColumns: TableColumn<Staff>[] = [
    {
      key: "staff",
      header: "인력",
      render: (staff) => (
        <StaffCell
          name={staff.name}
          phoneNumber={staff.phoneNumber}
          profileImageUrl={staff.profileImageUrl}
        />
      ),
    },
    {
      key: "issues",
      header: "지각 / 노쇼",
      align: "right",
      numeric: true,
      render: (staff) => (
        <span className="font-medium text-danger">
          {staff.lateCount} / {staff.noShowCount}
        </span>
      ),
    },
    {
      /*
        예전에는 '신뢰도' 합성 점수를 보여 줬는데, 무엇 때문에 깎였는지
        알 수 없어 지정 판단에 쓰이지 못했다.
        옆 칸의 지각/노쇼 횟수와 함께 평점을 그대로 보여 준다.
      */
      key: "rating",
      header: "평판",
      align: "center",
      render: (staff) => (
        <RatingStat
          reputationScore={staff.reputationScore}
          goodCount={staff.goodCount}
          badCount={staff.badCount}
          variant="badge"
        />
      ),
    },
    {
      key: "actions",
      header: "",
      width: "160px",
      align: "right",
      render: (staff) => (
        <div
          className="flex justify-end"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            size="sm"
            variant="dangerGhost"
            leftIcon={<Ban size={14} />}
            onClick={() => setDetailStaffId(staff.staffId)}
          >
            검토하기
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile
          label="블랙리스트"
          value={`${data?.totalCount ?? 0}명`}
          description="배치 후보에서 자동으로 제외됩니다."
          tone="danger"
          icon={<Ban size={18} />}
        />
        <StatTile
          label="지정 후보"
          value={`${candidates.length}명`}
          description={`노쇼 ${NO_SHOW_THRESHOLD}회 이상 기록`}
          tone={candidates.length > 0 ? "warning" : "default"}
          icon={<ShieldAlert size={18} />}
        />
        <StatTile
          label="판단 기준"
          value={`노쇼 ${NO_SHOW_THRESHOLD}회`}
          description="운영 › 기준 설정에서 바꿀 수 있습니다."
        />
      </div>

      <Alert tone="info" title="사유 없는 지정은 남지 않습니다.">
        블랙리스트는 반드시 사유와 함께 기록되며, 운영 로그에도 남습니다.
        같은 판단을 다른 담당자도 확인할 수 있어야 업무를 나눌 수 있습니다.
      </Alert>

      {candidates.length > 0 && (
        <Card
          title="지정 후보"
          description={`노쇼가 ${NO_SHOW_THRESHOLD}회 이상 기록됐지만 아직 블랙리스트가 아닌 인력입니다.`}
          noPadding
        >
          <Table
            columns={candidateColumns}
            rows={candidates}
            getRowKey={(staff) => String(staff.staffId)}
            onRowClick={(staff) => setDetailStaffId(staff.staffId)}
          />
        </Card>
      )}

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={handleSearch}
            placeholder="이름 · 연락처 검색"
          />
        </div>

        <Table
          columns={columns}
          rows={data?.content ?? []}
          getRowKey={(staff) => String(staff.staffId)}
          isLoading={isLoading}
          onRowClick={(staff) => setDetailStaffId(staff.staffId)}
          emptyTitle="블랙리스트가 비어 있습니다."
          emptyDescription="노쇼 · 결근이 기록되면 지정 후보가 위에 나타납니다."
          emptyAction={
            <span className="flex items-center gap-1.5 text-[13px] text-font-2">
              <Warning size={14} />
              사유 없이 지정하지 않습니다.
            </span>
          }
        />

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={DEFAULT_PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      <StaffDetailModal
        staffId={detailStaffId}
        onClose={() => setDetailStaffId(null)}
        onBlacklist={(staff) => {
          setDetailStaffId(null);
          setBlacklistTarget(staff);
        }}
      />

      <BlacklistModal
        staff={canWrite ? blacklistTarget : null}
        onClose={() => setBlacklistTarget(null)}
      />
    </>
  );
};

export default BlacklistManager;
