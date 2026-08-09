"use client";

import Image from "next/image";
import { formatDate, formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { ContractDocument } from "@/type/contract";

interface ContractDocumentViewProps {
  document: ContractDocument;
  className?: string;
}

/**
 * 근로계약서 문서.
 *
 * 예전에는 계약서가 문자 본문이었다. 그래서 서명도 보관도 되지 않았고,
 * 나중에 무슨 조건으로 일했는지 확인할 방법이 없었다.
 *
 * 여기서는 A4 문서 형태로 그린다. 화면에서 보이는 그대로가
 * 인쇄(→ PDF로 저장) 결과물이 되도록 `contract-print-area` 클래스를 달아 두고,
 * 인쇄 스타일은 globals.css가 담당한다.
 *
 * 인적사항 · 근로조건 · 임금은 사람이 옮겨 적지 않고 표로 자동으로 채운다.
 * 옮겨 적는 순간 반드시 틀리기 때문이다.
 */
const ContractDocumentView = ({
  document,
  className,
}: ContractDocumentViewProps) => {
  return (
    <article
      className={cn(
        /*
          여백은 globals.css의 `@page { margin: 16mm 14mm }`를 픽셀로 환산한 값이다.
          화면 여백과 인쇄 여백이 다르면 미리보기에서 본 줄바꿈 위치가
          실제 인쇄물에서 달라진다. 두 값을 일부러 맞춰 둔다.
        */
        "contract-print-area mx-auto w-full max-w-[794px] bg-surface px-[53px] py-[60px] text-font-1",
        className,
      )}
    >
      {/* 문서 머리 */}
      <header className="border-b-2 border-font-1 pb-4 text-center">
        <h1 className="text-[22px] font-bold tracking-tight text-font-0">
          {document.documentTitle}
        </h1>
        <p className="mt-1.5 text-[12px] text-font-2 tabular-nums">
          계약번호 {document.contractNumber} · 작성일{" "}
          {formatDate(document.issuedAt)}
        </p>
      </header>

      <p className="mt-5 text-[13px] leading-relaxed">
        사업주 <b>{document.companyName}</b>(이하 &ldquo;갑&rdquo;)과 근로자(이하
        &ldquo;을&rdquo;)는 아래와 같이 근로계약을 체결한다.
      </p>

      {/* 조항 */}
      <div className="mt-5 flex flex-col gap-5">
        {document.sections.map((section) => (
          <section key={section.clauseId} className="contract-clause">
            <h2 className="mb-2 text-[14px] font-bold text-font-0">
              {section.title}
            </h2>

            {section.fields.length > 0 && (
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  {section.fields.map((field) => (
                    <tr key={field.label} className="align-top">
                      <th
                        scope="row"
                        className="w-36 border border-border-main bg-subtle px-3 py-1.5 text-left font-medium text-font-2"
                      >
                        {field.label}
                      </th>
                      <td className="border border-border-main px-3 py-1.5">
                        {field.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {section.body && (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                {section.body}
              </p>
            )}
          </section>
        ))}
      </div>

      {/* 동의 문구 · 서명란. 서명란만 다음 장으로 떨어지면 문서가 우스워진다. */}
      <div className="contract-clause mt-8 border-t border-border-main pt-5">
        <p className="text-[13px] leading-relaxed">{document.agreementNote}</p>

        <div className="mt-6 flex items-end justify-between gap-8">
          <div className="flex-1">
            <p className="text-[12px] text-font-2">사업주 (갑)</p>
            <p className="mt-1.5 text-[13px]">{document.companyName}</p>
            <p className="text-[12px] text-font-2">
              {document.companyAddress}
            </p>
            <p className="mt-2 text-[13px]">
              대표자 {document.companyRepresentative}{" "}
              <span className="text-font-2">(인)</span>
            </p>
          </div>

          <div className="flex-1">
            <p className="text-[12px] text-font-2">근로자 (을)</p>

            {document.signature ? (
              <>
                <div className="relative mt-1.5 h-16 w-44 border-b border-border-strong">
                  {document.signature.imageDataUrl ? (
                    <Image
                      src={document.signature.imageDataUrl}
                      alt="근로자 서명"
                      fill
                      sizes="176px"
                      className="object-contain object-left-bottom"
                      unoptimized
                    />
                  ) : (
                    <span className="absolute bottom-1 left-1 text-[15px] text-font-1 italic">
                      {document.signature.signedName}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[13px]">
                  성명 {document.signature.signedName}
                </p>
                <p className="mt-0.5 text-[11px] text-font-2 tabular-nums">
                  전자서명 {formatDateTime(document.signature.signedAt)}
                </p>
                {/*
                  서명 이후 문서가 바뀌었는지 확인할 수 있어야 한다.
                  해시를 함께 남겨 두면 "내가 본 것과 다르다"는 다툼을 가릴 수 있다.
                */}
                <p className="text-[11px] text-font-disabled tabular-nums">
                  문서검증 {document.signature.documentHash}
                </p>
              </>
            ) : (
              <>
                <div className="mt-1.5 h-16 w-44 border-b border-border-strong" />
                <p className="mt-2 text-[13px] text-font-2">
                  성명 __________ (서명)
                </p>
                <p className="mt-0.5 text-[11px] text-font-disabled">
                  아직 서명 전입니다.
                </p>
              </>
            )}

            {document.requiresGuardianSignature && (
              <div className="mt-5">
                <p className="text-[12px] text-font-2">친권자</p>
                <div className="mt-1.5 h-12 w-44 border-b border-border-strong" />
                <p className="mt-2 text-[13px] text-font-2">
                  성명 __________ (서명)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        모든 장 아래에 찍히는 식별 문구.

        조항이 많으면 계약서는 쉽게 두세 장이 된다. 그런데 장마다 아무 표시가
        없으면 한 장이 빠지거나 다른 계약서와 섞여도 알아챌 수 없다.
        인쇄할 때만 나타나며, 브라우저가 고정 요소를 장마다 반복해 찍는다.
      */}
      <footer className="contract-print-footer">
        {document.documentTitle} · 계약번호 {document.contractNumber} ·{" "}
        {document.companyName}
      </footer>
    </article>
  );
};

export default ContractDocumentView;
