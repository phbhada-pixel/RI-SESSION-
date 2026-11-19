import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  clearInMemoryAccessToken,
  initGoogleAuthListener,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
} from '../config/firebase';
import {
  AncVisitRecord,
  AppUser,
  AuditLog,
  BabyBirthOutcome,
  BabyRecord,
  Beneficiary,
  DeliveryFacilityType,
  DeliveryRecord,
  DeliveryTypeOption,
  EddHistoryEntry,
  HighRiskRecord,
  HrpHistoryEntry,
  MaternalReferralRecord,
  MaternalServiceConfigItem,
  MaternalServiceRecord,
  PncRecord,
  PregnancyEpisode,
  PregnancyStatus,
  RiChecklist,
  SessionBeneficiary,
  SheetDatabase,
  StaffMember,
  Subcentre,
  SystemSettings,
  UserRole,
  VaccinationRecord,
  VaccinationSession,
  VaccineMaster,
  VaccineSchedule,
  Village,
} from '../types';
import {
  appendSheetRows,
  buildAuditEntry,
  CENTRAL_OWNER_EMAIL,
  createPhcSpreadsheet,
  DEFAULT_SPREADSHEET_TITLE,
  extractSpreadsheetIdFromInput,
  fetchServerNowISO,
  findAppSpreadsheet,
  generateId,
  getCentralSheetPointer,
  listAppSpreadsheets,
  loadEntireSheetDatabase,
  normalizeBeneficiaryDedupeKey,
  normalizeDedupeKey,
  registerCentralSheetPointer,
  rewriteSheetTab,
  shareSpreadsheetWithAnyoneWriter,
  shareSpreadsheetWithEmail,
  SHEET_TABS,
  TAB_COLUMNS,
} from '../services/googleSheetsService';
import { computeSessionEditDeadlineISO, getTodayIST, nowISO } from '../utils/dateUtils';
import {
  calculateEddFromMcDate,
  calculateGestationalWeeksAndDays,
  formatGravidaSummary,
  parseBpSystolicDiastolic,
  parseJsonArraySafe,
  validateTdDoseForEpisode,
} from '../utils/maternalUtils';
import { maskSensitiveFieldsForAudit, sanitizeOptionalAadhaar } from '../utils/privacyUtils';
import { buildPhcBhadaStarterHierarchy, buildStandardNISData } from '../utils/nisSeedData';
import { exportMultiSheetExcel, parseExcelFileToSheets } from '../utils/exportUtils';

export const buildNextSubcentreCode = (existingSubcentres: Subcentre[]): string => {
  const used = new Set(
    existingSubcentres.map((s) => (s.code || '').trim().toUpperCase()).filter(Boolean)
  );
  let maxSeq = 0;
  for (const s of existingSubcentres) {
    const match = /^SC-(\d+)$/i.exec((s.code || '').trim());
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
    }
  }
  let nextSeq = maxSeq + 1;
  let candidate = `SC-${String(nextSeq).padStart(2, '0')}`;
  while (used.has(candidate)) {
    nextSeq += 1;
    candidate = `SC-${String(nextSeq).padStart(2, '0')}`;
  }
  return candidate;
};

export const buildNextVillageCode = (existingVillages: Village[]): string => {
  const used = new Set(
    existingVillages.map((v) => (v.villageCode || '').trim().toUpperCase()).filter(Boolean)
  );
  let maxSeq = 0;
  for (const v of existingVillages) {
    const match = /^VIL-(\d+)$/i.exec((v.villageCode || '').trim());
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
    }
  }
  let nextSeq = maxSeq + 1;
  let candidate = `VIL-${String(nextSeq).padStart(3, '0')}`;
  while (used.has(candidate)) {
    nextSeq += 1;
    candidate = `VIL-${String(nextSeq).padStart(3, '0')}`;
  }
  return candidate;
};

export type SheetSyncStatus = 'SYNCED' | 'SYNCING' | 'FAILED' | 'OFFLINE';

