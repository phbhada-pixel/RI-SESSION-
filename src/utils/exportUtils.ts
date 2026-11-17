import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean)[][]
) {
  const worksheetData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportMultiSheetExcel(
  filename: string,
  sheets: Array<{ name: string; headers: string[]; rows: (string | number | boolean)[][] }>
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function parseExcelFileToSheets(
  file: File
): Promise<Record<string, Record<string, string>[]>> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const result: Record<string, Record<string, string>[]> = {};
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: false,
    });
    result[sheetName] = json.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        normalized[String(k).trim()] = String(v ?? '').trim();
      }
      return normalized;
    });
  }
  return result;
}

export function exportToPDF(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  orientation: 'portrait' | 'landscape' = 'landscape'
) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  doc.setFontSize(13);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(subtitle, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [headers],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 118, 110] },
  });

  doc.save(`${filename}.pdf`);
}
