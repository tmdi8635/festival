"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMyContractPreviewQuery } from "@/api/my/getMyContracts";
import { ArrowDown, Download, Search } from "@/icons";
import { downloadContractAsPdf } from "@/lib/contractFile";
import { showAppToast, showErrorToast } from "@/lib/toast";
import { useJobRoleLabel } from "@/store/useOrgStore";
import { buildContractDocument, buildContractFileName } from "@/type/contract";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import ContractSheetView from "@/components/domain/ContractSheetView";
import DocumentZoomViewer from "@/components/domain/DocumentZoomViewer";
import PortalBackHeader from "@/app/(portal)/_components/PortalBackHeader";
import ContractNotFound from "./ContractNotFound";
import ContractRevisionSheet from "./ContractRevisionSheet";
import ContractSignSheet from "./ContractSignSheet";
import { useContractIdParam } from "./useContractIdParam";

type SheetKind = "SIGN" | "REVISION";

/**
 * 계약서 전문 — **읽고, 서명하거나 수정요청을 보내는 유일한 자리.**
 *
 * 서명 · 수정요청은 문서를 **끝까지 내린 뒤에야** 눌린다. 요약만 보고 누를 수 있으면
 * 조항은 아무도 읽지 않고, 그 서명은 나중에 "그 조항은 못 봤다"가 된다.
 * 문서가 짧아 한 화면에 다 들어오면 곧바로 풀린다.
 *
 * 두 버튼은 화면 아래에 붙어 있다. 폼을 문서 밑에 붙이면 문서를 읽던 사람은
 * 폼이 생긴 것조차 모른다. 버튼을 누르면 **하단 시트**가 올라와 그 자리에서 받는다.
 */