interface SheetDataContextValue {
  fbUser: User | null;
  currentUser: AppUser | null;
  isCentralOwner: boolean;
  centralSheetMissing: boolean;
  sharedWithAnyone: boolean;
  needsAuth: boolean;
  authLoading: boolean;
  sheetLoading: boolean;
  syncing: boolean;
  syncStatus: SheetSyncStatus;
  lastSyncedAt: string | null;
  sheetError: string;
  db: SheetDatabase | null;
  availableSheets: Array<{ id: string; name: string; webViewLink: string }>;
  signIn: (options?: { switchAccount?: boolean; loginHint?: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  connectSheet: (urlOrId: string) => Promise<void>;
  createNewSheet: (title?: string) => Promise<void>;
  enableMultiGmailSharing: () => Promise<void>;
  refreshFromSheet: () => Promise<void>;
  downloadFullWorkbook: () => void;
  uploadExcelToSheet: (file: File, mode: 'APPEND' | 'REPLACE') => Promise<{ tabsUpdated: string[]; rowCount: number }>;

  // Domain mutations (all persist exclusively to Google Sheets)
  saveSubcentre: (data: { id?: string; code?: string; name: string; phcName: string; isActive: boolean }) => Promise<Subcentre>;
  saveVillage: (data: {
    id?: string;
    villageCode?: string;
    name: string;
    subcentreId: string;
    subcentreName: string;
    population?: number | null;
    isActive: boolean;
  }) => Promise<Village>;
  saveStaff: (data: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  saveUser: (data: Omit<AppUser, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  saveSystemSettings: (data: Omit<SystemSettings, 'id' | 'updatedBy' | 'updatedAt'>) => Promise<void>;
  saveMaternalServiceCatalog: (catalog: MaternalServiceConfigItem[]) => Promise<void>;
  registerBeneficiary: (
    data: Omit<Beneficiary, 'id' | 'beneficiaryCode' | 'dedupeKey' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    initialEpisode?: {
      mcDate: string;
      eddDate?: string;
      expectedDeliveryPlace: string;
      deliveryFacilityType: DeliveryFacilityType;
      hospitalName: string;
      pregnancyRegistrationDate: string;
      pregnancyStatus: PregnancyStatus;
      gravidaPara?: string;
      gravida?: number | null;
      para?: number | null;
      abortions?: number | null;
      livingChildren?: number | null;
      previousPregnancyHistory?: string;
      previousCaesarean?: 'Yes' | 'No' | '';
      previousComplications?: string;
      bloodGroup?: string;
      rhFactor?: string;
      notes?: string;
    }
  ) => Promise<{ beneficiary: Beneficiary; episode?: PregnancyEpisode }>;
  registerBeneficiaryAndAddToSession: (
    session: VaccinationSession,
    data: Omit<Beneficiary, 'id' | 'beneficiaryCode' | 'dedupeKey' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    initialEpisode?: {
      mcDate: string;
      eddDate?: string;
      expectedDeliveryPlace: string;
      deliveryFacilityType: DeliveryFacilityType;
      hospitalName: string;
      pregnancyRegistrationDate: string;
      pregnancyStatus: PregnancyStatus;
      gravidaPara?: string;
      gravida?: number | null;
      para?: number | null;
      abortions?: number | null;
      livingChildren?: number | null;
      previousPregnancyHistory?: string;
      previousCaesarean?: 'Yes' | 'No' | '';
      previousComplications?: string;
      bloodGroup?: string;
      rhFactor?: string;
      notes?: string;
    }
  ) => Promise<{ beneficiary: Beneficiary; episode?: PregnancyEpisode }>;
  updateBeneficiary: (
    id: string,
    updates: Partial<Omit<Beneficiary, 'id' | 'beneficiaryCode' | 'createdAt' | 'createdBy'>>
  ) => Promise<void>;
  createPregnancyEpisode: (
    beneficiary: Beneficiary,
    episodeData: {
      mcDate: string;
      eddDate?: string;
      expectedDeliveryPlace: string;
      deliveryFacilityType: DeliveryFacilityType;
      hospitalName: string;
      pregnancyRegistrationDate: string;
      pregnancyStatus: PregnancyStatus;
      gravidaPara?: string;
      gravida?: number | null;
      para?: number | null;
      abortions?: number | null;
      livingChildren?: number | null;
      previousPregnancyHistory?: string;
      previousCaesarean?: 'Yes' | 'No' | '';
      previousComplications?: string;
      bloodGroup?: string;
      rhFactor?: string;
      notes?: string;
    }
  ) => Promise<PregnancyEpisode>;
  updatePregnancyEpisode: (
    episodeId: string,
    updates: Partial<Omit<PregnancyEpisode, 'id' | 'episodeCode' | 'beneficiaryId' | 'beneficiaryCode' | 'createdBy' | 'createdAt'>>,
    eddChangeReason?: string
  ) => Promise<void>;
  createSession: (
    data: Omit<
      VaccinationSession,
      | 'id'
      | 'sessionCode'
      | 'editDeadlineAt'
      | 'reopenedUntil'
      | 'reopenedBy'
      | 'reopenReason'
      | 'completedAt'
      | 'completedBy'
      | 'createdBy'
      | 'createdAt'
      | 'updatedAt'
    >
  ) => Promise<VaccinationSession>;
  updateSession: (sessionId: string, updates: Partial<VaccinationSession>) => Promise<void>;
  completeSession: (sessionId: string) => Promise<VaccinationSession>;
  reopenLockedSession: (sessionId: string, hoursToKeepOpen: number, reason: string) => Promise<void>;
  addBeneficiaryToSession: (
    session: VaccinationSession,
    beneficiary: Beneficiary,
    enrollmentType?: 'NEW' | 'EXISTING',
    remarks?: string,
    pregnancyEpisodeId?: string
  ) => Promise<void>;
  removeBeneficiaryFromSession: (session: VaccinationSession, sbId: string) => Promise<void>;
  saveVaccineMaster: (data: Omit<VaccineMaster, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  saveVaccineSchedule: (data: Omit<VaccineSchedule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  seedStandardNIS: () => Promise<void>;
  seedStarterHierarchy: () => Promise<void>;
  administerVaccineDoses: (
    session: VaccinationSession,
    entries: Array<{
      beneficiary: Beneficiary;
      schedule: VaccineSchedule;
      administeredDate: string;
      batchNumber?: string;
      remarks?: string;
    }>
  ) => Promise<void>;
  recordMaternalServices: (
    session: VaccinationSession,
    entries: Array<{
      beneficiary: Beneficiary;
      episode?: PregnancyEpisode | null;
      serviceCode: string;
      serviceName: string;
      serviceValue: string;
      batchNumber?: string;
      remarks?: string;
      visitDate?: string;
    }>
  ) => Promise<void>;
  saveRiChecklist: (
    data: Omit<RiChecklist, 'id' | 'checklistCode' | 'createdBy' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ) => Promise<RiChecklist>;

  // Expanded Maternal Lifecycle Mutations
  recordAncVisit: (data: {
    beneficiary: Beneficiary;
    episode: PregnancyEpisode;
    visitNumber: number;
    visitLabel: string;
    visitDate: string;
    weightKg?: string;
    heightCm?: string;
    bp?: string;
    hb?: string;
    bloodSugar?: string;
    urineAlbumin?: string;
    urineSugar?: string;
    bloodTests?: string;
    otherTests?: string;
    doctorObservation?: string;
    treatmentAdvice?: string;
    nextVisitDate?: string;
    staffName: string;
    staffDesignation?: string;
    remarks?: string;
    sessionId?: string;
  }) => Promise<AncVisitRecord>;

  saveHighRiskRecord: (data: {
    beneficiary: Beneficiary;
    episode: PregnancyEpisode;
    isHighRisk: 'YES' | 'NO';
    identificationDate: string;
    reasons: string[];
    otherReasonText?: string;
    doctorAdvice?: string;
    treatmentInfo?: string;
    referralRequired?: 'Yes' | 'No' | '';
    referralDate?: string;
    referralHospital?: string;
    referralReason?: string;
    followUpDate?: string;
    followUpStatus?: string;
    currentStatus?: string;
    approvedByMO?: string;
    note?: string;
  }) => Promise<HighRiskRecord>;

  recordMaternalImmunizationAndSupplements: (data: {
    beneficiary: Beneficiary;
    episode: PregnancyEpisode;
    visitDate: string;
    staffName: string;
    items: Array<{
      serviceCode: string;
      serviceName: string;
      serviceValue: string;
      batchNumber?: string;
      remarks?: string;
    }>;
  }) => Promise<MaternalServiceRecord[]>;

  recordMaternalReferral: (data: {
    beneficiary: Beneficiary;
    episode: PregnancyEpisode;
    highRiskRecordId?: string;
    referralDate: string;
    referredFrom: string;
    referredToHospital: string;
    referralReason: string;
    transportArrangement?: string;
    followUpDate?: string;
    followUpStatus: MaternalReferralRecord['followUpStatus'];
    outcomeNotes?: string;
    referredByStaff: string;
  }) => Promise<MaternalReferralRecord>;

  updateMaternalReferralStatus: (
    referralId: string,
    updates: Partial<Pick<MaternalReferralRecord, 'followUpStatus' | 'followUpDate' | 'outcomeNotes'>>
  ) => Promise<void>;

  recordDeliveryAndBabies: (data: {
    beneficiary: Beneficiary;
    episode: PregnancyEpisode;
    plannedEddDate?: string;
    plannedDeliveryPlace?: string;
    plannedHospitalName?: string;
    deliveryPlanNotes?: string;
    referralRequiredBeforeDelivery?: 'Yes' | 'No' | '';
    actualDeliveryDate: string;
    actualDeliveryPlace: string;
    actualHospitalName?: string;
    deliveryType: DeliveryTypeOption;
    deliveryTypeOther?: string;
    motherCondition: string;
    deliveryComplications?: string;
    referralDetails?: string;
    attendedByStaff: string;
    markEpisodeDelivered: boolean;
    babies: Array<{
      babyName: string;
      gender: BabyRecord['gender'];
      birthWeightGrams: number | null;
      birthOutcome: BabyBirthOutcome;
      birthOutcomeOther?: string;
      babyCondition: string;
      notes?: string;
    }>;
  }) => Promise<{ delivery: DeliveryRecord; babies: BabyRecord[] }>;

  recordPncVisit: (data: {
    beneficiary: Beneficiary;
    episode: PregnancyEpisode;
    deliveryRecordId?: string;
    visitNumber: number;
    visitLabel: string;
    pncDate: string;
    motherBp?: string;
    motherHealthStatus: string;
    bleedingStatus: string;
    breastfeedingStatus: string;
    babyWeightGrams?: number | null;
    babyHealthStatus: string;
    breastfeedingCounselling: 'Yes' | 'No' | '';
    treatmentGiven?: string;
    nextFollowUpDate?: string;
    staffName: string;
    remarks?: string;
  }) => Promise<PncRecord>;

  seedDemoPregnancyRecord: () => Promise<{ beneficiary: Beneficiary; episode: PregnancyEpisode }>;
}

const SheetDataContext = createContext<SheetDataContextValue | undefined>(undefined);

export const SheetDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SheetSyncStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'SYNCED'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState('');
  const [db, setDb] = useState<SheetDatabase | null>(null);
  const [availableSheets, setAvailableSheets] = useState<
    Array<{ id: string; name: string; webViewLink: string }>
  >([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [centralSheetMissing, setCentralSheetMissing] = useState(false);
  const [sharedWithAnyone, setSharedWithAnyone] = useState(false);

  const isCentralOwner = (fbUser?.email || '').toLowerCase() === CENTRAL_OWNER_EMAIL;

  useEffect(() => {
    const handleOffline = () => setSyncStatus('OFFLINE');
    const handleOnline = () => setSyncStatus((prev) => (prev === 'OFFLINE' ? 'SYNCED' : prev));
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const resolveUserFromDb = useCallback((loadedDb: SheetDatabase, authUser: User): AppUser | null => {
    const email = (authUser.email || '').toLowerCase();
    const matched = loadedDb.users.find((u) => u.email.toLowerCase() === email);
    if (matched) {
      return matched.isActive ? matched : null;
    }
    if (email === CENTRAL_OWNER_EMAIL || loadedDb.users.length === 0) {
      return {
        id: `usr_${email || authUser.uid}`,
        name: authUser.displayName || email.split('@')[0] || 'प्रशासक',
        email,
        mobile: '',
        role: 'ADMIN',
        subcentreId: '',
        subcentreName: '',
        isActive: true,
        createdAt: nowISO(),
      };
    }
    return null;
  }, []);

  const loadDatabaseById = useCallback(
    async (spreadsheetId: string, authUser: User) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('OFFLINE');
        setSheetError('इंटरनेट कनेक्शन उपलब्ध नाही. डेटा लोड करता आला नाही.');
        return;
      }
      setSheetLoading(true);
      setSyncStatus('SYNCING');
      setSheetError('');
      setCentralSheetMissing(false);
      try {
        const loaded = await loadEntireSheetDatabase(spreadsheetId);
        const email = (authUser.email || '').toLowerCase();
        const existingUser = loaded.users.find((u) => u.email.toLowerCase() === email);

        if (!existingUser) {
          const isOwner = email === CENTRAL_OWNER_EMAIL || loaded.users.length === 0;
          const autoUser: AppUser = {
            id: `usr_${email || authUser.uid}`,
            name: authUser.displayName || email.split('@')[0] || (isOwner ? 'प्रशासक' : 'कर्मचारी'),
            email,
            mobile: '',
            role: isOwner ? 'ADMIN' : 'DATA_OPERATOR',
            subcentreId: '',
            subcentreName: '',
            isActive: true,
            createdAt: nowISO(),
          };
          await appendSheetRows(spreadsheetId, 'users', [
            autoUser as unknown as Record<string, unknown>,
          ]);
          loaded.users = [...loaded.users, autoUser];
        }

        if (email === CENTRAL_OWNER_EMAIL) {
          await registerCentralSheetPointer(loaded.spreadsheetId, loaded.spreadsheetUrl).catch(
            () => undefined
          );
          const sheetsList = await listAppSpreadsheets().catch(() => []);
          setAvailableSheets(sheetsList);
        }

        const resolved = resolveUserFromDb(loaded, authUser);
        setDb(loaded);
        setCurrentUser(resolved);
        setSyncStatus('SYNCED');
        setLastSyncedAt(nowISO());
      } catch (err) {
        setSyncStatus('FAILED');
        const rawMsg = err instanceof Error ? err.message : 'डेटा लोड करताना त्रुटी आली.';
        const lower = rawMsg.toLowerCase();
        if (
          lower.includes('invalid_token') ||
          lower.includes('unauthenticated') ||
          lower.includes('invalid authentication') ||
          rawMsg.includes('401')
        ) {
          clearInMemoryAccessToken();
          setNeedsAuth(true);
          setSheetError('');
        } else if (lower.includes('permission') || rawMsg.includes('403')) {
          setSheetError(
            `या खात्याला (${authUser.email}) डेटा संपादन परवानगी नाही. कृपया PHC भादा प्रशासकाकडून प्रवेश सक्रिय करून घ्या.`
          );
        } else {
          setSheetError(rawMsg);
        }
      } finally {
        setSheetLoading(false);
      }
    },
    [resolveUserFromDb]
  );

  const bootstrapAfterSignIn = useCallback(
    async (authUser: User) => {
      setSheetLoading(true);
      setSheetError('');
      setCentralSheetMissing(false);
      try {
        const email = (authUser.email || '').toLowerCase();
        const urlParams = new URLSearchParams(window.location.search);
        const hashQueryIndex = window.location.hash.indexOf('?');
        const hashParams = new URLSearchParams(
          hashQueryIndex >= 0 ? window.location.hash.slice(hashQueryIndex + 1) : ''
        );
        const urlSheetId = urlParams.get('sheetId') || hashParams.get('sheetId');
        const pointer = await getCentralSheetPointer();
        setSharedWithAnyone(Boolean(pointer.sharedWithAnyone));

        let targetId = urlSheetId
          ? extractSpreadsheetIdFromInput(urlSheetId)
          : pointer.spreadsheetId || '';

        if (email === CENTRAL_OWNER_EMAIL) {
          if (!targetId) {
            const existing = await findAppSpreadsheet();
            if (existing) {
              targetId = existing.id;
            }
          }

          if (!targetId) {
            // Automatically create PHC Bhada Google Sheet with all 12 tabs, columns, and NIS schedule
            const created = await createPhcSpreadsheet(DEFAULT_SPREADSHEET_TITLE, {
              name: authUser.displayName || 'प्राथमिक आरोग्य केंद्र भादा प्रशासक',
              email,
            });
            targetId = created.id;
            await registerCentralSheetPointer(created.id, created.webViewLink, false).catch(
              () => undefined
            );
          }

          await loadDatabaseById(targetId, authUser);
        } else {
          // Any other Gmail MUST connect strictly to phbhada@gmail.com's central Google Sheet
          if (!targetId) {
            setCentralSheetMissing(true);
            setDb(null);
            setCurrentUser(null);
            return;
          }
          await loadDatabaseById(targetId, authUser);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'प्रणाली डेटा तपासताना त्रुटी आली.';
        const lower = msg.toLowerCase();
        if (
          lower.includes('invalid_token') ||
          lower.includes('unauthenticated') ||
          lower.includes('invalid authentication') ||
          msg.includes('401')
        ) {
          clearInMemoryAccessToken();
          setNeedsAuth(true);
          setSheetError('');
        } else {
          setSheetError(msg);
        }
      } finally {
        setSheetLoading(false);
      }
    },
    [loadDatabaseById]
  );

  useEffect(() => {
    const unsub = initGoogleAuthListener(
      (user) => {
        setFbUser(user);
        setNeedsAuth(false);
        setAuthLoading(false);
        bootstrapAfterSignIn(user);
      },
      (user) => {
        setFbUser(user);
        setNeedsAuth(true);
        setAuthLoading(false);
        setDb(null);
        setCurrentUser(null);
      }
    );
    return unsub;
  }, [bootstrapAfterSignIn]);

  const signIn: SheetDataContextValue['signIn'] = async (options) => {
    setSheetError('');
    const res = await signInWithGoogleWorkspace(options);
    setFbUser(res.user);
    setNeedsAuth(false);
    await bootstrapAfterSignIn(res.user);
  };

  const logout = async () => {
    clearInMemoryAccessToken();
    await signOutGoogleWorkspace();
    setDb(null);
    setCurrentUser(null);
    setNeedsAuth(true);
  };

  const hasRole = (roles: UserRole[]) => Boolean(currentUser && roles.includes(currentUser.role));

  const connectSheet = async (urlOrId: string) => {
    if (!fbUser) throw new Error('कृपया आधी लॉगिन करा.');
    const spreadsheetId = extractSpreadsheetIdFromInput(urlOrId);
    if (!spreadsheetId) throw new Error('कृपया वैध डेटाबेस आयडी प्रविष्ट करा.');
    await loadDatabaseById(spreadsheetId, fbUser);
  };

  const createNewSheet = async (title: string = DEFAULT_SPREADSHEET_TITLE) => {
    if (!fbUser) throw new Error('कृपया आधी लॉगिन करा.');
    if ((fbUser.email || '').toLowerCase() !== CENTRAL_OWNER_EMAIL) {
      throw new Error('प्रणाली डेटाबेस केवळ मुख्य प्रशासक तयार करू शकतात.');
    }
    setSheetLoading(true);
    setSheetError('');
    try {
      const created = await createPhcSpreadsheet(title, {
        name: fbUser.displayName || 'प्रशासक',
        email: fbUser.email || '',
      });
      await registerCentralSheetPointer(created.id, created.webViewLink, false).catch(
        () => undefined
      );
      setSharedWithAnyone(false);
      await loadDatabaseById(created.id, fbUser);
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'प्रणाली डेटाबेस तयार करताना त्रुटी आली.');
      throw err;
    } finally {
      setSheetLoading(false);
    }
  };

  const enableMultiGmailSharing = async () => {
    await withSync(async () => {
      const { activeDb } = requireDbAndUser();
      await shareSpreadsheetWithAnyoneWriter(activeDb.spreadsheetId);
      await registerCentralSheetPointer(activeDb.spreadsheetId, activeDb.spreadsheetUrl, true).catch(
        () => undefined
      );
      setSharedWithAnyone(true);
    });
  };

  const refreshFromSheet = async () => {
    if (!db || !fbUser) return;
    setSyncing(true);
    try {
      await loadDatabaseById(db.spreadsheetId, fbUser);
    } finally {
      setSyncing(false);
    }
  };

  const requireDbAndUser = () => {
    if (!db) throw new Error('प्रणाली डेटाबेस लोड झालेला नाही.');
    if (!currentUser) throw new Error('वापरकर्ता अधिकृत नाही.');
    return { activeDb: db, activeUser: currentUser };
  };

  const withSync = async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('OFFLINE');
      const offlineMsg = 'इंटरनेट कनेक्शन उपलब्ध नाही. डेटा जतन झालेला नाही.';
      setSheetError(offlineMsg);
      throw new Error(offlineMsg);
    }
    setSyncing(true);
    setSyncStatus('SYNCING');
    setSheetError('');
    try {
      const result = await fn();
      setSyncStatus('SYNCED');
      setLastSyncedAt(nowISO());
      return result;
    } catch (err) {
      setSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'FAILED');
      const msg = err instanceof Error ? err.message : 'डेटा अद्यतनित करताना त्रुटी आली.';
      const lower = msg.toLowerCase();
      if (
        lower.includes('invalid_token') ||
        lower.includes('unauthenticated') ||
        lower.includes('invalid authentication') ||
        msg.includes('401')
      ) {
        clearInMemoryAccessToken();
        setNeedsAuth(true);
      }
      setSheetError(msg);
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  const assertSessionEditableOnServer = async (
    session: VaccinationSession,
    activeDb?: SheetDatabase
  ): Promise<void> => {
    const liveSession =
      activeDb?.vaccinationSessions.find((s) => s.id === session.id) || session;
    if (liveSession.status === 'पूर्ण') {
      throw new Error(
        'हे लसीकरण सत्र पूर्ण (बंद) झालेले असल्यामुळे यापुढे डेटा एन्ट्री करता येणार नाही.'
      );
    }
    if (liveSession.status === 'लॉक') {
      throw new Error('हे लसीकरण सत्र लॉक असल्यामुळे यापुढे डेटा एन्ट्री करता येणार नाही.');
    }
    if (liveSession.status === 'रद्द') {
      throw new Error('हे लसीकरण सत्र रद्द केलेले असल्यामुळे त्यात बदल करता येणार नाही.');
    }
    const serverNowMs = new Date(await fetchServerNowISO()).getTime();
    const deadlineMs = new Date(liveSession.editDeadlineAt).getTime();
    const reopenedMs = liveSession.reopenedUntil ? new Date(liveSession.reopenedUntil).getTime() : 0;
    const withinWindow =
      (Number.isFinite(deadlineMs) && serverNowMs <= deadlineMs) ||
      (reopenedMs > 0 && serverNowMs <= reopenedMs);
    if (!withinWindow) {
      throw new Error(
        'सर्व्हर वेळेनुसार सत्राची २ दिवसांची संपादन मुदत संपली आहे (सत्र लॉक आहे). फक्त Admin सत्र पुन्हा उघडू शकतात.'
      );
    }
  };

  const saveSubcentre: SheetDataContextValue['saveSubcentre'] = async (data) => {
    let savedItem!: Subcentre;
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const existing = data.id ? activeDb.subcentres.find((s) => s.id === data.id) : undefined;
      const autoCode = existing
        ? existing.code?.trim() || buildNextSubcentreCode(activeDb.subcentres)
        : buildNextSubcentreCode(activeDb.subcentres);
      const item: Subcentre = {
        id: existing ? existing.id : generateId('sc'),
        code: autoCode,
        name: data.name.trim(),
        phcName: data.phcName.trim(),
        isActive: data.isActive,
        createdAt: existing ? existing.createdAt : ts,
        updatedAt: ts,
      };
      savedItem = item;
      const nextList = existing
        ? activeDb.subcentres.map((s) => (s.id === existing.id ? item : s))
        : [...activeDb.subcentres, item];

      const audit = buildAuditEntry(activeUser, {
        action: existing ? 'उपकेंद्र अद्यतनित' : 'नवीन उपकेंद्र नोंदवले',
        entityType: 'SUBCENTRE',
        recordId: item.id,
        previousValue: existing ? { code: existing.code, name: existing.name, isActive: existing.isActive } : null,
        newValue: { code: item.code, name: item.name, isActive: item.isActive },
      });

      if (existing) {
        await rewriteSheetTab(activeDb.spreadsheetId, 'subcentres', nextList as unknown as Record<string, unknown>[]);
      } else {
        await appendSheetRows(activeDb.spreadsheetId, 'subcentres', [item as unknown as Record<string, unknown>]);
      }
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              subcentres: nextList.sort((a, b) => a.name.localeCompare(b.name)),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
    return savedItem;
  };

  const saveVillage: SheetDataContextValue['saveVillage'] = async (data) => {
    let savedItem!: Village;
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const existing = data.id ? activeDb.villages.find((v) => v.id === data.id) : undefined;
      const autoVillageCode = existing
        ? existing.villageCode?.trim() || buildNextVillageCode(activeDb.villages)
        : buildNextVillageCode(activeDb.villages);
      const item: Village = {
        id: existing ? existing.id : generateId('vil'),
        villageCode: autoVillageCode,
        name: data.name.trim(),
        subcentreId: data.subcentreId,
        subcentreName: data.subcentreName,
        population: data.population ?? null,
        isActive: data.isActive,
        createdAt: existing ? existing.createdAt : ts,
        updatedAt: ts,
      };
      savedItem = item;
      const nextList = existing
        ? activeDb.villages.map((v) => (v.id === existing.id ? item : v))
        : [...activeDb.villages, item];

      const audit = buildAuditEntry(activeUser, {
        action: existing ? 'गाव माहिती अद्यतनित' : 'नवीन गाव नोंदवले',
        entityType: 'VILLAGE',
        recordId: item.id,
        previousValue: existing
          ? { villageCode: existing.villageCode, name: existing.name, subcentreName: existing.subcentreName }
          : null,
        newValue: { villageCode: item.villageCode, name: item.name, subcentreName: item.subcentreName, isActive: item.isActive },
      });

      if (existing) {
        await rewriteSheetTab(activeDb.spreadsheetId, 'villages', nextList as unknown as Record<string, unknown>[]);
      } else {
        await appendSheetRows(activeDb.spreadsheetId, 'villages', [item as unknown as Record<string, unknown>]);
      }
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              villages: nextList.sort((a, b) => a.name.localeCompare(b.name)),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
    return savedItem;
  };

  const saveStaff: SheetDataContextValue['saveStaff'] = async (data) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const existing = data.id ? activeDb.staff.find((s) => s.id === data.id) : undefined;
      const { id: _id, ...rest } = data;
      const item: StaffMember = {
        ...rest,
        id: existing ? existing.id : generateId('stf'),
        createdAt: existing ? existing.createdAt : ts,
        updatedAt: ts,
      };
      const nextList = existing
        ? activeDb.staff.map((s) => (s.id === existing.id ? item : s))
        : [...activeDb.staff, item];

      const audit = buildAuditEntry(activeUser, {
        action: existing ? 'कर्मचारी माहिती अद्यतनित' : 'नवीन कर्मचारी नोंदवला',
        entityType: 'STAFF',
        recordId: item.id,
        previousValue: existing ? { name: existing.name, designation: existing.designation } : null,
        newValue: { name: item.name, designation: item.designation, subcentreName: item.subcentreName },
      });

      if (existing) {
        await rewriteSheetTab(activeDb.spreadsheetId, 'staff', nextList as unknown as Record<string, unknown>[]);
      } else {
        await appendSheetRows(activeDb.spreadsheetId, 'staff', [item as unknown as Record<string, unknown>]);
      }
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              staff: nextList.sort((a, b) => a.name.localeCompare(b.name)),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
  };

  const saveUser: SheetDataContextValue['saveUser'] = async (data) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const cleanEmail = data.email.trim().toLowerCase();
      const existing = data.id
        ? activeDb.users.find((u) => u.id === data.id)
        : activeDb.users.find((u) => u.email.toLowerCase() === cleanEmail);
      const { id: _id, ...rest } = data;
      const item: AppUser = {
        ...rest,
        email: cleanEmail,
        id: existing ? existing.id : `usr_${cleanEmail}`,
        createdAt: existing ? existing.createdAt : ts,
      };
      const nextList = existing
        ? activeDb.users.map((u) => (u.id === existing.id ? item : u))
        : [...activeDb.users, item];

      const audit = buildAuditEntry(activeUser, {
        action: existing ? 'वापरकर्ता भूमिका अद्यतनित' : 'नवीन वापरकर्ता जोडला',
        entityType: 'USER',
        recordId: item.id,
        previousValue: existing ? { email: existing.email, role: existing.role, isActive: existing.isActive } : null,
        newValue: { email: item.email, role: item.role, isActive: item.isActive },
      });

      if (existing) {
        await rewriteSheetTab(activeDb.spreadsheetId, 'users', nextList as unknown as Record<string, unknown>[]);
      } else {
        await appendSheetRows(activeDb.spreadsheetId, 'users', [item as unknown as Record<string, unknown>]);
      }
      if ((fbUser?.email || '').toLowerCase() === CENTRAL_OWNER_EMAIL && cleanEmail !== CENTRAL_OWNER_EMAIL) {
        await shareSpreadsheetWithEmail(activeDb.spreadsheetId, cleanEmail).catch(() => undefined);
      }
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) => (prev ? { ...prev, users: nextList, auditLogs: [audit, ...prev.auditLogs] } : prev));
    });
  };

