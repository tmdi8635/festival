"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useContractTemplateMutation } from "@/api/contract/mutateContractTemplate";
import { ArrowDown, ArrowUp, Eye, Info, Plus, Trash } from "@/icons";
import {
  EMPTY_CONTRACT_TEMPLATE_VALUES,
  contractTemplateSchema,
  type ContractTemplateSchema,
} from "@/schema/contract.schema";
import { useActiveJobRoles } from "@/store/useOrgStore";
import {
  CLAUSE_KIND_HINT,
  CLAUSE_KIND_LABEL,
  CONTRACT_VARIABLES,
  type ClauseKind,
  type ContractTemplate,
} from "@/type/contract";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import FormField from "@/components/ui/FormField";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";
import Textarea from "@/components/ui/Textarea";
import ContractTemplatePreviewModal from "./ContractTemplatePreviewModal";

interface ContractTemplateFormModalProps {
  isOpen: boolean;
  template: ContractTemplate | null;
  onClose: () => void;
}

const CLAUSE_KIND_OPTIONS = (
  ["PARTIES", "WORK_CONDITION", "WAGE", "TEXT"] as const
).map((kind) => ({ label: CLAUSE_KIND_LABEL[kind], value: kind }));

/** 변수 목록을 그룹별로 묶어 보여 준다. 한 줄로 늘어놓으면 찾기 어렵다. */
const VARIABLE_GROUPS = [...new Set(CONTRACT_VARIABLES.map((v) => v.group))];

/**
 * 계약서 템플릿 빌더.
 *
 * 예전에는 계약서가 통짜 문자열이었다. 그래서 두 가지 문제가 있었다.
 * 하나는 에이전시마다 다른 양식을 담을 수 없었던 것,
 * 다른 하나는 시급·이름 같은 핵심 값이 사람의 오타에 걸렸던 것이다.
 *
 * 그래서 계약서를 **조항 묶음**으로 다룬다.
 * 인적사항 · 근로조건 · 임금은 '자동 조항'이라 본문을 쓸 수 없고,
 * 배치 정보에서 표로 채워진다. 나머지 문구만 자유롭게 쓴다.
 */
