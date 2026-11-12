import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { getAggregationLabel } from "@/lib/pivot/aggregate";

// ── Style constants ────────────────────────────────────────────────────
const BORDER_ALL: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2E7D32" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 10,
};

const NORMAL_FONT: Partial<ExcelJS.Font> = { size: 10 };

// ── Types ──────────────────────────────────────────────────────────────

export interface ExportColumn {
  /** Key in the data object */
  key: string;
  /** Display title for Excel header */
  title: string;
  /** Column width (auto-calculated if not provided) */
  width?: number;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Number format string (e.g. "#,##0", "#,##0.00") */
  numFmt?: string;
}

interface StyledExportOptions {
  /** Title row at the top of the sheet */
  title: string;
  /** Subtitle (e.g. periode) */
  subtitle?: string;
  /** Column definitions */
  columns: ExportColumn[];
  /** Data rows */
  items: Record<string, any>[];
  /** File name without .xlsx extension */
  fileName: string;
  /** Number of header columns to show (for detail mode, to style header columns differently) */
  headerColCount?: number;
  /** Alternating row fill */
  altRowFill?: ExcelJS.Fill;
}

// ── Helpers ────────────────────────────────────────────────────────────

function calcAutoWidth(key: string, items: Record<string, any>[], titleLen: number): number {
  let maxLen = titleLen;
  for (const item of items) {
    const val = item[key];
    const len = String(val ?? "").length;
    if (len > maxLen) maxLen = len;
  }
  // Clamp between 8 and 40
  return Math.min(40, Math.max(8, maxLen + 2));
}

function setHeaderCell(cell: ExcelJS.Cell, value: string) {
  cell.value = value;
  cell.font = HEADER_FONT;
  cell.fill = HEADER_FILL;
  cell.border = BORDER_ALL;
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
}

function setCell(
  cell: ExcelJS.Cell,
  value: any,
  align: "left" | "center" | "right" = "left",
  numFmt?: string,
) {
  cell.value = value;
  cell.font = NORMAL_FONT;
  cell.border = BORDER_ALL;
  cell.alignment = { vertical: "middle", horizontal: align };
  if (numFmt) {
    cell.numFmt = numFmt;
    cell.alignment = { vertical: "middle", horizontal: "right" };
  }
}

function applyAltRow(row: ExcelJS.Row, fill: ExcelJS.Fill) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill;
  });
}

// ── Main export functions ──────────────────────────────────────────────

/**
 * Export header-only (browse table data) with styling
 */
export async function exportStyledHeader(options: StyledExportOptions) {
  const { title, subtitle, columns, items, fileName } = options;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Header");

  const lastCol = String.fromCharCode(64 + columns.length);
  const today = new Date();
  const tglStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  // Title row
  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 12 };

  // Subtitle row
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell("A2").value = subtitle || `Tanggal : ${tglStr}`;
  ws.getCell("A2").font = { size: 10 };

  // Empty row
  ws.addRow([]);

  // Header row
  const hRow = ws.addRow(columns.map((c) => c.title));
  hRow.eachCell((cell, colNumber) => {
    setHeaderCell(cell, columns[colNumber - 1].title);
  });
  hRow.height = 20;

  // Data rows
  const altRowFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F5F5" },
  };

  for (const item of items) {
    const row = ws.addRow([]);
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const val = item[col.key];
      const align = col.align || (col.numFmt ? "right" : "left");
      setCell(cell, val, align, col.numFmt);
    });
    row.height = 16;
  }

  // Auto-fit column widths
  columns.forEach((col, i) => {
    if (col.width) {
      ws.getColumn(i + 1).width = col.width;
    } else {
      ws.getColumn(i + 1).width = calcAutoWidth(col.key, items, col.title.length);
    }
  });

  // Save
  const buf = await wb.xlsx.writeBuffer();
  const tglFile = today.toISOString().slice(0, 10);
  saveAs(new Blob([buf]), `${fileName}_${tglFile}.xlsx`);
}

/**
 * Export banded header (2-row header with rowspan/colspan) with styling
 * Used for LapBulanan4, LapBulanan5 etc.
 */
