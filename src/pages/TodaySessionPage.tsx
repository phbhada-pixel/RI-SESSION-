import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Baby,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Edit,
  Eye,
  HeartPulse,
  Lock,
  PlusCircle,
  Save,
  Search,
  Syringe,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import {
  Beneficiary,
  BeneficiaryGender,
  BeneficiaryType,
  DeliveryFacilityType,
  MaternalServiceConfigItem,
  PregnancyEpisode,
  VaccineSchedule,
} from '../types';
import {
  calculateAgeAsOf,
  formatDDMMYYYY,
  getSessionEditStatus,
  getTodayIST,
} from '../utils/dateUtils';
import { formatDateTimeIST, formatNumberIN } from '../utils/localeUtils';
import { evaluateBeneficiaryEligibility } from '../utils/eligibilityEngine';
import { normalizeBeneficiaryDedupeKey, normalizeDedupeKey } from '../services/googleSheetsService';
import {
  CASTE_CATEGORIES,
  VITAL_METRIC_DEFS,
  buildVitalsComparisonSummary,
  calculateEddFromMcDate,
  calculateGestationalAgeLabel,
  formatDeliveryFacilityTypeMarathi,
  getMaternalServiceCatalog,
  groupMaternalVisitsByDate,
  isEveryVisitAncService,
} from '../utils/maternalUtils';
import { canViewFullAadhaar, maskAadhaar, sanitizeOptionalAadhaar } from '../utils/privacyUtils';
import {
  buildDetailedSessionReportData,
  buildMaternalSessionReportData,
  downloadBeneficiaryConsolidatedPDF,
  downloadDetailedSessionPDF,
  downloadMaternalSessionPDF,
} from '../utils/sessionPdfReport';
import { VitalsComparisonCard } from '../components/VitalsComparisonCard';
import { SessionReportPreviewModal } from '../components/SessionReportPreviewModal';
import { fuzzyFilterAndRank } from '../utils/fuzzySearch';
import { FuzzyAutocomplete } from '../components/FuzzyAutocomplete';
import { SearchableSelect } from '../components/SearchableSelect';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';

type ActiveActionMode = 'NONE' | 'NEW_BENEFICIARY' | 'SELECT_EXISTING';

interface PendingTickEntry {
  beneficiary: Beneficiary;
  schedule: VaccineSchedule;
  batchNumber: string;
  remarks: string;
}

interface PendingMaternalEntry {
  beneficiary: Beneficiary;
  episode: PregnancyEpisode;
  service: MaternalServiceConfigItem;
  serviceValue: string;
  batchNumber: string;
  remarks: string;
}

