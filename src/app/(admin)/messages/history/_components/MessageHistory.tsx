"use client";

import { useState } from "react";
import { useMessageListQuery } from "@/api/message/getMessageList";
import {
  MESSAGE_CHANNEL_TONE,
  MESSAGE_PURPOSE_FILTER_OPTIONS,
  MESSAGE_STATUS_TONE,
} from "@/constants/messageOptions";
import { useListSearch } from "@/hooks/useListSearch";
import type { CsvColumn } from "@/lib/csv";
import { formatDateTime } from "@/lib/dayjs";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  MESSAGE_CHANNEL_LABEL,
  MESSAGE_PURPOSE_LABEL,
  MESSAGE_STATUS_LABEL,
  type MessageLog,
  type MessagePurpose,
} from "@/type/message";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CsvExportButton from "@/components/ui/CsvExportButton";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import CopyButton from "@/components/domain/CopyButton";
import FeatureNotice from "@/components/domain/FeatureNotice";

const MESSAGE_CSV_COLUMNS: CsvColumn<MessageLog>[] = [
  { header: "발송 일시", value: (row) => formatDateTime(row.sentAt) },
  { header: "용도", value: (row) => MESSAGE_PURPOSE_LABEL[row.purpose] },
  { header: "수단", value: (row) => MESSAGE_CHANNEL_LABEL[row.channel] },
  { header: "행사", value: (row) => row.eventTitle ?? "" },
  { header: "템플릿", value: (row) => row.templateName ?? "" },
  { header: "대상", value: (row) => row.targetCount },
  { header: "성공", value: (row) => row.successCount },
  { header: "실패", value: (row) => row.failCount },
  { header: "발송자", value: (row) => row.sender },
];

/**
 * 발송 이력.
 *
 * "그 공지 보냈던가?"를 확인하는 화면이다.
 * 담당자가 여러 명이 되면 이 기록이 있어야 중복 발송과 누락을 막을 수 있다.
 */
const MessageHistory = () => {
  const { page, setPage, keyword, handleSearch, withPageReset } =
    useListSearch();

  const [purpose, setPurpose] = useState<MessagePurpose | "">("");
  const [detailLog, setDetailLog] = useState<MessageLog | null>(null);

  const { data, isLoading } = useMessageListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    purpose: purpose || undefined,
  });

  const columns: TableColumn<MessageLog>[] = [
    {
      key: "sentAt",
      header: "발송 일시",
      numeric: true,
      render: (log) => (
        <span className="text-[13px] text-font-2">
          {formatDateTime(log.sentAt ?? log.createdAt)}
        </span>
      ),
    },
    {
      key: "purpose",
      header: "용도 / 템플릿",
      render: (log) => (
        <TableCellStack
          primary={MESSAGE_PURPOSE_LABEL[log.purpose]}
          secondary={log.templateName ?? "직접 작성"}
        />
      ),
    },
    {
      key: "event",
      header: "행사",
      render: (log) => (
        <span className="text-[13px] text-font-1">{log.eventTitle ?? "-"}</span>
      ),
    },
    {
      key: "channel",
      header: "수단",
      render: (log) => (
        <Badge tone={MESSAGE_CHANNEL_TONE[log.channel]}>
          {MESSAGE_CHANNEL_LABEL[log.channel]}
        </Badge>
      ),
    },
    {
      key: "targetCount",
      header: "대상",
      align: "right",
      numeric: true,
      render: (log) => `${log.targetCount}명`,
    },
    {
      key: "result",
      header: "성공 / 실패",
      align: "right",
      numeric: true,
      render: (log) => (
        <span className={log.failCount > 0 ? "text-danger" : "text-font-1"}>
          {log.successCount} / {log.failCount}
        </span>
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (log) => (
        <Badge tone={MESSAGE_STATUS_TONE[log.status]}>
          {MESSAGE_STATUS_LABEL[log.status]}
        </Badge>
      ),
    },
    {
      key: "sender",
      header: "발송자",
      render: (log) => (
        <span className="text-[13px] text-font-2">{log.sender}</span>
      ),
    },
  ];

  return (
    <>
      <FeatureNotice
        feature="MESSAGE"
        fallback="실제 발송 여부는 기존 문자 앱에서 확인해 주세요. 여기에는 시스템에 기록한 내역만 남습니다."
      />
      <Card noPadding>
        <div className="flex flex-wrap items-center justify-start gap-2.5 border-b border-border-main px-4 py-3 lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={handleSearch}
            placeholder="내용 · 행사명 · 발송자 검색"
          />

          <div className="flex items-center gap-2">
            <CsvExportButton
              fileName="발송이력"
              rows={data?.content ?? []}
              columns={MESSAGE_CSV_COLUMNS}
              disabled={isLoading}
            />

            <Select
              aria-label="용도 필터"
              options={MESSAGE_PURPOSE_FILTER_OPTIONS}
              value={purpose}
              onChange={withPageReset((event) => setPurpose(event.target.value as MessagePurpose | ""))}
              selectBoxClassName="w-36"
            />
          </div>
        </div>

        <Table
          columns={columns}
          rows={data?.content ?? []}
          getRowKey={(log) => String(log.messageId)}
          isLoading={isLoading}
          onRowClick={(log) => setDetailLog(log)}
          emptyTitle="발송 이력이 없습니다."
          emptyDescription="문자 발송 화면에서 첫 안내를 보내 보세요."
        />

        <Pagination
          page={page}
          totalCount={data?.totalCount ?? 0}
          pageSize={DEFAULT_PAGE_SIZE}
          onChange={setPage}
        />
      </Card>

      <Modal
        isOpen={Boolean(detailLog)}
        onClose={() => setDetailLog(null)}
        title="발송 내용"
        description={
          detailLog
            ? `${MESSAGE_PURPOSE_LABEL[detailLog.purpose]} · ${detailLog.targetCount}명 · ${formatDateTime(detailLog.sentAt)}`
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetailLog(null)}>
              닫기
            </Button>
            <CopyButton
              value={detailLog?.content ?? ""}
              label="내용 복사"
              variant="primary"
              size="md"
            />
          </>
        }
      >
        <pre className="rounded-field border border-border-main bg-subtle px-4 py-3 text-[13px] whitespace-pre-wrap text-font-1">
          {detailLog?.content}
        </pre>
      </Modal>
    </>
  );
};

export default MessageHistory;
