"use client";

import { useJobRoleLabel } from "@/store/useOrgStore";
import {
  buildContractDocument,
  buildSampleContract,
  type ContractTemplate,
  type ContractTemplateFormValues,
} from "@/type/contract";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ContractSheetView from "@/components/domain/ContractSheetView";

interface ContractTemplatePreviewModalProps {
  isOpen: boolean;
  /** 편집 중인 템플릿 값. 저장 전 상태 그대로 그린다. */
  values: ContractTemplateFormValues | null;
  onClose: () => void;
}

/**
 * 템플릿 미리보기.
 *
 * 조항 목록만 보고 최종 문서를 상상하기는 어렵다.
 * 자동 조항이 어떤 표로 채워지는지, `{{변수}}`가 무엇으로 바뀌는지,
 * 무엇보다 **A4 몇 장이 되는지**는 실제로 조립해 봐야 안다.
 *
 * 그래서 예시 계약서 한 건을 만들어 실제 문서와 똑같은 함수로 조립한다.
 * (`buildContractDocument` — 미리보기 · 인쇄 · 서명이 모두 쓰는 그 함수다.
 *  여기서만 따로 그리면 "미리보기와 실제가 다르다"는 문제가 생긴다)
 */
const ContractTemplatePreviewModal = ({
  isOpen,
  values,
  onClose,
}: ContractTemplatePreviewModalProps) => {
  const jobRoleLabel = useJobRoleLabel();

  const contract = buildSampleContract();

  /*
    템플릿은 아직 저장 전이라 ID · 사용 횟수 같은 서버 값이 없다.
    문서 조립에 쓰이지 않는 값이므로 그럴듯하게 채워 넣는다.
  */
  const template: ContractTemplate | null = values
    ? {
        ...values,
        templateId: 0,
        usageCount: 0,
        updatedAt: contract.createdAt,
        createdAt: contract.createdAt,
      }
    : null;

  const document =
    template && buildContractDocument(contract, template, jobRoleLabel(contract.role));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="템플릿 미리보기"
      description="예시 값을 넣어 실제 계약서와 같은 방식으로 조립한 문서입니다."
      size="xl"
      onSubmit={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      }
    >
      {document ? (
        <div className="flex flex-col gap-4">
          <Alert tone="info" title="아래 값은 예시입니다.">
            이름 · 근무일 · 임금은 계약서를 만들 때 배치 정보에서 자동으로
            채워집니다. 여기서 확인할 것은 <b>조항 구성과 문구</b>, 그리고{" "}
            <b>인쇄했을 때의 지면</b>입니다.
          </Alert>

          <ContractSheetView document={document} />
        </div>
      ) : null}
    </Modal>
  );
};

export default ContractTemplatePreviewModal;
