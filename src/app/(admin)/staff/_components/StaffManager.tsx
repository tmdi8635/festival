"use client";

import { useState } from "react";
import { useStaffListQuery, type StaffSort } from "@/api/staff/getStaffList";
import { REGION_FILTER_OPTIONS } from "@/constants/regionOptions";
import {
  STAFF_SORT_OPTIONS,
  STAFF_STATUS_FILTER_OPTIONS,
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
} from "@/constants/staffOptions";
import { useListSearch } from "@/hooks/useListSearch";
import { Ban, Eye, Plus, Trash } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { useHasPermission } from "@/store/useAdminStore";
import { openConfirm } from "@/store/useConfirmStore";
import {
  jobRoleLabel,
  sortJobRoleCodes,
  useJobRoleComparator,
  useJobRoleFilterOptions,
} from "@/store/useOrgStore";
import { useStaffMutation } from "@/api/staff/mutateStaff";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  GENDER_LABEL,
  calculateReputationScore,
  formatPhoneNumber,
  formatRegion,
  type JobRole,
  type Staff,
  type StaffDetail,
  type StaffStatus,
} from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import CsvExportButton from "@/components/ui/CsvExportButton";
import Dropdown, { type DropdownItem } from "@/components/ui/Dropdown";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { type TableColumn } from "@/components/ui/Table";
import RatingStat from "@/components/domain/RatingStat";
import BlacklistModal from "@/components/domain/BlacklistModal";
import StaffCell from "@/components/domain/StaffCell";
import StaffDetailModal from "@/components/domain/StaffDetailModal";
import StaffFormModal from "@/components/domain/StaffFormModal";

/**
 * CSV 컬럼.
 * 계좌 · 신분증 같은 민감 정보는 목록 응답에 없으므로 내보내기에도 들어가지 않는다.
 */
const STAFF_CSV_COLUMNS: CsvColumn<Staff>[] = [
  { header: "인력 ID", value: (row) => row.staffId },
  { header: "이름", value: (row) => row.name },
  { header: "연락처", value: (row) => formatPhoneNumber(row.phoneNumber) },
  { header: "생년월일", value: (row) => row.birthDate },
  { header: "성별", value: (row) => GENDER_LABEL[row.gender] },
  { header: "상태", value: (row) => STAFF_STATUS_LABEL[row.status] },
  {
    header: "가능 직무",
    // 기준 설정에서 정한 순서대로 적는다. 배열이 들어온 순서를 믿지 않는다.
    value: (row) =>
      sortJobRoleCodes(row.roles)
        .map((role) => jobRoleLabel(role))
        .join(" · "),
  },
  {
    header: "활동 지역",
    value: (row) => formatRegion(row.region, row.district),
  },
  { header: "즐겨찾기", value: (row) => (row.isFavorite ? "O" : "") },
  { header: "누적 근무", value: (row) => row.workCount },
  { header: "누적 근무시간", value: (row) => row.totalWorkHours },
  { header: "지각", value: (row) => row.lateCount },
  { header: "노쇼", value: (row) => row.noShowCount },
  {
    header: "평판 점수",
    value: (row) => calculateReputationScore(row.goodCount, row.badCount),
  },
  { header: "좋아요", value: (row) => row.goodCount },
  { header: "별로예요", value: (row) => row.badCount },
  { header: "최근 근무", value: (row) => formatDate(row.lastWorkedAt) },
  { header: "등록일", value: (row) => formatDate(row.createdAt) },
];

/**
 * 인력풀.
 *
 * 오픈카톡방 1,500명 중 실제로 부를 수 있는 사람을 여기서 관리한다.
 * 배치할 사람을 고를 때는 정렬 기준(평판 · 근무 횟수)이 곧 판단 기준이 된다.
 */
