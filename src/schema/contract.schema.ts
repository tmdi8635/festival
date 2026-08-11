import { z } from "zod";
import { DEFAULT_CONTRACT_CLAUSES } from "@/type/contract";
import { JOB_ROLE_CODES } from "@/type/staff";

/** 계약서 조항 스키마 */
export const contractClauseSchema = z.object({
  clauseId: z.string().min(1),
  title: z
    .string()
    .min(2, "조항 제목을 입력해 주세요.")
    .max(60, "60자 이내로 입력해 주세요."),
  kind: z.enum(["PARTIES", "WORK_CONDITION", "WAGE", "TEXT"]),
  body: z.string().max(2000, "2000자 이내로 입력해 주세요."),
});

/**
 * 근로계약서 템플릿 폼 스키마.
 *
 * 예전에는 본문 한 덩어리에 `{{시급}}`이 들어 있는지만 확인했다.
 * 이제 임금·인적사항·근로조건은 자동 조항이 책임지므로,
 * "그 조항이 문서에 들어 있는가"를 대신 검사한다.
 * 사람이 실수로 임금 조항을 빼고 저장하는 일을 막는 것이 목적이다.
 */
export const contractTemplateSchema = z.object({
  name: z
    .string()
    .min(2, "템플릿 이름을 2자 이상 입력해 주세요.")
    .max(50, "50자 이내로 입력해 주세요."),
  /* 적용 직무도 시스템 목록에서만 고른다. 계약서에 그대로 인쇄되는 말이다. */
  targetRoles: z.array(z.enum(JOB_ROLE_CODES)),
  documentTitle: z
    .string()
    .min(2, "문서 제목을 입력해 주세요.")
    .max(40, "40자 이내로 입력해 주세요."),
  companyName: z.string().min(1, "사업장 상호를 입력해 주세요."),
  companyRepresentative: z.string().min(1, "대표자명을 입력해 주세요."),
  companyRegistrationNumber: z
    .string()
    .refine(
      (value) => value === "" || /^\d{3}-\d{2}-\d{5}$/.test(value),
      "000-00-00000 형식으로 입력해 주세요.",
    ),
  companyAddress: z.string().min(1, "사업장 주소를 입력해 주세요."),
  companyPhone: z.string(),
  clauses: z
    .array(contractClauseSchema)
    .min(1, "조항을 한 개 이상 넣어 주세요.")
    .refine(
      (clauses) => clauses.some((clause) => clause.kind === "WAGE"),
      "임금 조항이 빠졌습니다. 금액이 적히지 않은 계약서는 효력을 다투게 됩니다.",
    )
    .refine(
      (clauses) => clauses.some((clause) => clause.kind === "PARTIES"),
      "당사자 인적사항 조항이 빠졌습니다.",
    )
    .refine(
      (clauses) =>
        new Set(clauses.map((clause) => clause.clauseId)).size ===
        clauses.length,
      "조항 식별자가 중복됐습니다. 조항을 다시 추가해 주세요.",
    ),
  agreementNote: z.string().max(300, "300자 이내로 입력해 주세요."),
  requiresGuardianSignature: z.boolean(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export type ContractTemplateSchema = z.infer<typeof contractTemplateSchema>;

export const EMPTY_CONTRACT_TEMPLATE_VALUES: ContractTemplateSchema = {
  name: "",
  targetRoles: [],
  documentTitle: "표준 근로계약서 (일용직)",
  companyName: "",
  companyRepresentative: "",
  companyRegistrationNumber: "",
  companyAddress: "",
  companyPhone: "",
  clauses: DEFAULT_CONTRACT_CLAUSES,
  agreementNote:
    "본인은 위 근로조건을 충분히 확인하였으며, 이에 동의하여 아래와 같이 서명합니다.",
  requiresGuardianSignature: false,
  isDefault: false,
  isActive: true,
};

/**
 * 전자서명 스키마.
 *
 * 이름만 적고 넘어가면 나중에 "내가 안 했다"는 다툼을 막을 수 없다.
 * 서명 이미지와 성명을 모두 받는다.
 */
export const contractSignatureSchema = z.object({
  signedName: z
    .string()
    .min(2, "성명을 정확히 입력해 주세요.")
    .max(20, "20자 이내로 입력해 주세요."),
  imageDataUrl: z.string().min(1, "서명을 그려 주세요."),
  isAgreed: z
    .boolean()
    .refine((value) => value, "계약 내용 확인에 동의해 주세요."),
});

export type ContractSignatureSchema = z.infer<typeof contractSignatureSchema>;
