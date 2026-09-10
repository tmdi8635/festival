/**
 * 시드용 전자서명 이미지.
 *
 * 진짜 캔버스 서명은 사람이 그려야 나온다. 시드에 빈 값을 넣으면 계약서 상세의
 * 서명란이 목업에서 영영 비어 있고, "전자서명으로 받은 건이 어떻게 보이는가"를
 * 만들면서 확인할 수 없다. 담당자가 가장 먼저 보는 자리라 비워 둘 수 없다.
 *
 * SVG로 만든다. PNG를 라이브러리 없이 만들려면 zlib이 필요한데
 * (`lib/pdfFile.ts`가 JPEG를 고른 이유와 같다), 서명은 선 몇 개라 SVG로 충분하다.
 * 실제 서명은 캔버스가 만든 `image/png` data URL이고, 붙는 자리는 같다.
 */
export const buildPlaceholderSignatureDataUrl = (seed: number): string => {
  /* 사람마다 다르게 흔들리는 곡선. 같은 seed면 같은 모양이 나온다. */
  const wobble = (index: number) => ((seed * (index + 3) * 37) % 40) - 20;

  const path = [
    `M 40 ${190 + wobble(0)}`,
    `C 120 ${90 + wobble(1)}, 190 ${240 + wobble(2)}, 270 ${150 + wobble(3)}`,
    `S 420 ${70 + wobble(4)}, 500 ${185 + wobble(5)}`,
    `S 640 ${230 + wobble(6)}, 720 ${120 + wobble(7)}`,
  ].join(" ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300" viewBox="0 0 900 300"><path d="${path}" fill="none" stroke="#111111" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
