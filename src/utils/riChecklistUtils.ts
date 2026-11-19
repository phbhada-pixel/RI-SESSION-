import jsPDF from 'jspdf';
import {
  RiChecklist,
  RiLogisticAvailability,
  RiVaccineStatusEntry,
} from '../types';
import { formatDDMMYYYY } from './dateUtils';
import { exportMultiSheetExcel } from './exportUtils';
import { formatDateTimeIST, formatNumberIN } from './localeUtils';

export interface RiVaccineCatalogItem {
  code: string;
  label: string;
  sublabel: string;
  allowNa: boolean;
  supportsOpenVial: boolean;
}

/**
 * Updated per PHC Bhada / UIP guidelines:
 * - JE Diluent removed (JE vaccine now comes without diluent / ready-to-use)
 * - PCV & IPV added with availability + open vial re-issued status
 */
export const RI_VACCINE_ITEMS: RiVaccineCatalogItem[] = [
  {
    code: 'BCG',
    label: 'BCG',
    sublabel: 'बीसीजी लस',
    allowNa: false,
    supportsOpenVial: false,
  },
  {
    code: 'BCG_DILUENT',
    label: 'BCG Diluent',
    sublabel: 'बीसीजी डायल्युएंट',
    allowNa: false,
    supportsOpenVial: false,
  },
  {
    code: 'DPT',
    label: 'DPT',
    sublabel: 'डीपीटी बुस्टर',
    allowNa: false,
    supportsOpenVial: true,
  },
  {
    code: 'HEPATITIS_B',
    label: 'Hepatitis B',
    sublabel: 'हिपॅटायटीस बी',
    allowNa: false,
    supportsOpenVial: true,
  },
  {
    code: 'MEASLES_MR',
    label: 'Measles / MR',
    sublabel: 'गोवर / एमआर लस',
    allowNa: false,
    supportsOpenVial: false,
  },
  {
    code: 'MEASLES_MR_DILUENT',
    label: 'Measles / MR Diluent',
    sublabel: 'गोवर / एमआर डायल्युएंट',
    allowNa: false,
    supportsOpenVial: false,
  },
  {
    code: 'OPV',
    label: 'OPV (bOPV / tOPV)',
    sublabel: 'पोलिओ थेंब',
    allowNa: false,
    supportsOpenVial: true,
  },
  {
    code: 'TD_TT',
    label: 'Td / TT',
    sublabel: 'धनुर्वात प्रतिबंधक लस',
    allowNa: false,
    supportsOpenVial: true,
  },
  {
    code: 'JE',
    label: 'JE (Ready-to-Use · No Diluent)',
    sublabel: 'जे.ई. लस (डायल्युएंट आवश्यक नाही)',
    allowNa: true,
    supportsOpenVial: true,
  },
  {
    code: 'PENTAVALENT',
    label: 'Pentavalent',
    sublabel: 'पेंटाव्हॅलेंट',
    allowNa: true,
    supportsOpenVial: true,
  },
  {
    code: 'PCV',
    label: 'PCV',
    sublabel: 'पीसीव्ही (Pneumococcal Conjugate Vaccine)',
    allowNa: true,
    supportsOpenVial: true,
  },
  {
    code: 'IPV',
    label: 'IPV (fIPV)',
    sublabel: 'आयपीव्ही (Inactivated Polio Vaccine)',
    allowNa: true,
    supportsOpenVial: true,
  },
];

export interface RiLogisticCatalogItem {
  code: string;
  label: string;
  sublabel: string;
}

