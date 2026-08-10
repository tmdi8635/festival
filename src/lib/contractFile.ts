import type { ContractDocument } from "@/type/contract";
import { buildPdfFromJpegPages, type PdfPageImage } from "./pdfFile";
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_MARGIN_X,
  A4_PAGE_MARGIN_Y,
  A4_PAGE_WIDTH,
} from "@/type/contract";

/**
 * 서명 전 계약서를 파일로 내려받는다.
 *
 * 서버가 없는 동안 계약서는 **사람 손으로** 오간다.
 * 담당자가 내려받아 출력하거나 카톡으로 보내고, 서명받은 종이를 다시 올린다.
 * 그래서 이 파일은 부수적인 기능이 아니라 절차의 한 단계다.
 *
 * 외부 라이브러리를 쓰지 않는다. PDF 생성기를 넣으면 한글 폰트를 통째로
 * 번들에 담아야 하고, 그렇게 만든 문서는 화면에서 본 것과 미묘하게 달라진다.
 * "내가 확인한 문서와 서명받은 문서가 다르다"가 되는 순간 이 절차는 쓸모가 없다.
 */

/* ------------------------------------------------------------------ */
/* PDF                                                                  */
/* ------------------------------------------------------------------ */

/**
 * 브라우저 인쇄로 PDF를 만든다.
 *
 * 인쇄 대화상자의 'PDF로 저장'은 화면에 보이는 문서를 그대로 남긴다.
 * 파일명은 대화상자가 **문서 제목(`document.title`)** 에서 가져가므로,
 * 인쇄하는 동안만 제목을 원하는 이름으로 바꿔 둔다.
 * (이렇게 하지 않으면 `행사 상세.pdf` 같은 화면 제목이 파일명이 되어
 *  서른 장을 받아 두고도 누구 것인지 알 수 없다)
 */
export const printContractAsPdf = (
  fileName: string,
  /**
   * 인쇄가 끝난 뒤에 부른다.
   *
   * 여러 명분을 묶어 인쇄할 때, 지면에 세워 둔 문서들을 언제 치울지가 여기서 정해진다.
   * 인쇄 창이 열리기도 전에 치우면 빈 종이가 나간다.
   */
  onDone?: () => void,
) => {
  const previousTitle = document.title;

  // 확장자는 인쇄 대화상자가 알아서 붙인다. 제목에 남겨 두면 `.pdf.pdf`가 된다.
  document.title = fileName.replace(/\.pdf$/i, "");

  let finished = false;

  const finish = () => {
    if (finished) return;

    finished = true;
    document.title = previousTitle;
    window.removeEventListener("afterprint", finish);
    onDone?.();
  };

  window.addEventListener("afterprint", finish);
  window.print();

  /*
    `afterprint`를 못 받는 브라우저가 있다. 제목이 바뀐 채로 남으면
    탭 이름이 계약서 파일명으로 굳어 버리므로 시간을 두고 한 번 더 되돌린다.
  */
  window.setTimeout(finish, 60_000);
};

/* ------------------------------------------------------------------ */
/* 이미지                                                               */
/* ------------------------------------------------------------------ */

/** 이미지로 그릴 때의 배율. 2배로 그려야 출력했을 때 글자가 뭉개지지 않는다. */
const IMAGE_SCALE = 2;

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * 이미지로 구울 문서의 HTML을 만든다.
 *
 * 화면의 계약서는 Tailwind 클래스로 그려져 있는데, 그 스타일은 바깥 스타일시트에
 * 있어서 이미지 안으로 따라 들어오지 않는다. 그래서 이미지용 지면은
 * **스타일을 글자마다 직접 박아** 따로 짠다. 담고 있는 값은 같은 `ContractDocument`이므로
 * 화면 · 인쇄 · 이미지가 같은 내용을 보여 준다.
 */
