import { HttpResponse, delay, http } from "msw";
import { BASE_URI, MOCK_DELAY_MS, requirePermission } from "../utils";

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
    async ({ params, request }) => {
      /*
        올리는 파일마다 요구하는 권한이 다르다.

        신분증 · 통장사본은 개인정보라 따로 뗀 권한(`staffDocument:write`)이 있는데,
        업로드 주소를 열어 두면 그 권한 없이도 파일만 올린 뒤
        인력 수정으로 붙일 수 있다. 뒷문을 하나 남겨 두는 셈이다.
        프로필 사진처럼 그 밖의 파일은 인력을 고칠 수 있으면 올릴 수 있다.
      */
      const isStaffDocument =
        params.fileType === "STAFF_ID_CARD" ||
        params.fileType === "STAFF_BANK_BOOK";

      // 서명받은 계약서는 계약서를 다룰 수 있는 사람만 올린다.
      const isContract = params.fileType === "CONTRACT_SIGNED";

      const denied = requirePermission(
        request,
        isContract
          ? "contract:write"
          : isStaffDocument
            ? "staffDocument:write"
            : "staff:write",
      );

      if (denied) return denied;

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