export const RI_LOGISTIC_ITEMS: RiLogisticCatalogItem[] = [
  { code: 'AD_01_SYRINGE', label: 'AD (0.1 ml) Syringes', sublabel: 'एडी सिरींज ०.१ मि.ली.' },
  { code: 'AD_05_SYRINGE', label: 'AD (0.5 ml) Syringes', sublabel: 'एडी सिरींज ०.५ मि.ली.' },
  {
    code: 'RECONSTITUTION_5ML',
    label: '5 ml Reconstitution Syringes',
    sublabel: '५ मि.ली. सिरींज',
  },
  { code: 'BLANK_RI_MCP_CARD', label: 'Blank RI / MCP Card', sublabel: 'रिकामे MCP / लसीकरण कार्ड' },
  { code: 'VITAMIN_A_SOLUTION', label: 'Vitamin-A Solution', sublabel: 'व्हिटॅमिन-ए द्रावण' },
  {
    code: 'PARACETAMOL',
    label: 'Paracetamol tablet / syrup',
    sublabel: 'पॅरासिटामॉल गोळ्या / सिरप',
  },
  { code: 'ORS_PACKET', label: 'ORS Packet', sublabel: 'ओआरएस पॅकेट' },
  { code: 'IFA_TABLET', label: 'IFA tablet', sublabel: 'आयएफए गोळ्या' },
  { code: 'ZINC_TABLET_SYRUP', label: 'Zinc Tablet / Syrup', sublabel: 'झिंक गोळ्या / सिरप' },
  { code: 'RED_BLACK_BAGS', label: 'Red & black bags', sublabel: 'लाल व काळ्या पिशव्या' },
  { code: 'VIT_A_SPOON_CAP', label: 'Vit-A spoon / cap', sublabel: 'व्हिटॅमिन-ए चमचा / झाकण' },
];

export const RI_MONITORING_REASONS = [
  'Polio HRA',
  'Measles Outbreak in last 1 year',
  'Other VPD Outbreak in last 1 year',
  'Session planned for vacant ANM subcentre',
  'Others',
] as const;

export const RI_HRA_TYPES = [
  '1- Slums with migration',
  '2- Nomads',
  '3- Brick kiln',
  '4- Construction site',
  '5- Other migratory high risk areas',
  '6- Non migratory (settled population) high risk areas',
] as const;

export const RI_SESSION_NOT_HELD_REASONS = [
  'A- Neither ANM/Vaccinator nor vaccines/logistics is available',
  'B- ANM/vaccinator present but vaccine/logistics not available',
  'C- Vaccine/logistics available but ANM/vaccinator absent',
  'D- Others',
] as const;

export const RI_HUB_CUTTER_NO_REASONS = [
  'A- Hub-cutter not available',
  'B- Hub-cutter not functioning',
  'C- Untrained ANM',
  'D- Others',
] as const;

export const RI_RECONSTITUTED_VIALS = ['BCG', 'Measles / MR', 'None'] as const;

export const RI_MOBILIZER_OPTIONS = [
  'ASHA',
  'USHA',
  'AWW',
  'Others',
  'None',
] as const;

export const RI_CAREGIVER_MOBILIZERS = [
  'ASHA',
  'USHA',
  'ICDS Worker',
  'ANM',
  'CMC',
  'Others',
  'None',
] as const;

export const RI_4_KEY_MESSAGES = [
  {
    num: 1,
    en: 'What vaccine was given and what disease it prevents',
    mr: 'कोणती लस दिली गेली आणि ती कोणत्या आजारापासून संरक्षण देते',
  },
  {
    num: 2,
    en: 'When to come for the next visit',
    mr: 'पुढील लसीकरणासाठी केव्हा यावे',
  },
  {
    num: 3,
    en: 'What are the minor side-effects and how to deal with them',
    mr: 'कोणते किरकोळ दुष्परिणाम (उदा. ताप/सूज) होऊ शकतात व त्यांची काळजी कशी घ्यावी',
  },
  {
    num: 4,
    en: 'To keep the immunization card safe and to bring it along for the next visit',
    mr: 'लसीकरण (MCP) कार्ड सुरक्षित ठेवणे व पुढील भेटीला सोबत आणणे',
  },
];

export function buildDefaultRiVaccines(): Record<string, RiVaccineStatusEntry> {
  const map: Record<string, RiVaccineStatusEntry> = {};
  for (const item of RI_VACCINE_ITEMS) {
    map[item.code] = {
      availability: '',
      ...(item.supportsOpenVial ? { openVialReissued: '' } : {}),
    };
  }
  return map;
}