const buildDocumentHtml = (document: ContractDocument): string => {
  const sections = document.sections
    .map((section) => {
      const rows = section.fields
        .map(
          (field) =>
            `<tr>
               <th style="width:150px;border:1px solid #ccc;background:#f6f6f6;padding:5px 9px;text-align:left;font-weight:500;color:#555;vertical-align:top">${escapeHtml(field.label)}</th>
               <td style="border:1px solid #ccc;padding:5px 9px;vertical-align:top">${escapeHtml(field.value)}</td>
             </tr>`,
        )
        .join("");

      return `<section style="margin-bottom:20px">
          <h2 style="margin:0 0 8px;font-size:14px;font-weight:700">${escapeHtml(section.title)}</h2>
          ${rows ? `<table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>` : ""}
          ${
            section.body
              ? `<p style="margin:0;font-size:13px;line-height:1.7;white-space:pre-wrap">${escapeHtml(section.body)}</p>`
              : ""
          }
        </section>`;
    })
    .join("");

  return `<div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:${A4_PAGE_WIDTH}px;padding:${A4_PAGE_MARGIN_Y}px ${A4_PAGE_MARGIN_X}px;background:#fff;color:#111;font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif">
      <header style="border-bottom:2px solid #111;padding-bottom:16px;text-align:center">
        <h1 style="margin:0;font-size:22px;font-weight:700">${escapeHtml(document.documentTitle)}</h1>
        <p style="margin:6px 0 0;font-size:12px;color:#666">계약번호 ${escapeHtml(document.contractNumber)}</p>
      </header>

      <p style="margin:20px 0;font-size:13px;line-height:1.7">
        사업주 <b>${escapeHtml(document.companyName)}</b>(이하 &#8220;갑&#8221;)과 근로자(이하 &#8220;을&#8221;)는 아래와 같이 근로계약을 체결한다.
      </p>

      ${sections}

      <div style="margin-top:28px;border-top:1px solid #ccc;padding-top:20px">
        <p style="margin:0;font-size:13px;line-height:1.7">${escapeHtml(document.agreementNote)}</p>

        <div style="display:flex;gap:32px;margin-top:28px">
          <div style="flex:1">
            <p style="margin:0;font-size:12px;color:#666">사업주 (갑)</p>
            <p style="margin:6px 0 0;font-size:13px">${escapeHtml(document.companyName)}</p>
            <p style="margin:0;font-size:12px;color:#666">${escapeHtml(document.companyAddress)}</p>
            <p style="margin:8px 0 0;font-size:13px">대표자 ${escapeHtml(document.companyRepresentative)} (인)</p>
          </div>

          <div style="flex:1">
            <p style="margin:0;font-size:12px;color:#666">근로자 (을)</p>
            <div style="height:60px;width:180px;border-bottom:1px solid #888"></div>
            <p style="margin:8px 0 0;font-size:13px;color:#666">성명 __________ (서명)</p>
            ${
              document.requiresGuardianSignature
                ? `<div style="margin-top:20px">
                     <p style="margin:0;font-size:12px;color:#666">친권자</p>
                     <div style="height:46px;width:180px;border-bottom:1px solid #888"></div>
                     <p style="margin:8px 0 0;font-size:13px;color:#666">성명 __________ (서명)</p>
                   </div>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>`;
};

/**
 * 브라우저에 파일을 내려 준다.
 *
 * 주소는 **바로 되돌리지 않는다.** `click()` 직후에 해제하면 큰 파일은
 * 내려받기가 시작되기 전에 원본이 사라져 중간에 끊긴다.
 * (서른 명분을 잇달아 내려받을 때 실제로 몇 건씩 실패했다)
 */
const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/**
 * 계약서 문서를 캔버스에 굽는다. **이미지 · PDF가 함께 쓰는 자리다.**
 *
 * SVG의 `foreignObject`에 문서를 통째로 넣어 이미지로 읽힌 뒤 캔버스에 그린다.
 * 바깥 자원을 하나도 참조하지 않아야 캔버스가 오염되지 않고 저장이 된다.
 * (그래서 글꼴은 보는 컴퓨터에 깔린 것으로 그려진다. 지면 구성은 같다)
 */
const renderContractCanvas = async (
  contractDocument: ContractDocument,
): Promise<HTMLCanvasElement> => {
  /*
    문서가 길면 A4 한 장을 넘어간다. 실제 높이를 재서 그만큼 그린 뒤,
    장으로 자르는 일은 PDF 쪽이 한다.
  */
  const measure = document.createElement("div");

  measure.style.cssText = `position:fixed;left:-99999px;top:0;width:${A4_PAGE_WIDTH}px`;
  measure.innerHTML = buildDocumentHtml(contractDocument);
  document.body.appendChild(measure);

  const height = Math.max(A4_PAGE_HEIGHT, measure.scrollHeight);

  document.body.removeChild(measure);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${A4_PAGE_WIDTH}" height="${height}">
      <foreignObject width="100%" height="100%">
        ${buildDocumentHtml(contractDocument)}
      </foreignObject>
    </svg>`;

  const image = new Image();

  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error("계약서를 이미지로 만들지 못했습니다."));
  });

  const canvas = document.createElement("canvas");

  canvas.width = A4_PAGE_WIDTH * IMAGE_SCALE;
  canvas.height = height * IMAGE_SCALE;

  const context = canvas.getContext("2d");

  if (!context) throw new Error("계약서를 이미지로 만들지 못했습니다.");

  // 배경을 깔지 않으면 투명해져 어두운 화면·PDF 뷰어에서 글자가 보이지 않는다.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
};

