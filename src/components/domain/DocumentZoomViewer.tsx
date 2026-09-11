"use client";

import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { Close } from "@/icons";
import { cn } from "@/lib/utils";
import {
  A4_PAGE_WIDTH,
  type ContractDocument,
  type ContractSignedFile,
} from "@/type/contract";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useEscapeLayer } from "@/components/ui/Modal";
import ContractDocumentView from "./ContractDocumentView";

interface DocumentZoomViewerProps {
  /** 위 줄에 적을 이름. (행사명 · 파일명) */
  title: string;
  onClose: () => void;
  /** 조립한 계약서 문서. `file`과 둘 중 하나를 넘긴다 */
  document?: ContractDocument;
  /** 올린 서명본 파일 (이미지 · PDF) */
  file?: ContractSignedFile;
}

/** 배율 범위와 한 번 누를 때 움직이는 폭 */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

/** 화면 가장자리에 붙지 않게 남기는 여백 (좌우 합) */
const FRAME_PADDING = 32;

/** 지금 배율에서 한 칸 위 · 아래. 폭맞춤에서 시작해도 25% 눈금에 맞춰 떨어진다. */
const stepZoom = (current: number, direction: 1 | -1): number => {
  const next =
    direction === 1
      ? (Math.floor(current / ZOOM_STEP + 1e-6) + 1) * ZOOM_STEP
      : (Math.ceil(current / ZOOM_STEP - 1e-6) - 1) * ZOOM_STEP;

  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
};

/**
 * 문서를 화면 전체로 크게 본다.
 *
 * 폰에서 A4 지면은 폭에 맞춰 줄이면 글자가 손톱만 해지고, 줄이지 않으면 좌우로
 * 밀어야 한다. 읽는 곳(지면)과 확대해서 들여다보는 곳을 **따로 둔다.**
 * 서명해야 하는 사람이 금액 칸 하나를 확인하려고 화면 전체를 핀치로 키웠다 줄였다
 * 하게 두면, 그러다 하단 버튼을 잘못 누른다.
 *
 * - 계약서 문서: −/+ 로 50~250%, '폭맞춤'으로 되돌린다. 넘치는 만큼 스크롤로 옮겨 본다.
 *   (마우스는 끌어서 옮길 수 있다)
 * - 이미지 서명본: 같은 방식으로 확대한다.
 * - PDF 서명본: 브라우저 뷰어가 확대를 이미 갖고 있어 그대로 띄운다.
 *   `data:` 주소는 `<iframe>`에 넣을 수 없어 `blob:`으로 바꿔 끼운다. (`ContractFilePreview`와 같다)
 */
