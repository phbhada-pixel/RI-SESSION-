import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Baby,
  Calendar,
  CheckCircle2,
  ClipboardPlus,
  Download,
  Edit,
  HeartPulse,
  PlusCircle,
  Printer,
  ShieldAlert,
  Stethoscope,
  Syringe,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSheetData } from '../context/SheetDataContext';
import {
  BabyBirthOutcome,
  BabyRecord,
  DeliveryFacilityType,
  DeliveryTypeOption,
  MaternalReferralRecord,
  PregnancyEpisode,
  PregnancyStatus,
} from '../types';
import { formatDDMMYYYY, getTodayIST } from '../utils/dateUtils';
import { formatNumberIN } from '../utils/localeUtils';
import {
  BLOOD_GROUPS,
  buildAncComparisonRows,
  buildVitalsComparisonSummary,
  calculateEddFromMcDate,
  calculateGestationalWeeksAndDays,
  calculateWomanAgeFromDob,
  formatDeliveryFacilityTypeMarathi,
  formatGravidaSummary,
  HRP_REASON_OPTIONS,
  parseBpSystolicDiastolic,
  parseJsonArraySafe,
  PLANNED_DELIVERY_PLACES,
  RH_FACTORS,
  URINE_TEST_RESULTS,
  validateTdDoseForEpisode,
} from '../utils/maternalUtils';
import { downloadCompletePregnancyPDF } from '../utils/maternalPdfReport';
import { maskAadhaar } from '../utils/privacyUtils';
import { EmptyState } from '../components/EmptyState';
import { Toast } from '../components/Toast';

type TabKey = 'SUMMARY' | 'ANC' | 'HRP' | 'IMMUNIZATION' | 'DELIVERY' | 'PNC';

interface BabyDraft {
  babyName: string;
  gender: BabyRecord['gender'];
  birthWeightGrams: string;
  birthOutcome: BabyBirthOutcome;
  birthOutcomeOther: string;
  babyCondition: string;
  notes: string;
}

const createEmptyBabyDraft = (index: number, motherName: string): BabyDraft => ({
  babyName: `${motherName} यांचे बाळ ${index + 1}`,
  gender: 'मुलगा',
  birthWeightGrams: '',
  birthOutcome: 'Live Birth',
  birthOutcomeOther: '',
  babyCondition: 'सामान्य (Healthy & Crying)',
  notes: '',
});

