"use client";

import { useCallback, useState } from "react";
import { ExternalLink, FileText } from "@/icons";
import { cn } from "@/lib/utils";
import {
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

/** 미리보기 상자의 높이. 첫 장의 위쪽이 들어갈 만큼만 준다. */
const PREVIEW_HEIGHT = 320;

/** 지면을 상자 폭에 맞춰 줄이는 배율 */
const PREVIEW_SCALE = 0.42;

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
          양식이 맞는지만 확인하세요. 조항을 읽으려면 새 창에서 여세요.
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
      <div
        className="relative overflow-hidden rounded-field border border-border-main bg-subtle"
        style={{ height: PREVIEW_HEIGHT }}
      >
        <div
          style={{
            width: A4_PAGE_WIDTH,
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <div ref={measureRef}>
            <ContractDocumentView document={document} />
          </div>
        </div>

        {/* 아래가 더 있다는 신호. 잘린 자리를 흐리게 덮는다. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
      </div>
    </section>
  );
};

export default ContractPreviewCard;
