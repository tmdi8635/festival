import { useMutation } from "@tanstack/react-query";
import { adminAxios } from "..";
import type { AppError } from "@/type/api";

export type FileUploadId = string | number;

/**
 * 업로드 용도.
 *
 * 신분증 · 통장사본은 개인정보라 서버에서 보관 기간과 접근 권한을
 * 프로필 사진과 다르게 가져가야 하므로 용도를 분리한다.
 */
export type FileUploadType =
  | "STAFF_PROFILE"
  | "STAFF_ID_CARD"
  | "STAFF_BANK_BOOK"
  | "EVENT_PHOTO"
  /** 서명받은 근로계약서. 종이를 스캔한 PDF이거나 찍은 사진이다. */
  | "CONTRACT_SIGNED";

export interface FileUploadResponse {
  originalFileId: FileUploadId;
  originalUrl: string;
  mdUrl: string;
  smUrl: string;
}

export interface PostFileUploadParams {
  fileType: FileUploadType;
  file: File;
}

const createFileUploadFormData = (file: File) => {
  // 업로드 API는 multipart/form-data의 file 필드만 요구하므로 payload 생성을 한 곳에서 관리합니다.
  const formData = new FormData();
  formData.append("file", file);

  return formData;
};

export const postFileUpload = async ({
  fileType,
  file,
}: PostFileUploadParams) => {
  // fileType은 Path Variable로 전달합니다.
  const response = await adminAxios.post<FileUploadResponse>(
    `/admin/files/upload/${fileType}`,
    createFileUploadFormData(file),
    { headers: { "Content-Type": "multipart/form-data" } },
  );

  const uploadedFile = response.data;

  // fileId가 없으면 이후 생성·수정 API에 잘못된 값을 넘기므로 여기서 먼저 중단합니다.
  if (!uploadedFile?.originalFileId) {
    throw new Error("업로드 응답에 originalFileId가 없습니다.");
  }

  return uploadedFile;
};

/** 이미지 파일을 업로드하고 후속 API에 전달할 URL을 발급받습니다. */
export const useFileUploadMutation = () => {
  return useMutation<FileUploadResponse, AppError, PostFileUploadParams>({
    mutationKey: ["post-file-upload"],
    mutationFn: postFileUpload,
  });
};
