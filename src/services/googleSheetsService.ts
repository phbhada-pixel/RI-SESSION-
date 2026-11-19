import {
  AncVisitRecord,
  AppUser,
  AuditLog,
  BabyRecord,
  Beneficiary,
  BeneficiaryType,
  DeliveryRecord,
  HighRiskRecord,
  MaternalReferralRecord,
  MaternalServiceRecord,
  PncRecord,
  PregnancyEpisode,
  RiChecklist,
  RiLogisticAvailability,
  RiVaccineStatusEntry,
  SessionBeneficiary,
  SheetDatabase,
  StaffMember,
  Subcentre,
  SystemSettings,
  VaccinationRecord,
  VaccinationSession,
  VaccineMaster,
  VaccineSchedule,
  Village,
} from '../types';
import { getInMemoryAccessToken } from '../config/firebase';
import { nowISO } from '../utils/dateUtils';
import { buildStandardNISData } from '../utils/nisSeedData';

export const CENTRAL_OWNER_EMAIL = 'phbhada@gmail.com';
export const DEFAULT_SPREADSHEET_TITLE = 'PHC Bhada - Digital Vaccination Management System';
export const LEGACY_SPREADSHEET_TITLE = 'PHC_Bhada_Vaccination_Database';

export const SHEET_TABS = [
  'users',
  'subcentres',
  'villages',
  'staff',
  'beneficiaries',
  'pregnancyEpisodes',
  'ancVisits',
  'highRiskRecords',
  'maternalReferrals',
  'deliveryRecords',
  'babyRecords',
  'pncRecords',
  'vaccinationSessions',
  'sessionBeneficiaries',
  'vaccineMaster',
  'vaccineSchedule',
  'vaccinationRecords',
  'maternalServiceRecords',
  'riChecklists',
  'auditLogs',
  'systemSettings',
] as const;

export type SheetTabName = (typeof SHEET_TABS)[number];

