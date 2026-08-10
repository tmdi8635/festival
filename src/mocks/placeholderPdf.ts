/**
 * 목업용 서명본 PDF.
 *
 * 목업에는 파일을 보관할 스토리지가 없다. 그렇다고 시드의 서명본을 빈 값으로 두면
 * **화면에서 "올린 파일 미리보기"가 영영 확인되지 않는다.** 담당자가 확인해야 하는 것이
 * "누구 것이 올라갔는가"인데, 정작 그 자리가 목업에서는 늘 비어 있게 된다.
 *
 * 그래서 진짜 PDF 한 장을 만들어 둔다. 손으로 쓴 문자열이 아니라 **xref 표까지
 * 제대로 맞춘 파일**이다. 어긋나면 브라우저 PDF 뷰어가 열지 못해, 미리보기가
 * 되는지 안 되는지를 목업에서 판단할 수 없게 된다.
 *
 * 본문은 ASCII만 쓴다. 한글을 넣으려면 글꼴을 파일에 박아 넣어야 하는데,
 * 그건 이 자리(스캔본 자리를 채우는 종이 한 장)가 할 일이 아니다.
 */

/** PDF 문자열 안에서 뜻을 갖는 글자들을 흘려보낸다. */
const escapePdfText = (text: string) =>
  text.replace(/([\\()])/g, "\\$1").replace(/[^\x20-\x7e]/g, "?");

export const buildPlaceholderPdf = (lines: string[]): string => {
  const content = [
    "BT",
    "/F1 16 Tf",
    "72 760 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -24 Td",
      `(${escapePdfText(line)}) Tj`,
    ]),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");

  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
  ];

  const header = "%PDF-1.4\n";

  /*
    xref는 각 객체가 파일의 몇 번째 바이트에서 시작하는지를 적는 표다.
    그래서 본문을 다 만든 뒤에 **실제 길이를 세어** 채운다.
    (본문이 한 글자만 달라져도 이 숫자가 전부 밀린다)
  */
  let body = "";
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(header.length + body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = header.length + body.length;

  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<</Size ${objects.length + 1}/Root 1 0 R>>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");

  return `${header}${body}${xref}`;
};

/** 화면에서 바로 펼쳐 볼 수 있도록 data URL로 만든다. */
export const buildPlaceholderPdfDataUrl = (lines: string[]): string =>
  `data:application/pdf;base64,${btoa(buildPlaceholderPdf(lines))}`;
