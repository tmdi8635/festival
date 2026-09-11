"use client";

import { ArrowDown, ArrowUp, Info, Plus, Trash } from "@/icons";
import {
  CLAUSE_KIND_HINT,
  CLAUSE_KIND_LABEL,
  type ClauseKind,
  type ContractClause,
  type ContractCustomTerms,
} from "@/type/contract";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

const CLAUSE_KIND_OPTIONS = (
  ["PARTIES", "WORK_CONDITION", "WAGE", "TEXT"] as const
).map((kind) => ({ label: CLAUSE_KIND_LABEL[kind], value: kind }));

interface ContractTermsEditorProps {
  value: ContractCustomTerms;
  onChange: (next: ContractCustomTerms) => void;
  /**
   * 자동 조항을 문구로 풀 때 채울 본문.
   * **지금 이 사람 문서에 실제로 찍히는 값**이어야 한다. 빈 칸에서 시작하게 하면
   * 담당자가 금액 · 근무일을 손으로 옮겨 적다가 틀린다.
   */
  resolveAutoText: (clauseId: string) => string;
}

/**
 * 한 사람 계약서의 조항 편집기.
 *
 * 템플릿 빌더와 모양이 같지만 **저장 대상이 다르다.** 여기서 고친 것은 이 계약서
 * 한 장에만 남고 템플릿은 그대로다. (`Contract.customTerms`)
 *
 * 템플릿과 다른 점이 하나 더 있다 — 자동 조항을 **문구로 풀 수 있다.**
 * 수정요청 중에는 "임금 표에 식대 포함 여부를 적어 달라"처럼 자동 표로는 담을 수 없는
 * 것이 있다. 그때 표를 지금 값 그대로 문장으로 옮겨 놓고 거기서 고친다.
 * 대신 풀어낸 조항은 배치를 고쳐도 따라가지 않는다. 그 경고는 부르는 쪽이 띄운다.
 */
const ContractTermsEditor = ({
  value,
  onChange,
  resolveAutoText,
}: ContractTermsEditorProps) => {
  const { clauses } = value;

  const updateClauses = (next: ContractClause[]) =>
    onChange({ ...value, clauses: next });

  const updateClause = (index: number, patch: Partial<ContractClause>) =>
    updateClauses(
      clauses.map((clause, position) =>
        position === index ? { ...clause, ...patch } : clause,
      ),
    );

  const moveClause = (from: number, to: number) => {
    const next = [...clauses];
    const [moved] = next.splice(from, 1);

    next.splice(to, 0, moved);
    updateClauses(next);
  };

  const changeKind = (index: number, kind: ClauseKind) => {
    const clause = clauses[index];

    /* 표를 문구로 바꿀 때는 지금 찍히는 값을 그대로 옮겨 둔다. */
    if (kind === "TEXT" && clause.kind !== "TEXT") {
      updateClause(index, { kind, body: resolveAutoText(clause.clauseId) });
      return;
    }

    updateClause(index, { kind, body: kind === "TEXT" ? clause.body : "" });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormField
        label="문서 제목"
        required
        error={value.documentTitle.trim() ? undefined : "문서 제목을 입력해 주세요."}
      >
        <Input
          value={value.documentTitle}
          hasError={!value.documentTitle.trim()}
          onChange={(changeEvent) =>
            onChange({ ...value, documentTitle: changeEvent.target.value })
          }
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-font-1">조항</p>
            <p className="mt-0.5 text-[12px] text-font-2">
              위에서부터 순서대로 인쇄됩니다. 이 사람 계약서에만 반영됩니다.
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus size={14} />}
            onClick={() =>
              updateClauses([
                ...clauses,
                {
                  clauseId: `clause-${Date.now()}`,
                  title: `제${clauses.length + 1}조 ()`,
                  kind: "TEXT",
                  body: "",
                },
              ])
            }
          >
            조항 추가
          </Button>
        </div>

        {clauses.map((clause, index) => {
          const isAuto = clause.kind !== "TEXT";

          return (
            <div
              key={clause.clauseId}
              className="flex flex-col gap-2 rounded-field border border-border-main p-3"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-5 shrink-0 text-center text-[13px] text-font-2 tabular-nums">
                  {index + 1}
                </span>

                <Input
                  aria-label="조항 제목"
                  value={clause.title}
                  hasError={!clause.title.trim()}
                  onChange={(changeEvent) =>
                    updateClause(index, { title: changeEvent.target.value })
                  }
                  inputBoxClassName="min-w-0 flex-1"
                />

                <IconButton
                  label="위로"
                  icon={<ArrowUp size={15} />}
                  disabled={index === 0}
                  onClick={() => moveClause(index, index - 1)}
                />
                <IconButton
                  label="아래로"
                  icon={<ArrowDown size={15} />}
                  disabled={index === clauses.length - 1}
                  onClick={() => moveClause(index, index + 1)}
                />
                <IconButton
                  label="조항 삭제"
                  icon={<Trash size={15} />}
                  tone="danger"
                  disabled={clauses.length <= 1}
                  onClick={() =>
                    updateClauses(clauses.filter((_, position) => position !== index))
                  }
                />
              </div>

              <Select
                aria-label="조항 종류"
                options={CLAUSE_KIND_OPTIONS}
                value={clause.kind}
                onChange={(changeEvent) =>
                  changeKind(index, changeEvent.target.value as ClauseKind)
                }
                selectBoxClassName="w-full sm:w-52"
              />

              {isAuto ? (
                <div className="flex items-start gap-2 rounded-field bg-subtle px-3 py-2">
                  <Info size={14} className="mt-0.5 shrink-0 text-info" />
                  <div className="min-w-0 flex-1">
                    <Badge tone="info">자동 입력</Badge>
                    <p className="mt-1 text-[12px] text-font-2">
                      {CLAUSE_KIND_HINT[clause.kind]}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => changeKind(index, "TEXT")}
                  >
                    문구로 풀어 고치기
                  </Button>
                </div>
              ) : (
                <Textarea
                  aria-label="조항 본문"
                  rows={4}
                  value={clause.body}
                  onChange={(changeEvent) =>
                    updateClause(index, { body: changeEvent.target.value })
                  }
                  placeholder="조항 본문을 입력하세요. {{변수}}를 넣으면 실제 값으로 바뀝니다."
                />
              )}
            </div>
          );
        })}
      </div>

      <FormField label="서명 확인 문구" hint="서명란 바로 위에 들어갑니다.">
        <Textarea
          rows={2}
          value={value.agreementNote}
          onChange={(changeEvent) =>
            onChange({ ...value, agreementNote: changeEvent.target.value })
          }
        />
      </FormField>
    </div>
  );
};

export default ContractTermsEditor;
