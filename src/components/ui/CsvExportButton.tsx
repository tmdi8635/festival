"use client";

import { Download } from "@/icons";
import { downloadCsv, type CsvColumn } from "@/lib/csv";
import { showAppToast } from "@/lib/toast";
import Button from "./Button";

interface CsvExportButtonProps<T> {
  /** 확장자 없는 파일명. 내려받는 시각이 자동으로 붙는다. */
  fileName: string;
  rows: T[];
  columns: CsvColumn<T>[];
  disabled?: boolean;
}

/**
 * 목록 화면 공통 CSV 내보내기 버튼.
 *
 * **현재 페이지에 조회된 행만** 내려받는다.
 * 전체 기간을 받아야 하는 경우는 별도의 서버 내보내기 API가 필요하다.
 */
const CsvExportButton = <T,>({
  fileName,
  rows,
  columns,
  disabled = false,
}: CsvExportButtonProps<T>) => {
  const handleClick = () => {
    if (rows.length === 0) {
      showAppToast("warning", "내보낼 데이터가 없습니다.");
      return;
    }

    downloadCsv(fileName, rows, columns);
    showAppToast("success", `${rows.length}건을 CSV로 저장했습니다.`);
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={<Download size={15} />}
      onClick={handleClick}
      disabled={disabled}
      title="현재 조회된 목록을 CSV로 저장합니다."
    >
      CSV
    </Button>
  );
};

export default CsvExportButton;