export function buildDefaultRiLogistics(): Record<string, RiLogisticAvailability> {
  const map: Record<string, RiLogisticAvailability> = {};
  for (const item of RI_LOGISTIC_ITEMS) {
    map[item.code] = '';
  }
  return map;
}

export function computeRiChecklistCounts(c: RiChecklist) {
  const adequateVaccines = RI_VACCINE_ITEMS.filter(
    (v) => c.vaccines?.[v.code]?.availability === 'Adequate'
  ).length;
  const issueVaccines = RI_VACCINE_ITEMS.filter((v) => {
    const av = c.vaccines?.[v.code]?.availability;
    return av === 'No' || av === 'Inadequate';
  }).length;
  const adequateLogistics = RI_LOGISTIC_ITEMS.filter(
    (l) => c.logistics?.[l.code] === 'Adequate'
  ).length;
  const issueLogistics = RI_LOGISTIC_ITEMS.filter((l) => {
    const av = c.logistics?.[l.code];
    return av === 'No' || av === 'Inadequate';
  }).length;

  return {
    adequateVaccines,
    issueVaccines,
    totalVaccines: RI_VACCINE_ITEMS.length,
    adequateLogistics,
    issueLogistics,
    totalLogistics: RI_LOGISTIC_ITEMS.length,
  };
}

// =========================================================================
// Excel Export (Single Checklist or Full Monitoring Register)
// =========================================================================