const ContractTemplateFormModal = ({
  isOpen,
  template,
  onClose,
}: ContractTemplateFormModalProps) => {
  const { createMutation, updateMutation } = useContractTemplateMutation();
  const jobRoles = useActiveJobRoles();

  // 미리보기는 저장 전 값으로 연다. 저장해야 확인할 수 있으면 미리보기가 아니다.
  const [previewValues, setPreviewValues] =
    useState<ContractTemplateSchema | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ContractTemplateSchema>({
    resolver: zodResolver(contractTemplateSchema),
    defaultValues: EMPTY_CONTRACT_TEMPLATE_VALUES,
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "clauses",
  });

  useEffect(() => {
    if (!isOpen) return;

    reset(
      template
        ? {
            name: template.name,
            targetRoles: template.targetRoles,
            documentTitle: template.documentTitle,
            companyName: template.companyName,
            companyRepresentative: template.companyRepresentative,
            companyRegistrationNumber: template.companyRegistrationNumber,
            companyAddress: template.companyAddress,
            companyPhone: template.companyPhone,
            clauses: template.clauses,
            agreementNote: template.agreementNote,
            requiresGuardianSignature: template.requiresGuardianSignature,
            isDefault: template.isDefault,
            isActive: template.isActive,
          }
        : EMPTY_CONTRACT_TEMPLATE_VALUES,
    );
  }, [isOpen, template, reset]);

  const clauses = watch("clauses") ?? [];

  const onSubmit = handleSubmit((values) => {
    if (template) {
      updateMutation.mutate(
        { templateId: template.templateId, body: values },
        { onSuccess: onClose },
      );

      return;
    }

    createMutation.mutate(values, { onSuccess: onClose });
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={template ? "템플릿 수정" : "템플릿 추가"}
      description="조항을 자유롭게 넣고 빼서 우리 회사 양식을 만듭니다. 저장해 두면 계약서를 만들 때 골라 씁니다."
      size="xl"
      onSubmit={onSubmit}
      footer={
        <>
          {/*
            미리보기는 저장과 나란히 둔다.
            조항을 손볼 때마다 "이게 문서로 어떻게 나오지"를 확인하게 되는데,
            저장한 뒤 목록에서 다시 열어 봐야 한다면 아무도 확인하지 않는다.
          */}
          <Button
            variant="secondary"
            leftIcon={<Eye size={15} />}
            onClick={() => setPreviewValues(getValues())}
            className="mr-auto"
          >
            미리보기
          </Button>

          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {template ? "저장" : "추가"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="템플릿 이름"
            required
            hint="내부에서 구분하는 이름입니다."
            error={errors.name?.message}
          >
            <Input {...register("name")} hasError={Boolean(errors.name)} />
          </FormField>

          <FormField
            label="문서 제목"
            required
            hint="계약서 맨 위에 인쇄되는 제목입니다."
            error={errors.documentTitle?.message}
          >
            <Input
              {...register("documentTitle")}
              hasError={Boolean(errors.documentTitle)}
            />
          </FormField>
        </div>

        <FormField
          label="적용 직무"
          hint="비워 두면 전 직무 공통으로 씁니다."
          error={errors.targetRoles?.message}
        >
          <Controller
            control={control}
            name="targetRoles"
            render={({ field }) => (
              <div className="flex flex-wrap gap-3 rounded-field border border-border-main px-3 py-2.5">
                {jobRoles.map((role) => (
                  <Checkbox
                    key={role.code}
                    label={role.name}
                    checked={field.value.includes(role.code)}
                    onChange={(event) =>
                      field.onChange(
                        event.target.checked
                          ? [...field.value, role.code]
                          : field.value.filter((item) => item !== role.code),
                      )
                    }
                  />
                ))}
              </div>
            )}
          />
        </FormField>

        {/* 사업주 정보 */}
        <div className="flex flex-col gap-3 rounded-card border border-border-main p-4">
          <p className="text-[14px] font-semibold text-font-1">
            사업주 (갑) 정보
          </p>
          <p className="-mt-2 text-[12px] text-font-2">
            계약서마다 같은 값이 들어갑니다. 여기서 한 번만 적어 두세요.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="상호" required error={errors.companyName?.message}>
              <Input
                {...register("companyName")}
                placeholder="예) 휴먼커넥트 이벤트"
                hasError={Boolean(errors.companyName)}
              />
            </FormField>

            <FormField
              label="대표자"
              required
              error={errors.companyRepresentative?.message}
            >
              <Input
                {...register("companyRepresentative")}
                hasError={Boolean(errors.companyRepresentative)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="사업자등록번호"
              hint="000-00-00000"
              error={errors.companyRegistrationNumber?.message}
            >
              <Input
                {...register("companyRegistrationNumber")}
                placeholder="312-81-40217"
                hasError={Boolean(errors.companyRegistrationNumber)}
              />
            </FormField>

            <FormField label="대표 전화" error={errors.companyPhone?.message}>
              <Input {...register("companyPhone")} />
            </FormField>
          </div>

          <FormField
            label="사업장 주소"
            required
            error={errors.companyAddress?.message}
          >
            <Input
              {...register("companyAddress")}
              hasError={Boolean(errors.companyAddress)}
            />
          </FormField>
        </div>

        {/* 조항 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold text-font-1">
                조항
                <span className="ml-0.5 text-font-error">*</span>
              </p>
              <p className="mt-0.5 text-[12px] text-font-2">
                위에서부터 순서대로 인쇄됩니다. 화살표로 순서를 바꾸세요.
              </p>
            </div>

            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus size={14} />}
              onClick={() =>
                append({
                  clauseId: `clause-${Date.now()}`,
                  title: `제${fields.length + 1}조 ()`,
                  kind: "TEXT",
                  body: "",
                })
              }
            >
              조항 추가
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {fields.map((field, index) => {
              const kind = clauses[index]?.kind ?? "TEXT";
              const isAuto = kind !== "TEXT";

              return (
                <div
                  key={field.id}
                  className="flex flex-col gap-2 rounded-field border border-border-main p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center text-[13px] text-font-2 tabular-nums">
                      {index + 1}
                    </span>

                    <Input
                      aria-label="조항 제목"
                      {...register(`clauses.${index}.title`)}
                      placeholder="제1조 (근로조건)"
                      inputBoxClassName="flex-1"
                      hasError={Boolean(errors.clauses?.[index]?.title)}
                    />

                    <Controller
                      control={control}
                      name={`clauses.${index}.kind`}
                      render={({ field: kindField }) => (
                        <Select
                          aria-label="조항 종류"
                          options={CLAUSE_KIND_OPTIONS}
                          value={kindField.value}
                          onChange={(event) =>
                            kindField.onChange(event.target.value as ClauseKind)
                          }
                          selectBoxClassName="w-52"
                        />
                      )}
                    />

                    <IconButton
                      label="위로"
                      icon={<ArrowUp size={15} />}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    />
                    <IconButton
                      label="아래로"
                      icon={<ArrowDown size={15} />}
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    />
                    <IconButton
                      label="조항 삭제"
                      icon={<Trash size={15} />}
                      tone="danger"
                      disabled={fields.length <= 1}
                      onClick={() => remove(index)}
                    />
                  </div>

                  {isAuto ? (
                    /*
                      자동 조항은 본문을 쓸 수 없다.
                      사람이 옮겨 적는 순간 시급이 틀리기 시작하기 때문이다.
                    */
                    <div className="flex items-start gap-2 rounded-field bg-subtle px-3 py-2">
                      <Info size={14} className="mt-0.5 shrink-0 text-info" />
                      <div>
                        <Badge tone="info">자동 입력</Badge>
                        <p className="mt-1 text-[12px] text-font-2">
                          {CLAUSE_KIND_HINT[kind]}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Textarea
                      aria-label="조항 본문"
                      {...register(`clauses.${index}.body`)}
                      rows={4}
                      placeholder="조항 본문을 입력하세요. {{변수}}를 넣으면 실제 값으로 바뀝니다."
                    />
                  )}
                </div>
              );
            })}
          </div>

          <p className="min-h-4 text-[12px] text-font-error">
            {errors.clauses?.message ?? errors.clauses?.root?.message}
          </p>
        </div>

        {/* 변수 안내 */}
        <Alert tone="info" title="자유 조항에서 쓸 수 있는 변수">
          <div className="mt-1.5 flex flex-col gap-1.5">
            {VARIABLE_GROUPS.map((group) => (
              <div key={group} className="flex flex-wrap items-baseline gap-2">
                <span className="w-14 shrink-0 text-[12px] font-medium">
                  {group}
                </span>
                <div className="flex flex-1 flex-wrap gap-x-3 gap-y-1">
                  {CONTRACT_VARIABLES.filter(
                    (variable) => variable.group === group,
                  ).map((variable) => (
                    <span key={variable.token} className="text-[12px]">
                      <code className="rounded-[4px] bg-surface px-1 py-0.5 text-font-1">
                        {variable.token}
                      </code>{" "}
                      {variable.description}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Alert>

        {/* 서명란 */}
        <FormField
          label="서명 확인 문구"
          hint="서명란 바로 위에 들어갑니다."
          error={errors.agreementNote?.message}
        >
          <Textarea {...register("agreementNote")} rows={2} />
        </FormField>

        <div className="flex flex-col gap-3 rounded-field border border-border-main px-4 py-3">
          <Controller
            control={control}
            name="requiresGuardianSignature"
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] text-font-1">친권자 서명란</p>
                  <p className="mt-0.5 text-[12px] text-font-2">
                    18세 미만 근로자와 계약할 때 켭니다. 서명란이 하나 더
                    생깁니다.
                  </p>
                </div>
                <Switch
                  label="친권자 서명란"
                  checked={field.value}
                  onChange={field.onChange}
                />
              </div>
            )}
          />

          <Controller
            control={control}
            name="isDefault"
            render={({ field }) => (
              <div className="flex items-center justify-between border-t border-border-main pt-3">
                <div>
                  <p className="text-[14px] text-font-1">기본 템플릿</p>
                  <p className="mt-0.5 text-[12px] text-font-2">
                    계약서를 만들 때 자동으로 선택됩니다. 한 개만 지정할 수
                    있습니다.
                  </p>
                </div>
                <Switch
                  label="기본 템플릿"
                  checked={field.value}
                  onChange={field.onChange}
                />
              </div>
            )}
          />

          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between border-t border-border-main pt-3">
                <div>
                  <p className="text-[14px] text-font-1">사용</p>
                  <p className="mt-0.5 text-[12px] text-font-2">
                    끄면 계약서 생성 시 선택지에서 사라집니다. 이미 만들어진
                    계약서는 그대로 유지됩니다.
                  </p>
                </div>
                <Switch
                  label="사용 여부"
                  checked={field.value}
                  onChange={field.onChange}
                />
              </div>
            )}
          />
        </div>
      </form>

      <ContractTemplatePreviewModal
        isOpen={previewValues !== null}
        values={previewValues}
        onClose={() => setPreviewValues(null)}
      />
    </Modal>
  );
};

export default ContractTemplateFormModal;
