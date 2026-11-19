import jsPDF from 'jspdf';
import {
  Beneficiary,
  MaternalServiceRecord,
  PregnancyEpisode,
  SheetDatabase,
} from '../types';
import { formatDDMMYYYY, getTodayIST } from './dateUtils';
import { formatDateTimeIST, formatNumberIN } from './localeUtils';
import {
  buildAncComparisonRows,
  calculateGestationalWeeksAndDays,
  calculateWomanAgeFromDob,
  EVERY_VISIT_ANC_CODES,
  formatDeliveryFacilityTypeMarathi,
  formatGravidaSummary,
  groupMaternalVisitsByDate,
  parseBpSystolicDiastolic,
  parseJsonArraySafe,
} from './maternalUtils';
import { maskAadhaar } from './privacyUtils';

const FONT_FAMILY = "'Noto Sans Devanagari', 'Plus Jakarta Sans', system-ui, sans-serif";
const PDF_SCALE = 2;
const A4_PORTRAIT_PX = { w: 794, h: 1123 };
const MARGIN_X = 32;
const MARGIN_TOP = 38;
const MARGIN_BOTTOM = 40;

const VITAL_SERVICE_CODES = new Set<string>(EVERY_VISIT_ANC_CODES);
const TD_SERVICE_CODES = new Set<string>(['TD_1', 'TD_2', 'TD_BOOSTER']);

interface PageSurface {
  logicalW: number;
  logicalH: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  y: number;
}

interface TableColumnSpec {
  header: string;
  widthWeight: number;
  align?: 'left' | 'center' | 'right';
}

function createPortraitSurface(): PageSurface {
  const { w, h } = A4_PORTRAIT_PX;
  const canvas = document.createElement('canvas');
  canvas.width = w * PDF_SCALE;
  canvas.height = h * PDF_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('PDF तयार करण्यासाठी Canvas संदर्भ उपलब्ध नाही.');
  }
  ctx.scale(PDF_SCALE, PDF_SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'top';
  return {
    logicalW: w,
    logicalH: h,
    canvas,
    ctx,
    y: MARGIN_TOP,
  };
}

async function ensureDevanagariFontsLoaded() {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.load(`400 12px "Noto Sans Devanagari"`);
      await document.fonts.load(`700 14px "Noto Sans Devanagari"`);
      await document.fonts.ready;
    } catch {
      // Proceed cleanly
    }
  }
}

function wrapCellText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const safeText = (text || '-').replace(/\r\n/g, '\n');
  const paragraphs = safeText.split('\n');
  const result: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      result.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          result.push(currentLine);
          currentLine = '';
        }
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const ch of Array.from(word)) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              result.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          currentLine = chunk;
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) result.push(currentLine);
  }

  return result.length > 0 ? result : ['-'];
}

function drawRunningHeader(page: PageSurface, ben: Beneficiary, reportDateLabel: string) {
  const { ctx, logicalW } = page;
  ctx.save();
  ctx.font = `700 8.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#0f766e';
  ctx.textAlign = 'left';
  ctx.fillText(
    'प्राथमिक आरोग्य केंद्र भादा – गर्भवती माता व्यवस्थापन प्रणाली',
    MARGIN_X,
    12
  );
  ctx.font = `600 8.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'right';
  ctx.fillText(
    `ID: ${ben.beneficiaryCode} · रिपोर्ट तारीख: ${reportDateLabel}`,
    logicalW - MARGIN_X,
    12
  );
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, 26);
  ctx.lineTo(logicalW - MARGIN_X, 26);
  ctx.stroke();
  ctx.restore();
  page.y = 33;
}

function drawSectionBanner(
  page: PageSurface,
  title: string,
  pages: PageSurface[],
  ben: Beneficiary,
  reportDateLabel: string,
  accentColor = '#0f766e'
): PageSurface {
  let active = page;
  if (active.y + 38 > active.logicalH - MARGIN_BOTTOM) {
    active = createPortraitSurface();
    pages.push(active);
    drawRunningHeader(active, ben, reportDateLabel);
  }
  const { ctx, logicalW } = active;
  ctx.save();
  ctx.fillStyle = accentColor;
  ctx.fillRect(MARGIN_X, active.y, logicalW - MARGIN_X * 2, 20);
  ctx.font = `700 10.2px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(title, MARGIN_X + 8, active.y + 4.5);
  ctx.restore();
  active.y += 23;
  return active;
}

function drawSubHeading(
  page: PageSurface,
  subtitle: string,
  pages: PageSurface[],
  ben: Beneficiary,
  reportDateLabel: string,
  color = '#334155'
): PageSurface {
  let active = page;
  if (active.y + 24 > active.logicalH - MARGIN_BOTTOM) {
    active = createPortraitSurface();
    pages.push(active);
    drawRunningHeader(active, ben, reportDateLabel);
  }
  const { ctx } = active;
  ctx.save();
  ctx.font = `700 9px ${FONT_FAMILY}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(subtitle, MARGIN_X, active.y + 2);
  ctx.restore();
  active.y += 15;
  return active;
}

function drawPaginatedTable(
  startPage: PageSurface,
  pages: PageSurface[],
  ben: Beneficiary,
  reportDateLabel: string,
  columns: TableColumnSpec[],
  rows: string[][],
  options: {
    fontSize?: number;
    headerFontSize?: number;
    repeatBannerTitle?: string;
    accentColor?: string;
    boldColumns?: number[];
  } = {}
): PageSurface {
  const fontSize = options.fontSize ?? 8.2;
  const headerFontSize = options.headerFontSize ?? 8.3;
  const lineHeight = fontSize * 1.36;
  const headerLineHeight = headerFontSize * 1.32;
  const padX = 4.5;
  const padY = 3.5;
  const boldCols = new Set(options.boldColumns ?? [0]);

  let active = startPage;
  const totalWeight = columns.reduce((s, c) => s + c.widthWeight, 0);
  const usableW = active.logicalW - MARGIN_X * 2;
  const colWidths = columns.map((c) => (c.widthWeight / totalWeight) * usableW);

  const renderTableHeader = (target: PageSurface) => {
    const { ctx } = target;
    ctx.font = `700 ${headerFontSize}px ${FONT_FAMILY}`;
    const wrappedHeaders = columns.map((c, idx) =>
      wrapCellText(ctx, c.header, Math.max(18, colWidths[idx] - padX * 2))
    );
    const maxLines = Math.max(1, ...wrappedHeaders.map((h) => h.length));
    const headerH = maxLines * headerLineHeight + padY * 2;

    if (target.y + headerH + 22 > target.logicalH - MARGIN_BOTTOM) {
      const next = createPortraitSurface();
      pages.push(next);
      drawRunningHeader(next, ben, reportDateLabel);
      if (options.repeatBannerTitle) {
        drawSectionBanner(
          next,
          `${options.repeatBannerTitle} (पुढे सुरू)`,
          pages,
          ben,
          reportDateLabel,
          options.accentColor
        );
      }
      target = next;
    }

    let x = MARGIN_X;
    for (let i = 0; i < columns.length; i++) {
      const w = colWidths[i];
      target.ctx.fillStyle = '#f1f5f9';
      target.ctx.fillRect(x, target.y, w, headerH);
      target.ctx.strokeStyle = '#94a3b8';
      target.ctx.lineWidth = 0.7;
      target.ctx.strokeRect(x, target.y, w, headerH);

      target.ctx.fillStyle = '#0f172a';
      target.ctx.font = `700 ${headerFontSize}px ${FONT_FAMILY}`;
      const lines = wrappedHeaders[i];
      lines.forEach((line, li) => {
        const align = columns[i].align || 'left';
        target.ctx.textAlign = align;
        const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - padX : x + padX;
        target.ctx.fillText(line, tx, target.y + padY + li * headerLineHeight);
      });
      x += w;
    }
    target.y += headerH;
    return target;
  };

  active = renderTableHeader(active);

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    active.ctx.font = `400 ${fontSize}px ${FONT_FAMILY}`;
    const wrappedCells = columns.map((_, cIdx) => {
      active.ctx.font = `${boldCols.has(cIdx) ? '600' : '400'} ${fontSize}px ${FONT_FAMILY}`;
      return wrapCellText(active.ctx, row[cIdx] ?? '-', Math.max(18, colWidths[cIdx] - padX * 2));
    });
    const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
    const rowH = maxLines * lineHeight + padY * 2;

    if (active.y + rowH > active.logicalH - MARGIN_BOTTOM) {
      const next = createPortraitSurface();
      pages.push(next);
      drawRunningHeader(next, ben, reportDateLabel);
      if (options.repeatBannerTitle) {
        drawSectionBanner(
          next,
          `${options.repeatBannerTitle} (पुढे सुरू)`,
          pages,
          ben,
          reportDateLabel,
          options.accentColor
        );
      }
      active = renderTableHeader(next);
    }

    let x = MARGIN_X;
    const isAlt = rIdx % 2 === 1;
    for (let cIdx = 0; cIdx < columns.length; cIdx++) {
      const w = colWidths[cIdx];
      active.ctx.fillStyle = isAlt ? '#f8fafc' : '#ffffff';
      active.ctx.fillRect(x, active.y, w, rowH);
      active.ctx.strokeStyle = '#cbd5e1';
      active.ctx.lineWidth = 0.6;
      active.ctx.strokeRect(x, active.y, w, rowH);

      active.ctx.fillStyle = '#0f172a';
      active.ctx.font = `${boldCols.has(cIdx) ? '600' : '400'} ${fontSize}px ${FONT_FAMILY}`;
      const align = columns[cIdx].align || 'left';
      active.ctx.textAlign = align;
      const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - padX : x + padX;
      wrappedCells[cIdx].forEach((line, li) => {
        active.ctx.fillText(line, tx, active.y + padY + li * lineHeight);
      });
      x += w;
    }
    active.y += rowH;
  }

  active.y += 8;
  return active;
}