export const TAB_COLUMNS: Record<SheetTabName, string[]> = {
  users: ['id', 'name', 'email', 'mobile', 'role', 'subcentreId', 'subcentreName', 'isActive', 'createdAt'],
  subcentres: ['id', 'code', 'name', 'phcName', 'isActive', 'createdAt', 'updatedAt'],
  villages: ['id', 'villageCode', 'name', 'subcentreId', 'subcentreName', 'population', 'isActive', 'createdAt', 'updatedAt'],
  staff: ['id', 'name', 'designation', 'subcentreId', 'subcentreName', 'mobile', 'linkedUserEmail', 'isActive', 'createdAt', 'updatedAt'],
  beneficiaries: [
    'id',
    'beneficiaryCode',
    'childName',
    'motherName',
    'fatherName',
    'dob',
    'gender',
    'mobile',
    'address',
    'subcentreId',
    'subcentreName',
    'villageId',
    'villageName',
    'anganwadi',
    'registrationDate',
    'status',
    'dedupeKey',
    'createdBy',
    'createdAt',
    'updatedAt',
    'beneficiaryType',
    'guardianName',
    'aadhaarNumber',
    'caste',
    'category',
    'fullNameEnglish',
    'husbandMobile',
    'bloodGroup',
    'rhFactor',
    'plannedDeliveryPlace',
    'plannedHospitalName',
  ],
  pregnancyEpisodes: [
    'id',
    'episodeCode',
    'beneficiaryId',
    'beneficiaryCode',
    'mcDate',
    'eddDate',
    'expectedDeliveryPlace',
    'deliveryFacilityType',
    'hospitalName',
    'pregnancyRegistrationDate',
    'pregnancyStatus',
    'gravidaPara',
    'outcomeDate',
    'notes',
    'createdBy',
    'createdAt',
    'updatedAt',
    'gravida',
    'para',
    'abortions',
    'livingChildren',
    'previousPregnancyHistory',
    'previousCaesarean',
    'previousComplications',
    'bloodGroup',
    'rhFactor',
    'eddHistoryJson',
    'isHighRisk',
    'highRiskReasonsJson',
    'currentHrpStatus',
  ],
  ancVisits: [
    'id',
    'visitNumber',
    'visitLabel',
    'beneficiaryId',
    'beneficiaryCode',
    'pregnancyEpisodeId',
    'episodeCode',
    'sessionId',
    'subcentreId',
    'subcentreName',
    'villageId',
    'villageName',
    'visitDate',
    'gestationalWeeks',
    'gestationalDays',
    'gestationalAgeText',
    'weightKg',
    'heightCm',
    'bp',
    'bpSystolic',
    'bpDiastolic',
    'hb',
    'bloodSugar',
    'urineAlbumin',
    'urineSugar',
    'bloodTests',
    'otherTests',
    'doctorObservation',
    'treatmentAdvice',
    'nextVisitDate',
    'staffId',
    'staffName',
    'staffDesignation',
    'remarks',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  highRiskRecords: [
    'id',
    'beneficiaryId',
    'beneficiaryCode',
    'pregnancyEpisodeId',
    'episodeCode',
    'isHighRisk',
    'identificationDate',
    'reasonsJson',
    'otherReasonText',
    'doctorAdvice',
    'treatmentInfo',
    'referralRequired',
    'referralDate',
    'referralHospital',
    'referralReason',
    'followUpDate',
    'followUpStatus',
    'currentStatus',
    'statusHistoryJson',
    'approvedByMO',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  maternalReferrals: [
    'id',
    'beneficiaryId',
    'beneficiaryCode',
    'pregnancyEpisodeId',
    'episodeCode',
    'highRiskRecordId',
    'referralDate',
    'referredFrom',
    'referredToHospital',
    'referralReason',
    'transportArrangement',
    'followUpDate',
    'followUpStatus',
    'outcomeNotes',
    'referredByStaff',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  deliveryRecords: [
    'id',
    'beneficiaryId',
    'beneficiaryCode',
    'pregnancyEpisodeId',
    'episodeCode',
    'plannedEddDate',
    'plannedDeliveryPlace',
    'plannedHospitalName',
    'deliveryPlanNotes',
    'referralRequiredBeforeDelivery',
    'actualDeliveryDate',
    'actualDeliveryPlace',
    'actualHospitalName',
    'deliveryType',
    'deliveryTypeOther',
    'numberOfBabies',
    'motherCondition',
    'deliveryComplications',
    'referralDetails',
    'attendedByStaff',
    'isCompleted',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  babyRecords: [
    'id',
    'babyCode',
    'motherBeneficiaryId',
    'motherBeneficiaryCode',
    'pregnancyEpisodeId',
    'episodeCode',
    'deliveryRecordId',
    'babyNumber',
    'babyName',
    'gender',
    'birthWeightGrams',
    'birthOutcome',
    'birthOutcomeOther',
    'babyCondition',
    'dob',
    'notes',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  pncRecords: [
    'id',
    'visitNumber',
    'visitLabel',
    'beneficiaryId',
    'beneficiaryCode',
    'pregnancyEpisodeId',
    'episodeCode',
    'deliveryRecordId',
    'pncDate',
    'motherBp',
    'motherHealthStatus',
    'bleedingStatus',
    'breastfeedingStatus',
    'babyWeightGrams',
    'babyHealthStatus',
    'breastfeedingCounselling',
    'treatmentGiven',
    'nextFollowUpDate',
    'staffId',
    'staffName',
    'remarks',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  vaccinationSessions: [
    'id',
    'sessionCode',
    'phcName',
    'subcentreId',
    'subcentreName',
    'villageId',
    'villageName',
    'sessionDate',
    'location',
    'sessionType',
    'choName',
    'anmName',
    'otherStaff',
    'status',
    'editDeadlineAt',
    'reopenedUntil',
    'reopenedBy',
    'reopenReason',
    'completedAt',
    'completedBy',
    'createdBy',
    'createdAt',
    'updatedAt',
    'sessionCategory',
  ],
  sessionBeneficiaries: [
    'id',
    'sessionId',
    'beneficiaryId',
    'beneficiaryCode',
    'childName',
    'dob',
    'gender',
    'subcentreId',
    'villageId',
    'addedBy',
    'addedAt',
    'enrollmentType',
    'remarks',
    'beneficiaryType',
    'pregnancyEpisodeId',
  ],
  vaccineMaster: [
    'id',
    'vaccineName',
    'shortCode',
    'applicableCategory',
    'requiresBatchNumber',
    'displayOrder',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
  vaccineSchedule: [
    'id',
    'vaccineId',
    'vaccineName',
    'doseName',
    'doseOrder',
    'previousDoseId',
    'minAgeValue',
    'minAgeUnit',
    'recommendedAgeValue',
    'recommendedAgeUnit',
    'maxAgeValue',
    'maxAgeUnit',
    'minIntervalDays',
    'recommendedDueRuleText',
    'isBooster',
    'boosterInfo',
    'applicableCategory',
    'isValidated',
    'validatedBy',
    'validatedAt',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
  vaccinationRecords: [
    'id',
    'beneficiaryId',
    'beneficiaryCode',
    'sessionId',
    'sessionDate',
    'subcentreId',
    'villageId',
    'vaccineId',
    'vaccineName',
    'scheduleId',
    'doseName',
    'administeredDate',
    'batchNumber',
    'staffId',
    'staffName',
    'remarks',
    'createdAt',
    'updatedAt',
  ],
  maternalServiceRecords: [
    'id',
    'sessionId',
    'sessionDate',
    'beneficiaryId',
    'beneficiaryCode',
    'pregnancyEpisodeId',
    'episodeCode',
    'subcentreId',
    'villageId',
    'visitDate',
    'serviceCode',
    'serviceName',
    'serviceValue',
    'batchNumber',
    'staffId',
    'staffName',
    'remarks',
    'createdAt',
    'updatedAt',
  ],
  riChecklists: [
    'id',
    'checklistCode',
    'sessionId',
    'sessionCode',
    'monitorName',
    'organization',
    'organizationOther',
    'designation',
    'monitoringDate',
    'state',
    'district',
    'blockUlb',
    'planningUnit',
    'setting',
    'subcentreId',
    'subcentreName',
    'villageId',
    'sessionSiteName',
    'monitoringReasons',
    'monitoringReasonOther',
    'hraType',
    'sessionSiteLocation',
    'sessionSiteLocationOther',
    'isSessionHeld',
    'sessionNotHeldReason',
    'sessionNotHeldReasonOther',
    'dueListAvailable',
    'mobilizersAssigned',
    'dueListWithMobiliser',
    'mobilizerMobilizing',
    'polioHraTagged',
    'vaccineDeliveredBy',
    'vaccines',
    'logistics',
    'cuttingWithHubCutter',
    'hubCutterNoReason',
    'markingVialsDateTime',
    'reconstitutedVialAfterLapsed',
    'delivering4KeyMessages',
    'advisingWait30Mins',
    'caregiverInterviewNotObserved',
    'caregiver1Mobilizer',
    'caregiver2Mobilizer',
    'caregiver3Mobilizer',
    'minAge2ndMeasles',
    'mctsRegisterMaintained',
    'supervisorVisitedToday',
    'supervisorVisitedOther',
    'ashaPaymentPreviousSession',
    'ashaPaymentFI',
    'ashaPaymentCI',
    'vaccineNotAvailableReason',
    'vaccineNotAvailableOther',
    'anmAbsentReason',
    'anmAbsentOther',
    'remarks',
    'createdBy',
    'createdAt',
    'updatedAt',
    'checklistStaffName',
    'vaccineCarrierName',
  ],
  auditLogs: [
    'id',
    'userId',
    'userName',
    'userRole',
    'action',
    'entityType',
    'recordId',
    'previousValue',
    'newValue',
    'reason',
    'createdAt',
  ],
  systemSettings: [
    'id',
    'phcName',
    'district',
    'state',
    'timezone',
    'allowEditDaysAfterSession',
    'updatedBy',
    'updatedAt',
    'maternalServiceCatalogJson',
  ],
};

function requireToken(): string {
  const token = getInMemoryAccessToken();
  if (!token) {
    throw new Error('प्रवेश सत्र उपलब्ध नाही किंवा कालबाह्य झाले आहे. कृपया पुन्हा लॉगिन करा.');
  }
  return token;
}

async function googleFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = requireToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    let msg = `डेटा सर्व्हर त्रुटी (${res.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      if (errText) msg = errText;
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function extractSpreadsheetIdFromInput(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  return trimmed;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function findAppSpreadsheet(): Promise<{
  id: string;
  name: string;
  webViewLink: string;
} | null> {
  const q = encodeURIComponent(
    `(name='${DEFAULT_SPREADSHEET_TITLE}' or name='${LEGACY_SPREADSHEET_TITLE}') and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc`;
  const data = await googleFetch<{ files?: Array<{ id: string; name: string; webViewLink?: string }> }>(url);
  const file = data.files?.[0];
  if (!file) return null;
  return {
    id: file.id,
    name: file.name,
    webViewLink: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
  };
}

export async function fetchServerNowISO(): Promise<string> {
  try {
    const res = await fetch('/api/server-time');
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const data = (await res.json()) as { nowISO?: string };
      if (data.nowISO) return data.nowISO;
    }
  } catch {
    // Fallback to client time only if server endpoint is unreachable
  }
  return new Date().toISOString();
}

export async function listAppSpreadsheets(): Promise<Array<{ id: string; name: string; webViewLink: string }>> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc`;
  const data = await googleFetch<{ files?: Array<{ id: string; name: string; webViewLink?: string }> }>(url);
  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
  }));
}

// Google Sheets API v4 SpreadsheetProperties.locale rejects 'en_IN'.
// 'en_GB' preserves DD/MM/YYYY date conventions while remaining universally supported;
// fallback candidates guarantee spreadsheet creation never fails due to locale validation.
const SHEETS_API_LOCALE_CANDIDATES: ReadonlyArray<string | undefined> = [
  'en_GB',
  'en',
  'en_US',
  undefined,
];

export async function createPhcSpreadsheet(
  title: string = DEFAULT_SPREADSHEET_TITLE,
  creator?: { name: string; email: string }
): Promise<{ id: string; name: string; webViewLink: string }> {
  type CreatedSheetResponse = {
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  };

  let created: CreatedSheetResponse | null = null;
  let lastLocaleError: unknown = null;

  for (const sheetLocale of SHEETS_API_LOCALE_CANDIDATES) {
    try {
      const properties: Record<string, string> = {
        title,
        timeZone: 'Asia/Kolkata',
      };
      if (sheetLocale) {
        properties.locale = sheetLocale;
      }

      created = await googleFetch<CreatedSheetResponse>(
        'https://sheets.googleapis.com/v4/spreadsheets',
        {
          method: 'POST',
          body: JSON.stringify({
            properties,
            sheets: SHEET_TABS.map((tab) => ({
              properties: {
                title: tab,
                gridProperties: { frozenRowCount: 1 },
              },
            })),
          }),
        }
      );
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('locale')) {
        lastLocaleError = err;
        continue;
      }
      throw err;
    }
  }

  if (!created) {
    throw lastLocaleError instanceof Error
      ? lastLocaleError
      : new Error('डेटाबेस तयार करताना त्रुटी आली.');
  }

  const ts = nowISO();
  const initialData: Array<{ range: string; values: (string | number | boolean)[][] }> = SHEET_TABS.map(
    (tab) => ({
      range: `'${tab}'!A1`,
      values: [TAB_COLUMNS[tab]],
    })
  );

  // Seed default systemSettings row
  initialData.push({
    range: `'systemSettings'!A2`,
    values: [
      objectToRow('systemSettings', {
        id: 'phc_bhada_config',
        phcName: 'प्राथमिक आरोग्य केंद्र भादा',
        district: 'लातूर',
        state: 'महाराष्ट्र',
        timezone: 'Asia/Kolkata',
        allowEditDaysAfterSession: 2,
        updatedBy: creator?.email || CENTRAL_OWNER_EMAIL,
        updatedAt: ts,
      }),
    ],
  });

  if (creator?.email) {
    initialData.push({
      range: `'users'!A2`,
      values: [
        objectToRow('users', {
          id: `usr_${creator.email.toLowerCase()}`,
          name: creator.name || creator.email.split('@')[0],
          email: creator.email.toLowerCase(),
          mobile: '',
          role: 'ADMIN',
          subcentreId: '',
          subcentreName: '',
          isActive: true,
          createdAt: ts,
        }),
      ],
    });
  }

  // Also pre-populate standard India NIS Vaccine Master & Schedule rows
  const { masters, schedules } = buildStandardNISData(creator?.email || CENTRAL_OWNER_EMAIL);
  initialData.push({
    range: `'vaccineMaster'!A2`,
    values: masters.map((m) => objectToRow('vaccineMaster', m as unknown as Record<string, unknown>)),
  });
  initialData.push({
    range: `'vaccineSchedule'!A2`,
    values: schedules.map((s) =>
      objectToRow('vaccineSchedule', s as unknown as Record<string, unknown>)
    ),
  });

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: initialData,
      }),
    }
  );

  // Format header rows cleanly across all created tabs
  const sheetIds = (created.sheets || [])
    .map((s) => s.properties?.sheetId)
    .filter((id): id is number => typeof id === 'number');

  if (sheetIds.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: sheetIds.map((sheetId) => ({
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.06, green: 0.46, blue: 0.43 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          })),
        }),
      }
    ).catch(() => undefined);
  }

  return {
    id: created.spreadsheetId,
    name: created.properties?.title || title,
    webViewLink:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
  };
}

