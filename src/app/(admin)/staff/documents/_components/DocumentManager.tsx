"use client";

import { useState } from "react";
import { useStaffListQuery } from "@/api/staff/getStaffList";
import {
  DOCUMENT_STATE_FILTER_OPTIONS,
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
} from "@/constants/staffOptions";
import { useListSearch } from "@/hooks/useListSearch";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import { formatPhoneNumber, type Staff, type StaffDetail } from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CsvExportButton from "@/components/ui/CsvExportButton";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { type TableColumn } from "@/components/ui/Table";
import StaffCell from "@/components/domain/StaffCell";
import StaffDetailModal from "@/components/domain/StaffDetailModal";
import StaffFormModal from "@/components/domain/StaffFormModal";

const DOCUMENT_CSV_COLUMNS: CsvColumn<Staff>[] = [
  { header: "이름", value: (row) => row.name },
  { header: "연락처", value: (row) => formatPhoneNumber(row.phoneNumber) },
  { header: "상태", value: (row) => STAFF_STATUS_LABEL[row.status] },
  { header: "서류", value: (row) => (row.isDocumentComplete ? "완료" : "미제출") },
  { header: "누적 근무", value: (row) => row.workCount },
  { header: "등록일", value: (row) => formatDate(row.createdAt) },
];

/**
 * 서류 관리.
 *
 * "첫 근무자면 신분증과 통장사본을 받는다"를 사람 기억이 아니라 목록으로 만든다.
 * 미제출 인력은 정산이 보류되므로 근무 전에 여기서 걸러야 한다.
 */
const DocumentManager = () => {
  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  // 기본값을 '미제출'로 두어 화면을 열자마자 할 일이 보이게 한다.
  const [documentState, setDocumentState] = useState("INCOMPLETE");

  const [detailStaffId, setDetailStaffId] = useState<number | null>(null);
  const [formStaff, setFormStaff] = useState<StaffDetail | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data, isLoading } = useStaffListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    documentState: documentState || undefined,
    status: "ACTIVE",
  });

  /**
   * 미제출 인원.
   *
   * 목록이 '전체'로 걸려 있어도 미제출이 남아 있으면 안내를 띄워야 해서
   * 한 건만 따로 센다. (제출률은 세지 않는다 — 여기서 할 일은 비율이 아니라
   * 남은 사람의 서류를 받는 것이다)
   */
  const { data: incompleteData } = useStaffListQuery({
    page: 1,
    size: 1,
    status: "ACTIVE",
    documentState: "INCOMPLETE",
  });

  const incompleteCount = incompleteData?.totalCount ?? 0;

  const columns: TableColumn<Staff>[] = [
    {
      key: "staff",
      header: "인력",
      render: (staff) => (
        <StaffCell
          name={staff.name}
          phoneNumber={staff.phoneNumber}
          profileImageUrl={staff.profileImageUrl}
          gender={staff.gender}
          isFavorite={staff.isFavorite}
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
      key: "document",
      header: "서류 제출",
      align: "center",
      render: (staff) =>
        staff.isDocumentComplete ? (
          <Badge tone="success">완료</Badge>
        ) : (
          <Badge tone="danger">미제출</Badge>
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
      key: "createdAt",
      header: "등록일",
      numeric: true,
      render: (staff) => (
        <span className="text-[13px] text-font-2">
          {formatDate(staff.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      {/*
        요약 타일을 두지 않는다.

        '활동 인력 84명 · 미제출 6명 · 제출률 93%'는 세 칸이 전부 같은 것을
        말하고, 그중 무엇도 여기서 할 일을 알려 주지 않는다. 이 화면에서 하는
        일은 **미제출인 사람의 서류를 받는 것** 하나이고, 그건 아래 목록이
        답한다. 목록이 첫 화면에 들어와야 그 일이 시작된다.
      */}
      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={handleSearch}
            placeholder="이름 · 연락처 검색"
          />

          <div className="flex flex-wrap items-center gap-2">
            <CsvExportButton
              fileName="서류현황"
              rows={data?.content ?? []}
              columns={DOCUMENT_CSV_COLUMNS}
              disabled={isLoading}
            />

            <Select
              aria-label="서류 필터"
              options={DOCUMENT_STATE_FILTER_OPTIONS}
              value={documentState}
              onChange={withPageReset((event) => setDocumentState(event.target.value))}
              selectBoxClassName="w-32"
            />
          </div>
        </div>

        {incompleteCount > 0 && documentState === "INCOMPLETE" && (
          <div className="border-b border-border-main px-5 py-3">
            <Alert tone="warning" title="근무 전에 받아야 합니다.">
              공지 · 발송 화면의 &lsquo;신규 인력 서류 요청&rsquo; 템플릿으로 한
              번에 요청할 수 있습니다.
            </Alert>
          </div>
        )}

        <Table
          columns={columns}
          rows={data?.content ?? []}
          getRowKey={(staff) => String(staff.staffId)}
          isLoading={isLoading}
          onRowClick={(staff) => setDetailStaffId(staff.staffId)}
          emptyTitle="미제출 인력이 없습니다."
          emptyDescription="모든 활동 인력의 서류가 갖춰져 있습니다."
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
      />

      <StaffFormModal
        isOpen={isFormOpen}
        staff={formStaff}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
};

export default DocumentManager;