export const TodaySessionPage: React.FC = () => {
  const {
    db,
    currentUser,
    registerBeneficiaryAndAddToSession,
    addBeneficiaryToSession,
    removeBeneficiaryFromSession,
    updateBeneficiary,
    createPregnancyEpisode,
    administerVaccineDoses,
    recordMaternalServices,
    completeSession,
  } = useSheetData();

  const [params, setParams] = useSearchParams();
  const preselectedSessionId = params.get('sessionId') || '';
  const preselectedRecordBenId = params.get('recordBenId') || '';

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';

  // 4-step cascading session filters
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSubcentreId, setSelectedSubcentreId] = useState(scopedSubcentre);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(preselectedSessionId);

  // Mode toggle: A (New Registration Pop-up) vs B (Select Existing Pop-up)
  const [actionMode, setActionMode] = useState<ActiveActionMode>('NONE');

  // Post-Registration / Quick Today's Dose Screen Pop-up (U-WIN style)
  const [doseModalTarget, setDoseModalTarget] = useState<{
    beneficiary: Beneficiary;
    episode: PregnancyEpisode | null;
    isNewlyRegistered?: boolean;
  } | null>(null);
  const [doseModalTicks, setDoseModalTicks] = useState<Record<string, boolean>>({});
  const [doseModalBatch, setDoseModalBatch] = useState<Record<string, string>>({});
  const [doseModalRemarks, setDoseModalRemarks] = useState('');
  const [doseModalAncChecked, setDoseModalAncChecked] = useState<Record<string, boolean>>({});
  const [doseModalAncValue, setDoseModalAncValue] = useState<Record<string, string>>({});
  const [doseModalAncBatch, setDoseModalAncBatch] = useState<Record<string, string>>({});
  const [doseModalChildVitals, setDoseModalChildVitals] = useState<Record<string, string>>({});

  // --- Option A: Inline New Beneficiary Registration State ---
  const [newBenType, setNewBenType] = useState<BeneficiaryType>('CHILD');
  const [newChildName, setNewChildName] = useState('');
  const [newMotherName, setNewMotherName] = useState('');
  const [newFatherName, setNewFatherName] = useState('');
  const [newGuardianName, setNewGuardianName] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newGender, setNewGender] = useState<BeneficiaryGender>('मुलगा');
  const [newMobile, setNewMobile] = useState('');
  const [newAadhaar, setNewAadhaar] = useState('');
  const [newCaste, setNewCaste] = useState('');
  const [newCategory, setNewCategory] = useState<string>(CASTE_CATEGORIES[0]);
  const [newAddress, setNewAddress] = useState('');
  const [newSubcentreId, setNewSubcentreId] = useState('');
  const [newVillageId, setNewVillageId] = useState('');
  const [newAnganwadi, setNewAnganwadi] = useState('');
  // Pregnancy episode fields inside Option A
  const [newMcDate, setNewMcDate] = useState('');
  const [newEddDate, setNewEddDate] = useState('');
  const [newDeliveryPlace, setNewDeliveryPlace] = useState('');
  const [newFacilityType, setNewFacilityType] = useState<DeliveryFacilityType>('Government');
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newGravida, setNewGravida] = useState('');

  const [newFormError, setNewFormError] = useState('');
  const [confirmRegisterOpen, setConfirmRegisterOpen] = useState(false);

  // --- Option B: Existing Beneficiary Search State ---
  const [searchBenType, setSearchBenType] = useState<BeneficiaryType>('CHILD');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSubcentreId, setSearchSubcentreId] = useState('');
  const [searchVillageId, setSearchVillageId] = useState('');
  const [inspectedBenId, setInspectedBenId] = useState<string>('');
  const [selectedEpisodeForExisting, setSelectedEpisodeForExisting] = useState<string>('');
  const [confirmAddExistingBen, setConfirmAddExistingBen] = useState<{
    ben: Beneficiary;
    episodeId?: string;
  } | null>(null);

  // Quick Add New Pregnancy Episode Modal inside Option B
  const [addEpForBen, setAddEpForBen] = useState<Beneficiary | null>(null);
  const [addEpMcDate, setAddEpMcDate] = useState('');
  const [addEpEddDate, setAddEpEddDate] = useState('');
  const [addEpPlace, setAddEpPlace] = useState('');
  const [addEpFacility, setAddEpFacility] = useState<DeliveryFacilityType>('Government');
  const [addEpHospital, setAddEpHospital] = useState('');
  const [addEpGravida, setAddEpGravida] = useState('');

  // Quick Edit Permanent Profile Modal
  const [editProfileBen, setEditProfileBen] = useState<Beneficiary | null>(null);
  const [epName, setEpName] = useState('');
  const [epMother, setEpMother] = useState('');
  const [epGuardian, setEpGuardian] = useState('');
  const [epMobile, setEpMobile] = useState('');
  const [epAadhaar, setEpAadhaar] = useState('');
  const [epCaste, setEpCaste] = useState('');
  const [epCategory, setEpCategory] = useState('');
  const [epAddress, setEpAddress] = useState('');

  // --- Today's Child Vaccination Entry State ---
  const [selectedTicks, setSelectedTicks] = useState<Record<string, boolean>>({});
  const [batchByKey, setBatchByKey] = useState<Record<string, string>>({});
  const [remarksByBenId, setRemarksByBenId] = useState<Record<string, string>>({});
  const [confirmSaveTicksOpen, setConfirmSaveTicksOpen] = useState(false);

  // --- Today's Pregnant Woman ANC Services State (NEVER auto-marked!) ---
  const [activeMaternalBenId, setActiveMaternalBenId] = useState<string>('');
  const [selectedAnc, setSelectedAnc] = useState<Record<string, boolean>>({});
  const [ancValueByKey, setAncValueByKey] = useState<Record<string, string>>({});
  const [ancBatchByKey, setAncBatchByKey] = useState<Record<string, string>>({});
  const [ancRemarksByBenId, setAncRemarksByBenId] = useState<Record<string, string>>({});
  const [confirmSaveAncOpen, setConfirmSaveAncOpen] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<{ sbId: string; name: string } | null>(null);

  // --- Session Completion & Report State ---
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportPreviewCategory, setReportPreviewCategory] = useState<'CHILD' | 'PREGNANT_WOMAN'>('CHILD');
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  const aadhaarAuthorized = canViewFullAadhaar(currentUser?.role);

  // Initialize from ?sessionId=... or today's IST session if available
  useEffect(() => {
    if (!db) return;
    if (preselectedSessionId) {
      const found = db.vaccinationSessions.find((s) => s.id === preselectedSessionId);
      if (found) {
        setSelectedDate(found.sessionDate);
        setSelectedSubcentreId(found.subcentreId);
        setSelectedVillageId(found.villageId);
        setSelectedSessionId(found.id);
        return;
      }
    }
    if (!selectedDate && db.vaccinationSessions.length > 0) {
      const todayIST = getTodayIST();
      const visible = scopedSubcentre
        ? db.vaccinationSessions.filter((s) => s.subcentreId === scopedSubcentre)
        : db.vaccinationSessions;
      const todayMatch = visible.find((s) => s.sessionDate === todayIST);
      if (todayMatch) {
        setSelectedDate(todayMatch.sessionDate);
        setSelectedSubcentreId(todayMatch.subcentreId);
        setSelectedVillageId(todayMatch.villageId);
        setSelectedSessionId(todayMatch.id);
      }
    }
  }, [db, preselectedSessionId, scopedSubcentre, selectedDate]);

  const visibleSessions = useMemo(() => {
    if (!db) return [];
    return scopedSubcentre
      ? db.vaccinationSessions.filter((s) => s.subcentreId === scopedSubcentre)
      : db.vaccinationSessions;
  }, [db, scopedSubcentre]);

  const availableDates = useMemo(() => {
    return Array.from(new Set(visibleSessions.map((s) => s.sessionDate))).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [visibleSessions]);

  const availableSubcentresForDate = useMemo(() => {
    if (!db || !selectedDate) return [];
    const scIds = new Set(
      visibleSessions.filter((s) => s.sessionDate === selectedDate).map((s) => s.subcentreId)
    );
    return db.subcentres.filter((sc) => scIds.has(sc.id));
  }, [db, visibleSessions, selectedDate]);

  const availableVillagesForDateSubcentre = useMemo(() => {
    if (!db || !selectedDate || !selectedSubcentreId) return [];
    const vilIds = new Set(
      visibleSessions
        .filter((s) => s.sessionDate === selectedDate && s.subcentreId === selectedSubcentreId)
        .map((s) => s.villageId)
    );
    return db.villages.filter((v) => vilIds.has(v.id));
  }, [db, visibleSessions, selectedDate, selectedSubcentreId]);

  const matchingSessions = useMemo(() => {
    if (!selectedDate || !selectedSubcentreId || !selectedVillageId) return [];
    return visibleSessions.filter(
      (s) =>
        s.sessionDate === selectedDate &&
        s.subcentreId === selectedSubcentreId &&
        s.villageId === selectedVillageId
    );
  }, [visibleSessions, selectedDate, selectedSubcentreId, selectedVillageId]);

  useEffect(() => {
    if (matchingSessions.length === 1 && selectedSessionId !== matchingSessions[0].id) {
      setSelectedSessionId(matchingSessions[0].id);
      setParams({ sessionId: matchingSessions[0].id });
    }
  }, [matchingSessions, selectedSessionId, setParams]);

  const selectedSession = useMemo(
    () => visibleSessions.find((s) => s.id === selectedSessionId) || null,
    [visibleSessions, selectedSessionId]
  );

  useEffect(() => {
    setActiveMaternalBenId('');
  }, [selectedSessionId]);

  useEffect(() => {
    if (selectedSession) {
      setNewSubcentreId(selectedSession.subcentreId);
      setNewVillageId(selectedSession.villageId);
      setNewDeliveryPlace(selectedSession.villageName);
    }
  }, [selectedSession]);

  // Reset dose modal form inputs whenever target beneficiary changes
  useEffect(() => {
    setDoseModalTicks({});
    setDoseModalBatch({});
    setDoseModalRemarks('');
    setDoseModalAncChecked({});
    setDoseModalAncValue({});
    setDoseModalAncBatch({});
    setDoseModalChildVitals({});
  }, [doseModalTarget?.beneficiary.id]);

  // Support opening Dose Modal directly via ?recordBenId=... query param
  useEffect(() => {
    if (!db || !selectedSession || !preselectedRecordBenId) return;
    if (!getSessionEditStatus(selectedSession).isOpen) return;
    const foundBen = db.beneficiaries.find((b) => b.id === preselectedRecordBenId);
    if (!foundBen) return;

    const eps = db.pregnancyEpisodes
      .filter((ep) => ep.beneficiaryId === foundBen.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const activeEp = eps.find((e) => e.pregnancyStatus === 'सक्रिय') || eps[0] || null;
    const inSession = db.sessionBeneficiaries.some(
      (sb) => sb.sessionId === selectedSession.id && sb.beneficiaryId === foundBen.id
    );

    const openTarget = async () => {
      if (!inSession) {
        try {
          await addBeneficiaryToSession(
            selectedSession,
            foundBen,
            'NEW',
            '',
            activeEp?.id || ''
          );
        } catch {
          // ignore if already present concurrently
        }
      }
      if ((foundBen.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN') {
        setActiveMaternalBenId(foundBen.id);
      }
      setDoseModalTarget({
        beneficiary: foundBen,
        episode: activeEp,
        isNewlyRegistered: true,
      });
      setParams({ sessionId: selectedSession.id });
    };

    void openTarget();
  }, [db, selectedSession, preselectedRecordBenId, addBeneficiaryToSession, setParams]);

  const editStatus = selectedSession ? getSessionEditStatus(selectedSession) : null;

  const validatedSchedules = useMemo(() => {
    if (!db) return [];
    return db.vaccineSchedule
      .filter((s) => s.isActive && s.isValidated)
      .sort((a, b) => a.doseOrder - b.doseOrder);
  }, [db]);

  const activeMaternalCatalog = useMemo(() => {
    if (!db) return [];
    return getMaternalServiceCatalog(db.systemSettings[0]).filter((s) => s.isActive);
  }, [db]);

  const recordsByBeneficiary = useMemo(() => {
    const map = new Map<string, NonNullable<typeof db>['vaccinationRecords']>();
    if (!db) return map;
    for (const r of db.vaccinationRecords) {
      const arr = map.get(r.beneficiaryId) || [];
      arr.push(r);
      map.set(r.beneficiaryId, arr);
    }
    return map;
  }, [db]);

  const episodesByBeneficiary = useMemo(() => {
    const map = new Map<string, PregnancyEpisode[]>();
    if (!db) return map;
    for (const ep of db.pregnancyEpisodes) {
      const arr = map.get(ep.beneficiaryId) || [];
      arr.push(ep);
      map.set(ep.beneficiaryId, arr);
    }
    for (const [k, list] of map.entries()) {
      map.set(
        k,
        list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    }
    return map;
  }, [db]);

  const maternalServicesByBen = useMemo(() => {
    const map = new Map<string, NonNullable<typeof db>['maternalServiceRecords']>();
    if (!db) return map;
    for (const r of db.maternalServiceRecords) {
      const arr = map.get(r.beneficiaryId) || [];
      arr.push(r);
      map.set(r.beneficiaryId, arr);
    }
    return map;
  }, [db]);

  const sessionRosterIds = useMemo(() => {
    if (!db || !selectedSession) return new Set<string>();
    return new Set(
      db.sessionBeneficiaries
        .filter((sb) => sb.sessionId === selectedSession.id)
        .map((sb) => sb.beneficiaryId)
    );
  }, [db, selectedSession]);

  // Split Session Roster Rows cleanly into Child Rows & Pregnant Woman Rows
  const { childSessionRows, maternalSessionRows } = useMemo(() => {
    if (!db || !selectedSession) {
      return { childSessionRows: [], maternalSessionRows: [] };
    }
    const roster = db.sessionBeneficiaries.filter((sb) => sb.sessionId === selectedSession.id);

    const children: Array<{
      sb: (typeof roster)[number];
      ben: Beneficiary;
      evalSummary: ReturnType<typeof evaluateBeneficiaryEligibility>;
      todayDoses: NonNullable<typeof db>['vaccinationRecords'];
      previousDoses: NonNullable<typeof db>['vaccinationRecords'];
      enrollmentType: 'NEW' | 'EXISTING';
    }> = [];

    const women: Array<{
      sb: (typeof roster)[number];
      ben: Beneficiary;
      episode: PregnancyEpisode | null;
      todayServices: NonNullable<typeof db>['maternalServiceRecords'];
      previousServices: NonNullable<typeof db>['maternalServiceRecords'];
      enrollmentType: 'NEW' | 'EXISTING';
    }> = [];

    for (const sb of roster) {
      const ben = db.beneficiaries.find((b) => b.id === sb.beneficiaryId);
      if (!ben) continue;
      const enrollmentType: 'NEW' | 'EXISTING' =
        sb.enrollmentType === 'NEW'
          ? 'NEW'
          : sb.enrollmentType === 'EXISTING'
            ? 'EXISTING'
            : ben.registrationDate === selectedSession.sessionDate &&
                ben.createdAt >= selectedSession.createdAt
              ? 'NEW'
              : 'EXISTING';

      if ((ben.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN') {
        const eps = episodesByBeneficiary.get(ben.id) || [];
        const episode =
          (sb.pregnancyEpisodeId
            ? eps.find((e) => e.id === sb.pregnancyEpisodeId)
            : undefined) ||
          eps.find((e) => e.pregnancyStatus === 'सक्रिय') ||
          eps[0] ||
          null;
        const recs = (maternalServicesByBen.get(ben.id) || []).filter(
          (r) => !episode || !r.pregnancyEpisodeId || r.pregnancyEpisodeId === episode.id
        );
        women.push({
          sb,
          ben,
          episode,
          todayServices: recs.filter((r) => r.sessionId === selectedSession.id),
          previousServices: recs
            .filter((r) => r.sessionId !== selectedSession.id)
            .sort((a, b) => b.visitDate.localeCompare(a.visitDate)),
          enrollmentType,
        });
      } else {
        const benRecords = recordsByBeneficiary.get(ben.id) || [];
        const evalSummary = evaluateBeneficiaryEligibility(
          ben,
          selectedSession.sessionDate,
          validatedSchedules,
          benRecords
        );
        children.push({
          sb,
          ben,
          evalSummary,
          todayDoses: benRecords.filter((r) => r.sessionId === selectedSession.id),
          previousDoses: benRecords
            .filter((r) => r.sessionId !== selectedSession.id)
            .sort((a, b) => a.administeredDate.localeCompare(b.administeredDate)),
          enrollmentType,
        });
      }
    }

    return { childSessionRows: children, maternalSessionRows: women };
  }, [
    db,
    selectedSession,
    recordsByBeneficiary,
    validatedSchedules,
    episodesByBeneficiary,
    maternalServicesByBen,
  ]);

  // Duplicate check for Option A (category-aware)
  const potentialDuplicates = useMemo(() => {
    if (!db) return [];
    const nameLower = newChildName.trim().toLowerCase().replace(/\s+/g, ' ');
    const motherLower = newMotherName.trim().toLowerCase().replace(/\s+/g, ' ');
    const guardLower = (newGuardianName || newFatherName).trim().toLowerCase().replace(/\s+/g, ' ');
    const dob = newDob.trim();
    const cleanMob = newMobile.trim();
    const cleanAadh = newAadhaar.replace(/\D/g, '');

    if (!nameLower && !dob && !cleanMob && !cleanAadh) return [];

    const primaryKey = normalizeBeneficiaryDedupeKey({
      beneficiaryType: newBenType,
      fullName: newChildName,
      guardianOrMotherName: newBenType === 'PREGNANT_WOMAN' ? guardLower : motherLower || guardLower,
      dob,
      mobile: cleanMob,
    });
    const legacyKey =
      newBenType === 'CHILD' && nameLower && motherLower && dob
        ? normalizeDedupeKey(newChildName, newMotherName, dob)
        : '';

    return db.beneficiaries.filter((b) => {
      if (b.dedupeKey === primaryKey || (legacyKey && b.dedupeKey === legacyKey)) return true;
      if (cleanAadh.length === 12 && b.aadhaarNumber === cleanAadh) return true;
      if ((b.beneficiaryType || 'CHILD') !== newBenType) return false;
      if (newBenType === 'CHILD' && dob && motherLower && b.dob === dob && b.motherName.trim().toLowerCase() === motherLower) {
        return true;
      }
      if (
        newBenType === 'PREGNANT_WOMAN' &&
        nameLower &&
        guardLower &&
        b.childName.trim().toLowerCase() === nameLower &&
        (b.guardianName || b.fatherName || '').trim().toLowerCase() === guardLower
      ) {
        return true;
      }
      return false;
    });
  }, [db, newBenType, newChildName, newMotherName, newGuardianName, newFatherName, newDob, newMobile, newAadhaar]);

  const exactDuplicateExists = useMemo(() => {
    if (!db || !newChildName.trim()) return false;
    if (newBenType === 'CHILD' && (!newMotherName.trim() || !newDob)) return false;
    if (newBenType === 'PREGNANT_WOMAN' && !newGuardianName.trim()) return false;
    const key = normalizeBeneficiaryDedupeKey({
      beneficiaryType: newBenType,
      fullName: newChildName,
      guardianOrMotherName: newBenType === 'PREGNANT_WOMAN' ? newGuardianName : newMotherName,
      dob: newDob,
      mobile: newMobile,
    });
    const cleanAadh = newAadhaar.replace(/\D/g, '');
    return db.beneficiaries.some(
      (b) => b.dedupeKey === key || (cleanAadh.length === 12 && b.aadhaarNumber === cleanAadh)
    );
  }, [db, newBenType, newChildName, newMotherName, newGuardianName, newDob, newMobile, newAadhaar]);

  // Search results for Option B (Category-First Existing Beneficiary Search)
  const baseExistingBeneficiaries = useMemo(() => {
    if (!db) return [];
    return db.beneficiaries
      .filter((b) => b.status === 'सक्रिय' && (b.beneficiaryType || 'CHILD') === searchBenType)
      .filter((b) => !searchSubcentreId || b.subcentreId === searchSubcentreId)
      .filter((b) => !searchVillageId || b.villageId === searchVillageId);
  }, [db, searchBenType, searchSubcentreId, searchVillageId]);

  const getExistingSearchFields = (b: Beneficiary) => {
    const dobDisplay = formatDDMMYYYY(b.dob);
    const eps = searchBenType === 'PREGNANT_WOMAN' ? episodesByBeneficiary.get(b.id) || [] : [];
    const epFields = eps.flatMap((ep) => [
      ep.episodeCode,
      ep.mcDate,
      formatDDMMYYYY(ep.mcDate),
      ep.eddDate,
      formatDDMMYYYY(ep.eddDate),
    ]);
    return [
      b.childName,
      b.beneficiaryCode,
      b.motherName,
      b.fatherName,
      b.guardianName,
      b.villageName,
      b.dob,
      dobDisplay,
      b.mobile,
      ...epFields,
    ];
  };

  const existingSearchResults = useMemo(() => {
    return fuzzyFilterAndRank(
      baseExistingBeneficiaries,
      searchQuery,
      getExistingSearchFields
    ).slice(0, 40);
  }, [baseExistingBeneficiaries, searchQuery, searchBenType, episodesByBeneficiary]);

  const inspectedBeneficiarySummary = useMemo(() => {
    if (!db || !selectedSession || !inspectedBenId) return null;
    const ben = db.beneficiaries.find((b) => b.id === inspectedBenId);
    if (!ben) return null;
    const isWoman = (ben.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN';
    if (isWoman) {
      const episodes = episodesByBeneficiary.get(ben.id) || [];
      const activeEp =
        (selectedEpisodeForExisting
          ? episodes.find((e) => e.id === selectedEpisodeForExisting)
          : undefined) ||
        episodes.find((e) => e.pregnancyStatus === 'सक्रिय') ||
        episodes[0] ||
        null;
      const ancHistory = (maternalServicesByBen.get(ben.id) || []).sort((a, b) =>
        b.visitDate.localeCompare(a.visitDate)
      );
      return { ben, isWoman: true as const, episodes, activeEp, ancHistory };
    }
    const benRecords = recordsByBeneficiary.get(ben.id) || [];
    const evalSummary = evaluateBeneficiaryEligibility(
      ben,
      selectedSession.sessionDate,
      validatedSchedules,
      benRecords
    );
    const upcomingDoses = evalSummary.allDoseResults.filter(
      (d) => d.status === 'NOT_YET_ELIGIBLE' || d.status === 'INTERVAL_PENDING'
    );
    return { ben, isWoman: false as const, evalSummary, upcomingDoses };
  }, [
    db,
    selectedSession,
    inspectedBenId,
    selectedEpisodeForExisting,
    episodesByBeneficiary,
    maternalServicesByBen,
    recordsByBeneficiary,
    validatedSchedules,
  ]);

  // Pending checked ticks for Child Vaccination table
  const pendingTickEntries = useMemo<PendingTickEntry[]>(() => {
    const list: PendingTickEntry[] = [];
    for (const row of childSessionRows) {
      for (const res of row.evalSummary.dueDoses) {
        const key = `${row.ben.id}_${res.schedule.id}`;
        if (selectedTicks[key]) {
          list.push({
            beneficiary: row.ben,
            schedule: res.schedule,
            batchNumber: batchByKey[key] || '',
            remarks: remarksByBenId[row.ben.id] || '',
          });
        }
      }
    }
    return list;
  }, [childSessionRows, selectedTicks, batchByKey, remarksByBenId]);

  // Focused active Pregnant Woman for single-mother isolated ANC data entry
  const activeMaternalRow = useMemo(() => {
    if (maternalSessionRows.length === 0) return null;
    return (
      maternalSessionRows.find((r) => r.ben.id === activeMaternalBenId) ||
      maternalSessionRows[0]
    );
  }, [maternalSessionRows, activeMaternalBenId]);

  const activeMaternalIdx = useMemo(() => {
    if (!activeMaternalRow) return -1;
    return maternalSessionRows.findIndex((r) => r.ben.id === activeMaternalRow.ben.id);
  }, [maternalSessionRows, activeMaternalRow]);

  // Pending explicit entries across session (used for completion warning)
  const pendingMaternalEntries = useMemo<PendingMaternalEntry[]>(() => {
    const list: PendingMaternalEntry[] = [];
    for (const row of maternalSessionRows) {
      if (!row.episode) continue;
      for (const svc of activeMaternalCatalog) {
        const key = `${row.ben.id}_${svc.serviceCode}`;
        if (selectedAnc[key]) {
          list.push({
            beneficiary: row.ben,
            episode: row.episode,
            service: svc,
            serviceValue: ancValueByKey[key]?.trim() || 'पूर्ण',
            batchNumber: ancBatchByKey[key]?.trim() || '',
            remarks: ancRemarksByBenId[row.ben.id]?.trim() || '',
          });
        }
      }
    }
    return list;
  }, [maternalSessionRows, activeMaternalCatalog, selectedAnc, ancValueByKey, ancBatchByKey, ancRemarksByBenId]);

  // Scoped strictly to the currently selected Pregnant Woman
  const activeMaternalPendingEntries = useMemo<PendingMaternalEntry[]>(() => {
    if (!activeMaternalRow) return [];
    return pendingMaternalEntries.filter(
      (entry) => entry.beneficiary.id === activeMaternalRow.ben.id
    );
  }, [pendingMaternalEntries, activeMaternalRow]);

  // Report data builders (Child & Maternal kept cleanly separate)
  const childReportData = useMemo(() => {
    if (!db || !selectedSession || !currentUser) return null;
    return buildDetailedSessionReportData(
      db,
      selectedSession,
      `${currentUser.name} (${currentUser.role})`
    );
  }, [db, selectedSession, currentUser]);

  const maternalReportData = useMemo(() => {
    if (!db || !selectedSession || !currentUser) return null;
    return buildMaternalSessionReportData(
      db,
      selectedSession,
      `${currentUser.name} (${currentUser.role})`
    );
  }, [db, selectedSession, currentUser]);

  if (!db) return null;

  const canModifySession = Boolean(
    selectedSession &&
      editStatus?.isOpen &&
      !['पूर्ण', 'लॉक', 'रद्द'].includes(selectedSession.status) &&
      currentUser &&
      ['ADMIN', 'MEDICAL_OFFICER', 'DATA_OPERATOR', 'CHO', 'ANM'].includes(currentUser.role)
  );

  const newFormVillages = db.villages.filter(
    (v) => v.isActive && v.subcentreId === newSubcentreId
  );

  const searchFilterVillages = db.villages.filter(
    (v) => v.isActive && (!searchSubcentreId || v.subcentreId === searchSubcentreId)
  );

  const newBeneficiaryAgeOnSession =
    newDob && selectedSession
      ? calculateAgeAsOf(newDob, selectedSession.sessionDate).labelMarathi
      : '-';

  // Handlers
  const handleValidateNewBeneficiary = (e: React.FormEvent) => {
    e.preventDefault();
    setNewFormError('');
    if (!selectedSession) return;
    if (!newSubcentreId || !newVillageId) {
      setNewFormError('कृपया उपकेंद्र आणि गाव निवडा.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(newMobile.trim())) {
      setNewFormError('कृपया वैध १० अंकी मोबाईल क्रमांक प्रविष्ट करा.');
      return;
    }
    if (newBenType === 'CHILD' && !newDob) {
      setNewFormError('बालकासाठी जन्मतारीख अनिवार्य आहे.');
      return;
    }
    if (newBenType === 'PREGNANT_WOMAN' && (!newMcDate || !newEddDate)) {
      setNewFormError('गरोदर मातेसाठी MC दिनांक आणि EDD दिनांक अनिवार्य आहेत.');
      return;
    }
    try {
      sanitizeOptionalAadhaar(newAadhaar);
    } catch (err) {
      setNewFormError(err instanceof Error ? err.message : 'आधार क्रमांक अवैध आहे.');
      return;
    }
    if (exactDuplicateExists) {
      setNewFormError(
        'हा लाभार्थी आधीच नोंदलेला आहे! कृपया खालील विद्यमान लाभार्थी निवडा व आजच्या सत्रात समाविष्ट करा.'
      );
      return;
    }
    setConfirmRegisterOpen(true);
  };

  const handleConfirmRegisterNew = async () => {
    if (!selectedSession) return;
    const sc = db.subcentres.find((s) => s.id === newSubcentreId);
    const vl = db.villages.find((v) => v.id === newVillageId);
    if (!sc || !vl) return;

    setBusy(true);
    try {
      const effectiveGuardian =
        newBenType === 'PREGNANT_WOMAN'
          ? newGuardianName.trim()
          : newGuardianName.trim() || newFatherName.trim() || newMotherName.trim();

      const res = await registerBeneficiaryAndAddToSession(
        selectedSession,
        {
          beneficiaryType: newBenType,
          childName: newChildName.trim(),
          motherName: newBenType === 'PREGNANT_WOMAN' ? newChildName.trim() : newMotherName.trim(),
          fatherName:
            newBenType === 'PREGNANT_WOMAN'
              ? effectiveGuardian
              : newFatherName.trim() || effectiveGuardian,
          guardianName: effectiveGuardian,
          dob: newBenType === 'CHILD' ? newDob : '',
          gender: newBenType === 'PREGNANT_WOMAN' ? 'स्त्री' : newGender,
          mobile: newMobile.trim(),
          aadhaarNumber: newAadhaar.trim(),
          caste: newCaste.trim(),
          category: newCategory,
          address: newAddress.trim() || vl.name,
          subcentreId: sc.id,
          subcentreName: sc.name,
          villageId: vl.id,
          villageName: vl.name,
          anganwadi: newBenType === 'CHILD' ? newAnganwadi.trim() : '',
          registrationDate: selectedSession.sessionDate,
          status: 'सक्रिय',
        },
        newBenType === 'PREGNANT_WOMAN'
          ? {
              mcDate: newMcDate,
              eddDate: newEddDate || calculateEddFromMcDate(newMcDate),
              expectedDeliveryPlace: newDeliveryPlace.trim() || vl.name,
              deliveryFacilityType: newFacilityType,
              hospitalName: newHospitalName.trim(),
              pregnancyRegistrationDate: selectedSession.sessionDate,
              pregnancyStatus: 'सक्रिय',
              gravidaPara: newGravida.trim(),
            }
          : undefined
      );
      if (newBenType === 'PREGNANT_WOMAN') {
        setActiveMaternalBenId(res.beneficiary.id);
      }
      setToast({
        msg:
          newBenType === 'PREGNANT_WOMAN'
            ? `नवीन गरोदर माता (${res.beneficiary.beneficiaryCode} · ${res.episode?.episodeCode || ''}) नोंदवली आणि सत्रात समाविष्ट केली.`
            : `नवीन बालक (${res.beneficiary.beneficiaryCode}) नोंदवला आणि आजच्या सत्रात समाविष्ट केला.`,
        type: 'success',
      });
      setNewChildName('');
      setNewMotherName('');
      setNewFatherName('');
      setNewGuardianName('');
      setNewDob('');
      setNewMobile('');
      setNewAadhaar('');
      setNewCaste('');
      setNewAddress('');
      setNewAnganwadi('');
      setNewMcDate('');
      setNewEddDate('');
      setNewHospitalName('');
      setNewGravida('');
      setConfirmRegisterOpen(false);
      setActionMode('NONE');
      // Immediately open Today's Session Dose / Service Screen for the newly registered beneficiary
      setDoseModalTarget({
        beneficiary: res.beneficiary,
        episode: res.episode || null,
        isNewlyRegistered: true,
      });
    } catch (err) {
      setNewFormError(err instanceof Error ? err.message : 'नोंदणी करताना त्रुटी आली.');
      setConfirmRegisterOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAddExisting = async () => {
    if (!selectedSession || !confirmAddExistingBen) return;
    setBusy(true);
    try {
      const targetBen = confirmAddExistingBen.ben;
      const targetEpId = confirmAddExistingBen.episodeId || '';
      await addBeneficiaryToSession(
        selectedSession,
        targetBen,
        'EXISTING',
        '',
        targetEpId
      );
      if ((targetBen.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN') {
        setActiveMaternalBenId(targetBen.id);
      }
      const eps = episodesByBeneficiary.get(targetBen.id) || [];
      const resolvedEp =
        (targetEpId ? eps.find((e) => e.id === targetEpId) : undefined) ||
        eps.find((e) => e.pregnancyStatus === 'सक्रिय') ||
        eps[0] ||
        null;
      setToast({
        msg: `${targetBen.childName} (${targetBen.beneficiaryCode}) आजच्या सत्रात समाविष्ट केले गेले.`,
        type: 'success',
      });
      setConfirmAddExistingBen(null);
      setInspectedBenId('');
      setSelectedEpisodeForExisting('');
      setActionMode('NONE');
      setDoseModalTarget({
        beneficiary: targetBen,
        episode: resolvedEp,
        isNewlyRegistered: false,
      });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
      setConfirmAddExistingBen(null);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateEpisodeInSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEpForBen || !selectedSession) return;
    setBusy(true);
    try {
      const ep = await createPregnancyEpisode(addEpForBen, {
        mcDate: addEpMcDate,
        eddDate: addEpEddDate || calculateEddFromMcDate(addEpMcDate),
        expectedDeliveryPlace: addEpPlace.trim() || addEpForBen.villageName,
        deliveryFacilityType: addEpFacility,
        hospitalName: addEpHospital.trim(),
        pregnancyRegistrationDate: selectedSession.sessionDate,
        pregnancyStatus: 'सक्रिय',
        gravidaPara: addEpGravida.trim(),
      });
      setSelectedEpisodeForExisting(ep.id);
      setAddEpForBen(null);
      setToast({
        msg: `नवीन गर्भधारणा प्रकरण (${ep.episodeCode}) तयार झाले. आता सत्रात समाविष्ट करू शकता.`,
        type: 'success',
      });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const openQuickEditProfile = (b: Beneficiary) => {
    setEditProfileBen(b);
    setEpName(b.childName);
    setEpMother(b.motherName);
    setEpGuardian(b.guardianName || b.fatherName || '');
    setEpMobile(b.mobile);
    setEpAadhaar(aadhaarAuthorized ? b.aadhaarNumber || '' : '');
    setEpCaste(b.caste || '');
    setEpCategory(b.category || CASTE_CATEGORIES[0]);
    setEpAddress(b.address || '');
  };

  const handleSaveQuickEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProfileBen) return;
    if (!/^[6-9]\d{9}$/.test(epMobile.trim())) {
      setToast({ msg: 'कृपया वैध १० अंकी मोबाईल क्रमांक प्रविष्ट करा.', type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const isWoman = (editProfileBen.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN';
      await updateBeneficiary(editProfileBen.id, {
        childName: epName.trim(),
        motherName: isWoman ? epName.trim() : epMother.trim(),
        fatherName: epGuardian.trim(),
        guardianName: epGuardian.trim(),
        mobile: epMobile.trim(),
        ...(aadhaarAuthorized ? { aadhaarNumber: epAadhaar.trim() } : {}),
        caste: epCaste.trim(),
        category: epCategory,
        address: epAddress.trim(),
      });
      setToast({ msg: 'कायमस्वरूपी प्रोफाइल अद्यतनित झाले (Audit Log नोंदवले).', type: 'success' });
      setEditProfileBen(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const toggleTick = (benId: string, scheduleId: string) => {
    const key = `${benId}_${scheduleId}`;
    setSelectedTicks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirmSaveTicks = async () => {
    if (!selectedSession || pendingTickEntries.length === 0) return;
    setBusy(true);
    try {
      await administerVaccineDoses(
        selectedSession,
        pendingTickEntries.map((item) => ({
          beneficiary: item.beneficiary,
          schedule: item.schedule,
          administeredDate: selectedSession.sessionDate,
          batchNumber: item.batchNumber,
          remarks: item.remarks,
        }))
      );
      setSelectedTicks({});
      setConfirmSaveTicksOpen(false);
      setToast({
        msg: `आज दिलेले ${pendingTickEntries.length} बालक लस डोस यशस्वीरित्या जतन झाले.`,
        type: 'success',
      });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
      setConfirmSaveTicksOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSaveAnc = async () => {
    if (!selectedSession || !activeMaternalRow || activeMaternalPendingEntries.length === 0) return;
    setBusy(true);
    try {
      await recordMaternalServices(
        selectedSession,
        activeMaternalPendingEntries.map((e) => ({
          beneficiary: e.beneficiary,
          episode: e.episode,
          serviceCode: e.service.serviceCode,
          serviceName: e.service.serviceName,
          serviceValue: e.serviceValue,
          batchNumber: e.batchNumber,
          remarks: e.remarks,
          visitDate: selectedSession.sessionDate,
        }))
      );
      const savedBenId = activeMaternalRow.ben.id;
      const savedCount = activeMaternalPendingEntries.length;
      setSelectedAnc((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (k.startsWith(`${savedBenId}_`)) {
            delete next[k];
          }
        }
        return next;
      });
      setConfirmSaveAncOpen(false);
      setToast({
        msg: `${activeMaternalRow.ben.childName} यांच्या आजच्या ${savedCount} ANC सेवा जतन झाल्या.`,
        type: 'success',
      });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
      setConfirmSaveAncOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDoseModalChild = async (
    targetBen: Beneficiary,
    dueSchedules: VaccineSchedule[]
  ) => {
    if (!selectedSession || !canModifySession) return;
    const selectedSchedules = dueSchedules.filter((s) => Boolean(doseModalTicks[s.id]));
    const vitalsEntries = VITAL_METRIC_DEFS.filter(
      (def) => (doseModalChildVitals[def.code] || '').trim().length > 0
    );
    if (selectedSchedules.length === 0 && vitalsEntries.length === 0) return;

    setBusy(true);
    try {
      if (selectedSchedules.length > 0) {
        await administerVaccineDoses(
          selectedSession,
          selectedSchedules.map((sch) => ({
            beneficiary: targetBen,
            schedule: sch,
            administeredDate: selectedSession.sessionDate,
            batchNumber: (doseModalBatch[sch.id] || '').trim(),
            remarks: doseModalRemarks.trim(),
          }))
        );
      }
      if (vitalsEntries.length > 0) {
        await recordMaternalServices(
          selectedSession,
          vitalsEntries.map((def) => ({
            beneficiary: targetBen,
            episode: null,
            serviceCode: def.code,
            serviceName: def.label,
            serviceValue: (doseModalChildVitals[def.code] || '').trim(),
            batchNumber: '',
            remarks: doseModalRemarks.trim(),
            visitDate: selectedSession.sessionDate,
          }))
        );
      }
      const parts: string[] = [];
      if (selectedSchedules.length > 0) parts.push(`${selectedSchedules.length} लस डोस`);
      if (vitalsEntries.length > 0) parts.push(`${vitalsEntries.length} वाढ/तपासणी नोंदी`);
      setToast({
        msg: `${targetBen.childName} यांच्या आजच्या ${parts.join(' व ')} यशस्वीरित्या जतन झाल्या.`,
        type: 'success',
      });
      setDoseModalTarget(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDoseModalMaternal = async (
    targetBen: Beneficiary,
    episode: PregnancyEpisode
  ) => {
    if (!selectedSession || !canModifySession) return;
    const selectedSvcs = activeMaternalCatalog.filter((svc) =>
      Boolean(doseModalAncChecked[svc.serviceCode])
    );
    if (selectedSvcs.length === 0) return;
    setBusy(true);
    try {
      await recordMaternalServices(
        selectedSession,
        selectedSvcs.map((svc) => ({
          beneficiary: targetBen,
          episode,
          serviceCode: svc.serviceCode,
          serviceName: svc.serviceName,
          serviceValue: (doseModalAncValue[svc.serviceCode] || '').trim() || 'पूर्ण',
          batchNumber: (doseModalAncBatch[svc.serviceCode] || '').trim(),
          remarks: doseModalRemarks.trim(),
          visitDate: selectedSession.sessionDate,
        }))
      );
      setToast({
        msg: `${targetBen.childName} यांच्या आजच्या ${selectedSvcs.length} ANC / Td सेवा जतन झाल्या.`,
        type: 'success',
      });
      setDoseModalTarget(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!selectedSession || !removeTarget) return;
    setBusy(true);
    try {
      await removeBeneficiaryFromSession(selectedSession, removeTarget.sbId);
      setRemoveTarget(null);
      setToast({ msg: 'लाभार्थी आजच्या सत्रातून काढला गेला.', type: 'success' });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!selectedSession) return;
    setBusy(true);
    try {
      await completeSession(selectedSession.id);
      setCompletionModalOpen(false);
      setActionMode('NONE');
      setDoseModalTarget(null);
      setEditProfileBen(null);
      setAddEpForBen(null);
      setToast({
        msg: `लसीकरण सत्र (${selectedSession.sessionCode}) बंद / पूर्ण झाले! यापुढे डेटा एन्ट्री बंद राहील. आपण सर्व अहवाल PDF डाउनलोड करू शकता.`,
        type: 'success',
      });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
      setCompletionModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadChildPdf = async () => {
    if (!childReportData) return;
    setPdfDownloading(true);
    try {
      await downloadDetailedSessionPDF(childReportData);
      setToast({ msg: 'बालक लसीकरण सत्र अहवाल PDF डाउनलोड झाला.', type: 'success' });
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'PDF तयार करताना त्रुटी आली.',
        type: 'error',
      });
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleDownloadMaternalPdf = async () => {
    if (!maternalReportData) return;
    setPdfDownloading(true);
    try {
      await downloadMaternalSessionPDF(maternalReportData);
      setToast({ msg: 'गरोदर माता ANC सत्र अहवाल PDF डाउनलोड झाला.', type: 'success' });
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'PDF तयार करताना त्रुटी आली.',
        type: 'error',
      });
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleDownloadConsolidatedPdf = async (beneficiaryId: string) => {
    if (!db) return;
    setPdfDownloading(true);
    try {
      const preparedBy = currentUser ? `${currentUser.name} (${currentUser.role})` : 'PHC Bhada';
      await downloadBeneficiaryConsolidatedPDF(db, beneficiaryId, preparedBy);
      setToast({ msg: 'लाभार्थ्याचे एकत्रित संपूर्ण रेकॉर्ड PDF डाउनलोड झाले.', type: 'success' });
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'PDF तयार करताना त्रुटी आली.',
        type: 'error',
      });
    } finally {
      setPdfDownloading(false);
    }
  };

  const todayIST = getTodayIST();

  return (
    <div className="app-page">
      {/* Page Title & Separate Child / Maternal PDF Report Buttons */}
      <PageHeader
        title="आजचे लसीकरण सत्र – लाभार्थी व्यवस्थापन"
        subtitle="बालक व गरोदर माता स्वतंत्र प्रोफाइल व्यवस्थापन, कायमस्वरूपी प्रोफाइल कॅरी-फॉरवर्ड आणि स्वतंत्र सविस्तर PDF अहवाल"
        actions={
          selectedSession && childReportData && maternalReportData ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReportPreviewCategory('CHILD');
                  setReportPreviewOpen(true);
                }}
                className="app-btn-secondary text-xs"
              >
                <Eye className="w-4 h-4 text-teal-700" /> अहवाल पूर्वावलोकन / Print / Excel
              </button>
              <button
                type="button"
                disabled={pdfDownloading}
                onClick={handleDownloadChildPdf}
                className="app-btn-primary text-xs"
              >
                <Download className="w-4 h-4" /> बालक अहवाल PDF
              </button>
              <button
                type="button"
                disabled={pdfDownloading}
                onClick={handleDownloadMaternalPdf}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" /> गरोदर माता ANC अहवाल PDF
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Step 1-4 Cascading Session Selector */}
      <div className="app-card app-card-body space-y-4">
        <div className="app-section-title">
          <CalendarCheck className="w-4 h-4 text-teal-700" /> लसीकरण सत्र निवडा (दिनांक → उपकेंद्र → गाव → सत्र)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              १. लसीकरण दिनांक *
            </label>
            <select
              value={selectedDate}
              onChange={(e) => {
                const nextDate = e.target.value;
                setSelectedDate(nextDate);
                if (!scopedSubcentre) setSelectedSubcentreId('');
                setSelectedVillageId('');
                setSelectedSessionId('');
                setParams({});
                setActionMode('NONE');
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white font-mono-tabular"
            >
              <option value="">-- दिनांक निवडा --</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {formatDDMMYYYY(d)} {d === todayIST ? '(आज)' : ''}
                </option>
              ))}
            </select>
          </div>

          <SearchableSelect
            label="२. उपकेंद्र निवडा"
            required
            disabled={!selectedDate || Boolean(scopedSubcentre)}
            value={selectedSubcentreId}
            onChange={(val) => {
              setSelectedSubcentreId(val);
              setSelectedVillageId('');
              setSelectedSessionId('');
              setParams({});
              setActionMode('NONE');
            }}
            options={availableSubcentresForDate.map((s) => ({
              value: s.id,
              label: s.name,
              sublabel: s.code,
            }))}
          />

          <SearchableSelect
            label="३. गाव निवडा"
            required
            disabled={!selectedDate || !selectedSubcentreId}
            value={selectedVillageId}
            onChange={(val) => {
              setSelectedVillageId(val);
              setSelectedSessionId('');
              setParams({});
              setActionMode('NONE');
            }}
            options={availableVillagesForDateSubcentre.map((v) => ({
              value: v.id,
              label: v.name,
              sublabel: v.villageCode,
            }))}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              ४. लसीकरण सत्र निवडा *
            </label>
            <select
              disabled={!selectedVillageId}
              value={selectedSessionId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedSessionId(nextId);
                setParams(nextId ? { sessionId: nextId } : {});
                setSelectedTicks({});
                setSelectedAnc({});
                setActionMode('NONE');
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white disabled:bg-slate-100"
            >
              <option value="">-- सत्र निवडा --</option>
              {matchingSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sessionCode} · {s.location} ({s.sessionType})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selected Session Overview & Completion Status */}
      {selectedSession && editStatus && childReportData && maternalReportData && (
        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
              <span className="font-mono-tabular text-teal-800">{selectedSession.sessionCode}</span>
              <span className="text-slate-400">·</span>
              <span>{selectedSession.villageName}</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono-tabular">{formatDDMMYYYY(selectedSession.sessionDate)}</span>
              <span className="text-slate-400">·</span>
              <span
                className={
                  selectedSession.status === 'पूर्ण'
                    ? 'text-emerald-700'
                    : editStatus.isOpen
                      ? 'text-teal-700'
                      : 'text-rose-700'
                }
              >
                स्थिती: {selectedSession.status}
              </span>
            </div>
            <div className="text-xs text-slate-600">
              उपकेंद्र: {selectedSession.subcentreName} · ठिकाण: {selectedSession.location} · ANM:{' '}
              {selectedSession.anmName || '-'} · CHO: {selectedSession.choName || '-'}
            </div>
            <div className="text-xs text-slate-500">
              {editStatus.isOpen ? (
                <span className="text-emerald-700 font-medium">
                  {editStatus.labelMarathi} · {editStatus.remainingText}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                  <Lock className="w-3.5 h-3.5" /> {editStatus.labelMarathi} · {editStatus.remainingText}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="text-right pr-3 border-r border-slate-200 hidden sm:block">
              <div className="text-[11px] text-slate-500">बालके / गरोदर माता</div>
              <div className="text-sm font-bold font-mono-tabular text-slate-900">
                {formatNumberIN(childReportData.summary.totalBeneficiaries)} बालके ·{' '}
                {formatNumberIN(maternalReportData.summary.totalWomen)} माता
              </div>
            </div>

            {canModifySession && selectedSession.status !== 'पूर्ण' && (
              <button
                type="button"
                onClick={() => setCompletionModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap"
              >
                <ClipboardCheck className="w-4 h-4" /> लसीकरण सत्र पूर्ण करा
              </button>
            )}
          </div>
        </div>
      )}

      {/* Closed / Locked Session Notice */}
      {selectedSession && editStatus && !editStatus.isOpen && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-950">
          <Lock className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-rose-900">
              सत्र बंद / लॉक — डेटा एन्ट्री बंद आहे ({selectedSession.status})
            </div>
            <p>
              हे लसीकरण सत्र बंद/पूर्ण झालेले असल्यामुळे नवीन लाभार्थी जोडणे, लस डोस टिकमार्क करणे किंवा तपासणी नोंदी करणे बंद केले आहे. आपण सत्र अहवाल आणि प्रत्येक लाभार्थ्याचे संपूर्ण रेकॉर्ड PDF डाउनलोड करू शकता.
            </p>
          </div>
        </div>
      )}

      {/* U-WIN Style Quick Action Triggers: A (New Registration Pop-up) & B (Search Pop-up) */}
      {selectedSession && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            disabled={!canModifySession}
            onClick={() => {
              setNewFormError('');
              setActionMode('NEW_BENEFICIARY');
            }}
            className="text-left p-4 md:p-5 rounded-xl border border-teal-200 bg-white hover:border-teal-600 hover:bg-teal-50/40 transition-colors flex items-center justify-between gap-4 disabled:opacity-50"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="p-3 rounded-lg bg-teal-700 text-white shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-slate-900">
                  + नवीन लाभार्थी नोंदणी करा
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  बालक किंवा गरोदर माता नोंदवा — सेव केल्यावर लगेच आजचे डोस स्क्रीन उघडेल.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold whitespace-nowrap shrink-0">
              नोंदणी उघडा →
            </span>
          </button>

          <button
            type="button"
            disabled={!canModifySession}
            onClick={() => setActionMode('SELECT_EXISTING')}
            className="text-left p-4 md:p-5 rounded-xl border border-slate-200 bg-white hover:border-teal-600 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 disabled:opacity-50"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="p-3 rounded-lg bg-slate-800 text-white shrink-0">
                <Search className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-slate-900">
                  नोंदणीकृत लाभार्थी शोधा
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  नाव, आयडी, मोबाईल किंवा दिनांकाने शोधून आजच्या सत्रात निवडा व डोस द्या.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold whitespace-nowrap shrink-0">
              शोध बॉक्स उघडा →
            </span>
          </button>
        </div>
      )}

      {/* POP-UP MODAL A: U-WIN Style New Beneficiary Registration */}
      {selectedSession && canModifySession && actionMode === 'NEW_BENEFICIARY' && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true" aria-label="नवीन लाभार्थी नोंदणी">
          <form
            onSubmit={handleValidateNewBeneficiary}
            className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col max-h-[92vh] overflow-hidden"
          >
            <div className="px-5 py-3.5 bg-teal-800 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-[11px] text-teal-100 font-medium truncate">
                  सत्र: <span className="font-mono-tabular">{selectedSession.sessionCode}</span> ·{' '}
                  {selectedSession.villageName} · दि.{' '}
                  <span className="font-mono-tabular">{formatDDMMYYYY(selectedSession.sessionDate)}</span>
                </div>
                <h3 className="text-base font-bold leading-snug">
                  नवीन लाभार्थी नोंदणी (U-WIN नोंदणी स्क्रीन)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionMode('NONE')}
                className="p-2 rounded-lg text-teal-100 hover:text-white hover:bg-teal-700/70 shrink-0"
                aria-label="बंद करा"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* Beneficiary Category Selection */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 mr-1">लाभार्थी प्रकार निवडा *:</span>
            <button
              type="button"
              onClick={() => {
                setNewBenType('CHILD');
                setNewGender('मुलगा');
                setNewFormError('');
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                newBenType === 'CHILD'
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Baby className="w-4 h-4" /> बालक (Child)
            </button>
            <button
              type="button"
              onClick={() => {
                setNewBenType('PREGNANT_WOMAN');
                setNewGender('स्त्री');
                setNewFormError('');
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                newBenType === 'PREGNANT_WOMAN'
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <HeartPulse className="w-4 h-4" /> गरोदर माता (Pregnant Woman)
            </button>
          </div>

          {newFormError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {newFormError}
            </div>
          )}

          {/* Duplicate Detection Alert */}
          {potentialDuplicates.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
              <div className="flex items-start gap-2 text-xs font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  सावधान! मिळतीजुळती कायमस्वरूपी नोंदणी आधीच आढळली आहे. डुप्लिकेट प्रोफाइल बनवण्याऐवजी खालील नोंद सत्रात जोडा:
                </div>
              </div>
              <div className="space-y-2">
                {potentialDuplicates.map((dup) => {
                  const inSession = sessionRosterIds.has(dup.id);
                  return (
                    <div
                      key={dup.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white border border-amber-200 rounded-lg p-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {dup.childName} ·{' '}
                          <span className="font-mono-tabular text-teal-800">
                            {dup.beneficiaryCode}
                          </span>{' '}
                          · आधार: {maskAadhaar(dup.aadhaarNumber)}
                        </div>
                        <div className="text-slate-600">
                          पालक/पती: {dup.guardianName || dup.fatherName} · गाव: {dup.villageName} · मोबाईल:{' '}
                          <span className="font-mono-tabular">{dup.mobile}</span>
                        </div>
                      </div>
                      {inSession ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold whitespace-nowrap">
                          <CheckCircle2 className="w-4 h-4" /> आजच्या सत्रात आधीच समाविष्ट
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmAddExistingBen({ ben: dup })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> विद्यमान प्रोफाइल सत्रात जोडा
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Permanent Profile Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {newBenType === 'PREGNANT_WOMAN' ? 'मातेचे पूर्ण नाव *' : 'बालकाचे पूर्ण नाव *'}
              </label>
              <input
                required
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {newBenType === 'CHILD' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    पालक / अभिभावकाचे पूर्ण नाव *
                  </label>
                  <input
                    required
                    value={newGuardianName}
                    onChange={(e) => setNewGuardianName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">आईचे नाव *</label>
                  <input
                    required
                    value={newMotherName}
                    onChange={(e) => setNewMotherName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    जन्मतारीख *{' '}
                    <span className="text-xs text-teal-700">
                      (सत्राचे वय: {newBeneficiaryAgeOnSession})
                    </span>
                  </label>
                  <input
                    type="date"
                    required
                    max={selectedSession.sessionDate}
                    value={newDob}
                    onChange={(e) => setNewDob(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">लिंग *</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value as BeneficiaryGender)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="मुलगा">मुलगा</option>
                    <option value="मुलगी">मुलगी</option>
                    <option value="इतर">इतर</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  पतीचे पूर्ण नाव *
                </label>
                <input
                  required
                  value={newGuardianName}
                  onChange={(e) => setNewGuardianName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                मोबाईल क्रमांक *
              </label>
              <input
                required
                maxLength={10}
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                placeholder="१० अंकी क्रमांक"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {newBenType === 'PREGNANT_WOMAN'
                  ? 'आधार क्रमांक (ऐच्छिक — सुरक्षित राहील)'
                  : 'पालकांचा आधार क्रमांक (ऐच्छिक)'}
              </label>
              <input
                maxLength={12}
                value={newAadhaar}
                onChange={(e) => setNewAadhaar(e.target.value)}
                placeholder="१२ अंकी आधार (गरज असल्यासच)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">जात (Caste)</label>
              <input
                value={newCaste}
                onChange={(e) => setNewCaste(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">प्रवर्ग (Category)</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {CASTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <SearchableSelect
              label="उपकेंद्र"
              required
              disabled={Boolean(scopedSubcentre)}
              value={newSubcentreId}
              onChange={(val) => {
                setNewSubcentreId(val);
                setNewVillageId('');
              }}
              options={db.subcentres
                .filter((s) => s.isActive)
                .map((s) => ({ value: s.id, label: s.name, sublabel: s.code }))}
            />

            <SearchableSelect
              label="गाव"
              required
              disabled={!newSubcentreId}
              value={newVillageId}
              onChange={setNewVillageId}
              options={newFormVillages.map((v) => ({
                value: v.id,
                label: v.name,
                sublabel: v.villageCode,
              }))}
            />

            {newBenType === 'CHILD' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  अंगणवाडी (ऐच्छिक)
                </label>
                <input
                  value={newAnganwadi}
                  onChange={(e) => setNewAnganwadi(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">संपूर्ण पत्ता *</label>
              <input
                required
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="गल्ली / वॉर्ड / मु.पो."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Pregnancy Episode Section for Pregnant Woman */}
          {newBenType === 'PREGNANT_WOMAN' && (
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-teal-800 uppercase">
                गर्भधारणा प्रकरण तपशील (Pregnancy Episode Details)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">MC दिनांक *</label>
                  <input
                    type="date"
                    required
                    value={newMcDate}
                    onChange={(e) => {
                      setNewMcDate(e.target.value);
                      setNewEddDate(calculateEddFromMcDate(e.target.value));
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">EDD दिनांक *</label>
                  <input
                    type="date"
                    required
                    value={newEddDate}
                    onChange={(e) => setNewEddDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    अपेक्षित प्रसूती ठिकाण *
                  </label>
                  <input
                    required
                    value={newDeliveryPlace}
                    onChange={(e) => setNewDeliveryPlace(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    रुग्णालय प्रकार *
                  </label>
                  <select
                    value={newFacilityType}
                    onChange={(e) => setNewFacilityType(e.target.value as DeliveryFacilityType)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="Government">शासकीय (Government)</option>
                    <option value="Private">खाजगी (Private)</option>
                    <option value="Other">इतर (Other)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    रुग्णालयाचे नाव
                  </label>
                  <input
                    value={newHospitalName}
                    onChange={(e) => setNewHospitalName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    गर्भधारणा क्रमांक (Gravida/Para)
                  </label>
                  <input
                    value={newGravida}
                    onChange={(e) => setNewGravida(e.target.value)}
                    placeholder="उदा. G1 P0"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] text-slate-600">
                नोंदणी सेव केल्यावर लगेच आजच्या सत्रामध्ये द्यावयाच्या डोसचा स्क्रीन उघडेल.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActionMode('NONE')}
                  className="app-btn-secondary"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  disabled={busy || exactDuplicateExists}
                  className="app-btn-primary"
                >
                  नोंदणी सेव करा व आजचे डोस स्क्रीन उघडा →
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* POP-UP MODAL B: U-WIN Style Existing Beneficiary Search & Selection */}
      {selectedSession && canModifySession && actionMode === 'SELECT_EXISTING' && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true" aria-label="नोंदणीकृत लाभार्थी शोध">
          <div className="w-full max-w-5xl bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col max-h-[92vh] overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-[11px] text-slate-300 font-medium truncate">
                  सत्र: <span className="font-mono-tabular">{selectedSession.sessionCode}</span> ·{' '}
                  {selectedSession.villageName} · दि.{' '}
                  <span className="font-mono-tabular">{formatDDMMYYYY(selectedSession.sessionDate)}</span>
                </div>
                <h3 className="text-base font-bold leading-snug">
                  नोंदणीकृत लाभार्थी शोधा व आजच्या सत्रात निवडा
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionMode('NONE')}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 shrink-0"
                aria-label="बंद करा"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* Step 1: Select Beneficiary Category First */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 mr-1">लाभार्थी प्रकार निवडा *:</span>
            <button
              type="button"
              onClick={() => {
                setSearchBenType('CHILD');
                setInspectedBenId('');
                setSelectedEpisodeForExisting('');
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                searchBenType === 'CHILD'
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Baby className="w-4 h-4" /> बालक (Child)
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchBenType('PREGNANT_WOMAN');
                setInspectedBenId('');
                setSelectedEpisodeForExisting('');
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                searchBenType === 'PREGNANT_WOMAN'
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <HeartPulse className="w-4 h-4" /> गरोदर माता (Pregnant Woman)
            </button>
          </div>

          {/* Search & Dependent Subcenter -> Village Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <FuzzyAutocomplete
                label={
                  searchBenType === 'PREGNANT_WOMAN'
                    ? 'शोध (मातेचे नाव / आयडी / पती / मोबाईल / गाव / MC-EDD दिनांक)'
                    : 'शोध (बालकाचे नाव / आयडी / पालक-आई / मोबाईल / जन्मतारीख)'
                }
                value={searchQuery}
                onChange={setSearchQuery}
                items={baseExistingBeneficiaries}
                getSearchFields={getExistingSearchFields}
                getOptionKey={(b) => b.id}
                getOptionLabel={(b) => b.childName}
                getOptionSublabel={(b) =>
                  searchBenType === 'PREGNANT_WOMAN'
                    ? `पती: ${b.guardianName || b.fatherName || '-'} · ${b.villageName} · ${b.mobile}`
                    : `आई: ${b.motherName || '-'} · ${b.villageName} · ${b.mobile}`
                }
                getOptionMeta={(b) => b.beneficiaryCode}
                onSelectItem={(b) => {
                  const eps = episodesByBeneficiary.get(b.id) || [];
                  const latestEp = eps.find((ep) => ep.pregnancyStatus === 'सक्रिय') || eps[0];
                  setSearchQuery(b.beneficiaryCode);
                  setInspectedBenId(b.id);
                  setSelectedEpisodeForExisting(latestEp?.id || '');
                }}
                placeholder={
                  searchBenType === 'PREGNANT_WOMAN'
                    ? 'उदा. सुनंदा, PHCB-PW-2026-0001, 15-03-2026...'
                    : 'उदा. आरोही, PHCB-BEN-2026-0001, 12-05-2026...'
                }
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">उपकेंद्र फिल्टर</label>
              <select
                value={searchSubcentreId}
                onChange={(e) => {
                  setSearchSubcentreId(e.target.value);
                  setSearchVillageId('');
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">सर्व उपकेंद्रे</option>
                {db.subcentres
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">गाव फिल्टर</label>
              <select
                value={searchVillageId}
                onChange={(e) => setSearchVillageId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">सर्व गावे</option>
                {searchFilterVillages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Results Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
            {existingSearchResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                शोध निकषांशी जुळणारा कोणताही नोंदणीकृत लाभार्थी आढळला नाही.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-semibold">नाव व आयडी</th>
                    <th className="px-3 py-2 font-semibold">
                      {searchBenType === 'PREGNANT_WOMAN' ? 'पती / आधार' : 'पालक / आई / आधार'}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {searchBenType === 'PREGNANT_WOMAN' ? 'MC / EDD दिनांक' : 'जन्मतारीख / वय'}
                    </th>
                    <th className="px-3 py-2 font-semibold">गाव / मोबाईल</th>
                    <th className="px-3 py-2 font-semibold text-right">तपशील व निवडा</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {existingSearchResults.map((b) => {
                    const alreadyAdded = sessionRosterIds.has(b.id);
                    const isSelected = inspectedBenId === b.id;
                    const eps = episodesByBeneficiary.get(b.id) || [];
                    const latestEp =
                      eps.find((ep) => ep.pregnancyStatus === 'सक्रिय') || eps[0];
                    const lastVisit =
                      searchBenType === 'PREGNANT_WOMAN'
                        ? groupMaternalVisitsByDate(maternalServicesByBen.get(b.id) || [])[0] || null
                        : null;
                    return (
                      <tr
                        key={b.id}
                        className={isSelected ? 'bg-teal-50/80' : 'hover:bg-slate-50'}
                      >
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{b.childName}</div>
                          <div className="font-mono-tabular text-teal-800">{b.beneficiaryCode}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          <div>
                            {searchBenType === 'PREGNANT_WOMAN'
                              ? `पती: ${b.guardianName || b.fatherName || '-'}`
                              : `${b.guardianName || b.fatherName || '-'} (आई: ${b.motherName})`}
                          </div>
                          <div className="font-mono-tabular text-[11px] text-slate-500">
                            आधार: {maskAadhaar(b.aadhaarNumber)}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono-tabular">
                          {searchBenType === 'PREGNANT_WOMAN' ? (
                            latestEp ? (
                              <div>
                                <div>MC: {formatDDMMYYYY(latestEp.mcDate)}</div>
                                <div className="text-teal-800 font-semibold">
                                  EDD: {formatDDMMYYYY(latestEp.eddDate)}
                                </div>
                                {lastVisit && (
                                  <div className="text-[11px] font-sans text-slate-600">
                                    मागील ANC ({formatDDMMYYYY(lastVisit.visitDate)}): BP {lastVisit.bp} · वजन{' '}
                                    {lastVisit.weight} · Hb {lastVisit.hb}
                                  </div>
                                )}
                              </div>
                            ) : (
                              '-'
                            )
                          ) : (
                            <>
                              <div>{formatDDMMYYYY(b.dob)}</div>
                              <div className="text-teal-800 font-semibold font-sans">
                                {calculateAgeAsOf(b.dob, selectedSession.sessionDate).labelMarathi}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          <div>{b.villageName}</div>
                          <div className="font-mono-tabular text-slate-500">{b.mobile}</div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedBenId(b.id);
                              setSelectedEpisodeForExisting(latestEp?.id || '');
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-medium whitespace-nowrap"
                          >
                            तपशील व इतिहास
                          </button>
                          {alreadyAdded ? (
                            <div className="inline-flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold whitespace-nowrap">
                                <CheckCircle2 className="w-3.5 h-3.5" /> सत्रात समाविष्ट
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMode('NONE');
                                  setDoseModalTarget({
                                    beneficiary: b,
                                    episode: latestEp || null,
                                    isNewlyRegistered: false,
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold whitespace-nowrap"
                              >
                                डोस द्या →
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAddExistingBen({
                                  ben: b,
                                  episodeId: latestEp?.id,
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold whitespace-nowrap"
                            >
                              + सत्रात जोडा व डोस द्या
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Permanent Profile Carry Forward + History Inspection Panel */}
          {inspectedBeneficiarySummary && (
            <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 space-y-3">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-teal-200/70 pb-3">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900">
                    {inspectedBeneficiarySummary.ben.childName} ·{' '}
                    <span className="font-mono-tabular text-teal-800">
                      {inspectedBeneficiarySummary.ben.beneficiaryCode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      पालक/पती:{' '}
                      <strong>
                        {inspectedBeneficiarySummary.ben.guardianName ||
                          inspectedBeneficiarySummary.ben.fatherName ||
                          '-'}
                      </strong>
                    </span>
                    <span>
                      मोबाईल:{' '}
                      <strong className="font-mono-tabular">
                        {inspectedBeneficiarySummary.ben.mobile}
                      </strong>
                    </span>
                    <span>
                      आधार:{' '}
                      <strong className="font-mono-tabular">
                        {maskAadhaar(inspectedBeneficiarySummary.ben.aadhaarNumber)}
                      </strong>
                    </span>
                    <span>
                      जात/प्रवर्ग:{' '}
                      <strong>
                        {inspectedBeneficiarySummary.ben.caste || '-'} (
                        {inspectedBeneficiarySummary.ben.category || '-'})
                      </strong>
                    </span>
                    <span>
                      पत्ता: <strong>{inspectedBeneficiarySummary.ben.address || '-'}</strong>,{' '}
                      {inspectedBeneficiarySummary.ben.villageName}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={pdfDownloading}
                    onClick={() => handleDownloadConsolidatedPdf(inspectedBeneficiarySummary.ben.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-teal-700 bg-white hover:bg-teal-50 text-xs font-semibold text-teal-800 whitespace-nowrap disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> संपूर्ण रेकॉर्ड PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => openQuickEditProfile(inspectedBeneficiarySummary.ben)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 whitespace-nowrap"
                  >
                    <Edit className="w-3.5 h-3.5" /> प्रोफाइल दुरुस्ती
                  </button>
                  {sessionRosterIds.has(inspectedBeneficiarySummary.ben.id) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4" /> आजच्या सत्रात आधीच समाविष्ट
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAddExistingBen({
                          ben: inspectedBeneficiarySummary.ben,
                          episodeId: inspectedBeneficiarySummary.isWoman
                            ? inspectedBeneficiarySummary.activeEp?.id
                            : undefined,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap"
                    >
                      <UserCheck className="w-4 h-4" /> आजच्या लसीकरण सत्रामध्ये समाविष्ट करा
                    </button>
                  )}
                </div>
              </div>

              {/* Previous Checkup Values & Growth Comparison (Weight, Height, Hb, BP, BSL) */}
              <VitalsComparisonCard
                records={maternalServicesByBen.get(inspectedBeneficiarySummary.ben.id) || []}
                sessions={db.vaccinationSessions}
                villages={db.villages}
                title="मागील तपासणी नोंदी व वाढ तुलना (वजन · उंची · Hb · BP · BSL)"
              />

              {inspectedBeneficiarySummary.isWoman ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-teal-800">
                        गर्भधारणा प्रकरणे ({inspectedBeneficiarySummary.episodes.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAddEpForBen(inspectedBeneficiarySummary.ben);
                          setAddEpMcDate('');
                          setAddEpEddDate('');
                          setAddEpPlace(inspectedBeneficiarySummary.ben.villageName);
                          setAddEpFacility('Government');
                          setAddEpHospital('');
                          setAddEpGravida('');
                        }}
                        className="inline-flex items-center gap-1 text-teal-700 font-semibold hover:underline"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> नवीन गर्भधारणा जोडा
                      </button>
                    </div>
                    {inspectedBeneficiarySummary.episodes.length === 0 ? (
                      <div className="text-slate-500">कोणतेही गर्भधारणा प्रकरण नाही.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {inspectedBeneficiarySummary.episodes.map((ep) => (
                          <label
                            key={ep.id}
                            className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${
                              inspectedBeneficiarySummary.activeEp?.id === ep.id
                                ? 'bg-teal-50 border-teal-400'
                                : 'border-slate-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name="selectedExistingEpisode"
                              checked={inspectedBeneficiarySummary.activeEp?.id === ep.id}
                              onChange={() => setSelectedEpisodeForExisting(ep.id)}
                              className="mt-0.5 accent-teal-700"
                            />
                            <div>
                              <div className="font-mono-tabular font-semibold text-slate-900">
                                {ep.episodeCode} · {ep.pregnancyStatus}
                              </div>
                              <div className="text-slate-600">
                                MC: {formatDDMMYYYY(ep.mcDate)} · EDD: {formatDDMMYYYY(ep.eddDate)} ·{' '}
                                {ep.expectedDeliveryPlace}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800">
                      मागील ANC भेटी व तपासणी इतिहास ({inspectedBeneficiarySummary.ancHistory.length} नोंदी)
                    </div>
                    {inspectedBeneficiarySummary.ancHistory.length === 0 ? (
                      <div className="text-slate-500">अद्याप कोणतीही ANC सेवा नोंदवलेली नाही.</div>
                    ) : (
                      <div className="overflow-x-auto max-h-48 overflow-y-auto border border-slate-100 rounded">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="px-2 py-1.5 font-semibold">दिनांक</th>
                              <th className="px-2 py-1.5 font-semibold">ANC तपासणी</th>
                              <th className="px-2 py-1.5 font-semibold">वजन</th>
                              <th className="px-2 py-1.5 font-semibold">उंची</th>
                              <th className="px-2 py-1.5 font-semibold">Hb</th>
                              <th className="px-2 py-1.5 font-semibold">BP</th>
                              <th className="px-2 py-1.5 font-semibold">BSL</th>
                              <th className="px-2 py-1.5 font-semibold">Td</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {groupMaternalVisitsByDate(inspectedBeneficiarySummary.ancHistory).map(
                              (v) => (
                                <tr key={v.visitKey}>
                                  <td className="px-2 py-1.5 font-mono-tabular whitespace-nowrap">
                                    {formatDDMMYYYY(v.visitDate)}
                                  </td>
                                  <td className="px-2 py-1.5">{v.ancExam}</td>
                                  <td className="px-2 py-1.5 font-mono-tabular">{v.weight}</td>
                                  <td className="px-2 py-1.5 font-mono-tabular">{v.height}</td>
                                  <td className="px-2 py-1.5 font-mono-tabular">{v.hb}</td>
                                  <td className="px-2 py-1.5 font-mono-tabular">{v.bp}</td>
                                  <td className="px-2 py-1.5 font-mono-tabular">{v.bsl}</td>
                                  <td className="px-2 py-1.5">{v.tdDoses}</td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="font-bold text-emerald-800">मागील लसीकरण इतिहास</div>
                    {inspectedBeneficiarySummary.evalSummary.administeredDoses.length === 0 ? (
                      <div className="text-slate-500">कोणतीही मागील लस नोंदवलेली नाही.</div>
                    ) : (
                      <ul className="space-y-1">
                        {inspectedBeneficiarySummary.evalSummary.administeredDoses.map((d) => (
                          <li key={d.schedule.id} className="text-slate-700">
                            ✓ <span className="font-semibold">{d.schedule.doseName}</span> — दि.{' '}
                            <span className="font-mono-tabular">
                              {formatDDMMYYYY(d.administeredRecord?.administeredDate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="font-bold text-amber-800">आजच्या सत्रात देय / प्रलंबित डोस</div>
                    {inspectedBeneficiarySummary.evalSummary.dueDoses.length === 0 ? (
                      <div className="text-slate-500">आज कोणताही देय डोस नाही.</div>
                    ) : (
                      <ul className="space-y-1">
                        {inspectedBeneficiarySummary.evalSummary.dueDoses.map((d) => (
                          <li key={d.schedule.id} className="text-slate-800">
                            • <span className="font-semibold">{d.schedule.doseName}</span>{' '}
                            {d.isOverdue ? (
                              <span className="text-rose-700 font-semibold">(मुदत उलटलेला)</span>
                            ) : (
                              <span className="text-amber-700">(देय)</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-700">आगामी / अद्याप देय नसलेले डोस</div>
                    {inspectedBeneficiarySummary.upcomingDoses.length === 0 ? (
                      <div className="text-slate-500">सर्व डोस पूर्ण किंवा देय आहेत.</div>
                    ) : (
                      <ul className="space-y-1 text-slate-600">
                        {inspectedBeneficiarySummary.upcomingDoses.slice(0, 6).map((d) => (
                          <li key={d.schedule.id}>
                            {d.schedule.doseName} (देय: {formatDDMMYYYY(d.dueDateISO)})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-slate-500">
                यादीत लाभार्थी न आढळल्यास नवीन नोंदणी स्क्रीन उघडा.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewFormError('');
                    setActionMode('NEW_BENEFICIARY');
                  }}
                  className="app-btn-soft"
                >
                  <UserPlus className="w-3.5 h-3.5" /> नवीन नोंदणी करा
                </button>
                <button
                  type="button"
                  onClick={() => setActionMode('NONE')}
                  className="app-btn-secondary"
                >
                  बंद करा
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3A: CHILD BENEFICIARIES & VACCINATION SERVICES TABLE */}
      {selectedSession && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Baby className="w-4 h-4 text-teal-700" />
                १. आजच्या सत्रातील बालक लाभार्थी व लसीकरण सेवा ({formatNumberIN(childSessionRows.length)})
              </h3>
              <p className="text-xs text-slate-500">
                केवळ आज प्रत्यक्षात दिलेल्या लसींवर टिकमार्क करा. कायमस्वरूपी प्रोफाइल आपोआप कॅरी-फॉरवर्ड होते.
              </p>
            </div>

            {canModifySession && (
              <button
                type="button"
                disabled={pendingTickEntries.length === 0 || busy}
                onClick={() => setConfirmSaveTicksOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-40"
              >
                <Save className="w-4 h-4" /> आजचे बालक लसीकरण जतन करा ({pendingTickEntries.length})
              </button>
            )}
          </div>

          {childSessionRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              या सत्रात अद्याप एकही बालक लाभार्थी समाविष्ट केलेला नाही.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-2.5 py-3 font-semibold text-center">अ.क्र.</th>
                    <th className="px-3 py-3 font-semibold min-w-[180px]">बालकाचे नाव व कायमस्वरूपी माहिती</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">आयडी / आधार</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">जन्मतारीख / वय</th>
                    <th className="px-3 py-3 font-semibold min-w-[160px]">मागील लसीकरण इतिहास</th>
                    <th className="px-3 py-3 font-semibold min-w-[140px]">देय लसीकरण</th>
                    <th className="px-3 py-3 font-semibold min-w-[250px]">
                      आज दिलेल्या लसी (कर्मचारी: {currentUser?.name})
                    </th>
                    <th className="px-3 py-3 font-semibold min-w-[130px]">शेरा</th>
                    <th className="px-2.5 py-3 font-semibold text-center">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {childSessionRows.map(
                    ({ sb, ben, evalSummary, todayDoses, previousDoses, enrollmentType }, idx) => (
                      <tr key={ben.id} className="align-top hover:bg-slate-50">
                        <td className="px-2.5 py-3 text-center font-mono-tabular text-slate-600">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900">{ben.childName}</div>
                          <div className="text-[11px] text-slate-600">
                            पालक: {ben.guardianName || ben.fatherName || '-'} · आई: {ben.motherName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {ben.caste || '-'} ({ben.category || '-'}) ·{' '}
                            <span
                              className={
                                enrollmentType === 'NEW'
                                  ? 'text-teal-700 font-semibold'
                                  : 'text-slate-600'
                              }
                            >
                              {enrollmentType === 'NEW' ? 'नवीन नोंदणी' : 'मागील नोंदणीकृत'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono-tabular whitespace-nowrap">
                          <div className="font-semibold text-teal-800">{ben.beneficiaryCode}</div>
                          <div className="text-[11px] text-slate-500">{maskAadhaar(ben.aadhaarNumber)}</div>
                        </td>
                        <td className="px-3 py-3 font-mono-tabular whitespace-nowrap">
                          <div>{formatDDMMYYYY(ben.dob)}</div>
                          <div className="font-sans font-semibold text-slate-800">
                            {evalSummary.ageOnTargetDateLabel}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {previousDoses.length === 0 ? (
                            <span className="text-slate-400">मागील डोस नाही</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {previousDoses.map((pd) => (
                                <li key={pd.id}>
                                  {pd.doseName} ({formatDDMMYYYY(pd.administeredDate)})
                                </li>
                              ))}
                            </ul>
                          )}
                          {(() => {
                            const vitals = buildVitalsComparisonSummary(
                              maternalServicesByBen.get(ben.id) || []
                            ).filter((v) => v.latestValue);
                            if (vitals.length === 0) return null;
                            return (
                              <div className="mt-1.5 pt-1 border-t border-slate-100 text-[11px] text-teal-800 font-mono-tabular">
                                {vitals
                                  .map((v) => `${v.shortLabel}: ${v.latestValue}${v.unit ? ` ${v.unit}` : ''}`)
                                  .join(' · ')}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3">
                          {evalSummary.dueDoses.length === 0 ? (
                            <span className="text-slate-400">देय डोस नाही</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {evalSummary.dueDoses.map((d) => (
                                <li
                                  key={d.schedule.id}
                                  className={
                                    d.isOverdue
                                      ? 'font-semibold text-rose-700'
                                      : 'font-semibold text-amber-800'
                                  }
                                >
                                  • {d.schedule.doseName}
                                  {d.isOverdue ? ' (मुदत उलटलेला)' : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-3 space-y-2">
                          {todayDoses.length > 0 && (
                            <div className="space-y-1">
                              {todayDoses.map((td) => (
                                <div
                                  key={td.id}
                                  className="flex items-center gap-1 text-emerald-800 font-semibold"
                                >
                                  <Check className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {td.doseName} (दि. {formatDDMMYYYY(td.administeredDate)}
                                    {td.batchNumber ? ` · बॅच: ${td.batchNumber}` : ''})
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {canModifySession && evalSummary.dueDoses.length > 0 && (
                            <div className="space-y-1.5 pt-0.5">
                              {evalSummary.dueDoses.map((d) => {
                                const key = `${ben.id}_${d.schedule.id}`;
                                const checked = Boolean(selectedTicks[key]);
                                return (
                                  <div
                                    key={d.schedule.id}
                                    className={`flex flex-wrap items-center gap-2 p-1.5 rounded border ${
                                      checked
                                        ? 'bg-teal-50 border-teal-300'
                                        : 'bg-slate-50 border-slate-200'
                                    }`}
                                  >
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-900">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleTick(ben.id, d.schedule.id)}
                                        className="w-4 h-4 accent-teal-700"
                                      />
                                      <span>{d.schedule.doseName}</span>
                                    </label>
                                    {checked && (
                                      <input
                                        value={batchByKey[key] || ''}
                                        onChange={(e) =>
                                          setBatchByKey((p) => ({ ...p, [key]: e.target.value }))
                                        }
                                        placeholder="बॅच क्र."
                                        className="w-24 text-[11px] bg-white border border-slate-300 rounded px-2 py-0.5 font-mono-tabular"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {todayDoses.some((t) => t.remarks) && (
                            <div className="text-[11px] text-slate-700 mb-1">
                              {Array.from(
                                new Set(todayDoses.map((t) => t.remarks).filter(Boolean))
                              ).join('; ')}
                            </div>
                          )}
                          {canModifySession && evalSummary.dueDoses.length > 0 && (
                            <input
                              value={remarksByBenId[ben.id] || ''}
                              onChange={(e) =>
                                setRemarksByBenId((p) => ({ ...p, [ben.id]: e.target.value }))
                              }
                              placeholder="शेरा (ऐच्छिक)"
                              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            />
                          )}
                        </td>
                        <td className="px-2.5 py-3 text-center whitespace-nowrap space-x-1">
                          {canModifySession && (
                            <button
                              type="button"
                              onClick={() =>
                                setDoseModalTarget({
                                  beneficiary: ben,
                                  episode: null,
                                  isNewlyRegistered: false,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-[11px] font-semibold mr-1"
                              title="आजचे डोस व वाढ तपासणी स्क्रीन उघडा"
                            >
                              <Syringe className="w-3 h-3" /> डोस / तपासणी
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={pdfDownloading}
                            onClick={() => handleDownloadConsolidatedPdf(ben.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold disabled:opacity-50"
                            title="संपूर्ण एकत्रित रेकॉर्ड PDF डाउनलोड करा"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </button>
                          {canModifySession && (
                            <button
                              type="button"
                              onClick={() => openQuickEditProfile(ben)}
                              className="p-1 text-slate-500 hover:text-teal-700"
                              title="प्रोफाइल दुरुस्ती"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canModifySession && todayDoses.length === 0 && (
                            <button
                              type="button"
                              onClick={() => setRemoveTarget({ sbId: sb.id, name: ben.childName })}
                              className="p-1 text-slate-400 hover:text-rose-700"
                              title="सत्रातून काढा"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3B: FOCUSED SINGLE-MOTHER MATERNAL ANC DATA ENTRY SECTION */}
      {selectedSession && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-teal-700" />
                २. आजच्या सत्रातील गरोदर माता ANC / लसीकरण डेटा एन्ट्री (
                {formatNumberIN(maternalSessionRows.length)})
              </h3>
              <p className="text-xs text-slate-500">
                एका वेळी फक्त निवडलेल्या एकाच मातेचे नाव, मागील ANC माहिती व डेटा एन्ट्री फील्ड दिसतील.
              </p>
            </div>

            {canModifySession && activeMaternalRow && (
              <button
                type="button"
                disabled={activeMaternalPendingEntries.length === 0 || busy}
                onClick={() => setConfirmSaveAncOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-40"
              >
                <Save className="w-4 h-4" /> {activeMaternalRow.ben.childName} यांच्या सेवा जतन करा (
                {activeMaternalPendingEntries.length})
              </button>
            )}
          </div>

          {maternalSessionRows.length === 0 || !activeMaternalRow ? (
            <div className="p-8 text-center text-sm text-slate-500">
              या सत्रात अद्याप एकही गरोदर माता समाविष्ट केलेली नाही.
            </div>
          ) : (
            <div>
              {/* Isolated Single-Mother Selector Strip */}
              <div className="px-4 md:px-5 py-3 bg-teal-50/50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 max-w-xl">
                  <label
                    htmlFor="active-maternal-select"
                    className="block text-[11px] font-bold text-teal-900 mb-1"
                  >
                    डेटा एन्ट्रीसाठी गरोदर माता निवडा (माता {formatNumberIN(activeMaternalIdx + 1)} /{' '}
                    {formatNumberIN(maternalSessionRows.length)}):
                  </label>
                  <select
                    id="active-maternal-select"
                    value={activeMaternalRow.ben.id}
                    onChange={(e) => setActiveMaternalBenId(e.target.value)}
                    className="w-full bg-white border border-teal-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {maternalSessionRows.map((row, idx) => (
                      <option key={row.ben.id} value={row.ben.id}>
                        {idx + 1}. {row.ben.childName} ({row.ben.beneficiaryCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={activeMaternalIdx <= 0}
                    onClick={() => {
                      if (activeMaternalIdx > 0) {
                        setActiveMaternalBenId(maternalSessionRows[activeMaternalIdx - 1].ben.id);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" /> मागील माता
                  </button>
                  <button
                    type="button"
                    disabled={activeMaternalIdx >= maternalSessionRows.length - 1}
                    onClick={() => {
                      if (activeMaternalIdx < maternalSessionRows.length - 1) {
                        setActiveMaternalBenId(maternalSessionRows[activeMaternalIdx + 1].ben.id);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap disabled:opacity-40"
                  >
                    पुढील माता <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Focused Workspace for ONLY the Active Pregnant Woman */}
              {(() => {
                const { sb, ben, episode, todayServices, previousServices, enrollmentType } =
                  activeMaternalRow;
                const alreadyRecordedCodes = new Set(todayServices.map((s) => s.serviceCode));
                const everyVisitCatalog = activeMaternalCatalog.filter((s) =>
                  isEveryVisitAncService(s)
                );
                const otherMaternalCatalog = activeMaternalCatalog.filter(
                  (s) => !isEveryVisitAncService(s)
                );
                const prevSorted = previousServices
                  .slice()
                  .sort((a, b) => b.visitDate.localeCompare(a.visitDate));
                const visitSummaryRows = groupMaternalVisitsByDate(prevSorted);
                const latestByCode = new Map<string, (typeof prevSorted)[number]>();
                for (const rec of prevSorted) {
                  if (!latestByCode.has(rec.serviceCode)) {
                    latestByCode.set(rec.serviceCode, rec);
                  }
                }
                const everyVisitDoneCount = everyVisitCatalog.filter((s) =>
                  alreadyRecordedCodes.has(s.serviceCode)
                ).length;
                const everyVisitRemaining = everyVisitCatalog.filter(
                  (s) => !alreadyRecordedCodes.has(s.serviceCode)
                );

                return (
                  <div key={ben.id} className="p-4 md:p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-mono-tabular text-slate-500 font-semibold">
                            #{activeMaternalIdx + 1}
                          </span>
                          <span className="text-base font-bold text-slate-900">{ben.childName}</span>
                          <span className="font-mono-tabular text-xs font-semibold text-teal-800">
                            {ben.beneficiaryCode}
                          </span>
                          <span className="text-xs text-slate-500">
                            · {enrollmentType === 'NEW' ? 'नवीन नोंदणी' : 'मागील नोंदणीकृत'}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span
                            className={`text-xs font-semibold font-mono-tabular ${
                              everyVisitDoneCount === everyVisitCatalog.length
                                ? 'text-emerald-700'
                                : 'text-amber-800'
                            }`}
                          >
                            आजच्या नियमित ANC तपासण्या: {formatNumberIN(everyVisitDoneCount)}/
                            {formatNumberIN(everyVisitCatalog.length)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            पती: <strong>{ben.guardianName || ben.fatherName || '-'}</strong>
                          </span>
                          <span>
                            मोबाईल: <strong className="font-mono-tabular">{ben.mobile}</strong>
                          </span>
                          <span>
                            आधार:{' '}
                            <strong className="font-mono-tabular">
                              {maskAadhaar(ben.aadhaarNumber)}
                            </strong>
                          </span>
                          <span>
                            जात/प्रवर्ग: {ben.caste || '-'} ({ben.category || '-'})
                          </span>
                          <span>
                            पत्ता: {ben.address || ben.villageName}
                          </span>
                        </div>
                        {episode && (
                          <div className="text-xs text-teal-900 flex flex-wrap gap-x-4 gap-y-1">
                            <span className="font-mono-tabular font-semibold">
                              गर्भधारणा प्रकरण: {episode.episodeCode} ({episode.pregnancyStatus})
                            </span>
                            <span>
                              MC: <strong className="font-mono-tabular">{formatDDMMYYYY(episode.mcDate)}</strong>{' '}
                              ({calculateGestationalAgeLabel(episode.mcDate, selectedSession.sessionDate)})
                            </span>
                            <span>
                              EDD: <strong className="font-mono-tabular">{formatDDMMYYYY(episode.eddDate)}</strong>
                            </span>
                            <span>
                              अपेक्षित प्रसूती: {episode.expectedDeliveryPlace || '-'} (
                              {formatDeliveryFacilityTypeMarathi(episode.deliveryFacilityType)}
                              {episode.hospitalName ? ` · ${episode.hospitalName}` : ''})
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={pdfDownloading}
                          onClick={() => handleDownloadConsolidatedPdf(ben.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-700 bg-white hover:bg-teal-50 text-xs font-semibold text-teal-800 whitespace-nowrap disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" /> संपूर्ण रेकॉर्ड PDF
                        </button>
                        {canModifySession && (
                          <button
                            type="button"
                            onClick={() => openQuickEditProfile(ben)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap"
                          >
                            <Edit className="w-3.5 h-3.5" /> प्रोफाइल दुरुस्ती
                          </button>
                        )}
                        {canModifySession && todayServices.length === 0 && (
                          <button
                            type="button"
                            onClick={() => setRemoveTarget({ sbId: sb.id, name: ben.childName })}
                            className="p-1.5 text-slate-400 hover:text-rose-700"
                            title="सत्रातून काढा"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Vitals Comparison Strip (Weight, Height, Hb, BP, BSL + Trend) */}
                    <VitalsComparisonCard
                      compact
                      records={maternalServicesByBen.get(ben.id) || []}
                      sessions={db.vaccinationSessions}
                      villages={db.villages}
                      title={`${ben.childName} — मागील तपासणी व वाढ तुलना (वजन · उंची · Hb · BP · BSL)`}
                    />

                    {/* Default Always-Visible Previous ANC History + Today's Saved Services (ONLY for this mother) */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 text-xs">
                      <div className="xl:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-800">
                            {ben.childName} यांची मागील ANC तपासणी व लसीकरण माहिती (By Default दृश्य)
                          </span>
                          <span className="text-[11px] font-mono-tabular text-slate-500">
                            मागील भेटी: {formatNumberIN(visitSummaryRows.length)}
                          </span>
                        </div>
                        {visitSummaryRows.length === 0 ? (
                          <div className="text-slate-500">
                            या गर्भधारणेतील यापूर्वीची ANC भेट नोंद नाही (पहिली ANC भेट).
                          </div>
                        ) : (
                          <div className="overflow-x-auto bg-white border border-slate-200 rounded">
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <tr>
                                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap">भेट दि.</th>
                                  <th className="px-2 py-1.5 font-semibold">ANC तपासणी</th>
                                  <th className="px-2 py-1.5 font-semibold">वजन</th>
                                  <th className="px-2 py-1.5 font-semibold">उंची</th>
                                  <th className="px-2 py-1.5 font-semibold">Hb</th>
                                  <th className="px-2 py-1.5 font-semibold">BP</th>
                                  <th className="px-2 py-1.5 font-semibold">BSL</th>
                                  <th className="px-2 py-1.5 font-semibold">Td लस</th>
                                  <th className="px-2 py-1.5 font-semibold">IFA / कॅल्शियम</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {visitSummaryRows.slice(0, 5).map((vr) => (
                                  <tr key={vr.visitKey}>
                                    <td className="px-2 py-1.5 font-mono-tabular whitespace-nowrap font-semibold">
                                      {formatDDMMYYYY(vr.visitDate)}
                                    </td>
                                    <td className="px-2 py-1.5">{vr.ancExam}</td>
                                    <td className="px-2 py-1.5 font-mono-tabular">{vr.weight}</td>
                                    <td className="px-2 py-1.5 font-mono-tabular">{vr.height}</td>
                                    <td className="px-2 py-1.5 font-mono-tabular">{vr.hb}</td>
                                    <td className="px-2 py-1.5 font-mono-tabular">{vr.bp}</td>
                                    <td className="px-2 py-1.5 font-mono-tabular">{vr.bsl}</td>
                                    <td className="px-2 py-1.5">{vr.tdDoses}</td>
                                    <td className="px-2 py-1.5">{vr.supplements}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 space-y-1.5">
                        <div className="font-bold text-emerald-900">
                          आज जतन केलेल्या ANC सेवा ({ben.childName})
                        </div>
                        {todayServices.length === 0 ? (
                          <div className="text-slate-600">आज अद्याप कोणतीही सेवा जतन केलेली नाही.</div>
                        ) : (
                          <ul className="space-y-1 text-emerald-900">
                            {todayServices.map((ts) => (
                              <li key={ts.id} className="font-medium">
                                ✓ {ts.serviceName}
                                {ts.serviceValue ? `: ${ts.serviceValue}` : ''}
                                {ts.batchNumber ? ` · बॅच: ${ts.batchNumber}` : ''} ({ts.staffName})
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {!episode && canModifySession && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-amber-900 font-medium">
                          या मातेचे सक्रिय गर्भधारणा प्रकरण (MC/EDD) अद्याप जोडलेले नाही.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAddEpForBen(ben);
                            setAddEpMcDate('');
                            setAddEpEddDate('');
                            setAddEpPlace(ben.villageName);
                            setAddEpFacility('Government');
                            setAddEpHospital('');
                            setAddEpGravida('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
                        >
                          + गर्भधारणा प्रकरण जोडा
                        </button>
                      </div>
                    )}

                    {/* Explicit ANC Services Selection — ONLY for this active mother */}
                    {canModifySession && episode && (
                      <div className="space-y-4">
                        {/* Group 1: Mandatory at Every ANC Visit */}
                        {everyVisitCatalog.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-bold text-teal-900">
                                  अ. प्रत्येक ANC भेटीत आवश्यक तपासण्या (Every Visit Mandatory Checkups)
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  ANC तपासणी, BP, वजन, Hb व रक्त/लघवी तपासणी प्रत्येक ANC भेटीत नवीन नोंदवाव्या लागतात.
                                </div>
                              </div>
                              {everyVisitRemaining.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAnc((prev) => {
                                      const next = { ...prev };
                                      for (const svc of everyVisitRemaining) {
                                        next[`${ben.id}_${svc.serviceCode}`] = true;
                                      }
                                      return next;
                                    });
                                  }}
                                  className="px-3 py-1.5 rounded-lg border border-teal-700 text-teal-800 bg-teal-50 hover:bg-teal-100 text-[11px] font-semibold whitespace-nowrap"
                                >
                                  + आजसाठी सर्व {formatNumberIN(everyVisitRemaining.length)} नियमित तपासण्या निवडा
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                              {everyVisitCatalog.map((svc) => {
                                const key = `${ben.id}_${svc.serviceCode}`;
                                const alreadyDone = alreadyRecordedCodes.has(svc.serviceCode);
                                const checked = Boolean(selectedAnc[key]);
                                const prevRec = latestByCode.get(svc.serviceCode);
                                const todayRec = todayServices.find(
                                  (t) => t.serviceCode === svc.serviceCode
                                );

                                return (
                                  <div
                                    key={svc.serviceCode}
                                    className={`p-2.5 rounded-lg border space-y-1.5 ${
                                      alreadyDone
                                        ? 'bg-emerald-50/60 border-emerald-200'
                                        : checked
                                          ? 'bg-teal-50 border-teal-400'
                                          : 'bg-slate-50 border-slate-200'
                                    }`}
                                  >
                                    <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-900">
                                      <input
                                        type="checkbox"
                                        disabled={alreadyDone}
                                        checked={alreadyDone || checked}
                                        onChange={() =>
                                          setSelectedAnc((prev) => ({
                                            ...prev,
                                            [key]: !prev[key],
                                          }))
                                        }
                                        className="w-4 h-4 mt-0.5 accent-teal-700"
                                      />
                                      <span className="flex-1">
                                        <span className="block">{svc.serviceName}</span>
                                        {prevRec && (
                                          <span className="block text-[11px] text-slate-600 font-normal mt-0.5">
                                            मागील: <strong className="font-mono-tabular">{prevRec.serviceValue}</strong>{' '}
                                            ({formatDDMMYYYY(prevRec.visitDate)})
                                          </span>
                                        )}
                                        {alreadyDone && todayRec && (
                                          <span className="block text-[11px] text-emerald-800 font-semibold mt-0.5">
                                            ✓ आज नोंदवले: {todayRec.serviceValue}
                                          </span>
                                        )}
                                      </span>
                                    </label>
                                    {checked && !alreadyDone && (
                                      <div className="flex flex-wrap gap-1.5 pl-6">
                                        <input
                                          value={ancValueByKey[key] || ''}
                                          onChange={(e) =>
                                            setAncValueByKey((p) => ({
                                              ...p,
                                              [key]: e.target.value,
                                            }))
                                          }
                                          placeholder={svc.unit ? `आजचे मापन (${svc.unit})` : 'आजची नोंद / तपशील'}
                                          className="flex-1 min-w-[100px] bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                                        />
                                        {svc.requiresBatchNumber && (
                                          <input
                                            value={ancBatchByKey[key] || ''}
                                            onChange={(e) =>
                                              setAncBatchByKey((p) => ({
                                                ...p,
                                                [key]: e.target.value,
                                              }))
                                            }
                                            placeholder="बॅच क्र."
                                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-[11px] font-mono-tabular"
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Group 2: Td Vaccination, IFA/Calcium & Additional Services */}
                        {otherMaternalCatalog.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-800">
                              ब. Td लसीकरण, IFA / कॅल्शियम व इतर सेवा
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                              {otherMaternalCatalog.map((svc) => {
                                const key = `${ben.id}_${svc.serviceCode}`;
                                const alreadyDone = alreadyRecordedCodes.has(svc.serviceCode);
                                const checked = Boolean(selectedAnc[key]);
                                const prevRec = latestByCode.get(svc.serviceCode);
                                const isEpisodeTd = svc.serviceCode.startsWith('TD_');

                                return (
                                  <div
                                    key={svc.serviceCode}
                                    className={`p-2.5 rounded-lg border space-y-1.5 ${
                                      alreadyDone
                                        ? 'bg-emerald-50/40 border-emerald-200 opacity-80'
                                        : checked
                                          ? 'bg-teal-50 border-teal-400'
                                          : 'bg-slate-50 border-slate-200'
                                    }`}
                                  >
                                    <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-900">
                                      <input
                                        type="checkbox"
                                        disabled={alreadyDone}
                                        checked={alreadyDone || checked}
                                        onChange={() =>
                                          setSelectedAnc((prev) => ({
                                            ...prev,
                                            [key]: !prev[key],
                                          }))
                                        }
                                        className="w-4 h-4 mt-0.5 accent-teal-700"
                                      />
                                      <span className="flex-1">
                                        <span className="block">{svc.serviceName}</span>
                                        {prevRec && (
                                          <span
                                            className={`block text-[11px] font-normal mt-0.5 ${
                                              isEpisodeTd ? 'text-teal-800 font-semibold' : 'text-slate-600'
                                            }`}
                                          >
                                            {isEpisodeTd
                                              ? `आधी दिलेले: दि. ${formatDDMMYYYY(prevRec.visitDate)}${
                                                  prevRec.batchNumber ? ` (${prevRec.batchNumber})` : ''
                                                }`
                                              : `मागील: ${prevRec.serviceValue} (${formatDDMMYYYY(prevRec.visitDate)})`}
                                          </span>
                                        )}
                                      </span>
                                    </label>
                                    {checked && !alreadyDone && (
                                      <div className="flex flex-wrap gap-1.5 pl-6">
                                        <input
                                          value={ancValueByKey[key] || ''}
                                          onChange={(e) =>
                                            setAncValueByKey((p) => ({
                                              ...p,
                                              [key]: e.target.value,
                                            }))
                                          }
                                          placeholder={svc.unit ? `मापन (${svc.unit})` : 'नोंद / तपशील'}
                                          className="flex-1 min-w-[100px] bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                                        />
                                        {svc.requiresBatchNumber && (
                                          <input
                                            value={ancBatchByKey[key] || ''}
                                            onChange={(e) =>
                                              setAncBatchByKey((p) => ({
                                                ...p,
                                                [key]: e.target.value,
                                              }))
                                            }
                                            placeholder="बॅच क्र."
                                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-[11px] font-mono-tabular"
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                          <div className="flex-1 max-w-md">
                            <input
                              value={ancRemarksByBenId[ben.id] || ''}
                              onChange={(e) =>
                                setAncRemarksByBenId((p) => ({ ...p, [ben.id]: e.target.value }))
                              }
                              placeholder={`${ben.childName} यांच्या सत्रासंबंधी शेरा (ऐच्छिक)`}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={activeMaternalPendingEntries.length === 0 || busy}
                            onClick={() => setConfirmSaveAncOpen(true)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-40"
                          >
                            <Save className="w-4 h-4" /> {ben.childName} यांच्या ANC सेवा जतन करा (
                            {activeMaternalPendingEntries.length})
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Modal: Quick Add New Pregnancy Episode for Returning Pregnant Woman */}
      {addEpForBen && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <form onSubmit={handleCreateEpisodeInSession} className="app-modal max-w-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  नवीन गर्भधारणा प्रकरण जोडा ({addEpForBen.childName})
                </h3>
                <p className="text-xs text-slate-500">
                  मूळ आयडी ({addEpForBen.beneficiaryCode}) व पूर्वीचा इतिहास सुरक्षित राहील
                </p>
              </div>
              <button type="button" onClick={() => setAddEpForBen(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">MC दिनांक *</label>
                <input
                  type="date"
                  required
                  value={addEpMcDate}
                  onChange={(e) => {
                    setAddEpMcDate(e.target.value);
                    setAddEpEddDate(calculateEddFromMcDate(e.target.value));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">EDD दिनांक *</label>
                <input
                  type="date"
                  required
                  value={addEpEddDate}
                  onChange={(e) => setAddEpEddDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">अपेक्षित प्रसूती ठिकाण *</label>
                <input required value={addEpPlace} onChange={(e) => setAddEpPlace(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">रुग्णालय प्रकार *</label>
                <select value={addEpFacility} onChange={(e) => setAddEpFacility(e.target.value as DeliveryFacilityType)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="Government">शासकीय (Government)</option>
                  <option value="Private">खाजगी (Private)</option>
                  <option value="Other">इतर (Other)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">रुग्णालयाचे नाव</label>
                <input value={addEpHospital} onChange={(e) => setAddEpHospital(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">गर्भधारणा क्रमांक</label>
                <input value={addEpGravida} onChange={(e) => setAddEpGravida(e.target.value)} placeholder="उदा. G2 P1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" disabled={busy} onClick={() => setAddEpForBen(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">रद्द करा</button>
              <button type="submit" disabled={busy} className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg">
                {busy ? 'जतन होत आहे...' : 'गर्भधारणा प्रकरण जतन करा'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Quick Edit Permanent Profile */}
      {editProfileBen && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveQuickEditProfile} className="app-modal max-w-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                कायमस्वरूपी प्रोफाइल दुरुस्ती ({editProfileBen.beneficiaryCode})
              </h3>
              <button type="button" onClick={() => setEditProfileBen(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">पूर्ण नाव *</label>
                <input required value={epName} onChange={(e) => setEpName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {editProfileBen.beneficiaryType === 'PREGNANT_WOMAN' ? 'पतीचे नाव *' : 'पालकांचे नाव *'}
                </label>
                <input required value={epGuardian} onChange={(e) => setEpGuardian(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              {editProfileBen.beneficiaryType !== 'PREGNANT_WOMAN' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">आईचे नाव *</label>
                  <input required value={epMother} onChange={(e) => setEpMother(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">मोबाईल *</label>
                <input required maxLength={10} value={epMobile} onChange={(e) => setEpMobile(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  आधार {aadhaarAuthorized ? '(Admin/MO अधिकार)' : '(संरक्षित)'}
                </label>
                {aadhaarAuthorized ? (
                  <input maxLength={12} value={epAadhaar} onChange={(e) => setEpAadhaar(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
                ) : (
                  <input disabled value={maskAadhaar(editProfileBen.aadhaarNumber)} className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm font-mono-tabular text-slate-600" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">जात</label>
                <input value={epCaste} onChange={(e) => setEpCaste(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">प्रवर्ग</label>
                <select value={epCategory} onChange={(e) => setEpCategory(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {CASTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">पत्ता</label>
                <input value={epAddress} onChange={(e) => setEpAddress(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" disabled={busy} onClick={() => setEditProfileBen(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">रद्द करा</button>
              <button type="submit" disabled={busy} className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg">
                {busy ? 'जतन होत आहे...' : 'प्रोफाइल जतन करा'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pre-Completion Summary Modal */}
      {completionModalOpen && selectedSession && childReportData && maternalReportData && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <div className="app-modal max-w-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  लसीकरण सत्र पूर्ण करण्यापूर्वीचा सारांश ({selectedSession.sessionCode})
                </h3>
                <p className="text-xs text-slate-500">
                  सत्र पूर्ण केल्यानंतर दोन्ही स्वतंत्र PDF अहवाल (बालक व गरोदर माता) डाउनलोड करता येतील.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCompletionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(pendingTickEntries.length > 0 || pendingMaternalEntries.length > 0) && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 font-medium">
                सावधान: आपण {pendingTickEntries.length} बालक डोस व {pendingMaternalEntries.length} माता ANC सेवा निवडल्या आहेत परंतु अद्याप जतन केलेल्या नाहीत.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">एकूण बालक लाभार्थी</div>
                <div className="text-lg font-bold font-mono-tabular text-slate-900">
                  {formatNumberIN(childReportData.summary.totalBeneficiaries)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">आज दिलेले बालक डोस</div>
                <div className="text-lg font-bold font-mono-tabular text-teal-800">
                  {formatNumberIN(childReportData.summary.totalDosesToday)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">एकूण गरोदर माता</div>
                <div className="text-lg font-bold font-mono-tabular text-slate-900">
                  {formatNumberIN(maternalReportData.summary.totalWomen)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">आज दिलेल्या ANC सेवा</div>
                <div className="text-lg font-bold font-mono-tabular text-emerald-700">
                  {formatNumberIN(maternalReportData.summary.totalServicesToday)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCompletionModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
              >
                मागे जा
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleCompleteSession}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap disabled:opacity-60"
              >
                {busy ? 'पूर्ण होत आहे...' : 'होय, लसीकरण सत्र पूर्ण करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP MODAL C: U-WIN Style Today's Session Dose / Service Screen */}
      {doseModalTarget && selectedSession && canModifySession && (() => {
        const liveBen =
          db.beneficiaries.find((b) => b.id === doseModalTarget.beneficiary.id) ||
          doseModalTarget.beneficiary;
        const isWoman = (liveBen.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN';
        const allBenVitals = maternalServicesByBen.get(liveBen.id) || [];

        if (!isWoman) {
          const benRecords = recordsByBeneficiary.get(liveBen.id) || [];
          const evalSummary = evaluateBeneficiaryEligibility(
            liveBen,
            selectedSession.sessionDate,
            validatedSchedules,
            benRecords
          );
          const todayDoses = benRecords.filter((r) => r.sessionId === selectedSession.id);
          const upcomingDoses = evalSummary.allDoseResults.filter(
            (d) => d.status === 'NOT_YET_ELIGIBLE' || d.status === 'INTERVAL_PENDING'
          );
          const selectedCount = evalSummary.dueDoses.filter((d) =>
            Boolean(doseModalTicks[d.schedule.id])
          ).length;
          const filledVitalsCount = VITAL_METRIC_DEFS.filter(
            (def) => (doseModalChildVitals[def.code] || '').trim().length > 0
          ).length;
          const vitalsLatestMap = new Map(
            buildVitalsComparisonSummary(allBenVitals).map((v) => [v.code, v])
          );

          return (
            <div className="app-modal-backdrop" role="dialog" aria-modal="true" aria-label="आजच्या सत्रामध्ये द्यावयाचे डोस">
              <div className="w-full max-w-3xl bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col max-h-[92vh] overflow-hidden">
                {/* U-WIN Header */}
                <div className="px-5 py-3.5 bg-teal-800 text-white flex items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <div className="text-[11px] text-teal-100 font-medium flex items-center gap-1.5">
                      {doseModalTarget.isNewlyRegistered && (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                          <span>नोंदणी पूर्ण!</span>
                          <span>·</span>
                        </>
                      )}
                      <span className="truncate">
                        सत्र: {selectedSession.sessionCode} · दि. {formatDDMMYYYY(selectedSession.sessionDate)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold leading-snug">
                      आजच्या सत्रामध्ये द्यावयाचे लसीकरण डोस व वाढ तपासणी (U-WIN)
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDoseModalTarget(null)}
                    className="p-2 rounded-lg text-teal-100 hover:text-white hover:bg-teal-700/70 shrink-0"
                    aria-label="बंद करा"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* U-WIN Citizen Summary Card */}
                <div className="px-5 py-3.5 bg-teal-50/70 border-b border-slate-200 shrink-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-slate-900">{liveBen.childName}</span>
                      <span className="font-mono-tabular text-xs font-semibold text-teal-800">
                        {liveBen.beneficiaryCode}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-teal-900">
                      वय: {evalSummary.ageOnTargetDateLabel}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      पालक: <strong>{liveBen.guardianName || liveBen.fatherName || '-'}</strong>
                    </span>
                    <span>
                      आई: <strong>{liveBen.motherName || '-'}</strong>
                    </span>
                    <span>
                      जन्मतारीख: <strong className="font-mono-tabular">{formatDDMMYYYY(liveBen.dob)}</strong>
                    </span>
                    <span>
                      गाव: <strong>{liveBen.villageName}</strong>
                    </span>
                    <span>
                      मोबाईल: <strong className="font-mono-tabular">{liveBen.mobile}</strong>
                    </span>
                  </div>
                </div>

                {/* Scrollable Due Doses & Growth Vitals Selection Body */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                  <VitalsComparisonCard
                    compact
                    records={allBenVitals}
                    sessions={db.vaccinationSessions}
                    villages={db.villages}
                    title="मागील तपासणी व वाढ (वजन · उंची · Hb · BP · BSL)"
                  />

                  {todayDoses.length > 0 && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <div className="font-bold">आजच्या सत्रात आधीच नोंदवलेले डोस:</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {todayDoses.map((td) => (
                          <span key={td.id} className="inline-flex items-center gap-1 font-medium">
                            <Check className="w-3.5 h-3.5" /> {td.doseName}
                            {td.batchNumber ? ` (बॅच: ${td.batchNumber})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        आजच्या सत्रासाठी पात्र / देय डोस ({formatNumberIN(evalSummary.dueDoses.length)})
                      </h4>
                      <p className="text-xs text-slate-500">
                        आज प्रत्यक्ष दिलेले डोस निवडा व आवश्यक असल्यास बॅच क्रमांक प्रविष्ट करा.
                      </p>
                    </div>
                    {evalSummary.dueDoses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = evalSummary.dueDoses.every((d) =>
                            Boolean(doseModalTicks[d.schedule.id])
                          );
                          setDoseModalTicks(() => {
                            if (allSelected) return {};
                            const next: Record<string, boolean> = {};
                            for (const d of evalSummary.dueDoses) {
                              next[d.schedule.id] = true;
                            }
                            return next;
                          });
                        }}
                        className="app-btn-soft text-xs"
                      >
                        {evalSummary.dueDoses.every((d) => Boolean(doseModalTicks[d.schedule.id]))
                          ? 'निवड रद्द करा'
                          : `सर्व ${formatNumberIN(evalSummary.dueDoses.length)} देय डोस निवडा`}
                      </button>
                    )}
                  </div>

                  {evalSummary.dueDoses.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                      <div className="font-semibold text-slate-900">
                        या बालकासाठी आजच्या सत्राच्या दिनांकास ({formatDDMMYYYY(selectedSession.sessionDate)}) कोणताही देय डोस बाकी नाही.
                      </div>
                      {upcomingDoses.length > 0 && (
                        <div>
                          <div className="font-semibold text-slate-600 mb-1">पुढील आगामी डोस वेळापत्रक:</div>
                          <ul className="space-y-1 text-slate-600">
                            {upcomingDoses.slice(0, 5).map((d) => (
                              <li key={d.schedule.id}>
                                • <span className="font-medium text-slate-800">{d.schedule.doseName}</span> — देय दि.{' '}
                                <span className="font-mono-tabular">{formatDDMMYYYY(d.dueDateISO)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {evalSummary.dueDoses.map((d) => {
                        const checked = Boolean(doseModalTicks[d.schedule.id]);
                        const vm = db.vaccineMaster.find((v) => v.id === d.schedule.vaccineId);
                        return (
                          <div
                            key={d.schedule.id}
                            className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                              checked
                                ? 'bg-teal-50 border-teal-500'
                                : 'bg-white border-slate-200 hover:border-teal-300'
                            }`}
                          >
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setDoseModalTicks((prev) => ({
                                    ...prev,
                                    [d.schedule.id]: !prev[d.schedule.id],
                                  }))
                                }
                                className="w-5 h-5 mt-0.5 accent-teal-700 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="text-sm font-bold text-slate-900">
                                    {d.schedule.doseName}
                                  </span>
                                  <span
                                    className={`text-[11px] font-semibold ${
                                      d.isOverdue ? 'text-rose-700' : 'text-amber-800'
                                    }`}
                                  >
                                    {d.isOverdue ? 'मुदत उलटलेला' : 'आज देय'}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-600 mt-0.5">
                                  लस: {d.schedule.vaccineName}
                                  {d.schedule.recommendedDueRuleText
                                    ? ` · ${d.schedule.recommendedDueRuleText}`
                                    : ''}
                                </div>
                              </div>
                            </label>

                            {checked && (
                              <div className="pl-7">
                                <input
                                  value={doseModalBatch[d.schedule.id] || ''}
                                  onChange={(e) =>
                                    setDoseModalBatch((prev) => ({
                                      ...prev,
                                      [d.schedule.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    vm?.requiresBatchNumber
                                      ? 'बॅच क्रमांक प्रविष्ट करा'
                                      : 'बॅच क्रमांक (ऐच्छिक)'
                                  }
                                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono-tabular"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Child Checkup / Growth Measurement Inputs */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        आजची वाढ व आरोग्य तपासणी नोंद (ऐच्छिक — वजन, उंची, Hb, BP, BSL)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        मागील व्हॅल्यूशी तुलना करण्यासाठी आज तपासलेली मापे येथे प्रविष्ट करा.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                      {VITAL_METRIC_DEFS.map((def) => {
                        const prev = vitalsLatestMap.get(def.code);
                        return (
                          <div key={def.code} className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              {def.shortLabel} ({def.unit})
                            </label>
                            <input
                              value={doseModalChildVitals[def.code] || ''}
                              onChange={(e) =>
                                setDoseModalChildVitals((p) => ({
                                  ...p,
                                  [def.code]: e.target.value,
                                }))
                              }
                              placeholder={def.placeholder}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono-tabular"
                            />
                            {prev?.latestValue && (
                              <div className="text-[10px] text-slate-500 font-mono-tabular">
                                मागील: {prev.latestValue} ({formatDDMMYYYY(prev.latestDate)})
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      लसीकरण / तपासणी शेरा (ऐच्छिक)
                    </label>
                    <input
                      value={doseModalRemarks}
                      onChange={(e) => setDoseModalRemarks(e.target.value)}
                      placeholder="उदा. डाव्या मांडीवर दिली, AEFI नाही..."
                      className="app-input text-xs"
                    />
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDoseModalTarget(null)}
                      className="app-btn-secondary"
                    >
                      नंतर नोंदवा / बंद करा
                    </button>
                    <button
                      type="button"
                      disabled={pdfDownloading}
                      onClick={() => handleDownloadConsolidatedPdf(liveBen.id)}
                      className="app-btn-soft text-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> संपूर्ण रेकॉर्ड PDF
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={(selectedCount === 0 && filledVitalsCount === 0) || busy}
                    onClick={() =>
                      handleSaveDoseModalChild(
                        liveBen,
                        evalSummary.dueDoses.map((d) => d.schedule)
                      )
                    }
                    className="app-btn-primary px-5 py-2.5"
                  >
                    <Save className="w-4 h-4" />
                    {busy
                      ? 'जतन होत आहे...'
                      : `आजच्या नोंदी जतन करा (${formatNumberIN(selectedCount + filledVitalsCount)})`}
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // Pregnant Woman Today's Td / ANC Service Recording Screen
        const eps = episodesByBeneficiary.get(liveBen.id) || [];
        const resolvedEp =
          (doseModalTarget.episode
            ? eps.find((e) => e.id === doseModalTarget.episode?.id) || doseModalTarget.episode
            : null) ||
          eps.find((e) => e.pregnancyStatus === 'सक्रिय') ||
          eps[0] ||
          null;
        const recs = (maternalServicesByBen.get(liveBen.id) || []).filter(
          (r) => !resolvedEp || !r.pregnancyEpisodeId || r.pregnancyEpisodeId === resolvedEp.id
        );
        const todayServices = recs.filter((r) => r.sessionId === selectedSession.id);
        const alreadyRecordedCodes = new Set(todayServices.map((s) => s.serviceCode));
        const selectedMaternalCount = activeMaternalCatalog.filter((svc) =>
          Boolean(doseModalAncChecked[svc.serviceCode])
        ).length;
        const prevModalServiceMap = new Map<string, (typeof allBenVitals)[number]>();
        for (const r of allBenVitals
          .filter((r) => r.sessionId !== selectedSession.id)
          .sort((a, b) => b.visitDate.localeCompare(a.visitDate))) {
          if (!prevModalServiceMap.has(r.serviceCode)) {
            prevModalServiceMap.set(r.serviceCode, r);
          }
        }

        return (
          <div className="app-modal-backdrop" role="dialog" aria-modal="true" aria-label="आजच्या सत्रातील ANC व Td लसीकरण सेवा">
            <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col max-h-[92vh] overflow-hidden">
              <div className="px-5 py-3.5 bg-teal-800 text-white flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="text-[11px] text-teal-100 font-medium flex items-center gap-1.5">
                    {doseModalTarget.isNewlyRegistered && (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                        <span>माता नोंदणी पूर्ण!</span>
                        <span>·</span>
                      </>
                    )}
                    <span className="truncate">
                      सत्र: {selectedSession.sessionCode} · दि. {formatDDMMYYYY(selectedSession.sessionDate)}
                    </span>
                  </div>
                  <h3 className="text-base font-bold leading-snug">
                    आजच्या सत्रामध्ये द्यावयाच्या Td लस व ANC सेवा (U-WIN)
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDoseModalTarget(null)}
                  className="p-2 rounded-lg text-teal-100 hover:text-white hover:bg-teal-700/70 shrink-0"
                  aria-label="बंद करा"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-3.5 bg-teal-50/70 border-b border-slate-200 shrink-0 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-slate-900">{liveBen.childName}</span>
                    <span className="font-mono-tabular text-xs font-semibold text-teal-800">
                      {liveBen.beneficiaryCode}
                    </span>
                  </div>
                  {resolvedEp && (
                    <span className="text-xs font-semibold text-teal-900 font-mono-tabular">
                      {calculateGestationalAgeLabel(resolvedEp.mcDate, selectedSession.sessionDate)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    पती: <strong>{liveBen.guardianName || liveBen.fatherName || '-'}</strong>
                  </span>
                  <span>
                    गाव: <strong>{liveBen.villageName}</strong>
                  </span>
                  <span>
                    मोबाईल: <strong className="font-mono-tabular">{liveBen.mobile}</strong>
                  </span>
                  {resolvedEp && (
                    <>
                      <span>
                        MC: <strong className="font-mono-tabular">{formatDDMMYYYY(resolvedEp.mcDate)}</strong>
                      </span>
                      <span>
                        EDD: <strong className="font-mono-tabular">{formatDDMMYYYY(resolvedEp.eddDate)}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <VitalsComparisonCard
                  compact
                  records={allBenVitals}
                  sessions={db.vaccinationSessions}
                  villages={db.villages}
                  title="मागील तपासणी व वाढ तुलना (वजन · उंची · Hb · BP · BSL)"
                />

                {!resolvedEp ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                    या मातेचे सक्रिय गर्भधारणा प्रकरण (MC/EDD) अद्याप जोडलेले नाही. मुख्य पानावर '+ गर्भधारणा प्रकरण जोडा' वापरून जोडा.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                      {activeMaternalCatalog.map((svc) => {
                        const alreadyDone = alreadyRecordedCodes.has(svc.serviceCode);
                        const checked = Boolean(doseModalAncChecked[svc.serviceCode]);
                        const prevRec = prevModalServiceMap.get(svc.serviceCode);
                        return (
                          <div
                            key={svc.serviceCode}
                            className={`p-3 rounded-xl border space-y-2 ${
                              alreadyDone
                                ? 'bg-emerald-50/60 border-emerald-200'
                                : checked
                                  ? 'bg-teal-50 border-teal-500'
                                  : 'bg-white border-slate-200'
                            }`}
                          >
                            <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-900">
                              <input
                                type="checkbox"
                                disabled={alreadyDone}
                                checked={alreadyDone || checked}
                                onChange={() =>
                                  setDoseModalAncChecked((prev) => ({
                                    ...prev,
                                    [svc.serviceCode]: !prev[svc.serviceCode],
                                  }))
                                }
                                className="w-4 h-4 mt-0.5 accent-teal-700"
                              />
                              <span className="flex-1">
                                <span className="block">{svc.serviceName}</span>
                                {prevRec && (
                                  <span className="block text-[11px] text-slate-600 font-normal mt-0.5">
                                    मागील: <strong className="font-mono-tabular">{prevRec.serviceValue}</strong>{' '}
                                    ({formatDDMMYYYY(prevRec.visitDate)})
                                  </span>
                                )}
                                {alreadyDone && (
                                  <span className="block text-[11px] text-emerald-700 font-semibold mt-0.5">
                                    ✓ आज जतन झाले
                                  </span>
                                )}
                              </span>
                            </label>
                            {checked && !alreadyDone && (
                              <div className="space-y-1.5 pl-6">
                                <input
                                  value={doseModalAncValue[svc.serviceCode] || ''}
                                  onChange={(e) =>
                                    setDoseModalAncValue((p) => ({
                                      ...p,
                                      [svc.serviceCode]: e.target.value,
                                    }))
                                  }
                                  placeholder={svc.unit ? `मापन (${svc.unit})` : 'नोंद / तपशील'}
                                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                                />
                                {svc.requiresBatchNumber && (
                                  <input
                                    value={doseModalAncBatch[svc.serviceCode] || ''}
                                    onChange={(e) =>
                                      setDoseModalAncBatch((p) => ({
                                        ...p,
                                        [svc.serviceCode]: e.target.value,
                                      }))
                                    }
                                    placeholder="बॅच क्र."
                                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono-tabular"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        सत्र शेरा (ऐच्छिक)
                      </label>
                      <input
                        value={doseModalRemarks}
                        onChange={(e) => setDoseModalRemarks(e.target.value)}
                        placeholder={`${liveBen.childName} यांच्या सत्रासंबंधी शेरा`}
                        className="app-input text-xs"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDoseModalTarget(null)}
                    className="app-btn-secondary"
                  >
                    नंतर नोंदवा / बंद करा
                  </button>
                  <button
                    type="button"
                    disabled={pdfDownloading}
                    onClick={() => handleDownloadConsolidatedPdf(liveBen.id)}
                    className="app-btn-soft text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> संपूर्ण रेकॉर्ड PDF
                  </button>
                </div>
                {resolvedEp && (
                  <button
                    type="button"
                    disabled={selectedMaternalCount === 0 || busy}
                    onClick={() => handleSaveDoseModalMaternal(liveBen, resolvedEp)}
                    className="app-btn-primary px-5 py-2.5"
                  >
                    <Save className="w-4 h-4" />
                    {busy
                      ? 'जतन होत आहे...'
                      : `आजच्या ANC / Td सेवा जतन करा (${formatNumberIN(selectedMaternalCount)})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Modals */}
      <ConfirmModal
        open={confirmRegisterOpen}
        title="नवीन लाभार्थी नोंदवून सत्रात समाविष्ट करायचा का?"
        description={`नाव: ${newChildName} · प्रकार: ${
          newBenType === 'PREGNANT_WOMAN' ? 'गरोदर माता' : 'बालक'
        } · मोबाईल: ${newMobile}`}
        confirmLabel="होय, नोंदणी करा व जोडा"
        loading={busy}
        onConfirm={handleConfirmRegisterNew}
        onCancel={() => setConfirmRegisterOpen(false)}
      />

      <ConfirmModal
        open={Boolean(confirmAddExistingBen)}
        title="नोंदणीकृत लाभार्थी आजच्या सत्रात समाविष्ट करायचा का?"
        description={`${confirmAddExistingBen?.ben.childName} (${confirmAddExistingBen?.ben.beneficiaryCode}) यांना सत्र ${selectedSession?.sessionCode} मध्ये समाविष्ट केले जाईल. कायमस्वरूपी प्रोफाइल जसेच्या तसे राहील.`}
        confirmLabel="होय, आजच्या सत्रात जोडा"
        loading={busy}
        onConfirm={handleConfirmAddExisting}
        onCancel={() => setConfirmAddExistingBen(null)}
      />

      <ConfirmModal
        open={confirmSaveTicksOpen}
        title="आज दिलेले बालक लस डोस जतन करायचे का?"
        description={`सत्र ${selectedSession?.sessionCode} अंतर्गत ${pendingTickEntries.length} बालक लस डोस नोंदवले जातील:`}
        details={pendingTickEntries.map(
          (e) =>
            `${e.beneficiary.childName} (${e.beneficiary.beneficiaryCode}) → ${e.schedule.doseName}${
              e.batchNumber ? ` [बॅच: ${e.batchNumber}]` : ''
            }`
        )}
        confirmLabel="होय, लसीकरण जतन करा"
        loading={busy}
        onConfirm={handleConfirmSaveTicks}
        onCancel={() => setConfirmSaveTicksOpen(false)}
      />

      <ConfirmModal
        open={confirmSaveAncOpen}
        title={`${activeMaternalRow?.ben.childName || 'गरोदर माता'} यांच्या ANC सेवा जतन करायच्या का?`}
        description={`सत्र ${selectedSession?.sessionCode} अंतर्गत ${activeMaternalRow?.ben.childName || ''} (${activeMaternalRow?.ben.beneficiaryCode || ''}) यांच्या ${activeMaternalPendingEntries.length} ANC / लसीकरण सेवा नोंदवल्या जातील:`}
        details={activeMaternalPendingEntries.map(
          (e) =>
            `${e.beneficiary.childName} (${e.episode.episodeCode}) → ${e.service.serviceName}: ${e.serviceValue}`
        )}
        confirmLabel="होय, ANC सेवा जतन करा"
        loading={busy}
        onConfirm={handleConfirmSaveAnc}
        onCancel={() => setConfirmSaveAncOpen(false)}
      />

      <ConfirmModal
        open={Boolean(removeTarget)}
        title="लाभार्थी आजच्या सत्रातून काढायचा का?"
        description={`${removeTarget?.name} यांना या सत्रातून काढले जाईल (त्यांचे कायमस्वरूपी रेकॉर्ड सुरक्षित राहतील).`}
        confirmLabel="होय, काढा"
        variant="danger"
        loading={busy}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      <SessionReportPreviewModal
        open={reportPreviewOpen}
        report={childReportData}
        maternalReport={maternalReportData}
        initialCategory={reportPreviewCategory}
        onClose={() => setReportPreviewOpen(false)}
        onError={(msg) => setToast({ msg, type: 'error' })}
      />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