const StaffManager = () => {
  /* 권한이 없으면 버튼 자체를 두지 않는다. 눌러 보고 거부당하는 것보다 낫다. */
  const canWrite = useHasPermission("staff:write");

  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  const [status, setStatus] = useState<StaffStatus | "">("");
  const [role, setRole] = useState<JobRole | "">("");
  const [region, setRegion] = useState("");
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [sort, setSort] = useState<StaffSort>("RECENT");

  const [detailStaffId, setDetailStaffId] = useState<number | null>(null);
  const [formStaff, setFormStaff] = useState<StaffDetail | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [blacklistTarget, setBlacklistTarget] = useState<StaffDetail | null>(
    null,
  );

  const jobRoleFilterOptions = useJobRoleFilterOptions();
  const compareRoles = useJobRoleComparator();
  const { deleteMutation } = useStaffMutation();

  const { data, isLoading } = useStaffListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    status: status || undefined,
    role: role || undefined,
    region: region || undefined,
    onlyFavorite: onlyFavorite || undefined,
    sort,
  });

  /**
   * 인력 삭제.
   *
   * 등록을 손으로 하는 단계라 잘못 넣은 사람을 지울 방법이 필요하다.
   * 다만 근무 이력이 있으면 서버가 막는다. (정산 · 계약서가 주인을 잃는다)
   * 그래서 확인창에서 미리 그 사실을 알려 준다.
   */
  const handleDelete = (staff: Staff) => {
    openConfirm({
      title: `'${staff.name}'님을 삭제할까요?`,
      description:
        "인력풀에서 완전히 지웁니다. 등록 정보와 서류가 함께 사라집니다.",
      warning:
        "근무 이력이 있는 인력은 삭제되지 않습니다. 더 이상 부르지 않을 사람이라면 '활동종료'로 상태만 바꿔 주세요.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: () => deleteMutation.mutateAsync(staff.staffId),
    });
  };

  /** 목록 응답에는 상세 필드가 없으므로 상세 모달을 거쳐 액션을 연다. */
  const buildRowActions = (staff: Staff): DropdownItem[] => [
    {
      label: "상세 보기",
      icon: <Eye size={15} />,
      onSelect: () => setDetailStaffId(staff.staffId),
    },
    {
      label: "블랙리스트",
      icon: <Ban size={15} />,
      tone: "danger" as const,
      disabled: staff.status === "BLACKLIST",
      onSelect: () => setDetailStaffId(staff.staffId),
    },
    {
      label: "삭제",
      icon: <Trash size={15} />,
      tone: "danger" as const,
      onSelect: () => handleDelete(staff),
    },
  ];

  const columns: TableColumn<Staff>[] = [
    {
      key: "staff",
      header: "인력",
      render: (staff) => (
        /* 별을 눌러 바로 즐겨찾기에 넣고 뺀다. 상세를 열 필요가 없다. */
        <StaffCell
          name={staff.name}
          phoneNumber={staff.phoneNumber}
          profileImageUrl={staff.profileImageUrl}
          isFavorite={staff.isFavorite}
          staffId={staff.staffId}
        />
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (staff) => (
        <Badge tone={STAFF_STATUS_TONE[staff.status]}>
          {STAFF_STATUS_LABEL[staff.status]}
        </Badge>
      ),
    },
    {
      key: "roles",
      header: "가능 직무",
      render: (staff) => (
        <div className="flex flex-wrap gap-1">
          {/* 기준 설정에서 정한 순서대로 나열한다. 팀장을 위로 올려 뒀으면 여기서도 위다. */}
          {[...staff.roles]
            .sort(compareRoles)
            .slice(0, 3)
            .map((item) => (
              <Badge key={item} tone="neutral">
                {jobRoleLabel(item)}
              </Badge>
            ))}
          {staff.roles.length > 3 && (
            <Badge tone="neutral">+{staff.roles.length - 3}</Badge>
          )}
        </div>
      ),
    },
    {
      key: "region",
      header: "활동 지역",
      render: (staff) => (
        <span className="text-[13px] text-font-2">
          {formatRegion(staff.region, staff.district)}
        </span>
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
      /*
        좋아요 비율만 보여 주면 1건 100%가 200건 95%보다 좋아 보인다.
        기본 점수에서 출발해 평가가 쌓인 만큼만 움직이는 평판 점수를 대신 그린다.
      */
      key: "reputation",
      header: "평판",
      align: "center",
      render: (staff) => (
        <RatingStat
          goodCount={staff.goodCount}
          badCount={staff.badCount}
          variant="badge"
        />
      ),
    },
    {
      key: "issues",
      header: "지각 / 노쇼",
      align: "right",
      numeric: true,
      render: (staff) => (
        <span
          className={
            staff.noShowCount > 0 ? "font-medium text-danger" : "text-font-1"
          }
        >
          {staff.lateCount} / {staff.noShowCount}
        </span>
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
      width: "56px",
      align: "center",
      render: (staff) => (
        <div
          className="flex justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <Dropdown items={buildRowActions(staff)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={keyword}
              onSearch={handleSearch}
              placeholder="이름 · 연락처 · 지역 검색"
            />

            <Checkbox
              label="즐겨찾기만"
              boxClassName="whitespace-nowrap"
              checked={onlyFavorite}
              onChange={withPageReset((event) => setOnlyFavorite(event.target.checked))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CsvExportButton
              fileName="인력목록"
              rows={data?.content ?? []}
              columns={STAFF_CSV_COLUMNS}
              disabled={isLoading}
            />

            <Select
              aria-label="정렬 기준"
              options={STAFF_SORT_OPTIONS}
              value={sort}
              onChange={withPageReset((event) => setSort(event.target.value as StaffSort))}
              selectBoxClassName="w-36"
            />

            {canWrite && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={15} />}
                onClick={() => {
                  setFormStaff(null);
                  setIsFormOpen(true);
                }}
              >
                인력 등록
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border-main px-4 py-3 lg:px-5">
          <Select
            aria-label="상태 필터"
            options={STAFF_STATUS_FILTER_OPTIONS}
            value={status}
            onChange={withPageReset((event) => setStatus(event.target.value as StaffStatus | ""))}
            selectBoxClassName="w-36"
          />

          <Select
            aria-label="직무 필터"
            options={jobRoleFilterOptions}
            value={role}
            onChange={withPageReset((event) => setRole(event.target.value as JobRole | ""))}
            selectBoxClassName="w-32"
          />

          <Select
            aria-label="지역 필터"
            options={REGION_FILTER_OPTIONS}
            value={region}
            onChange={withPageReset((event) => setRegion(event.target.value))}
            selectBoxClassName="w-32"
          />
        </div>

        <Table
          columns={columns}
          rows={data?.content ?? []}
          getRowKey={(staff) => String(staff.staffId)}
          isLoading={isLoading}
          onRowClick={(staff) => setDetailStaffId(staff.staffId)}
          emptyTitle="조건에 맞는 인력이 없습니다."
          emptyDescription="검색어나 직무 · 지역 필터를 바꿔서 다시 찾아보세요."
          emptyAction={
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              onClick={() => {
                setFormStaff(null);
                setIsFormOpen(true);
              }}
            >
              인력 등록
            </Button>
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
        onEdit={(staff) => {
          setDetailStaffId(null);
          setFormStaff(staff);
          setIsFormOpen(true);
        }}
        onBlacklist={(staff) => {
          setDetailStaffId(null);
          setBlacklistTarget(staff);
        }}
      />

      <StaffFormModal
        isOpen={isFormOpen}
        staff={formStaff}
        onClose={() => setIsFormOpen(false)}
      />

      <BlacklistModal
        staff={blacklistTarget}
        onClose={() => setBlacklistTarget(null)}
      />
    </>
  );
};

export default StaffManager;