export async function shareSpreadsheetWithAnyoneWriter(spreadsheetId: string): Promise<void> {
  await googleFetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'writer',
      type: 'anyone',
    }),
  });
}

export async function shareSpreadsheetWithEmail(
  spreadsheetId: string,
  email: string
): Promise<void> {
  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?sendNotificationEmail=false`,
    {
      method: 'POST',
      body: JSON.stringify({
        role: 'writer',
        type: 'user',
        emailAddress: email.trim().toLowerCase(),
      }),
    }
  );
}

export interface CentralSheetPointerResponse {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  ownerEmail: string;
  sharedWithAnyone: boolean;
  updatedAt: string | null;
}

export async function getCentralSheetPointer(): Promise<CentralSheetPointerResponse> {
  try {
    const res = await fetch('/api/central-sheet');
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) {
      return {
        spreadsheetId: null,
        spreadsheetUrl: null,
        ownerEmail: CENTRAL_OWNER_EMAIL,
        sharedWithAnyone: false,
        updatedAt: null,
      };
    }
    return (await res.json()) as CentralSheetPointerResponse;
  } catch {
    return {
      spreadsheetId: null,
      spreadsheetUrl: null,
      ownerEmail: CENTRAL_OWNER_EMAIL,
      sharedWithAnyone: false,
      updatedAt: null,
    };
  }
}

export async function registerCentralSheetPointer(
  spreadsheetId: string,
  spreadsheetUrl: string,
  sharedWithAnyone?: boolean
): Promise<CentralSheetPointerResponse> {
  const token = requireToken();
  const res = await fetch('/api/central-sheet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ spreadsheetId, spreadsheetUrl, sharedWithAnyone }),
  });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.includes('application/json')) {
    const err = ct.includes('application/json') ? await res.json().catch(() => ({})) : {};
    throw new Error(err.error || 'केंद्रीय डेटाबेस संदर्भ नोंदवताना त्रुटी आली.');
  }
  return (await res.json()) as CentralSheetPointerResponse;
}

export async function ensureSpreadsheetSchema(spreadsheetId: string): Promise<{
  title: string;
  url: string;
}> {
  const meta = await googleFetch<{
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetUrl,properties.title,sheets.properties(sheetId,title)`);

  const existingTitles = new Set(
    (meta.sheets || []).map((s) => s.properties?.title).filter(Boolean) as string[]
  );

  const missingTabs = SHEET_TABS.filter((t) => !existingTitles.has(t));
  if (missingTabs.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((t) => ({
            addSheet: {
              properties: {
                title: t,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          })),
        }),
      }
    );

    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: missingTabs.map((t) => ({
            range: `'${t}'!A1`,
            values: [TAB_COLUMNS[t]],
          })),
        }),
      }
    );
  }

  // Also ensure existing tabs have header rows if empty
  const headerRanges = SHEET_TABS.map((t) => `ranges=${encodeURIComponent(`'${t}'!1:1`)}`).join('&');
  const headerCheck = await googleFetch<{
    valueRanges?: Array<{ range: string; values?: string[][] }>;
  }>(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${headerRanges}`);

  const emptyHeaderUpdates: Array<{ range: string; values: string[][] }> = [];
  (headerCheck.valueRanges || []).forEach((vr, idx) => {
    const tab = SHEET_TABS[idx];
    const existingHeaders = vr.values?.[0] || [];
    const missingTrailingCols = TAB_COLUMNS[tab].some((col) => !existingHeaders.includes(col));
    if (existingHeaders.length === 0 || missingTrailingCols) {
      emptyHeaderUpdates.push({
        range: `'${tab}'!A1`,
        values: [
          existingHeaders.length === 0
            ? TAB_COLUMNS[tab]
            : [
                ...existingHeaders,
                ...TAB_COLUMNS[tab].filter((col) => !existingHeaders.includes(col)),
              ],
        ],
      });
    }
  });

  if (emptyHeaderUpdates.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: emptyHeaderUpdates,
        }),
      }
    );
  }

  return {
    title: meta.properties?.title || DEFAULT_SPREADSHEET_TITLE,
    url: meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'होय';
}

function parseNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseNullableNum(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseJsonObj(v: unknown): Record<string, unknown> | null {
  if (!v) return null;
  if (typeof v === 'object') return v as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(v));
    return typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonStringArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  try {
    const parsed = JSON.parse(String(v));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function objectToRow(tab: SheetTabName, obj: Record<string, unknown>): (string | number | boolean)[] {
  const cols = TAB_COLUMNS[tab];
  return cols.map((col) => {
    const val = obj[col];
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return val as string | number;
  });
}

function rowsToObjects(tab: SheetTabName, matrix: string[][] | undefined): Record<string, string>[] {
  if (!matrix || matrix.length <= 1) return [];
  const headerRow = matrix[0].map((h) => String(h).trim());
  const defaultCols = TAB_COLUMNS[tab];
  const cols = headerRow.length > 0 ? headerRow : defaultCols;

  const items: Record<string, string>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.every((cell) => String(cell ?? '').trim() === '')) continue;
    const obj: Record<string, string> = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx] !== undefined ? String(row[idx]) : '';
    });
    if (obj.id || Object.values(obj).some((v) => v.trim() !== '')) {
      items.push(obj);
    }
  }
  return items;
}

export async function loadEntireSheetDatabase(spreadsheetId: string): Promise<SheetDatabase> {
  const { title, url } = await ensureSpreadsheetSchema(spreadsheetId);
  const rangesParam = SHEET_TABS.map((t) => `ranges=${encodeURIComponent(`'${t}'!A:BZ`)}`).join('&');
  const data = await googleFetch<{
    valueRanges?: Array<{ range: string; values?: string[][] }>;
  }>(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesParam}`);

  const rawByTab: Record<SheetTabName, Record<string, string>[]> = {
    users: [],
    subcentres: [],
    villages: [],
    staff: [],
    beneficiaries: [],
    pregnancyEpisodes: [],
    ancVisits: [],
    highRiskRecords: [],
    maternalReferrals: [],
    deliveryRecords: [],
    babyRecords: [],
    pncRecords: [],
    vaccinationSessions: [],
    sessionBeneficiaries: [],
    vaccineMaster: [],
    vaccineSchedule: [],
    vaccinationRecords: [],
    maternalServiceRecords: [],
    riChecklists: [],
    auditLogs: [],
    systemSettings: [],
  };

  (data.valueRanges || []).forEach((vr, idx) => {
    const tab = SHEET_TABS[idx];
    rawByTab[tab] = rowsToObjects(tab, vr.values);
  });

  const users: AppUser[] = rawByTab.users.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email.toLowerCase(),
    mobile: r.mobile,
    role: (r.role || 'ANM') as AppUser['role'],
    subcentreId: r.subcentreId || '',
    subcentreName: r.subcentreName || '',
    isActive: r.isActive === '' ? true : parseBool(r.isActive),
    createdAt: r.createdAt,
  }));

  const subcentres: Subcentre[] = rawByTab.subcentres
    .map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      phcName: r.phcName || 'प्राथमिक आरोग्य केंद्र भादा',
      isActive: r.isActive === '' ? true : parseBool(r.isActive),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const villages: Village[] = rawByTab.villages
    .map((r) => ({
      id: r.id,
      villageCode: r.villageCode,
      name: r.name,
      subcentreId: r.subcentreId,
      subcentreName: r.subcentreName,
      population: parseNullableNum(r.population),
      isActive: r.isActive === '' ? true : parseBool(r.isActive),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const staff: StaffMember[] = rawByTab.staff
    .map((r) => ({
      id: r.id,
      name: r.name,
      designation: (r.designation || 'ANM') as StaffMember['designation'],
      subcentreId: r.subcentreId,
      subcentreName: r.subcentreName,
      mobile: r.mobile,
      linkedUserEmail: r.linkedUserEmail || '',
      isActive: r.isActive === '' ? true : parseBool(r.isActive),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const beneficiaries: Beneficiary[] = rawByTab.beneficiaries.map((r) => {
    const beneficiaryType: BeneficiaryType =
      r.beneficiaryType === 'PREGNANT_WOMAN' ? 'PREGNANT_WOMAN' : 'CHILD';
    return {
      id: r.id,
      beneficiaryCode: r.beneficiaryCode,
      beneficiaryType,
      childName: r.childName,
      fullNameEnglish: r.fullNameEnglish || '',
      motherName: r.motherName || '',
      fatherName: r.fatherName || '',
      guardianName: r.guardianName || r.fatherName || r.motherName || '',
      husbandMobile: r.husbandMobile || '',
      dob: r.dob || '',
      gender: (r.gender || (beneficiaryType === 'PREGNANT_WOMAN' ? 'स्त्री' : 'मुलगा')) as Beneficiary['gender'],
      mobile: r.mobile || '',
      aadhaarNumber: r.aadhaarNumber || '',
      caste: r.caste || '',
      category: r.category || '',
      bloodGroup: r.bloodGroup || '',
      rhFactor: r.rhFactor || '',
      plannedDeliveryPlace: r.plannedDeliveryPlace || '',
      plannedHospitalName: r.plannedHospitalName || '',
      address: r.address || '',
      subcentreId: r.subcentreId,
      subcentreName: r.subcentreName,
      villageId: r.villageId,
      villageName: r.villageName,
      anganwadi: r.anganwadi || '',
      registrationDate: r.registrationDate,
      status: (r.status || 'सक्रिय') as Beneficiary['status'],
      dedupeKey: r.dedupeKey,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });

  const pregnancyEpisodes: PregnancyEpisode[] = rawByTab.pregnancyEpisodes
    .map((r) => ({
      id: r.id,
      episodeCode: r.episodeCode,
      beneficiaryId: r.beneficiaryId,
      beneficiaryCode: r.beneficiaryCode,
      mcDate: r.mcDate || '',
      eddDate: r.eddDate || '',
      expectedDeliveryPlace: r.expectedDeliveryPlace || '',
      deliveryFacilityType: (r.deliveryFacilityType || 'Government') as PregnancyEpisode['deliveryFacilityType'],
      hospitalName: r.hospitalName || '',
      pregnancyRegistrationDate: r.pregnancyRegistrationDate || '',
      pregnancyStatus: (r.pregnancyStatus || 'सक्रिय') as PregnancyEpisode['pregnancyStatus'],
      gravidaPara: r.gravidaPara || '',
      gravida: parseNullableNum(r.gravida),
      para: parseNullableNum(r.para),
      abortions: parseNullableNum(r.abortions),
      livingChildren: parseNullableNum(r.livingChildren),
      previousPregnancyHistory: r.previousPregnancyHistory || '',
      previousCaesarean: (r.previousCaesarean || '') as PregnancyEpisode['previousCaesarean'],
      previousComplications: r.previousComplications || '',
      bloodGroup: r.bloodGroup || '',
      rhFactor: r.rhFactor || '',
      eddHistoryJson: r.eddHistoryJson || '',
      isHighRisk: parseBool(r.isHighRisk),
      highRiskReasonsJson: r.highRiskReasonsJson || '',
      currentHrpStatus: r.currentHrpStatus || '',
      outcomeDate: r.outcomeDate || '',
      notes: r.notes || '',
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => b.mcDate.localeCompare(a.mcDate) || b.createdAt.localeCompare(a.createdAt));

  const ancVisits: AncVisitRecord[] = rawByTab.ancVisits
    .map((r) => ({
      id: r.id,
      visitNumber: parseNum(r.visitNumber, 1),
      visitLabel: r.visitLabel || `ANC-${parseNum(r.visitNumber, 1)}`,
      beneficiaryId: r.beneficiaryId,
      beneficiaryCode: r.beneficiaryCode,
      pregnancyEpisodeId: r.pregnancyEpisodeId,
      episodeCode: r.episodeCode,
      sessionId: r.sessionId || '',
      subcentreId: r.subcentreId,
      subcentreName: r.subcentreName,
      villageId: r.villageId,
      villageName: r.villageName,
      visitDate: r.visitDate,
      gestationalWeeks: parseNum(r.gestationalWeeks, 0),
      gestationalDays: parseNum(r.gestationalDays, 0),
      gestationalAgeText: r.gestationalAgeText || '-',
      weightKg: r.weightKg || '',
      heightCm: r.heightCm || '',
      bp: r.bp || '',
      bpSystolic: parseNullableNum(r.bpSystolic),
      bpDiastolic: parseNullableNum(r.bpDiastolic),
      hb: r.hb || '',
      bloodSugar: r.bloodSugar || '',
      urineAlbumin: r.urineAlbumin || '',
      urineSugar: r.urineSugar || '',
      bloodTests: r.bloodTests || '',
      otherTests: r.otherTests || '',
      doctorObservation: r.doctorObservation || '',
      treatmentAdvice: r.treatmentAdvice || '',
      nextVisitDate: r.nextVisitDate || '',
      staffId: r.staffId,
      staffName: r.staffName,
      staffDesignation: r.staffDesignation || '',
      remarks: r.remarks || '',
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate) || a.visitNumber - b.visitNumber);

  const highRiskRecords: HighRiskRecord[] = rawByTab.highRiskRecords
    .map((r) => ({
      id: r.id,
      beneficiaryId: r.beneficiaryId,
      beneficiaryCode: r.beneficiaryCode,
      pregnancyEpisodeId: r.pregnancyEpisodeId,
      episodeCode: r.episodeCode,
      isHighRisk: (r.isHighRisk === 'YES' ? 'YES' : 'NO') as HighRiskRecord['isHighRisk'],
      identificationDate: r.identificationDate || '',
      reasonsJson: r.reasonsJson || '[]',
      otherReasonText: r.otherReasonText || '',
      doctorAdvice: r.doctorAdvice || '',
      treatmentInfo: r.treatmentInfo || '',
      referralRequired: (r.referralRequired || '') as HighRiskRecord['referralRequired'],
      referralDate: r.referralDate || '',
      referralHospital: r.referralHospital || '',
      referralReason: r.referralReason || '',
      followUpDate: r.followUpDate || '',
      followUpStatus: r.followUpStatus || '',
      currentStatus: r.currentStatus || '',
      statusHistoryJson: r.statusHistoryJson || '[]',
      approvedByMO: r.approvedByMO || '',
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const maternalReferrals: MaternalReferralRecord[] = rawByTab.maternalReferrals
    .map((r) => ({
      id: r.id,
      beneficiaryId: r.beneficiaryId,
      beneficiaryCode: r.beneficiaryCode,
      pregnancyEpisodeId: r.pregnancyEpisodeId,
      episodeCode: r.episodeCode,
      highRiskRecordId: r.highRiskRecordId || '',
      referralDate: r.referralDate,
      referredFrom: r.referredFrom || '',
      referredToHospital: r.referredToHospital || '',
      referralReason: r.referralReason || '',
      transportArrangement: r.transportArrangement || '',
      followUpDate: r.followUpDate || '',
      followUpStatus: (r.followUpStatus || 'प्रलंबित') as MaternalReferralRecord['followUpStatus'],
      outcomeNotes: r.outcomeNotes || '',
      referredByStaff: r.referredByStaff || '',
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => b.referralDate.localeCompare(a.referralDate));

  const deliveryRecords: DeliveryRecord[] = rawByTab.deliveryRecords
    .map((r) => ({
      id: r.id,
      beneficiaryId: r.beneficiaryId,
      beneficiaryCode: r.beneficiaryCode,
      pregnancyEpisodeId: r.pregnancyEpisodeId,
      episodeCode: r.episodeCode,
      plannedEddDate: r.plannedEddDate || '',
      plannedDeliveryPlace: r.plannedDeliveryPlace || '',
      plannedHospitalName: r.plannedHospitalName || '',
      deliveryPlanNotes: r.deliveryPlanNotes || '',
      referralRequiredBeforeDelivery: (r.referralRequiredBeforeDelivery || '') as DeliveryRecord['referralRequiredBeforeDelivery'],
      actualDeliveryDate: r.actualDeliveryDate || '',
      actualDeliveryPlace: r.actualDeliveryPlace || '',
      actualHospitalName: r.actualHospitalName || '',
      deliveryType: (r.deliveryType || 'Normal Delivery') as DeliveryRecord['deliveryType'],
      deliveryTypeOther: r.deliveryTypeOther || '',
      numberOfBabies: parseNum(r.numberOfBabies, 1),
      motherCondition: r.motherCondition || '',
      deliveryComplications: r.deliveryComplications || '',
      referralDetails: r.referralDetails || '',
      attendedByStaff: r.attendedByStaff || '',
      isCompleted: parseBool(r.isCompleted),
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => b.actualDeliveryDate.localeCompare(a.actualDeliveryDate));

  const babyRecords: BabyRecord[] = rawByTab.babyRecords
    .map((r) => ({
      id: r.id,
      babyCode: r.babyCode,
      motherBeneficiaryId: r.motherBeneficiaryId,
      motherBeneficiaryCode: r.motherBeneficiaryCode,
      pregnancyEpisodeId: r.pregnancyEpisodeId,
      episodeCode: r.episodeCode,
      deliveryRecordId: r.deliveryRecordId,
      babyNumber: parseNum(r.babyNumber, 1),
      babyName: r.babyName || '',
      gender: (r.gender || 'मुलगा') as BabyRecord['gender'],
      birthWeightGrams: parseNullableNum(r.birthWeightGrams),
      birthOutcome: (r.birthOutcome || 'Live Birth') as BabyRecord['birthOutcome'],
      birthOutcomeOther: r.birthOutcomeOther || '',
      babyCondition: r.babyCondition || '',
      dob: r.dob || '',
      notes: r.notes || '',
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => b.dob.localeCompare(a.dob) || a.babyNumber - b.babyNumber);

  const pncRecords: PncRecord[] = rawByTab.pncRecords
    .map((r) => ({
      id: r.id,
      visitNumber: parseNum(r.visitNumber, 1),
      visitLabel: r.visitLabel || `PNC-${parseNum(r.visitNumber, 1)}`,
      beneficiaryId: r.beneficiaryId,
      beneficiaryCode: r.beneficiaryCode,
      pregnancyEpisodeId: r.pregnancyEpisodeId,
      episodeCode: r.episodeCode,
      deliveryRecordId: r.deliveryRecordId || '',
      pncDate: r.pncDate,
      motherBp: r.motherBp || '',
      motherHealthStatus: r.motherHealthStatus || '',
      bleedingStatus: r.bleedingStatus || '',
      breastfeedingStatus: r.breastfeedingStatus || '',
      babyWeightGrams: parseNullableNum(r.babyWeightGrams),
      babyHealthStatus: r.babyHealthStatus || '',
      breastfeedingCounselling: (r.breastfeedingCounselling || '') as PncRecord['breastfeedingCounselling'],
      treatmentGiven: r.treatmentGiven || '',
      nextFollowUpDate: r.nextFollowUpDate || '',
      staffId: r.staffId,
      staffName: r.staffName,
      remarks: r.remarks || '',
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.pncDate.localeCompare(b.pncDate) || a.visitNumber - b.visitNumber);

  const vaccinationSessions: VaccinationSession[] = rawByTab.vaccinationSessions
    .map((r) => ({
      id: r.id,
      sessionCode: r.sessionCode,
      phcName: r.phcName || 'प्राथमिक आरोग्य केंद्र भादा',
      subcentreId: r.subcentreId,
      subcentreName: r.subcentreName,
      villageId: r.villageId,
      villageName: r.villageName,
      sessionDate: r.sessionDate,
      location: r.location,
      sessionType: (r.sessionType || 'नियमित') as VaccinationSession['sessionType'],
      sessionCategory: (r.sessionCategory === 'CHILD' || r.sessionCategory === 'PREGNANT_WOMAN'
        ? r.sessionCategory
        : 'COMBINED') as VaccinationSession['sessionCategory'],
      choName: r.choName,
      anmName: r.anmName,
      otherStaff: r.otherStaff || '',
      status: (r.status || 'नियोजित') as VaccinationSession['status'],
      editDeadlineAt: r.editDeadlineAt,
      reopenedUntil: r.reopenedUntil || null,
      reopenedBy: r.reopenedBy || null,
      reopenReason: r.reopenReason || null,
      completedAt: r.completedAt || null,
      completedBy: r.completedBy || null,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));

  const sessionBeneficiaries: SessionBeneficiary[] = rawByTab.sessionBeneficiaries.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    beneficiaryId: r.beneficiaryId,
    beneficiaryCode: r.beneficiaryCode,
    beneficiaryType:
      r.beneficiaryType === 'PREGNANT_WOMAN'
        ? 'PREGNANT_WOMAN'
        : r.beneficiaryType === 'CHILD'
          ? 'CHILD'
          : undefined,
    pregnancyEpisodeId: r.pregnancyEpisodeId || '',
    childName: r.childName,
    dob: r.dob,
    gender: (r.gender || 'मुलगा') as SessionBeneficiary['gender'],
    subcentreId: r.subcentreId,
    villageId: r.villageId,
    addedBy: r.addedBy,
    addedAt: r.addedAt,
    enrollmentType: r.enrollmentType === 'NEW' ? 'NEW' : r.enrollmentType === 'EXISTING' ? 'EXISTING' : undefined,
    remarks: r.remarks || '',
  }));

  const vaccineMaster: VaccineMaster[] = rawByTab.vaccineMaster
    .map((r) => ({
      id: r.id,
      vaccineName: r.vaccineName,
      shortCode: r.shortCode,
      applicableCategory: (r.applicableCategory || 'Child') as VaccineMaster['applicableCategory'],
      requiresBatchNumber: parseBool(r.requiresBatchNumber),
      displayOrder: parseNum(r.displayOrder, 1),
      isActive: r.isActive === '' ? true : parseBool(r.isActive),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const vaccineSchedule: VaccineSchedule[] = rawByTab.vaccineSchedule
    .map((r) => ({
      id: r.id,
      vaccineId: r.vaccineId,
      vaccineName: r.vaccineName,
      doseName: r.doseName,
      doseOrder: parseNum(r.doseOrder, 1),
      previousDoseId: r.previousDoseId || null,
      minAgeValue: parseNum(r.minAgeValue, 0),
      minAgeUnit: (r.minAgeUnit || 'DAYS') as VaccineSchedule['minAgeUnit'],
      recommendedAgeValue: parseNum(r.recommendedAgeValue, 0),
      recommendedAgeUnit: (r.recommendedAgeUnit || 'DAYS') as VaccineSchedule['recommendedAgeUnit'],
      maxAgeValue: parseNullableNum(r.maxAgeValue),
      maxAgeUnit: (r.maxAgeUnit || null) as VaccineSchedule['maxAgeUnit'],
      minIntervalDays: parseNullableNum(r.minIntervalDays),
      recommendedDueRuleText: r.recommendedDueRuleText || '',
      isBooster: parseBool(r.isBooster),
      boosterInfo: r.boosterInfo || '',
      applicableCategory: (r.applicableCategory || 'Child') as VaccineSchedule['applicableCategory'],
      isValidated: parseBool(r.isValidated),
      validatedBy: r.validatedBy || '',
      validatedAt: r.validatedAt || '',
      isActive: r.isActive === '' ? true : parseBool(r.isActive),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.doseOrder - b.doseOrder);

  const vaccinationRecords: VaccinationRecord[] = rawByTab.vaccinationRecords
    .map((r) => ({
      id: r.id,
      beneficiaryId: r.beneficiaryId,
      beneficiaryCode: r.beneficiaryCode,
      sessionId: r.sessionId,
      sessionDate: r.sessionDate,
      subcentreId: r.subcentreId,
      villageId: r.villageId,
      vaccineId: r.vaccineId,
      vaccineName: r.vaccineName,
      scheduleId: r.scheduleId,
      doseName: r.doseName,
      administeredDate: r.administeredDate,
      batchNumber: r.batchNumber || '',
      staffId: r.staffId,
      staffName: r.staffName,
      remarks: r.remarks || '',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.administeredDate.localeCompare(b.administeredDate));

  const maternalServiceRecords: MaternalServiceRecord[] = rawByTab.maternalServiceRecords
    .map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      sessionDate: r.sessionDate,
      beneficiaryId: r.beneficiaryId,
      beneficiaryCode: r.beneficiaryCode,
      pregnancyEpisodeId: r.pregnancyEpisodeId,
      episodeCode: r.episodeCode,
      subcentreId: r.subcentreId,
      villageId: r.villageId,
      visitDate: r.visitDate,
      serviceCode: r.serviceCode,
      serviceName: r.serviceName,
      serviceValue: r.serviceValue || '',
      batchNumber: r.batchNumber || '',
      staffId: r.staffId,
      staffName: r.staffName,
      remarks: r.remarks || '',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate));

  const riChecklists: RiChecklist[] = rawByTab.riChecklists
    .map((r) => ({
      id: r.id,
      checklistCode: r.checklistCode,
      sessionId: r.sessionId || '',
      sessionCode: r.sessionCode || '',
      checklistStaffName: r.checklistStaffName || r.monitorName || r.createdBy || '',
      monitorName: r.monitorName || '',
      organization: (r.organization || 'Govt') as RiChecklist['organization'],
      organizationOther: r.organizationOther || '',
      designation: r.designation || '',
      monitoringDate: r.monitoringDate || '',
      state: r.state || 'महाराष्ट्र',
      district: r.district || 'लातूर',
      blockUlb: r.blockUlb || 'औसा',
      planningUnit: r.planningUnit || 'प्राथमिक आरोग्य केंद्र भादा',
      setting: (r.setting === 'Urban' ? 'Urban' : 'Rural') as RiChecklist['setting'],
      subcentreId: r.subcentreId || '',
      subcentreName: r.subcentreName || '',
      villageId: r.villageId || '',
      sessionSiteName: r.sessionSiteName || '',
      monitoringReasons: parseJsonStringArray(r.monitoringReasons),
      monitoringReasonOther: r.monitoringReasonOther || '',
      hraType: r.hraType || '',
      sessionSiteLocation: (r.sessionSiteLocation || 'Sub Centre') as RiChecklist['sessionSiteLocation'],
      sessionSiteLocationOther: r.sessionSiteLocationOther || '',
      isSessionHeld: (r.isSessionHeld === 'No' ? 'No' : 'Yes') as RiChecklist['isSessionHeld'],
      sessionNotHeldReason: r.sessionNotHeldReason || '',
      sessionNotHeldReasonOther: r.sessionNotHeldReasonOther || '',
      dueListAvailable: (r.dueListAvailable || '') as RiChecklist['dueListAvailable'],
      mobilizersAssigned: parseJsonStringArray(r.mobilizersAssigned),
      dueListWithMobiliser: (r.dueListWithMobiliser || '') as RiChecklist['dueListWithMobiliser'],
      mobilizerMobilizing: (r.mobilizerMobilizing || '') as RiChecklist['mobilizerMobilizing'],
      polioHraTagged: (r.polioHraTagged || '') as RiChecklist['polioHraTagged'],
      vaccineDeliveredBy: (r.vaccineDeliveredBy || '') as RiChecklist['vaccineDeliveredBy'],
      vaccineCarrierName: r.vaccineCarrierName || '',
      vaccines: (parseJsonObj(r.vaccines) || {}) as Record<string, RiVaccineStatusEntry>,
      logistics: (parseJsonObj(r.logistics) || {}) as Record<string, RiLogisticAvailability>,
      cuttingWithHubCutter: (r.cuttingWithHubCutter || '') as RiChecklist['cuttingWithHubCutter'],
      hubCutterNoReason: r.hubCutterNoReason || '',
      markingVialsDateTime: (r.markingVialsDateTime || '') as RiChecklist['markingVialsDateTime'],
      reconstitutedVialAfterLapsed: parseJsonStringArray(r.reconstitutedVialAfterLapsed),
      delivering4KeyMessages: (r.delivering4KeyMessages || '') as RiChecklist['delivering4KeyMessages'],
      advisingWait30Mins: (r.advisingWait30Mins || '') as RiChecklist['advisingWait30Mins'],
      caregiverInterviewNotObserved: parseBool(r.caregiverInterviewNotObserved),
      caregiver1Mobilizer: parseJsonStringArray(r.caregiver1Mobilizer),
      caregiver2Mobilizer: parseJsonStringArray(r.caregiver2Mobilizer),
      caregiver3Mobilizer: parseJsonStringArray(r.caregiver3Mobilizer),
      minAge2ndMeasles: (r.minAge2ndMeasles || '') as RiChecklist['minAge2ndMeasles'],
      mctsRegisterMaintained: (r.mctsRegisterMaintained || '') as RiChecklist['mctsRegisterMaintained'],
      supervisorVisitedToday: (r.supervisorVisitedToday || '') as RiChecklist['supervisorVisitedToday'],
      supervisorVisitedOther: r.supervisorVisitedOther || '',
      ashaPaymentPreviousSession: (r.ashaPaymentPreviousSession || '') as RiChecklist['ashaPaymentPreviousSession'],
      ashaPaymentFI: (r.ashaPaymentFI || '') as RiChecklist['ashaPaymentFI'],
      ashaPaymentCI: (r.ashaPaymentCI || '') as RiChecklist['ashaPaymentCI'],
      vaccineNotAvailableReason: (r.vaccineNotAvailableReason || '') as RiChecklist['vaccineNotAvailableReason'],
      vaccineNotAvailableOther: r.vaccineNotAvailableOther || '',
      anmAbsentReason: (r.anmAbsentReason || '') as RiChecklist['anmAbsentReason'],
      anmAbsentOther: r.anmAbsentOther || '',
      remarks: r.remarks || '',
      createdBy: r.createdBy || '',
      createdAt: r.createdAt || '',
      updatedAt: r.updatedAt || '',
    }))
    .sort((a, b) => b.monitoringDate.localeCompare(a.monitoringDate) || b.createdAt.localeCompare(a.createdAt));

  const auditLogs: AuditLog[] = rawByTab.auditLogs
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      userRole: (r.userRole || 'ADMIN') as AuditLog['userRole'],
      action: r.action,
      entityType: (r.entityType || 'SETTINGS') as AuditLog['entityType'],
      recordId: r.recordId,
      previousValue: parseJsonObj(r.previousValue),
      newValue: parseJsonObj(r.newValue),
      reason: r.reason || '',
      createdAt: r.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const systemSettings: SystemSettings[] = rawByTab.systemSettings.map((r) => ({
    id: r.id || 'phc_bhada_config',
    phcName: r.phcName || 'प्राथमिक आरोग्य केंद्र भादा',
    district: r.district || 'लातूर',
    state: r.state || 'महाराष्ट्र',
    timezone: 'Asia/Kolkata',
    allowEditDaysAfterSession: parseNum(r.allowEditDaysAfterSession, 2),
    maternalServiceCatalogJson: r.maternalServiceCatalogJson || '',
    updatedBy: r.updatedBy,
    updatedAt: r.updatedAt,
  }));

  return {
    spreadsheetId,
    spreadsheetTitle: title,
    spreadsheetUrl: url,
    users,
    subcentres,
    villages,
    staff,
    beneficiaries,
    pregnancyEpisodes,
    ancVisits,
    highRiskRecords,
    maternalReferrals,
    deliveryRecords,
    babyRecords,
    pncRecords,
    vaccinationSessions,
    sessionBeneficiaries,
    vaccineMaster,
    vaccineSchedule,
    vaccinationRecords,
    maternalServiceRecords,
    riChecklists,
    auditLogs,
    systemSettings,
  };
}

export async function appendSheetRows(
  spreadsheetId: string,
  tab: SheetTabName,
  items: Record<string, unknown>[]
): Promise<void> {
  if (items.length === 0) return;
  const values = items.map((item) => objectToRow(tab, item));
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${tab}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({ values }),
    }
  );
}

export async function rewriteSheetTab(
  spreadsheetId: string,
  tab: SheetTabName,
  items: Record<string, unknown>[]
): Promise<void> {
  // Clear existing range first, then write headers + rows atomically
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${tab}'!A:BZ`)}:clear`,
    { method: 'POST' }
  );

  const values = [TAB_COLUMNS[tab], ...items.map((item) => objectToRow(tab, item))];
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${tab}'!A1`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    }
  );
}

export function normalizeDedupeKey(childName: string, motherName: string, dob: string): string {
  const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${clean(childName)}|${clean(motherName)}|${dob.trim()}`;
}

export function normalizeBeneficiaryDedupeKey(params: {
  beneficiaryType: BeneficiaryType;
  fullName?: string;
  guardianOrMotherName?: string;
  dob?: string;
  mobile?: string;
}): string {
  const clean = (s?: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (params.beneficiaryType === 'PREGNANT_WOMAN') {
    return `PW|${clean(params.fullName)}|${clean(params.guardianOrMotherName)}|${(params.mobile || '').trim()}`;
  }
  return `${clean(params.fullName)}|${clean(params.guardianOrMotherName)}|${(params.dob || '').trim()}`;
}

export function buildAuditEntry(
  user: AppUser,
  params: {
    action: string;
    entityType: AuditLog['entityType'];
    recordId: string;
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    reason?: string;
  }
): AuditLog {
  return {
    id: generateId('aud'),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: params.action,
    entityType: params.entityType,
    recordId: params.recordId,
    previousValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    reason: params.reason ?? '',
    createdAt: nowISO(),
  };
}