export async function exportStyledBandedHeader(options: {
  title: string;
  subtitle?: string;
  /** Band definitions: each band has a label, span (col count), and sub-column keys */
  bands: { band: string; span: number; cols: { key: string; title: string }[] }[];
  /** All flat column definitions (for data mapping + widths) */
  columns: ExportColumn[];
  items: Record<string, any>[];
  fileName: string;
}) {
  const { title, subtitle, bands, columns, items, fileName } = options;
  const totalCols = columns.length;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Header");

  const today = new Date();
  const tglStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  // Title row
  const lastColLetter = totalCols <= 26
    ? String.fromCharCode(64 + totalCols)
    : String.fromCharCode(64 + Math.floor((totalCols - 1) / 26)) + String.fromCharCode(65 + ((totalCols - 1) % 26));
  ws.mergeCells(`A1:${lastColLetter}1`);
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 12 };

  // Subtitle row
  ws.mergeCells(`A2:${lastColLetter}2`);
  ws.getCell("A2").value = subtitle || `Tanggal : ${tglStr}`;
  ws.getCell("A2").font = { size: 10 };

  ws.addRow([]);

  // ── Band row (row 4) ──────────────────────────────────────────────
  const bandRow = ws.getRow(4);
  let colIdx = 1;
  for (const g of bands) {
    const cell = bandRow.getCell(colIdx);
    cell.value = g.band;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = BORDER_ALL;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    if (g.span === 1) {
      // rowspan 2 → merge vertically
      ws.mergeCells(4, colIdx, 5, colIdx);
    } else {
      // colspan → merge horizontally
      ws.mergeCells(4, colIdx, 4, colIdx + g.span - 1);
    }
    colIdx += g.span;
  }
  bandRow.height = 20;

  // ── Sub-header row (row 5) ───────────────────────────────────────
  const subRow = ws.getRow(5);
  colIdx = 1;
  for (const g of bands) {
    if (g.span === 1) {
      // Already merged from band row — skip
      colIdx += 1;
    } else {
      for (const col of g.cols) {
        const cell = subRow.getCell(colIdx);
        cell.value = col.title;
        cell.font = HEADER_FONT;
        cell.fill = HEADER_FILL;
        cell.border = BORDER_ALL;
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        colIdx++;
      }
    }
  }
  subRow.height = 20;

  // ── Data rows ─────────────────────────────────────────────────────
  const altRowFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F5F5" },
  };

  for (const item of items) {
    const row = ws.addRow([]);
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const val = item[col.key];
      const align = col.align || (col.numFmt ? "right" : "left");
      setCell(cell, val, align, col.numFmt);
    });
    // Alternate row coloring
    if ((items.indexOf(item) % 2) === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = altRowFill; });
    }
    row.height = 16;
  }

  // Column widths
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width || calcAutoWidth(col.key, items, col.title.length);
  });

  const buf = await wb.xlsx.writeBuffer();
  const tglFile = today.toISOString().slice(0, 10);
  saveAs(new Blob([buf]), `${fileName}_${tglFile}.xlsx`);
}

/**
 * Export detail (header + detail merged in flat sheet) with styling
 * Each detail row includes the header key columns repeated.
 */