interface TrendPoint {
  label: string;
  dateStr: string;
  weight: number | null;
  hb: number | null;
  sys: number | null;
  dia: number | null;
}

function drawVitalsTrendChart(
  page: PageSurface,
  points: TrendPoint[],
  summaryStripText: string,
  pages: PageSurface[],
  ben: Beneficiary,
  reportDateLabel: string
): PageSurface {
  const chartHeight = 198;
  let active = page;
  if (active.y + chartHeight + 14 > active.logicalH - MARGIN_BOTTOM) {
    active = createPortraitSurface();
    pages.push(active);
    drawRunningHeader(active, ben, reportDateLabel);
  }

  const { ctx, logicalW } = active;
  const boxX = MARGIN_X;
  const boxY = active.y;
  const boxW = logicalW - MARGIN_X * 2;

  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(boxX, boxY, boxW, chartHeight);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 0.85;
  ctx.strokeRect(boxX, boxY, boxW, chartHeight);

  // Title + Vitals Progression Summary
  ctx.font = `700 9.2px ${FONT_FAMILY}`;
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  ctx.fillText('वजन (kg), Hb (g/dL) व BP (mmHg) आलेख तुलना (Vitals Trend Graph)', boxX + 10, boxY + 7);

  if (summaryStripText) {
    ctx.font = `600 7.7px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0f766e';
    ctx.textAlign = 'right';
    ctx.fillText(summaryStripText, boxX + boxW - 10, boxY + 8);
  }

  const legendItems = [
    { label: 'वजन (kg)', color: '#0f766e' },
    { label: 'Hb (g/dL × 5 स्केल)', color: '#d97706' },
    { label: 'BP Systolic', color: '#dc2626' },
    { label: 'BP Diastolic', color: '#2563eb' },
  ];
  let lx = boxX + 10;
  const ly = boxY + 23;
  ctx.textAlign = 'left';
  ctx.font = `600 7.8px ${FONT_FAMILY}`;
  for (const leg of legendItems) {
    ctx.fillStyle = leg.color;
    ctx.fillRect(lx, ly + 2, 10, 4);
    ctx.fillStyle = '#334155';
    ctx.fillText(leg.label, lx + 14, ly);
    lx += ctx.measureText(leg.label).width + 26;
  }

  const plotX = boxX + 42;
  const plotY = boxY + 40;
  const plotW = boxW - 60;
  const plotH = chartHeight - 72;

  if (points.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = `500 9.2px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      'आलेख तयार करण्यासाठी किमान १ ANC तपासणी नोंद आवश्यक आहे.',
      boxX + boxW / 2,
      plotY + plotH / 2 - 6
    );
    ctx.restore();
    active.y += chartHeight + 10;
    return active;
  }

  const yMax = 180;
  const ySteps = [0, 45, 90, 135, 180];
  ctx.font = `400 7.4px ${FONT_FAMILY}`;
  for (const val of ySteps) {
    const py = plotY + plotH - (val / yMax) * plotH;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(plotX, py);
    ctx.lineTo(plotX + plotW, py);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText(String(val), plotX - 6, py - 4);
  }

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotX, plotY);
  ctx.lineTo(plotX, plotY + plotH);
  ctx.lineTo(plotX + plotW, plotY + plotH);
  ctx.stroke();

  const xPosFor = (idx: number) =>
    points.length === 1 ? plotX + plotW / 2 : plotX + 24 + (idx / (points.length - 1)) * (plotW - 48);

  points.forEach((pt, idx) => {
    const x = xPosFor(idx);
    ctx.fillStyle = '#0f172a';
    ctx.font = `600 7.6px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(pt.label, x, plotY + plotH + 5);
    ctx.fillStyle = '#64748b';
    ctx.font = `400 6.9px ${FONT_FAMILY}`;
    ctx.fillText(pt.dateStr, x, plotY + plotH + 16);
  });

  const drawSeries = (
    color: string,
    getVal: (p: TrendPoint) => number | null,
    displayVal: (p: TrendPoint) => string,
    labelOffsetY: number
  ) => {
    const coords: Array<{ x: number; y: number; text: string }> = [];
    points.forEach((pt, idx) => {
      const v = getVal(pt);
      if (v === null || !Number.isFinite(v)) return;
      const clamped = Math.max(0, Math.min(yMax, v));
      const x = xPosFor(idx);
      const y = plotY + plotH - (clamped / yMax) * plotH;
      coords.push({ x, y, text: displayVal(pt) });
    });

    if (coords.length > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      coords.forEach((c, i) => {
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
    }

    coords.forEach((c) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `700 7.2px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.x, c.y + labelOffsetY);
    });
  };

  drawSeries('#0f766e', (p) => p.weight, (p) => `${p.weight}kg`, -11);
  drawSeries('#d97706', (p) => (p.hb !== null ? p.hb * 5 : null), (p) => `Hb:${p.hb}`, 5);
  drawSeries('#dc2626', (p) => p.sys, (p) => `${p.sys}`, -11);
  drawSeries('#2563eb', (p) => p.dia, (p) => `${p.dia}`, 5);

  ctx.restore();
  active.y += chartHeight + 10;
  return active;
}

interface UnifiedAncExamination {
  visitNumber: number;
  visitLabel: string;
  visitDate: string;
  gestationalAgeText: string;
  episodeCode: string;
  placeText: string;
  sessionCode: string;
  weightKg: string;
  heightCm: string;
  bp: string;
  hb: string;
  bloodSugar: string;
  urineAlbumin: string;
  urineSugar: string;
  bloodTests: string;
  otherTests: string;
  doctorObservation: string;
  treatmentAdvice: string;
  nextVisitDate: string;
  staffText: string;
  remarks: string;
}

