import { HttpResponse, delay, http } from "msw";
import { MOCK_DELAY_MS } from "../utils";

const BASE_URI = process.env.NEXT_PUBLIC_BASE_URI;

/** 업로드된 파일에 붙일 다음 ID */
let nextFileId = 1;

/**
 * 업로드한 파일을 data URL로 변환한다.
 *
 * 목업에는 파일을 보관할 스토리지가 없다. blob URL은 새로고침하면 끊기므로,
 * 화면에서 미리보기와 저장 후 조회가 모두 동작하도록 data URL로 만들어 돌려준다.
 */
const toDataUrl = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return `data:${file.type};base64,${btoa(binary)}`;
};

export const fileHandlers = [
  http.post(
    `${BASE_URI}/admin/files/upload/:fileType`,
    async ({ request }) => {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return HttpResponse.json(
          { code: "FILE_REQUIRED", message: "업로드할 파일이 없습니다." },
          { status: 400 },
        );
      }

      const url = await toDataUrl(file);
      const fileId = nextFileId++;

      // 실제 서버는 원본/중간/썸네일 3종을 만들지만, 목업에서는 같은 이미지를 돌려준다.
      await delay(MOCK_DELAY_MS);

      return HttpResponse.json({
        originalFileId: fileId,
        originalUrl: url,
        mdUrl: url,
        smUrl: url,
      });
    },
  ),
];