export async function exportStyledDetail(options: {
  /** Title row */
  title: string;
  /** Subtitle */
  subtitle?: string;
  /** Header column definitions (left side) */
  headerColumns: ExportColumn[];
  /** Detail column definitions (right side) */
  detailColumns: ExportColumn[];
  /** The key field linking header to detail */
  detailKeyField: string;
  /** Header items (all browse rows) */
  headerItems: Record<string, any>[];
  /** Detail map: key -> detail rows[] */
  detailMap: Record<string, Record<string, any>[]>;
  /** File name without .xlsx */
  fileName: string;
}) {
  const {
    title,
    subtitle,
    headerColumns,
    detailColumns,
    detailKeyField,
    headerItems,
    detailMap,
    fileName,
  } = options;

  const allColumns = [...headerColumns, ...detailColumns];
  const totalCols = allColumns.length;
  const lastCol = String.fromCharCode(64 + totalCols);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Detail");

  const today = new Date();
  const tglStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  // Title row
  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 12 };

  // Subtitle row
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell("A2").value = subtitle || `Tanggal : ${tglStr}`;
  ws.getCell("A2").font = { size: 10 };

  ws.addRow([]);

  // Header row
  const hRow = ws.addRow(allColumns.map((c) => c.title));
  hRow.eachCell((cell, colNumber) => {
    setHeaderCell(cell, allColumns[colNumber - 1].title);
  });
  hRow.height = 20;

  // Style: header columns (left side) get a light green background
  const headerColFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F5E9" },
  };
  const altRowFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F5F5" },
  };

  // Data rows: header + detail merged flat
  let lastKey = "";
  for (const headerItem of headerItems) {
    const key = String(headerItem[detailKeyField] ?? "");
    const details = detailMap[key] || [];
    const rowCount = Math.max(details.length, 1);

    for (let i = 0; i < rowCount; i++) {
      const row = ws.addRow([]);
      const rowIdx = row.number;

      // Header columns (left side)
      headerColumns.forEach((col, ci) => {
        const cell = row.getCell(ci + 1);
        if (i === 0) {
          const val = headerItem[col.key];
          const align = col.align || (col.numFmt ? "right" : "left");
          setCell(cell, val, align, col.numFmt);
        } else {
          setCell(cell, "", "left");
        }
        // Light green background for header columns
        cell.fill = headerColFill;
      });

      // Detail columns (right side)
      detailColumns.forEach((col, di) => {
        const cell = row.getCell(headerColumns.length + di + 1);
        const d = details[i];
        const val = d ? d[col.key] : undefined;
        const align = col.align || (col.numFmt ? "right" : "left");
        setCell(cell, val ?? "", align, col.numFmt);
      });

      row.height = 16;
    }

    lastKey = key;
  }

  // Auto-fit column widths
  allColumns.forEach((col, i) => {
    if (col.width) {
      ws.getColumn(i + 1).width = col.width;
    } else {
      // Calculate width from both header and detail items
      let maxLen = col.title.length;
      for (const item of headerItems) {
        const val = String(item[col.key] ?? "");
        if (val.length > maxLen) maxLen = val.length;
      }
      ws.getColumn(i + 1).width = Math.min(40, Math.max(8, maxLen + 2));
    }
  });

  // Save
  const buf = await wb.xlsx.writeBuffer();
  const tglFile = today.toISOString().slice(0, 10);
  saveAs(new Blob([buf]), `${fileName}_Detail_${tglFile}.xlsx`);
}

// ── Pivot export ───────────────────────────────────────────────────────

/** Bentuk struktural minimal sel pivot (tidak terikat tipe library pivot mana pun). */
interface PivotExportCell {
  value: number | null;
  formattedValue: string;
}

interface PivotExportValueField {
  field: string;
  label?: string;
  aggregation: string;
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Export a rendered pivot table to Excel, mirroring what is shown on screen:
 * merged column headers (per level), row-field label columns, data rows,
 * row-total column, column-total row and the grand total.
 */
export async function exportPivotToExcel(options: {
  title: string;
  subtitle?: string;
  rowFields: string[];
  valueFields: PivotExportValueField[];
  /** Raw pivotResult.headers (one array per column-field level) */
  columnHeaders: string[][];
  rowHeaders: string[][];
  data: PivotExportCell[][];
  rowTotals: PivotExportCell[];
  columnTotals: PivotExportCell[];
  grandTotal: PivotExportCell | null;
  fileName: string;
}) {
  const {
    title,
    subtitle,
    rowFields,
    valueFields,
    columnHeaders,
    rowHeaders,
    data,
    rowTotals,
    columnTotals,
    grandTotal,
    fileName,
  } = options;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Pivot");

  const today = new Date();
  const tglStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  const numDataCols = data[0]?.length ?? 0;
  const hasRowTotals = rowTotals.length > 0;
  const hasColumnTotals = columnTotals.length > 0;
  const rowHeaderCols = rowFields.length > 0 ? rowFields : ["Rows"];
  const totalCols = rowHeaderCols.length + numDataCols + (hasRowTotals ? 1 : 0);

  // Column header block (merged runs of equal labels, like the rendered pivot)
  let headerLevels: { label: string; colspan: number }[][] = [];
  if (columnHeaders.length === 0) {
    // No column fields: fall back to one row of value-field labels
    headerLevels = [
      valueFields.map((vf) => ({
        label: `${vf.label || vf.field} (${getAggregationLabel(vf.aggregation as any)})`,
        colspan: 1,
      })),
    ];
  } else {
    for (const headerRow of columnHeaders) {
      const cells: { label: string; colspan: number }[] = [];
      let i = 0;
      while (i < headerRow.length) {
        const value = headerRow[i];
        let colspan = 1;
        while (i + colspan < headerRow.length && headerRow[i + colspan] === value) colspan++;
        cells.push({ label: value, colspan });
        i += colspan;
      }
      headerLevels.push(cells);
    }
  }
  if (headerLevels.length === 0) headerLevels = [[]];
  const numHeaderLevels = headerLevels.length;

  // Title / subtitle
  const lastCol = colLetter(totalCols);
  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 12 };
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell("A2").value = subtitle || `Tanggal : ${tglStr}`;
  ws.getCell("A2").font = { size: 10 };
  ws.addRow([]);