export function exportRiChecklistExcel(item: RiChecklist): void {
  const summaryHeaders = ['तपशील', 'नोंदवलेली माहिती'];
  const summaryRows: Array<Array<string | number>> = [
    ['चेकलिस्ट कोड', item.checklistCode],
    ['सत्र कोड (संलग्न असल्यास)', item.sessionCode || '-'],
    ['निरीक्षणाचा दिनांक', formatDDMMYYYY(item.monitoringDate)],
    ['चेकलिस्ट करणारा कर्मचारी नाव', item.checklistStaffName || item.monitorName || '-'],
    ['निरीक्षकाचे नाव (Monitor)', item.monitorName],
    [
      'संस्था (Organization)',
      item.organization === 'Others' && item.organizationOther
        ? `${item.organization} (${item.organizationOther})`
        : item.organization,
    ],
    ['पदनाम (Designation)', item.designation],
    ['राज्य / जिल्हा / तालुका', `${item.state} / ${item.district} / ${item.blockUlb}`],
    ['नियोजन घटक (Planning Unit)', item.planningUnit],
    ['विभाग (Setting)', item.setting],
    ['उपकेंद्र', item.subcentreName],
    ['सत्र ठिकाण / गाव', item.sessionSiteName],
    ['ठिकाण प्रकार (Location)', item.sessionSiteLocation],
    [
      'निरीक्षणाचे कारण (Reason)',
      item.monitoringReasons.join(', ') +
        (item.monitoringReasonOther ? ` (${item.monitoringReasonOther})` : ''),
    ],
    ['HRA प्रकार (असल्यास)', item.hraType || '-'],
    ['1a. सत्र सुरू आहे का?', item.isSessionHeld],
    [
      '1b. सत्र बंद असल्यास कारण',
      item.sessionNotHeldReason
        ? `${item.sessionNotHeldReason}${item.sessionNotHeldReasonOther ? ` (${item.sessionNotHeldReasonOther})` : ''}`
        : '-',
    ],
    ['2. ANM कडे Due List उपलब्ध आहे का?', item.dueListAvailable || '-'],
    ['3. मोबिलायझर नियुक्त आहे का?', item.mobilizersAssigned.join(', ') || '-'],
    ['4. Due list मोबिलायझरकडे आहे का?', item.dueListWithMobiliser || '-'],
    ['5. मोबिलायझर मुलांना सत्रात आणत आहे का?', item.mobilizerMobilizing || '-'],
    ['6. Polio HRA टॅग आहे का?', item.polioHraTagged || '-'],
    [
      '7. लस व लॉजिस्टिक्स वाहतूक कोणी केली?',
      item.vaccineDeliveredBy
        ? `${item.vaccineDeliveredBy}${item.vaccineCarrierName ? ` · नाव: ${item.vaccineCarrierName}` : ''}`
        : item.vaccineCarrierName || '-',
    ],
    ['7b. लस वाहतूक करणाऱ्याचे नाव', item.vaccineCarrierName || '-'],
    ['10. वापरानंतर लगेच Hub Cutter ने सुई कापली जाते का?', item.cuttingWithHubCutter || '-'],
    ['10b. नाही असल्यास कारण', item.hubCutterNoReason || '-'],
    ['11. सर्व व्हायल्सवर दिनांक व वेळ नोंदवलेली आहे का?', item.markingVialsDateTime || '-'],
    [
      '12. वेळ उलटलेली Reconstituted लस वापरली जात आहे का? (JE विना-डायल्युएंट)',
      item.reconstitutedVialAfterLapsed.join(', ') || '-',
    ],
    ['13. सर्व ४ मुख्य संदेश दिले जात आहेत का?', item.delivering4KeyMessages || '-'],
    ['14. लसीकरणानंतर ३० मिनिटे थांबण्याचा सल्ला दिला का?', item.advisingWait30Mins || '-'],
    [
      '15. पालक संवाद (३ पालक)',
      item.caregiverInterviewNotObserved
        ? 'Not Observed'
        : `पालक १: ${item.caregiver1Mobilizer.join('/') || '-'} | पालक २: ${
            item.caregiver2Mobilizer.join('/') || '-'
          } | पालक ३: ${item.caregiver3Mobilizer.join('/') || '-'}`,
    ],
    ['16. गोवर/एमआर २रा डोस किमान वय (ANM उत्तर)', item.minAge2ndMeasles || '-'],
    ['17. MCTS / नोंदवही अद्ययावत आहे का?', item.mctsRegisterMaintained || '-'],
    [
      '18. आज पर्यवेक्षकाने भेट दिली का?',
      item.supervisorVisitedToday === 'Others' && item.supervisorVisitedOther
        ? `Others (${item.supervisorVisitedOther})`
        : item.supervisorVisitedToday || '-',
    ],
    ['19. ASHA ला मागील RI सत्राचे मानधन मिळाले का?', item.ashaPaymentPreviousSession || '-'],
    ['20. ASHA FI मानधन / CI मानधन', `FI: ${item.ashaPaymentFI || '-'} | CI: ${item.ashaPaymentCI || '-'}`],
    [
      '21. लस / लॉजिस्टिक अनुपलब्धतेचे कारण (PHC)',
      item.vaccineNotAvailableReason
        ? `${item.vaccineNotAvailableReason}${item.vaccineNotAvailableOther ? ` (${item.vaccineNotAvailableOther})` : ''}`
        : '-',
    ],
    [
      '22. ANM अनुपस्थितीचे कारण (PHC)',
      item.anmAbsentReason
        ? `${item.anmAbsentReason}${item.anmAbsentOther ? ` (${item.anmAbsentOther})` : ''}`
        : '-',
    ],
    ['शेरा (Remarks)', item.remarks || '-'],
  ];

  const vaccineHeaders = ['अ.क्र.', 'लस / डायल्युएंट', 'उपलब्धता (Q8*)', 'Open Vial Re-issued'];
  const vaccineRows = RI_VACCINE_ITEMS.map((v, idx) => {
    const entry = item.vaccines?.[v.code];
    return [
      idx + 1,
      `${v.label} (${v.sublabel})`,
      entry?.availability || '-',
      v.supportsOpenVial ? entry?.openVialReissued || '-' : 'लागू नाही',
    ];
  });

  const logisticHeaders = ['अ.क्र.', 'लॉजिस्टिक साहित्य (Q9*)', 'उपलब्धता स्थिती'];
  const logisticRows = RI_LOGISTIC_ITEMS.map((l, idx) => [
    idx + 1,
    `${l.label} (${l.sublabel})`,
    item.logistics?.[l.code] || '-',
  ]);

  exportMultiSheetExcel(`RI_Checklist_${item.checklistCode}`, [
    { name: 'Session_Monitoring_Summary', headers: summaryHeaders, rows: summaryRows },
    { name: 'Q8_Vaccines_PCV_IPV', headers: vaccineHeaders, rows: vaccineRows },
    { name: 'Q9_Logistics', headers: logisticHeaders, rows: logisticRows },
  ]);
}

