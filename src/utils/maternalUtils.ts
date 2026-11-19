import { MaternalServiceConfigItem, MaternalServiceRecord, SystemSettings } from '../types';
import { addAgeToDate, diffDaysISO } from './dateUtils';

export const CASTE_CATEGORIES = [
  'सर्वसाधारण (Open)',
  'इतर मागासवर्गीय (OBC)',
  'अनुसूचित जाती (SC)',
  'अनुसूचित जमाती (ST)',
  'विमुक्त जाती / भटक्या जमाती (VJNT/NT)',
  'विशेष मागास प्रवर्ग (SBC)',
  'इतर',
] as const;

export const EVERY_VISIT_ANC_CODES = [
  'ANC_EXAM',
  'BP',
  'WEIGHT',
  'HEIGHT',
  'HB',
  'BSL',
  'BLOOD_URINE',
] as const;

export const VITAL_METRIC_DEFS = [
  { code: 'WEIGHT', label: 'वजन (Weight)', shortLabel: 'वजन', unit: 'kg', numeric: true, placeholder: 'उदा. 54.5' },
  { code: 'HEIGHT', label: 'उंची (Height)', shortLabel: 'उंची', unit: 'cm', numeric: true, placeholder: 'उदा. 154' },
  { code: 'HB', label: 'हिमोग्लोबिन (Hb)', shortLabel: 'Hb', unit: 'g/dL', numeric: true, placeholder: 'उदा. 11.2' },
  { code: 'BP', label: 'रक्तदाब (BP)', shortLabel: 'BP', unit: 'mmHg', numeric: false, placeholder: 'उदा. 120/80' },
  { code: 'BSL', label: 'रक्त साखर (BSL)', shortLabel: 'BSL', unit: 'mg/dL', numeric: true, placeholder: 'उदा. 98' },
] as const;

export const DEFAULT_MATERNAL_SERVICES: MaternalServiceConfigItem[] = [
  {
    serviceCode: 'ANC_EXAM',
    serviceName: 'ANC तपासणी (ANC Examination)',
    inputType: 'TEXT',
    unit: '',
    repeatEveryVisit: true,
    displayOrder: 1,
    isActive: true,
  },
  {
    serviceCode: 'BP',
    serviceName: 'रक्तदाब तपासणी (BP Measurement)',
    inputType: 'TEXT',
    unit: 'mmHg',
    repeatEveryVisit: true,
    displayOrder: 2,
    isActive: true,
  },
  {
    serviceCode: 'WEIGHT',
    serviceName: 'वजन नोंदणी (Weight Measurement)',
    inputType: 'NUMBER',
    unit: 'kg',
    repeatEveryVisit: true,
    displayOrder: 3,
    isActive: true,
  },
  {
    serviceCode: 'HEIGHT',
    serviceName: 'उंची नोंदणी (Height Measurement)',
    inputType: 'NUMBER',
    unit: 'cm',
    repeatEveryVisit: true,
    displayOrder: 4,
    isActive: true,
  },
  {
    serviceCode: 'HB',
    serviceName: 'हिमोग्लोबिन तपासणी (Hb Examination)',
    inputType: 'NUMBER',
    unit: 'g/dL',
    repeatEveryVisit: true,
    displayOrder: 5,
    isActive: true,
  },
  {
    serviceCode: 'BSL',
    serviceName: 'रक्त साखर तपासणी (BSL)',
    inputType: 'NUMBER',
    unit: 'mg/dL',
    repeatEveryVisit: true,
    displayOrder: 6,
    isActive: true,
  },
  {
    serviceCode: 'BLOOD_URINE',
    serviceName: 'रक्त व लघवी तपासणी (Blood & Urine Tests)',
    inputType: 'TEXT',
    unit: '',
    repeatEveryVisit: true,
    displayOrder: 7,
    isActive: true,
  },
  {
    serviceCode: 'TD_1',
    serviceName: 'Td-1 लसीकरण',
    inputType: 'TEXT',
    unit: '',
    requiresBatchNumber: true,
    repeatEveryVisit: false,
    displayOrder: 8,
    isActive: true,
  },
  {
    serviceCode: 'TD_2',
    serviceName: 'Td-2 लसीकरण',
    inputType: 'TEXT',
    unit: '',
    requiresBatchNumber: true,
    repeatEveryVisit: false,
    displayOrder: 9,
    isActive: true,
  },
  {
    serviceCode: 'TD_BOOSTER',
    serviceName: 'Td-Booster लसीकरण',
    inputType: 'TEXT',
    unit: '',
    requiresBatchNumber: true,
    repeatEveryVisit: false,
    displayOrder: 10,
    isActive: true,
  },
  {
    serviceCode: 'IFA',
    serviceName: 'IFA गोळ्या वितरण',
    inputType: 'NUMBER',
    unit: 'गोळ्या',
    repeatEveryVisit: false,
    displayOrder: 11,
    isActive: true,
  },
  {
    serviceCode: 'CALCIUM',
    serviceName: 'कॅल्शियम गोळ्या वितरण',
    inputType: 'NUMBER',
    unit: 'गोळ्या',
    repeatEveryVisit: false,
    displayOrder: 12,
    isActive: true,
  },
];

