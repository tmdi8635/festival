"use client";

import { useState } from "react";
import { useStaffListQuery } from "@/api/staff/getStaffList";
import {
  DOCUMENT_REVIEW_STATE_TONE,
  DOCUMENT_STATE_FILTER_OPTIONS,
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
} from "@/constants/staffOptions";
import { useListSearch } from "@/hooks/useListSearch";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  DOCUMENT_REVIEW_STATE_LABEL,
  formatPhoneNumber,
  type Staff,
} from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CsvExportButton from "@/components/ui/CsvExportButton";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { type TableColumn } from "@/components/ui/Table";
import StaffCell from "@/components/domain/StaffCell";
import StaffDocumentReviewModal from "@/components/domain/StaffDocumentReviewModal";

const DOCUMENT_CSV_COLUMNS: CsvColumn<Staff>[] = [
  { header: "이름", value: (row) => row.name },
  { header: "연락처", value: (row) => formatPhoneNumber(row.phoneNumber) },
  { header: "상태", value: (row) => STAFF_STATUS_LABEL[row.status] },
  {
    header: "서류 심사",
    value: (row) => DOCUMENT_REVIEW_STATE_LABEL[row.documentReviewState],
  },
  { header: "누적 근무", value: (row) => row.workCount },
  { header: "등록일", value: (row) => formatDate(row.createdAt) },
];

/**
 * 서류 관리.
 *
 * "첫 근무자면 신분증과 통장사본을 받는다"를 사람 기억이 아니라 목록으로 만든다.
 *
 * 본인이 직접 올리게 되면서 이 화면의 일이 **추적에서 심사로** 바뀌었다.
 * 예전에는 "누가 아직 안 냈나"만 보면 됐지만, 이제는 올라온 사본을 열어 보고
 * 승인하거나 되돌려 보내야 한다. 그래서 기본 필터가 미제출이 아니라 **승인 대기**다.
 * 화면을 열자마자 지금 손이 가야 하는 줄이 위에 있어야 한다.
 */
const DocumentManager = () => {
  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  // 기본값을 '승인 대기'로 두어 화면을 열자마자 할 일이 보이게 한다.
  const [documentState, setDocumentState] = useState("SUBMITTED");

  /*
    이 화면은 심사 모달 하나만 연다.

    예전에는 줄을 누르면 인력 상세가 열리고 거기서 수정 폼으로 이어졌는데,
    그 길은 인력풀에도 그대로 있다. 같은 길을 두 화면에 두면 이 화면이
    무엇을 하는 자리인지 흐려진다. 사람 기록 전체를 볼 일은 인력풀에서 한다.
  */
  const [reviewStaffId, setReviewStaffId] = useState<number | null>(null);

  const { data, isLoading } = useStaffListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    documentState: documentState || undefined,
    /*
      상태 필터를 걸지 않는다.

      예전에는 `status: "ACTIVE"`로 걸러 활동 인력만 봤는데, 승인이 상태를 정하게 되면서
      그 조건이 **심사해야 할 사람을 정확히 빼 버리는** 필터가 됐다.
      아직 승인 안 된 사람은 대기중(PENDING)이고, 그 사람들이 이 화면의 일감이다.
    */
  });

  /**
   * 승인을 기다리는 인원.
   *
   * 목록을 다른 조건으로 걸러 놓았어도 대기 중인 건이 남아 있으면 알려야 해서
   * 한 건만 따로 센다. (제출률은 세지 않는다 — 여기서 할 일은 비율이 아니라
   * 올라온 사본을 열어 보고 판단하는 것이다)
   */
  const { data: waitingData } = useStaffListQuery({
    page: 1,
    size: 1,
    documentState: "SUBMITTED",
  });

  const waitingCount = waitingData?.totalCount ?? 0;

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
      header: "서류 심사",
      align: "center",
      render: (staff) => (
        <Badge tone={DOCUMENT_REVIEW_STATE_TONE[staff.documentReviewState]}>
          {DOCUMENT_REVIEW_STATE_LABEL[staff.documentReviewState]}
        </Badge>
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

        '활동 인력 84명 · 승인 대기 6명 · 승인율 93%'는 세 칸이 전부 같은 것을
        말하고, 그중 무엇도 여기서 할 일을 알려 주지 않는다. 이 화면에서 하는
        일은 **올라온 사본을 열어 보고 판단하는 것** 하나이고, 그건 아래 목록이
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

        {waitingCount > 0 && (
          <div className="border-b border-border-main px-5 py-3">
            <Alert
              tone="warning"
              title={`승인을 기다리는 서류가 ${waitingCount}명 있습니다.`}
            >
              줄을 눌러 사본을 확인하고 승인하거나 반려해 주세요. 승인 전에는
              확정 배치를 할 수 없습니다.
            </Alert>
          </div>
        )}

        <Table
          columns={columns}
          rows={data?.content ?? []}
          getRowKey={(staff) => String(staff.staffId)}
          isLoading={isLoading}
          /*
            줄을 누르면 인력 상세가 아니라 **심사 모달**이 열린다.
            이 화면에 온 이유가 그것 하나이고, 사본을 보려면 상세에서 탭을 한 번 더
            눌러야 하는 구조라면 결국 아무도 열어 보지 않고 승인하게 된다.
          */
          onRowClick={(staff) => setReviewStaffId(staff.staffId)}
          emptyTitle="심사할 서류가 없습니다."
          emptyDescription="이 조건에 해당하는 인력이 없습니다."
        />

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={DEFAULT_PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      <StaffDocumentReviewModal
        staffId={reviewStaffId}
        onClose={() => setReviewStaffId(null)}
      />

    </>
  );
};

export default DocumentManager;