// =========================================================================
// Crisp Canvas-to-jsPDF Bilingual Export (Devanagari + English)
// =========================================================================

const A4_PORTRAIT = { widthPt: 595.28, heightPt: 841.89 };
const SCALE = 2.0;
const MARGIN_X = 24;
const MARGIN_BOTTOM = 26;
const FONT_FAMILY =
  '"Noto Sans Devanagari", "Noto Sans", "Kohinoor Devanagari", "Arial Unicode MS", system-ui, sans-serif';

interface PageSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  logicalW: number;
  logicalH: number;
  y: number;
}

function createSurface(): PageSurface {
  const logicalW = A4_PORTRAIT.widthPt;
  const logicalH = A4_PORTRAIT.heightPt;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(logicalW * SCALE);
  canvas.height = Math.round(logicalH * SCALE);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, logicalW, logicalH);
  ctx.textBaseline = 'top';
  return { canvas, ctx, logicalW, logicalH, y: 20 };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const raw = (text || '-').replace(/\r/g, '');
  const lines: string[] = [];
  for (const para of raw.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width <= maxW) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines.length > 0 ? lines : ['-'];
}

function drawRunningHeader(page: PageSurface, item: RiChecklist) {
  const { ctx, logicalW } = page;
  ctx.save();
  ctx.font = `600 8.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText(
    `PHC Bhada · RI Session Monitoring Checklist (${item.checklistCode})`,
    MARGIN_X,
    12
  );
  ctx.textAlign = 'right';
  ctx.fillText(
    `${item.subcentreName || '-'} · ${formatDDMMYYYY(item.monitoringDate)}`,
    logicalW - MARGIN_X,
    12
  );
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, 24);
  ctx.lineTo(logicalW - MARGIN_X, 24);
  ctx.stroke();
  ctx.restore();
  page.y = 32;
}

function ensureSpace(pages: PageSurface[], page: PageSurface, item: RiChecklist, neededH: number): PageSurface {
  if (page.y + neededH <= page.logicalH - MARGIN_BOTTOM) return page;
  const next = createSurface();
  pages.push(next);
  drawRunningHeader(next, item);
  return next;
}

function drawSectionBanner(
  pages: PageSurface[],
  page: PageSurface,
  item: RiChecklist,
  title: string
): PageSurface {
  const active = ensureSpace(pages, page, item, 32);
  const { ctx, logicalW } = active;
  ctx.save();
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(MARGIN_X, active.y, logicalW - MARGIN_X * 2, 20);
  ctx.font = `700 10px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(title, MARGIN_X + 7, active.y + 4.5);
  ctx.restore();
  active.y += 24;
  return active;
}