export function isEveryVisitAncService(item: Pick<MaternalServiceConfigItem, 'serviceCode' | 'repeatEveryVisit'>): boolean {
  if (typeof item.repeatEveryVisit === 'boolean') return item.repeatEveryVisit;
  return (EVERY_VISIT_ANC_CODES as readonly string[]).includes(item.serviceCode);
}

/**
 * Parses administrator-configured ANC/maternal services from systemSettings,
 * falling back cleanly to DEFAULT_MATERNAL_SERVICES and ensuring HEIGHT & BSL remain available.
 */
export function getMaternalServiceCatalog(
  settings?: SystemSettings | null
): MaternalServiceConfigItem[] {
  if (!settings?.maternalServiceCatalogJson) {
    return DEFAULT_MATERNAL_SERVICES;
  }
  try {
    const parsed = JSON.parse(settings.maternalServiceCatalogJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const configured: MaternalServiceConfigItem[] = (parsed as MaternalServiceConfigItem[]).map((item) => ({
        ...item,
        repeatEveryVisit: isEveryVisitAncService(item),
      }));
      const existingCodes = new Set(configured.map((c) => c.serviceCode));
      for (const fallback of DEFAULT_MATERNAL_SERVICES) {
        if ((fallback.serviceCode === 'HEIGHT' || fallback.serviceCode === 'BSL') && !existingCodes.has(fallback.serviceCode)) {
          configured.push(fallback);
        }
      }
      return configured.sort((a, b) => a.displayOrder - b.displayOrder);
    }
  } catch {
    // Fallback to defaults if JSON is malformed
  }
  return DEFAULT_MATERNAL_SERVICES;
}

export interface MaternalVisitSummaryRow {
  visitKey: string;
  visitDate: string;
  sessionId: string;
  subcentreId: string;
  villageId: string;
  episodeCode: string;
  ancExam: string;
  bp: string;
  weight: string;
  height: string;
  hb: string;
  bsl: string;
  bloodUrine: string;
  tdDoses: string;
  supplements: string;
  otherServices: string;
  staffNames: string;
}

/**
 * Groups MaternalServiceRecord items by (visitDate + sessionId + episodeCode) so staff can inspect
 * every previous visit side-by-side (Weight, Height, Hb, BP, BSL, ANC Exam, Blood/Urine, Td, IFA/Calcium).
 */
export function groupMaternalVisitsByDate(
  records: MaternalServiceRecord[]
): MaternalVisitSummaryRow[] {
  const byVisit = new Map<string, MaternalServiceRecord[]>();
  for (const r of records) {
    const visitDate = r.visitDate || r.sessionDate || '';
    const key = `${visitDate}__${r.sessionId || ''}__${r.episodeCode || ''}`;
    const arr = byVisit.get(key) || [];
    arr.push(r);
    byVisit.set(key, arr);
  }

  const rows: MaternalVisitSummaryRow[] = [];
  for (const [visitKey, items] of byVisit.entries()) {
    const first = items[0];
    const findVal = (code: string) => {
      const match = items.find((i) => i.serviceCode === code);
      return match ? match.serviceValue || 'पूर्ण' : '-';
    };
    const tdList = items
      .filter((i) => i.serviceCode.startsWith('TD_'))
      .map(
        (i) =>
          `${i.serviceName.replace(' लसीकरण', '')}${i.batchNumber ? ` (${i.batchNumber})` : ''}`
      );
    const suppList = items
      .filter((i) => i.serviceCode === 'IFA' || i.serviceCode === 'CALCIUM')
      .map((i) => `${i.serviceCode}: ${i.serviceValue || 'दिले'}`);

    const standardCodes = new Set([
      'ANC_EXAM',
      'BP',
      'WEIGHT',
      'HEIGHT',
      'HB',
      'BSL',
      'BLOOD_URINE',
      'TD_1',
      'TD_2',
      'TD_BOOSTER',
      'IFA',
      'CALCIUM',
    ]);
    const otherList = items
      .filter((i) => !standardCodes.has(i.serviceCode))
      .map((i) => `${i.serviceName}${i.serviceValue ? `: ${i.serviceValue}` : ''}`);

    rows.push({
      visitKey,
      visitDate: first.visitDate || first.sessionDate,
      sessionId: first.sessionId,
      subcentreId: first.subcentreId,
      villageId: first.villageId,
      episodeCode: first.episodeCode || '-',
      ancExam: findVal('ANC_EXAM'),
      bp: findVal('BP'),
      weight: findVal('WEIGHT'),
      height: findVal('HEIGHT'),
      hb: findVal('HB'),
      bsl: findVal('BSL'),
      bloodUrine: findVal('BLOOD_URINE'),
      tdDoses: tdList.length > 0 ? tdList.join(', ') : '-',
      supplements: suppList.length > 0 ? suppList.join(', ') : '-',
      otherServices: otherList.length > 0 ? otherList.join(', ') : '-',
      staffNames: Array.from(new Set(items.map((i) => i.staffName).filter(Boolean))).join(', ') || '-',
    });
  }

  return rows.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
}

