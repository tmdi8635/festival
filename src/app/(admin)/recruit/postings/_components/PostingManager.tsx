"use client";

import { useState } from "react";
import { formatTimeRange } from "@/type/event";
import { usePostingListQuery } from "@/api/recruit/getPostingList";
import { usePostingMutation } from "@/api/recruit/mutatePosting";
import {
  POSTING_STATUS_FILTER_OPTIONS,
  POSTING_STATUS_TONE,
} from "@/constants/recruitOptions";
import { useKeywordParam } from "@/hooks/useKeywordParam";
import { Ban, Edit, Eye, Plus } from "@/icons";
import { formatDate, formatDday } from "@/lib/dayjs";
import { openConfirm } from "@/store/useConfirmStore";
import { useJobRoleFilterOptions, useJobRoleLabel } from "@/store/useOrgStore";
import { DEFAULT_PAGE_SIZE } from "@/type/api";
import {
  POSTING_STATUS_LABEL,
  type JobPosting,
  type PostingStatus,
} from "@/type/recruit";
import { type JobRole } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dropdown, { type DropdownItem } from "@/components/ui/Dropdown";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { TableCellStack, type TableColumn } from "@/components/ui/Table";
import WageText from "@/components/domain/WageText";
import CopyButton from "@/components/domain/CopyButton";
import PostingFormModal from "./PostingFormModal";
import FeatureNotice from "@/components/domain/FeatureNotice";

/**
 * 공고 관리.
 *
 * 지금 워크플로는 "오픈카톡방에 글을 올리고 문자로 받는다"이다.
 * 그 글을 시스템이 만들어 주고, 어느 공고가 몇 명 찼는지를 기록으로 남긴다.
 */
