"use client";

import { useState } from "react";
import { useClientListQuery } from "@/api/client/getClientList";
import { useListSearch } from "@/hooks/useListSearch";
import { Building, Edit, Plus, TrendUp } from "@/icons";
import type { CsvColumn } from "@/lib/csv";
import { formatDate } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import { calculateMarginRate, type Client } from "@/type/client";
import { formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CsvExportButton from "@/components/ui/CsvExportButton";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import StatTile from "@/components/domain/StatTile";
import { useHasPermission } from "@/store/useAdminStore";
import ClientFormModal from "./ClientFormModal";

const ACTIVE_FILTER_OPTIONS = [
  { label: "전체", value: "" },
  { label: "거래 중", value: "true" },
  { label: "거래 종료", value: "false" },
];

const CLIENT_CSV_COLUMNS: CsvColumn<Client>[] = [
  { header: "거래처명", value: (row) => row.name },
  { header: "사업자등록번호", value: (row) => row.businessNumber },
  { header: "담당자", value: (row) => row.managerName },
  { header: "담당자 연락처", value: (row) => formatPhoneNumber(row.managerPhone) },
  { header: "행사 건수", value: (row) => row.eventCount },
  { header: "누적 매출", value: (row) => row.totalRevenue },
  { header: "누적 인건비", value: (row) => row.totalLaborCost },
  {
    header: "마진율(%)",
    value: (row) => calculateMarginRate(row.totalRevenue, row.totalLaborCost),
  },
  {
    header: "스태프 청구 단가",
    value: (row) =>
      row.billingRates.find((rate) => rate.role === "STAFF")?.rate ?? 0,
  },
  { header: "거래 상태", value: (row) => (row.isActive ? "거래 중" : "종료") },
];

/**
 * 거래처 관리.
 *
 * 발주처별 단가와 마진을 보면 "받을수록 손해인 거래처"가 드러난다.
 * 조건을 다시 협의할 근거가 되는 화면이다.
 */
const ClientManager = () => {
  /* 권한이 없으면 버튼 자체를 두지 않는다. 눌러 보고 거부당하는 것보다 낫다. */
  const canWrite = useHasPermission("client:write");

  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  const [isActive, setIsActive] = useState("");
  const [formClient, setFormClient] = useState<Client | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data, isLoading } = useClientListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    isActive: isActive || undefined,
  });

  const clients = data?.content ?? [];
  const totalRevenue = clients.reduce((sum, client) => sum + client.totalRevenue, 0);
  const totalLaborCost = clients.reduce(
    (sum, client) => sum + client.totalLaborCost,
    0,
  );

  const columns: TableColumn<Client>[] = [
    {
      key: "name",
      header: "거래처",
      render: (client) => (
        <div className="flex min-w-0 items-center gap-2">
          <TableCellStack
            primary={client.name}
            secondary={client.businessNumber || "사업자번호 미등록"}
          />
          {!client.isActive && <Badge tone="neutral">거래 종료</Badge>}
        </div>
      ),
    },
    {
      key: "manager",
      header: "담당자",
      render: (client) => (
        <TableCellStack
          primary={client.managerName}
          secondary={
            <span className="tabular-nums">
              {formatPhoneNumber(client.managerPhone)}
            </span>
          }
        />
      ),
    },
    {
      key: "eventCount",
      header: "행사",
      align: "right",
      numeric: true,
      render: (client) => `${client.eventCount}건`,
    },
    {
      key: "staffRate",
      header: "스태프 단가",
      align: "right",
      numeric: true,
      render: (client) =>
        formatCurrency(
          client.billingRates.find((rate) => rate.role === "STAFF")?.rate ?? 0,
        ),
    },
    {
      key: "totalRevenue",
      header: "누적 매출",
      align: "right",
      numeric: true,
      render: (client) => formatCurrency(client.totalRevenue),
    },
    {
      key: "margin",
      header: "마진율",
      align: "right",
      numeric: true,
      render: (client) => {
        const rate = calculateMarginRate(
          client.totalRevenue,
          client.totalLaborCost,
        );

        return (
          <span
            className={
              rate < 20 ? "font-medium text-danger" : "font-medium text-success"
            }
          >
            {rate}%
          </span>
        );
      },
    },
    {
      key: "lastEventDate",
      header: "최근 행사",
      numeric: true,
      render: (client) => (
        <span className="text-[13px] text-font-2">
          {formatDate(client.lastEventDate)}
        </span>
      ),
    },
    {
      key: "memo",
      header: "메모",
      render: (client) => (
        <p className="max-w-64 truncate text-[13px] text-font-2">
          {client.memo || "-"}
        </p>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "90px",
      align: "right",
      render: (client) => (
        <div
          className="flex justify-end"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Edit size={14} />}
            onClick={() => {
              setFormClient(client);
              setIsFormOpen(true);
            }}
          >
            수정
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile
          label="거래처"
          value={`${data?.totalCount ?? 0}곳`}
          icon={<Building size={18} />}
        />
        <StatTile label="누적 매출" value={formatCurrency(totalRevenue)} />
        <StatTile
          label="전체 마진율"
          value={`${calculateMarginRate(totalRevenue, totalLaborCost)}%`}
          description={`누적 인건비 ${formatCurrency(totalLaborCost)}`}
          icon={<TrendUp size={18} />}
        />
      </div>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={handleSearch}
            placeholder="거래처명 · 담당자 검색"
          />

          <div className="flex flex-wrap items-center gap-2">
            <CsvExportButton
              fileName="거래처목록"
              rows={clients}
              columns={CLIENT_CSV_COLUMNS}
              disabled={isLoading}
            />

            <Select
              aria-label="거래 상태 필터"
              options={ACTIVE_FILTER_OPTIONS}
              value={isActive}
              onChange={withPageReset((event) => setIsActive(event.target.value))}
              selectBoxClassName="w-32"
            />

            {canWrite && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={15} />}
                onClick={() => {
                  setFormClient(null);
                  setIsFormOpen(true);
                }}
              >
                거래처 등록
              </Button>
            )}
          </div>
        </div>

        <Table
          columns={columns}
          rows={clients}
          getRowKey={(client) => String(client.clientId)}
          isLoading={isLoading}
          onRowClick={(client) => {
            setFormClient(client);
            setIsFormOpen(true);
          }}
          emptyTitle="등록된 거래처가 없습니다."
          emptyDescription="행사를 등록하려면 거래처가 먼저 필요합니다."
          emptyAction={
            canWrite ? (
              <Button
                variant="primary"
                leftIcon={<Plus size={15} />}
                onClick={() => {
                  setFormClient(null);
                  setIsFormOpen(true);
                }}
              >
                거래처 등록
              </Button>
            ) : undefined
          }
        />

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={DEFAULT_PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      <ClientFormModal
        isOpen={isFormOpen}
        client={formClient}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
};

export default ClientManager;