  const headerRowStart = ws.rowCount + 1;

  // Row-field labels (top-left), rowspan = number of header levels
  rowHeaderCols.forEach((field, idx) => {
    const cell = ws.getCell(headerRowStart, idx + 1);
    setHeaderCell(cell, field);
    if (numHeaderLevels > 1) {
      ws.mergeCells(headerRowStart, idx + 1, headerRowStart + numHeaderLevels - 1, idx + 1);
    }
  });

  // Column header rows
  for (let level = 0; level < numHeaderLevels; level++) {
    const row = ws.getRow(headerRowStart + level);
    let col = rowHeaderCols.length + 1;
    for (const cell of headerLevels[level]) {
      const c = row.getCell(col);
      setHeaderCell(c, cell.label);
      if (cell.colspan > 1) {
        ws.mergeCells(headerRowStart + level, col, headerRowStart + level, col + cell.colspan - 1);
      }
      col += cell.colspan;
    }
  }

  // Total header (right side), rowspan = number of header levels
  if (hasRowTotals) {
    const c = ws.getCell(headerRowStart, rowHeaderCols.length + numDataCols + 1);
    setHeaderCell(c, "Total");
    if (numHeaderLevels > 1) {
      ws.mergeCells(
        headerRowStart,
        rowHeaderCols.length + numDataCols + 1,
        headerRowStart + numHeaderLevels - 1,
        rowHeaderCols.length + numDataCols + 1,
      );
    }
  }

  // Data rows
  const dataRowStart = headerRowStart + numHeaderLevels;
  const altRowFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F5F5" },
  };
  data.forEach((row, ri) => {
    const excelRow = ws.getRow(dataRowStart + ri);
    const rh = rowHeaders[ri] ?? [];
    rh.forEach((val, idx) => {
      setCell(excelRow.getCell(idx + 1), val, "left");
    });
    row.forEach((cell, ci) => {
      setCell(excelRow.getCell(rowHeaderCols.length + ci + 1), cell.value ?? "", "right", "#,##0");
    });
    if (hasRowTotals && rowTotals[ri]) {
      setCell(excelRow.getCell(rowHeaderCols.length + numDataCols + 1), rowTotals[ri].value ?? "", "right", "#,##0");
    }
    excelRow.height = 16;
    if (ri % 2 === 1) applyAltRow(excelRow, altRowFill);
  });

  // Column-totals row
  if (hasColumnTotals) {
    const excelRow = ws.getRow(dataRowStart + data.length);
    setHeaderCell(excelRow.getCell(1), "Total");
    if (rowHeaderCols.length > 1) {
      ws.mergeCells(dataRowStart + data.length, 1, dataRowStart + data.length, rowHeaderCols.length);
    }
    columnTotals.forEach((cell, ci) => {
      setCell(excelRow.getCell(rowHeaderCols.length + ci + 1), cell.value ?? "", "right", "#,##0");
    });
    if (hasRowTotals && grandTotal) {
      setCell(excelRow.getCell(rowHeaderCols.length + numDataCols + 1), grandTotal.value ?? "", "right", "#,##0");
    }
  }

  // Column widths
  rowHeaderCols.forEach((_, idx) => {
    ws.getColumn(idx + 1).width = 20;
  });
  for (let ci = 0; ci < numDataCols; ci++) {
    ws.getColumn(rowHeaderCols.length + ci + 1).width = 14;
  }
  if (hasRowTotals) ws.getColumn(totalCols).width = 14;

  const buf = await wb.xlsx.writeBuffer();
  const tglFile = today.toISOString().slice(0, 10);
  saveAs(new Blob([buf]), `${fileName}_${tglFile}.xlsx`);
}
