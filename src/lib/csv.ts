import dayjs from "./dayjs";

export interface CsvColumn<T> {
  header: string;
  /** 셀 값. 표에 보이는 그대로의 문자열을 반환한다. */
  value: (row: T) => string | number | null | undefined;
}

/**
 * 값 하나를 CSV 셀로 변환한다.
 * 쉼표·큰따옴표·줄바꿈이 있으면 큰따옴표로 감싸고 내부 따옴표는 두 번 쓴다.
 */
const toCsvCell = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";

  const text = String(value);

  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * 목록 데이터를 CSV 문자열로 만든다.
 *
 * 엑셀이 한글을 깨뜨리지 않도록 BOM을 앞에 붙인다.
 */
export const toCsv = <T>(rows: T[], columns: CsvColumn<T>[]): string => {
  const header = columns.map((column) => toCsvCell(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => toCsvCell(column.value(row))).join(","),
  );

  return `﻿${[header, ...body].join("\r\n")}`;
};

/**
 * CSV를 파일로 내려받는다.
 * 파일명에는 내려받은 시각을 붙여 여러 번 받아도 구분되게 한다.
 */
export const downloadCsv = <T>(
  fileName: string,
  rows: T[],
  columns: CsvColumn<T>[],
) => {
  const blob = new Blob([toCsv(rows, columns)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${fileName}_${dayjs().format("YYYYMMDD_HHmm")}.csv`;
  anchor.click();

  URL.revokeObjectURL(url);
};
