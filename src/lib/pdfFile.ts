/**
 * 최소한의 PDF 작성기.
 *
 * 외부 라이브러리를 쓰지 않는다. PDF 생성기를 넣으면 한글 폰트를 통째로
 * 번들에 담아야 하고(2MB 남짓), 그렇게 만든 문서는 화면에서 본 것과 미묘하게
 * 달라진다. "내가 확인한 문서와 서명받은 문서가 다르다"가 되는 순간
 * 계약서 절차 자체가 쓸모를 잃는다.
 *
 * 그래서 **지면을 이미지로 구워 PDF에 얹는다.** 글자를 PDF의 텍스트로 넣지
 * 않으므로 폰트를 담을 필요가 없고, 보이는 것이 그대로 파일이 된다.
 * 이미지는 JPEG를 쓴다 — PDF는 JPEG 바이트를 아무 변환 없이 그대로 담을 수
 * 있어서(`DCTDecode`) 압축기를 따로 만들지 않아도 된다.
 * (PNG를 넣으려면 zlib과 스캔라인 필터를 직접 다뤄야 한다)
 *
 * ## 왜 인쇄 대화상자로는 안 되는가
 *
 * `window.print()`는 한 번에 **파일 하나**만 만든다. 서른 명의 계약서를
 * 사람마다 따로 받으려면 인쇄 창을 서른 번 열어야 하는데, 그렇게 쓰는
 * 사람은 없다. 계약서는 각자에게 나눠 주는 문서라 파일도 사람마다 하나여야 한다.
 */

/** A4 한 장의 크기 (PDF 포인트, 72dpi 기준) */
export const A4_POINT_WIDTH = 595.28;
export const A4_POINT_HEIGHT = 841.89;

export interface PdfPageImage {
  /** JPEG 원본 바이트 */
  bytes: Uint8Array;
  /** 픽셀 크기. 지면 비율을 맞추는 데 쓴다. */
  width: number;
  height: number;
}

/** PDF는 ASCII 바이트열이다. 문자열을 그대로 바이트로 바꾼다. */
const toBytes = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);

  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }

  return bytes;
};

/**
 * JPEG 지면들을 A4 PDF 한 파일로 묶는다.
 *
 * 각 장은 A4에 **가로를 꽉 채워** 얹고, 세로는 비율대로 둔다.
 * 이미지가 A4보다 세로로 길면 위쪽을 기준으로 맞춰 넣는다.
 * (지면을 자르는 일은 부르는 쪽이 미리 한다 — `buildContractPdfBlob`)
 */
export const buildPdfFromJpegPages = (pages: PdfPageImage[]): Blob => {
  if (pages.length === 0) {
    throw new Error("PDF로 만들 지면이 없습니다.");
  }

  /*
    PDF는 객체 번호로 서로를 가리키고, 파일 맨 끝의 상호 참조표(xref)가
    각 객체가 파일의 몇 바이트째에 있는지를 적는다. 그래서 조각을 만들면서
    **바이트 위치를 함께 세어 둔다.**
  */
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];

  let length = 0;

  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === "string" ? toBytes(part) : part;

    chunks.push(bytes);
    length += bytes.length;
  };

  /** 객체 하나를 시작한다. 시작 위치를 xref에 남긴다. */
  const startObject = (id: number) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };

  push("%PDF-1.4\n");

  /*
    객체 번호 배치.
    1 = 카탈로그, 2 = 페이지 묶음, 그다음부터 장마다 세 개씩
    (페이지 · 내용 스트림 · 이미지)를 쓴다.
  */
  const pageIds = pages.map((_, index) => 3 + index * 3);
  const contentIds = pages.map((_, index) => 4 + index * 3);
  const imageIds = pages.map((_, index) => 5 + index * 3);

  startObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  startObject(2);
  push(
    `<< /Type /Pages /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pages.length} >>\nendobj\n`,
  );

  pages.forEach((page, index) => {
    /*
      가로를 A4에 맞추고 세로는 비율대로 둔다.
      PDF 좌표는 왼쪽 **아래**가 원점이라, 위에서부터 그리려면
      y를 `지면 높이 − 이미지 높이`로 잡는다.
    */
    const drawWidth = A4_POINT_WIDTH;
    const drawHeight = (page.height / page.width) * A4_POINT_WIDTH;
    const y = A4_POINT_HEIGHT - drawHeight;

    startObject(pageIds[index]);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_POINT_WIDTH} ${A4_POINT_HEIGHT}] ` +
        `/Resources << /XObject << /Im0 ${imageIds[index]} 0 R >> >> ` +
        `/Contents ${contentIds[index]} 0 R >>\nendobj\n`,
    );

    // 이미지 하나를 지면에 얹는 그리기 명령. 행렬은 [가로 0 0 세로 x y]다.
    const content = `q\n${drawWidth} 0 0 ${drawHeight} 0 ${y} cm\n/Im0 Do\nQ\n`;

    startObject(contentIds[index]);
    push(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

    startObject(imageIds[index]);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${page.bytes.length} >>\nstream\n`,
    );
    // JPEG 바이트를 **그대로** 넣는다. 이게 DCTDecode를 쓰는 이유다.
    push(page.bytes);
    push("\nendstream\nendobj\n");
  });

  const xrefOffset = length;
  const objectCount = 2 + pages.length * 3;

  push(`xref\n0 ${objectCount + 1}\n`);
  push("0000000000 65535 f \n");

  for (let id = 1; id <= objectCount; id += 1) {
    push(`${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`);
  }

  push(
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
};
