"use client";

import { useCallback, useState } from "react";
import { ExternalLink, FileText } from "@/icons";
import { cn } from "@/lib/utils";
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  resolveA4PageCount,
  type ContractDocument,
} from "@/type/contract";
import Button from "@/components/ui/Button";
import ContractDocumentView from "./ContractDocumentView";

interface ContractPreviewCardProps {
  document: ContractDocument;
  /** 새 창에서 PDF로 열기 */
  onOpenPdf: () => void;
  isOpening?: boolean;
  className?: string;
}

/**
 * 미리보기 지면의 폭. **작아야 한다.**
 *
 * 상자 폭에 맞춰 키우면 배율이 1에 가까워져 미리보기가 아니라 그냥 문서가
 * 되고, 320px 높이에는 제목 한 줄만 들어간다. 여기서 하는 일은
 * "양식이 맞나"를 훑는 것이라 **첫 장이 통째로 보이는 편**이 낫다.
 */
const PREVIEW_WIDTH = 260;

/**
 * 계약서 미리보기. **형식만 훑는 자리다.**
 *
 * 예전에는 A4 지면을 실제 치수로 전부 그려 뒀다. 조항이 많으면 장이 서너 개
 * 쌓여서 모달을 열자마자 화면이 문서로 가득 찼고, 정작 여기서 해야 하는 일
 * (내려받아 배부하기 · 서명본 올리기)이 스크롤 저 아래로 밀렸다.
 *
 * 여기서 확인하는 것은 **"양식이 맞나"** 하나다. 그건 첫 장 위쪽만 봐도 안다.
 * 조항을 실제로 읽어야 할 때는 새 창에서 PDF로 연다.
 * 미리보기 → 이상 없으면 넘어가고, 이상하면 크게 본다 — 그 순서다.
 *
 * 축소는 `transform: scale`로 한다. 폭을 줄이면 줄바꿈이 달라져 **실제로
 * 받는 문서와 다른 모양**이 되고, 그러면 미리보기의 뜻이 없어진다.
 */
const ContractPreviewCard = ({
  document,
  onOpenPdf,
  isOpening = false,
  className,
}: ContractPreviewCardProps) => {
  const [contentHeight, setContentHeight] = useState(0);

  /*
    장수는 실제로 그려진 높이로만 알 수 있다. 글자 수로 어림하면
    표가 들어간 자동 조항에서 크게 어긋난다.
    (`contentRect`는 `transform` 전의 배치 크기라 축소해도 값은 그대로다)

    측정은 effect가 아니라 콜백 ref에서 한다.
    effect 안에서 setState를 하면 React Compiler 린트에 걸린다.
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
  /** 첫 장이 통째로 들어가는 배율 */
  const scale = PREVIEW_WIDTH / A4_PAGE_WIDTH;

  return (
    <section
      className={cn(
        "contract-print-hidden flex flex-col gap-2.5 rounded-card border border-border-main p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FileText size={15} className="shrink-0 text-font-2" />
        <p className="text-[13px] font-medium text-font-1">미리보기</p>
        <p className="min-w-0 flex-1 text-[12px] text-font-2">
          첫 장입니다. 양식만 확인하고, 조항을 읽으려면 새 창에서 여세요.
          {contentHeight > 0 && ` · 총 ${pageCount}장`}
        </p>

        <Button
          size="sm"
          variant="secondary"
          leftIcon={<ExternalLink size={14} />}
          isLoading={isOpening}
          onClick={onOpenPdf}
          title="새 창에서 PDF로 엽니다. 지금 보고 있는 화면은 그대로 남습니다."
        >
          PDF로 열기
        </Button>
      </div>

      {/*
        첫 장만, 위에서부터 잘라 보여 준다.

        `overflow-hidden` 상자 안에 원래 크기의 지면을 넣고 축소만 건다.
        상자 높이를 넘는 부분은 잘리고, 그 아래가 있다는 것은 아래쪽
        페이드로 알린다. 스크롤을 두지 않는 이유는 여기서 읽으라는 뜻이
        아니기 때문이다.
      */}
      {/* 종이 한 장이 놓인 것처럼 가운데에 둔다. */}
      <div className="flex justify-center rounded-field bg-subtle py-4">
        <div
          className="relative overflow-hidden rounded-[3px] border border-border-main bg-white shadow-card"
          style={{
            width: PREVIEW_WIDTH,
            height: Math.round(A4_PAGE_HEIGHT * scale),
          }}
        >
          <div
            style={{
              width: A4_PAGE_WIDTH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <div ref={measureRef}>
              <ContractDocumentView document={document} />
            </div>
          </div>

          {/* 첫 장을 넘어가는 부분이 있다는 신호. 잘린 자리를 흐리게 덮는다. */}
          {pageCount > 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
          )}
        </div>
      </div>
    </section>
  );
};

export default ContractPreviewCard;