export const MaternalProfilePage: React.FC = () => {
  const { beneficiaryId } = useParams<{ beneficiaryId: string }>();
  const navigate = useNavigate();
  const {
    db,
    currentUser,
    createPregnancyEpisode,
    updatePregnancyEpisode,
    recordAncVisit,
    saveHighRiskRecord,
    recordMaternalImmunizationAndSupplements,
    recordMaternalReferral,
    updateMaternalReferralStatus,
    recordDeliveryAndBabies,
    recordPncVisit,
  } = useSheetData();

  const today = getTodayIST();
  const [activeTab, setActiveTab] = useState<TabKey>('SUMMARY');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  // Modal: New Episode
  const [newEpModal, setNewEpModal] = useState(false);
  const [neMcDate, setNeMcDate] = useState('');
  const [neEddDate, setNeEddDate] = useState('');
  const [neDeliveryPlace, setNeDeliveryPlace] = useState('');
  const [neFacilityType, setNeFacilityType] = useState<DeliveryFacilityType>('Government');
  const [neHospitalName, setNeHospitalName] = useState('');
  const [neGravida, setNeGravida] = useState('1');
  const [nePara, setNePara] = useState('0');
  const [neAbortions, setNeAbortions] = useState('0');
  const [neLiving, setNeLiving] = useState('0');
  const [nePrevHistory, setNePrevHistory] = useState('');
  const [nePrevCs, setNePrevCs] = useState<'Yes' | 'No' | ''>('No');
  const [nePrevComp, setNePrevComp] = useState('');
  const [neBloodGroup, setNeBloodGroup] = useState('');
  const [neRhFactor, setNeRhFactor] = useState('');

  // Modal: Update Episode & EDD
  const [editEpModal, setEditEpModal] = useState(false);
  const [ueMcDate, setUeMcDate] = useState('');
  const [ueEddDate, setUeEddDate] = useState('');
  const [ueEddReason, setUeEddReason] = useState('');
  const [uePlace, setUePlace] = useState('');
  const [ueFacility, setUeFacility] = useState<DeliveryFacilityType>('Government');
  const [ueHospital, setUeHospital] = useState('');
  const [ueStatus, setUeStatus] = useState<PregnancyStatus>('सक्रिय');
  const [ueNotes, setUeNotes] = useState('');

  // Tab 2: New ANC Visit form
  const [ancVisitNo, setAncVisitNo] = useState<number>(1);
  const [ancVisitDate, setAncVisitDate] = useState(today);
  const [ancWeight, setAncWeight] = useState('');
  const [ancHeight, setAncHeight] = useState('');
  const [ancBp, setAncBp] = useState('');
  const [ancHb, setAncHb] = useState('');
  const [ancBsl, setAncBsl] = useState('');
  const [ancUrineAlb, setAncUrineAlb] = useState('Negative / Nil');
  const [ancUrineSug, setAncUrineSug] = useState('Negative / Nil');
  const [ancBloodTests, setAncBloodTests] = useState('');
  const [ancOtherTests, setAncOtherTests] = useState('');
  const [ancObservation, setAncObservation] = useState('');
  const [ancTreatment, setAncTreatment] = useState('');
  const [ancNextDate, setAncNextDate] = useState('');
  const [ancStaffName, setAncStaffName] = useState(currentUser?.name || '');
  const [ancStaffDesig, setAncStaffDesig] = useState<string>(currentUser?.role || 'ANM');

  // Tab 3: High Risk & Referral forms
  const [hrpFlag, setHrpFlag] = useState<'YES' | 'NO'>('NO');
  const [hrpDate, setHrpDate] = useState(today);
  const [hrpReasons, setHrpReasons] = useState<string[]>([]);
  const [hrpOtherReason, setHrpOtherReason] = useState('');
  const [hrpAdvice, setHrpAdvice] = useState('');
  const [hrpTreatment, setHrpTreatment] = useState('');
  const [hrpRefReq, setHrpRefReq] = useState<'Yes' | 'No' | ''>('No');
  const [hrpRefDate, setHrpRefDate] = useState(today);
  const [hrpRefHospital, setHrpRefHospital] = useState('');
  const [hrpRefReason, setHrpRefReason] = useState('');
  const [hrpFollowDate, setHrpFollowDate] = useState('');
  const [hrpFollowStatus, setHrpFollowStatus] = useState('प्रलंबित');
  const [hrpCurrentStatus, setHrpCurrentStatus] = useState('निरीक्षणाखाली');
  const [hrpApprovedMo, setHrpApprovedMo] = useState('');
  const [hrpNote, setHrpNote] = useState('');

  const [refDate, setRefDate] = useState(today);
  const [refFrom, setRefFrom] = useState('प्राथमिक आरोग्य केंद्र भादा');
  const [refToHospital, setRefToHospital] = useState('');
  const [refReason, setRefReason] = useState('');
  const [refTransport, setRefTransport] = useState('108 रुग्णवाहिका');
  const [refFollowDate, setRefFollowDate] = useState('');
  const [refStaff, setRefStaff] = useState(currentUser?.name || '');

  // Tab 4: Immunization & Supplements
  const [immDate, setImmDate] = useState(today);
  const [immStaff, setImmStaff] = useState(currentUser?.name || '');
  const [tdSelection, setTdSelection] = useState<'NONE' | 'TD_1' | 'TD_2' | 'TD_BOOSTER'>('NONE');
  const [tdBatch, setTdBatch] = useState('');
  const [ifaCount, setIfaCount] = useState('');
  const [calciumCount, setCalciumCount] = useState('');
  const [otherMedText, setOtherMedText] = useState('');

  // Tab 5: Delivery & Babies
  const [delivPlanPlace, setDelivPlanPlace] = useState('');
  const [delivPlanHospital, setDelivPlanHospital] = useState('');
  const [delivPlanNotes, setDelivPlanNotes] = useState('');
  const [delivPreReferral, setDelivPreReferral] = useState<'Yes' | 'No' | ''>('No');
  const [delivActualDate, setDelivActualDate] = useState(today);
  const [delivActualPlace, setDelivActualPlace] = useState<string>(PLANNED_DELIVERY_PLACES[0]);
  const [delivActualHospital, setDelivActualHospital] = useState('');
  const [delivType, setDelivType] = useState<DeliveryTypeOption>('Normal Delivery');
  const [delivTypeOther, setDelivTypeOther] = useState('');
  const [numBabies, setNumBabies] = useState(1);
  const [babyDrafts, setBabyDrafts] = useState<BabyDraft[]>([]);
  const [delivMotherCond, setDelivMotherCond] = useState('स्थिर (Stable)');
  const [delivComplications, setDelivComplications] = useState('');
  const [delivReferralDetails, setDelivReferralDetails] = useState('');
  const [delivStaff, setDelivStaff] = useState(currentUser?.name || '');
  const [markEpDelivered, setMarkEpDelivered] = useState(true);

  // Tab 6: PNC Visit
  const [pncVisitNo, setPncVisitNo] = useState(1);
  const [pncDate, setPncDate] = useState(today);
  const [pncMotherBp, setPncMotherBp] = useState('');
  const [pncMotherHealth, setPncMotherHealth] = useState('स्थिर व सामान्य');
  const [pncBleeding, setPncBleeding] = useState('सामान्य');
  const [pncBreastfeeding, setPncBreastfeeding] = useState('सुरू आहे (Exclusive)');
  const [pncBabyWeight, setPncBabyWeight] = useState('');
  const [pncBabyHealth, setPncBabyHealth] = useState('सामान्य व सक्रिय');
  const [pncCounselling, setPncCounselling] = useState<'Yes' | 'No' | ''>('Yes');
  const [pncTreatment, setPncTreatment] = useState('');
  const [pncNextDate, setPncNextDate] = useState('');
  const [pncStaff, setPncStaff] = useState(currentUser?.name || '');
  const [pncRemarks, setPncRemarks] = useState('');

  const woman = useMemo(
    () => (db && beneficiaryId ? db.beneficiaries.find((b) => b.id === beneficiaryId) || null : null),
    [db, beneficiaryId]
  );

  const episodes = useMemo(() => {
    if (!db || !woman) return [];
    return db.pregnancyEpisodes
      .filter((ep) => ep.beneficiaryId === woman.id)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db, woman]);

  const activeEpisode: PregnancyEpisode | null = useMemo(() => {
    if (episodes.length === 0) return null;
    if (selectedEpisodeId) {
      const found = episodes.find((e) => e.id === selectedEpisodeId);
      if (found) return found;
    }
    return episodes.find((e) => e.pregnancyStatus === 'सक्रिय') || episodes[0];
  }, [episodes, selectedEpisodeId]);

  useEffect(() => {
    if (activeEpisode && !selectedEpisodeId) {
      setSelectedEpisodeId(activeEpisode.id);
    }
  }, [activeEpisode, selectedEpisodeId]);

  const epAncVisits = useMemo(() => {
    if (!db || !activeEpisode) return [];
    return db.ancVisits
      .filter((v) => v.pregnancyEpisodeId === activeEpisode.id)
      .slice()
      .sort((a, b) => a.visitNumber - b.visitNumber || a.visitDate.localeCompare(b.visitDate));
  }, [db, activeEpisode]);

  const epServiceRecords = useMemo(() => {
    if (!db || !woman || !activeEpisode) return [];
    return db.maternalServiceRecords
      .filter(
        (r) =>
          r.beneficiaryId === woman.id &&
          (!r.pregnancyEpisodeId || r.pregnancyEpisodeId === activeEpisode.id)
      )
      .slice()
      .sort((a, b) => (a.visitDate || a.sessionDate).localeCompare(b.visitDate || b.sessionDate));
  }, [db, woman, activeEpisode]);

  const epHrps = useMemo(() => {
    if (!db || !activeEpisode) return [];
    return db.highRiskRecords
      .filter((h) => h.pregnancyEpisodeId === activeEpisode.id)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db, activeEpisode]);

  const epReferrals = useMemo(() => {
    if (!db || !activeEpisode) return [];
    return db.maternalReferrals
      .filter((r) => r.pregnancyEpisodeId === activeEpisode.id)
      .slice()
      .sort((a, b) => b.referralDate.localeCompare(a.referralDate));
  }, [db, activeEpisode]);

  const epDeliveries = useMemo(() => {
    if (!db || !activeEpisode) return [];
    return db.deliveryRecords
      .filter((d) => d.pregnancyEpisodeId === activeEpisode.id)
      .slice()
      .sort((a, b) => b.actualDeliveryDate.localeCompare(a.actualDeliveryDate));
  }, [db, activeEpisode]);

  const epBabies = useMemo(() => {
    if (!db || !activeEpisode) return [];
    return db.babyRecords
      .filter((b) => b.pregnancyEpisodeId === activeEpisode.id)
      .slice()
      .sort((a, b) => a.babyNumber - b.babyNumber);
  }, [db, activeEpisode]);

  const epPncs = useMemo(() => {
    if (!db || !activeEpisode) return [];
    return db.pncRecords
      .filter((p) => p.pregnancyEpisodeId === activeEpisode.id)
      .slice()
      .sort((a, b) => a.visitNumber - b.visitNumber || a.pncDate.localeCompare(b.pncDate));
  }, [db, activeEpisode]);

  // Suggest next ANC visit number & prefill latest HRP / Baby drafts
  useEffect(() => {
    const nextNum =
      epAncVisits.length === 0 ? 1 : Math.max(...epAncVisits.map((v) => v.visitNumber)) + 1;
    setAncVisitNo(nextNum);
  }, [epAncVisits]);

  useEffect(() => {
    const nextPnc = epPncs.length === 0 ? 1 : Math.max(...epPncs.map((p) => p.visitNumber)) + 1;
    setPncVisitNo(nextPnc);
  }, [epPncs]);

  useEffect(() => {
    if (woman) {
      setBabyDrafts((prev) => {
        const next: BabyDraft[] = [];
        for (let i = 0; i < numBabies; i++) {
          next.push(prev[i] || createEmptyBabyDraft(i, woman.childName));
        }
        return next;
      });
    }
  }, [numBabies, woman]);

  useEffect(() => {
    const latest = epHrps[0];
    if (latest) {
      setHrpFlag(latest.isHighRisk);
      setHrpDate(latest.identificationDate || today);
      setHrpReasons(parseJsonArraySafe<string>(latest.reasonsJson));
      setHrpOtherReason(latest.otherReasonText || '');
      setHrpAdvice(latest.doctorAdvice || '');
      setHrpTreatment(latest.treatmentInfo || '');
      setHrpRefReq(latest.referralRequired || 'No');
      setHrpRefDate(latest.referralDate || today);
      setHrpRefHospital(latest.referralHospital || '');
      setHrpRefReason(latest.referralReason || '');
      setHrpFollowDate(latest.followUpDate || '');
      setHrpFollowStatus(latest.followUpStatus || 'प्रलंबित');
      setHrpCurrentStatus(latest.currentStatus || 'निरीक्षणाखाली');
      setHrpApprovedMo(latest.approvedByMO || '');
    } else if (activeEpisode) {
      setHrpFlag(activeEpisode.isHighRisk ? 'YES' : 'NO');
      setHrpReasons(parseJsonArraySafe<string>(activeEpisode.highRiskReasonsJson));
    }
  }, [epHrps, activeEpisode, today]);

  useEffect(() => {
    if (activeEpisode) {
      setDelivPlanPlace(activeEpisode.expectedDeliveryPlace || woman?.plannedDeliveryPlace || '');
      setDelivPlanHospital(activeEpisode.hospitalName || woman?.plannedHospitalName || '');
    }
  }, [activeEpisode, woman]);

  const compRows = useMemo(() => {
    if (!activeEpisode) return [];
    return buildAncComparisonRows({
      ancVisits: epAncVisits,
      legacyServiceRecords: epServiceRecords,
      episodeId: activeEpisode.id,
      mcDate: activeEpisode.mcDate,
    });
  }, [epAncVisits, epServiceRecords, activeEpisode]);

  const chartData = useMemo(() => {
    return compRows
      .filter((c) => c.source !== 'NONE' && c.visitDate)
      .map((c) => {
        const w = parseFloat((c.weightKg || '').replace(/[^\d.]/g, ''));
        const hb = parseFloat((c.hb || '').replace(/[^\d.]/g, ''));
        const { systolic, diastolic } = parseBpSystolicDiastolic(c.bp);
        return {
          name: `${c.visitLabel} (${formatDDMMYYYY(c.visitDate)})`,
          वजन: Number.isFinite(w) ? w : null,
          Hb: Number.isFinite(hb) ? hb : null,
          SystolicBP: systolic,
          DiastolicBP: diastolic,
        };
      });
  }, [compRows]);

  const vitalsSummary = useMemo(
    () => buildVitalsComparisonSummary(epServiceRecords),
    [epServiceRecords]
  );

  if (!db) return null;

  if (!woman) {
    return (
      <div className="app-page">
        <div className="app-card app-card-body space-y-4">
          <EmptyState message="विनंती केलेली गरोदर माता आढळली नाही." />
          <Link to="/pregnant-women" className="app-btn-primary inline-flex">
            <ArrowLeft className="w-4 h-4" /> गरोदर माता यादीकडे परत जा
          </Link>
        </div>
      </div>
    );
  }

  const latestHrp = epHrps[0];
  const isHighRisk = latestHrp ? latestHrp.isHighRisk === 'YES' : Boolean(activeEpisode?.isHighRisk);
  const activeHrpReasons = parseJsonArraySafe<string>(
    latestHrp?.reasonsJson || activeEpisode?.highRiskReasonsJson
  );
  const hrpHistory = latestHrp
    ? parseJsonArraySafe<{
        status: string;
        reasons: string[];
        currentStatus: string;
        changedAt: string;
        changedBy: string;
        note?: string;
      }>(latestHrp.statusHistoryJson)
    : [];

  const eddHistory = activeEpisode
    ? parseJsonArraySafe<{
        previousEddDate: string;
        newEddDate: string;
        changedAt: string;
        changedBy: string;
        reason?: string;
      }>(activeEpisode.eddHistoryJson)
    : [];

  const activeGa = activeEpisode
    ? calculateGestationalWeeksAndDays(activeEpisode.mcDate, today)
    : null;

  const latestStructuredAnc = epAncVisits.length > 0 ? epAncVisits[epAncVisits.length - 1] : null;

  // Td status for current episode
  const td1Rec = epServiceRecords.find((r) => r.serviceCode === 'TD_1');
  const td2Rec = epServiceRecords.find((r) => r.serviceCode === 'TD_2');
  const tdBoosterRec = epServiceRecords.find((r) => r.serviceCode === 'TD_BOOSTER');
  const tdValidation =
    activeEpisode && tdSelection !== 'NONE'
      ? validateTdDoseForEpisode({
          existingRecords: epServiceRecords,
          episodeId: activeEpisode.id,
          serviceCode: tdSelection,
          visitDate: immDate,
        })
      : { ok: true };

  const activeStaffOptions = db.staff.filter((s) => s.isActive);

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      const preparedBy = currentUser ? `${currentUser.name} (${currentUser.role})` : 'PHC Bhada';
      await downloadCompletePregnancyPDF(db, woman.id, preparedBy);
      setToast({ msg: '४-पानांचा संपूर्ण गरोदर माता PDF अहवाल डाउनलोड झाला.', type: 'success' });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'PDF त्रुटी', type: 'error' });
    } finally {
      setPdfBusy(false);
    }
  };

  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!neMcDate || !neEddDate) return;
    setSaving(true);
    try {
      const ep = await createPregnancyEpisode(woman, {
        mcDate: neMcDate,
        eddDate: neEddDate,
        expectedDeliveryPlace: neDeliveryPlace.trim() || woman.villageName,
        deliveryFacilityType: neFacilityType,
        hospitalName: neHospitalName.trim(),
        pregnancyRegistrationDate: today,
        pregnancyStatus: 'सक्रिय',
        gravida: neGravida ? Number(neGravida) : null,
        para: nePara ? Number(nePara) : null,
        abortions: neAbortions ? Number(neAbortions) : null,
        livingChildren: neLiving ? Number(neLiving) : null,
        previousPregnancyHistory: nePrevHistory.trim(),
        previousCaesarean: nePrevCs,
        previousComplications: nePrevComp.trim(),
        bloodGroup: neBloodGroup || woman.bloodGroup || '',
        rhFactor: neRhFactor || woman.rhFactor || '',
      });
      setSelectedEpisodeId(ep.id);
      setNewEpModal(false);
      setToast({ msg: `नवीन गर्भधारणा प्रकरण (${ep.episodeCode}) तयार केले.`, type: 'success' });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openEditEpModal = () => {
    if (!activeEpisode) return;
    setUeMcDate(activeEpisode.mcDate);
    setUeEddDate(activeEpisode.eddDate);
    setUeEddReason('');
    setUePlace(activeEpisode.expectedDeliveryPlace || '');
    setUeFacility(activeEpisode.deliveryFacilityType);
    setUeHospital(activeEpisode.hospitalName || '');
    setUeStatus(activeEpisode.pregnancyStatus);
    setUeNotes(activeEpisode.notes || '');
    setEditEpModal(true);
  };

  const handleUpdateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEpisode) return;
    setSaving(true);
    try {
      await updatePregnancyEpisode(
        activeEpisode.id,
        {
          mcDate: ueMcDate,
          eddDate: ueEddDate,
          expectedDeliveryPlace: uePlace.trim(),
          deliveryFacilityType: ueFacility,
          hospitalName: ueHospital.trim(),
          pregnancyStatus: ueStatus,
          notes: ueNotes.trim(),
        },
        ueEddReason.trim()
      );
      setEditEpModal(false);
      setToast({ msg: 'गर्भधारणा प्रकरण व EDD माहिती अद्यतनित केली.', type: 'success' });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAncVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEpisode) return;
    setSaving(true);
    try {
      const label = ancVisitNo <= 4 ? `ANC-${ancVisitNo}` : `Extra ANC-${ancVisitNo}`;
      await recordAncVisit({
        beneficiary: woman,
        episode: activeEpisode,
        visitNumber: ancVisitNo,
        visitLabel: label,
        visitDate: ancVisitDate,
        weightKg: ancWeight.trim(),
        heightCm: ancHeight.trim(),
        bp: ancBp.trim(),
        hb: ancHb.trim(),
        bloodSugar: ancBsl.trim(),
        urineAlbumin: ancUrineAlb,
        urineSugar: ancUrineSug,
        bloodTests: ancBloodTests.trim(),
        otherTests: ancOtherTests.trim(),
        doctorObservation: ancObservation.trim(),
        treatmentAdvice: ancTreatment.trim(),
        nextVisitDate: ancNextDate,
        staffName: ancStaffName.trim() || currentUser?.name || 'ANM',
        staffDesignation: ancStaffDesig,
      });
      setToast({ msg: `${label} स्वतंत्र तपासणी नोंद यशस्वीरीत्या जतन झाली.`, type: 'success' });
      setAncWeight('');
      setAncBp('');
      setAncHb('');
      setAncBsl('');
      setAncBloodTests('');
      setAncOtherTests('');
      setAncObservation('');
      setAncTreatment('');
      setAncNextDate('');
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'ANC नोंद जतन करताना त्रुटी.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHrp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEpisode) return;
    setSaving(true);
    try {
      await saveHighRiskRecord({
        beneficiary: woman,
        episode: activeEpisode,
        isHighRisk: hrpFlag,
        identificationDate: hrpDate,
        reasons: hrpFlag === 'YES' ? hrpReasons : [],
        otherReasonText: hrpOtherReason.trim(),
        doctorAdvice: hrpAdvice.trim(),
        treatmentInfo: hrpTreatment.trim(),
        referralRequired: hrpRefReq,
        referralDate: hrpRefReq === 'Yes' ? hrpRefDate : '',
        referralHospital: hrpRefReq === 'Yes' ? hrpRefHospital.trim() : '',
        referralReason: hrpRefReq === 'Yes' ? hrpRefReason.trim() : '',
        followUpDate: hrpFollowDate,
        followUpStatus: hrpFollowStatus,
        currentStatus: hrpCurrentStatus,
        approvedByMO: hrpApprovedMo.trim(),
        note: hrpNote.trim(),
      });
      setToast({ msg: 'High Risk Pregnancy (HRP) नोंद जतन केली.', type: 'success' });
      setHrpNote('');
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'HRP जतन त्रुटी.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEpisode || !refToHospital.trim() || !refReason.trim()) return;
    setSaving(true);
    try {
      await recordMaternalReferral({
        beneficiary: woman,
        episode: activeEpisode,
        highRiskRecordId: latestHrp?.id,
        referralDate: refDate,
        referredFrom: refFrom.trim(),
        referredToHospital: refToHospital.trim(),
        referralReason: refReason.trim(),
        transportArrangement: refTransport.trim(),
        followUpDate: refFollowDate,
        followUpStatus: 'प्रलंबित',
        referredByStaff: refStaff.trim() || currentUser?.name || 'CHO',
      });
      setToast({ msg: 'संदर्भित (Referral) नोंद जतन केली.', type: 'success' });
      setRefToHospital('');
      setRefReason('');
      setRefFollowDate('');
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Referral त्रुटी.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveImmAndSupp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEpisode) return;
    const items: Array<{
      serviceCode: string;
      serviceName: string;
      serviceValue: string;
      batchNumber?: string;
    }> = [];
    if (tdSelection !== 'NONE') {
      if (!tdValidation.ok) {
        setToast({ msg: tdValidation.error || 'Td डोस नियम तपासणी अयशस्वी.', type: 'error' });
        return;
      }
      const labelMap = {
        TD_1: 'Td-1 लसीकरण',
        TD_2: 'Td-2 लसीकरण',
        TD_BOOSTER: 'Td-Booster लसीकरण',
      };
      items.push({
        serviceCode: tdSelection,
        serviceName: labelMap[tdSelection],
        serviceValue: 'दिले',
        batchNumber: tdBatch.trim(),
      });
    }
    if (ifaCount.trim()) {
      items.push({
        serviceCode: 'IFA',
        serviceName: 'IFA गोळ्या वितरण',
        serviceValue: ifaCount.trim(),
      });
    }
    if (calciumCount.trim()) {
      items.push({
        serviceCode: 'CALCIUM',
        serviceName: 'कॅल्शियम गोळ्या वितरण',
        serviceValue: calciumCount.trim(),
      });
    }
    if (otherMedText.trim()) {
      items.push({
        serviceCode: 'OTHER_MED',
        serviceName: 'इतर औषधोपचार (Other Medicines)',
        serviceValue: otherMedText.trim(),
      });
    }
    if (items.length === 0) {
      setToast({ msg: 'कृपया किमान एक लस किंवा औषध नोंद निवडा.', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await recordMaternalImmunizationAndSupplements({
        beneficiary: woman,
        episode: activeEpisode,
        visitDate: immDate,
        staffName: immStaff.trim() || currentUser?.name || 'ANM',
        items,
      });
      setToast({ msg: 'Td लस व औषध वितरण नोंद जतन झाली.', type: 'success' });
      setTdSelection('NONE');
      setTdBatch('');
      setIfaCount('');
      setCalciumCount('');
      setOtherMedText('');
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEpisode) return;
    setSaving(true);
    try {
      await recordDeliveryAndBabies({
        beneficiary: woman,
        episode: activeEpisode,
        plannedEddDate: activeEpisode.eddDate,
        plannedDeliveryPlace: delivPlanPlace.trim(),
        plannedHospitalName: delivPlanHospital.trim(),
        deliveryPlanNotes: delivPlanNotes.trim(),
        referralRequiredBeforeDelivery: delivPreReferral,
        actualDeliveryDate: delivActualDate,
        actualDeliveryPlace: delivActualPlace.trim(),
        actualHospitalName: delivActualHospital.trim(),
        deliveryType: delivType,
        deliveryTypeOther: delivTypeOther.trim(),
        motherCondition: delivMotherCond.trim(),
        deliveryComplications: delivComplications.trim(),
        referralDetails: delivReferralDetails.trim(),
        attendedByStaff: delivStaff.trim() || currentUser?.name || 'ANM',
        markEpisodeDelivered: markEpDelivered,
        babies: babyDrafts.map((bd) => ({
          babyName: bd.babyName.trim(),
          gender: bd.gender,
          birthWeightGrams: bd.birthWeightGrams ? Number(bd.birthWeightGrams) : null,
          birthOutcome: bd.birthOutcome,
          birthOutcomeOther: bd.birthOutcomeOther.trim(),
          babyCondition: bd.babyCondition.trim(),
          notes: bd.notes.trim(),
        })),
      });
      setToast({
        msg: 'प्रसूती व बाळ जन्म नोंद यशस्वीरीत्या जतन झाली.',
        type: 'success',
      });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'प्रसूती नोंद त्रुटी.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePnc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEpisode) return;
    setSaving(true);
    try {
      const label = pncVisitNo <= 2 ? `PNC-${pncVisitNo}` : `Extra PNC-${pncVisitNo}`;
      await recordPncVisit({
        beneficiary: woman,
        episode: activeEpisode,
        deliveryRecordId: epDeliveries[0]?.id,
        visitNumber: pncVisitNo,
        visitLabel: label,
        pncDate,
        motherBp: pncMotherBp.trim(),
        motherHealthStatus: pncMotherHealth.trim(),
        bleedingStatus: pncBleeding.trim(),
        breastfeedingStatus: pncBreastfeeding.trim(),
        babyWeightGrams: pncBabyWeight ? Number(pncBabyWeight) : null,
        babyHealthStatus: pncBabyHealth.trim(),
        breastfeedingCounselling: pncCounselling,
        treatmentGiven: pncTreatment.trim(),
        nextFollowUpDate: pncNextDate,
        staffName: pncStaff.trim() || currentUser?.name || 'ANM',
        remarks: pncRemarks.trim(),
      });
      setToast({ msg: `${label} प्रसूतीनंतर तपासणी जतन झाली.`, type: 'success' });
      setPncMotherBp('');
      setPncBabyWeight('');
      setPncTreatment('');
      setPncRemarks('');
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'PNC नोंद त्रुटी.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-page space-y-5">
      {/* Top Action Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/pregnant-women')}
            className="app-btn-secondary text-xs py-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> गरोदर माता यादी
          </button>
          <span className="text-xs font-mono-tabular font-semibold text-teal-800">
            {woman.beneficiaryCode}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/beneficiaries/register?edit=${woman.id}`}
            className="app-btn-secondary text-xs py-1.5"
          >
            <Edit className="w-3.5 h-3.5" /> प्रोफाइल दुरुस्ती
          </Link>
          <button
            type="button"
            onClick={() => setNewEpModal(true)}
            className="app-btn-soft text-xs py-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" /> नवीन गर्भधारणा प्रकरण
          </button>
          <button
            type="button"
            disabled={pdfBusy}
            onClick={handleDownloadPdf}
            className="app-btn-primary text-xs py-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {pdfBusy ? 'PDF तयार होत आहे...' : '४-पानांचा संपूर्ण PDF डाउनलोड'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="app-btn-secondary text-xs py-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> प्रिंट
          </button>
        </div>
      </div>

      {/* HIGH RISK PREGNANCY RED ALERT BANNER */}
      {isHighRisk && (
        <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-950 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm md:text-base text-rose-800">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              HIGH RISK PREGNANCY (अतिजोखमीची गर्भधारणा) ALERT
            </div>
            <span className="text-xs font-mono-tabular font-semibold text-rose-800">
              स्थिती: {latestHrp?.currentStatus || activeEpisode?.currentHrpStatus || 'निरीक्षणाखाली'}
            </span>
          </div>
          <p className="text-xs md:text-sm font-medium">
            कारणे: {activeHrpReasons.length > 0 ? activeHrpReasons.join(', ') : 'वैद्यकीय निगराणी आवश्यक'}
            {latestHrp?.otherReasonText ? ` (${latestHrp.otherReasonText})` : ''}
          </p>
          <p className="text-[11px] text-rose-800">
            वैद्यकीय सूचना: High Risk वर्गवारी, औषधोपचार व संदर्भित निर्णय प्राथमिक आरोग्य केंद्रातील वैद्यकीय अधिकाऱ्यांच्या (MO) अंतिम पडताळणीनंतरच ग्राह्य धरले जातात.
          </p>
        </div>
      )}

      {/* Permanent Carry-Forward Profile Header Card */}
      <div className="app-card app-card-body space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-700 shrink-0" />
              <h1 className="text-lg md:text-xl font-bold text-slate-900">{woman.childName}</h1>
              {woman.fullNameEnglish && (
                <span className="text-sm text-slate-500 font-medium">({woman.fullNameEnglish})</span>
              )}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>
                ID: <strong className="font-mono-tabular text-teal-800">{woman.beneficiaryCode}</strong>
              </span>
              <span>
                पती: <strong>{woman.guardianName || woman.fatherName || '-'}</strong>
                {woman.husbandMobile ? ` (${woman.husbandMobile})` : ''}
              </span>
              <span>
                मोबाईल: <strong className="font-mono-tabular">{woman.mobile}</strong>
              </span>
              <span>
                गाव / उपकेंद्र: <strong>{woman.villageName} · {woman.subcentreName}</strong>
              </span>
            </div>
          </div>

          {episodes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">गर्भधारणा प्रकरण:</label>
              <select
                value={activeEpisode?.id || ''}
                onChange={(e) => setSelectedEpisodeId(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-mono-tabular"
              >
                {episodes.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.episodeCode} · EDD {formatDDMMYYYY(ep.eddDate)} ({ep.pregnancyStatus})
                  </option>
                ))}
              </select>
              {activeEpisode && (
                <button
                  type="button"
                  onClick={openEditEpModal}
                  className="app-btn-secondary text-xs py-1.5"
                >
                  <Edit className="w-3.5 h-3.5" /> EDD / स्थिती बदला
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <div className="text-slate-500">जन्मतारीख व वय</div>
            <div className="font-mono-tabular font-semibold text-slate-900">
              {woman.dob ? `${formatDDMMYYYY(woman.dob)} (${calculateWomanAgeFromDob(woman.dob, today)})` : '-'}
            </div>
          </div>
          <div>
            <div className="text-slate-500">रक्तगट / Rh</div>
            <div className="font-semibold text-slate-900">
              {woman.bloodGroup || activeEpisode?.bloodGroup || '-'} · {woman.rhFactor || activeEpisode?.rhFactor || '-'}
            </div>
          </div>
          <div>
            <div className="text-slate-500">आधार (Masked)</div>
            <div className="font-mono-tabular text-slate-800">{maskAadhaar(woman.aadhaarNumber)}</div>
          </div>
          <div>
            <div className="text-slate-500">जात / प्रवर्ग</div>
            <div className="text-slate-800">
              {woman.caste || '-'} · {woman.category || '-'}
            </div>
          </div>
          <div>
            <div className="text-slate-500">LMP / EDD (चालू आठवडा)</div>
            <div className="font-mono-tabular font-semibold text-teal-800">
              {activeEpisode
                ? `${formatDDMMYYYY(activeEpisode.mcDate)} → ${formatDDMMYYYY(activeEpisode.eddDate)}`
                : '-'}
            </div>
            {activeGa && activeGa.totalDays >= 0 && (
              <div className="text-[11px] text-rose-700 font-semibold">{activeGa.label}</div>
            )}
          </div>
          <div>
            <div className="text-slate-500">G / P / A / L & प्रसूती स्थळ</div>
            <div className="font-semibold text-slate-900">
              {activeEpisode
                ? formatGravidaSummary({
                    gravida: activeEpisode.gravida,
                    para: activeEpisode.para,
                    abortions: activeEpisode.abortions,
                    livingChildren: activeEpisode.livingChildren,
                    fallbackText: activeEpisode.gravidaPara,
                  })
                : '-'}
            </div>
            <div className="text-[11px] text-slate-600 truncate">
              {activeEpisode?.expectedDeliveryPlace || woman.plannedDeliveryPlace || '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Workspace Navigation Tabs */}
      <div className="no-print flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        {(
          [
            { key: 'SUMMARY', label: '१. सारांश व ANC तुलना', icon: <Activity className="w-3.5 h-3.5" /> },
            { key: 'ANC', label: `२. ANC तपासणी (${epAncVisits.length})`, icon: <Stethoscope className="w-3.5 h-3.5" /> },
            { key: 'HRP', label: `३. High Risk व संदर्भ (${epReferrals.length})`, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
            { key: 'IMMUNIZATION', label: '४. Td लस व IFA/कॅल्शियम', icon: <Syringe className="w-3.5 h-3.5" /> },
            { key: 'DELIVERY', label: `५. प्रसूती व बाळ (${epBabies.length})`, icon: <Baby className="w-3.5 h-3.5" /> },
            { key: 'PNC', label: `६. PNC तपासणी (${epPncs.length})`, icon: <ClipboardPlus className="w-3.5 h-3.5" /> },
          ] as Array<{ key: TabKey; label: string; icon: React.ReactNode }>
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
              activeTab === tab.key
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {!activeEpisode ? (
        <div className="app-card app-card-body space-y-3">
          <EmptyState message="या मातेसाठी अद्याप कोणतेही गर्भधारणा प्रकरण नोंदवलेले नाही." />
          <button type="button" onClick={() => setNewEpModal(true)} className="app-btn-primary text-xs">
            <PlusCircle className="w-4 h-4" /> पहिले गर्भधारणा प्रकरण जोडा
          </button>
        </div>
      ) : (
        <>
          {/* ==================== TAB 1: SUMMARY + ANC COMPARISON + TREND GRAPH ==================== */}
          {activeTab === 'SUMMARY' && (
            <div className="space-y-5">
              {/* ANC-1 to ANC-4 Comparative Table */}
              <div className="app-card overflow-x-auto">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    ANC-1 ते ANC-4 तुलनात्मक तक्ता ({activeEpisode.episodeCode})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ANC')}
                    className="text-xs font-semibold text-teal-700 hover:underline whitespace-nowrap"
                  >
                    + नवीन ANC भेट नोंदवा →
                  </button>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">ANC भेट</th>
                      <th className="px-3 py-2.5 font-semibold">दिनांक</th>
                      <th className="px-3 py-2.5 font-semibold">आठवडा</th>
                      <th className="px-3 py-2.5 font-semibold">वजन</th>
                      <th className="px-3 py-2.5 font-semibold">BP</th>
                      <th className="px-3 py-2.5 font-semibold">Hb</th>
                      <th className="px-3 py-2.5 font-semibold">BSL</th>
                      <th className="px-3 py-2.5 font-semibold">Urine / रक्त</th>
                      <th className="px-3 py-2.5 font-semibold">औषधे व सल्ला</th>
                      <th className="px-3 py-2.5 font-semibold">कर्मचारी</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {compRows.map((c) => (
                      <tr key={c.visitNumber} className={c.source === 'NONE' ? 'bg-slate-50/40 text-slate-400' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-2.5 font-bold text-slate-900">{c.visitLabel}</td>
                        <td className="px-3 py-2.5 font-mono-tabular whitespace-nowrap">
                          {c.visitDate ? formatDDMMYYYY(c.visitDate) : 'प्रलंबित'}
                        </td>
                        <td className="px-3 py-2.5 font-mono-tabular">{c.gestationalAgeText}</td>
                        <td className="px-3 py-2.5 font-mono-tabular font-semibold">{c.weightKg}</td>
                        <td className="px-3 py-2.5 font-mono-tabular font-semibold">{c.bp}</td>
                        <td className="px-3 py-2.5 font-mono-tabular font-semibold">{c.hb}</td>
                        <td className="px-3 py-2.5 font-mono-tabular">{c.bloodSugar}</td>
                        <td className="px-3 py-2.5">{c.urineTest}</td>
                        <td className="px-3 py-2.5">{c.medicines}</td>
                        <td className="px-3 py-2.5">{c.staffName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Weight / Hb / BP Trend Graph */}
              <div className="app-card app-card-body space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  वजन (kg), हिमोग्लोबिन (Hb g/dL) व BP ट्रेंड आलेख
                </h3>
                {chartData.length === 0 ? (
                  <EmptyState message="आलेख पाहण्यासाठी किमान १ ANC तपासणी नोंदवा." />
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="वजन" stroke="#0f766e" strokeWidth={2} connectNulls />
                        <Line type="monotone" dataKey="Hb" stroke="#d97706" strokeWidth={2} connectNulls />
                        <Line type="monotone" dataKey="SystolicBP" stroke="#dc2626" strokeWidth={2} connectNulls />
                        <Line type="monotone" dataKey="DiastolicBP" stroke="#2563eb" strokeWidth={2} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Episode Medical History & EDD Change History */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="app-card app-card-body space-y-2 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">गर्भधारणा व पूर्व इतिहास</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">मागील सिझेरियन (LSCS): </span>
                      <span className="font-semibold">{activeEpisode.previousCaesarean || 'नाही'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">स्थिती: </span>
                      <span className="font-semibold">{activeEpisode.pregnancyStatus}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">मागील गर्भधारणा इतिहास: </span>
                    <span className="text-slate-800">{activeEpisode.previousPregnancyHistory || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">मागील गुंतागुंत: </span>
                    <span className="text-slate-800">{activeEpisode.previousComplications || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">प्रसूती नियोजन: </span>
                    <span className="text-slate-800">
                      {activeEpisode.expectedDeliveryPlace || '-'} ({formatDeliveryFacilityTypeMarathi(activeEpisode.deliveryFacilityType)}
                      {activeEpisode.hospitalName ? ` - ${activeEpisode.hospitalName}` : ''})
                    </span>
                  </div>
                </div>

                <div className="app-card app-card-body space-y-2 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">EDD बदल इतिहास (EDD Audit History)</h3>
                  {eddHistory.length === 0 ? (
                    <div className="text-slate-500">EDD दिनांकामध्ये अद्याप बदल केलेला नाही.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {eddHistory.map((eh, i) => (
                        <div key={i} className="p-2 rounded bg-slate-50 border border-slate-200 font-mono-tabular">
                          <div>
                            {formatDDMMYYYY(eh.previousEddDate)} → <strong>{formatDDMMYYYY(eh.newEddDate)}</strong>
                          </div>
                          <div className="text-[11px] text-slate-600 font-sans">
                            {eh.changedAt.slice(0, 10)} · {eh.changedBy}
                            {eh.reason ? ` (${eh.reason})` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: INDEPENDENT ANC VISIT ENTRY ==================== */}
          {activeTab === 'ANC' && (
            <div className="space-y-5">
              {/* Previous ANC Vitals Carry-Forward Reference */}
              <div className="app-card app-card-body space-y-2">
                <div className="text-xs font-bold text-teal-800 uppercase tracking-wide">
                  मागील तपासणी मूल्ये (वाढ व सुधारणा तुलना संदर्भ — स्वतः जतन केलेला)
                </div>
                {latestStructuredAnc ? (
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                    <div>
                      <div className="text-slate-500">शेवटची भेट</div>
                      <div className="font-mono-tabular font-bold">
                        {latestStructuredAnc.visitLabel} ({formatDDMMYYYY(latestStructuredAnc.visitDate)})
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">वजन</div>
                      <div className="font-mono-tabular font-bold">{latestStructuredAnc.weightKg || '-'} kg</div>
                    </div>
                    <div>
                      <div className="text-slate-500">BP</div>
                      <div className="font-mono-tabular font-bold">{latestStructuredAnc.bp || '-'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Hb</div>
                      <div className="font-mono-tabular font-bold">{latestStructuredAnc.hb || '-'} g/dL</div>
                    </div>
                    <div>
                      <div className="text-slate-500">BSL</div>
                      <div className="font-mono-tabular font-bold">{latestStructuredAnc.bloodSugar || '-'} mg/dL</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Urine Alb / Sug</div>
                      <div className="font-semibold">
                        {latestStructuredAnc.urineAlbumin || '-'} / {latestStructuredAnc.urineSugar || '-'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    {vitalsSummary.map((v) => (
                      <div key={v.code}>
                        <div className="text-slate-500">{v.shortLabel}</div>
                        <div className="font-mono-tabular font-semibold">
                          {v.latestValue ? `${v.latestValue} ${v.unit}` : 'नोंद नाही'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Independent Append-Only ANC Visit Form */}
              <form onSubmit={handleSaveAncVisit} className="app-card app-card-body space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      नवीन स्वतंत्र ANC तपासणी नोंद (Append-Only — जुनी भेट बदलली जाणार नाही)
                    </h3>
                    <p className="text-xs text-slate-500">
                      या तपासणी दिनांकास गर्भावस्था कालावधी:{' '}
                      <strong className="font-mono-tabular text-teal-800">
                        {calculateGestationalWeeksAndDays(activeEpisode.mcDate, ancVisitDate).label}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="app-label">ANC भेट क्रमांक *</label>
                    <select
                      value={ancVisitNo}
                      onChange={(e) => setAncVisitNo(Number(e.target.value))}
                      className="app-input"
                    >
                      <option value={1}>ANC-1 (प्रथम तिमाही)</option>
                      <option value={2}>ANC-2 (दुसरी भेट)</option>
                      <option value={3}>ANC-3 (तिसरी भेट)</option>
                      <option value={4}>ANC-4 (चौथी भेट)</option>
                      <option value={5}>Extra ANC-5</option>
                      <option value={6}>Extra ANC-6</option>
                      <option value={7}>Extra ANC-7</option>
                      <option value={8}>Extra ANC-8</option>
                    </select>
                  </div>
                  <div>
                    <label className="app-label">भेटीची तारीख *</label>
                    <input
                      type="date"
                      required
                      value={ancVisitDate}
                      onChange={(e) => setAncVisitDate(e.target.value)}
                      className="app-input font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="app-label">वजन (Kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="उदा. 54.5"
                      value={ancWeight}
                      onChange={(e) => setAncWeight(e.target.value)}
                      className="app-input font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="app-label">BP (mmHg)</label>
                    <input
                      placeholder="उदा. 120/80"
                      value={ancBp}
                      onChange={(e) => setAncBp(e.target.value)}
                      className="app-input font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="app-label">Hb (g/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="उदा. 11.2"
                      value={ancHb}
                      onChange={(e) => setAncHb(e.target.value)}
                      className="app-input font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="app-label">Blood Sugar (BSL mg/dL)</label>
                    <input
                      type="number"
                      placeholder="उदा. 96"
                      value={ancBsl}
                      onChange={(e) => setAncBsl(e.target.value)}
                      className="app-input font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="app-label">Urine Albumin</label>
                    <select
                      value={ancUrineAlb}
                      onChange={(e) => setAncUrineAlb(e.target.value)}
                      className="app-input"
                    >
                      {URINE_TEST_RESULTS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="app-label">Urine Sugar</label>
                    <select
                      value={ancUrineSug}
                      onChange={(e) => setAncUrineSug(e.target.value)}
                      className="app-input"
                    >
                      {URINE_TEST_RESULTS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="app-label">उंची (cm — ऐच्छिक)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="उदा. 154"
                      value={ancHeight}
                      onChange={(e) => setAncHeight(e.target.value)}
                      className="app-input font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="app-label">आवश्यक रक्त तपासण्या</label>
                    <input
                      placeholder="CBC, HIV, VDRL, HBsAg, USG..."
                      value={ancBloodTests}
                      onChange={(e) => setAncBloodTests(e.target.value)}
                      className="app-input"
                    />
                  </div>
                  <div>
                    <label className="app-label">इतर तपासण्या</label>
                    <input
                      placeholder="सोनोग्राफी / थायरॉईड / इतर..."
                      value={ancOtherTests}
                      onChange={(e) => setAncOtherTests(e.target.value)}
                      className="app-input"
                    />
                  </div>
                  <div>
                    <label className="app-label">पुढील भेटीची तारीख</label>
                    <input
                      type="date"
                      value={ancNextDate}
                      onChange={(e) => setAncNextDate(e.target.value)}
                      className="app-input font-mono-tabular"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="app-label">डॉक्टरांचे / CHO निरीक्षण</label>
                    <input
                      placeholder="शारीरिक तपासणी, सूज, गर्भाची हालचाल, FHS..."
                      value={ancObservation}
                      onChange={(e) => setAncObservation(e.target.value)}
                      className="app-input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="app-label">दिलेला उपचार व सल्ला</label>
                    <input
                      placeholder="आहार सल्ला, औषधे, विश्रांती..."
                      value={ancTreatment}
                      onChange={(e) => setAncTreatment(e.target.value)}
                      className="app-input"
                    />
                  </div>
                  <div>
                    <label className="app-label">तपासणी करणाऱ्या कर्मचाऱ्याचे नाव *</label>
                    <input
                      required
                      list="phc-staff-datalist"
                      value={ancStaffName}
                      onChange={(e) => setAncStaffName(e.target.value)}
                      className="app-input"
                    />
                    <datalist id="phc-staff-datalist">
                      {activeStaffOptions.map((st) => (
                        <option key={st.id} value={st.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="app-label">पदनाम (ANM / CHO / MO)</label>
                    <select
                      value={ancStaffDesig}
                      onChange={(e) => setAncStaffDesig(e.target.value)}
                      className="app-input"
                    >
                      <option value="ANM">ANM</option>
                      <option value="CHO">CHO</option>
                      <option value="MEDICAL_OFFICER">Medical Officer (MO)</option>
                      <option value="ASHA">ASHA</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={saving} className="app-btn-primary text-xs px-5 py-2.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {saving ? 'जतन होत आहे...' : 'ANC तपासणी नोंद जतन करा'}
                  </button>
                </div>
              </form>

              {/* Immutable ANC Visit History */}
              <div className="app-card overflow-x-auto">
                <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
                  या गर्भधारणेतील सर्व जतन केलेल्या ANC भेटी ({epAncVisits.length})
                </div>
                {epAncVisits.length === 0 ? (
                  <div className="p-5 text-xs text-slate-500">अद्याप स्वतंत्र ANC भेट नोंदवलेली नाही.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">भेट</th>
                        <th className="px-3 py-2.5">दिनांक (आठवडा)</th>
                        <th className="px-3 py-2.5">वजन / BP / Hb / BSL</th>
                        <th className="px-3 py-2.5">Urine व रक्त तपासण्या</th>
                        <th className="px-3 py-2.5">निरीक्षण व उपचार</th>
                        <th className="px-3 py-2.5">पुढील भेट</th>
                        <th className="px-3 py-2.5">कर्मचारी</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {epAncVisits.map((v) => (
                        <tr key={v.id}>
                          <td className="px-3 py-2.5 font-bold text-teal-800">{v.visitLabel}</td>
                          <td className="px-3 py-2.5 font-mono-tabular whitespace-nowrap">
                            <div>{formatDDMMYYYY(v.visitDate)}</div>
                            <div className="text-slate-500 font-sans">{v.gestationalAgeText}</div>
                          </td>
                          <td className="px-3 py-2.5 font-mono-tabular">
                            Wt: {v.weightKg || '-'}kg · BP: {v.bp || '-'} · Hb: {v.hb || '-'} · BSL: {v.bloodSugar || '-'}
                          </td>
                          <td className="px-3 py-2.5">
                            Alb: {v.urineAlbumin || '-'} · Sug: {v.urineSugar || '-'}
                            {v.bloodTests ? ` · ${v.bloodTests}` : ''}
                          </td>
                          <td className="px-3 py-2.5">
                            {v.doctorObservation || '-'}
                            {v.treatmentAdvice ? ` · सल्ला: ${v.treatmentAdvice}` : ''}
                          </td>
                          <td className="px-3 py-2.5 font-mono-tabular">
                            {v.nextVisitDate ? formatDDMMYYYY(v.nextVisitDate) : '-'}
                          </td>
                          <td className="px-3 py-2.5">
                            {v.staffName} ({v.staffDesignation || '-'})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 3: HIGH RISK (HRP) & REFERRAL ==================== */}
          {activeTab === 'HRP' && (
            <div className="space-y-5">
              <form onSubmit={handleSaveHrp} className="app-card app-card-body space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    High Risk Pregnancy (अतिजोखमीची गर्भधारणा) व्यवस्थापन
                  </h3>
                  <p className="text-xs text-slate-500">
                    अंतिम वैद्यकीय जोखीम निदान व उपचार वैद्यकीय अधिकाऱ्यांच्या (MO) पडताळणीनंतरच ग्राह्य धरले जातात.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="app-label">High Risk Status *</label>
                    <select
                      value={hrpFlag}
                      onChange={(e) => setHrpFlag(e.target.value as 'YES' | 'NO')}
                      className="app-input font-semibold"
                    >
                      <option value="NO">No (सामान्य जोखीम)</option>
                      <option value="YES">Yes (High Risk — अतिजोखमीची माता)</option>
                    </select>
                  </div>
                  <div>
                    <label className="app-label">HRP ओळखल्याची तारीख</label>
                    <input
                      type="date"
                      value={hrpDate}
                      onChange={(e) => setHrpDate(e.target.value)}
                      className="app-input font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="app-label">सद्यस्थिती (Current Status)</label>
                    <select
                      value={hrpCurrentStatus}
                      onChange={(e) => setHrpCurrentStatus(e.target.value)}
                      className="app-input"
                    >
                      <option value="निरीक्षणाखाली">निरीक्षणाखाली (Under Observation)</option>
                      <option value="संदर्भित">संदर्भित (Referred)</option>
                      <option value="स्थिर">स्थिर (Stabilized)</option>
                      <option value="प्रसूती पूर्ण">प्रसूती पूर्ण</option>
                    </select>
                  </div>
                </div>

                {hrpFlag === 'YES' && (
                  <div className="space-y-2 p-3.5 rounded-xl bg-rose-50/50 border border-rose-200">
                    <div className="text-xs font-bold text-rose-900">
                      High Risk ची कारणे निवडा (एकापेक्षा जास्त कारणे निवडता येतील):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                      {HRP_REASON_OPTIONS.map((reason) => {
                        const checked = hrpReasons.includes(reason);
                        return (
                          <label key={reason} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) setHrpReasons((p) => [...p, reason]);
                                else setHrpReasons((p) => p.filter((x) => x !== reason));
                              }}
                            />
                            <span>{reason}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="pt-2">
                      <label className="app-label">इतर कारण / सविस्तर टीप</label>
                      <input
                        value={hrpOtherReason}
                        onChange={(e) => setHrpOtherReason(e.target.value)}
                        placeholder="अन्य वैद्यकीय कारण असल्यास येथे लिहा..."
                        className="app-input"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="app-label">डॉक्टरांचा सल्ला (Doctor Advice)</label>
                      <input
                        value={hrpAdvice}
                        onChange={(e) => setHrpAdvice(e.target.value)}
                        className="app-input"
                      />
                    </div>
                    <div>
                      <label className="app-label">उपचार माहिती (Treatment Info)</label>
                      <input
                        value={hrpTreatment}
                        onChange={(e) => setHrpTreatment(e.target.value)}
                        className="app-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="app-label">पाठपुरावा दिनांक</label>
                    <input
                      type="date"
                      value={hrpFollowDate}
                      onChange={(e) => setHrpFollowDate(e.target.value)}
                      className="app-input font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="app-label">पाठपुरावा स्थिती</label>
                    <select
                      value={hrpFollowStatus}
                      onChange={(e) => setHrpFollowStatus(e.target.value)}
                      className="app-input"
                    >
                      <option value="प्रलंबित">प्रलंबित (Pending)</option>
                      <option value="पूर्ण">पूर्ण (Completed)</option>
                      <option value="संदर्भित">संदर्भित (Referred)</option>
                    </select>
                  </div>
                  <div>
                    <label className="app-label">वैद्यकीय अधिकारी पडताळणी नाव</label>
                    <input
                      value={hrpApprovedMo}
                      onChange={(e) => setHrpApprovedMo(e.target.value)}
                      placeholder="Dr. ... (Medical Officer)"
                      className="app-input"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="app-label">स्थिती बदलाची टीप (इतिहासासाठी)</label>
                    <input
                      value={hrpNote}
                      onChange={(e) => setHrpNote(e.target.value)}
                      placeholder="उदा. Hb 7.2 वरून 9.8 पर्यंत सुधारणा / संदर्भित"
                      className="app-input"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="app-btn-primary text-xs px-5 py-2">
                    {saving ? 'जतन होत आहे...' : 'HRP माहिती जतन करा'}
                  </button>
                </div>
              </form>

              {/* HRP Status Change History */}
              {hrpHistory.length > 0 && (
                <div className="app-card app-card-body space-y-2">
                  <h4 className="text-xs font-bold text-slate-800">HRP स्थिती बदल इतिहास (Status Change History)</h4>
                  <div className="space-y-1.5 text-xs">
                    {hrpHistory.map((hh, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap justify-between gap-2">
                        <div>
                          <span className="font-bold">{hh.status === 'YES' ? 'High Risk' : 'Normal'}</span> · {hh.currentStatus}
                          {hh.reasons.length > 0 ? ` · ${hh.reasons.join(', ')}` : ''}
                          {hh.note ? ` · (${hh.note})` : ''}
                        </div>
                        <div className="font-mono-tabular text-slate-500">
                          {hh.changedAt.slice(0, 10)} · {hh.changedBy}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Maternal Referral Form & List */}
              <form onSubmit={handleSaveReferral} className="app-card app-card-body space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  उच्च रुग्णालय संदर्भित नोंद (Referral Registration)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="app-label">संदर्भ दिनांक *</label>
                    <input type="date" required value={refDate} onChange={(e) => setRefDate(e.target.value)} className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">कुठून संदर्भित (Referred From) *</label>
                    <input required value={refFrom} onChange={(e) => setRefFrom(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">संदर्भित रुग्णालय (Referred To) *</label>
                    <input required placeholder="उदा. ग्रामीण रुग्णालय औसा / जिल्हा रुग्णालय लातूर" value={refToHospital} onChange={(e) => setRefToHospital(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">संदर्भ कारण *</label>
                    <input required placeholder="Severe Anaemia / High BP / Previous LSCS..." value={refReason} onChange={(e) => setRefReason(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">वाहतूक व्यवस्था</label>
                    <input value={refTransport} onChange={(e) => setRefTransport(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">पाठपुरावा दिनांक</label>
                    <input type="date" value={refFollowDate} onChange={(e) => setRefFollowDate(e.target.value)} className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">संदर्भित करणारा कर्मचारी</label>
                    <input value={refStaff} onChange={(e) => setRefStaff(e.target.value)} className="app-input" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="app-btn-primary text-xs px-5 py-2">
                    संदर्भित नोंद जतन करा
                  </button>
                </div>
              </form>

              {epReferrals.length > 0 && (
                <div className="app-card overflow-x-auto">
                  <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
                    या गर्भधारणेतील संदर्भित नोंदी व पाठपुरावा स्थिती ({epReferrals.length})
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">दिनांक</th>
                        <th className="px-3 py-2.5">रुग्णालय</th>
                        <th className="px-3 py-2.5">कारण व वाहतूक</th>
                        <th className="px-3 py-2.5">पाठपुरावा स्थिती अद्यतन</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {epReferrals.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2.5 font-mono-tabular">{formatDDMMYYYY(r.referralDate)}</td>
                          <td className="px-3 py-2.5 font-semibold">{r.referredToHospital}</td>
                          <td className="px-3 py-2.5">{r.referralReason} ({r.transportArrangement || '-'})</td>
                          <td className="px-3 py-2.5">
                            <select
                              value={r.followUpStatus}
                              onChange={async (e) => {
                                await updateMaternalReferralStatus(r.id, {
                                  followUpStatus: e.target.value as MaternalReferralRecord['followUpStatus'],
                                });
                                setToast({ msg: 'संदर्भ पाठपुरावा स्थिती अद्यतनित केली.', type: 'success' });
                              }}
                              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                            >
                              <option value="प्रलंबित">प्रलंबित</option>
                              <option value="भेट पूर्ण">भेट पूर्ण</option>
                              <option value="दाखल">दाखल</option>
                              <option value="बंद">बंद</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 4: IMMUNIZATION & SUPPLEMENTS ==================== */}
          {activeTab === 'IMMUNIZATION' && (
            <div className="space-y-5">
              {/* Current Td Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Td-1 डोस', rec: td1Rec },
                  { label: 'Td-2 डोस', rec: td2Rec },
                  { label: 'Td-Booster डोस', rec: tdBoosterRec },
                ].map((item) => (
                  <div key={item.label} className="app-card p-3.5 text-xs space-y-1">
                    <div className="text-slate-500 font-medium">{item.label}</div>
                    {item.rec ? (
                      <div className="font-semibold text-emerald-700">
                        पूर्ण · {formatDDMMYYYY(item.rec.visitDate || item.rec.sessionDate)}
                        {item.rec.batchNumber ? ` (बॅच: ${item.rec.batchNumber})` : ''}
                      </div>
                    ) : (
                      <div className="text-slate-500">अद्याप नोंदवलेले नाही</div>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSaveImmAndSupp} className="app-card app-card-body space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  Td लसीकरण, IFA, कॅल्शियम व इतर औषध वितरण नोंदवा
                </h3>

                {tdSelection !== 'NONE' && !tdValidation.ok && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                    {tdValidation.error}
                  </div>
                )}
                {tdSelection !== 'NONE' && tdValidation.ok && tdValidation.warning && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    {tdValidation.warning}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="app-label">वितरण / लसीकरण दिनांक *</label>
                    <input type="date" required value={immDate} onChange={(e) => setImmDate(e.target.value)} className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">Td लस डोस निवडा</label>
                    <select
                      value={tdSelection}
                      onChange={(e) => setTdSelection(e.target.value as typeof tdSelection)}
                      className="app-input"
                    >
                      <option value="NONE">-- आज Td लस नाही --</option>
                      <option value="TD_1">Td-1 लस</option>
                      <option value="TD_2">Td-2 लस (Td-1 नंतर किमान २८ दिवस)</option>
                      <option value="TD_BOOSTER">Td Booster लस</option>
                    </select>
                  </div>
                  <div>
                    <label className="app-label">Td बॅच क्रमांक</label>
                    <input value={tdBatch} onChange={(e) => setTdBatch(e.target.value)} placeholder="उदा. TD-409B" className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">IFA गोळ्या (संख्या)</label>
                    <input type="number" min={0} value={ifaCount} onChange={(e) => setIfaCount(e.target.value)} placeholder="उदा. 30" className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">कॅल्शियम गोळ्या (संख्या)</label>
                    <input type="number" min={0} value={calciumCount} onChange={(e) => setCalciumCount(e.target.value)} placeholder="उदा. 60" className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">इतर औषधे (Folic Acid / Albendazole इ.)</label>
                    <input value={otherMedText} onChange={(e) => setOtherMedText(e.target.value)} placeholder="उदा. Tab Albendazole 400mg" className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">वितरण करणाऱ्या कर्मचाऱ्याचे नाव *</label>
                    <input required list="phc-staff-datalist" value={immStaff} onChange={(e) => setImmStaff(e.target.value)} className="app-input" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving || (tdSelection !== 'NONE' && !tdValidation.ok)}
                    className="app-btn-primary text-xs px-5 py-2 disabled:opacity-50"
                  >
                    {saving ? 'जतन होत आहे...' : 'लस व औषध वितरण जतन करा'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ==================== TAB 5: DELIVERY TRACKING & MULTIPLE BABIES ==================== */}
          {activeTab === 'DELIVERY' && (
            <div className="space-y-5">
              <form onSubmit={handleSaveDelivery} className="app-card app-card-body space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  प्रसूती नियोजन व प्रत्यक्ष प्रसूती नोंद (Delivery & Multiple Baby Records)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="app-label">नियोजित प्रसूती ठिकाण</label>
                    <input value={delivPlanPlace} onChange={(e) => setDelivPlanPlace(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">नियोजित रुग्णालय</label>
                    <input value={delivPlanHospital} onChange={(e) => setDelivPlanHospital(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">प्रसूतीपूर्व संदर्भ आवश्यक?</label>
                    <select value={delivPreReferral} onChange={(e) => setDelivPreReferral(e.target.value as 'Yes' | 'No' | '')} className="app-input">
                      <option value="No">नाही</option>
                      <option value="Yes">होय</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="app-label">प्रसूती पूर्व नियोजन टीप</label>
                    <input value={delivPlanNotes} onChange={(e) => setDelivPlanNotes(e.target.value)} placeholder="रुग्णवाहिका संपर्क, रक्तगट तयारी इ." className="app-input" />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="app-label">प्रत्यक्ष प्रसूती दिनांक *</label>
                    <input type="date" required value={delivActualDate} onChange={(e) => setDelivActualDate(e.target.value)} className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">प्रसूती ठिकाण *</label>
                    <select value={delivActualPlace} onChange={(e) => setDelivActualPlace(e.target.value)} className="app-input">
                      {PLANNED_DELIVERY_PLACES.map((pl) => (
                        <option key={pl} value={pl}>{pl}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="app-label">रुग्णालयाचे नाव</label>
                    <input value={delivActualHospital} onChange={(e) => setDelivActualHospital(e.target.value)} placeholder="उदा. PHC भादा / RH औसा" className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">प्रसूती प्रकार *</label>
                    <select value={delivType} onChange={(e) => setDelivType(e.target.value as DeliveryTypeOption)} className="app-input">
                      <option value="Normal Delivery">Normal Delivery (नैसर्गिक)</option>
                      <option value="LSCS">LSCS (सिझेरियन)</option>
                      <option value="Assisted Delivery">Assisted Delivery</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {delivType === 'Other' && (
                    <div>
                      <label className="app-label">इतर प्रसूती प्रकार</label>
                      <input value={delivTypeOther} onChange={(e) => setDelivTypeOther(e.target.value)} className="app-input" />
                    </div>
                  )}
                  <div>
                    <label className="app-label">जन्मलेल्या बाळांची संख्या (Twins / Triplets समर्थन) *</label>
                    <select value={numBabies} onChange={(e) => setNumBabies(Number(e.target.value))} className="app-input font-mono-tabular">
                      <option value={1}>१ बाळ (Single)</option>
                      <option value={2}>२ बाळे (Twins)</option>
                      <option value={3}>३ बाळे (Triplets)</option>
                      <option value={4}>४ बाळे</option>
                    </select>
                  </div>
                  <div>
                    <label className="app-label">मातेची प्रसूतीनंतर स्थिती *</label>
                    <input required value={delivMotherCond} onChange={(e) => setDelivMotherCond(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">गुंतागुंत (Complications)</label>
                    <input value={delivComplications} onChange={(e) => setDelivComplications(e.target.value)} placeholder="काही असल्यास नमूद करा" className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">प्रसूती करणारे डॉक्टर / ANM</label>
                    <input value={delivStaff} onChange={(e) => setDelivStaff(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">प्रसूती संदर्भ तपशील (असल्यास)</label>
                    <input value={delivReferralDetails} onChange={(e) => setDelivReferralDetails(e.target.value)} className="app-input" />
                  </div>
                </div>

                {/* Per-Baby Sub-Forms */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-teal-800">
                    प्रत्येक जन्मलेल्या बाळाची स्वतंत्र नोंद ({numBabies} बाळे):
                  </div>
                  {babyDrafts.map((bd, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                      <div className="sm:col-span-2 lg:col-span-1">
                        <label className="app-label">बाळ #{idx + 1} नाव *</label>
                        <input
                          required
                          value={bd.babyName}
                          onChange={(e) =>
                            setBabyDrafts((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, babyName: e.target.value } : x))
                            )
                          }
                          className="app-input"
                        />
                      </div>
                      <div>
                        <label className="app-label">लिंग *</label>
                        <select
                          value={bd.gender}
                          onChange={(e) =>
                            setBabyDrafts((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, gender: e.target.value as BabyRecord['gender'] } : x
                              )
                            )
                          }
                          className="app-input"
                        >
                          <option value="मुलगा">मुलगा</option>
                          <option value="मुलगी">मुलगी</option>
                          <option value="इतर">इतर</option>
                        </select>
                      </div>
                      <div>
                        <label className="app-label">जन्म वजन (ग्रॅममध्ये — g)</label>
                        <input
                          type="number"
                          placeholder="उदा. 2850"
                          value={bd.birthWeightGrams}
                          onChange={(e) =>
                            setBabyDrafts((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, birthWeightGrams: e.target.value } : x
                              )
                            )
                          }
                          className="app-input font-mono-tabular"
                        />
                      </div>
                      <div>
                        <label className="app-label">जन्म परिणाम *</label>
                        <select
                          value={bd.birthOutcome}
                          onChange={(e) =>
                            setBabyDrafts((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, birthOutcome: e.target.value as BabyBirthOutcome } : x
                              )
                            )
                          }
                          className="app-input"
                        >
                          <option value="Live Birth">Live Birth (जिवंत जन्म)</option>
                          <option value="Stillbirth">Stillbirth</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="app-label">बाळाची प्रकृती *</label>
                        <input
                          required
                          value={bd.babyCondition}
                          onChange={(e) =>
                            setBabyDrafts((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, babyCondition: e.target.value } : x
                              )
                            )
                          }
                          className="app-input"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markEpDelivered}
                    onChange={(e) => setMarkEpDelivered(e.target.checked)}
                  />
                  प्रसूती जतन केल्यानंतर हे गर्भधारणा प्रकरण &apos;प्रसूती पूर्ण&apos; म्हणून बंद करा
                </label>

                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="app-btn-primary text-xs px-5 py-2.5">
                    {saving ? 'जतन होत आहे...' : 'प्रसूती व बाळांच्या नोंदी जतन करा'}
                  </button>
                </div>
              </form>

              {epBabies.length > 0 && (
                <div className="app-card overflow-x-auto">
                  <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
                    जतन केलेल्या बाळांच्या नोंदी ({epBabies.length})
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">बाळ ID</th>
                        <th className="px-3 py-2.5">नाव</th>
                        <th className="px-3 py-2.5">लिंग</th>
                        <th className="px-3 py-2.5">जन्म दिनांक</th>
                        <th className="px-3 py-2.5 text-right">जन्म वजन</th>
                        <th className="px-3 py-2.5">परिणाम व प्रकृती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {epBabies.map((b) => (
                        <tr key={b.id}>
                          <td className="px-3 py-2.5 font-mono-tabular font-semibold text-teal-800">{b.babyCode}</td>
                          <td className="px-3 py-2.5 font-semibold">{b.babyName}</td>
                          <td className="px-3 py-2.5">{b.gender}</td>
                          <td className="px-3 py-2.5 font-mono-tabular">{formatDDMMYYYY(b.dob)}</td>
                          <td className="px-3 py-2.5 text-right font-mono-tabular">
                            {b.birthWeightGrams ? `${formatNumberIN(b.birthWeightGrams)} g` : '-'}
                          </td>
                          <td className="px-3 py-2.5">
                            {b.birthOutcome} · {b.babyCondition}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 6: PNC POSTNATAL CARE ==================== */}
          {activeTab === 'PNC' && (
            <div className="space-y-5">
              <form onSubmit={handleSavePnc} className="app-card app-card-body space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  PNC (प्रसूतीनंतर तपासणी — PNC-1 / PNC-2 / Extra) नोंदवा
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="app-label">PNC भेट *</label>
                    <select value={pncVisitNo} onChange={(e) => setPncVisitNo(Number(e.target.value))} className="app-input">
                      <option value={1}>PNC-1 (प्रसूतीनंतर ३-७ दिवस)</option>
                      <option value={2}>PNC-2 (१४-४२ दिवस)</option>
                      <option value={3}>Extra PNC-3</option>
                      <option value={4}>Extra PNC-4</option>
                    </select>
                  </div>
                  <div>
                    <label className="app-label">PNC दिनांक *</label>
                    <input type="date" required value={pncDate} onChange={(e) => setPncDate(e.target.value)} className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">मातेचे BP (mmHg)</label>
                    <input value={pncMotherBp} onChange={(e) => setPncMotherBp(e.target.value)} placeholder="उदा. 118/76" className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">मातेची प्रकृती *</label>
                    <input required value={pncMotherHealth} onChange={(e) => setPncMotherHealth(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">रक्तस्राव स्थिती *</label>
                    <input required value={pncBleeding} onChange={(e) => setPncBleeding(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">स्तनपान स्थिती *</label>
                    <input required value={pncBreastfeeding} onChange={(e) => setPncBreastfeeding(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">बाळाचे वजन (ग्रॅम — g)</label>
                    <input type="number" value={pncBabyWeight} onChange={(e) => setPncBabyWeight(e.target.value)} placeholder="उदा. 2950" className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">बाळाची प्रकृती *</label>
                    <input required value={pncBabyHealth} onChange={(e) => setPncBabyHealth(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">स्तनपान समुपदेशन (Counselling)</label>
                    <select value={pncCounselling} onChange={(e) => setPncCounselling(e.target.value as 'Yes' | 'No' | '')} className="app-input">
                      <option value="Yes">Yes (दिले)</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="app-label">औषधोपचार / सल्ला</label>
                    <input value={pncTreatment} onChange={(e) => setPncTreatment(e.target.value)} className="app-input" />
                  </div>
                  <div>
                    <label className="app-label">पुढील पाठपुरावा दिनांक</label>
                    <input type="date" value={pncNextDate} onChange={(e) => setPncNextDate(e.target.value)} className="app-input font-mono-tabular" />
                  </div>
                  <div>
                    <label className="app-label">तपासणी करणाऱ्या कर्मचाऱ्याचे नाव *</label>
                    <input required list="phc-staff-datalist" value={pncStaff} onChange={(e) => setPncStaff(e.target.value)} className="app-input" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="app-btn-primary text-xs px-5 py-2.5">
                    {saving ? 'जतन होत आहे...' : 'PNC तपासणी जतन करा'}
                  </button>
                </div>
              </form>

              {epPncs.length > 0 && (
                <div className="app-card overflow-x-auto">
                  <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
                    जतन केलेल्या PNC तपासण्या ({epPncs.length})
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">भेट</th>
                        <th className="px-3 py-2.5">दिनांक</th>
                        <th className="px-3 py-2.5">मातेचे BP व प्रकृती</th>
                        <th className="px-3 py-2.5">रक्तस्राव व स्तनपान</th>
                        <th className="px-3 py-2.5">बाळाचे वजन व प्रकृती</th>
                        <th className="px-3 py-2.5">समुपदेशन / उपचार</th>
                        <th className="px-3 py-2.5">कर्मचारी</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {epPncs.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2.5 font-bold text-teal-800">{p.visitLabel}</td>
                          <td className="px-3 py-2.5 font-mono-tabular">{formatDDMMYYYY(p.pncDate)}</td>
                          <td className="px-3 py-2.5">
                            BP: {p.motherBp || '-'} · {p.motherHealthStatus}
                          </td>
                          <td className="px-3 py-2.5">
                            {p.bleedingStatus} · {p.breastfeedingStatus}
                          </td>
                          <td className="px-3 py-2.5">
                            {p.babyWeightGrams ? `${formatNumberIN(p.babyWeightGrams)}g · ` : ''}
                            {p.babyHealthStatus}
                          </td>
                          <td className="px-3 py-2.5">
                            समुपदेशन: {p.breastfeedingCounselling || '-'}
                            {p.treatmentGiven ? ` · ${p.treatmentGiven}` : ''}
                          </td>
                          <td className="px-3 py-2.5">{p.staffName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL: CREATE NEW PREGNANCY EPISODE */}
      {newEpModal && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <form onSubmit={handleCreateEpisode} className="app-modal max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                नवीन गर्भधारणा प्रकरण जोडा ({woman.childName})
              </h3>
              <button type="button" onClick={() => setNewEpModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="app-label">LMP / MC दिनांक *</label>
                <input
                  type="date"
                  required
                  value={neMcDate}
                  onChange={(e) => {
                    setNeMcDate(e.target.value);
                    setNeEddDate(calculateEddFromMcDate(e.target.value));
                  }}
                  className="app-input font-mono-tabular"
                />
              </div>
              <div>
                <label className="app-label">EDD दिनांक *</label>
                <input type="date" required value={neEddDate} onChange={(e) => setNeEddDate(e.target.value)} className="app-input font-mono-tabular" />
              </div>
              <div>
                <label className="app-label">Gravida / Para / Abortions / Living</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <input type="number" min={0} placeholder="G" value={neGravida} onChange={(e) => setNeGravida(e.target.value)} className="app-input font-mono-tabular" />
                  <input type="number" min={0} placeholder="P" value={nePara} onChange={(e) => setNePara(e.target.value)} className="app-input font-mono-tabular" />
                  <input type="number" min={0} placeholder="A" value={neAbortions} onChange={(e) => setNeAbortions(e.target.value)} className="app-input font-mono-tabular" />
                  <input type="number" min={0} placeholder="L" value={neLiving} onChange={(e) => setNeLiving(e.target.value)} className="app-input font-mono-tabular" />
                </div>
              </div>
              <div>
                <label className="app-label">मागील सिझेरियन (Prev LSCS)</label>
                <select value={nePrevCs} onChange={(e) => setNePrevCs(e.target.value as 'Yes' | 'No')} className="app-input">
                  <option value="No">नाही (No)</option>
                  <option value="Yes">होय (Yes)</option>
                </select>
              </div>
              <div>
                <label className="app-label">Blood Group / Rh Factor</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={neBloodGroup} onChange={(e) => setNeBloodGroup(e.target.value)} className="app-input">
                    <option value="">रक्तगट</option>
                    {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                  <select value={neRhFactor} onChange={(e) => setNeRhFactor(e.target.value)} className="app-input">
                    <option value="">Rh</option>
                    {RH_FACTORS.map((rh) => <option key={rh} value={rh}>{rh}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="app-label">प्रसूती अपेक्षित ठिकाण *</label>
                <input required value={neDeliveryPlace} onChange={(e) => setNeDeliveryPlace(e.target.value)} placeholder="उदा. PHC भादा" className="app-input" />
              </div>
              <div>
                <label className="app-label">रुग्णालय प्रकार</label>
                <select value={neFacilityType} onChange={(e) => setNeFacilityType(e.target.value as DeliveryFacilityType)} className="app-input">
                  <option value="Government">शासकीय (Government)</option>
                  <option value="Private">खाजगी (Private)</option>
                  <option value="Other">इतर</option>
                </select>
              </div>
              <div>
                <label className="app-label">रुग्णालयाचे नाव</label>
                <input value={neHospitalName} onChange={(e) => setNeHospitalName(e.target.value)} className="app-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="app-label">मागील गर्भधारणा इतिहास व गुंतागुंत</label>
                <input value={nePrevHistory} onChange={(e) => setNePrevHistory(e.target.value)} placeholder="मागील प्रसूती तपशील / गुंतागुंत..." className="app-input mb-2" />
                <input value={nePrevComp} onChange={(e) => setNePrevComp(e.target.value)} placeholder="मागील गुंतागुंत (Pre-eclampsia, PPH इ.)" className="app-input" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setNewEpModal(false)} className="app-btn-secondary text-xs">रद्द करा</button>
              <button type="submit" disabled={saving} className="app-btn-primary text-xs">
                {saving ? 'जतन होत आहे...' : 'प्रकरण जतन करा'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: UPDATE EPISODE & TRACK EDD HISTORY */}
      {editEpModal && activeEpisode && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <form onSubmit={handleUpdateEpisode} className="app-modal max-w-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                गर्भधारणा व EDD अद्यतन ({activeEpisode.episodeCode})
              </h3>
              <button type="button" onClick={() => setEditEpModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="app-label">LMP / MC दिनांक *</label>
                <input type="date" required value={ueMcDate} onChange={(e) => setUeMcDate(e.target.value)} className="app-input font-mono-tabular" />
              </div>
              <div>
                <label className="app-label">EDD दिनांक (बदलल्यास इतिहास जतन होईल) *</label>
                <input type="date" required value={ueEddDate} onChange={(e) => setUeEddDate(e.target.value)} className="app-input font-mono-tabular" />
              </div>
              <div className="sm:col-span-2">
                <label className="app-label">EDD बदलाचे कारण (USG / वैद्यकीय तपासणी)</label>
                <input value={ueEddReason} onChange={(e) => setUeEddReason(e.target.value)} placeholder="उदा. USG Scan नुसार सुधारणा" className="app-input" />
              </div>
              <div>
                <label className="app-label">प्रसूती नियोजित ठिकाण</label>
                <input value={uePlace} onChange={(e) => setUePlace(e.target.value)} className="app-input" />
              </div>
              <div>
                <label className="app-label">गर्भधारणा स्थिती</label>
                <select value={ueStatus} onChange={(e) => setUeStatus(e.target.value as PregnancyStatus)} className="app-input">
                  <option value="सक्रिय">सक्रिय</option>
                  <option value="प्रसूती पूर्ण">प्रसूती पूर्ण</option>
                  <option value="संदर्भित">संदर्भित</option>
                  <option value="बंद">बंद</option>
                </select>
              </div>
              <div>
                <label className="app-label">रुग्णालय प्रकार</label>
                <select value={ueFacility} onChange={(e) => setUeFacility(e.target.value as DeliveryFacilityType)} className="app-input">
                  <option value="Government">शासकीय</option>
                  <option value="Private">खाजगी</option>
                  <option value="Other">इतर</option>
                </select>
              </div>
              <div>
                <label className="app-label">रुग्णालय नाव</label>
                <input value={ueHospital} onChange={(e) => setUeHospital(e.target.value)} className="app-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="app-label">शेरा</label>
                <input value={ueNotes} onChange={(e) => setUeNotes(e.target.value)} className="app-input" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setEditEpModal(false)} className="app-btn-secondary text-xs">रद्द करा</button>
              <button type="submit" disabled={saving} className="app-btn-primary text-xs">
                <Calendar className="w-3.5 h-3.5" /> {saving ? 'जतन होत आहे...' : 'अद्यतन जतन करा'}
              </button>
            </div>
          </form>
        </div>
      )}

      <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: 'success' })} />
    </div>
  );
};