/** 캔버스를 blob으로. 실패 이유를 같은 문장으로 모아 준다. */
const toBlob = async (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> => {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );

  if (!blob) throw new Error("계약서 파일을 만들지 못했습니다.");

  return blob;
};

/**
 * 서명 전 계약서를 PNG 한 장으로 내려받는다.
 *
 * 출력할 프린터가 없는 자리에서는 카톡으로 이미지를 보내 놓고
 * 현장에서 종이에 옮겨 서명받는 일이 실제로 있다.
 */
export const downloadContractAsImage = async (
  contractDocument: ContractDocument,
  fileName: string,
): Promise<void> => {
  const canvas = await renderContractCanvas(contractDocument);

  download(await toBlob(canvas, "image/png"), fileName);
};

/* ------------------------------------------------------------------ */
/* PDF 파일                                                             */
/* ------------------------------------------------------------------ */

/** PDF 안에 넣을 JPEG 품질. 글자가 뭉개지지 않으면서 파일이 너무 커지지 않는 선이다. */
const PDF_JPEG_QUALITY = 0.92;

/**
 * 계약서 한 장을 **진짜 PDF 파일**로 만든다.
 *
 * 캔버스를 A4 높이만큼씩 잘라 여러 장으로 나눈다. 자르지 않고 긴 지면 하나로
 * 두면 인쇄할 때 축소돼 글자가 읽히지 않는다.
 */
export const buildContractPdfBlob = async (
  contractDocument: ContractDocument,
): Promise<Blob> => {
  const canvas = await renderContractCanvas(contractDocument);

  /* 캔버스 픽셀 기준의 A4 한 장 높이 */
  const pageHeight = Math.round(A4_PAGE_HEIGHT * IMAGE_SCALE);
  const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeight));

  const pages: PdfPageImage[] = [];

  for (let index = 0; index < pageCount; index += 1) {
    const sliceHeight = Math.min(
      pageHeight,
      canvas.height - index * pageHeight,
    );

    const slice = document.createElement("canvas");

    slice.width = canvas.width;
    slice.height = pageHeight;

    const context = slice.getContext("2d");

    if (!context) throw new Error("계약서 파일을 만들지 못했습니다.");

    /*
      마지막 장은 내용이 지면보다 짧다. 흰 배경을 먼저 깔지 않으면
      남는 부분이 검게 나온다. (JPEG에는 투명이 없다)
    */
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(
      canvas,
      0,
      index * pageHeight,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    const blob = await toBlob(slice, "image/jpeg", PDF_JPEG_QUALITY);

    pages.push({
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width: slice.width,
      height: slice.height,
    });
  }

  return buildPdfFromJpegPages(pages);
};

/**
 * 계약서를 PDF 파일로 내려받는다. **사람마다 한 파일이다.**
 *
 * 인쇄 대화상자를 거치지 않아 파일명 규칙(`261231_행사명_이름.pdf`)이
 * 그대로 지켜지고, 여러 명을 잇달아 받아도 각자 따로 떨어진다.
 */
export const downloadContractAsPdf = async (
  contractDocument: ContractDocument,
  fileName: string,
): Promise<void> => {
  download(await buildContractPdfBlob(contractDocument), fileName);
};