function drawSimpleTable(
  pages: PageSurface[],
  startPage: PageSurface,
  item: RiChecklist,
  headers: string[],
  weights: number[],
  rows: string[][],
  fontSize = 8.5
): PageSurface {
  let active = startPage;
  const totalW = weights.reduce((a, b) => a + b, 0);
  const usableW = active.logicalW - MARGIN_X * 2;
  const colWidths = weights.map((w) => (w / totalW) * usableW);
  const padX = 5;
  const padY = 4;
  const lh = fontSize * 1.35;

  const drawHeaderRow = (target: PageSurface) => {
    target.ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
    const wrapped = headers.map((h, i) => wrapText(target.ctx, h, Math.max(20, colWidths[i] - padX * 2)));
    const maxL = Math.max(1, ...wrapped.map((w) => w.length));
    const hH = maxL * lh + padY * 2;
    let x = MARGIN_X;
    for (let i = 0; i < headers.length; i++) {
      target.ctx.fillStyle = '#f1f5f9';
      target.ctx.fillRect(x, target.y, colWidths[i], hH);
      target.ctx.strokeStyle = '#94a3b8';
      target.ctx.lineWidth = 0.6;
      target.ctx.strokeRect(x, target.y, colWidths[i], hH);
      target.ctx.fillStyle = '#0f172a';
      target.ctx.textAlign = 'left';
      wrapped[i].forEach((ln, li) => {
        target.ctx.fillText(ln, x + padX, target.y + padY + li * lh);
      });
      x += colWidths[i];
    }
    target.y += hH;
  };

  active = ensureSpace(pages, active, item, 36);
  drawHeaderRow(active);

  rows.forEach((row, rIdx) => {
    active.ctx.font = `400 ${fontSize}px ${FONT_FAMILY}`;
    const wrapped = row.map((cell, i) =>
      wrapText(active.ctx, cell || '-', Math.max(20, colWidths[i] - padX * 2))
    );
    const maxL = Math.max(1, ...wrapped.map((w) => w.length));
    const rowH = maxL * lh + padY * 2;

    if (active.y + rowH > active.logicalH - MARGIN_BOTTOM) {
      const next = createSurface();
      pages.push(next);
      drawRunningHeader(next, item);
      active = next;
      drawHeaderRow(active);
    }

    let x = MARGIN_X;
    for (let i = 0; i < row.length; i++) {
      active.ctx.fillStyle = rIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
      active.ctx.fillRect(x, active.y, colWidths[i], rowH);
      active.ctx.strokeStyle = '#cbd5e1';
      active.ctx.lineWidth = 0.5;
      active.ctx.strokeRect(x, active.y, colWidths[i], rowH);
      active.ctx.fillStyle = '#0f172a';
      active.ctx.font = `400 ${fontSize}px ${FONT_FAMILY}`;
      active.ctx.textAlign = 'left';
      wrapped[i].forEach((ln, li) => {
        active.ctx.fillText(ln, x + padX, active.y + padY + li * lh);
      });
      x += colWidths[i];
    }
    active.y += rowH;
  });

  active.y += 8;
  return active;
}

