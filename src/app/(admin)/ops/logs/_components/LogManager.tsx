"use client";

import { useState } from "react";
import { useLogListQuery } from "@/api/ops/getLogList";
import {
  LOG_DOMAIN_FILTER_OPTIONS,
  LOG_LEVEL_FILTER_OPTIONS,
  LOG_LEVEL_TONE,
} from "@/constants/opsOptions";
import { useListSearch } from "@/hooks/useListSearch";
import type { CsvColumn } from "@/lib/csv";
import { formatDateTimeSecond } from "@/lib/dayjs";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  LOG_DOMAIN_LABEL,
  type LogDomain,
  type LogLevel,
  type OperationLog,
} from "@/type/ops";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CsvExportButton from "@/components/ui/CsvExportButton";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { type TableColumn } from "@/components/ui/Table";

const LOG_CSV_COLUMNS: CsvColumn<OperationLog>[] = [
  { header: "일시", value: (row) => formatDateTimeSecond(row.createdAt) },
  { header: "레벨", value: (row) => row.level },
  { header: "영역", value: (row) => LOG_DOMAIN_LABEL[row.domain] },
  { header: "동작", value: (row) => row.action },
  { header: "수행자", value: (row) => row.actor },
  { header: "내용", value: (row) => row.message },
];

/**
 * 운영 로그.
 *
 * 담당자가 여러 명이 되면 "누가 이걸 바꿨지"가 곧 문제 해결의 시작점이 된다.
 * 모든 변경 요청은 자동으로 여기에 쌓인다.
 */
const LogManager = () => {
  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  const [level, setLevel] = useState<LogLevel | "">("");
  const [domain, setDomain] = useState<LogDomain | "">("");

  const { data, isLoading } = useLogListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    level: level || undefined,
    domain: domain || undefined,
  });

  const columns: TableColumn<OperationLog>[] = [
    {
      key: "createdAt",
      header: "일시",
      width: "180px",
      numeric: true,
      render: (log) => (
        <span className="text-[13px] text-font-2">
          {formatDateTimeSecond(log.createdAt)}
        </span>
      ),
    },
    {
      key: "level",
      header: "레벨",
      render: (log) => (
        <Badge tone={LOG_LEVEL_TONE[log.level]}>{log.level}</Badge>
      ),
    },
    {
      key: "domain",
      header: "영역",
      render: (log) => (
        <Badge tone="neutral">{LOG_DOMAIN_LABEL[log.domain]}</Badge>
      ),
    },
    {
      key: "action",
      header: "동작",
      render: (log) => (
        <span className="text-[13px] text-font-1">{log.action}</span>
      ),
    },
    {
      key: "actor",
      header: "수행자",
      render: (log) => (
        <span className="text-[13px] text-font-2">{log.actor}</span>
      ),
    },
    {
      key: "message",
      header: "내용",
      render: (log) => (
        <span className="text-[13px] text-font-1">{log.message}</span>
      ),
    },
  ];

  return (
    <Card noPadding>
      <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
        <SearchInput
          value={keyword}
          onSearch={handleSearch}
          placeholder="내용 · 수행자 검색"
        />

        <div className="flex flex-wrap items-center gap-2">
          <CsvExportButton
            fileName="운영로그"
            rows={data?.content ?? []}
            columns={LOG_CSV_COLUMNS}
            disabled={isLoading}
          />

          <Select
            aria-label="영역 필터"
            options={LOG_DOMAIN_FILTER_OPTIONS}
            value={domain}
            onChange={withPageReset((event) => setDomain(event.target.value as LogDomain | ""))}
            selectBoxClassName="w-32"
          />

          <Select
            aria-label="레벨 필터"
            options={LOG_LEVEL_FILTER_OPTIONS}
            value={level}
            onChange={withPageReset((event) => setLevel(event.target.value as LogLevel | ""))}
            selectBoxClassName="w-32"
          />
        </div>
      </div>

      <Table
        columns={columns}
        rows={data?.content ?? []}
        getRowKey={(log) => String(log.logId)}
        isLoading={isLoading}
        emptyTitle="기록된 로그가 없습니다."
        emptyDescription="행사 · 인력 · 계약을 변경하면 자동으로 쌓입니다."
      />

      <Pagination
        page={page}
        totalCount={data?.totalCount ?? 0}
        pageSize={DEFAULT_PAGE_SIZE}
        onChange={setPage}
      />
    </Card>
  );
};

export default LogManager;
