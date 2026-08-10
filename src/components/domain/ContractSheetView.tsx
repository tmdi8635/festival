"use client";

import { useCallback, useState } from "react";
import { Info, Warning } from "@/icons";
import { cn } from "@/lib/utils";
import {
  A4_CONTENT_HEIGHT,
  A4_PAGE_WIDTH,
  resolveA4PageCount,
  type ContractDocument,
} from "@/type/contract";
import Alert from "@/components/ui/Alert";
import ContractDocumentView from "./ContractDocumentView";

interface ContractSheetViewProps {
  document: ContractDocument;
  className?: string;
}

/**
 * 계약서를 A4 지면 위에 얹어 보여 준다.
 *
 * 계약서는 결국 종이로 나가는 문서다. 화면에서 스크롤로만 확인하면
 * 조항을 늘렸을 때 몇 장이 되는지, 서명란이 마지막 장에 혼자 떨어지지는 않는지를
 * 인쇄해 봐야 알 수 있다. 그래서 지면 경계를 실제 치수로 그려 준다.
 *
 * 조항이 많아 여러 장이 되는 것 자체는 문제가 아니다. (실제 근로계약서도 그렇다)
 * 다만 그때 반드시 지켜야 하는 것이 두 가지 있고, 여기서 둘 다 챙긴다.
 *
 * 1) **조항이 페이지 경계에서 잘리지 않는다.** (`.contract-clause`의 break-inside)
 *    한 조항의 앞부분과 뒷부분이 다른 장에 놓이면 읽는 사람이 조건을 놓친다.
 * 2) **모든 장에 계약번호가 찍힌다.** (`.contract-print-footer`)
 *    여러 장짜리 계약서는 한 장이 빠지거나 뒤섞여도 티가 나지 않는다.
 *    장마다 식별자가 있어야 나중에 "그 조항은 못 봤다"는 다툼을 가릴 수 있다.
 */
const ContractSheetView = ({ document, className }: ContractSheetViewProps) => {
  const [contentHeight, setContentHeight] = useState(0);

  /*
    장수는 실제로 그려진 높이로만 알 수 있다. 글자 수로 어림하면
    표가 들어간 자동 조항에서 크게 어긋난다.

    측정은 effect가 아니라 콜백 ref에서 한다. 조항을 타이핑하는 동안에도
    높이가 계속 바뀌므로 ResizeObserver로 붙잡아 둔다.
    (effect 안에서 setState를 하면 React Compiler 린트에 걸린다)
  */
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      setContentHeight(entry.contentRect.height);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const pageCount = resolveA4PageCount(contentHeight);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="contract-print-hidden flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] text-font-2">
          <Info size={14} className="text-info" />
          실제 인쇄 결과와 같은 A4 지면입니다. 점선이 장이 넘어가는 자리입니다.
        </p>
        <span className="shrink-0 rounded-field bg-subtle px-2.5 py-1 text-[12px] font-medium text-font-1 tabular-nums">
          A4 {pageCount}장
        </span>
      </div>

      {/*
        여러 장이 되는 것을 막지 않는다. 대신 그때 무엇이 달라지는지 알려 준다.
        서명을 받는 사람이 마지막 장만 보고 서명하는 상황을 막는 것이 핵심이다.
      */}
      {pageCount > 1 && (
        <Alert
          tone="info"
          title={`인쇄하면 A4 ${pageCount}장으로 나옵니다.`}
          className="contract-print-hidden"
        >
          조항은 장 경계에서 잘리지 않게 통째로 다음 장으로 넘어가고, 모든 장
          아래에 계약번호가 찍힙니다. 서명은 마지막 장에서만 받으므로,{" "}
          <b>{pageCount}장을 모두 배부</b>하고 근로자가 전체를 확인한 뒤
          서명하도록 안내해 주세요. 서명본을 올릴 때도 {pageCount}장을 한
          파일로 묶어 주세요.
        </Alert>
      )}

      <div className="overflow-x-auto">
        {/* 지면 폭은 A4 그대로 고정한다. 화면 폭에 맞춰 늘이면 줄바꿈 위치가 달라진다. */}
        <div
          className="relative mx-auto bg-surface shadow-card"
          style={{ width: A4_PAGE_WIDTH }}
        >
          <div ref={measureRef}>
            <ContractDocumentView document={document} />
          </div>

          {/*
            장 경계선. 문서 위에 겹쳐 그리되 클릭을 가로막지 않는다.
            첫 장 위쪽에는 선을 긋지 않으므로 1장부터 센다.
          */}
          <div className="contract-print-hidden pointer-events-none absolute inset-0">
            {Array.from({ length: pageCount - 1 }, (_, index) => (
              <div
                key={index}
                className="absolute right-0 left-0 border-t border-dashed border-border-strong"
                style={{ top: A4_CONTENT_HEIGHT * (index + 1) }}
              >
                <span className="absolute -top-2.5 right-2 rounded-[5px] bg-subtle px-1.5 text-[10px] text-font-2 tabular-nums">
                  {index + 2}장 시작
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/*
        한 조항이 한 장보다 길면 '잘리지 않게 통째로 넘긴다'는 규칙을 지킬 수 없다.
        브라우저가 결국 중간에서 자르므로, 조항을 나누라고 미리 일러 준다.
      */}
      {contentHeight > 0 && (
        <SheetOverflowNotice document={document} />
      )}
    </div>
  );
};

/**
 * 한 장을 넘기는 조항이 있는지 알려 준다.
 *
 * `break-inside: avoid`는 "한 장에 들어갈 수 있으면 자르지 말라"는 뜻이다.
 * 애초에 한 장에 안 들어가는 조항은 브라우저가 그냥 자른다.
 * 그런 조항은 사람이 나눠 주는 수밖에 없다.
 */
const SheetOverflowNotice = ({ document }: { document: ContractDocument }) => {
  /*
    본문 줄 수로 어림한다. 정확한 높이는 조항마다 재야 알 수 있지만,
    한 장을 넘길 만큼 긴 조항은 예외 없이 본문이 아주 길다.
    (13px 본문 기준으로 한 장에 대략 45줄이 들어간다)
  */
  const LINES_PER_PAGE = 45;
  const CHARS_PER_LINE = 42;

  const overflowing = document.sections.filter((section) => {
    const lines = section.body
      .split("\n")
      .reduce(
        (sum, line) => sum + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)),
        0,
      );

    return lines > LINES_PER_PAGE;
  });

  if (overflowing.length === 0) return null;

  return (
    <Alert
      tone="warning"
      title="한 장을 넘기는 조항이 있습니다."
      className="contract-print-hidden"
    >
      <span className="flex items-start gap-1.5">
        <Warning size={14} className="mt-0.5 shrink-0" />
        <span>
          {overflowing.map((section) => section.title).join(", ")} 조항이 A4 한
          장보다 깁니다. 이런 조항은 인쇄할 때 중간에서 잘립니다. 항을 기준으로
          두 조항으로 나눠 주세요.
        </span>
      </span>
    </Alert>
  );
};

export default ContractSheetView;