function drawAncExaminationCard(
  startPage: PageSurface,
  exam: UnifiedAncExamination,
  pages: PageSurface[],
  ben: Beneficiary,
  reportDateLabel: string,
  accentColor: string,
  showEpisodeBadge: boolean
): PageSurface {
  let active = startPage;
  const usableW = active.logicalW - MARGIN_X * 2;
  const padX = 8;
  const lineH = 11.4;

  // Measure wrapped blocks using current context before deciding page break
  const mCtx = active.ctx;
  const halfW = (usableW - 12) / 2;
  mCtx.font = `400 8.1px ${FONT_FAMILY}`;

  const urineAlbLines = wrapCellText(mCtx, exam.urineAlbumin || '-', Math.max(60, halfW - 134));
  const urineSugLines = wrapCellText(mCtx, exam.urineSugar || '-', Math.max(60, halfW - 72));
  const bloodTestsLines = wrapCellText(mCtx, exam.bloodTests || '-', Math.max(80, halfW - 72));
  const otherTestsLines = wrapCellText(mCtx, exam.otherTests || '-', usableW - 126);
  const obsLines = wrapCellText(mCtx, exam.doctorObservation || '-', usableW - 126);
  const treatLines = wrapCellText(mCtx, exam.treatmentAdvice || '-', usableW - 126);
  const hasRemarks = Boolean(exam.remarks && exam.remarks !== '-');
  const remarkLines = hasRemarks ? wrapCellText(mCtx, exam.remarks, usableW - 75) : [];

  const leftHeaderText = `${exam.visitLabel} · दिनांक: ${formatDDMMYYYY(exam.visitDate)} · कालावधी: ${exam.gestationalAgeText}${
    showEpisodeBadge && exam.episodeCode ? ` · प्रकरण: ${exam.episodeCode}` : ''
  }`;
  const rightHeaderText = `${exam.placeText}${
    exam.sessionCode && exam.sessionCode !== '-' ? ` (${exam.sessionCode})` : ''
  }`;
  mCtx.font = `700 8.8px ${FONT_FAMILY}`;
  const leftHeaderW = mCtx.measureText(leftHeaderText).width;
  mCtx.font = `600 7.7px ${FONT_FAMILY}`;
  const rightHeaderW = mCtx.measureText(rightHeaderText).width;
  const twoLineHeader = leftHeaderW + rightHeaderW + 28 > usableW;

  const headerH = twoLineHeader ? 31 : 21;
  const vitalsRowH = 28;
  const leftLabH = (urineAlbLines.length + urineSugLines.length) * lineH + 10;
  const rightLabH = bloodTestsLines.length * lineH + 10;
  const labTopH = Math.max(28, leftLabH, rightLabH);
  const otherRowH = Math.max(1, otherTestsLines.length) * lineH + 6;
  const obsRowH = Math.max(1, obsLines.length) * lineH + 6;
  const treatRowH = Math.max(1, treatLines.length) * lineH + 6;
  const remarkRowH = hasRemarks ? Math.max(1, remarkLines.length) * lineH + 5 : 0;
  const footerRowH = 19;

  const totalH =
    headerH + vitalsRowH + labTopH + otherRowH + obsRowH + treatRowH + remarkRowH + footerRowH + 8;

  if (active.y + totalH > active.logicalH - MARGIN_BOTTOM) {
    const next = createPortraitSurface();
    pages.push(next);
    drawRunningHeader(next, ben, reportDateLabel);
    active = drawSectionBanner(
      next,
      '५. प्रत्येक ANC भेटीचा संपूर्ण तपासणी तपशील (पुढे सुरू)',
      pages,
      ben,
      reportDateLabel,
      accentColor
    );
  }

  const c = active.ctx;
  c.save();
  const boxX = MARGIN_X;
  const boxY = active.y;

  // Outer card frame
  c.fillStyle = '#ffffff';
  c.fillRect(boxX, boxY, usableW, totalH);
  c.strokeStyle = '#94a3b8';
  c.lineWidth = 0.8;
  c.strokeRect(boxX, boxY, usableW, totalH);

  // Header strip
  c.fillStyle = '#f1f5f9';
  c.fillRect(boxX, boxY, usableW, headerH);
  c.fillStyle = accentColor;
  c.fillRect(boxX, boxY, 4, headerH);
  c.strokeStyle = '#cbd5e1';
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(boxX, boxY + headerH);
  c.lineTo(boxX + usableW, boxY + headerH);
  c.stroke();

  c.font = `700 8.8px ${FONT_FAMILY}`;
  c.fillStyle = '#0f172a';
  c.textAlign = 'left';
  c.fillText(leftHeaderText, boxX + 10, boxY + 5);

  c.font = `600 7.7px ${FONT_FAMILY}`;
  c.fillStyle = '#334155';
  if (twoLineHeader) {
    c.textAlign = 'left';
    c.fillText(`ठिकाण: ${rightHeaderText}`, boxX + 10, boxY + 17);
  } else {
    c.textAlign = 'right';
    c.fillText(rightHeaderText, boxX + usableW - 8, boxY + 6);
  }

  let cy = boxY + headerH;

  // Row 1: 5-cell Vitals Grid
  const vitals = [
    { label: 'वजन (Weight)', value: exam.weightKg || '-' },
    { label: 'उंची (Height)', value: exam.heightCm || '-' },
    { label: 'रक्तदाब (BP)', value: exam.bp || '-' },
    { label: 'हिमोग्लोबिन (Hb)', value: exam.hb || '-' },
    { label: 'रक्त साखर (BSL)', value: exam.bloodSugar || '-' },
  ];
  const cellW = usableW / vitals.length;
  vitals.forEach((v, idx) => {
    const vx = boxX + idx * cellW;
    c.fillStyle = '#f8fafc';
    c.fillRect(vx, cy, cellW, vitalsRowH);
    c.strokeStyle = '#e2e8f0';
    c.lineWidth = 0.6;
    c.strokeRect(vx, cy, cellW, vitalsRowH);

    c.font = `600 7.3px ${FONT_FAMILY}`;
    c.fillStyle = '#475569';
    c.textAlign = 'left';
    c.fillText(v.label, vx + 6, cy + 4);

    c.font = `700 8.5px ${FONT_FAMILY}`;
    c.fillStyle = '#0f172a';
    c.fillText(v.value, vx + 6, cy + 15);
  });
  cy += vitalsRowH;

  // Row 2: Lab & Urine Investigations
  c.strokeStyle = '#e2e8f0';
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(boxX, cy + labTopH);
  c.lineTo(boxX + usableW, cy + labTopH);
  c.stroke();

  c.textAlign = 'left';
  c.font = `700 8px ${FONT_FAMILY}`;
  c.fillStyle = '#334155';
  c.fillText('लघवी तपासणी (Urine Albumin):', boxX + padX, cy + 5);
  c.font = `400 8.1px ${FONT_FAMILY}`;
  c.fillStyle = '#0f172a';
  urineAlbLines.forEach((line, li) => {
    c.fillText(line, boxX + padX + 128, cy + 5 + li * lineH);
  });

  const sugarY = cy + 5 + urineAlbLines.length * lineH + 2;
  c.font = `700 8px ${FONT_FAMILY}`;
  c.fillStyle = '#334155';
  c.fillText('Urine Sugar:', boxX + padX, sugarY);
  c.font = `400 8.1px ${FONT_FAMILY}`;
  c.fillStyle = '#0f172a';
  urineSugLines.forEach((line, li) => {
    c.fillText(line, boxX + padX + 64, sugarY + li * lineH);
  });

  const rightColX = boxX + halfW + 8;
  c.font = `700 8px ${FONT_FAMILY}`;
  c.fillStyle = '#334155';
  c.fillText('रक्त तपासण्या:', rightColX, cy + 5);
  c.font = `400 8.1px ${FONT_FAMILY}`;
  c.fillStyle = '#0f172a';
  bloodTestsLines.forEach((line, li) => {
    c.fillText(line, rightColX + 62, cy + 5 + li * lineH);
  });

  cy += labTopH;

  // Row 3: Other Tests, Observations, Treatment
  const drawLabeledRow = (label: string, lines: string[], rowHeight: number) => {
    c.font = `700 8px ${FONT_FAMILY}`;
    c.fillStyle = '#334155';
    c.textAlign = 'left';
    c.fillText(label, boxX + padX, cy + 4);

    c.font = `400 8.1px ${FONT_FAMILY}`;
    c.fillStyle = '#0f172a';
    lines.forEach((line, li) => {
      c.fillText(line, boxX + padX + 114, cy + 4 + li * lineH);
    });
    cy += rowHeight;
  };

  drawLabeledRow('इतर तपासण्या (USG इ.):', otherTestsLines, otherRowH);
  drawLabeledRow('डॉक्टर / CHO निरीक्षण:', obsLines, obsRowH);
  drawLabeledRow('दिलेला उपचार व सल्ला:', treatLines, treatRowH);

  if (hasRemarks) {
    c.font = `700 8px ${FONT_FAMILY}`;
    c.fillStyle = '#334155';
    c.fillText('शेरा:', boxX + padX, cy + 3);
    c.font = `400 8px ${FONT_FAMILY}`;
    c.fillStyle = '#0f172a';
    remarkLines.forEach((line, li) => {
      c.fillText(line, boxX + padX + 36, cy + 3 + li * lineH);
    });
    cy += remarkRowH;
  }

  // Card Footer Strip
  c.fillStyle = '#f8fafc';
  c.fillRect(boxX + 1, boxY + totalH - footerRowH, usableW - 2, footerRowH - 1);
  c.strokeStyle = '#e2e8f0';
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(boxX, boxY + totalH - footerRowH);
  c.lineTo(boxX + usableW, boxY + totalH - footerRowH);
  c.stroke();

  c.font = `600 7.9px ${FONT_FAMILY}`;
  c.fillStyle = '#0f766e';
  c.textAlign = 'left';
  c.fillText(
    `पुढील नियोजित भेट: ${exam.nextVisitDate ? formatDDMMYYYY(exam.nextVisitDate) : '-'}`,
    boxX + padX,
    boxY + totalH - footerRowH + 5
  );

  c.font = `600 7.9px ${FONT_FAMILY}`;
  c.fillStyle = '#334155';
  c.textAlign = 'right';
  c.fillText(`तपासणी अधिकारी: ${exam.staffText || '-'}`, boxX + usableW - padX, boxY + totalH - footerRowH + 5);

  c.restore();
  active.y = boxY + totalH + 8;
  return active;
}