export interface VitalComparisonItem {
  code: string;
  label: string;
  shortLabel: string;
  unit: string;
  latestValue: string;
  latestDate: string;
  previousValue: string;
  previousDate: string;
  deltaText: string;
  trend: 'up' | 'down' | 'same' | 'none';
}

function parseNumericMeasure(val?: string): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[^\d.-]/g, ' ').trim().split(/\s+/)[0];
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function buildVitalsComparisonSummary(records: MaternalServiceRecord[]): VitalComparisonItem[] {
  const sortedDesc = records
    .slice()
    .sort(
      (a, b) =>
        (b.visitDate || b.sessionDate || '').localeCompare(a.visitDate || a.sessionDate || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || '')
    );

  return VITAL_METRIC_DEFS.map((def) => {
    const matches = sortedDesc.filter((r) => r.serviceCode === def.code && r.serviceValue?.trim());
    const latest = matches[0];
    const previous = matches[1];
    let deltaText = '';
    let trend: VitalComparisonItem['trend'] = 'none';

    if (latest && previous && def.numeric) {
      const a = parseNumericMeasure(latest.serviceValue);
      const b = parseNumericMeasure(previous.serviceValue);
      if (a !== null && b !== null) {
        const diff = Math.round((a - b) * 10) / 10;
        if (diff > 0) {
          trend = 'up';
          deltaText = `+${diff} ${def.unit} वाढ`;
        } else if (diff < 0) {
          trend = 'down';
          deltaText = `${diff} ${def.unit} घट`;
        } else {
          trend = 'same';
          deltaText = 'स्थिर';
        }
      }
    }

    return {
      code: def.code,
      label: def.label,
      shortLabel: def.shortLabel,
      unit: def.unit,
      latestValue: latest?.serviceValue || '',
      latestDate: latest ? latest.visitDate || latest.sessionDate : '',
      previousValue: previous?.serviceValue || '',
      previousDate: previous ? previous.visitDate || previous.sessionDate : '',
      deltaText,
      trend,
    };
  });
}

/**
 * Computes EDD = MC Date + 280 days (standard 40-week gestational rule).
 */
export function calculateEddFromMcDate(mcDateISO: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mcDateISO)) return '';
  return addAgeToDate(mcDateISO, 280, 'DAYS');
}

/**
 * Computes gestational age (weeks + days) on a given reference date.
 */
export function calculateGestationalAgeLabel(mcDateISO: string, asOfISO: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mcDateISO) || !/^\d{4}-\d{2}-\d{2}$/.test(asOfISO)) {
    return '-';
  }
  const days = diffDaysISO(mcDateISO, asOfISO);
  if (days < 0) return '-';
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  return `${weeks} आठवडे ${remDays} दिवस`;
}

export function formatDeliveryFacilityTypeMarathi(type?: string): string {
  if (type === 'Government') return 'शासकीय (Government)';
  if (type === 'Private') return 'खाजगी (Private)';
  if (type === 'Other') return 'इतर (Other)';
  return type || '-';
}

// ==================== EXPANDED MATERNAL LIFECYCLE DOMAIN UTILITIES ====================

export const BLOOD_GROUPS = ['A', 'B', 'AB', 'O', 'माहित नाही'] as const;
export const RH_FACTORS = ['Positive (+)', 'Negative (-)', 'माहित नाही'] as const;

export const HRP_REASON_OPTIONS = [
  'Anaemia / Severe Anaemia',
  'High BP',
  'Pre-eclampsia',
  'Gestational Diabetes',
  'Previous Caesarean Section',
  'Previous Bad Obstetric History',
  'Multiple Pregnancy',
  'Rh Negative',
  'इतर वैद्यकीय कारणे',
] as const;

export const PLANNED_DELIVERY_PLACES = [
  'प्राथमिक आरोग्य केंद्र भादा (PHC Bhada)',
  'ग्रामीण रुग्णालय औसा (RH Ausa)',
  'जिल्हा रुग्णालय लातूर (DH Latur)',
  'उपकेंद्र (Subcentre)',
  'खाजगी रुग्णालय (Private Hospital)',
  'इतर (Other)',
] as const;

