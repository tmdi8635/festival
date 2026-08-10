"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText } from "@/icons";
import { formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { ContractSignedFile } from "@/type/contract";

interface ContractFilePreviewProps {
  file: ContractSignedFile;
  /** 위에 함께 적을 설명. (`2차 서명본`처럼) */
  label?: string;
  className?: string;
}

/**
 * 등록한 서명본을 **그 자리에서 펼쳐 본다.**
 *
 * 파일명만 적어 두면 잘못 올린 것을 알아챌 방법이 없다.
 * 스캔 폴더에서 한 칸 밀려 옆 사람 파일을 올리는 일이 실제로 나는데,
 * 그때 화면에 남는 것은 그럴듯한 파일명 한 줄뿐이다. 열어 봐야 안다.
 * **여는 수고가 있으면 아무도 열어 보지 않으므로** 처음부터 펼쳐 둔다.
 *
 * PDF는 `data:` 주소를 그대로 `<iframe>`에 넣을 수 없다. (크롬이 막는다)
 * 같은 내용을 `blob:` 주소로 바꿔 끼운다.
 */
const ContractFilePreview = ({
  file,
  label,
  className,
}: ContractFilePreviewProps) => {
  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";

  /*
    `blob:` 주소는 만들면 문서가 닫힐 때까지 살아 있다.
    차수를 옮겨 다니며 여러 장을 보면 그만큼 쌓이므로 반드시 되돌려 준다.
  */
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isPdf || !file.url.startsWith("data:")) return;

    let revoked = false;
    let created = "";

    fetch(file.url)
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
  }, [file.url, isPdf]);

  const viewUrl = isPdf ? (blobUrl ?? "") : file.url;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2 rounded-field border border-border-main bg-subtle px-3 py-2.5">
        <FileText size={16} className="shrink-0 text-font-2" />

        <span className="min-w-0 flex-1 truncate text-[13px] text-font-1">
          {label && <b className="mr-1.5">{label}</b>}
          {file.fileName}
        </span>

        <span className="shrink-0 text-[12px] text-font-2 tabular-nums">
          {formatDateTime(file.uploadedAt)} 등록
        </span>

        {file.url && (
          <>
            <a
              href={file.url}
              download={file.fileName}
              className="flex shrink-0 items-center gap-1 text-[13px] text-brand transition hover:opacity-80"
            >
              <Download size={14} />
              내려받기
            </a>

            {/* 작은 미리보기로는 글씨가 안 보이는 스캔본이 있다. 크게 볼 길을 남긴다. */}
            <a
              href={viewUrl || file.url}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-1 text-[13px] text-font-2 transition hover:text-font-1"
            >
              <ExternalLink size={14} />
              새 창
            </a>
          </>
        )}
      </div>

      {!file.url ? (
        <p className="rounded-field border border-dashed border-border-strong px-3 py-6 text-center text-[13px] text-font-2">
          이 건은 파일이 남아 있지 않습니다. 원본을 다시 올려 주세요.
        </p>
      ) : isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.url}
          alt={`${file.fileName} 미리보기`}
          className="max-h-[520px] w-full rounded-field border border-border-main bg-subtle object-contain"
        />
      ) : isPdf ? (
        viewUrl ? (
          <>
            <iframe
              src={viewUrl}
              title={`${file.fileName} 미리보기`}
              className="h-[520px] w-full rounded-field border border-border-main bg-subtle"
            />
            {/*
              PDF를 화면에 그리는 것은 브라우저가 하는 일이라, 뷰어가 꺼져 있으면
              틀만 남고 아무것도 안 보인다. 그때 여기서 막히지 않도록 길을 적어 둔다.
            */}
            <p className="text-[12px] text-font-2">
              위 칸이 비어 보이면 브라우저에 PDF 뷰어가 없는 것입니다.
              &lsquo;새 창&rsquo; 또는 &lsquo;내려받기&rsquo;로 확인해 주세요.
            </p>
          </>
        ) : (
          <p className="rounded-field border border-border-main px-3 py-6 text-center text-[13px] text-font-2">
            미리보기를 준비하고 있습니다…
          </p>
        )
      ) : (
        <p className="rounded-field border border-border-main px-3 py-6 text-center text-[13px] text-font-2">
          화면에서 펼쳐 볼 수 없는 형식입니다. 내려받아 확인해 주세요.
        </p>
      )}
    </div>
  );
};

export default ContractFilePreview;
