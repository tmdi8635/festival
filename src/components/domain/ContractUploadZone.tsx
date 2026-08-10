"use client";

import { DragEvent, ReactNode, useId, useRef, useState } from "react";
import { useFileUploadMutation } from "@/api/file/postFileUpload";
import { Upload } from "@/icons";
import { showAppToast, showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import Spinner from "@/components/ui/Spinner";

/** 서명본으로 받을 수 있는 형식. 스캔은 PDF로, 휴대폰으로 찍으면 이미지로 온다. */
export const SIGNED_CONTRACT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** 업로드 최대 용량 (20MB). 여러 장짜리 스캔 PDF가 10MB를 넘는 일이 있다. */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export interface UploadedContractFile {
  fileUrl: string;
  fileName: string;
  mimeType: string;
}

interface ContractUploadZoneProps {
  onUploaded?: (file: UploadedContractFile) => void;
  /**
   * 고른 파일을 **올리지 않고 그대로** 넘긴다.
   *
   * 여러 장을 한 번에 받을 때는 올리기 전에 할 일이 있다. 파일명을 읽어
   * 누구 것인지 가려내야 하고, 주인을 못 찾은 파일은 아예 올리면 안 된다.
   * 올린 뒤에 판정하면 주인 없는 파일이 서버에 쌓인다.
   *
   * 이 값을 주면 `onUploaded`는 쓰이지 않는다.
   */
  onSelectFiles?: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  /** 명단 한 줄 위에 얹을 때처럼 생김새를 바꿔야 하는 경우 */
  children?: ReactNode;
  className?: string;
}

/**
 * 서명받은 근로계약서를 올리는 자리.
 *
 * 서버가 없는 동안 계약을 성립시키는 동작이 이것 하나다.
 * 담당자는 내려받은 문서를 출력해 서명받은 뒤, 스캔하거나 찍어서 여기에 올린다.
 * 올라간 순간 계약번호가 붙고 서명완료가 된다.
 *
 * 끌어다 놓기를 함께 받는 이유는 이 일이 **한 번에 여러 명분**이기 때문이다.
 * 서른 장을 스캔한 폴더를 열어 두고 이름을 보며 한 줄씩 끌어다 놓는 것이,
 * 매번 파일 선택 창을 열고 폴더를 다시 찾아 들어가는 것보다 훨씬 빠르다.
 */
const ContractUploadZone = ({
  onUploaded,
  onSelectFiles,
  multiple = false,
  disabled = false,
  children,
  className,
}: ContractUploadZoneProps) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { mutateAsync: uploadFile, isPending } = useFileUploadMutation();

  const isBusy = isPending || disabled;

  const handleUpload = async (file: File) => {
    if (!SIGNED_CONTRACT_MIME_TYPES.includes(file.type)) {
      showAppToast("warning", "PDF 또는 이미지(JPG · PNG · WEBP)만 올릴 수 있습니다.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showAppToast("warning", "20MB 이하 파일만 올릴 수 있습니다.");
      return;
    }

    try {
      const uploaded = await uploadFile({ fileType: "CONTRACT_SIGNED", file });

      onUploaded?.({
        fileUrl: uploaded.originalUrl,
        // 올린 파일의 원래 이름을 그대로 남긴다. 폴더에서 다시 찾을 때 이 이름으로 찾는다.
        fileName: file.name,
        mimeType: file.type,
      });
    } catch (error) {
      showErrorToast(error, "계약서를 올리지 못했습니다.");
    }
  };

  const handleSelect = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);

    if (files.length > 0) {
      if (onSelectFiles) onSelectFiles(files);
      else handleUpload(files[0]);
    }

    // 같은 파일을 다시 골라도 change가 발생하도록 값을 비운다.
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (isBusy) return;

    handleSelect(event.dataTransfer.files);
  };

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={[...SIGNED_CONTRACT_MIME_TYPES, ".pdf"].join(",")}
        multiple={multiple}
        disabled={isBusy}
        onChange={(event) => handleSelect(event.target.files)}
        className="hidden"
      />

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isBusy) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-field border border-dashed p-5 text-center transition",
          "hover:border-brand hover:bg-brand-opacity-3",
          isDragging ? "border-brand bg-brand-opacity-3" : "border-border-strong",
          isBusy && "pointer-events-none opacity-60",
          className,
        )}
      >
        {isPending ? (
          <>
            <Spinner size={22} className="text-brand" />
            <p className="text-[13px] text-font-2">올리는 중…</p>
          </>
        ) : (
          children ?? (
            <>
              <Upload size={24} className="text-font-disabled" />
              <p className="text-[13px] font-medium text-font-1">
                서명받은 계약서를 끌어다 놓거나 눌러서 올리세요
              </p>
              <p className="text-[12px] text-font-2">
                PDF · JPG · PNG · WEBP / 20MB 이하
              </p>
            </>
          )
        )}
      </label>
    </>
  );
};

export default ContractUploadZone;