const PostingManager = () => {
  const jobRoleLabel = useJobRoleLabel();
  const jobRoleFilterOptions = useJobRoleFilterOptions();
  const [page, setPage] = useState(1);
  const keywordParam = useKeywordParam();
  const [draftKeyword, setDraftKeyword] = useState<string | null>(null);
  const keyword = draftKeyword ?? keywordParam;

  const [status, setStatus] = useState<PostingStatus | "">("");
  const [role, setRole] = useState<JobRole | "">("");

  const [formPosting, setFormPosting] = useState<JobPosting | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [previewPosting, setPreviewPosting] = useState<JobPosting | null>(null);

  const { data, isLoading } = usePostingListQuery({
    page,
    size: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
    status: status || undefined,
    role: role || undefined,
  });

  const { statusMutation } = usePostingMutation();

  const handleSearch = (nextKeyword: string) => {
    setDraftKeyword(nextKeyword);
    setPage(1);
  };

  const handleClose = (posting: JobPosting) => {
    openConfirm({
      title: "공고를 마감할까요?",
      description: `'${posting.title}' 공고를 마감 상태로 바꿉니다.`,
      confirmText: "마감",
      onConfirm: () =>
        statusMutation.mutateAsync({
          postingId: posting.postingId,
          status: "CLOSED",
        }),
    });
  };

  const buildRowActions = (posting: JobPosting): DropdownItem[] => [
    {
      label: "공고문 보기",
      icon: <Eye size={15} />,
      onSelect: () => setPreviewPosting(posting),
    },
    {
      label: "수정",
      icon: <Edit size={15} />,
      onSelect: () => {
        setFormPosting(posting);
        setIsFormOpen(true);
      },
    },
    {
      label: "마감",
      icon: <Ban size={15} />,
      tone: "danger",
      disabled: posting.status === "CLOSED" || posting.status === "FILLED",
      onSelect: () => handleClose(posting),
    },
  ];

  const columns: TableColumn<JobPosting>[] = [
    {
      key: "title",
      header: "공고",
      render: (posting) => (
        <TableCellStack
          primary={posting.title}
          secondary={`${posting.clientName} · ${posting.venue}`}
        />
      ),
    },
    {
      key: "workDate",
      header: "근무일",
      numeric: true,
      render: (posting) => (
        <TableCellStack
          primary={
            <span className="tabular-nums">{formatDate(posting.workDate)}</span>
          }
          secondary={
            <span className="tabular-nums">
              {formatTimeRange(
                posting.startTime,
                posting.endTime,
                posting.endDayOffset,
              )}{" "}
              ·{" "}
              {formatDday(posting.workDate)}
            </span>
          }
        />
      ),
    },
    {
      key: "role",
      header: "직무",
      render: (posting) => (
        <Badge tone="neutral">{jobRoleLabel(posting.role)}</Badge>
      ),
    },
    {
      key: "wage",
      header: "임금",
      align: "right",
      numeric: true,
      render: (posting) => (
        <WageText wageType={posting.wageType} wage={posting.wage} />
      ),
    },
    {
      key: "progress",
      header: "확정 / 모집",
      align: "right",
      numeric: true,
      render: (posting) => (
        <span
          className={
            posting.confirmedCount < posting.requiredCount
              ? "font-medium text-warning"
              : "text-success"
          }
        >
          {posting.confirmedCount} / {posting.requiredCount}
        </span>
      ),
    },
    {
      key: "applicantCount",
      header: "지원자",
      align: "right",
      numeric: true,
      render: (posting) => `${posting.applicantCount}명`,
    },
    {
      key: "status",
      header: "상태",
      render: (posting) => (
        <Badge tone={POSTING_STATUS_TONE[posting.status]}>
          {POSTING_STATUS_LABEL[posting.status]}
        </Badge>
      ),
    },
    {
      key: "copy",
      header: "",
      width: "110px",
      align: "right",
      render: (posting) => (
        <div
          className="flex justify-end"
          onClick={(event) => event.stopPropagation()}
        >
          <CopyButton
            value={posting.content}
            label="공고문"
            successMessage="공고문을 복사했습니다. 오픈카톡방에 붙여넣으세요."
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "56px",
      align: "center",
      render: (posting) => (
        <div
          className="flex justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <Dropdown items={buildRowActions(posting)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <FeatureNotice
        feature="RECRUIT"
        fallback="행사에 사람이 필요하면 인력풀에서 직접 골라 배치하고, 모집 문구는 여기서 만들어 복사해 오픈카톡방에 올려 주세요."
      />
      <Card noPadding>
        <div className="flex items-center justify-between gap-3 border-b border-border-main px-5 py-3.5">
          <SearchInput
            value={keyword}
            onSearch={handleSearch}
            placeholder="공고명 · 행사명 · 거래처 검색"
          />

          <div className="flex items-center gap-2">
            <Select
              aria-label="직무 필터"
              options={jobRoleFilterOptions}
              value={role}
              onChange={(event) => {
                setRole(event.target.value as JobRole | "");
                setPage(1);
              }}
              selectBoxClassName="w-32"
            />

            <Select
              aria-label="상태 필터"
              options={POSTING_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as PostingStatus | "");
                setPage(1);
              }}
              selectBoxClassName="w-32"
            />

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => {
                setFormPosting(null);
                setIsFormOpen(true);
              }}
            >
              공고 등록
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          rows={data?.content ?? []}
          getRowKey={(posting) => String(posting.postingId)}
          isLoading={isLoading}
          onRowClick={(posting) => setPreviewPosting(posting)}
          emptyTitle="등록된 공고가 없습니다."
          emptyDescription="인원이 덜 찬 행사가 있으면 공고부터 만들어 보세요."
          emptyAction={
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              onClick={() => {
                setFormPosting(null);
                setIsFormOpen(true);
              }}
            >
              공고 등록
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

      <PostingFormModal
        isOpen={isFormOpen}
        posting={formPosting}
        onClose={() => setIsFormOpen(false)}
      />

      <Modal
        isOpen={Boolean(previewPosting)}
        onClose={() => setPreviewPosting(null)}
        title="공고문"
        description={previewPosting?.title}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreviewPosting(null)}>
              닫기
            </Button>
            <CopyButton
              value={previewPosting?.content ?? ""}
              label="복사하기"
              variant="primary"
              size="md"
              successMessage="공고문을 복사했습니다. 오픈카톡방에 붙여넣으세요."
            />
          </>
        }
      >
        <pre className="rounded-field border border-border-main bg-subtle px-4 py-3 text-[13px] whitespace-pre-wrap text-font-1">
          {previewPosting?.content}
        </pre>
      </Modal>
    </>
  );
};

export default PostingManager;