export async function generateCompletePregnancyPDFBlob(
  db: SheetDatabase,
  beneficiaryId: string,
  preparedBy: string
): Promise<{ blob: Blob; beneficiary: Beneficiary }> {
  const ben = db.beneficiaries.find((b) => b.id === beneficiaryId);
  if (!ben) {
    throw new Error('लाभार्थी आढळला नाही.');
  }

  await ensureDevanagariFontsLoaded();

  const todayISO = getTodayIST();
  const reportDateDDMM = formatDDMMYYYY(todayISO);
  const generatedAtIST = formatDateTimeIST(new Date().toISOString());
  const accent = '#9f1239';

  const sesMap = new Map(db.vaccinationSessions.map((s) => [s.id, s]));
  const vilMap = new Map(db.villages.map((v) => [v.id, v]));
  const scMap = new Map(db.subcentres.map((s) => [s.id, s]));

  const benEpisodes = db.pregnancyEpisodes
    .filter((ep) => ep.beneficiaryId === ben.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const primaryEpisode: PregnancyEpisode | null =
    benEpisodes.find((e) => e.pregnancyStatus === 'सक्रिय') || benEpisodes[0] || null;
  const priorEpisodes = primaryEpisode
    ? benEpisodes.filter((e) => e.id !== primaryEpisode.id)
    : [];

  const epById = new Map(benEpisodes.map((e) => [e.id, e]));

  const benAncVisits = db.ancVisits
    .filter((v) => v.beneficiaryId === ben.id)
    .slice()
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate) || a.visitNumber - b.visitNumber);

  const benServiceRecords = db.maternalServiceRecords
    .filter((r) => r.beneficiaryId === ben.id)
    .slice()
    .sort((a, b) => (a.visitDate || a.sessionDate).localeCompare(b.visitDate || b.sessionDate));

  const benHrps = db.highRiskRecords
    .filter((h) => h.beneficiaryId === ben.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const benReferrals = db.maternalReferrals
    .filter((r) => r.beneficiaryId === ben.id)
    .slice()
    .sort((a, b) => b.referralDate.localeCompare(a.referralDate));

  const benDeliveries = db.deliveryRecords
    .filter((d) => d.beneficiaryId === ben.id)
    .slice()
    .sort((a, b) => b.actualDeliveryDate.localeCompare(a.actualDeliveryDate));

  const benBabies = db.babyRecords
    .filter((b) => b.motherBeneficiaryId === ben.id)
    .slice()
    .sort((a, b) => a.babyNumber - b.babyNumber);

  const benPncs = db.pncRecords
    .filter((p) => p.beneficiaryId === ben.id)
    .slice()
    .sort((a, b) => a.visitNumber - b.visitNumber || a.pncDate.localeCompare(b.pncDate));

  const resolvePlace = (sessionId?: string, villageId?: string, subcentreId?: string) => {
    const ses = sessionId ? sesMap.get(sessionId) : undefined;
    const vilName = ses?.villageName || (villageId ? vilMap.get(villageId)?.name : '') || ben.villageName;
    const scName = ses?.subcentreName || (subcentreId ? scMap.get(subcentreId)?.name : '') || ben.subcentreName;
    return {
      sessionCode: ses?.sessionCode || '-',
      placeText: `${vilName}${ses?.location ? ` (${ses.location})` : ''} · ${scName}`,
    };
  };

  // Deduplicated Visited Sessions & Places — Purpose only, ZERO repeated vital values!
  const visitedMap = new Map<
    string,
    { date: string; sessionCode: string; placeText: string; purposes: Set<string> }
  >();
  const ensureVisitBucket = (sesId: string | undefined, dateStr: string, vilId?: string, scId?: string) => {
    const p = resolvePlace(sesId, vilId, scId);
    const key = sesId || `${dateStr}__${p.placeText}`;
    let cur = visitedMap.get(key);
    if (!cur) {
      cur = {
        date: dateStr || '-',
        sessionCode: p.sessionCode,
        placeText: p.placeText,
        purposes: new Set<string>(),
      };
      visitedMap.set(key, cur);
    }
    return cur;
  };
  for (const sb of db.sessionBeneficiaries.filter((x) => x.beneficiaryId === ben.id)) {
    const ses = sesMap.get(sb.sessionId);
    const b = ensureVisitBucket(
      sb.sessionId,
      ses?.sessionDate || (sb.addedAt || '').slice(0, 10),
      sb.villageId,
      sb.subcentreId
    );
    b.purposes.add('सत्र उपस्थिती');
  }
  for (const av of benAncVisits) {
    const b = ensureVisitBucket(av.sessionId, av.visitDate, av.villageId, av.subcentreId);
    b.purposes.add(`${av.visitLabel} तपासणी`);
  }
  for (const mr of benServiceRecords) {
    const b = ensureVisitBucket(mr.sessionId, mr.visitDate || mr.sessionDate, mr.villageId, mr.subcentreId);
    if (TD_SERVICE_CODES.has(mr.serviceCode)) {
      b.purposes.add(mr.serviceName.replace(' लसीकरण', '').trim());
    } else if (mr.serviceCode === 'IFA' || mr.serviceCode === 'CALCIUM') {
      b.purposes.add('पूरक गोळ्या वितरण');
    } else if (VITAL_SERVICE_CODES.has(mr.serviceCode)) {
      b.purposes.add('ANC / आरोग्य तपासणी');
    } else {
      b.purposes.add(mr.serviceName.split('(')[0].trim());
    }
  }
  const visitedLocations = Array.from(visitedMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const latestHrp = benHrps[0];
  const isHighRisk = latestHrp
    ? latestHrp.isHighRisk === 'YES'
    : Boolean(primaryEpisode?.isHighRisk);
  const activeHrpReasons = parseJsonArraySafe<string>(
    latestHrp?.reasonsJson || primaryEpisode?.highRiskReasonsJson
  );

  // Build unified canonical ANC Examination list (structured ANC visits + non-duplicate session checkups)
  const unifiedExams: UnifiedAncExamination[] = [];
  const coveredDateKeys = new Set<string>();

  const legacyGroupedByDate = groupMaternalVisitsByDate(benServiceRecords);
  const legacyVitalRows = legacyGroupedByDate.filter(
    (g) =>
      g.ancExam !== '-' ||
      g.weight !== '-' ||
      g.height !== '-' ||
      g.bp !== '-' ||
      g.hb !== '-' ||
      g.bsl !== '-' ||
      g.bloodUrine !== '-'
  );

  for (const v of benAncVisits) {
    const place = resolvePlace(v.sessionId, v.villageId, v.subcentreId);
    const matchingLegacy = legacyVitalRows.find(
      (g) => g.visitDate === v.visitDate && (!v.episodeCode || g.episodeCode === '-' || g.episodeCode === v.episodeCode)
    );
    coveredDateKeys.add(`${v.visitDate}__${v.episodeCode || ''}`);
    coveredDateKeys.add(`${v.visitDate}__`);

    const resolvedHeight = v.heightCm
      ? `${v.heightCm} cm`
      : matchingLegacy && matchingLegacy.height !== '-'
        ? `${matchingLegacy.height} cm`
        : '-';
    const resolvedWeight = v.weightKg
      ? `${v.weightKg} kg`
      : matchingLegacy && matchingLegacy.weight !== '-'
        ? `${matchingLegacy.weight} kg`
        : '-';
    const resolvedBp = v.bp || (matchingLegacy && matchingLegacy.bp !== '-' ? `${matchingLegacy.bp} mmHg` : '-');
    const resolvedHb = v.hb
      ? `${v.hb} g/dL`
      : matchingLegacy && matchingLegacy.hb !== '-'
        ? `${matchingLegacy.hb} g/dL`
        : '-';
    const resolvedBsl = v.bloodSugar
      ? `${v.bloodSugar} mg/dL`
      : matchingLegacy && matchingLegacy.bsl !== '-'
        ? `${matchingLegacy.bsl} mg/dL`
        : '-';

    const ep = epById.get(v.pregnancyEpisodeId);
    const gaLabel =
      v.gestationalAgeText && v.gestationalAgeText !== '-'
        ? v.gestationalAgeText
        : ep?.mcDate
          ? calculateGestationalWeeksAndDays(ep.mcDate, v.visitDate).label
          : '-';

    unifiedExams.push({
      visitNumber: v.visitNumber,
      visitLabel: v.visitLabel || `ANC-${v.visitNumber}`,
      visitDate: v.visitDate,
      gestationalAgeText: gaLabel,
      episodeCode: v.episodeCode || primaryEpisode?.episodeCode || '-',
      placeText: place.placeText,
      sessionCode: place.sessionCode,
      weightKg: resolvedWeight,
      heightCm: resolvedHeight,
      bp: resolvedBp.includes('mmHg') || resolvedBp === '-' ? resolvedBp : `${resolvedBp} mmHg`,
      hb: resolvedHb,
      bloodSugar: resolvedBsl,
      urineAlbumin: v.urineAlbumin || '-',
      urineSugar: v.urineSugar || '-',
      bloodTests: v.bloodTests || (matchingLegacy && matchingLegacy.bloodUrine !== '-' ? matchingLegacy.bloodUrine : '-'),
      otherTests: v.otherTests || '-',
      doctorObservation: v.doctorObservation || '-',
      treatmentAdvice: v.treatmentAdvice || '-',
      nextVisitDate: v.nextVisitDate || '',
      staffText: `${v.staffName || '-'}${v.staffDesignation ? ` (${v.staffDesignation})` : ''}`,
      remarks: v.remarks || '',
    });
  }

  let extraLegacyIdx = unifiedExams.length + 1;
  for (const lg of legacyVitalRows.slice().sort((a, b) => a.visitDate.localeCompare(b.visitDate))) {
    const keyWithEp = `${lg.visitDate}__${lg.episodeCode === '-' ? '' : lg.episodeCode}`;
    const keyBare = `${lg.visitDate}__`;
    if (coveredDateKeys.has(keyWithEp) || coveredDateKeys.has(keyBare)) continue;

    const place = resolvePlace(lg.sessionId, lg.villageId, lg.subcentreId);
    const ep =
      benEpisodes.find((e) => e.episodeCode === lg.episodeCode) || primaryEpisode;
    const gaLabel = ep?.mcDate
      ? calculateGestationalWeeksAndDays(ep.mcDate, lg.visitDate).label
      : '-';

    unifiedExams.push({
      visitNumber: extraLegacyIdx,
      visitLabel: `सत्र ANC तपासणी (${extraLegacyIdx})`,
      visitDate: lg.visitDate,
      gestationalAgeText: gaLabel,
      episodeCode: lg.episodeCode !== '-' ? lg.episodeCode : ep?.episodeCode || '-',
      placeText: place.placeText,
      sessionCode: place.sessionCode,
      weightKg: lg.weight !== '-' ? `${lg.weight} kg` : '-',
      heightCm: lg.height !== '-' ? `${lg.height} cm` : '-',
      bp: lg.bp !== '-' ? `${lg.bp} mmHg` : '-',
      hb: lg.hb !== '-' ? `${lg.hb} g/dL` : '-',
      bloodSugar: lg.bsl !== '-' ? `${lg.bsl} mg/dL` : '-',
      urineAlbumin: '-',
      urineSugar: '-',
      bloodTests: lg.bloodUrine !== '-' ? lg.bloodUrine : '-',
      otherTests: '-',
      doctorObservation: lg.ancExam !== '-' ? lg.ancExam : '-',
      treatmentAdvice: lg.supplements !== '-' ? lg.supplements : '-',
      nextVisitDate: '',
      staffText: lg.staffNames || '-',
      remarks: lg.otherServices !== '-' ? lg.otherServices : '',
    });
    extraLegacyIdx += 1;
  }

  unifiedExams.sort(
    (a, b) => a.visitDate.localeCompare(b.visitDate) || a.visitNumber - b.visitNumber
  );

  const pages: PageSurface[] = [];

  // ======================== PAGE 1: PROFILE + CURRENT PREGNANCY + LOCATIONS ========================
  let p1 = createPortraitSurface();
  pages.push(p1);
  drawRunningHeader(p1, ben, reportDateDDMM);

  {
    const { ctx, logicalW } = p1;
    const boxW = logicalW - MARGIN_X * 2;
    ctx.fillStyle = accent;
    ctx.fillRect(MARGIN_X, p1.y, boxW, 52);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = `700 13.2px ${FONT_FAMILY}`;
    ctx.fillText(
      'प्राथमिक आरोग्य केंद्र भादा – गर्भवती माता व्यवस्थापन प्रणाली',
      logicalW / 2,
      p1.y + 8
    );
    ctx.font = `500 9.6px ${FONT_FAMILY}`;
    ctx.fillText(
      `संपूर्ण गर्भधारणा, ANC, High Risk, लसीकरण, प्रसूती व PNC वैद्यकीय अहवाल (${ben.beneficiaryCode})`,
      logicalW / 2,
      p1.y + 29
    );
    p1.y += 59;

    if (isHighRisk) {
      ctx.font = `700 8.6px ${FONT_FAMILY}`;
      const flagMsg = `⚠ अतिजोखमीची गर्भधारणा (HIGH RISK): ${
        activeHrpReasons.join(', ') || 'विशेष वैद्यकीय निगराणी आवश्यक'
      } — संपूर्ण तपशील विभाग ६ मध्ये`;
      const wrappedFlag = wrapCellText(ctx, flagMsg, boxW - 18);
      const ribbonH = Math.max(22, wrappedFlag.length * 11.5 + 9);
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(MARGIN_X, p1.y, boxW, ribbonH);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.1;
      ctx.strokeRect(MARGIN_X, p1.y, boxW, ribbonH);
      ctx.fillStyle = '#991b1b';
      ctx.textAlign = 'left';
      wrappedFlag.forEach((line, li) => {
        ctx.fillText(line, MARGIN_X + 9, p1.y + 5 + li * 11.5);
      });
      p1.y += ribbonH + 7;
    }
  }

  // Section 1: Permanent Beneficiary Profile (Strictly Identity, Demographics & Address)
  p1 = drawSectionBanner(
    p1,
    '१. कायमस्वरूपी माता प्रोफाइल (Permanent Beneficiary Profile)',
    pages,
    ben,
    reportDateDDMM,
    accent
  );

  const dobAgeLabel = ben.dob
    ? `${formatDDMMYYYY(ben.dob)} (${calculateWomanAgeFromDob(ben.dob, todayISO)})`
    : '-';
  const bloodRhText = `${ben.bloodGroup || primaryEpisode?.bloodGroup || '-'} · ${
    ben.rhFactor || primaryEpisode?.rhFactor || '-'
  }`;

  p1 = drawPaginatedTable(
    p1,
    pages,
    ben,
    reportDateDDMM,
    [
      { header: 'माहिती घटक', widthWeight: 21 },
      { header: 'नोंदवलेली माहिती', widthWeight: 29 },
      { header: 'माहिती घटक', widthWeight: 21 },
      { header: 'नोंदवलेली माहिती', widthWeight: 29 },
    ],
    [
      [
        'Beneficiary ID',
        ben.beneficiaryCode,
        'नोंदणी दिनांक व स्थिती',
        `${formatDDMMYYYY(ben.registrationDate)} · ${ben.status}`,
      ],
      [
        'पूर्ण नाव (मराठी)',
        ben.childName,
        'पूर्ण नाव (English)',
        ben.fullNameEnglish || '-',
      ],
      [
        'जन्मतारीख व वय',
        dobAgeLabel,
        'मोबाईल क्रमांक',
        ben.mobile || '-',
      ],
      [
        'पतीचे पूर्ण नाव',
        ben.guardianName || ben.fatherName || '-',
        'पतीचा मोबाईल क्रमांक',
        ben.husbandMobile || '-',
      ],
      [
        'रक्तगट व Rh Factor',
        bloodRhText,
        'आधार क्रमांक (Masked)',
        maskAadhaar(ben.aadhaarNumber),
      ],
      [
        'जात व प्रवर्ग',
        `${ben.caste || '-'} · ${ben.category || '-'}`,
        'गाव व उपकेंद्र',
        `${ben.villageName} · ${ben.subcentreName}`,
      ],
      [
        'संपूर्ण पत्ता',
        ben.address || '-',
        'अंगणवाडी केंद्र',
        ben.anganwadi || '-',
      ],
    ],
    { fontSize: 8.2, headerFontSize: 8.3, accentColor: accent, boldColumns: [0, 2] }
  );

  // Section 2: Current Pregnancy Episode Details (Shown ONCE — Prior Episodes only if they exist)
  const primaryGa = primaryEpisode
    ? calculateGestationalWeeksAndDays(primaryEpisode.mcDate, todayISO).label
    : '-';
  const eddHistoryEntries = primaryEpisode
    ? parseJsonArraySafe<{
        previousEddDate: string;
        newEddDate: string;
        changedAt: string;
        changedBy: string;
        reason?: string;
      }>(primaryEpisode.eddHistoryJson)
    : [];

  p1 = drawSectionBanner(
    p1,
    '२. गर्भधारणा प्रकरण तपशील (Pregnancy Episode Details)',
    pages,
    ben,
    reportDateDDMM,
    accent
  );

  if (primaryEpisode) {
    const gpalText = formatGravidaSummary({
      gravida: primaryEpisode.gravida,
      para: primaryEpisode.para,
      abortions: primaryEpisode.abortions,
      livingChildren: primaryEpisode.livingChildren,
      fallbackText: primaryEpisode.gravidaPara,
    });
    const plannedPlaceLabel = `${primaryEpisode.expectedDeliveryPlace || ben.plannedDeliveryPlace || '-'} (${formatDeliveryFacilityTypeMarathi(
      primaryEpisode.deliveryFacilityType
    )}${
      primaryEpisode.hospitalName || ben.plannedHospitalName
        ? `: ${primaryEpisode.hospitalName || ben.plannedHospitalName}`
        : ''
    })`;

    const epRows: string[][] = [
      [
        'प्रकरण ID व स्थिती',
        `${primaryEpisode.episodeCode} (${primaryEpisode.pregnancyStatus})`,
        'G / P / A / L (इतिहास)',
        gpalText,
      ],
      [
        'LMP (MC) दिनांक',
        formatDDMMYYYY(primaryEpisode.mcDate),
        'अपेक्षित प्रसूती दि. (EDD)',
        formatDDMMYYYY(primaryEpisode.eddDate),
      ],
      [
        'चालू गर्भावस्था कालावधी',
        primaryGa,
        'गर्भधारणा नोंदणी दिनांक',
        formatDDMMYYYY(primaryEpisode.pregnancyRegistrationDate),
      ],
      [
        'नियोजित प्रसूती ठिकाण',
        plannedPlaceLabel,
        'मागील सिझेरियन (LSCS)',
        primaryEpisode.previousCaesarean || 'नाही',
      ],
      [
        'मागील गर्भधारणा इतिहास',
        primaryEpisode.previousPregnancyHistory || '-',
        'मागील गुंतागुंत',
        primaryEpisode.previousComplications || '-',
      ],
    ];
    if (primaryEpisode.notes) {
      epRows.push(['प्रकरण टीप (Notes)', primaryEpisode.notes, 'अद्यतन दिनांक', formatDDMMYYYY(primaryEpisode.updatedAt.slice(0, 10))]);
    }

    p1 = drawPaginatedTable(
      p1,
      pages,
      ben,
      reportDateDDMM,
      [
        { header: 'गर्भधारणा घटक', widthWeight: 22 },
        { header: 'तपशील', widthWeight: 28 },
        { header: 'गर्भधारणा घटक', widthWeight: 22 },
        { header: 'तपशील', widthWeight: 28 },
      ],
      epRows,
      { fontSize: 8.1, headerFontSize: 8.3, accentColor: accent, boldColumns: [0, 2] }
    );
  } else {
    p1 = drawPaginatedTable(
      p1,
      pages,
      ben,
      reportDateDDMM,
      [{ header: 'गर्भधारणा स्थिती', widthWeight: 100 }],
      [['अद्याप कोणतेही गर्भधारणा प्रकरण नोंदवलेले नाही.']],
      { fontSize: 8.2, headerFontSize: 8.3, accentColor: accent }
    );
  }

  if (eddHistoryEntries.length > 0) {
    p1 = drawSubHeading(p1, 'EDD बदल इतिहास (EDD Revision History)', pages, ben, reportDateDDMM, accent);
    p1 = drawPaginatedTable(
      p1,
      pages,
      ben,
      reportDateDDMM,
      [
        { header: 'जुनी EDD', widthWeight: 22 },
        { header: 'नवीन EDD', widthWeight: 22 },
        { header: 'बदल दिनांक व वापरकर्ता', widthWeight: 28 },
        { header: 'बदलाचे कारण', widthWeight: 28 },
      ],
      eddHistoryEntries.map((eh) => [
        formatDDMMYYYY(eh.previousEddDate),
        formatDDMMYYYY(eh.newEddDate),
        `${formatDDMMYYYY(eh.changedAt.slice(0, 10))} (${eh.changedBy})`,
        eh.reason || '-',
      ]),
      { fontSize: 7.9, headerFontSize: 8, accentColor: accent }
    );
  }

  if (priorEpisodes.length > 0) {
    p1 = drawSubHeading(
      p1,
      `मागील / इतर गर्भधारणा प्रकरणे (${formatNumberIN(priorEpisodes.length)})`,
      pages,
      ben,
      reportDateDDMM,
      accent
    );
    p1 = drawPaginatedTable(
      p1,
      pages,
      ben,
      reportDateDDMM,
      [
        { header: 'अ.क्र.', widthWeight: 6, align: 'center' },
        { header: 'प्रकरण ID', widthWeight: 18 },
        { header: 'LMP / EDD', widthWeight: 24 },
        { header: 'G/P/A/L', widthWeight: 14 },
        { header: 'नियोजित प्रसूती ठिकाण', widthWeight: 24 },
        { header: 'स्थिती', widthWeight: 14 },
      ],
      priorEpisodes.map((ep, idx) => [
        String(idx + 1),
        ep.episodeCode,
        `LMP: ${formatDDMMYYYY(ep.mcDate)}\nEDD: ${formatDDMMYYYY(ep.eddDate)}`,
        formatGravidaSummary({
          gravida: ep.gravida,
          para: ep.para,
          abortions: ep.abortions,
          livingChildren: ep.livingChildren,
          fallbackText: ep.gravidaPara,
        }),
        `${ep.expectedDeliveryPlace || '-'} (${ep.hospitalName || formatDeliveryFacilityTypeMarathi(ep.deliveryFacilityType)})`,
        ep.pregnancyStatus,
      ]),
      { fontSize: 7.9, headerFontSize: 8.1, accentColor: accent }
    );
  }

  // Section 3: Sessions & Locations Visited (No redundant vital dumps!)
  p1 = drawSectionBanner(
    p1,
    '३. सेवा घेतलेली सत्रे व भेट दिलेली ठिकाणे (Sessions & Places Visited)',
    pages,
    ben,
    reportDateDDMM,
    accent
  );
  p1 = drawPaginatedTable(
    p1,
    pages,
    ben,
    reportDateDDMM,
    [
      { header: 'अ.क्र.', widthWeight: 7, align: 'center' },
      { header: 'दिनांक', widthWeight: 13 },
      { header: 'सत्र कोड', widthWeight: 19 },
      { header: 'ठिकाण (गाव · उपकेंद्र)', widthWeight: 31 },
      { header: 'भेटीचा मुख्य उद्देश', widthWeight: 30 },
    ],
    visitedLocations.length > 0
      ? visitedLocations.map((loc, idx) => [
          String(idx + 1),
          formatDDMMYYYY(loc.date),
          loc.sessionCode,
          loc.placeText,
          Array.from(loc.purposes).join(', '),
        ])
      : [['-', '-', '-', 'अद्याप कोणत्याही सत्राची नोंद नाही', '-']],
    {
      fontSize: 8,
      headerFontSize: 8.2,
      repeatBannerTitle: '३. सेवा घेतलेली सत्रे व ठिकाणे',
      accentColor: accent,
    }
  );

  // ======================== PAGE 2: ANC COMPARISON MATRIX + TREND GRAPH + PER-VISIT EXAMINATIONS ========================
  let p2 = createPortraitSurface();
  pages.push(p2);
  drawRunningHeader(p2, ben, reportDateDDMM);

  const compRows = buildAncComparisonRows({
    ancVisits: benAncVisits,
    legacyServiceRecords: benServiceRecords,
    episodeId: primaryEpisode?.id,
    mcDate: primaryEpisode?.mcDate,
  });

  // Resolve height per comparison row for the active episode
  const heightForCompRow = (visitDate: string, visitNum: number): string => {
    if (!visitDate) return '-';
    const structured = benAncVisits.find(
      (v) =>
        (!primaryEpisode || v.pregnancyEpisodeId === primaryEpisode.id) &&
        (v.visitNumber === visitNum || v.visitDate === visitDate)
    );
    if (structured?.heightCm) return `${structured.heightCm} cm`;
    const legacy = legacyVitalRows.find((g) => g.visitDate === visitDate);
    if (legacy && legacy.height !== '-') return `${legacy.height} cm`;
    return '-';
  };

  p2 = drawSectionBanner(
    p2,
    '४. ANC-1 ते ANC-4 तुलनात्मक गोषवारा व ट्रेंड आलेख (ANC Matrix & Vitals Trend)',
    pages,
    ben,
    reportDateDDMM,
    accent
  );

  p2 = drawPaginatedTable(
    p2,
    pages,
    ben,
    reportDateDDMM,
    [
      { header: 'भेट', widthWeight: 10 },
      { header: 'दिनांक व आठवडा', widthWeight: 20 },
      { header: 'वजन', widthWeight: 10, align: 'center' },
      { header: 'उंची', widthWeight: 10, align: 'center' },
      { header: 'BP (mmHg)', widthWeight: 12, align: 'center' },
      { header: 'Hb', widthWeight: 10, align: 'center' },
      { header: 'BSL', widthWeight: 11, align: 'center' },
      { header: 'पुढील भेट', widthWeight: 17 },
    ],
    compRows.map((c) => [
      c.visitLabel,
      c.visitDate ? `${formatDDMMYYYY(c.visitDate)}\n${c.gestationalAgeText}` : 'प्रलंबित',
      c.weightKg,
      heightForCompRow(c.visitDate, c.visitNumber),
      c.bp,
      c.hb,
      c.bloodSugar,
      c.nextVisitDate && c.nextVisitDate !== '-' ? formatDDMMYYYY(c.nextVisitDate) : '-',
    ]),
    {
      fontSize: 7.9,
      headerFontSize: 8,
      repeatBannerTitle: '४. ANC तुलनात्मक गोषवारा',
      accentColor: accent,
    }
  );

  // Build concise vital progression summary directly from unified ANC examinations + trend points for Graph
  const primaryExamsForTrend = unifiedExams.filter(
    (e) => !primaryEpisode || e.episodeCode === primaryEpisode.episodeCode
  );
  const wVals = primaryExamsForTrend
    .map((e) => parseFloat((e.weightKg || '').replace(/[^\d.]/g, '')))
    .filter((n) => Number.isFinite(n));
  const hbVals = primaryExamsForTrend
    .map((e) => parseFloat((e.hb || '').replace(/[^\d.]/g, '')))
    .filter((n) => Number.isFinite(n));
  const vitalDeltaParts: string[] = [];
  if (wVals.length >= 2) {
    const diff = Math.round((wVals[wVals.length - 1] - wVals[0]) * 10) / 10;
    vitalDeltaParts.push(`वजन: ${wVals[0]}→${wVals[wVals.length - 1]} kg (${diff >= 0 ? `+${diff}` : diff})`);
  } else if (wVals.length === 1) {
    vitalDeltaParts.push(`वजन: ${wVals[0]} kg`);
  }
  if (hbVals.length >= 2) {
    const diff = Math.round((hbVals[hbVals.length - 1] - hbVals[0]) * 10) / 10;
    vitalDeltaParts.push(`Hb: ${hbVals[0]}→${hbVals[hbVals.length - 1]} g/dL (${diff >= 0 ? `+${diff}` : diff})`);
  } else if (hbVals.length === 1) {
    vitalDeltaParts.push(`Hb: ${hbVals[0]} g/dL`);
  }
  const vitalsStripText = vitalDeltaParts.join(' · ');

  const trendPoints: TrendPoint[] = compRows
    .filter((c) => c.source !== 'NONE' && c.visitDate)
    .map((c) => {
      const wNum = parseFloat((c.weightKg || '').replace(/[^\d.]/g, ''));
      const hbNum = parseFloat((c.hb || '').replace(/[^\d.]/g, ''));
      const { systolic, diastolic } = parseBpSystolicDiastolic(c.bp);
      return {
        label: c.visitLabel,
        dateStr: formatDDMMYYYY(c.visitDate),
        weight: Number.isFinite(wNum) ? wNum : null,
        hb: Number.isFinite(hbNum) ? hbNum : null,
        sys: systolic,
        dia: diastolic,
      };
    });

  p2 = drawVitalsTrendChart(p2, trendPoints, vitalsStripText, pages, ben, reportDateDDMM);

  // Section 5: Complete Visit-by-Visit Examination Record (100% details per visit, zero duplication)
  p2 = drawSectionBanner(
    p2,
    '५. प्रत्येक ANC भेटीचा संपूर्ण तपासणी तपशील (Visit-by-Visit Clinical Examinations)',
    pages,
    ben,
    reportDateDDMM,
    accent
  );

  const hasMultipleEpisodes = benEpisodes.length > 1;
  if (unifiedExams.length > 0) {
    for (const exam of unifiedExams) {
      p2 = drawAncExaminationCard(
        p2,
        exam,
        pages,
        ben,
        reportDateDDMM,
        accent,
        hasMultipleEpisodes
      );
    }
  } else {
    p2 = drawPaginatedTable(
      p2,
      pages,
      ben,
      reportDateDDMM,
      [{ header: 'ANC तपासणी नोंद', widthWeight: 100 }],
      [['अद्याप कोणतीही ANC तपासणी नोंदवलेली नाही.']],
      { fontSize: 8.2, headerFontSize: 8.3, accentColor: accent }
    );
  }

  // ======================== PAGE 3+: HIGH RISK + REFERRALS + TD & SUPPLEMENTS ========================
  let p3 = createPortraitSurface();
  pages.push(p3);
  drawRunningHeader(p3, ben, reportDateDDMM);

  p3 = drawSectionBanner(
    p3,
    '६. High Risk Pregnancy (HRP) वैद्यकीय मूल्यमापन व स्थिती इतिहास',
    pages,
    ben,
    reportDateDDMM,
    isHighRisk ? '#dc2626' : accent
  );

  if (benHrps.length > 0) {
    for (let hIdx = 0; hIdx < benHrps.length; hIdx++) {
      const h = benHrps[hIdx];
      const reasons = parseJsonArraySafe<string>(h.reasonsJson);
      const hrpHistory = parseJsonArraySafe<{
        status: string;
        reasons: string[];
        currentStatus: string;
        changedAt: string;
        changedBy: string;
        note?: string;
      }>(h.statusHistoryJson);

      if (benHrps.length > 1) {
        p3 = drawSubHeading(
          p3,
          `प्रकरण: ${h.episodeCode}`,
          pages,
          ben,
          reportDateDDMM,
          h.isHighRisk === 'YES' ? '#dc2626' : '#334155'
        );
      }

      const combinedReasons = [
        ...reasons,
        h.otherReasonText ? `इतर: ${h.otherReasonText}` : '',
      ].filter(Boolean);

      const hrpRows: string[][] = [
        ['High Risk Status', h.isHighRisk === 'YES' ? 'होय (YES — अतिजोखमीची माता)' : 'नाही (NO — सामान्य)'],
        ['HRP ओळखल्याची तारीख', h.identificationDate ? formatDDMMYYYY(h.identificationDate) : '-'],
        ['High Risk कारणे', combinedReasons.length > 0 ? combinedReasons.join(', ') : '-'],
        ['डॉक्टरांचा सल्ला', h.doctorAdvice || '-'],
        ['दिलेला उपचार / व्यवस्थापन', h.treatmentInfo || '-'],
        [
          'सद्यस्थिती व पाठपुरावा',
          `${h.currentStatus || '-'} · पाठपुरावा दिनांक: ${
            h.followUpDate ? formatDDMMYYYY(h.followUpDate) : '-'
          } (${h.followUpStatus || '-'})`,
        ],
        ['वैद्यकीय अधिकारी मान्यता', h.approvedByMO || 'वैद्यकीय अधिकारी अंतिम पडताळणी अधीन'],
      ];

      if (h.referralRequired === 'Yes') {
        hrpRows.splice(5, 0, [
          'HRP संदर्भित तपशील',
          `तारीख: ${h.referralDate ? formatDDMMYYYY(h.referralDate) : '-'} · रुग्णालय: ${
            h.referralHospital || '-'
          } · कारण: ${h.referralReason || '-'}`,
        ]);
      }

      p3 = drawPaginatedTable(
        p3,
        pages,
        ben,
        reportDateDDMM,
        [
          { header: 'HRP घटक', widthWeight: 28 },
          { header: 'नोंदवलेली माहिती', widthWeight: 72 },
        ],
        hrpRows,
        {
          fontSize: 8.1,
          headerFontSize: 8.3,
          accentColor: h.isHighRisk === 'YES' ? '#dc2626' : accent,
        }
      );

      if (hrpHistory.length > 0) {
        p3 = drawSubHeading(p3, 'HRP स्थिती बदल इतिहास (Status Change Log)', pages, ben, reportDateDDMM, '#475569');
        p3 = drawPaginatedTable(
          p3,
          pages,
          ben,
          reportDateDDMM,
          [
            { header: 'बदल दिनांक', widthWeight: 16 },
            { header: 'HRP स्थिती', widthWeight: 18 },
            { header: 'कारणे', widthWeight: 36 },
            { header: 'वापरकर्ता व शेरा', widthWeight: 30 },
          ],
          hrpHistory.map((item) => [
            formatDDMMYYYY(item.changedAt.slice(0, 10)),
            `${item.status} (${item.currentStatus || '-'})`,
            (item.reasons || []).join(', ') || '-',
            `${item.changedBy}${item.note ? ` · ${item.note}` : ''}`,
          ]),
          { fontSize: 7.8, headerFontSize: 8, accentColor: accent }
        );
      }
    }
  } else {
    p3 = drawPaginatedTable(
      p3,
      pages,
      ben,
      reportDateDDMM,
      [
        { header: 'HRP स्थिती', widthWeight: 28 },
        { header: 'तपशील', widthWeight: 72 },
      ],
      [['नाही (Normal Risk)', 'अद्याप High Risk नोंदवलेली नाही. वैद्यकीय अधिकारी अंतिम पडताळणी लागू.']],
      { fontSize: 8.2, headerFontSize: 8.3, accentColor: accent }
    );
  }

  // Section 7: Referrals
  p3 = drawSectionBanner(
    p3,
    '७. संदर्भित (Referral) तपशील व पाठपुरावा नोंदी',
    pages,
    ben,
    reportDateDDMM,
    accent
  );
  p3 = drawPaginatedTable(
    p3,
    pages,
    ben,
    reportDateDDMM,
    [
      { header: 'दिनांक', widthWeight: 11 },
      { header: 'प्रकरण ID', widthWeight: 14 },
      { header: 'कुठून संदर्भित', widthWeight: 15 },
      { header: 'संदर्भित रुग्णालय', widthWeight: 19 },
      { header: 'संदर्भ कारण', widthWeight: 19 },
      { header: 'वाहतूक / स्थिती', widthWeight: 11 },
      { header: 'पाठपुरावा व शेरा', widthWeight: 11 },
    ],
    benReferrals.length > 0
      ? benReferrals.map((r) => [
          formatDDMMYYYY(r.referralDate),
          r.episodeCode || '-',
          r.referredFrom,
          r.referredToHospital,
          r.referralReason,
          `${r.transportArrangement || '-'}\n(${r.followUpStatus})`,
          `${r.followUpDate ? formatDDMMYYYY(r.followUpDate) : '-'}${
            r.outcomeNotes ? `\n${r.outcomeNotes}` : ''
          }${r.referredByStaff ? `\n- ${r.referredByStaff}` : ''}`,
        ])
      : [['-', '-', '-', 'कोणतीही संदर्भित (Referral) नोंद नाही', '-', '-', '-']],
    {
      fontSize: 7.9,
      headerFontSize: 8.1,
      repeatBannerTitle: '७. संदर्भित (Referral) तपशील',
      accentColor: accent,
    }
  );

  // Section 8: Td Vaccination & IFA/Calcium Supplements (STRICTLY non-vital records — zero ANC vital duplicates!)
  p3 = drawSectionBanner(
    p3,
    '८. Td लसीकरण व IFA / कॅल्शियम / औषध वितरण नोंद (Immunization & Supplements)',
    pages,
    ben,
    reportDateDDMM,
    accent
  );

  // 8A: Td Immunization Status Summary (Td-1, Td-2, Td-Booster)
  const tdSlots: Array<{ code: 'TD_1' | 'TD_2' | 'TD_BOOSTER'; label: string }> = [
    { code: 'TD_1', label: 'Td-1 लसीकरण' },
    { code: 'TD_2', label: 'Td-2 लसीकरण' },
    { code: 'TD_BOOSTER', label: 'Td-Booster लसीकरण' },
  ];

  const primaryTdRows = tdSlots.map((slot) => {
    const match = benServiceRecords.find(
      (r) =>
        r.serviceCode === slot.code &&
        (!primaryEpisode || !r.pregnancyEpisodeId || r.pregnancyEpisodeId === primaryEpisode.id)
    );
    if (!match) {
      return [
        primaryEpisode?.episodeCode || '-',
        slot.label,
        'प्रलंबित',
        '-',
        '-',
        '-',
        '-',
      ];
    }
    const place = resolvePlace(match.sessionId, match.villageId, match.subcentreId);
    return [
      match.episodeCode || primaryEpisode?.episodeCode || '-',
      slot.label,
      'दिलेला (Done)',
      formatDDMMYYYY(match.visitDate || match.sessionDate),
      match.batchNumber || '-',
      `${place.placeText} (${place.sessionCode})`,
      match.staffName || '-',
    ];
  });

  // Include any Td doses given in prior episodes so historical immunizations aren't hidden
  const priorTdRows: string[][] = benServiceRecords
    .filter(
      (r) =>
        TD_SERVICE_CODES.has(r.serviceCode) &&
        primaryEpisode &&
        r.pregnancyEpisodeId &&
        r.pregnancyEpisodeId !== primaryEpisode.id
    )
    .map((r) => {
      const place = resolvePlace(r.sessionId, r.villageId, r.subcentreId);
      return [
        r.episodeCode || '-',
        r.serviceName,
        'दिलेला (Done)',
        formatDDMMYYYY(r.visitDate || r.sessionDate),
        r.batchNumber || '-',
        `${place.placeText} (${place.sessionCode})`,
        r.staffName || '-',
      ];
    });

  p3 = drawSubHeading(p3, 'अ) Td लसीकरण स्थिती (Tetanus-Diphtheria Immunization)', pages, ben, reportDateDDMM, '#334155');
  p3 = drawPaginatedTable(
    p3,
    pages,
    ben,
    reportDateDDMM,
    [
      { header: 'प्रकरण ID', widthWeight: 15 },
      { header: 'लस डोस', widthWeight: 15 },
      { header: 'स्थिती', widthWeight: 12 },
      { header: 'दिनांक', widthWeight: 12 },
      { header: 'बॅच क्रमांक', widthWeight: 12 },
      { header: 'ठिकाण / सत्र', widthWeight: 22 },
      { header: 'कर्मचारी', widthWeight: 12 },
    ],
    [...primaryTdRows, ...priorTdRows],
    {
      fontSize: 7.9,
      headerFontSize: 8.1,
      repeatBannerTitle: '८. Td लसीकरण स्थिती',
      accentColor: accent,
    }
  );

  // 8B: IFA, Calcium & Other Non-Vital Medicines / Services Log
  const supplementAndOtherRecords: MaternalServiceRecord[] = benServiceRecords.filter(
    (r) => !VITAL_SERVICE_CODES.has(r.serviceCode) && !TD_SERVICE_CODES.has(r.serviceCode)
  );

  p3 = drawSubHeading(
    p3,
    'ब) IFA, कॅल्शियम व इतर औषध वितरण लॉग (Supplements & Other Maternal Services)',
    pages,
    ben,
    reportDateDDMM,
    '#334155'
  );
  p3 = drawPaginatedTable(
    p3,
    pages,
    ben,
    reportDateDDMM,
    [
      { header: 'अ.क्र.', widthWeight: 6, align: 'center' },
      { header: 'दिनांक', widthWeight: 12 },
      { header: 'प्रकरण ID', widthWeight: 15 },
      { header: 'ठिकाण / सत्र', widthWeight: 22 },
      { header: 'औषध / सेवा नाव', widthWeight: 20 },
      { header: 'प्रमाण / बॅच', widthWeight: 13 },
      { header: 'कर्मचारी / शेरा', widthWeight: 12 },
    ],
    supplementAndOtherRecords.length > 0
      ? supplementAndOtherRecords.map((rec, idx) => {
          const p = resolvePlace(rec.sessionId, rec.villageId, rec.subcentreId);
          return [
            String(idx + 1),
            formatDDMMYYYY(rec.visitDate || rec.sessionDate),
            rec.episodeCode || '-',
            `${p.placeText}\n(${p.sessionCode})`,
            rec.serviceName,
            `${rec.serviceValue || 'दिले'}${rec.batchNumber ? `\nबॅच: ${rec.batchNumber}` : ''}`,
            `${rec.staffName || '-'}${rec.remarks ? `\n${rec.remarks}` : ''}`,
          ];
        })
      : [['-', '-', '-', '-', 'अद्याप IFA / कॅल्शियम वितरण नोंद नाही', '-', '-']],
    {
      fontSize: 7.9,
      headerFontSize: 8.1,
      repeatBannerTitle: '८. IFA व कॅल्शियम वितरण लॉग',
      accentColor: accent,
    }
  );

  // ======================== PAGE 4: DELIVERY + BABIES + PNC + FINAL CERTIFICATION ========================
  let p4 = createPortraitSurface();
  pages.push(p4);
  drawRunningHeader(p4, ben, reportDateDDMM);

  p4 = drawSectionBanner(
    p4,
    '९. प्रसूती तपशील व जन्मलेल्या बाळांच्या नोंदी (Delivery & Newborn Records)',
    pages,
    ben,
    reportDateDDMM,
    accent
  );

  p4 = drawPaginatedTable(
    p4,
    pages,
    ben,
    reportDateDDMM,
    [
      { header: 'प्रकरण ID', widthWeight: 14 },
      { header: 'प्रसूती दिनांक', widthWeight: 14 },
      { header: 'प्रत्यक्ष ठिकाण व रुग्णालय', widthWeight: 22 },
      { header: 'प्रसूती प्रकार', widthWeight: 13 },
      { header: 'बाळे', widthWeight: 6, align: 'center' },
      { header: 'मातेची स्थिती व गुंतागुंत', widthWeight: 19 },
      { header: 'कर्मचारी / टीप', widthWeight: 12 },
    ],
    benDeliveries.length > 0
      ? benDeliveries.map((d) => [
          d.episodeCode || '-',
          `${formatDDMMYYYY(d.actualDeliveryDate)}${
            d.plannedEddDate ? `\n(EDD: ${formatDDMMYYYY(d.plannedEddDate)})` : ''
          }`,
          `${d.actualDeliveryPlace}${d.actualHospitalName ? `\n${d.actualHospitalName}` : ''}`,
          d.deliveryType === 'Other' && d.deliveryTypeOther ? d.deliveryTypeOther : d.deliveryType,
          formatNumberIN(d.numberOfBabies),
          `${d.motherCondition}${d.deliveryComplications ? `\nगुंतागुंत: ${d.deliveryComplications}` : ''}`,
          `${d.attendedByStaff || '-'}${d.referralDetails ? `\nसंदर्भ: ${d.referralDetails}` : ''}`,
        ])
      : [['-', '-', 'प्रसूती अद्याप नोंदवलेली नाही', '-', '0', '-', '-']],
    { fontSize: 7.9, headerFontSize: 8.1, accentColor: accent }
  );

  p4 = drawSubHeading(p4, 'जन्मलेल्या बाळांचा तपशील (Newborn Baby Details)', pages, ben, reportDateDDMM, '#334155');
  p4 = drawPaginatedTable(
    p4,
    pages,
    ben,
    reportDateDDMM,
    [
      { header: 'बाळ ID', widthWeight: 16 },
      { header: 'बाळाचे नाव', widthWeight: 18 },
      { header: 'लिंग', widthWeight: 9 },
      { header: 'जन्म वजन', widthWeight: 12, align: 'right' },
      { header: 'जन्म परिणाम', widthWeight: 14 },
      { header: 'बाळाची प्रकृती', widthWeight: 18 },
      { header: 'टिपण्णी (Notes)', widthWeight: 13 },
    ],
    benBabies.length > 0
      ? benBabies.map((b) => [
          b.babyCode,
          b.babyName,
          b.gender,
          b.birthWeightGrams ? `${formatNumberIN(b.birthWeightGrams)} g` : '-',
          b.birthOutcome === 'Other' && b.birthOutcomeOther ? b.birthOutcomeOther : b.birthOutcome,
          b.babyCondition || '-',
          b.notes || '-',
        ])
      : [['-', 'अद्याप बाळाची नोंद नाही', '-', '-', '-', '-', '-']],
    { fontSize: 7.9, headerFontSize: 8.1, accentColor: accent }
  );

  // Section 10: PNC-1, PNC-2 & Extra Postnatal Visits
  p4 = drawSectionBanner(
    p4,
    '१०. प्रसूतीनंतर तपासण्या — PNC-1, PNC-2 व अतिरिक्त भेटी (Postnatal Care)',
    pages,
    ben,
    reportDateDDMM,
    accent
  );

  p4 = drawPaginatedTable(
    p4,
    pages,
    ben,
    reportDateDDMM,
    [
      { header: 'PNC भेट', widthWeight: 10 },
      { header: 'दिनांक', widthWeight: 11 },
      { header: 'माता BP व प्रकृती', widthWeight: 18 },
      { header: 'रक्तस्राव / स्तनपान', widthWeight: 17 },
      { header: 'बाळ वजन व प्रकृती', widthWeight: 17 },
      { header: 'औषधे / समुपदेशन', widthWeight: 15 },
      { header: 'कर्मचारी / पुढील भेट', widthWeight: 12 },
    ],
    benPncs.length > 0
      ? benPncs.map((p) => [
          `${p.visitLabel}${hasMultipleEpisodes && p.episodeCode ? `\n(${p.episodeCode})` : ''}`,
          formatDDMMYYYY(p.pncDate),
          `BP: ${p.motherBp || '-'}\n${p.motherHealthStatus}`,
          `रक्तस्राव: ${p.bleedingStatus}\nस्तनपान: ${p.breastfeedingStatus}`,
          `${p.babyWeightGrams ? `${formatNumberIN(p.babyWeightGrams)} g` : '-'}\n${p.babyHealthStatus}`,
          `समुपदेशन: ${p.breastfeedingCounselling || '-'}${p.treatmentGiven ? `\n${p.treatmentGiven}` : ''}`,
          `${p.staffName}${p.nextFollowUpDate ? `\nपुढील: ${formatDDMMYYYY(p.nextFollowUpDate)}` : ''}${
            p.remarks ? `\n${p.remarks}` : ''
          }`,
        ])
      : [['-', '-', 'अद्याप PNC तपासणी नोंदवलेली नाही', '-', '-', '-', '-']],
    {
      fontSize: 7.9,
      headerFontSize: 8.1,
      repeatBannerTitle: '१०. प्रसूतीनंतर तपासण्या (PNC)',
      accentColor: accent,
    }
  );

  // Section 11: Final Health Status & Signatures
  p4 = drawSectionBanner(
    p4,
    '११. अंतिम आरोग्य स्थिती, प्रमाणन व स्वाक्षरी (Final Status & Signatures)',
    pages,
    ben,
    reportDateDDMM,
    accent
  );

  if (p4.y + 185 > p4.logicalH - MARGIN_BOTTOM) {
    p4 = createPortraitSurface();
    pages.push(p4);
    drawRunningHeader(p4, ben, reportDateDDMM);
  }

  {
    const { ctx, logicalW } = p4;
    const boxW = logicalW - MARGIN_X * 2;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(MARGIN_X, p4.y, boxW, 76);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.85;
    ctx.strokeRect(MARGIN_X, p4.y, boxW, 76);

    const finalEpisodeStatus = primaryEpisode?.pregnancyStatus || ben.status;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.font = `700 9.4px ${FONT_FAMILY}`;
    ctx.fillText(
      `अंतिम आरोग्य स्थिती: ${finalEpisodeStatus} · High Risk: ${
        isHighRisk ? 'होय' : 'नाही'
      } · एकूण ANC तपासण्या: ${formatNumberIN(unifiedExams.length)} · PNC भेटी: ${formatNumberIN(benPncs.length)}`,
      MARGIN_X + 10,
      p4.y + 10
    );
    ctx.font = `500 8.8px ${FONT_FAMILY}`;
    ctx.fillText(
      `अहवाल निर्मिती वेळ (IST): ${generatedAtIST} · तयार करणारे: ${preparedBy}`,
      MARGIN_X + 10,
      p4.y + 28
    );
    ctx.font = `400 8.1px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(
      'वैद्यकीय सूचना: High Risk वर्गवारी, उपचार व संदर्भित निर्णय अंतिम वैद्यकीय अधिकाऱ्यांच्या (MO) पडताळणीनंतरच ग्राह्य धरले जातात.',
      MARGIN_X + 10,
      p4.y + 45
    );
    ctx.fillText(
      'गोपनीयता: आधार क्रमांक अहवालात संरक्षित (XXXX-XXXX-1234) स्वरूपात प्रदर्शित केले आहेत.',
      MARGIN_X + 10,
      p4.y + 59
    );
    p4.y += 92;

    const gap = 16;
    const sigW = (boxW - gap * 2) / 3;
    const sigTitles = [
      'ANM स्वाक्षरी व नाव',
      'CHO स्वाक्षरी व नाव',
      'वैद्यकीय अधिकारी स्वाक्षरी व शिक्का',
    ];
    const sigSub = [
      'उपकेंद्र स्तरावरील नोंदणी',
      'प्राथमिक तपासणी अधिकारी',
      'प्राथमिक आरोग्य केंद्र भादा',
    ];

    sigTitles.forEach((title, idx) => {
      const sx = MARGIN_X + idx * (sigW + gap);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.85;
      ctx.strokeRect(sx, p4.y, sigW, 84);
      ctx.beginPath();
      ctx.moveTo(sx + 12, p4.y + 50);
      ctx.lineTo(sx + sigW - 12, p4.y + 50);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = `700 9px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(title, sx + sigW / 2, p4.y + 57);
      ctx.fillStyle = '#475569';
      ctx.font = `400 8px ${FONT_FAMILY}`;
      ctx.fillText(sigSub[idx], sx + sigW / 2, p4.y + 70);
    });
  }

  // Finalize all pages with running footer + exact Page X / Total
  const totalPages = pages.length;
  pages.forEach((pg, idx) => {
    const { ctx, logicalW, logicalH } = pg;
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, logicalH - 28);
    ctx.lineTo(logicalW - MARGIN_X, logicalH - 28);
    ctx.stroke();

    ctx.font = `500 8.2px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText(
      `प्राथमिक आरोग्य केंद्र भादा · ID: ${ben.beneficiaryCode} · निर्मिती: ${generatedAtIST}`,
      MARGIN_X,
      logicalH - 20
    );
    ctx.textAlign = 'right';
    ctx.font = `700 8.8px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`पृष्ठ ${idx + 1} / ${totalPages}`, logicalW - MARGIN_X, logicalH - 20);
    ctx.restore();
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((pg, idx) => {
    if (idx > 0) doc.addPage('a4', 'portrait');
    const imgData = pg.canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  });

  return { blob: doc.output('blob'), beneficiary: ben };
}

export async function downloadCompletePregnancyPDF(
  db: SheetDatabase,
  beneficiaryId: string,
  preparedBy: string
): Promise<void> {
  const { blob, beneficiary } = await generateCompletePregnancyPDFBlob(
    db,
    beneficiaryId,
    preparedBy
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PHC_Bhada_Maternal_Report_${beneficiary.beneficiaryCode}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