export const URINE_TEST_RESULTS = ['Negative / Nil', 'Trace', '+1', '+2', '+3', '+4', 'तपासलेले नाही'] as const;

export interface GestationalBreakdown {
  weeks: number;
  days: number;
  totalDays: number;
  label: string;
}

export function calculateGestationalWeeksAndDays(
  mcDateISO: string,
  asOfISO: string
): GestationalBreakdown {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mcDateISO) || !/^\d{4}-\d{2}-\d{2}$/.test(asOfISO)) {
    return { weeks: 0, days: 0, totalDays: -1, label: '-' };
  }
  const totalDays = diffDaysISO(mcDateISO, asOfISO);
  if (totalDays < 0) return { weeks: 0, days: 0, totalDays: -1, label: '-' };
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return {
    weeks,
    days,
    totalDays,
    label: `${weeks} आठवडे ${days} दिवस`,
  };
}

export function calculateWomanAgeFromDob(dobISO?: string, asOfISO?: string): string {
  if (!dobISO || !/^\d{4}-\d{2}-\d{2}$/.test(dobISO)) return '-';
  const ref = asOfISO && /^\d{4}-\d{2}-\d{2}$/.test(asOfISO) ? asOfISO : new Date().toISOString().slice(0, 10);
  const [by, bm, bd] = dobISO.split('-').map(Number);
  const [ay, am, ad] = ref.split('-').map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age -= 1;
  if (age < 0 || age > 110) return '-';
  return `${age} वर्षे`;
}

export function parseBpSystolicDiastolic(bpText?: string): { systolic: number | null; diastolic: number | null } {
  if (!bpText) return { systolic: null, diastolic: null };
  const m = bpText.match(/(\d{2,3})\s*[\/\\-]\s*(\d{2,3})/);
  if (!m) return { systolic: null, diastolic: null };
  const sys = Number(m[1]);
  const dia = Number(m[2]);
  return {
    systolic: Number.isFinite(sys) ? sys : null,
    diastolic: Number.isFinite(dia) ? dia : null,
  };
}

export function parseJsonArraySafe<T = string>(jsonStr?: string): T[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function formatGravidaSummary(params: {
  gravida?: number | null;
  para?: number | null;
  abortions?: number | null;
  livingChildren?: number | null;
  fallbackText?: string;
}): string {
  const parts: string[] = [];
  if (params.gravida !== null && params.gravida !== undefined) parts.push(`G${params.gravida}`);
  if (params.para !== null && params.para !== undefined) parts.push(`P${params.para}`);
  if (params.abortions !== null && params.abortions !== undefined) parts.push(`A${params.abortions}`);
  if (params.livingChildren !== null && params.livingChildren !== undefined) parts.push(`L${params.livingChildren}`);
  if (parts.length > 0) return parts.join(' ');
  return params.fallbackText || '-';
}

/**
 * Validates Td-1, Td-2, Td-Booster against duplicate administration and minimum interval schedule
 * within a single Pregnancy Episode.
 */
export function validateTdDoseForEpisode(params: {
  existingRecords: MaternalServiceRecord[];
  episodeId: string;
  serviceCode: 'TD_1' | 'TD_2' | 'TD_BOOSTER';
  visitDate: string;
}): { ok: boolean; error?: string; warning?: string } {
  const epRecords = params.existingRecords.filter(
    (r) => !params.episodeId || !r.pregnancyEpisodeId || r.pregnancyEpisodeId === params.episodeId
  );

  const already = epRecords.find((r) => r.serviceCode === params.serviceCode);
  if (already) {
    return {
      ok: false,
      error: `या गर्भधारणेमध्ये ${params.serviceCode.replace('_', '-')} डोस आधीच (${already.visitDate || already.sessionDate}) नोंदवला गेला आहे. डुप्लिकेट Td डोस नोंदवता येत नाही.`,
    };
  }

  if (params.serviceCode === 'TD_2') {
    const td1 = epRecords.find((r) => r.serviceCode === 'TD_1');
    if (!td1) {
      return {
        ok: false,
        error: 'Td-2 देण्यापूर्वी Td-1 डोस नोंदवलेला असणे आवश्यक आहे (किंवा प्रथम Td-1 निवडा).',
      };
    }
    const td1Date = td1.visitDate || td1.sessionDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(td1Date) && /^\d{4}-\d{2}-\d{2}$/.test(params.visitDate)) {
      const gap = diffDaysISO(td1Date, params.visitDate);
      if (gap < 28) {
        return {
          ok: false,
          error: `Td-1 (${td1Date}) व Td-2 (${params.visitDate}) यामध्ये किमान २८ दिवसांचे अंतर असणे आवश्यक आहे (सध्या ${gap} दिवस).`,
        };
      }
    }
  }

  if (params.serviceCode === 'TD_BOOSTER') {
    const td1 = epRecords.find((r) => r.serviceCode === 'TD_1');
    if (td1) {
      return {
        ok: true,
        warning: 'टीप: या गर्भधारणेमध्ये Td-1 आधीच नोंदवलेला आहे; आवश्यकता वैद्यकीय अधिकाऱ्यांशी तपासा.',
      };
    }
  }

  return { ok: true };
}