export async function downloadRiChecklistPDF(item: RiChecklist): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const pages: PageSurface[] = [];
  let page = createSurface();
  pages.push(page);

  const { ctx, logicalW } = page;
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(MARGIN_X, page.y, logicalW - MARGIN_X * 2, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 13px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.fillText('Session Monitoring Format for Routine Immunization (RI Checklist)', MARGIN_X + 10, page.y + 8);
  ctx.font = `400 9px ${FONT_FAMILY}`;
  ctx.fillText(
    `प्राथमिक आरोग्य केंद्र भादा · कोड: ${item.checklistCode} · दिनांक: ${formatDDMMYYYY(item.monitoringDate)} · सुधारित (PCV, IPV समाविष्ट | JE विना-डायल्युएंट)`,
    MARGIN_X + 10,
    page.y + 27
  );
  page.y += 54;

  // Header & Site Metadata
  page = drawSectionBanner(pages, page, item, 'निरीक्षक व सत्र केंद्र माहिती (Header & Site Information)');
  page = drawSimpleTable(
    pages,
    page,
    item,
    ['तपशील', 'नोंदवलेली माहिती', 'तपशील', 'नोंदवलेली माहिती'],
    [1.3, 1.9, 1.3, 1.9],
    [
      [
        'Checklist Staff / Monitor',
        `${item.checklistStaffName || item.monitorName || '-'} · Monitor: ${item.monitorName} (${item.organization}${item.organizationOther ? `: ${item.organizationOther}` : ''})`,
        'Designation / Date',
        `${item.designation || '-'} · ${formatDDMMYYYY(item.monitoringDate)}`,
      ],
      [
        'State / District / Block',
        `${item.state} / ${item.district} / ${item.blockUlb}`,
        'Planning Unit / Setting',
        `${item.planningUnit} (${item.setting})`,
      ],
      [
        'Sub Centre / Session Site',
        `${item.subcentreName || '-'} · ${item.sessionSiteName || '-'}`,
        'Site Location / Session',
        `${item.sessionSiteLocation}${item.sessionSiteLocationOther ? ` (${item.sessionSiteLocationOther})` : ''} · ${item.sessionCode || '-'}`,
      ],
      [
        'Monitoring Reason(s)*',
        item.monitoringReasons.join(', ') +
          (item.monitoringReasonOther ? ` (${item.monitoringReasonOther})` : '') || '-',
        'Polio HRA Type',
        item.hraType || '-',
      ],
    ]
  );

  // Q1 - Q7
  page = drawSectionBanner(pages, page, item, 'प्र. १ ते ७: सत्र स्थिती, Due List व लस पुरवठा (Session & Mobilization)');
  page = drawSimpleTable(
    pages,
    page,
    item,
    ['प्र.', 'तपासणी मुद्दा', 'नोंदवलेले उत्तर'],
    [0.5, 3.2, 2.5],
    [
      ['1a', 'Is session held? (सत्र सुरू आहे का?)', item.isSessionHeld],
      [
        '1b',
        'If session is not held, reason',
        item.isSessionHeld === 'No'
          ? `${item.sessionNotHeldReason || '-'}${
              item.sessionNotHeldReasonOther ? ` (${item.sessionNotHeldReasonOther})` : ''
            }`
          : 'लागू नाही (सत्र सुरू आहे)',
      ],
      ['2', 'Is due list available with the ANM?', item.dueListAvailable || '-'],
      ['3*', 'Is any mobilizer assigned to the session site?', item.mobilizersAssigned.join(', ') || '-'],
      ['4', 'If due list available, is it with the mobiliser?', item.dueListWithMobiliser || '-'],
      ['5', 'Is mobilizer mobilizing the children to session site?', item.mobilizerMobilizing || '-'],
      ['6', 'Is any polio HRA tagged to this site?', item.polioHraTagged || '-'],
      [
        '7',
        'Who delivered vaccine / logistics to the site? (लस वाहतूक कोणी केली व नाव)',
        `${item.vaccineDeliveredBy || '-'}${
          item.vaccineCarrierName ? ` · नाव: ${item.vaccineCarrierName}` : ''
        }`,
      ],
    ]
  );

  // Q8 Vaccines (including PCV & IPV, without JE Diluent)
  page = drawSectionBanner(
    pages,
    page,
    item,
    'प्र. ८*: लस / डायल्युएंट उपलब्धता व Open Vial (PCV, IPV समाविष्ट · JE विना-डायल्युएंट)'
  );
  page = drawSimpleTable(
    pages,
    page,
    item,
    ['अ.क्र.', 'Vaccine / Diluent', 'Availability Status', 'Any Open Vial Re-issued?'],
    [0.5, 2.8, 1.5, 1.4],
    RI_VACCINE_ITEMS.map((v, idx) => {
      const e = item.vaccines?.[v.code];
      return [
        String(formatNumberIN(idx + 1)),
        `${v.label} (${v.sublabel})`,
        e?.availability || '-',
        v.supportsOpenVial ? e?.openVialReissued || '-' : 'N/A',
      ];
    })
  );

  // Q9 Logistics
  page = drawSectionBanner(pages, page, item, 'प्र. ९*: लॉजिस्टिक्स उपलब्धता (Logistics at Session Site)');
  page = drawSimpleTable(
    pages,
    page,
    item,
    ['अ.क्र.', 'Logistic Item', 'Availability Status'],
    [0.5, 3.6, 2.1],
    RI_LOGISTIC_ITEMS.map((l, idx) => [
      String(formatNumberIN(idx + 1)),
      `${l.label} (${l.sublabel})`,
      item.logistics?.[l.code] || '-',
    ])
  );

  // Q10-Q22
  page = drawSectionBanner(
    pages,
    page,
    item,
    'प्र. १० ते २२: सुरक्षित इंजेक्शन, ४ संदेश, पालक संवाद व PHC पडताळणी'
  );
  page = drawSimpleTable(
    pages,
    page,
    item,
    ['प्र.', 'तपासणी मुद्दा', 'नोंदवलेले उत्तर'],
    [0.5, 3.2, 2.5],
    [
      [
        '10',
        'Is ANM cutting each syringe with hub cutter just after use?',
        `${item.cuttingWithHubCutter || '-'}${
          item.cuttingWithHubCutter === 'No' && item.hubCutterNoReason
            ? ` (${item.hubCutterNoReason})`
            : ''
        }`,
      ],
      ['11', 'Is ANM marking ALL vials with date/time before first use?', item.markingVialsDateTime || '-'],
      [
        '12*',
        'Is any reconstituted vial in use after specified time has lapsed? (JE comes without diluent)',
        item.reconstitutedVialAfterLapsed.join(', ') || '-',
      ],
      ['13', 'Is ANM delivering all 4 Key Messages to caregivers?', item.delivering4KeyMessages || '-'],
      ['14', 'Is ANM advising caregivers to wait for 30 mins?', item.advisingWait30Mins || '-'],
      [
        '15*',
        'Who has mobilized you to this session site? (3 Caregivers)',
        item.caregiverInterviewNotObserved
          ? 'Not Observed'
          : `C1: ${item.caregiver1Mobilizer.join('/') || '-'} | C2: ${
              item.caregiver2Mobilizer.join('/') || '-'
            } | C3: ${item.caregiver3Mobilizer.join('/') || '-'}`,
      ],
      ['16', 'At which minimum age will ANM give 2nd Measles/MR dose?', item.minAge2ndMeasles || '-'],
      ['17', 'Is the MCTS / RCH register maintained?', item.mctsRegisterMaintained || '-'],
      [
        '18',
        'Has any supervisor visited this session today?',
        item.supervisorVisitedToday === 'Others' && item.supervisorVisitedOther
          ? `Others (${item.supervisorVisitedOther})`
          : item.supervisorVisitedToday || '-',
      ],
      ['19', 'Has ASHA received payment for previous RI Session?', item.ashaPaymentPreviousSession || '-'],
      [
        '20',
        'ASHA payment for FI and CI upto last month',
        `For FI: ${item.ashaPaymentFI || '-'} · For CI: ${item.ashaPaymentCI || '-'}`,
      ],
      [
        '21',
        'Why Vaccine or logistic has not been available (PHC)',
        item.vaccineNotAvailableReason
          ? `${item.vaccineNotAvailableReason}${
              item.vaccineNotAvailableOther ? ` (${item.vaccineNotAvailableOther})` : ''
            }`
          : '-',
      ],
      [
        '22',
        'Why ANM has been absent (PHC)',
        item.anmAbsentReason
          ? `${item.anmAbsentReason}${item.anmAbsentOther ? ` (${item.anmAbsentOther})` : ''}`
          : '-',
      ],
      ['शेरा', 'Monitor Remarks', item.remarks || '-'],
    ]
  );

  // Footer on all pages
  const totalPages = pages.length;
  const generatedIST = formatDateTimeIST(new Date().toISOString());
  pages.forEach((p, idx) => {
    p.ctx.font = `400 8px ${FONT_FAMILY}`;
    p.ctx.fillStyle = '#64748b';
    p.ctx.textAlign = 'left';
    p.ctx.fillText(
      `PHC Bhada · Routine Immunization Monitoring · Generated: ${generatedIST} IST`,
      MARGIN_X,
      p.logicalH - 16
    );
    p.ctx.textAlign = 'right';
    p.ctx.fillText(
      `Page ${formatNumberIN(idx + 1)} / ${formatNumberIN(totalPages)}`,
      p.logicalW - MARGIN_X,
      p.logicalH - 16
    );
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  pages.forEach((p, idx) => {
    if (idx > 0) pdf.addPage('a4', 'portrait');
    const dataUrl = p.canvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, A4_PORTRAIT.widthPt, A4_PORTRAIT.heightPt, undefined, 'FAST');
  });

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RI_Monitoring_Checklist_${item.checklistCode}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