const DocumentZoomViewer = ({
  title,
  onClose,
  document: contractDocument,
  file,
}: DocumentZoomViewerProps) => {
  const isClient = useIsClient();

  /* `null`은 폭맞춤이다. 화면을 돌리면 폭이 달라지므로 숫자로 굳혀 두지 않는다. */
  const [zoom, setZoom] = useState<number | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  useEscapeLayer(true, onClose);

  const isImage = Boolean(file?.mimeType.startsWith("image/"));
  const isPdf = file?.mimeType === "application/pdf";
  const isZoomable = Boolean(contractDocument) || isImage;

  /*
    측정은 콜백 ref + ResizeObserver로 한다. effect 안에서 setState를 하면
    React Compiler 린트에 걸린다. (`ContractSheetView`와 같은 방식)
  */
  const frameRef = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;

    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      setFrameWidth(entry.contentRect.width);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      setContentHeight(entry.contentRect.height);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  /* PDF는 `blob:`으로 바꿔 끼운다. 만든 주소는 닫을 때 반드시 되돌려 준다. */
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const fileUrl = file?.url ?? "";

  useEffect(() => {
    if (!isPdf || !fileUrl.startsWith("data:")) return;

    let revoked = false;
    let created = "";

    fetch(fileUrl)
      .then((response) => response.blob())
      .then((blob) => {
        if (revoked) return;

        created = URL.createObjectURL(blob);
        setBlobUrl(created);
      })
      .catch(() => setBlobUrl(null));

    return () => {
      revoked = true;
      setBlobUrl(null);
      if (created) URL.revokeObjectURL(created);
    };
  }, [fileUrl, isPdf]);

  /* 폭맞춤 배율. 문서는 A4 폭 기준, 이미지는 칸 폭 자체가 100%다. */
  const availableWidth = Math.max(0, frameWidth - FRAME_PADDING);
  const fitScale = contractDocument
    ? availableWidth > 0
      ? availableWidth / A4_PAGE_WIDTH
      : 1
    : 1;
  const scale = zoom ?? fitScale;

  /*
    마우스로 끌어서 옮긴다. 터치는 브라우저가 이미 스크롤로 처리하므로 건드리지 않는다.
    (터치까지 가로채면 두 손가락 확대가 막힌다)
  */
  const handlePanStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    const node = scrollRef.current;

    if (!node) return;

    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: node.scrollLeft,
      top: node.scrollTop,
    };
  };

  const handlePanMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = panRef.current;
    const node = scrollRef.current;

    if (!start || !node) return;

    node.scrollLeft = start.left - (event.clientX - start.x);
    node.scrollTop = start.top - (event.clientY - start.y);
  };

  const handlePanEnd = () => {
    panRef.current = null;
  };

  if (!isClient) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 크게 보기`}
      className="animate-fade-in fixed inset-0 z-100 flex flex-col bg-bg-base"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border-main bg-surface px-2 sm:px-4">
        <p className="min-w-0 flex-1 truncate pl-1 text-[15px] font-semibold text-font-0">
          {title}
        </p>

        {isZoomable && (
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton
              label="축소"
              icon={<span className="text-[20px] leading-none">−</span>}
              onClick={() => setZoom(stepZoom(scale, -1))}
              disabled={scale <= MIN_ZOOM}
            />
            <span className="w-12 text-center text-[13px] font-medium text-font-1 tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <IconButton
              label="확대"
              icon={<span className="text-[20px] leading-none">+</span>}
              onClick={() => setZoom(stepZoom(scale, 1))}
              disabled={scale >= MAX_ZOOM}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom(null)}
              disabled={zoom === null}
            >
              폭맞춤
            </Button>
          </div>
        )}

        <IconButton
          label="닫기"
          icon={<Close size={18} />}
          onClick={onClose}
          className="shrink-0"
        />
      </header>

      <div
        ref={frameRef}
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onPointerLeave={handlePanEnd}
        className={cn(
          "flex-1 overflow-auto p-4 scrollbar-thin",
          isZoomable && "cursor-grab select-none active:cursor-grabbing",
        )}
      >
        {contractDocument && (
          /*
            줄인 · 키운 크기를 바깥 상자가 **직접 차지한다.** transform은 자리를 바꾸지
            않아서, 이것이 없으면 250%로 키워도 스크롤이 생기지 않고 잘린 채로 남는다.
          */
          <div
            className="mx-auto"
            style={{
              width: A4_PAGE_WIDTH * scale,
              height: contentHeight > 0 ? contentHeight * scale : undefined,
            }}
          >
            <div
              className="bg-surface shadow-card"
              style={{
                width: A4_PAGE_WIDTH,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <div ref={measureRef}>
                <ContractDocumentView document={contractDocument} />
              </div>
            </div>
          </div>
        )}

        {file && isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={`${file.fileName} 크게 보기`}
            draggable={false}
            className="mx-auto block max-w-none rounded-field border border-border-main bg-surface"
            style={{ width: availableWidth > 0 ? availableWidth * scale : "100%" }}
          />
        )}

        {file && isPdf && (
          <iframe
            src={blobUrl ?? undefined}
            title={`${file.fileName} 크게 보기`}
            className="h-full min-h-[70dvh] w-full rounded-field border border-border-main bg-surface"
          />
        )}

        {file && !isImage && !isPdf && (
          <p className="rounded-field border border-border-main bg-surface px-3 py-6 text-center text-[13px] text-font-2">
            화면에서 펼쳐 볼 수 없는 형식입니다. 내려받아 확인해 주세요.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default DocumentZoomViewer;
