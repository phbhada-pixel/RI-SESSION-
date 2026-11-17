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
  'HB',
  'BLOOD_URINE',
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
    serviceCode: 'HB',
    serviceName: 'हिमोग्लोबिन तपासणी (Hb Examination)',
    inputType: 'NUMBER',
    unit: 'g/dL',
    repeatEveryVisit: true,
    displayOrder: 4,
    isActive: true,
  },
  {
    serviceCode: 'BLOOD_URINE',
    serviceName: 'रक्त व लघवी तपासणी (Blood & Urine Tests)',
    inputType: 'TEXT',
    unit: '',
    repeatEveryVisit: true,
    displayOrder: 5,
    isActive: true,
  },
  {
    serviceCode: 'TD_1',
    serviceName: 'Td-1 लसीकरण',
    inputType: 'TEXT',
    unit: '',
    requiresBatchNumber: true,
    repeatEveryVisit: false,
    displayOrder: 6,
    isActive: true,
  },
  {
    serviceCode: 'TD_2',
    serviceName: 'Td-2 लसीकरण',
    inputType: 'TEXT',
    unit: '',
    requiresBatchNumber: true,
    repeatEveryVisit: false,
    displayOrder: 7,
    isActive: true,
  },
  {
    serviceCode: 'TD_BOOSTER',
    serviceName: 'Td-Booster लसीकरण',
    inputType: 'TEXT',
    unit: '',
    requiresBatchNumber: true,
    repeatEveryVisit: false,
    displayOrder: 8,
    isActive: true,
  },
  {
    serviceCode: 'IFA',
    serviceName: 'IFA गोळ्या वितरण',
    inputType: 'NUMBER',
    unit: 'गोळ्या',
    repeatEveryVisit: false,
    displayOrder: 9,
    isActive: true,
  },
  {
    serviceCode: 'CALCIUM',
    serviceName: 'कॅल्शियम गोळ्या वितरण',
    inputType: 'NUMBER',
    unit: 'गोळ्या',
    repeatEveryVisit: false,
    displayOrder: 10,
    isActive: true,
  },
];

export function isEveryVisitAncService(item: Pick<MaternalServiceConfigItem, 'serviceCode' | 'repeatEveryVisit'>): boolean {
  if (typeof item.repeatEveryVisit === 'boolean') return item.repeatEveryVisit;
  return (EVERY_VISIT_ANC_CODES as readonly string[]).includes(item.serviceCode);
}

/**
 * Parses administrator-configured ANC/maternal services from systemSettings,
 * falling back cleanly to DEFAULT_MATERNAL_SERVICES.
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
      return (parsed as MaternalServiceConfigItem[])
        .map((item) => ({
          ...item,
          repeatEveryVisit: isEveryVisitAncService(item),
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder);
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
  episodeCode: string;
  ancExam: string;
  bp: string;
  weight: string;
  hb: string;
  bloodUrine: string;
  tdDoses: string;
  supplements: string;
  otherServices: string;
  staffNames: string;
}

/**
 * Groups MaternalServiceRecord items by (visitDate + sessionId + episodeCode) so staff can inspect
 * every previous ANC visit side-by-side (BP, Weight, Hb, ANC Exam, Blood/Urine, Td, IFA/Calcium).
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
      'HB',
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
      episodeCode: first.episodeCode || '-',
      ancExam: findVal('ANC_EXAM'),
      bp: findVal('BP'),
      weight: findVal('WEIGHT'),
      hb: findVal('HB'),
      bloodUrine: findVal('BLOOD_URINE'),
      tdDoses: tdList.length > 0 ? tdList.join(', ') : '-',
      supplements: suppList.length > 0 ? suppList.join(', ') : '-',
      otherServices: otherList.length > 0 ? otherList.join(', ') : '-',
      staffNames: Array.from(new Set(items.map((i) => i.staffName).filter(Boolean))).join(', ') || '-',
    });
  }

  return rows.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
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
