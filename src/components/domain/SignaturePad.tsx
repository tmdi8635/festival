"use client";

import { useRef, useState } from "react";
import { Refresh } from "@/icons";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

interface SignaturePadProps {
  /** 그리기가 끝날 때마다 이미지(data URL)를 올려 준다. 지우면 빈 문자열. */
  onChange: (imageDataUrl: string) => void;
  className?: string;
}

/** 캔버스 해상도. 화면 크기보다 크게 잡아야 인쇄했을 때 서명이 뭉개지지 않는다. */
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 300;

/**
 * 전자서명 입력판.
 *
 * 문자로 받은 "네" 회신은 나중에 근거가 되지 않는다.
 * 마우스나 손가락으로 직접 그린 서명을 이미지로 받아 계약서에 붙인다.
 *
 * 외부 라이브러리를 쓰지 않는다. 서명은 선을 잇는 것이 전부여서
 * 의존성을 늘릴 이유가 없고, 서버가 붙어도 이 데이터 형식은 그대로 쓴다.
 */
const SignaturePad = ({ onChange, className }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  /** 캔버스 좌표계로 변환한다. 화면에 보이는 크기와 실제 해상도가 다르다. */
  const toCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const bounds = canvas.getBoundingClientRect();

    return {
      x: ((clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
      y: ((clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
    };
  };

  const startStroke = (clientX: number, clientY: number) => {
    const context = canvasRef.current?.getContext("2d");
    const point = toCanvasPoint(clientX, clientY);

    if (!context || !point) return;

    isDrawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const extendStroke = (clientX: number, clientY: number) => {
    if (!isDrawingRef.current) return;

    const context = canvasRef.current?.getContext("2d");
    const point = toCanvasPoint(clientX, clientY);

    if (!context || !point) return;

    context.lineWidth = 3.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    // 서명은 검정으로 고정한다. 테마 색을 따라가면 인쇄물에서 흐려진다.
    context.strokeStyle = "#111111";
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const endStroke = () => {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    setHasDrawing(true);
    onChange(canvasRef.current?.toDataURL("image/png") ?? "");
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return;

    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHasDrawing(false);
    onChange("");
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative overflow-hidden rounded-field border border-border-strong bg-surface">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            startStroke(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => extendStroke(event.clientX, event.clientY)}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          className="h-40 w-full cursor-crosshair touch-none"
        />

        {!hasDrawing && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-font-disabled">
            이곳에 서명해 주세요
          </p>
        )}

        {/* 서명이 놓일 기준선. 없으면 사람들이 캔버스 위쪽에만 작게 그린다. */}
        <div className="pointer-events-none absolute right-8 bottom-6 left-8 border-b border-dashed border-border-strong" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-font-2">
          마우스 또는 손가락으로 직접 서명합니다.
        </p>

        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Refresh size={14} />}
          onClick={handleClear}
          disabled={!hasDrawing}
        >
          다시 서명
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