const ContractDocumentScreen = ({ contractId }: { contractId: number }) => {
  const router = useRouter();
  const jobRoleLabel = useJobRoleLabel();
  const { data, isLoading, isError } = useMyContractPreviewQuery(contractId);

  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  /* 한 번 끝까지 내렸으면 다시 올려도 잠그지 않는다. 이미 읽은 사람을 또 내리게 할 이유가 없다. */
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const contractDocument = useMemo(
    () =>
      data
        ? buildContractDocument(
            data.contract,
            data.template,
            jobRoleLabel(data.contract.role),
          )
        : null,
    [data, jobRoleLabel],
  );

  /*
    끝 표지는 **하단 바 뒤에** 둔다. 하단 바는 화면 아래에 붙어 있다가 문서가 끝나는
    자리에서야 제자리로 내려앉는데, 표지가 그 뒤에 있으면 "바가 제자리에 왔다 =
    문서 끝이 바 위로 다 보인다"가 된다. 문서 바로 밑에 두면 바에 가려진 채로 풀린다.

    effect 대신 콜백 ref에서 관찰한다. (effect 안의 setState는 React Compiler 린트에 걸린다)
  */
  const endRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasReachedEnd(true);
      },
      { root: node.closest("main") },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const detailHref = `/my/contracts/detail?id=${contractId}`;

  if (isError) {
    return (
      <>
        <PortalBackHeader href="/my/contracts" label="계약서 목록" />
        <ContractNotFound />
      </>
    );
  }

  if (isLoading || !data || !contractDocument) {
    return (
      <>
        <PortalBackHeader href={detailHref} label="계약서 요약" />
        <Skeleton className="h-[520px] w-full rounded-card" />
      </>
    );
  }

  const { contract, summary } = data;
  const isSignable = summary.status === "SENT";

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      await downloadContractAsPdf(
        contractDocument,
        buildContractFileName(
          contract.workDate,
          contract.eventTitle,
          contract.staffName,
          "pdf",
        ),
      );
      showAppToast("success", "계약서 PDF를 내려받았습니다.");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsDownloading(false);
    }
  };

  /* 서명 · 수정요청이 끝나면 상세로 돌아간다. 거기서 바뀐 상태와 이력을 바로 확인한다. */
  const backToDetail = () => {
    setSheet(null);
    router.push(detailHref);
  };

  return (
    <>
      <PortalBackHeader
        href={detailHref}
        label="계약서 요약"
        action={
          <>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Search size={14} />}
              onClick={() => setIsZoomOpen(true)}
            >
              크게 보기
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Download size={14} />}
              isLoading={isDownloading}
              disabled={isDownloading}
              onClick={handleDownload}
            >
              PDF
            </Button>
          </>
        }
      />

      <div className="min-w-0">
        <h2 className="truncate text-[17px] font-semibold text-font-0">
          {summary.eventTitle}
        </h2>
        <p className="mt-0.5 text-[13px] text-font-2">
          {summary.revision > 1 && `${summary.revision}차 · `}계약번호{" "}
          <span className="tabular-nums">{summary.contractNumber || "-"}</span>
        </p>
      </div>

      {summary.status === "REJECTED" && (
        <Alert tone="info" title="수정요청을 보낸 문서예요.">
          업체가 다시 발급하면 새 문서에 서명할 수 있어요.
        </Alert>
      )}
      {summary.status === "SIGNED" && (
        <Alert tone="success" title="서명이 끝난 문서예요.">
          문서 아래쪽에서 서명과 서명 시각을 확인할 수 있어요.
        </Alert>
      )}
      {summary.status === "SUPERSEDED" && (
        <Alert tone="info" title="새 차수로 대체된 보관용 문서예요.">
          지금 유효한 문서는 계약서 요약의 이력에서 열 수 있어요.
        </Alert>
      )}

      {/*
        인쇄 안내는 끈다. "A4 2장을 모두 배부하세요"는 문서를 나눠 주는 담당자에게
        하는 말이고, 여기서는 할 수 있는 일이 없다.
      */}
      <ContractSheetView document={contractDocument} fitToWidth showPrintGuide={false} />

      {isSignable && (
        <>
          <p className="text-center text-[12px] text-font-disabled">
            계약서 끝 · 폭이 좁아 글자가 작으면 &lsquo;크게 보기&rsquo;로 확인해 주세요
          </p>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border-main bg-surface px-4 py-3">
            {!hasReachedEnd && (
              <p className="flex items-center justify-center gap-1.5 text-[12px] text-font-2">
                <ArrowDown size={13} />
                끝까지 확인하면 서명할 수 있어요
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                disabled={!hasReachedEnd}
                onClick={() => setSheet("REVISION")}
              >
                수정요청
              </Button>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!hasReachedEnd}
                onClick={() => setSheet("SIGN")}
              >
                서명하기
              </Button>
            </div>
          </div>

          <div ref={endRef} aria-hidden className="h-px" />
        </>
      )}

      {sheet === "SIGN" && (
        <ContractSignSheet
          contractId={contractId}
          eventTitle={summary.eventTitle}
          documentText={contractDocument.plainText}
          onClose={() => setSheet(null)}
          onSigned={backToDetail}
        />
      )}

      {sheet === "REVISION" && (
        <ContractRevisionSheet
          contractId={contractId}
          eventTitle={summary.eventTitle}
          onClose={() => setSheet(null)}
          onSent={backToDetail}
        />
      )}

      {isZoomOpen && (
        <DocumentZoomViewer
          title={summary.eventTitle}
          document={contractDocument}
          onClose={() => setIsZoomOpen(false)}
        />
      )}
    </>
  );
};

/**
 * `?id=`를 읽고 계약서마다 화면을 새로 세운다.
 *
 * `key`로 갈라 두지 않으면 다른 계약서로 옮겨 가도 '끝까지 읽음'이 그대로 남아,
 * 새 문서를 한 줄도 안 읽고 서명할 수 있게 된다.
 */
const MyContractDocument = () => {
  const contractId = useContractIdParam();

  if (contractId === null) {
    return (
      <>
        <PortalBackHeader href="/my/contracts" label="계약서 목록" />
        <ContractNotFound />
      </>
    );
  }

  return <ContractDocumentScreen key={contractId} contractId={contractId} />;
};

export default MyContractDocument;
