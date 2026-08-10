"use client";

import { useState } from "react";
import { useContractTemplateListQuery } from "@/api/contract/getContractTemplateList";
import { useContractTemplateMutation } from "@/api/contract/mutateContractTemplate";
import { useHasPermission } from "@/store/useAdminStore";
import { Edit, Eye, Plus, Trash } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { showErrorToast } from "@/lib/toast";
import { openConfirm } from "@/store/useConfirmStore";
import { CLAUSE_KIND_LABEL, type ContractTemplate } from "@/type/contract";
import { useJobRoleLabel } from "@/store/useOrgStore";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SearchInput from "@/components/ui/SearchInput";
import Skeleton from "@/components/ui/Skeleton";
import ContractTemplateFormModal from "./ContractTemplateFormModal";
import ContractTemplatePreviewModal from "./ContractTemplatePreviewModal";

/**
 * 계약서 템플릿 관리.
 *
 * 기존에는 모든 사람에게 같은 금액이 적힌 계약서가 나갔다.
 * 여기서는 금액 · 시간을 전부 변수로 두고, 직무별로 다른 양식을 쓸 수 있게 한다.
 */
const ContractTemplateManager = () => {
  const jobRoleLabel = useJobRoleLabel();
  const [keyword, setKeyword] = useState("");
  const [formTemplate, setFormTemplate] = useState<ContractTemplate | null>(
    null,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] =
    useState<ContractTemplate | null>(null);

  const { data, isLoading } = useContractTemplateListQuery({
    keyword: keyword || undefined,
  });
  const canWrite = useHasPermission("contract:write");
  const canDelete = useHasPermission("contract:delete");

  const { deleteMutation } = useContractTemplateMutation();

  const templates = data?.items ?? [];

  const handleDelete = (template: ContractTemplate) => {
    openConfirm({
      title: "템플릿을 삭제할까요?",
      description: `'${template.name}' 템플릿을 삭제합니다.`,
      warning: "이미 만들어진 계약서는 그대로 남습니다.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: () =>
        deleteMutation
          .mutateAsync(template.templateId)
          // 기본 템플릿 삭제는 서버가 막으므로 사유를 그대로 보여 준다.
          .catch((error) => showErrorToast(error)),
    });
  };

  return (
    <>
      <Alert tone="info" title="금액은 반드시 변수로 넣습니다.">
        본문에 <code>{"{{시급}}"}</code> 또는 <code>{"{{총지급액}}"}</code> 변수가
        없으면 저장되지 않습니다. 등급과 실근무 시간에 따라 사람마다 다른 금액이
        들어가야 하기 때문입니다.
      </Alert>

      <Card noPadding>
        <div className="flex flex-col gap-2.5 border-b border-border-main px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:px-5 lg:py-3.5">
          <SearchInput
            value={keyword}
            onSearch={setKeyword}
            placeholder="템플릿 이름 · 본문 검색"
          />

          {canWrite && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => {
                setFormTemplate(null);
                setIsFormOpen(true);
              }}
            >
              템플릿 추가
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-card" />
            ))}
          </div>
        )}

        {!isLoading && templates.length === 0 && (
          <EmptyState
            title="등록된 템플릿이 없습니다."
            description="직무별로 다른 계약서를 쓰려면 템플릿부터 만들어 주세요."
            action={
              canWrite ? (
                <Button
                  variant="primary"
                  leftIcon={<Plus size={15} />}
                  onClick={() => {
                    setFormTemplate(null);
                    setIsFormOpen(true);
                  }}
                >
                  템플릿 추가
                </Button>
              ) : undefined
            }
          />
        )}

        {!isLoading && templates.length > 0 && (
          <ul className="flex flex-col divide-y divide-border-main">
            {templates.map((template) => (
              <li key={template.templateId} className="flex gap-5 px-5 py-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold text-font-1">
                      {template.name}
                    </p>
                    {template.isDefault && <Badge tone="brand">기본</Badge>}
                    {!template.isActive && <Badge tone="neutral">미사용</Badge>}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {template.targetRoles.length === 0 ? (
                      <Badge tone="neutral">전 직무 공통</Badge>
                    ) : (
                      template.targetRoles.map((role) => (
                        <Badge key={role} tone="info">
                          {jobRoleLabel(role)}
                        </Badge>
                      ))
                    )}
                  </div>

                  {/*
                    통짜 본문 대신 조항 구성을 보여 준다.
                    템플릿을 고를 때 알고 싶은 것은 문장이 아니라
                    "이 양식에 어떤 조항이 들어 있나"이기 때문이다.
                  */}
                  <div className="flex flex-wrap gap-1">
                    {template.clauses.map((clause) => (
                      <span
                        key={clause.clauseId}
                        title={CLAUSE_KIND_LABEL[clause.kind]}
                        className="rounded-field border border-border-main bg-subtle px-2 py-0.5 text-[11px] text-font-2"
                      >
                        {clause.title}
                        {clause.kind !== "TEXT" && (
                          <span className="ml-1 text-info">자동</span>
                        )}
                      </span>
                    ))}
                  </div>

                  <p className="text-[12px] text-font-2">
                    {template.documentTitle} · {template.companyName}
                    {template.requiresGuardianSignature && " · 친권자 서명 포함"}
                  </p>

                  <p className="text-[12px] text-font-2 tabular-nums">
                    사용 {template.usageCount}회 · 최근 수정{" "}
                    {formatDate(template.updatedAt)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  {/* 조항 목록만 보고는 최종 문서가 몇 장짜리인지 알 수 없다. */}
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Eye size={14} />}
                    onClick={() => setPreviewTemplate(template)}
                  >
                    미리보기
                  </Button>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Edit size={14} />}
                      onClick={() => {
                        setFormTemplate(template);
                        setIsFormOpen(true);
                      }}
                    >
                      수정
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="dangerGhost"
                      leftIcon={<Trash size={14} />}
                      disabled={template.isDefault}
                      onClick={() => handleDelete(template)}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ContractTemplateFormModal
        isOpen={isFormOpen}
        template={formTemplate}
        onClose={() => setIsFormOpen(false)}
      />

      <ContractTemplatePreviewModal
        isOpen={previewTemplate !== null}
        values={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
      />
    </>
  );
};

export default ContractTemplateManager;