  const saveSystemSettings: SheetDataContextValue['saveSystemSettings'] = async (data) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const prevSetting = activeDb.systemSettings[0] ?? null;
      const item: SystemSettings = {
        id: 'phc_bhada_config',
        ...data,
        maternalServiceCatalogJson:
          data.maternalServiceCatalogJson ?? prevSetting?.maternalServiceCatalogJson ?? '',
        updatedBy: activeUser.email,
        updatedAt: ts,
      };
      const audit = buildAuditEntry(activeUser, {
        action: 'प्रणाली सेटिंग्ज अद्यतनित',
        entityType: 'SETTINGS',
        recordId: item.id,
        previousValue: prevSetting ? (prevSetting as unknown as Record<string, unknown>) : null,
        newValue: item as unknown as Record<string, unknown>,
      });

      await rewriteSheetTab(activeDb.spreadsheetId, 'systemSettings', [item as unknown as Record<string, unknown>]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev ? { ...prev, systemSettings: [item], auditLogs: [audit, ...prev.auditLogs] } : prev
      );
    });
  };

  const saveMaternalServiceCatalog: SheetDataContextValue['saveMaternalServiceCatalog'] = async (
    catalog
  ) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const prevSetting = activeDb.systemSettings[0];
      const item: SystemSettings = {
        id: prevSetting?.id || 'phc_bhada_config',
        phcName: prevSetting?.phcName || 'प्राथमिक आरोग्य केंद्र भादा',
        district: prevSetting?.district || 'लातूर',
        state: prevSetting?.state || 'महाराष्ट्र',
        timezone: 'Asia/Kolkata',
        allowEditDaysAfterSession: prevSetting?.allowEditDaysAfterSession ?? 2,
        maternalServiceCatalogJson: JSON.stringify(catalog),
        updatedBy: activeUser.email,
        updatedAt: ts,
      };
      const audit = buildAuditEntry(activeUser, {
        action: 'माता ANC सेवा यादी अद्यतनित',
        entityType: 'SETTINGS',
        recordId: item.id,
        newValue: { serviceCount: catalog.length },
      });

      await rewriteSheetTab(activeDb.spreadsheetId, 'systemSettings', [
        item as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);
      setDb((prev) =>
        prev ? { ...prev, systemSettings: [item], auditLogs: [audit, ...prev.auditLogs] } : prev
      );
    });
  };

  const buildNextBeneficiaryCode = (
    existingBeneficiaries: Beneficiary[],
    type: Beneficiary['beneficiaryType']
  ) => {
    const year = getTodayIST().slice(0, 4);
    const prefix = type === 'PREGNANT_WOMAN' ? `PHCB-PW-${year}-` : `PHCB-BEN-${year}-`;
    const maxSeq = existingBeneficiaries.reduce((acc, b) => {
      if (b.beneficiaryCode.startsWith(prefix)) {
        const num = parseInt(b.beneficiaryCode.slice(prefix.length), 10);
        return Number.isFinite(num) && num > acc ? num : acc;
      }
      return acc;
    }, 0);
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  };

  const buildNextEpisodeCode = (existingEpisodes: PregnancyEpisode[]) => {
    const year = getTodayIST().slice(0, 4);
    const prefix = `PHCB-PRG-${year}-`;
    const maxSeq = existingEpisodes.reduce((acc, e) => {
      if (e.episodeCode.startsWith(prefix)) {
        const num = parseInt(e.episodeCode.slice(prefix.length), 10);
        return Number.isFinite(num) && num > acc ? num : acc;
      }
      return acc;
    }, 0);
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  };

  const assertNoDuplicateBeneficiary = (
    activeDb: SheetDatabase,
    data: Omit<Beneficiary, 'id' | 'beneficiaryCode' | 'dedupeKey' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    cleanAadhaar: string
  ) => {
    const bType = data.beneficiaryType || 'CHILD';
    const guardianOrMother =
      bType === 'PREGNANT_WOMAN'
        ? data.guardianName || data.fatherName || ''
        : data.motherName || data.guardianName || '';
    const primaryKey = normalizeBeneficiaryDedupeKey({
      beneficiaryType: bType,
      fullName: data.childName,
      guardianOrMotherName: guardianOrMother,
      dob: data.dob,
      mobile: data.mobile,
    });
    const legacyKey = normalizeDedupeKey(data.childName, data.motherName || guardianOrMother, data.dob);

    const matched = activeDb.beneficiaries.find(
      (b) =>
        b.dedupeKey === primaryKey ||
        b.dedupeKey === legacyKey ||
        (cleanAadhaar && b.aadhaarNumber && b.aadhaarNumber === cleanAadhaar)
    );
    if (matched) {
      throw new Error(
        `हा लाभार्थी आधीच नोंदलेला आहे (${matched.childName} · ${matched.beneficiaryCode}). कृपया विद्यमान लाभार्थी निवडा.`
      );
    }
    return primaryKey;
  };

  const registerBeneficiary: SheetDataContextValue['registerBeneficiary'] = async (
    data,
    initialEpisode
  ) => {
    return await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const bType = data.beneficiaryType || 'CHILD';
      const cleanAadhaar = sanitizeOptionalAadhaar(data.aadhaarNumber);
      const dedupeKey = assertNoDuplicateBeneficiary(activeDb, data, cleanAadhaar);

      const beneficiaryCode = buildNextBeneficiaryCode(activeDb.beneficiaries, bType);
      const ts = nowISO();

      const item: Beneficiary = {
        ...data,
        beneficiaryType: bType,
        guardianName:
          data.guardianName?.trim() || data.fatherName?.trim() || data.motherName?.trim() || '',
        aadhaarNumber: cleanAadhaar,
        caste: data.caste?.trim() || '',
        category: data.category?.trim() || '',
        id: generateId('ben'),
        beneficiaryCode,
        dedupeKey,
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      let createdEpisode: PregnancyEpisode | undefined;
      const auditEntries: AuditLog[] = [
        buildAuditEntry(activeUser, {
          action: bType === 'PREGNANT_WOMAN' ? 'नवीन गरोदर माता नोंदणी' : 'नवीन बालक लाभार्थी नोंदणी',
          entityType: 'BENEFICIARY',
          recordId: item.id,
          newValue: maskSensitiveFieldsForAudit({
            beneficiaryCode,
            beneficiaryType: bType,
            childName: item.childName,
            guardianName: item.guardianName,
            dob: item.dob,
            villageName: item.villageName,
            aadhaarNumber: cleanAadhaar,
          }),
        }),
      ];

      if (bType === 'PREGNANT_WOMAN' && initialEpisode) {
        const episodeCode = buildNextEpisodeCode(activeDb.pregnancyEpisodes);
        const edd = initialEpisode.eddDate || calculateEddFromMcDate(initialEpisode.mcDate);
        const gSummary = formatGravidaSummary({
          gravida: initialEpisode.gravida,
          para: initialEpisode.para,
          abortions: initialEpisode.abortions,
          livingChildren: initialEpisode.livingChildren,
          fallbackText: initialEpisode.gravidaPara?.trim() || '',
        });
        createdEpisode = {
          id: generateId('prg'),
          episodeCode,
          beneficiaryId: item.id,
          beneficiaryCode: item.beneficiaryCode,
          mcDate: initialEpisode.mcDate,
          eddDate: edd,
          expectedDeliveryPlace: initialEpisode.expectedDeliveryPlace.trim(),
          deliveryFacilityType: initialEpisode.deliveryFacilityType,
          hospitalName: initialEpisode.hospitalName.trim(),
          pregnancyRegistrationDate:
            initialEpisode.pregnancyRegistrationDate || item.registrationDate,
          pregnancyStatus: initialEpisode.pregnancyStatus || 'सक्रिय',
          gravidaPara: gSummary !== '-' ? gSummary : initialEpisode.gravidaPara?.trim() || '',
          gravida: initialEpisode.gravida ?? null,
          para: initialEpisode.para ?? null,
          abortions: initialEpisode.abortions ?? null,
          livingChildren: initialEpisode.livingChildren ?? null,
          previousPregnancyHistory: initialEpisode.previousPregnancyHistory?.trim() || '',
          previousCaesarean: initialEpisode.previousCaesarean || '',
          previousComplications: initialEpisode.previousComplications?.trim() || '',
          bloodGroup: initialEpisode.bloodGroup || item.bloodGroup || '',
          rhFactor: initialEpisode.rhFactor || item.rhFactor || '',
          eddHistoryJson: '[]',
          isHighRisk: false,
          highRiskReasonsJson: '[]',
          currentHrpStatus: 'Normal',
          outcomeDate: '',
          notes: initialEpisode.notes?.trim() || '',
          createdBy: activeUser.email,
          createdAt: ts,
          updatedAt: ts,
        };
        auditEntries.push(
          buildAuditEntry(activeUser, {
            action: 'नवीन गर्भधारणा नोंदणी (Pregnancy Episode)',
            entityType: 'PREGNANCY_EPISODE',
            recordId: createdEpisode.id,
            newValue: {
              episodeCode,
              beneficiaryCode,
              mcDate: createdEpisode.mcDate,
              eddDate: createdEpisode.eddDate,
              deliveryFacilityType: createdEpisode.deliveryFacilityType,
            },
          })
        );
      }

      await appendSheetRows(activeDb.spreadsheetId, 'beneficiaries', [
        item as unknown as Record<string, unknown>,
      ]);
      if (createdEpisode) {
        await appendSheetRows(activeDb.spreadsheetId, 'pregnancyEpisodes', [
          createdEpisode as unknown as Record<string, unknown>,
        ]);
      }
      await appendSheetRows(
        activeDb.spreadsheetId,
        'auditLogs',
        auditEntries as unknown as Record<string, unknown>[]
      );
      setDb((prev) =>
        prev
          ? {
              ...prev,
              beneficiaries: [...prev.beneficiaries, item],
              pregnancyEpisodes: createdEpisode
                ? [createdEpisode, ...prev.pregnancyEpisodes]
                : prev.pregnancyEpisodes,
              auditLogs: [...auditEntries.slice().reverse(), ...prev.auditLogs],
            }
          : prev
      );
      return { beneficiary: item, episode: createdEpisode };
    });
  };

  const registerBeneficiaryAndAddToSession: SheetDataContextValue['registerBeneficiaryAndAddToSession'] =
    async (session, data, initialEpisode) => {
      return await withSync(async () => {
        const { activeDb, activeUser } = requireDbAndUser();
        await assertSessionEditableOnServer(session, activeDb);

        const bType = data.beneficiaryType || 'CHILD';
        const cleanAadhaar = sanitizeOptionalAadhaar(data.aadhaarNumber);
        const dedupeKey = assertNoDuplicateBeneficiary(activeDb, data, cleanAadhaar);

        const beneficiaryCode = buildNextBeneficiaryCode(activeDb.beneficiaries, bType);
        const ts = nowISO();

        const beneficiaryItem: Beneficiary = {
          ...data,
          beneficiaryType: bType,
          guardianName:
            data.guardianName?.trim() || data.fatherName?.trim() || data.motherName?.trim() || '',
          aadhaarNumber: cleanAadhaar,
          caste: data.caste?.trim() || '',
          category: data.category?.trim() || '',
          id: generateId('ben'),
          beneficiaryCode,
          dedupeKey,
          createdBy: activeUser.email,
          createdAt: ts,
          updatedAt: ts,
        };

        let createdEpisode: PregnancyEpisode | undefined;
        if (bType === 'PREGNANT_WOMAN' && initialEpisode) {
          const episodeCode = buildNextEpisodeCode(activeDb.pregnancyEpisodes);
          const edd = initialEpisode.eddDate || calculateEddFromMcDate(initialEpisode.mcDate);
          const gSummary = formatGravidaSummary({
            gravida: initialEpisode.gravida,
            para: initialEpisode.para,
            abortions: initialEpisode.abortions,
            livingChildren: initialEpisode.livingChildren,
            fallbackText: initialEpisode.gravidaPara?.trim() || '',
          });
          createdEpisode = {
            id: generateId('prg'),
            episodeCode,
            beneficiaryId: beneficiaryItem.id,
            beneficiaryCode: beneficiaryItem.beneficiaryCode,
            mcDate: initialEpisode.mcDate,
            eddDate: edd,
            expectedDeliveryPlace: initialEpisode.expectedDeliveryPlace.trim(),
            deliveryFacilityType: initialEpisode.deliveryFacilityType,
            hospitalName: initialEpisode.hospitalName.trim(),
            pregnancyRegistrationDate:
              initialEpisode.pregnancyRegistrationDate || beneficiaryItem.registrationDate,
            pregnancyStatus: initialEpisode.pregnancyStatus || 'सक्रिय',
            gravidaPara: gSummary !== '-' ? gSummary : initialEpisode.gravidaPara?.trim() || '',
            gravida: initialEpisode.gravida ?? null,
            para: initialEpisode.para ?? null,
            abortions: initialEpisode.abortions ?? null,
            livingChildren: initialEpisode.livingChildren ?? null,
            previousPregnancyHistory: initialEpisode.previousPregnancyHistory?.trim() || '',
            previousCaesarean: initialEpisode.previousCaesarean || '',
            previousComplications: initialEpisode.previousComplications?.trim() || '',
            bloodGroup: initialEpisode.bloodGroup || beneficiaryItem.bloodGroup || '',
            rhFactor: initialEpisode.rhFactor || beneficiaryItem.rhFactor || '',
            eddHistoryJson: '[]',
            isHighRisk: false,
            highRiskReasonsJson: '[]',
            currentHrpStatus: 'Normal',
            outcomeDate: '',
            notes: initialEpisode.notes?.trim() || '',
            createdBy: activeUser.email,
            createdAt: ts,
            updatedAt: ts,
          };
        }

        const sbItem: SessionBeneficiary = {
          id: `${session.id}_${beneficiaryItem.id}`,
          sessionId: session.id,
          beneficiaryId: beneficiaryItem.id,
          beneficiaryCode: beneficiaryItem.beneficiaryCode,
          beneficiaryType: bType,
          pregnancyEpisodeId: createdEpisode?.id || '',
          childName: beneficiaryItem.childName,
          dob: beneficiaryItem.dob,
          gender: beneficiaryItem.gender,
          subcentreId: beneficiaryItem.subcentreId,
          villageId: beneficiaryItem.villageId,
          addedBy: activeUser.email,
          addedAt: ts,
          enrollmentType: 'NEW',
          remarks: '',
        };

        const audits: AuditLog[] = [
          buildAuditEntry(activeUser, {
            action:
              bType === 'PREGNANT_WOMAN'
                ? 'सत्रादरम्यान नवीन गरोदर माता नोंदणी'
                : 'सत्रादरम्यान नवीन बालक लाभार्थी नोंदणी',
            entityType: 'BENEFICIARY',
            recordId: beneficiaryItem.id,
            newValue: maskSensitiveFieldsForAudit({
              beneficiaryCode,
              beneficiaryType: bType,
              childName: beneficiaryItem.childName,
              dob: beneficiaryItem.dob,
              villageName: beneficiaryItem.villageName,
              sessionId: session.id,
              aadhaarNumber: cleanAadhaar,
            }),
          }),
          buildAuditEntry(activeUser, {
            action: 'नवीन लाभार्थी आजच्या सत्रात समाविष्ट केला',
            entityType: 'SESSION',
            recordId: session.id,
            newValue: {
              beneficiaryId: beneficiaryItem.id,
              beneficiaryType: bType,
              childName: beneficiaryItem.childName,
              enrollmentType: 'NEW',
              pregnancyEpisodeId: createdEpisode?.id || '',
            },
          }),
        ];

        if (createdEpisode) {
          audits.push(
            buildAuditEntry(activeUser, {
              action: 'सत्रादरम्यान नवीन गर्भधारणा नोंदणी',
              entityType: 'PREGNANCY_EPISODE',
              recordId: createdEpisode.id,
              newValue: {
                episodeCode: createdEpisode.episodeCode,
                mcDate: createdEpisode.mcDate,
                eddDate: createdEpisode.eddDate,
              },
            })
          );
        }

        await appendSheetRows(activeDb.spreadsheetId, 'beneficiaries', [
          beneficiaryItem as unknown as Record<string, unknown>,
        ]);
        if (createdEpisode) {
          await appendSheetRows(activeDb.spreadsheetId, 'pregnancyEpisodes', [
            createdEpisode as unknown as Record<string, unknown>,
          ]);
        }
        await appendSheetRows(activeDb.spreadsheetId, 'sessionBeneficiaries', [
          sbItem as unknown as Record<string, unknown>,
        ]);
        await appendSheetRows(
          activeDb.spreadsheetId,
          'auditLogs',
          audits as unknown as Record<string, unknown>[]
        );

        setDb((prev) =>
          prev
            ? {
                ...prev,
                beneficiaries: [...prev.beneficiaries, beneficiaryItem],
                pregnancyEpisodes: createdEpisode
                  ? [createdEpisode, ...prev.pregnancyEpisodes]
                  : prev.pregnancyEpisodes,
                sessionBeneficiaries: [...prev.sessionBeneficiaries, sbItem],
                auditLogs: [...audits.slice().reverse(), ...prev.auditLogs],
              }
            : prev
        );

        return { beneficiary: beneficiaryItem, episode: createdEpisode };
      });
    };

  const updateBeneficiary: SheetDataContextValue['updateBeneficiary'] = async (id, updates) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const existing = activeDb.beneficiaries.find((b) => b.id === id);
      if (!existing) throw new Error('लाभार्थी आढळला नाही.');

      const nextType = updates.beneficiaryType ?? existing.beneficiaryType ?? 'CHILD';
      const childName = updates.childName ?? existing.childName;
      const motherName = updates.motherName ?? existing.motherName;
      const guardianName = updates.guardianName ?? existing.guardianName ?? existing.fatherName;
      const dob = updates.dob ?? existing.dob;
      const mobile = updates.mobile ?? existing.mobile;
      const cleanAadhaar =
        updates.aadhaarNumber !== undefined
          ? sanitizeOptionalAadhaar(updates.aadhaarNumber)
          : existing.aadhaarNumber || '';

      if (
        cleanAadhaar &&
        activeDb.beneficiaries.some((b) => b.id !== id && b.aadhaarNumber === cleanAadhaar)
      ) {
        throw new Error('हा आधार क्रमांक आधीच दुसऱ्या लाभार्थ्याकडे नोंदलेला आहे.');
      }

      const dedupeKey = normalizeBeneficiaryDedupeKey({
        beneficiaryType: nextType,
        fullName: childName,
        guardianOrMotherName: nextType === 'PREGNANT_WOMAN' ? guardianName : motherName,
        dob,
        mobile,
      });

      const updated: Beneficiary = {
        ...existing,
        ...updates,
        beneficiaryType: nextType,
        guardianName,
        aadhaarNumber: cleanAadhaar,
        dedupeKey,
        updatedAt: nowISO(),
      };
      const nextList = activeDb.beneficiaries.map((b) => (b.id === id ? updated : b));

      const audit = buildAuditEntry(activeUser, {
        action: 'लाभार्थी कायमस्वरूपी प्रोफाइल दुरुस्ती',
        entityType: 'BENEFICIARY',
        recordId: id,
        previousValue: maskSensitiveFieldsForAudit({
          childName: existing.childName,
          guardianName: existing.guardianName,
          mobile: existing.mobile,
          villageName: existing.villageName,
          caste: existing.caste,
          category: existing.category,
          aadhaarNumber: existing.aadhaarNumber,
          status: existing.status,
        }),
        newValue: maskSensitiveFieldsForAudit(updates as Record<string, unknown>),
      });

      await rewriteSheetTab(activeDb.spreadsheetId, 'beneficiaries', nextList as unknown as Record<string, unknown>[]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev ? { ...prev, beneficiaries: nextList, auditLogs: [audit, ...prev.auditLogs] } : prev
      );
    });
  };

  const createPregnancyEpisode: SheetDataContextValue['createPregnancyEpisode'] = async (
    beneficiary,
    episodeData
  ) => {
    return await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const episodeCode = buildNextEpisodeCode(activeDb.pregnancyEpisodes);
      const eddDate = episodeData.eddDate || calculateEddFromMcDate(episodeData.mcDate);
      const gSummary = formatGravidaSummary({
        gravida: episodeData.gravida,
        para: episodeData.para,
        abortions: episodeData.abortions,
        livingChildren: episodeData.livingChildren,
        fallbackText: episodeData.gravidaPara?.trim() || '',
      });
      const item: PregnancyEpisode = {
        id: generateId('prg'),
        episodeCode,
        beneficiaryId: beneficiary.id,
        beneficiaryCode: beneficiary.beneficiaryCode,
        mcDate: episodeData.mcDate,
        eddDate,
        expectedDeliveryPlace: episodeData.expectedDeliveryPlace.trim(),
        deliveryFacilityType: episodeData.deliveryFacilityType,
        hospitalName: episodeData.hospitalName.trim(),
        pregnancyRegistrationDate: episodeData.pregnancyRegistrationDate || getTodayIST(),
        pregnancyStatus: episodeData.pregnancyStatus || 'सक्रिय',
        gravidaPara: gSummary !== '-' ? gSummary : episodeData.gravidaPara?.trim() || '',
        gravida: episodeData.gravida ?? null,
        para: episodeData.para ?? null,
        abortions: episodeData.abortions ?? null,
        livingChildren: episodeData.livingChildren ?? null,
        previousPregnancyHistory: episodeData.previousPregnancyHistory?.trim() || '',
        previousCaesarean: episodeData.previousCaesarean || '',
        previousComplications: episodeData.previousComplications?.trim() || '',
        bloodGroup: episodeData.bloodGroup || beneficiary.bloodGroup || '',
        rhFactor: episodeData.rhFactor || beneficiary.rhFactor || '',
        eddHistoryJson: '[]',
        isHighRisk: false,
        highRiskReasonsJson: '[]',
        currentHrpStatus: 'Normal',
        outcomeDate: '',
        notes: episodeData.notes?.trim() || '',
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      const audit = buildAuditEntry(activeUser, {
        action: 'नवीन गर्भधारणा प्रकरण (Pregnancy Episode) जोडले',
        entityType: 'PREGNANCY_EPISODE',
        recordId: item.id,
        newValue: {
          episodeCode,
          beneficiaryCode: beneficiary.beneficiaryCode,
          mcDate: item.mcDate,
          eddDate: item.eddDate,
          deliveryFacilityType: item.deliveryFacilityType,
        },
      });

      await appendSheetRows(activeDb.spreadsheetId, 'pregnancyEpisodes', [
        item as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              pregnancyEpisodes: [item, ...prev.pregnancyEpisodes],
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
      return item;
    });
  };

  const updatePregnancyEpisode: SheetDataContextValue['updatePregnancyEpisode'] = async (
    episodeId,
    updates,
    eddChangeReason
  ) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const existing = activeDb.pregnancyEpisodes.find((e) => e.id === episodeId);
      if (!existing) throw new Error('गर्भधारणा नोंद आढळली नाही.');
      const nextMc = updates.mcDate ?? existing.mcDate;
      const nextEdd =
        updates.eddDate ??
        (updates.mcDate && updates.mcDate !== existing.mcDate
          ? calculateEddFromMcDate(nextMc)
          : existing.eddDate);

      let eddHistoryJson = existing.eddHistoryJson || '[]';
      if (existing.eddDate && nextEdd && nextEdd !== existing.eddDate) {
        const hist = parseJsonArraySafe<EddHistoryEntry>(existing.eddHistoryJson);
        hist.push({
          previousEddDate: existing.eddDate,
          newEddDate: nextEdd,
          changedAt: nowISO(),
          changedBy: activeUser.name || activeUser.email,
          reason: eddChangeReason || 'तपासणीनुसार अद्यतनित',
        });
        eddHistoryJson = JSON.stringify(hist);
      }

      const gSummary = formatGravidaSummary({
        gravida: updates.gravida !== undefined ? updates.gravida : existing.gravida,
        para: updates.para !== undefined ? updates.para : existing.para,
        abortions: updates.abortions !== undefined ? updates.abortions : existing.abortions,
        livingChildren:
          updates.livingChildren !== undefined ? updates.livingChildren : existing.livingChildren,
        fallbackText: updates.gravidaPara ?? existing.gravidaPara ?? '',
      });

      const updated: PregnancyEpisode = {
        ...existing,
        ...updates,
        mcDate: nextMc,
        eddDate: nextEdd,
        eddHistoryJson: updates.eddHistoryJson ?? eddHistoryJson,
        gravidaPara: gSummary !== '-' ? gSummary : updates.gravidaPara ?? existing.gravidaPara,
        updatedAt: nowISO(),
      };
      const nextList = activeDb.pregnancyEpisodes.map((e) => (e.id === episodeId ? updated : e));
      const audit = buildAuditEntry(activeUser, {
        action: 'गर्भधारणा तपशील अद्यतनित',
        entityType: 'PREGNANCY_EPISODE',
        recordId: episodeId,
        previousValue: {
          mcDate: existing.mcDate,
          eddDate: existing.eddDate,
          pregnancyStatus: existing.pregnancyStatus,
        },
        newValue: updates as Record<string, unknown>,
      });

      await rewriteSheetTab(
        activeDb.spreadsheetId,
        'pregnancyEpisodes',
        nextList as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);
      setDb((prev) =>
        prev ? { ...prev, pregnancyEpisodes: nextList, auditLogs: [audit, ...prev.auditLogs] } : prev
      );
    });
  };

  const createSession: SheetDataContextValue['createSession'] = async (data) => {
    return await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const compactDate = data.sessionDate.replace(/-/g, '');
      const prefix = `PHCB-SES-${compactDate}-`;
      const maxSeq = activeDb.vaccinationSessions.reduce((acc, s) => {
        if (s.sessionCode.startsWith(prefix)) {
          const num = parseInt(s.sessionCode.slice(prefix.length), 10);
          return Number.isFinite(num) && num > acc ? num : acc;
        }
        return acc;
      }, 0);
      const sessionCode = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
      const editDays = activeDb.systemSettings[0]?.allowEditDaysAfterSession ?? 2;
      const editDeadlineAt = computeSessionEditDeadlineISO(data.sessionDate, editDays);
      const ts = nowISO();

      const item: VaccinationSession = {
        ...data,
        id: generateId('ses'),
        sessionCode,
        editDeadlineAt,
        reopenedUntil: null,
        reopenedBy: null,
        reopenReason: null,
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      const audit = buildAuditEntry(activeUser, {
        action: 'लसीकरण सत्र तयार केले',
        entityType: 'SESSION',
        recordId: item.id,
        newValue: {
          sessionCode,
          villageName: item.villageName,
          sessionDate: item.sessionDate,
          location: item.location,
        },
      });

      await appendSheetRows(activeDb.spreadsheetId, 'vaccinationSessions', [
        item as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              vaccinationSessions: [item, ...prev.vaccinationSessions].sort((a, b) =>
                b.sessionDate.localeCompare(a.sessionDate)
              ),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
      return item;
    });
  };

  const updateSession: SheetDataContextValue['updateSession'] = async (sessionId, updates) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const existing = activeDb.vaccinationSessions.find((s) => s.id === sessionId);
      if (!existing) throw new Error('सत्र आढळले नाही.');
      if (activeUser.role !== 'ADMIN') {
        await assertSessionEditableOnServer(existing, activeDb);
      }

      const editDays = activeDb.systemSettings[0]?.allowEditDaysAfterSession ?? 2;
      const nextDeadline =
        updates.sessionDate && updates.sessionDate !== existing.sessionDate
          ? computeSessionEditDeadlineISO(updates.sessionDate, editDays)
          : existing.editDeadlineAt;

      const updated: VaccinationSession = {
        ...existing,
        ...updates,
        editDeadlineAt: nextDeadline,
        updatedAt: nowISO(),
      };
      const nextList = activeDb.vaccinationSessions.map((s) => (s.id === sessionId ? updated : s));

      const audit = buildAuditEntry(activeUser, {
        action: 'लसीकरण सत्र अद्यतनित',
        entityType: 'SESSION',
        recordId: sessionId,
        previousValue: { status: existing.status, sessionDate: existing.sessionDate, location: existing.location },
        newValue: updates as Record<string, unknown>,
      });

      await rewriteSheetTab(
        activeDb.spreadsheetId,
        'vaccinationSessions',
        nextList as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              vaccinationSessions: nextList.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate)),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
  };

  const completeSession: SheetDataContextValue['completeSession'] = async (sessionId) => {
    return await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const existing = activeDb.vaccinationSessions.find((s) => s.id === sessionId);
      if (!existing) throw new Error('सत्र आढळले नाही.');
      if (activeUser.role !== 'ADMIN') {
        await assertSessionEditableOnServer(existing, activeDb);
      }

      const completedAt = await fetchServerNowISO();
      const updated: VaccinationSession = {
        ...existing,
        status: 'पूर्ण',
        reopenedUntil: null,
        completedAt,
        completedBy: activeUser.email,
        updatedAt: completedAt,
      };
      const nextList = activeDb.vaccinationSessions.map((s) => (s.id === sessionId ? updated : s));

      const audit = buildAuditEntry(activeUser, {
        action: 'लसीकरण सत्र पूर्ण केले',
        entityType: 'SESSION',
        recordId: sessionId,
        previousValue: { status: existing.status },
        newValue: { status: 'पूर्ण', completedAt, completedBy: activeUser.email },
      });

      await rewriteSheetTab(
        activeDb.spreadsheetId,
        'vaccinationSessions',
        nextList as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              vaccinationSessions: nextList.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate)),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
      return updated;
    });
  };

  const reopenLockedSession: SheetDataContextValue['reopenLockedSession'] = async (
    sessionId,
    hoursToKeepOpen,
    reason
  ) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      if (activeUser.role !== 'ADMIN') {
        throw new Error('लॉक केलेले सत्र पुन्हा उघडण्याचा अधिकार फक्त Admin यांना आहे.');
      }
      if (!reason.trim()) {
        throw new Error('सत्र पुन्हा उघडण्याचे कारण नमूद करणे आवश्यक आहे.');
      }
      const existing = activeDb.vaccinationSessions.find((s) => s.id === sessionId);
      if (!existing) throw new Error('सत्र आढळले नाही.');

      const reopenedUntil = new Date(Date.now() + hoursToKeepOpen * 3600 * 1000).toISOString();
      const updated: VaccinationSession = {
        ...existing,
        status: 'सुरू',
        reopenedUntil,
        reopenedBy: activeUser.email,
        reopenReason: reason.trim(),
        updatedAt: nowISO(),
      };
      const nextList = activeDb.vaccinationSessions.map((s) => (s.id === sessionId ? updated : s));

      const audit = buildAuditEntry(activeUser, {
        action: 'लॉक केलेले सत्र प्रशासकाद्वारे पुन्हा उघडले',
        entityType: 'SESSION',
        recordId: sessionId,
        previousValue: { status: existing.status },
        newValue: { status: 'सुरू', hoursToKeepOpen },
        reason: reason.trim(),
      });

      await rewriteSheetTab(
        activeDb.spreadsheetId,
        'vaccinationSessions',
        nextList as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev ? { ...prev, vaccinationSessions: nextList, auditLogs: [audit, ...prev.auditLogs] } : prev
      );
    });
  };

  const addBeneficiaryToSession: SheetDataContextValue['addBeneficiaryToSession'] = async (
    session,
    beneficiary,
    enrollmentType = 'EXISTING',
    remarks = '',
    pregnancyEpisodeId = ''
  ) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      await assertSessionEditableOnServer(session, activeDb);
      const docId = `${session.id}_${beneficiary.id}`;
      if (activeDb.sessionBeneficiaries.some((sb) => sb.id === docId)) {
        throw new Error('हा लाभार्थी या सत्रात आधीच समाविष्ट आहे.');
      }
      const bType = beneficiary.beneficiaryType || 'CHILD';
      let resolvedEpisodeId = pregnancyEpisodeId;
      if (bType === 'PREGNANT_WOMAN' && !resolvedEpisodeId) {
        const activeEp =
          activeDb.pregnancyEpisodes.find(
            (ep) => ep.beneficiaryId === beneficiary.id && ep.pregnancyStatus === 'सक्रिय'
          ) || activeDb.pregnancyEpisodes.find((ep) => ep.beneficiaryId === beneficiary.id);
        resolvedEpisodeId = activeEp?.id || '';
      }

      const item: SessionBeneficiary = {
        id: docId,
        sessionId: session.id,
        beneficiaryId: beneficiary.id,
        beneficiaryCode: beneficiary.beneficiaryCode,
        beneficiaryType: bType,
        pregnancyEpisodeId: resolvedEpisodeId,
        childName: beneficiary.childName,
        dob: beneficiary.dob,
        gender: beneficiary.gender,
        subcentreId: beneficiary.subcentreId,
        villageId: beneficiary.villageId,
        addedBy: activeUser.email,
        addedAt: nowISO(),
        enrollmentType,
        remarks: remarks.trim(),
      };
      const audit = buildAuditEntry(activeUser, {
        action: 'सत्रात लाभार्थी समाविष्ट केला',
        entityType: 'SESSION',
        recordId: session.id,
        newValue: {
          beneficiaryId: beneficiary.id,
          beneficiaryType: bType,
          pregnancyEpisodeId: resolvedEpisodeId,
          childName: beneficiary.childName,
        },
      });

      await appendSheetRows(activeDb.spreadsheetId, 'sessionBeneficiaries', [
        item as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              sessionBeneficiaries: [...prev.sessionBeneficiaries, item],
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
  };

  const removeBeneficiaryFromSession: SheetDataContextValue['removeBeneficiaryFromSession'] = async (
    session,
    sbId
  ) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      await assertSessionEditableOnServer(session, activeDb);
      const target = activeDb.sessionBeneficiaries.find((sb) => sb.id === sbId);
      if (!target) return;
      const nextList = activeDb.sessionBeneficiaries.filter((sb) => sb.id !== sbId);
      const audit = buildAuditEntry(activeUser, {
        action: 'सत्रातून लाभार्थी काढला',
        entityType: 'SESSION',
        recordId: session.id,
        previousValue: { beneficiaryId: target.beneficiaryId, childName: target.childName },
      });
      await rewriteSheetTab(
        activeDb.spreadsheetId,
        'sessionBeneficiaries',
        nextList as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev ? { ...prev, sessionBeneficiaries: nextList, auditLogs: [audit, ...prev.auditLogs] } : prev
      );
    });
  };

  const saveVaccineMaster: SheetDataContextValue['saveVaccineMaster'] = async (data) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const existing = data.id ? activeDb.vaccineMaster.find((v) => v.id === data.id) : undefined;
      const { id: _id, ...rest } = data;
      const item: VaccineMaster = {
        ...rest,
        id: existing ? existing.id : generateId('vac'),
        createdAt: existing ? existing.createdAt : ts,
        updatedAt: ts,
      };
      const nextList = existing
        ? activeDb.vaccineMaster.map((v) => (v.id === existing.id ? item : v))
        : [...activeDb.vaccineMaster, item];

      const audit = buildAuditEntry(activeUser, {
        action: existing ? 'लस मास्टर अद्यतनित' : 'नवीन लस जोडली',
        entityType: 'VACCINE_MASTER',
        recordId: item.id,
        previousValue: existing ? { vaccineName: existing.vaccineName } : null,
        newValue: { vaccineName: item.vaccineName, isActive: item.isActive },
      });

      if (existing) {
        await rewriteSheetTab(
          activeDb.spreadsheetId,
          'vaccineMaster',
          nextList as unknown as Record<string, unknown>[]
        );
      } else {
        await appendSheetRows(activeDb.spreadsheetId, 'vaccineMaster', [
          item as unknown as Record<string, unknown>,
        ]);
      }
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              vaccineMaster: nextList.sort((a, b) => a.displayOrder - b.displayOrder),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
  };

  const saveVaccineSchedule: SheetDataContextValue['saveVaccineSchedule'] = async (data) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const existing = data.id ? activeDb.vaccineSchedule.find((s) => s.id === data.id) : undefined;
      const { id: _id, ...rest } = data;
      const item: VaccineSchedule = {
        ...rest,
        id: existing ? existing.id : generateId('sch'),
        validatedBy: rest.isValidated ? activeUser.email : '',
        validatedAt: rest.isValidated ? ts : '',
        createdAt: existing ? existing.createdAt : ts,
        updatedAt: ts,
      };
      const nextList = existing
        ? activeDb.vaccineSchedule.map((s) => (s.id === existing.id ? item : s))
        : [...activeDb.vaccineSchedule, item];

      const audit = buildAuditEntry(activeUser, {
        action: existing ? 'लसीकरण वेळापत्रक अद्यतनित' : 'नवीन डोस वेळापत्रक जोडले',
        entityType: 'VACCINE_SCHEDULE',
        recordId: item.id,
        previousValue: existing ? { doseName: existing.doseName, isValidated: existing.isValidated } : null,
        newValue: { doseName: item.doseName, isValidated: item.isValidated, isActive: item.isActive },
      });

      if (existing) {
        await rewriteSheetTab(
          activeDb.spreadsheetId,
          'vaccineSchedule',
          nextList as unknown as Record<string, unknown>[]
        );
      } else {
        await appendSheetRows(activeDb.spreadsheetId, 'vaccineSchedule', [
          item as unknown as Record<string, unknown>,
        ]);
      }
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              vaccineSchedule: nextList.sort((a, b) => a.doseOrder - b.doseOrder),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
  };

  const seedStandardNIS: SheetDataContextValue['seedStandardNIS'] = async () => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const { masters, schedules } = buildStandardNISData(activeUser.email);

      const existingMasterIds = new Set(activeDb.vaccineMaster.map((m) => m.id));
      const newMasters = masters.filter((m) => !existingMasterIds.has(m.id));
      const nextMasters = [...activeDb.vaccineMaster, ...newMasters].sort(
        (a, b) => a.displayOrder - b.displayOrder
      );

      const existingSchIds = new Set(activeDb.vaccineSchedule.map((s) => s.id));
      const newSchedules = schedules.filter((s) => !existingSchIds.has(s.id));
      const nextSchedules = [...activeDb.vaccineSchedule, ...newSchedules].sort(
        (a, b) => a.doseOrder - b.doseOrder
      );

      if (newMasters.length > 0) {
        await appendSheetRows(
          activeDb.spreadsheetId,
          'vaccineMaster',
          newMasters as unknown as Record<string, unknown>[]
        );
      }
      if (newSchedules.length > 0) {
        await appendSheetRows(
          activeDb.spreadsheetId,
          'vaccineSchedule',
          newSchedules as unknown as Record<string, unknown>[]
        );
      }

      const audit = buildAuditEntry(activeUser, {
        action: 'राष्ट्रीय लसीकरण वेळापत्रक (NIS) प्रणालीत भरले',
        entityType: 'VACCINE_SCHEDULE',
        recordId: 'nis_seed',
        newValue: { addedVaccines: newMasters.length, addedDoses: newSchedules.length },
      });
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);

      setDb((prev) =>
        prev
          ? {
              ...prev,
              vaccineMaster: nextMasters,
              vaccineSchedule: nextSchedules,
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
  };

  const seedStarterHierarchy: SheetDataContextValue['seedStarterHierarchy'] = async () => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const { subcentres, villages } = buildPhcBhadaStarterHierarchy();

      const existingSc = new Set(activeDb.subcentres.map((s) => s.id));
      const newSc = subcentres.filter((s) => !existingSc.has(s.id));
      const existingVil = new Set(activeDb.villages.map((v) => v.id));
      const newVil = villages.filter((v) => !existingVil.has(v.id));

      if (newSc.length > 0) {
        await appendSheetRows(activeDb.spreadsheetId, 'subcentres', newSc as unknown as Record<string, unknown>[]);
      }
      if (newVil.length > 0) {
        await appendSheetRows(activeDb.spreadsheetId, 'villages', newVil as unknown as Record<string, unknown>[]);
      }

      const audit = buildAuditEntry(activeUser, {
        action: 'भादा प्राथमिक आरोग्य केंद्र नमुना उपकेंद्रे व गावे भरली',
        entityType: 'SETTINGS',
        recordId: 'phc_bhada_seed',
        newValue: { subcentresAdded: newSc.length, villagesAdded: newVil.length },
      });
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);

      setDb((prev) =>
        prev
          ? {
              ...prev,
              subcentres: [...prev.subcentres, ...newSc].sort((a, b) => a.name.localeCompare(b.name)),
              villages: [...prev.villages, ...newVil].sort((a, b) => a.name.localeCompare(b.name)),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
  };

  const administerVaccineDoses: SheetDataContextValue['administerVaccineDoses'] = async (
    session,
    entries
  ) => {
    if (entries.length === 0) return;
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      await assertSessionEditableOnServer(session, activeDb);
      const ts = nowISO();
      const existingIds = new Set(activeDb.vaccinationRecords.map((r) => r.id));

      const newRecords: VaccinationRecord[] = [];
      const newAudits: AuditLog[] = [];

      for (const item of entries) {
        const recordId = `${item.beneficiary.id}_${item.schedule.id}`;
        if (existingIds.has(recordId)) {
          throw new Error(
            `${item.beneficiary.childName} यांना ${item.schedule.doseName} डोस आधीच दिलेला आहे.`
          );
        }
        const rec: VaccinationRecord = {
          id: recordId,
          beneficiaryId: item.beneficiary.id,
          beneficiaryCode: item.beneficiary.beneficiaryCode,
          sessionId: session.id,
          sessionDate: session.sessionDate,
          subcentreId: session.subcentreId,
          villageId: session.villageId,
          vaccineId: item.schedule.vaccineId,
          vaccineName: item.schedule.vaccineName,
          scheduleId: item.schedule.id,
          doseName: item.schedule.doseName,
          administeredDate: item.administeredDate,
          batchNumber: item.batchNumber?.trim() || '',
          staffId: activeUser.id,
          staffName: activeUser.name,
          remarks: item.remarks?.trim() || '',
          createdAt: ts,
          updatedAt: ts,
        };
        newRecords.push(rec);
        newAudits.push(
          buildAuditEntry(activeUser, {
            action: 'लस डोस नोंदवला (टिकमार्क)',
            entityType: 'VACCINATION',
            recordId,
            newValue: {
              beneficiaryCode: item.beneficiary.beneficiaryCode,
              doseName: item.schedule.doseName,
              administeredDate: item.administeredDate,
              batchNumber: item.batchNumber || '',
              remarks: item.remarks?.trim() || '',
              sessionId: session.id,
            },
          })
        );
      }

      await appendSheetRows(
        activeDb.spreadsheetId,
        'vaccinationRecords',
        newRecords as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(
        activeDb.spreadsheetId,
        'auditLogs',
        newAudits as unknown as Record<string, unknown>[]
      );

      setDb((prev) =>
        prev
          ? {
              ...prev,
              vaccinationRecords: [...prev.vaccinationRecords, ...newRecords].sort((a, b) =>
                a.administeredDate.localeCompare(b.administeredDate)
              ),
              auditLogs: [...newAudits, ...prev.auditLogs],
            }
          : prev
      );
    });
  };

  const recordMaternalServices: SheetDataContextValue['recordMaternalServices'] = async (
    session,
    entries
  ) => {
    if (entries.length === 0) return;
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      await assertSessionEditableOnServer(session, activeDb);
      const ts = nowISO();

      const newRecords: MaternalServiceRecord[] = [];
      const newAudits: AuditLog[] = [];

      for (const item of entries) {
        const visitDate = item.visitDate || session.sessionDate;
        const epId = item.episode?.id || '';
        const epCode = item.episode?.episodeCode || 'VITALS';
        const recId = `${session.id}_${item.beneficiary.id}_${epId || 'vitals'}_${item.serviceCode}_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 5)}`;

        const rec: MaternalServiceRecord = {
          id: recId,
          sessionId: session.id,
          sessionDate: session.sessionDate,
          beneficiaryId: item.beneficiary.id,
          beneficiaryCode: item.beneficiary.beneficiaryCode,
          pregnancyEpisodeId: epId,
          episodeCode: epCode,
          subcentreId: session.subcentreId,
          villageId: session.villageId,
          visitDate,
          serviceCode: item.serviceCode,
          serviceName: item.serviceName,
          serviceValue: item.serviceValue.trim() || 'दिले / तपासले',
          batchNumber: item.batchNumber?.trim() || '',
          staffId: activeUser.id,
          staffName: activeUser.name,
          remarks: item.remarks?.trim() || '',
          createdAt: ts,
          updatedAt: ts,
        };
        newRecords.push(rec);
        newAudits.push(
          buildAuditEntry(activeUser, {
            action: item.episode ? 'गरोदर माता ANC सेवा नोंदवली' : 'लाभार्थी वाढ व तपासणी नोंदवली',
            entityType: 'MATERNAL_SERVICE',
            recordId: recId,
            newValue: {
              beneficiaryCode: item.beneficiary.beneficiaryCode,
              episodeCode: epCode,
              serviceCode: item.serviceCode,
              serviceName: item.serviceName,
              serviceValue: rec.serviceValue,
              visitDate,
              sessionId: session.id,
            },
          })
        );
      }

      await appendSheetRows(
        activeDb.spreadsheetId,
        'maternalServiceRecords',
        newRecords as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(
        activeDb.spreadsheetId,
        'auditLogs',
        newAudits as unknown as Record<string, unknown>[]
      );

      setDb((prev) =>
        prev
          ? {
              ...prev,
              maternalServiceRecords: [...prev.maternalServiceRecords, ...newRecords].sort((a, b) =>
                a.visitDate.localeCompare(b.visitDate)
              ),
              auditLogs: [...newAudits, ...prev.auditLogs],
            }
          : prev
      );
    });
  };

  const saveRiChecklist: SheetDataContextValue['saveRiChecklist'] = async (data) => {
    let savedItem!: RiChecklist;
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const existing = data.id ? activeDb.riChecklists.find((c) => c.id === data.id) : undefined;
      const targetSessionId = (data.sessionId || '').trim();
      if (targetSessionId) {
        const linkedSession = activeDb.vaccinationSessions.find((s) => s.id === targetSessionId);
        if (linkedSession) {
          await assertSessionEditableOnServer(linkedSession, activeDb);
        }
        const sessionDuplicate = activeDb.riChecklists.find(
          (c) => c.sessionId === targetSessionId && c.id !== existing?.id
        );
        if (sessionDuplicate) {
          throw new Error(
            `या लसीकरण सत्रासाठी (${sessionDuplicate.sessionCode || data.sessionCode || targetSessionId}) आधीच RI चेकलिस्ट (${sessionDuplicate.checklistCode}) भरलेली आहे. एका लसीकरण सत्रासाठी फक्त एकच चेकलिस्ट भरण्याची परवानगी आहे.`
          );
        }
      } else {
        const normalizedSite = (data.sessionSiteName || '').trim().toLowerCase();
        const siteDuplicate = activeDb.riChecklists.find(
          (c) =>
            !c.sessionId &&
            c.monitoringDate === data.monitoringDate &&
            c.subcentreId === data.subcentreId &&
            (c.sessionSiteName || '').trim().toLowerCase() === normalizedSite &&
            c.id !== existing?.id
        );
        if (siteDuplicate) {
          throw new Error(
            `या दिनांक व सत्र ठिकाणासाठी (${siteDuplicate.sessionSiteName}) आधीच RI चेकलिस्ट (${siteDuplicate.checklistCode}) भरलेली आहे. एका सत्रासाठी फक्त एकच चेकलिस्ट भरता येते.`
          );
        }
      }
      let checklistCode = existing?.checklistCode || '';
      if (!checklistCode) {
        const dateCompact = (data.monitoringDate || getTodayIST()).replace(/-/g, '');
        const prefix = `PHCB-RI-${dateCompact}-`;
        const maxSeq = activeDb.riChecklists.reduce((acc, c) => {
          if (c.checklistCode.startsWith(prefix)) {
            const num = parseInt(c.checklistCode.slice(prefix.length), 10);
            return Number.isFinite(num) && num > acc ? num : acc;
          }
          return acc;
        }, 0);
        checklistCode = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
      }

      const { id: _ignoreId, ...rest } = data;
      const item: RiChecklist = {
        ...rest,
        id: existing ? existing.id : generateId('ric'),
        checklistCode,
        createdBy: existing ? existing.createdBy : activeUser.name,
        createdAt: existing ? existing.createdAt : ts,
        updatedAt: ts,
      };
      savedItem = item;

      const nextList = existing
        ? activeDb.riChecklists.map((c) => (c.id === existing.id ? item : c))
        : [item, ...activeDb.riChecklists];

      const audit = buildAuditEntry(activeUser, {
        action: existing
          ? `RI सत्र निरीक्षण यादी अद्यतनित (${item.checklistCode})`
          : `नवीन RI सत्र निरीक्षण यादी नोंदवली (${item.checklistCode})`,
        entityType: 'RI_CHECKLIST',
        recordId: item.id,
        previousValue: existing
          ? {
              checklistCode: existing.checklistCode,
              isSessionHeld: existing.isSessionHeld,
              monitoringDate: existing.monitoringDate,
            }
          : null,
        newValue: {
          checklistCode: item.checklistCode,
          subcentreName: item.subcentreName,
          sessionSiteName: item.sessionSiteName,
          monitoringDate: item.monitoringDate,
          isSessionHeld: item.isSessionHeld,
        },
      });

      if (existing) {
        await rewriteSheetTab(
          activeDb.spreadsheetId,
          'riChecklists',
          nextList as unknown as Record<string, unknown>[]
        );
      } else {
        await appendSheetRows(activeDb.spreadsheetId, 'riChecklists', [
          item as unknown as Record<string, unknown>,
        ]);
      }
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);

      setDb((prev) =>
        prev
          ? {
              ...prev,
              riChecklists: nextList.sort(
                (a, b) =>
                  b.monitoringDate.localeCompare(a.monitoringDate) ||
                  b.createdAt.localeCompare(a.createdAt)
              ),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
    return savedItem;
  };

  const downloadFullWorkbook = () => {
    if (!db) return;
    const sheets = SHEET_TABS.map((tab) => {
      const items = (db[tab] as unknown as Record<string, unknown>[]) || [];
      const headers = TAB_COLUMNS[tab];
      const rows = items.map((obj) =>
        headers.map((col) => {
          const val = obj[col];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        })
      );
      return { name: tab, headers, rows };
    });
    exportMultiSheetExcel(`PHC_Bhada_Backup_${getTodayIST()}`, sheets);
  };

  const uploadExcelToSheet = async (file: File, mode: 'APPEND' | 'REPLACE') => {
    return await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const parsedSheets = await parseExcelFileToSheets(file);
      const tabsUpdated: string[] = [];
      let rowCount = 0;

      for (const tab of SHEET_TABS) {
        const rows = parsedSheets[tab];
        if (!rows || rows.length === 0) continue;
        tabsUpdated.push(tab);
        rowCount += rows.length;
        if (mode === 'REPLACE') {
          await rewriteSheetTab(activeDb.spreadsheetId, tab, rows);
        } else {
          await appendSheetRows(activeDb.spreadsheetId, tab, rows);
        }
      }

      if (tabsUpdated.length === 0) {
        throw new Error(
          'अपलोड केलेल्या Excel फाइलमध्ये वैध टॅब नावे आढळली नाहीत (उदा. beneficiaries, pregnancyEpisodes, villages).'
        );
      }

      const audit = buildAuditEntry(activeUser, {
        action: `Excel अपलोड (${mode === 'REPLACE' ? 'बदल' : 'जोड'})`,
        entityType: 'SHEET_IMPORT',
        recordId: activeDb.spreadsheetId,
        newValue: { fileName: file.name, tabsUpdated, rowCount, mode },
      });
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [audit as unknown as Record<string, unknown>]);

      if (fbUser) {
        await loadDatabaseById(activeDb.spreadsheetId, fbUser);
      }
      return { tabsUpdated, rowCount };
    });
  };

  // ==================== EXPANDED MATERNAL LIFECYCLE MUTATIONS ====================

  const recordAncVisit: SheetDataContextValue['recordAncVisit'] = async (data) => {
    let saved!: AncVisitRecord;
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const ga = calculateGestationalWeeksAndDays(data.episode.mcDate, data.visitDate);
      const { systolic, diastolic } = parseBpSystolicDiastolic(data.bp);
      const rec: AncVisitRecord = {
        id: generateId('anc'),
        visitNumber: data.visitNumber,
        visitLabel:
          data.visitLabel || (data.visitNumber <= 4 ? `ANC-${data.visitNumber}` : `Extra ANC-${data.visitNumber}`),
        beneficiaryId: data.beneficiary.id,
        beneficiaryCode: data.beneficiary.beneficiaryCode,
        pregnancyEpisodeId: data.episode.id,
        episodeCode: data.episode.episodeCode,
        sessionId: data.sessionId || '',
        subcentreId: data.beneficiary.subcentreId,
        subcentreName: data.beneficiary.subcentreName,
        villageId: data.beneficiary.villageId,
        villageName: data.beneficiary.villageName,
        visitDate: data.visitDate,
        gestationalWeeks: ga.weeks,
        gestationalDays: ga.days,
        gestationalAgeText: ga.label,
        weightKg: data.weightKg?.trim() || '',
        heightCm: data.heightCm?.trim() || '',
        bp: data.bp?.trim() || '',
        bpSystolic: systolic,
        bpDiastolic: diastolic,
        hb: data.hb?.trim() || '',
        bloodSugar: data.bloodSugar?.trim() || '',
        urineAlbumin: data.urineAlbumin?.trim() || '',
        urineSugar: data.urineSugar?.trim() || '',
        bloodTests: data.bloodTests?.trim() || '',
        otherTests: data.otherTests?.trim() || '',
        doctorObservation: data.doctorObservation?.trim() || '',
        treatmentAdvice: data.treatmentAdvice?.trim() || '',
        nextVisitDate: data.nextVisitDate || '',
        staffId: activeUser.id,
        staffName: data.staffName.trim() || activeUser.name,
        staffDesignation: data.staffDesignation || activeUser.role,
        remarks: data.remarks?.trim() || '',
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };
      saved = rec;

      const audit = buildAuditEntry(activeUser, {
        action: `${rec.visitLabel} तपासणी नोंदवली (${data.beneficiary.childName})`,
        entityType: 'ANC_VISIT',
        recordId: rec.id,
        newValue: {
          visitLabel: rec.visitLabel,
          visitDate: rec.visitDate,
          episodeCode: rec.episodeCode,
          weightKg: rec.weightKg,
          bp: rec.bp,
          hb: rec.hb,
        },
      });

      await appendSheetRows(activeDb.spreadsheetId, 'ancVisits', [
        rec as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              ancVisits: [...prev.ancVisits, rec].sort(
                (a, b) => a.visitDate.localeCompare(b.visitDate) || a.visitNumber - b.visitNumber
              ),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
    return saved;
  };

  const saveHighRiskRecord: SheetDataContextValue['saveHighRiskRecord'] = async (data) => {
    let saved!: HighRiskRecord;
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const existing = activeDb.highRiskRecords.find(
        (h) => h.pregnancyEpisodeId === data.episode.id
      );
      const prevHist = parseJsonArraySafe<HrpHistoryEntry>(existing?.statusHistoryJson);
      const nextHist: HrpHistoryEntry[] = [
        ...prevHist,
        {
          status: data.isHighRisk,
          reasons: data.reasons,
          otherReasonText: data.otherReasonText?.trim() || '',
          currentStatus: data.currentStatus || (data.isHighRisk === 'YES' ? 'निरीक्षणाखाली' : 'सामान्य'),
          changedAt: ts,
          changedBy: activeUser.name || activeUser.email,
          note: data.note?.trim() || '',
        },
      ];

      const rec: HighRiskRecord = {
        id: existing ? existing.id : generateId('hrp'),
        beneficiaryId: data.beneficiary.id,
        beneficiaryCode: data.beneficiary.beneficiaryCode,
        pregnancyEpisodeId: data.episode.id,
        episodeCode: data.episode.episodeCode,
        isHighRisk: data.isHighRisk,
        identificationDate:
          data.isHighRisk === 'YES' ? data.identificationDate || getTodayIST() : '',
        reasonsJson: JSON.stringify(data.reasons),
        otherReasonText: data.otherReasonText?.trim() || '',
        doctorAdvice: data.doctorAdvice?.trim() || '',
        treatmentInfo: data.treatmentInfo?.trim() || '',
        referralRequired: data.referralRequired || '',
        referralDate: data.referralDate || '',
        referralHospital: data.referralHospital?.trim() || '',
        referralReason: data.referralReason?.trim() || '',
        followUpDate: data.followUpDate || '',
        followUpStatus: data.followUpStatus?.trim() || '',
        currentStatus:
          data.currentStatus?.trim() || (data.isHighRisk === 'YES' ? 'निरीक्षणाखाली' : 'सामान्य'),
        statusHistoryJson: JSON.stringify(nextHist),
        approvedByMO: data.approvedByMO?.trim() || existing?.approvedByMO || '',
        createdBy: existing ? existing.createdBy : activeUser.email,
        createdAt: existing ? existing.createdAt : ts,
        updatedAt: ts,
      };
      saved = rec;

      const nextHrps = existing
        ? activeDb.highRiskRecords.map((h) => (h.id === existing.id ? rec : h))
        : [rec, ...activeDb.highRiskRecords];

      const updatedEpisodes = activeDb.pregnancyEpisodes.map((ep) =>
        ep.id === data.episode.id
          ? {
              ...ep,
              isHighRisk: data.isHighRisk === 'YES',
              highRiskReasonsJson: rec.reasonsJson,
              currentHrpStatus: rec.currentStatus || '',
              updatedAt: ts,
            }
          : ep
      );

      const audit = buildAuditEntry(activeUser, {
        action: `High Risk Pregnancy स्थिती अद्यतनित (${data.isHighRisk})`,
        entityType: 'HIGH_RISK',
        recordId: rec.id,
        previousValue: existing
          ? { isHighRisk: existing.isHighRisk, currentStatus: existing.currentStatus }
          : null,
        newValue: {
          episodeCode: rec.episodeCode,
          isHighRisk: rec.isHighRisk,
          reasons: data.reasons,
          currentStatus: rec.currentStatus,
        },
      });

      if (existing) {
        await rewriteSheetTab(
          activeDb.spreadsheetId,
          'highRiskRecords',
          nextHrps as unknown as Record<string, unknown>[]
        );
      } else {
        await appendSheetRows(activeDb.spreadsheetId, 'highRiskRecords', [
          rec as unknown as Record<string, unknown>,
        ]);
      }
      await rewriteSheetTab(
        activeDb.spreadsheetId,
        'pregnancyEpisodes',
        updatedEpisodes as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);

      setDb((prev) =>
        prev
          ? {
              ...prev,
              highRiskRecords: nextHrps,
              pregnancyEpisodes: updatedEpisodes,
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
    return saved;
  };

  const recordMaternalImmunizationAndSupplements: SheetDataContextValue['recordMaternalImmunizationAndSupplements'] =
    async (data) => {
      if (data.items.length === 0) return [];
      const created: MaternalServiceRecord[] = [];
      await withSync(async () => {
        const { activeDb, activeUser } = requireDbAndUser();
        const ts = nowISO();
        const benExisting = activeDb.maternalServiceRecords.filter(
          (r) => r.beneficiaryId === data.beneficiary.id
        );

        const newRecords: MaternalServiceRecord[] = [];
        const newAudits: AuditLog[] = [];

        for (const item of data.items) {
          if (
            item.serviceCode === 'TD_1' ||
            item.serviceCode === 'TD_2' ||
            item.serviceCode === 'TD_BOOSTER'
          ) {
            const check = validateTdDoseForEpisode({
              existingRecords: [...benExisting, ...newRecords],
              episodeId: data.episode.id,
              serviceCode: item.serviceCode,
              visitDate: data.visitDate,
            });
            if (!check.ok) {
              throw new Error(check.error);
            }
          }

          const recId = `mat_${data.beneficiary.id}_${data.episode.id}_${item.serviceCode}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 5)}`;
          const rec: MaternalServiceRecord = {
            id: recId,
            sessionId: '',
            sessionDate: data.visitDate,
            beneficiaryId: data.beneficiary.id,
            beneficiaryCode: data.beneficiary.beneficiaryCode,
            pregnancyEpisodeId: data.episode.id,
            episodeCode: data.episode.episodeCode,
            subcentreId: data.beneficiary.subcentreId,
            villageId: data.beneficiary.villageId,
            visitDate: data.visitDate,
            serviceCode: item.serviceCode,
            serviceName: item.serviceName,
            serviceValue: item.serviceValue.trim() || 'दिले',
            batchNumber: item.batchNumber?.trim() || '',
            staffId: activeUser.id,
            staffName: data.staffName.trim() || activeUser.name,
            remarks: item.remarks?.trim() || '',
            createdAt: ts,
            updatedAt: ts,
          };
          newRecords.push(rec);
          created.push(rec);
          newAudits.push(
            buildAuditEntry(activeUser, {
              action: `माता लसीकरण / औषध वितरण नोंदवले (${item.serviceName})`,
              entityType: 'MATERNAL_SERVICE',
              recordId: recId,
              newValue: {
                beneficiaryCode: rec.beneficiaryCode,
                episodeCode: rec.episodeCode,
                serviceCode: rec.serviceCode,
                serviceValue: rec.serviceValue,
                visitDate: rec.visitDate,
              },
            })
          );
        }

        await appendSheetRows(
          activeDb.spreadsheetId,
          'maternalServiceRecords',
          newRecords as unknown as Record<string, unknown>[]
        );
        await appendSheetRows(
          activeDb.spreadsheetId,
          'auditLogs',
          newAudits as unknown as Record<string, unknown>[]
        );

        setDb((prev) =>
          prev
            ? {
                ...prev,
                maternalServiceRecords: [...prev.maternalServiceRecords, ...newRecords].sort((a, b) =>
                  a.visitDate.localeCompare(b.visitDate)
                ),
                auditLogs: [...newAudits, ...prev.auditLogs],
              }
            : prev
        );
      });
      return created;
    };

  const recordMaternalReferral: SheetDataContextValue['recordMaternalReferral'] = async (data) => {
    let saved!: MaternalReferralRecord;
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const rec: MaternalReferralRecord = {
        id: generateId('ref'),
        beneficiaryId: data.beneficiary.id,
        beneficiaryCode: data.beneficiary.beneficiaryCode,
        pregnancyEpisodeId: data.episode.id,
        episodeCode: data.episode.episodeCode,
        highRiskRecordId: data.highRiskRecordId || '',
        referralDate: data.referralDate,
        referredFrom: data.referredFrom.trim() || data.beneficiary.subcentreName,
        referredToHospital: data.referredToHospital.trim(),
        referralReason: data.referralReason.trim(),
        transportArrangement: data.transportArrangement?.trim() || '',
        followUpDate: data.followUpDate || '',
        followUpStatus: data.followUpStatus || 'प्रलंबित',
        outcomeNotes: data.outcomeNotes?.trim() || '',
        referredByStaff: data.referredByStaff.trim() || activeUser.name,
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };
      saved = rec;

      const audit = buildAuditEntry(activeUser, {
        action: `गरोदर माता संदर्भ नोंदवले (${rec.referredToHospital})`,
        entityType: 'REFERRAL',
        recordId: rec.id,
        newValue: {
          episodeCode: rec.episodeCode,
          referredToHospital: rec.referredToHospital,
          referralDate: rec.referralDate,
          referralReason: rec.referralReason,
        },
      });

      await appendSheetRows(activeDb.spreadsheetId, 'maternalReferrals', [
        rec as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              maternalReferrals: [rec, ...prev.maternalReferrals],
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
    return saved;
  };

  const updateMaternalReferralStatus: SheetDataContextValue['updateMaternalReferralStatus'] = async (
    referralId,
    updates
  ) => {
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const existing = activeDb.maternalReferrals.find((r) => r.id === referralId);
      if (!existing) throw new Error('संदर्भ नोंद आढळली नाही.');
      const nextList = activeDb.maternalReferrals.map((r) =>
        r.id === referralId ? { ...r, ...updates, updatedAt: nowISO() } : r
      );
      const audit = buildAuditEntry(activeUser, {
        action: `संदर्भ पाठपुरावा स्थिती अद्यतनित (${updates.followUpStatus || existing.followUpStatus})`,
        entityType: 'REFERRAL',
        recordId: referralId,
        newValue: updates as Record<string, unknown>,
      });
      await rewriteSheetTab(
        activeDb.spreadsheetId,
        'maternalReferrals',
        nextList as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);
      setDb((prev) =>
        prev ? { ...prev, maternalReferrals: nextList, auditLogs: [audit, ...prev.auditLogs] } : prev
      );
    });
  };

  const recordDeliveryAndBabies: SheetDataContextValue['recordDeliveryAndBabies'] = async (data) => {
    let result!: { delivery: DeliveryRecord; babies: BabyRecord[] };
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const existingDeliv = activeDb.deliveryRecords.find(
        (d) => d.pregnancyEpisodeId === data.episode.id
      );

      const delivery: DeliveryRecord = {
        id: existingDeliv ? existingDeliv.id : generateId('del'),
        beneficiaryId: data.beneficiary.id,
        beneficiaryCode: data.beneficiary.beneficiaryCode,
        pregnancyEpisodeId: data.episode.id,
        episodeCode: data.episode.episodeCode,
        plannedEddDate: data.plannedEddDate || data.episode.eddDate,
        plannedDeliveryPlace: data.plannedDeliveryPlace || data.episode.expectedDeliveryPlace,
        plannedHospitalName: data.plannedHospitalName || data.episode.hospitalName,
        deliveryPlanNotes: data.deliveryPlanNotes?.trim() || '',
        referralRequiredBeforeDelivery: data.referralRequiredBeforeDelivery || '',
        actualDeliveryDate: data.actualDeliveryDate,
        actualDeliveryPlace: data.actualDeliveryPlace.trim(),
        actualHospitalName: data.actualHospitalName?.trim() || '',
        deliveryType: data.deliveryType,
        deliveryTypeOther: data.deliveryTypeOther?.trim() || '',
        numberOfBabies: data.babies.length,
        motherCondition: data.motherCondition.trim(),
        deliveryComplications: data.deliveryComplications?.trim() || '',
        referralDetails: data.referralDetails?.trim() || '',
        attendedByStaff: data.attendedByStaff.trim() || activeUser.name,
        isCompleted: data.markEpisodeDelivered,
        createdBy: existingDeliv ? existingDeliv.createdBy : activeUser.email,
        createdAt: existingDeliv ? existingDeliv.createdAt : ts,
        updatedAt: ts,
      };

      const year = (data.actualDeliveryDate || getTodayIST()).slice(0, 4);
      const babyPrefix = `PHCB-BABY-${year}-`;
      let maxBabySeq = activeDb.babyRecords.reduce((acc, b) => {
        if (b.babyCode.startsWith(babyPrefix)) {
          const n = parseInt(b.babyCode.slice(babyPrefix.length), 10);
          return Number.isFinite(n) && n > acc ? n : acc;
        }
        return acc;
      }, 0);

      const newBabies: BabyRecord[] = data.babies.map((b, idx) => {
        maxBabySeq += 1;
        return {
          id: generateId('baby'),
          babyCode: `${babyPrefix}${String(maxBabySeq).padStart(4, '0')}`,
          motherBeneficiaryId: data.beneficiary.id,
          motherBeneficiaryCode: data.beneficiary.beneficiaryCode,
          pregnancyEpisodeId: data.episode.id,
          episodeCode: data.episode.episodeCode,
          deliveryRecordId: delivery.id,
          babyNumber: idx + 1,
          babyName: b.babyName.trim() || `${data.beneficiary.childName} बाळ ${idx + 1}`,
          gender: b.gender,
          birthWeightGrams: b.birthWeightGrams,
          birthOutcome: b.birthOutcome,
          birthOutcomeOther: b.birthOutcomeOther?.trim() || '',
          babyCondition: b.babyCondition.trim(),
          dob: data.actualDeliveryDate,
          notes: b.notes?.trim() || '',
          createdBy: activeUser.email,
          createdAt: ts,
          updatedAt: ts,
        };
      });

      const nextDeliveries = existingDeliv
        ? activeDb.deliveryRecords.map((d) => (d.id === existingDeliv.id ? delivery : d))
        : [delivery, ...activeDb.deliveryRecords];

      const keptBabies = existingDeliv
        ? activeDb.babyRecords.filter((b) => b.deliveryRecordId !== existingDeliv.id)
        : activeDb.babyRecords;
      const nextBabies = [...keptBabies, ...newBabies];

      const nextEpisodes = activeDb.pregnancyEpisodes.map((ep) =>
        ep.id === data.episode.id && data.markEpisodeDelivered
          ? {
              ...ep,
              pregnancyStatus: 'प्रसूती पूर्ण' as PregnancyStatus,
              outcomeDate: data.actualDeliveryDate,
              updatedAt: ts,
            }
          : ep
      );

      const audit = buildAuditEntry(activeUser, {
        action: `प्रसूती व ${newBabies.length} नवजात बाळ नोंदवले (${data.episode.episodeCode})`,
        entityType: 'DELIVERY',
        recordId: delivery.id,
        newValue: {
          episodeCode: data.episode.episodeCode,
          actualDeliveryDate: delivery.actualDeliveryDate,
          deliveryType: delivery.deliveryType,
          numberOfBabies: delivery.numberOfBabies,
          markEpisodeDelivered: data.markEpisodeDelivered,
        },
      });

      if (existingDeliv) {
        await rewriteSheetTab(
          activeDb.spreadsheetId,
          'deliveryRecords',
          nextDeliveries as unknown as Record<string, unknown>[]
        );
        await rewriteSheetTab(
          activeDb.spreadsheetId,
          'babyRecords',
          nextBabies as unknown as Record<string, unknown>[]
        );
      } else {
        await appendSheetRows(activeDb.spreadsheetId, 'deliveryRecords', [
          delivery as unknown as Record<string, unknown>,
        ]);
        if (newBabies.length > 0) {
          await appendSheetRows(
            activeDb.spreadsheetId,
            'babyRecords',
            newBabies as unknown as Record<string, unknown>[]
          );
        }
      }

      if (data.markEpisodeDelivered) {
        await rewriteSheetTab(
          activeDb.spreadsheetId,
          'pregnancyEpisodes',
          nextEpisodes as unknown as Record<string, unknown>[]
        );
      }
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);

      setDb((prev) =>
        prev
          ? {
              ...prev,
              deliveryRecords: nextDeliveries,
              babyRecords: nextBabies,
              pregnancyEpisodes: nextEpisodes,
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
      result = { delivery, babies: newBabies };
    });
    return result;
  };

  const recordPncVisit: SheetDataContextValue['recordPncVisit'] = async (data) => {
    let saved!: PncRecord;
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const rec: PncRecord = {
        id: generateId('pnc'),
        visitNumber: data.visitNumber,
        visitLabel:
          data.visitLabel || (data.visitNumber <= 2 ? `PNC-${data.visitNumber}` : `Extra PNC-${data.visitNumber}`),
        beneficiaryId: data.beneficiary.id,
        beneficiaryCode: data.beneficiary.beneficiaryCode,
        pregnancyEpisodeId: data.episode.id,
        episodeCode: data.episode.episodeCode,
        deliveryRecordId: data.deliveryRecordId || '',
        pncDate: data.pncDate,
        motherBp: data.motherBp?.trim() || '',
        motherHealthStatus: data.motherHealthStatus.trim(),
        bleedingStatus: data.bleedingStatus.trim(),
        breastfeedingStatus: data.breastfeedingStatus.trim(),
        babyWeightGrams: data.babyWeightGrams ?? null,
        babyHealthStatus: data.babyHealthStatus.trim(),
        breastfeedingCounselling: data.breastfeedingCounselling || '',
        treatmentGiven: data.treatmentGiven?.trim() || '',
        nextFollowUpDate: data.nextFollowUpDate || '',
        staffId: activeUser.id,
        staffName: data.staffName.trim() || activeUser.name,
        remarks: data.remarks?.trim() || '',
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };
      saved = rec;

      const audit = buildAuditEntry(activeUser, {
        action: `${rec.visitLabel} प्रसूतीनंतर तपासणी नोंदवली (${data.beneficiary.childName})`,
        entityType: 'PNC',
        recordId: rec.id,
        newValue: {
          visitLabel: rec.visitLabel,
          pncDate: rec.pncDate,
          motherHealthStatus: rec.motherHealthStatus,
          babyHealthStatus: rec.babyHealthStatus,
        },
      });

      await appendSheetRows(activeDb.spreadsheetId, 'pncRecords', [
        rec as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);
      setDb((prev) =>
        prev
          ? {
              ...prev,
              pncRecords: [...prev.pncRecords, rec].sort(
                (a, b) => a.pncDate.localeCompare(b.pncDate) || a.visitNumber - b.visitNumber
              ),
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
    });
    return saved;
  };

  const seedDemoPregnancyRecord: SheetDataContextValue['seedDemoPregnancyRecord'] = async () => {
    let seeded!: { beneficiary: Beneficiary; episode: PregnancyEpisode };
    await withSync(async () => {
      const { activeDb, activeUser } = requireDbAndUser();
      const ts = nowISO();
      const sc = activeDb.subcentres[0] || {
        id: 'sc_demo_bhada',
        name: 'उपकेंद्र भादा',
      };
      const vil = activeDb.villages.find((v) => v.subcentreId === sc.id) ||
        activeDb.villages[0] || {
          id: 'vil_demo_bhada',
          name: 'भादा',
        };

      const benCode = buildNextBeneficiaryCode(activeDb.beneficiaries, 'PREGNANT_WOMAN');
      const benId = generateId('ben');
      const mobileNum = `9822${String(Math.floor(100000 + Math.random() * 899999))}`;
      const ben: Beneficiary = {
        id: benId,
        beneficiaryCode: benCode,
        beneficiaryType: 'PREGNANT_WOMAN',
        childName: 'सविता राजेश पाटील (Demo)',
        fullNameEnglish: 'Savita Rajesh Patil',
        motherName: 'सविता राजेश पाटील (Demo)',
        fatherName: 'राजेश पांडुरंग पाटील',
        guardianName: 'राजेश पांडुरंग पाटील',
        husbandMobile: '9823001122',
        dob: '1999-06-15',
        gender: 'स्त्री',
        mobile: mobileNum,
        aadhaarNumber: '',
        caste: 'मराठा',
        category: 'सर्वसाधारण (Open)',
        bloodGroup: 'B',
        rhFactor: 'Negative (-)',
        plannedDeliveryPlace: 'ग्रामीण रुग्णालय औसा (RH Ausa)',
        plannedHospitalName: 'RH Ausa',
        address: `मु. पो. ${vil.name}, ता. औसा, जि. लातूर`,
        subcentreId: sc.id,
        subcentreName: sc.name,
        villageId: vil.id,
        villageName: vil.name,
        anganwadi: `${vil.name} क्रमांक १`,
        registrationDate: '2026-03-20',
        status: 'सक्रिय',
        dedupeKey: normalizeBeneficiaryDedupeKey({
          beneficiaryType: 'PREGNANT_WOMAN',
          fullName: `सविता राजेश पाटील (Demo) ${benCode}`,
          guardianOrMotherName: 'राजेश पांडुरंग पाटील',
          mobile: mobileNum,
        }),
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      const epCode = buildNextEpisodeCode(activeDb.pregnancyEpisodes);
      const epId = generateId('prg');
      const episode: PregnancyEpisode = {
        id: epId,
        episodeCode: epCode,
        beneficiaryId: benId,
        beneficiaryCode: benCode,
        mcDate: '2026-02-05',
        eddDate: calculateEddFromMcDate('2026-02-05'),
        expectedDeliveryPlace: 'ग्रामीण रुग्णालय औसा (RH Ausa)',
        deliveryFacilityType: 'Government',
        hospitalName: 'RH Ausa',
        pregnancyRegistrationDate: '2026-03-20',
        pregnancyStatus: 'प्रसूती पूर्ण',
        gravidaPara: 'G2 P1 A0 L1',
        gravida: 2,
        para: 1,
        abortions: 0,
        livingChildren: 1,
        previousPregnancyHistory: 'मागील प्रसूती २०२२ मध्ये शासकीय रुग्णालयात झाली',
        previousCaesarean: 'Yes',
        previousComplications: 'मागील प्रसूती LSCS व सौम्य रक्तक्षय',
        bloodGroup: 'B',
        rhFactor: 'Negative (-)',
        eddHistoryJson: JSON.stringify([
          {
            previousEddDate: '2026-11-10',
            newEddDate: calculateEddFromMcDate('2026-02-05'),
            changedAt: ts,
            changedBy: activeUser.name || 'Demo',
            reason: 'USG नुसार खात्रीशीर तारीख',
          },
        ]),
        isHighRisk: true,
        highRiskReasonsJson: JSON.stringify(['Anaemia / Severe Anaemia', 'Previous Caesarean Section', 'Rh Negative']),
        currentHrpStatus: 'प्रसूती पूर्ण (निगराणीत)',
        outcomeDate: '2026-11-12',
        notes: 'Demo संपूर्ण गर्भधारणा चाचणी रेकॉर्ड',
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      const demoAncs: AncVisitRecord[] = [
        {
          id: generateId('anc'),
          visitNumber: 1,
          visitLabel: 'ANC-1',
          beneficiaryId: benId,
          beneficiaryCode: benCode,
          pregnancyEpisodeId: epId,
          episodeCode: epCode,
          sessionId: '',
          subcentreId: sc.id,
          subcentreName: sc.name,
          villageId: vil.id,
          villageName: vil.name,
          visitDate: '2026-03-20',
          gestationalWeeks: 6,
          gestationalDays: 1,
          gestationalAgeText: '6 आठवडे 1 दिवस',
          weightKg: '49.5',
          heightCm: '153',
          bp: '116/74',
          bpSystolic: 116,
          bpDiastolic: 74,
          hb: '9.4',
          bloodSugar: '92',
          urineAlbumin: 'Negative / Nil',
          urineSugar: 'Negative / Nil',
          bloodTests: 'CBC, Blood Group, VDRL, HIV, HBsAg',
          otherTests: 'USG 1st Trimester',
          doctorObservation: 'सौम्य ॲनिमिया व Rh निगेटिव्ह नोंदवले',
          treatmentAdvice: 'IFA 1 गोळी दिवसातून दोन वेळा, फॉलिक ॲसिड',
          nextVisitDate: '2026-05-18',
          staffId: activeUser.id,
          staffName: activeUser.name,
          staffDesignation: activeUser.role,
          remarks: 'प्रथम त्रैमासिक नोंदणी पूर्ण',
          createdBy: activeUser.email,
          createdAt: ts,
          updatedAt: ts,
        },
        {
          id: generateId('anc'),
          visitNumber: 2,
          visitLabel: 'ANC-2',
          beneficiaryId: benId,
          beneficiaryCode: benCode,
          pregnancyEpisodeId: epId,
          episodeCode: epCode,
          sessionId: '',
          subcentreId: sc.id,
          subcentreName: sc.name,
          villageId: vil.id,
          villageName: vil.name,
          visitDate: '2026-06-15',
          gestationalWeeks: 18,
          gestationalDays: 4,
          gestationalAgeText: '18 आठवडे 4 दिवस',
          weightKg: '52.0',
          heightCm: '153',
          bp: '124/80',
          bpSystolic: 124,
          bpDiastolic: 80,
          hb: '10.1',
          bloodSugar: '96',
          urineAlbumin: 'Negative / Nil',
          urineSugar: 'Negative / Nil',
          bloodTests: 'ICT, OGTT Normal',
          otherTests: 'Anomaly Scan Normal',
          doctorObservation: 'वजन वाढ समाधानकारक, Hb सुधारत आहे',
          treatmentAdvice: 'IFA + Calcium 500mg नियमित सुरू ठेवा',
          nextVisitDate: '2026-08-20',
          staffId: activeUser.id,
          staffName: activeUser.name,
          staffDesignation: activeUser.role,
          remarks: '',
          createdBy: activeUser.email,
          createdAt: ts,
          updatedAt: ts,
        },
        {
          id: generateId('anc'),
          visitNumber: 3,
          visitLabel: 'ANC-3',
          beneficiaryId: benId,
          beneficiaryCode: benCode,
          pregnancyEpisodeId: epId,
          episodeCode: epCode,
          sessionId: '',
          subcentreId: sc.id,
          subcentreName: sc.name,
          villageId: vil.id,
          villageName: vil.name,
          visitDate: '2026-09-10',
          gestationalWeeks: 31,
          gestationalDays: 0,
          gestationalAgeText: '31 आठवडे 0 दिवस',
          weightKg: '56.2',
          heightCm: '153',
          bp: '138/88',
          bpSystolic: 138,
          bpDiastolic: 88,
          hb: '10.6',
          bloodSugar: '104',
          urineAlbumin: 'Trace',
          urineSugar: 'Negative / Nil',
          bloodTests: 'CBC, LFT/RFT Normal',
          otherTests: 'Growth Scan Normal',
          doctorObservation: 'रक्तदाब किंचित वाढलेला, मागील LSCS मुळे उच्च जोखीम गरोदर माता',
          treatmentAdvice: 'RH औसा येथे MO तपासणी व नियोजित प्रसूती संदर्भ',
          nextVisitDate: '2026-10-15',
          staffId: activeUser.id,
          staffName: activeUser.name,
          staffDesignation: activeUser.role,
          remarks: 'HRP पाठपुरावा आवश्यक',
          createdBy: activeUser.email,
          createdAt: ts,
          updatedAt: ts,
        },
      ];

      const demoHrp: HighRiskRecord = {
        id: generateId('hrp'),
        beneficiaryId: benId,
        beneficiaryCode: benCode,
        pregnancyEpisodeId: epId,
        episodeCode: epCode,
        isHighRisk: 'YES',
        identificationDate: '2026-06-15',
        reasonsJson: JSON.stringify(['Anaemia / Severe Anaemia', 'Previous Caesarean Section', 'Rh Negative']),
        otherReasonText: '',
        doctorAdvice: 'संस्थात्मक प्रसूती RH औसा येथे करावी व Anti-D इंजेक्शन नियोजन ठेवावे',
        treatmentInfo: 'Iron Sucrose / IFA + Calcium, आठवड्यातून एकदा BP तपासणी',
        referralRequired: 'Yes',
        referralDate: '2026-10-20',
        referralHospital: 'ग्रामीण रुग्णालय औसा (RH Ausa)',
        referralReason: 'Previous LSCS + Rh Negative',
        followUpDate: '2026-11-01',
        followUpStatus: 'पूर्ण',
        currentStatus: 'प्रसूती पूर्ण',
        statusHistoryJson: JSON.stringify([
          {
            status: 'YES',
            reasons: ['Anaemia / Severe Anaemia', 'Previous Caesarean Section', 'Rh Negative'],
            currentStatus: 'निरीक्षणाखाली',
            changedAt: ts,
            changedBy: activeUser.name,
            note: 'वैद्यकीय अधिकाऱ्यांद्वारे प्रमाणित HRP',
          },
        ]),
        approvedByMO: 'वैद्यकीय अधिकारी, प्रा. आ. केंद्र भादा',
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      const demoRef: MaternalReferralRecord = {
        id: generateId('ref'),
        beneficiaryId: benId,
        beneficiaryCode: benCode,
        pregnancyEpisodeId: epId,
        episodeCode: epCode,
        highRiskRecordId: demoHrp.id,
        referralDate: '2026-10-20',
        referredFrom: sc.name,
        referredToHospital: 'ग्रामीण रुग्णालय औसा (RH Ausa)',
        referralReason: 'Previous LSCS + Rh Negative सुरक्षित प्रसूतीसाठी',
        transportArrangement: '108 रुग्णवाहिका नियोजित',
        followUpDate: '2026-11-01',
        followUpStatus: 'भेट पूर्ण',
        outcomeNotes: 'RH औसा येथे तज्ञ तपासणी पूर्ण',
        referredByStaff: activeUser.name,
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      const demoServices: MaternalServiceRecord[] = [
        {
          id: generateId('ms'),
          sessionId: '',
          sessionDate: '2026-03-20',
          beneficiaryId: benId,
          beneficiaryCode: benCode,
          pregnancyEpisodeId: epId,
          episodeCode: epCode,
          subcentreId: sc.id,
          villageId: vil.id,
          visitDate: '2026-03-20',
          serviceCode: 'TD_1',
          serviceName: 'Td-1 लसीकरण',
          serviceValue: 'दिली',
          batchNumber: 'TD-2026A1',
          staffId: activeUser.id,
          staffName: activeUser.name,
          remarks: '',
          createdAt: ts,
          updatedAt: ts,
        },
        {
          id: generateId('ms'),
          sessionId: '',
          sessionDate: '2026-05-15',
          beneficiaryId: benId,
          beneficiaryCode: benCode,
          pregnancyEpisodeId: epId,
          episodeCode: epCode,
          subcentreId: sc.id,
          villageId: vil.id,
          visitDate: '2026-05-15',
          serviceCode: 'TD_2',
          serviceName: 'Td-2 लसीकरण',
          serviceValue: 'दिली',
          batchNumber: 'TD-2026B4',
          staffId: activeUser.id,
          staffName: activeUser.name,
          remarks: '',
          createdAt: ts,
          updatedAt: ts,
        },
        {
          id: generateId('ms'),
          sessionId: '',
          sessionDate: '2026-06-15',
          beneficiaryId: benId,
          beneficiaryCode: benCode,
          pregnancyEpisodeId: epId,
          episodeCode: epCode,
          subcentreId: sc.id,
          villageId: vil.id,
          visitDate: '2026-06-15',
          serviceCode: 'IFA',
          serviceName: 'IFA गोळ्या वितरण',
          serviceValue: '100 गोळ्या',
          batchNumber: '',
          staffId: activeUser.id,
          staffName: activeUser.name,
          remarks: '',
          createdAt: ts,
          updatedAt: ts,
        },
        {
          id: generateId('ms'),
          sessionId: '',
          sessionDate: '2026-06-15',
          beneficiaryId: benId,
          beneficiaryCode: benCode,
          pregnancyEpisodeId: epId,
          episodeCode: epCode,
          subcentreId: sc.id,
          villageId: vil.id,
          visitDate: '2026-06-15',
          serviceCode: 'CALCIUM',
          serviceName: 'कॅल्शियम गोळ्या वितरण',
          serviceValue: '100 गोळ्या',
          batchNumber: '',
          staffId: activeUser.id,
          staffName: activeUser.name,
          remarks: '',
          createdAt: ts,
          updatedAt: ts,
        },
      ];

      const demoDeliv: DeliveryRecord = {
        id: generateId('del'),
        beneficiaryId: benId,
        beneficiaryCode: benCode,
        pregnancyEpisodeId: epId,
        episodeCode: epCode,
        plannedEddDate: episode.eddDate,
        plannedDeliveryPlace: 'ग्रामीण रुग्णालय औसा (RH Ausa)',
        plannedHospitalName: 'RH Ausa',
        deliveryPlanNotes: 'Elective LSCS नियोजित',
        referralRequiredBeforeDelivery: 'Yes',
        actualDeliveryDate: '2026-11-12',
        actualDeliveryPlace: 'ग्रामीण रुग्णालय औसा (RH Ausa)',
        actualHospitalName: 'RH Ausa',
        deliveryType: 'LSCS',
        deliveryTypeOther: '',
        numberOfBabies: 1,
        motherCondition: 'स्थिर व आरोग्यपूर्ण',
        deliveryComplications: 'कोणतीही गुंतागुंत नाही',
        referralDetails: 'RH Ausa तज्ञ पथक',
        attendedByStaff: 'Dr. Kulkarni / ANM',
        isCompleted: true,
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      const demoBaby: BabyRecord = {
        id: generateId('baby'),
        babyCode: `PHCB-BABY-2026-${String(activeDb.babyRecords.length + 1).padStart(4, '0')}`,
        motherBeneficiaryId: benId,
        motherBeneficiaryCode: benCode,
        pregnancyEpisodeId: epId,
        episodeCode: epCode,
        deliveryRecordId: demoDeliv.id,
        babyNumber: 1,
        babyName: 'सविता पाटील बाळ',
        gender: 'मुलगी',
        birthWeightGrams: 2950,
        birthOutcome: 'Live Birth',
        birthOutcomeOther: '',
        babyCondition: 'सक्रिय, स्तनपान सुरू (Apgar 9/10)',
        dob: '2026-11-12',
        notes: 'जन्मजात BCG, OPV-0, Hep-B दिले',
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      const demoPnc: PncRecord = {
        id: generateId('pnc'),
        visitNumber: 1,
        visitLabel: 'PNC-1',
        beneficiaryId: benId,
        beneficiaryCode: benCode,
        pregnancyEpisodeId: epId,
        episodeCode: epCode,
        deliveryRecordId: demoDeliv.id,
        pncDate: '2026-11-15',
        motherBp: '118/76',
        motherHealthStatus: 'माता स्थिर, शस्त्रक्रिया जखम स्वच्छ',
        bleedingStatus: 'सामान्य (Normal Lochia)',
        breastfeedingStatus: 'नियमित स्तनपान सुरू',
        babyWeightGrams: 2920,
        babyHealthStatus: 'बाळ सक्रिय, कावीळ नाही',
        breastfeedingCounselling: 'Yes',
        treatmentGiven: 'IFA व Calcium सुरू, Anti-D दिले',
        nextFollowUpDate: '2026-11-22',
        staffId: activeUser.id,
        staffName: activeUser.name,
        remarks: 'PNC-1 गृहभेट पूर्ण',
        createdBy: activeUser.email,
        createdAt: ts,
        updatedAt: ts,
      };

      const audit = buildAuditEntry(activeUser, {
        action: `चाचणी Demo गरोदर माता रेकॉर्ड तयार केले (${benCode})`,
        entityType: 'PREGNANCY_EPISODE',
        recordId: epId,
        newValue: { beneficiaryCode: benCode, episodeCode: epCode },
      });

      await appendSheetRows(activeDb.spreadsheetId, 'beneficiaries', [
        ben as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'pregnancyEpisodes', [
        episode as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(
        activeDb.spreadsheetId,
        'ancVisits',
        demoAncs as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(activeDb.spreadsheetId, 'highRiskRecords', [
        demoHrp as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'maternalReferrals', [
        demoRef as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(
        activeDb.spreadsheetId,
        'maternalServiceRecords',
        demoServices as unknown as Record<string, unknown>[]
      );
      await appendSheetRows(activeDb.spreadsheetId, 'deliveryRecords', [
        demoDeliv as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'babyRecords', [
        demoBaby as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'pncRecords', [
        demoPnc as unknown as Record<string, unknown>,
      ]);
      await appendSheetRows(activeDb.spreadsheetId, 'auditLogs', [
        audit as unknown as Record<string, unknown>,
      ]);

      setDb((prev) =>
        prev
          ? {
              ...prev,
              beneficiaries: [...prev.beneficiaries, ben],
              pregnancyEpisodes: [episode, ...prev.pregnancyEpisodes],
              ancVisits: [...prev.ancVisits, ...demoAncs],
              highRiskRecords: [demoHrp, ...prev.highRiskRecords],
              maternalReferrals: [demoRef, ...prev.maternalReferrals],
              maternalServiceRecords: [...prev.maternalServiceRecords, ...demoServices],
              deliveryRecords: [demoDeliv, ...prev.deliveryRecords],
              babyRecords: [...prev.babyRecords, demoBaby],
              pncRecords: [...prev.pncRecords, demoPnc],
              auditLogs: [audit, ...prev.auditLogs],
            }
          : prev
      );
      seeded = { beneficiary: ben, episode };
    });
    return seeded;
  };

  return (
    <SheetDataContext.Provider
      value={{
        fbUser,
        currentUser,
        isCentralOwner,
        centralSheetMissing,
        sharedWithAnyone,
        needsAuth,
        authLoading,
        sheetLoading,
        syncing,
        syncStatus,
        lastSyncedAt,
        sheetError,
        db,
        availableSheets,
        signIn,
        logout,
        hasRole,
        connectSheet,
        createNewSheet,
        enableMultiGmailSharing,
        refreshFromSheet,
        downloadFullWorkbook,
        uploadExcelToSheet,
        saveSubcentre,
        saveVillage,
        saveStaff,
        saveUser,
        saveSystemSettings,
        saveMaternalServiceCatalog,
        registerBeneficiary,
        registerBeneficiaryAndAddToSession,
        updateBeneficiary,
        createPregnancyEpisode,
        updatePregnancyEpisode,
        createSession,
        updateSession,
        completeSession,
        reopenLockedSession,
        addBeneficiaryToSession,
        removeBeneficiaryFromSession,
        saveVaccineMaster,
        saveVaccineSchedule,
        seedStandardNIS,
        seedStarterHierarchy,
        administerVaccineDoses,
        recordMaternalServices,
        saveRiChecklist,
        recordAncVisit,
        saveHighRiskRecord,
        recordMaternalImmunizationAndSupplements,
        recordMaternalReferral,
        updateMaternalReferralStatus,
        recordDeliveryAndBabies,
        recordPncVisit,
        seedDemoPregnancyRecord,
      }}
    >
      {children}
    </SheetDataContext.Provider>
  );
};

export function useSheetData() {
  const ctx = useContext(SheetDataContext);
  if (!ctx) throw new Error('useSheetData must be used inside SheetDataProvider');
  return ctx;
}