export interface AncComparisonCell {
  visitNumber: number;
  visitLabel: string;
  visitDate: string;
  gestationalAgeText: string;
  weightKg: string;
  bp: string;
  hb: string;
  bloodSugar: string;
  urineTest: string;
  medicines: string;
  doctorObservation: string;
  nextVisitDate: string;
  staffName: string;
  source: 'STRUCTURED' | 'SESSION_LEGACY' | 'NONE';
}

/**
 * Builds the standardized ANC-1, ANC-2, ANC-3, ANC-4 (+ Extra) comparison table rows
 * combining structured `ancVisits` and legacy session-level `maternalServiceRecords`.
 */
export function buildAncComparisonRows(params: {
  ancVisits: import('../types').AncVisitRecord[];
  legacyServiceRecords: MaternalServiceRecord[];
  episodeId?: string;
  mcDate?: string;
}): AncComparisonCell[] {
  const epAnc = params.ancVisits
    .filter((v) => !params.episodeId || v.pregnancyEpisodeId === params.episodeId)
    .slice()
    .sort((a, b) => a.visitNumber - b.visitNumber || a.visitDate.localeCompare(b.visitDate));

  const byVisitNum = new Map<number, AncComparisonCell>();
  for (const v of epAnc) {
    const urineParts = [
      v.urineAlbumin ? `Alb: ${v.urineAlbumin}` : '',
      v.urineSugar ? `Sug: ${v.urineSugar}` : '',
      v.bloodTests ? `रक्त: ${v.bloodTests}` : '',
    ].filter(Boolean);
    byVisitNum.set(v.visitNumber, {
      visitNumber: v.visitNumber,
      visitLabel: v.visitLabel || `ANC-${v.visitNumber}`,
      visitDate: v.visitDate,
      gestationalAgeText:
        v.gestationalAgeText && v.gestationalAgeText !== '-'
          ? v.gestationalAgeText
          : params.mcDate
            ? calculateGestationalWeeksAndDays(params.mcDate, v.visitDate).label
            : '-',
      weightKg: v.weightKg ? `${v.weightKg} kg` : '-',
      bp: v.bp || '-',
      hb: v.hb ? `${v.hb} g/dL` : '-',
      bloodSugar: v.bloodSugar ? `${v.bloodSugar} mg/dL` : '-',
      urineTest: urineParts.length > 0 ? urineParts.join(' · ') : v.otherTests || '-',
      medicines: v.treatmentAdvice || '-',
      doctorObservation: v.doctorObservation || '-',
      nextVisitDate: v.nextVisitDate || '-',
      staffName: v.staffName || '-',
      source: 'STRUCTURED',
    });
  }

  // Merge legacy session vitals chronologically into unfilled ANC slots if any
  const epLegacy = params.legacyServiceRecords.filter(
    (r) => !params.episodeId || !r.pregnancyEpisodeId || r.pregnancyEpisodeId === params.episodeId
  );
  const groupedLegacy = groupMaternalVisitsByDate(epLegacy)
    .filter(
      (g) =>
        g.ancExam !== '-' ||
        g.weight !== '-' ||
        g.bp !== '-' ||
        g.hb !== '-' ||
        g.bsl !== '-' ||
        g.bloodUrine !== '-'
    )
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate));

  let legacySlot = 1;
  for (const lg of groupedLegacy) {
    const alreadyMappedDate = Array.from(byVisitNum.values()).some((c) => c.visitDate === lg.visitDate);
    if (alreadyMappedDate) continue;
    while (byVisitNum.has(legacySlot)) legacySlot += 1;
    byVisitNum.set(legacySlot, {
      visitNumber: legacySlot,
      visitLabel: legacySlot <= 4 ? `ANC-${legacySlot}` : `Extra ANC-${legacySlot}`,
      visitDate: lg.visitDate,
      gestationalAgeText: params.mcDate
        ? calculateGestationalWeeksAndDays(params.mcDate, lg.visitDate).label
        : '-',
      weightKg: lg.weight,
      bp: lg.bp,
      hb: lg.hb,
      bloodSugar: lg.bsl,
      urineTest: lg.bloodUrine,
      medicines: lg.supplements !== '-' ? lg.supplements : lg.ancExam,
      doctorObservation: lg.ancExam !== '-' ? lg.ancExam : '-',
      nextVisitDate: '-',
      staffName: lg.staffNames,
      source: 'SESSION_LEGACY',
    });
    legacySlot += 1;
  }

  // Guarantee slots 1..4 always exist in the comparison table
  const maxNum = Math.max(4, ...Array.from(byVisitNum.keys()));
  const result: AncComparisonCell[] = [];
  for (let n = 1; n <= maxNum; n++) {
    const existing = byVisitNum.get(n);
    if (existing) {
      result.push(existing);
    } else if (n <= 4) {
      result.push({
        visitNumber: n,
        visitLabel: `ANC-${n}`,
        visitDate: '',
        gestationalAgeText: '-',
        weightKg: '-',
        bp: '-',
        hb: '-',
        bloodSugar: '-',
        urineTest: '-',
        medicines: '-',
        doctorObservation: '-',
        nextVisitDate: '-',
        staffName: '-',
        source: 'NONE',
      });
    }
  }
  return result;
}

export interface MaternalAlertItem {
  id: string;
  beneficiary: import('../types').Beneficiary;
  episode: import('../types').PregnancyEpisode | null;
  title: string;
  detailText: string;
  dueDate: string;
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
}

export interface MaternalDashboardAnalytics {
  totalPregnantWomen: number;
  activePregnancies: number;
  villageBreakdown: Array<{ villageId: string; villageName: string; subcentreName: string; count: number }>;
  subcentreBreakdown: Array<{ subcentreId: string; subcentreName: string; count: number }>;
  anc1Count: number;
  anc2Count: number;
  anc3Count: number;
  anc4Count: number;
  ancPendingCount: number;
  highRiskCount: number;
  referredCount: number;
  nearEddCount: number;
  deliveriesCompletedCount: number;
  pncPendingCount: number;
  alerts: {
    nextAncDue: MaternalAlertItem[];
    nearEdd: MaternalAlertItem[];
    pendingAnc: MaternalAlertItem[];
    pendingHrpFollowUp: MaternalAlertItem[];
    pendingReferralFollowUp: MaternalAlertItem[];
    pendingPnc: MaternalAlertItem[];
  };
}

export function computeMaternalDashboardMetricsAndAlerts(
  db: import('../types').SheetDatabase,
  filters: {
    fromDate?: string;
    toDate?: string;
    subcentreId?: string;
    villageId?: string;
    todayISO: string;
  }
): MaternalDashboardAnalytics {
  const { fromDate, toDate, subcentreId, villageId, todayISO } = filters;

  const pregnantWomen = db.beneficiaries.filter(
    (b) =>
      b.beneficiaryType === 'PREGNANT_WOMAN' &&
      (!subcentreId || b.subcentreId === subcentreId) &&
      (!villageId || b.villageId === villageId) &&
      (!fromDate || b.registrationDate >= fromDate) &&
      (!toDate || b.registrationDate <= toDate)
  );
  const benById = new Map(pregnantWomen.map((b) => [b.id, b]));
  const allBenById = new Map(db.beneficiaries.map((b) => [b.id, b]));

  const episodesInScope = db.pregnancyEpisodes.filter((ep) => {
    const ben = benById.get(ep.beneficiaryId) || allBenById.get(ep.beneficiaryId);
    if (!ben) return false;
    if (subcentreId && ben.subcentreId !== subcentreId) return false;
    if (villageId && ben.villageId !== villageId) return false;
    if (fromDate && ep.pregnancyRegistrationDate < fromDate) return false;
    if (toDate && ep.pregnancyRegistrationDate > toDate) return false;
    return true;
  });

  // Village & Subcentre breakdown of registered pregnant women
  const vilCountMap = new Map<string, { villageId: string; villageName: string; subcentreName: string; count: number }>();
  const scCountMap = new Map<string, { subcentreId: string; subcentreName: string; count: number }>();
  for (const w of pregnantWomen) {
    const prevV = vilCountMap.get(w.villageId);
    if (prevV) prevV.count += 1;
    else {
      vilCountMap.set(w.villageId, {
        villageId: w.villageId,
        villageName: w.villageName || '-',
        subcentreName: w.subcentreName || '-',
        count: 1,
      });
    }
    const prevS = scCountMap.get(w.subcentreId);
    if (prevS) prevS.count += 1;
    else {
      scCountMap.set(w.subcentreId, {
        subcentreId: w.subcentreId,
        subcentreName: w.subcentreName || '-',
        count: 1,
      });
    }
  }

  let anc1Count = 0;
  let anc2Count = 0;
  let anc3Count = 0;
  let anc4Count = 0;
  let ancPendingCount = 0;
  let highRiskCount = 0;
  let referredCount = 0;
  let nearEddCount = 0;
  let deliveriesCompletedCount = 0;
  let pncPendingCount = 0;

  const nextAncDue: MaternalAlertItem[] = [];
  const nearEdd: MaternalAlertItem[] = [];
  const pendingAnc: MaternalAlertItem[] = [];
  const pendingHrpFollowUp: MaternalAlertItem[] = [];
  const pendingReferralFollowUp: MaternalAlertItem[] = [];
  const pendingPnc: MaternalAlertItem[] = [];

  for (const ep of episodesInScope) {
    const ben = allBenById.get(ep.beneficiaryId);
    if (!ben) continue;

    const epAnc = db.ancVisits.filter((v) => v.pregnancyEpisodeId === ep.id);
    const epLegacy = db.maternalServiceRecords.filter(
      (r) => r.beneficiaryId === ben.id && (!r.pregnancyEpisodeId || r.pregnancyEpisodeId === ep.id)
    );
    const compRows = buildAncComparisonRows({
      ancVisits: epAnc,
      legacyServiceRecords: epLegacy,
      episodeId: ep.id,
      mcDate: ep.mcDate,
    });

    const hasAnc1 = compRows.some((r) => r.visitNumber === 1 && r.source !== 'NONE');
    const hasAnc2 = compRows.some((r) => r.visitNumber === 2 && r.source !== 'NONE');
    const hasAnc3 = compRows.some((r) => r.visitNumber === 3 && r.source !== 'NONE');
    const hasAnc4 = compRows.some((r) => r.visitNumber === 4 && r.source !== 'NONE');
    if (hasAnc1) anc1Count += 1;
    if (hasAnc2) anc2Count += 1;
    if (hasAnc3) anc3Count += 1;
    if (hasAnc4) anc4Count += 1;

    const completedVisits = compRows.filter((r) => r.source !== 'NONE').length;

    const deliv = db.deliveryRecords.find((d) => d.pregnancyEpisodeId === ep.id && d.isCompleted);
    const isDelivered = ep.pregnancyStatus === 'प्रसूती पूर्ण' || Boolean(deliv);
    if (isDelivered) {
      deliveriesCompletedCount += 1;
    }

    // Active pregnancy checks
    if (!isDelivered && ep.pregnancyStatus !== 'बंद') {
      const ga = calculateGestationalWeeksAndDays(ep.mcDate, todayISO);
      const expectedMinVisits =
        ga.weeks >= 36 ? 4 : ga.weeks >= 28 ? 3 : ga.weeks >= 20 ? 2 : ga.weeks >= 12 ? 1 : 0;

      // Next scheduled ANC visit due within 7 days
      const latestWithNext = epAnc
        .filter((v) => v.nextVisitDate)
        .sort((a, b) => b.visitDate.localeCompare(a.visitDate))[0];

      if (latestWithNext?.nextVisitDate) {
        const diff = diffDaysISO(todayISO, latestWithNext.nextVisitDate);
        if (diff >= 0 && diff <= 7) {
          nextAncDue.push({
            id: `next_anc_${ep.id}`,
            beneficiary: ben,
            episode: ep,
            title: `${ben.childName} (${ep.episodeCode})`,
            detailText: `पुढील ANC भेट ${diff === 0 ? 'आज आहे' : `${diff} दिवसांत`} (${latestWithNext.nextVisitDate})`,
            dueDate: latestWithNext.nextVisitDate,
            severity: diff <= 2 ? 'MEDIUM' : 'INFO',
          });
        } else if (diff < 0) {
          ancPendingCount += 1;
          pendingAnc.push({
            id: `pend_anc_${ep.id}`,
            beneficiary: ben,
            episode: ep,
            title: `${ben.childName} (${ep.episodeCode})`,
            detailText: `ANC भेट ${Math.abs(diff)} दिवस प्रलंबित आहे (अपेक्षित: ${latestWithNext.nextVisitDate})`,
            dueDate: latestWithNext.nextVisitDate,
            severity: 'HIGH',
          });
        }
      } else if (expectedMinVisits > completedVisits) {
        ancPendingCount += 1;
        pendingAnc.push({
          id: `pend_ga_${ep.id}`,
          beneficiary: ben,
          episode: ep,
          title: `${ben.childName} (${ep.episodeCode})`,
          detailText: `${ga.label} पूर्ण — किमान ANC-${expectedMinVisits} तपासणी अद्याप प्रलंबित (${completedVisits} पूर्ण)`,
          dueDate: todayISO,
          severity: 'MEDIUM',
        });
      }

      // Near EDD alert (<= 30 days ahead or overdue)
      if (/^\d{4}-\d{2}-\d{2}$/.test(ep.eddDate)) {
        const eddDiff = diffDaysISO(todayISO, ep.eddDate);
        if (eddDiff <= 30) {
          nearEddCount += 1;
          nearEdd.push({
            id: `edd_${ep.id}`,
            beneficiary: ben,
            episode: ep,
            title: `${ben.childName} (${ep.episodeCode})`,
            detailText:
              eddDiff < 0
                ? `EDD दिनांक ${Math.abs(eddDiff)} दिवसांपूर्वी उलटली आहे — प्रसूती नोंद तपासा`
                : eddDiff === 0
                  ? `EDD दिनांक आज आहे!`
                  : `प्रसूतीस ${eddDiff} दिवस शिल्लक (नियोजित: ${ep.expectedDeliveryPlace || '-'})`,
            dueDate: ep.eddDate,
            severity: eddDiff <= 7 ? 'HIGH' : 'MEDIUM',
          });
        }
      }
    }

    // High Risk checks
    const epHrps = db.highRiskRecords.filter((h) => h.pregnancyEpisodeId === ep.id);
    const latestHrp = epHrps[0];
    const isHrp = latestHrp ? latestHrp.isHighRisk === 'YES' : Boolean(ep.isHighRisk);
    if (isHrp) {
      highRiskCount += 1;
      const reasons = parseJsonArraySafe<string>(latestHrp?.reasonsJson || ep.highRiskReasonsJson);
      if (!isDelivered && latestHrp && latestHrp.followUpStatus !== 'पूर्ण') {
        const fDiff = latestHrp.followUpDate ? diffDaysISO(todayISO, latestHrp.followUpDate) : 0;
        if (!latestHrp.followUpDate || fDiff <= 7) {
          pendingHrpFollowUp.push({
            id: `hrp_fu_${ep.id}`,
            beneficiary: ben,
            episode: ep,
            title: `${ben.childName} (${ep.episodeCode})`,
            detailText: `HRP कारणे: ${reasons.join(', ') || 'तपशील पहा'}${
              latestHrp.followUpDate ? ` · पाठपुरावा: ${latestHrp.followUpDate}` : ' · पाठपुरावा प्रलंबित'
            }`,
            dueDate: latestHrp.followUpDate || todayISO,
            severity: 'HIGH',
          });
        }
      }
    }

    // Referral checks
    const epRefs = db.maternalReferrals.filter((r) => r.pregnancyEpisodeId === ep.id);
    if (epRefs.length > 0 || ep.pregnancyStatus === 'संदर्भित') {
      referredCount += 1;
    }
    for (const ref of epRefs) {
      if (ref.followUpStatus === 'प्रलंबित') {
        pendingReferralFollowUp.push({
          id: `ref_fu_${ref.id}`,
          beneficiary: ben,
          episode: ep,
          title: `${ben.childName} (${ep.episodeCode})`,
          detailText: `संदर्भित रुग्णालय: ${ref.referredToHospital} · कारण: ${ref.referralReason}`,
          dueDate: ref.followUpDate || ref.referralDate,
          severity: 'HIGH',
        });
      }
    }

    // PNC pending checks for delivered mothers
    if (isDelivered) {
      const epPncs = db.pncRecords.filter((p) => p.pregnancyEpisodeId === ep.id);
      const hasPnc1 = epPncs.some((p) => p.visitNumber === 1);
      const hasPnc2 = epPncs.some((p) => p.visitNumber === 2);
      if (!hasPnc1 || !hasPnc2) {
        pncPendingCount += 1;
        const delivDate = deliv?.actualDeliveryDate || ep.outcomeDate || todayISO;
        pendingPnc.push({
          id: `pnc_${ep.id}`,
          beneficiary: ben,
          episode: ep,
          title: `${ben.childName} (${ep.episodeCode})`,
          detailText: !hasPnc1
            ? `प्रसूती दि. ${delivDate} नंतर PNC-1 तपासणी प्रलंबित आहे`
            : `PNC-1 पूर्ण; PNC-2 तपासणी प्रलंबित आहे`,
          dueDate: delivDate,
          severity: !hasPnc1 ? 'HIGH' : 'MEDIUM',
        });
      }
    }
  }

  return {
    totalPregnantWomen: pregnantWomen.length,
    activePregnancies: episodesInScope.filter((e) => e.pregnancyStatus === 'सक्रिय').length,
    villageBreakdown: Array.from(vilCountMap.values()).sort((a, b) => b.count - a.count),
    subcentreBreakdown: Array.from(scCountMap.values()).sort((a, b) => b.count - a.count),
    anc1Count,
    anc2Count,
    anc3Count,
    anc4Count,
    ancPendingCount,
    highRiskCount,
    referredCount,
    nearEddCount,
    deliveriesCompletedCount,
    pncPendingCount,
    alerts: {
      nextAncDue: nextAncDue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      nearEdd: nearEdd.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      pendingAnc: pendingAnc.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      pendingHrpFollowUp: pendingHrpFollowUp.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      pendingReferralFollowUp: pendingReferralFollowUp.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      pendingPnc: pendingPnc.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    },
  };
}

