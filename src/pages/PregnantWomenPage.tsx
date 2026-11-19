import React, { useMemo, useState } from 'react';
import {
  Baby,
  Calendar,
  Download,
  Edit,
  Eye,
  EyeOff,
  HeartPulse,
  History,
  PlusCircle,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import {
  Beneficiary,
  BeneficiaryStatus,
  DeliveryFacilityType,
  PregnancyEpisode,
  PregnancyStatus,
} from '../types';
import { formatDDMMYYYY, getTodayIST } from '../utils/dateUtils';
import { formatNumberIN } from '../utils/localeUtils';
import {
  CASTE_CATEGORIES,
  calculateEddFromMcDate,
  calculateGestationalAgeLabel,
  formatDeliveryFacilityTypeMarathi,
  groupMaternalVisitsByDate,
} from '../utils/maternalUtils';
import { canViewFullAadhaar, maskAadhaar } from '../utils/privacyUtils';
import { fuzzyFilterAndRank } from '../utils/fuzzySearch';
import { downloadBeneficiaryConsolidatedPDF } from '../utils/sessionPdfReport';
import { VitalsComparisonCard } from '../components/VitalsComparisonCard';
import { FuzzyAutocomplete } from '../components/FuzzyAutocomplete';
import { SearchableSelect } from '../components/SearchableSelect';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';

export const PregnantWomenPage: React.FC = () => {
  const {
    db,
    currentUser,
    registerBeneficiary,
    updateBeneficiary,
    createPregnancyEpisode,
    updatePregnancyEpisode,
  } = useSheetData();

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';

  const [search, setSearch] = useState('');
  const [subcentreFilter, setSubcentreFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [revealedAadhaarIds, setRevealedAadhaarIds] = useState<Record<string, boolean>>({});
  const [expandedWomanId, setExpandedWomanId] = useState<string>('');

  // Modal: New Pregnant Woman Registration
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [nFullName, setNFullName] = useState('');
  const [nHusbandName, setNHusbandName] = useState('');
  const [nMobile, setNMobile] = useState('');
  const [nAadhaar, setNAadhaar] = useState('');
  const [nCaste, setNCaste] = useState('');
  const [nCategory, setNCategory] = useState<string>(CASTE_CATEGORIES[0]);
  const [nSubcentreId, setNSubcentreId] = useState(scopedSubcentre);
  const [nVillageId, setNVillageId] = useState('');
  const [nAddress, setNAddress] = useState('');
  const [nRegDate, setNRegDate] = useState(getTodayIST());
  const [nMcDate, setNMcDate] = useState('');
  const [nEddDate, setNEddDate] = useState('');
  const [nDeliveryPlace, setNDeliveryPlace] = useState('');
  const [nFacilityType, setNFacilityType] = useState<DeliveryFacilityType>('Government');
  const [nHospitalName, setNHospitalName] = useState('');
  const [nGravida, setNGravida] = useState('');

  // Modal: Edit Permanent Profile
  const [editWoman, setEditWoman] = useState<Beneficiary | null>(null);
  const [eFullName, setEFullName] = useState('');
  const [eHusbandName, setEHusbandName] = useState('');
  const [eMobile, setEMobile] = useState('');
  const [eAadhaar, setEAadhaar] = useState('');
  const [eCaste, setECaste] = useState('');
  const [eCategory, setECategory] = useState('');
  const [eSubcentreId, setESubcentreId] = useState('');
  const [eVillageId, setEVillageId] = useState('');
  const [eAddress, setEAddress] = useState('');
  const [eStatus, setEStatus] = useState<BeneficiaryStatus>('सक्रिय');

  // Modal: Add New Pregnancy Episode for Existing Woman
  const [newEpisodeForWoman, setNewEpisodeForWoman] = useState<Beneficiary | null>(null);
  const [epMcDate, setEpMcDate] = useState('');
  const [epEddDate, setEpEddDate] = useState('');
  const [epDeliveryPlace, setEpDeliveryPlace] = useState('');
  const [epFacilityType, setEpFacilityType] = useState<DeliveryFacilityType>('Government');
  const [epHospitalName, setEpHospitalName] = useState('');
  const [epRegDate, setEpRegDate] = useState(getTodayIST());
  const [epGravida, setEpGravida] = useState('');
  const [epNotes, setEpNotes] = useState('');

  // Modal: Update Pregnancy Episode
  const [editEpisode, setEditEpisode] = useState<PregnancyEpisode | null>(null);
  const [ueMcDate, setUeMcDate] = useState('');
  const [ueEddDate, setUeEddDate] = useState('');
  const [uePlace, setUePlace] = useState('');
  const [ueFacility, setUeFacility] = useState<DeliveryFacilityType>('Government');
  const [ueHospital, setUeHospital] = useState('');
  const [ueStatus, setUeStatus] = useState<PregnancyStatus>('सक्रिय');
  const [ueOutcomeDate, setUeOutcomeDate] = useState('');
  const [ueNotes, setUeNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  const effectiveSubcentre = scopedSubcentre || subcentreFilter;
  const today = getTodayIST();
  const canModify = Boolean(
    currentUser && ['ADMIN', 'MEDICAL_OFFICER', 'DATA_OPERATOR', 'CHO', 'ANM'].includes(currentUser.role)
  );
  const aadhaarAuthorized = canViewFullAadhaar(currentUser?.role);

  const episodesByBen = useMemo(() => {
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

  const servicesByBen = useMemo(() => {
    const map = new Map<string, NonNullable<typeof db>['maternalServiceRecords']>();
    if (!db) return map;
    for (const r of db.maternalServiceRecords) {
      const arr = map.get(r.beneficiaryId) || [];
      arr.push(r);
      map.set(r.beneficiaryId, arr);
    }
    return map;
  }, [db]);

  const baseWomen = useMemo(() => {
    if (!db) return [];
    return db.beneficiaries
      .filter((b) => (b.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN')
      .filter((b) => !effectiveSubcentre || b.subcentreId === effectiveSubcentre)
      .filter((b) => !villageFilter || b.villageId === villageFilter)
      .filter((b) => {
        if (!statusFilter) return true;
        const eps = episodesByBen.get(b.id) || [];
        const activeOrLatest = eps[0];
        return Boolean(activeOrLatest && activeOrLatest.pregnancyStatus === statusFilter);
      });
  }, [db, effectiveSubcentre, villageFilter, statusFilter, episodesByBen]);

  const getWomanSearchFields = (b: Beneficiary) => {
    const eps = episodesByBen.get(b.id) || [];
    const epFields = eps.flatMap((ep) => [
      ep.episodeCode,
      ep.mcDate,
      formatDDMMYYYY(ep.mcDate),
      ep.eddDate,
      formatDDMMYYYY(ep.eddDate),
      ep.hospitalName,
    ]);
    return [
      b.childName,
      b.beneficiaryCode,
      b.guardianName || b.fatherName,
      b.mobile,
      b.villageName,
      ...epFields,
    ];
  };

  const filteredWomen = useMemo(() => {
    return fuzzyFilterAndRank(baseWomen, search, getWomanSearchFields);
  }, [baseWomen, search, episodesByBen]);

  if (!db) return null;

  const filterVillages = db.villages.filter(
    (v) => v.isActive && (!effectiveSubcentre || v.subcentreId === effectiveSubcentre)
  );
  const newFormVillages = db.villages.filter(
    (v) =>
      v.isActive &&
      (scopedSubcentre
        ? v.subcentreId === scopedSubcentre
        : !nSubcentreId || v.subcentreId === nSubcentreId)
  );
  const editFormVillages = db.villages.filter(
    (v) => v.isActive && v.subcentreId === eSubcentreId
  );

  const openEditProfile = (b: Beneficiary) => {
    setEditWoman(b);
    setEFullName(b.childName);
    setEHusbandName(b.guardianName || b.fatherName || '');
    setEMobile(b.mobile);
    setEAadhaar(b.aadhaarNumber || '');
    setECaste(b.caste || '');
    setECategory(b.category || CASTE_CATEGORIES[0]);
    setESubcentreId(b.subcentreId);
    setEVillageId(b.villageId);
    setEAddress(b.address || '');
    setEStatus(b.status);
  };

  const openNewEpisodeModal = (b: Beneficiary) => {
    setNewEpisodeForWoman(b);
    setEpMcDate('');
    setEpEddDate('');
    setEpDeliveryPlace(b.villageName);
    setEpFacilityType('Government');
    setEpHospitalName('');
    setEpRegDate(getTodayIST());
    setEpGravida('');
    setEpNotes('');
  };

  const openEditEpisodeModal = (ep: PregnancyEpisode) => {
    setEditEpisode(ep);
    setUeMcDate(ep.mcDate);
    setUeEddDate(ep.eddDate);
    setUePlace(ep.expectedDeliveryPlace);
    setUeFacility(ep.deliveryFacilityType);
    setUeHospital(ep.hospitalName);
    setUeStatus(ep.pregnancyStatus);
    setUeOutcomeDate(ep.outcomeDate || '');
    setUeNotes(ep.notes || '');
  };

  const handleCreateNewWoman = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nSubcentreId || !nVillageId) {
      setToast({ msg: 'कृपया उपकेंद्र आणि गाव निवडा.', type: 'error' });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(nMobile.trim())) {
      setToast({ msg: 'कृपया वैध १० अंकी मोबाईल क्रमांक प्रविष्ट करा.', type: 'error' });
      return;
    }
    const sc = db.subcentres.find((s) => s.id === nSubcentreId);
    const vl = db.villages.find((v) => v.id === nVillageId);
    if (!sc || !vl) return;

    setBusy(true);
    try {
      const res = await registerBeneficiary(
        {
          beneficiaryType: 'PREGNANT_WOMAN',
          childName: nFullName.trim(),
          motherName: nFullName.trim(),
          fatherName: nHusbandName.trim(),
          guardianName: nHusbandName.trim(),
          dob: '',
          gender: 'स्त्री',
          mobile: nMobile.trim(),
          aadhaarNumber: nAadhaar.trim(),
          caste: nCaste.trim(),
          category: nCategory,
          address: nAddress.trim() || vl.name,
          subcentreId: sc.id,
          subcentreName: sc.name,
          villageId: vl.id,
          villageName: vl.name,
          anganwadi: '',
          registrationDate: nRegDate,
          status: 'सक्रिय',
        },
        {
          mcDate: nMcDate,
          eddDate: nEddDate || calculateEddFromMcDate(nMcDate),
          expectedDeliveryPlace: nDeliveryPlace.trim() || vl.name,
          deliveryFacilityType: nFacilityType,
          hospitalName: nHospitalName.trim(),
          pregnancyRegistrationDate: nRegDate,
          pregnancyStatus: 'सक्रिय',
          gravidaPara: nGravida.trim(),
        }
      );
      setToast({
        msg: `गरोदर माता नोंदवली! माता आयडी: ${res.beneficiary.beneficiaryCode} · गर्भधारणा आयडी: ${res.episode?.episodeCode || '-'}`,
        type: 'success',
      });
      setNewModalOpen(false);
      setNFullName('');
      setNHusbandName('');
      setNMobile('');
      setNAadhaar('');
      setNCaste('');
      setNAddress('');
      setNMcDate('');
      setNEddDate('');
      setNDeliveryPlace('');
      setNHospitalName('');
      setNGravida('');
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'नोंदणी करताना त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEditWoman = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWoman) return;
    if (!/^[6-9]\d{9}$/.test(eMobile.trim())) {
      setToast({ msg: 'कृपया वैध १० अंकी मोबाईल क्रमांक प्रविष्ट करा.', type: 'error' });
      return;
    }
    const sc = db.subcentres.find((s) => s.id === eSubcentreId);
    const vl = db.villages.find((v) => v.id === eVillageId);
    if (!sc || !vl) return;

    setBusy(true);
    try {
      await updateBeneficiary(editWoman.id, {
        beneficiaryType: 'PREGNANT_WOMAN',
        childName: eFullName.trim(),
        fatherName: eHusbandName.trim(),
        guardianName: eHusbandName.trim(),
        mobile: eMobile.trim(),
        ...(aadhaarAuthorized ? { aadhaarNumber: eAadhaar.trim() } : {}),
        caste: eCaste.trim(),
        category: eCategory,
        subcentreId: sc.id,
        subcentreName: sc.name,
        villageId: vl.id,
        villageName: vl.name,
        address: eAddress.trim(),
        status: eStatus,
      });
      setToast({ msg: 'कायमस्वरूपी प्रोफाइल अद्यतनित झाले.', type: 'success' });
      setEditWoman(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveNewEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEpisodeForWoman) return;
    setBusy(true);
    try {
      const ep = await createPregnancyEpisode(newEpisodeForWoman, {
        mcDate: epMcDate,
        eddDate: epEddDate || calculateEddFromMcDate(epMcDate),
        expectedDeliveryPlace: epDeliveryPlace.trim(),
        deliveryFacilityType: epFacilityType,
        hospitalName: epHospitalName.trim(),
        pregnancyRegistrationDate: epRegDate,
        pregnancyStatus: 'सक्रिय',
        gravidaPara: epGravida.trim(),
        notes: epNotes.trim(),
      });
      setToast({
        msg: `नवीन गर्भधारणा प्रकरण (${ep.episodeCode}) जतन झाले.`,
        type: 'success',
      });
      setNewEpisodeForWoman(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEditEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEpisode) return;
    setBusy(true);
    try {
      await updatePregnancyEpisode(editEpisode.id, {
        mcDate: ueMcDate,
        eddDate: ueEddDate || calculateEddFromMcDate(ueMcDate),
        expectedDeliveryPlace: uePlace.trim(),
        deliveryFacilityType: ueFacility,
        hospitalName: ueHospital.trim(),
        pregnancyStatus: ueStatus,
        outcomeDate: ueOutcomeDate,
        notes: ueNotes.trim(),
      });
      setToast({ msg: 'गर्भधारणा प्रकरण तपशील अद्यतनित झाले.', type: 'success' });
      setEditEpisode(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadWomanPdf = async (womanId: string) => {
    setPdfBusyId(womanId);
    try {
      const preparedBy = currentUser ? `${currentUser.name} (${currentUser.role})` : 'PHC Bhada';
      await downloadBeneficiaryConsolidatedPDF(db, womanId, preparedBy);
      setToast({ msg: 'गरोदर मातेचे संपूर्ण रेकॉर्ड PDF डाउनलोड झाले.', type: 'success' });
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'PDF तयार करताना त्रुटी आली.',
        type: 'error',
      });
    } finally {
      setPdfBusyId('');
    }
  };

  return (
    <div className="app-page">
      <PageHeader
        title="गरोदर माता व्यवस्थापन (Pregnant Women)"
        subtitle="कायमस्वरूपी माता प्रोफाइल (एकदाच जतन), एकाधिक गर्भधारणा प्रकरणे (Episodes) व ANC इतिहास"
        actions={
          canModify ? (
            <button
              type="button"
              onClick={() => setNewModalOpen(true)}
              className="app-btn-primary text-xs"
            >
              <UserPlus className="w-4 h-4" /> नवीन गरोदर माता नोंदणी
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="app-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <FuzzyAutocomplete
          value={search}
          onChange={setSearch}
          items={baseWomen}
          getSearchFields={getWomanSearchFields}
          getOptionKey={(w) => w.id}
          getOptionLabel={(w) => w.childName}
          getOptionSublabel={(w) =>
            `पती: ${w.guardianName || w.fatherName || '-'} · ${w.villageName} · ${w.mobile}`
          }
          getOptionMeta={(w) => w.beneficiaryCode}
          onSelectItem={(w) => {
            setSearch(w.beneficiaryCode);
            setExpandedWomanId(w.id);
          }}
          placeholder="नाव, माता आयडी, पती, मोबाईल, MC/EDD..."
        />
        <select
          disabled={Boolean(scopedSubcentre)}
          value={effectiveSubcentre}
          onChange={(e) => {
            setSubcentreFilter(e.target.value);
            setVillageFilter('');
          }}
          className="app-input"
        >
          <option value="">सर्व उपकेंद्रे</option>
          {db.subcentres.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={villageFilter}
          onChange={(e) => setVillageFilter(e.target.value)}
          className="app-input"
        >
          <option value="">सर्व गावे</option>
          {filterVillages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="app-input"
        >
          <option value="">सर्व गर्भधारणा स्थिती</option>
          <option value="सक्रिय">सक्रिय</option>
          <option value="प्रसूती पूर्ण">प्रसूती पूर्ण</option>
          <option value="संदर्भित">संदर्भित</option>
          <option value="बंद">बंद</option>
        </select>
      </div>

      {/* Women List */}
      {filteredWomen.length === 0 ? (
        <div className="app-card">
          <EmptyState message="नोंदणीकृत गरोदर माता आढळल्या नाहीत. नवीन माता नोंदणी करा किंवा शोध बदला." />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWomen.map((woman) => {
            const episodes = episodesByBen.get(woman.id) || [];
            const activeEp =
              episodes.find((ep) => ep.pregnancyStatus === 'सक्रिय') || episodes[0] || null;
            const services = servicesByBen.get(woman.id) || [];
            const visitRows = groupMaternalVisitsByDate(services);
            const lastVisit = visitRows[0] || null;
            const showFullAadhaar = Boolean(revealedAadhaarIds[woman.id]) && aadhaarAuthorized;
            const isExpanded = expandedWomanId === woman.id;
            const latestHrpRec = activeEp
              ? db.highRiskRecords.find((h) => h.pregnancyEpisodeId === activeEp.id)
              : undefined;
            const isWomanHighRisk = latestHrpRec
              ? latestHrpRec.isHighRisk === 'YES'
              : Boolean(activeEp?.isHighRisk);

            return (
              <div
                key={woman.id}
                className={`bg-white rounded-xl border overflow-hidden ${
                  isWomanHighRisk ? 'border-rose-400' : 'border-slate-200'
                }`}
              >
                <div className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <HeartPulse className="w-4 h-4 text-teal-700 shrink-0" />
                      <span className="text-base font-bold text-slate-900">{woman.childName}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono-tabular text-xs font-semibold text-teal-800">
                        {woman.beneficiaryCode}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs font-medium text-slate-600">
                        नोंदणी: {formatDDMMYYYY(woman.registrationDate)}
                      </span>
                      {isWomanHighRisk && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                          <ShieldAlert className="w-3.5 h-3.5" /> HIGH RISK
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        पतीचे नाव: <strong>{woman.guardianName || woman.fatherName || '-'}</strong>
                      </span>
                      <span>
                        मोबाईल: <strong className="font-mono-tabular">{woman.mobile}</strong>
                      </span>
                      <span>
                        आधार:{' '}
                        <strong className="font-mono-tabular">
                          {showFullAadhaar && woman.aadhaarNumber
                            ? woman.aadhaarNumber
                            : maskAadhaar(woman.aadhaarNumber)}
                        </strong>
                        {aadhaarAuthorized && woman.aadhaarNumber && (
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedAadhaarIds((p) => ({
                                ...p,
                                [woman.id]: !p[woman.id],
                              }))
                            }
                            className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-teal-700 hover:underline"
                          >
                            {showFullAadhaar ? (
                              <>
                                <EyeOff className="w-3 h-3" /> लपवा
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3" /> पहा
                              </>
                            )}
                          </button>
                        )}
                      </span>
                      <span>
                        जात / प्रवर्ग: <strong>{woman.caste || '-'}</strong> ({woman.category || '-'})
                      </span>
                      <span>
                        गाव: <strong>{woman.villageName}</strong> ({woman.subcentreName})
                      </span>
                      {woman.address && (
                        <span>
                          पत्ता: <strong>{woman.address}</strong>
                        </span>
                      )}
                    </div>

                    {activeEp && (
                      <div className="pt-2 border-t border-slate-100 text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="font-mono-tabular font-semibold text-teal-900">
                          सध्याचे प्रकरण: {activeEp.episodeCode} ({activeEp.pregnancyStatus})
                        </span>
                        <span>
                          MC दिनांक:{' '}
                          <strong className="font-mono-tabular">
                            {formatDDMMYYYY(activeEp.mcDate)}
                          </strong>{' '}
                          ({calculateGestationalAgeLabel(activeEp.mcDate, today)})
                        </span>
                        <span>
                          EDD (अपेक्षित प्रसूती):{' '}
                          <strong className="font-mono-tabular text-teal-800">
                            {formatDDMMYYYY(activeEp.eddDate)}
                          </strong>
                        </span>
                        <span>
                          अपेक्षित प्रसूती ठिकाण:{' '}
                          <strong>{activeEp.expectedDeliveryPlace || '-'}</strong> (
                          {formatDeliveryFacilityTypeMarathi(activeEp.deliveryFacilityType)}
                          {activeEp.hospitalName ? ` · ${activeEp.hospitalName}` : ''})
                        </span>
                      </div>
                    )}

                    {/* Default Visible Latest ANC Visit Summary */}
                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                      {lastVisit ? (
                        <>
                          <span className="font-semibold text-teal-800">
                            शेवटची ANC भेट ({formatNumberIN(visitRows.length)} भेटी):{' '}
                            <span className="font-mono-tabular">{formatDDMMYYYY(lastVisit.visitDate)}</span>
                          </span>
                          <span>
                            ANC तपासणी: <strong>{lastVisit.ancExam}</strong>
                          </span>
                          <span>
                            वजन: <strong className="font-mono-tabular">{lastVisit.weight}</strong>
                          </span>
                          <span>
                            उंची: <strong className="font-mono-tabular">{lastVisit.height}</strong>
                          </span>
                          <span>
                            Hb: <strong className="font-mono-tabular">{lastVisit.hb}</strong>
                          </span>
                          <span>
                            BP: <strong className="font-mono-tabular">{lastVisit.bp}</strong>
                          </span>
                          <span>
                            BSL: <strong className="font-mono-tabular">{lastVisit.bsl}</strong>
                          </span>
                          <span>
                            रक्त/लघवी: <strong>{lastVisit.bloodUrine}</strong>
                          </span>
                          {lastVisit.tdDoses !== '-' && (
                            <span>
                              Td: <strong>{lastVisit.tdDoses}</strong>
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500">
                          शेवटची ANC भेट: अद्याप ANC तपासणी नोंद नाही
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      to={`/pregnant-women/${woman.id}`}
                      className="app-btn-primary px-3 py-1.5 text-xs"
                    >
                      <HeartPulse className="w-3.5 h-3.5" /> ३६०° प्रोफाइल / ANC / प्रसूती
                    </Link>
                    <button
                      type="button"
                      disabled={pdfBusyId === woman.id}
                      onClick={() => handleDownloadWomanPdf(woman.id)}
                      className="app-btn-soft px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {pdfBusyId === woman.id ? 'PDF...' : 'संपूर्ण रेकॉर्ड PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedWomanId(isExpanded ? '' : woman.id)}
                      className="app-btn-secondary px-3 py-1.5 text-xs"
                    >
                      <History className="w-3.5 h-3.5" />
                      {isExpanded
                        ? 'तपशील बंद करा'
                        : `प्रकरणे (${formatNumberIN(episodes.length)}) व ANC इतिहास`}
                    </button>
                    {canModify && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditProfile(woman)}
                          className="app-btn-secondary px-3 py-1.5 text-xs"
                        >
                          <Edit className="w-3.5 h-3.5" /> प्रोफाइल दुरुस्ती
                        </button>
                        <button
                          type="button"
                          onClick={() => openNewEpisodeModal(woman)}
                          className="app-btn-primary px-3 py-1.5 text-xs"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> नवीन गर्भधारणा प्रकरण
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Pregnancy Episodes & ANC Visit History */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4 md:p-5 space-y-4">
                    <VitalsComparisonCard
                      records={services}
                      sessions={db.vaccinationSessions}
                      villages={db.villages}
                      title="मागील तपासणी व वाढ तुलना (वजन · उंची · Hb · BP · BSL)"
                    />

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-700" /> गर्भधारणा प्रकरणे (Pregnancy Episodes)
                      </h4>
                      {episodes.length === 0 ? (
                        <div className="text-xs text-slate-500">कोणतेही गर्भधारणा प्रकरण नोंदवलेले नाही.</div>
                      ) : (
                        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2 font-semibold">प्रकरण आयडी</th>
                                <th className="px-3 py-2 font-semibold">MC दिनांक</th>
                                <th className="px-3 py-2 font-semibold">EDD दिनांक</th>
                                <th className="px-3 py-2 font-semibold">प्रसूती ठिकाण व संस्था</th>
                                <th className="px-3 py-2 font-semibold">नोंदणी दि.</th>
                                <th className="px-3 py-2 font-semibold">स्थिती</th>
                                <th className="px-3 py-2 font-semibold text-right">दुरुस्ती</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {episodes.map((ep) => (
                                <tr key={ep.id}>
                                  <td className="px-3 py-2 font-mono-tabular font-semibold text-teal-800">
                                    {ep.episodeCode}
                                    {ep.gravidaPara && (
                                      <span className="ml-1 text-slate-500 font-sans">({ep.gravidaPara})</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 font-mono-tabular">{formatDDMMYYYY(ep.mcDate)}</td>
                                  <td className="px-3 py-2 font-mono-tabular font-semibold">{formatDDMMYYYY(ep.eddDate)}</td>
                                  <td className="px-3 py-2">
                                    {ep.expectedDeliveryPlace || '-'} ·{' '}
                                    {formatDeliveryFacilityTypeMarathi(ep.deliveryFacilityType)}
                                    {ep.hospitalName ? ` (${ep.hospitalName})` : ''}
                                  </td>
                                  <td className="px-3 py-2 font-mono-tabular">
                                    {formatDDMMYYYY(ep.pregnancyRegistrationDate)}
                                  </td>
                                  <td className="px-3 py-2 font-semibold">{ep.pregnancyStatus}</td>
                                  <td className="px-3 py-2 text-right">
                                    {canModify && (
                                      <button
                                        type="button"
                                        onClick={() => openEditEpisodeModal(ep)}
                                        className="text-teal-700 hover:underline font-medium"
                                      >
                                        अद्यतनित करा
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Baby className="w-3.5 h-3.5 text-teal-700" /> भेटनिहाय ANC तपासणी व लसीकरण तक्ता ({formatNumberIN(visitRows.length)} भेटी)
                      </h4>
                      {visitRows.length === 0 ? (
                        <div className="text-xs text-slate-500">अद्याप कोणतीही ANC सेवा नोंदवलेली नाही.</div>
                      ) : (
                        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2 font-semibold">भेट दिनांक</th>
                                <th className="px-3 py-2 font-semibold">प्रकरण</th>
                                <th className="px-3 py-2 font-semibold">ANC तपासणी</th>
                                <th className="px-3 py-2 font-semibold">वजन</th>
                                <th className="px-3 py-2 font-semibold">उंची</th>
                                <th className="px-3 py-2 font-semibold">Hb</th>
                                <th className="px-3 py-2 font-semibold">BP</th>
                                <th className="px-3 py-2 font-semibold">BSL</th>
                                <th className="px-3 py-2 font-semibold">रक्त/लघवी</th>
                                <th className="px-3 py-2 font-semibold">Td लस</th>
                                <th className="px-3 py-2 font-semibold">IFA / कॅल्शियम</th>
                                <th className="px-3 py-2 font-semibold">कर्मचारी</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {visitRows.map((vr) => (
                                <tr key={vr.visitKey}>
                                  <td className="px-3 py-2 font-mono-tabular font-semibold whitespace-nowrap">
                                    {formatDDMMYYYY(vr.visitDate)}
                                  </td>
                                  <td className="px-3 py-2 font-mono-tabular text-teal-800">
                                    {vr.episodeCode}
                                  </td>
                                  <td className="px-3 py-2">{vr.ancExam}</td>
                                  <td className="px-3 py-2 font-mono-tabular">{vr.weight}</td>
                                  <td className="px-3 py-2 font-mono-tabular">{vr.height}</td>
                                  <td className="px-3 py-2 font-mono-tabular">{vr.hb}</td>
                                  <td className="px-3 py-2 font-mono-tabular">{vr.bp}</td>
                                  <td className="px-3 py-2 font-mono-tabular">{vr.bsl}</td>
                                  <td className="px-3 py-2">{vr.bloodUrine}</td>
                                  <td className="px-3 py-2">{vr.tdDoses}</td>
                                  <td className="px-3 py-2">{vr.supplements}</td>
                                  <td className="px-3 py-2">{vr.staffNames}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: NEW PREGNANT WOMAN + FIRST PREGNANCY EPISODE */}
      {newModalOpen && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <form
            onSubmit={handleCreateNewWoman}
            className="app-modal max-w-4xl max-h-[92vh] overflow-y-auto p-5 md:p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">नवीन गरोदर माता नोंदणी</h3>
                <p className="text-xs text-slate-500">
                  कायमस्वरूपी माता प्रोफाइल व सध्याचे गर्भधारणा प्रकरण प्रणालीत जतन होईल
                </p>
              </div>
              <button type="button" onClick={() => setNewModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wide">
                १. कायमस्वरूपी माता प्रोफाइल (एकदाच जतन होईल)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">मातेचे पूर्ण नाव *</label>
                  <input required value={nFullName} onChange={(e) => setNFullName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">पतीचे पूर्ण नाव *</label>
                  <input required value={nHusbandName} onChange={(e) => setNHusbandName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">मोबाईल क्रमांक *</label>
                  <input required maxLength={10} value={nMobile} onChange={(e) => setNMobile(e.target.value)} placeholder="१० अंकी क्रमांक" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">आधार क्रमांक (ऐच्छिक — सुरक्षित राहील)</label>
                  <input maxLength={12} value={nAadhaar} onChange={(e) => setNAadhaar(e.target.value)} placeholder="१२ अंकी आधार (ऐच्छिक)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">जात (Caste)</label>
                  <input value={nCaste} onChange={(e) => setNCaste(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">प्रवर्ग (Category)</label>
                  <select value={nCategory} onChange={(e) => setNCategory(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    {CASTE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <SearchableSelect
                  label="उपकेंद्र"
                  required
                  disabled={Boolean(scopedSubcentre)}
                  value={nSubcentreId}
                  onChange={(val) => {
                    setNSubcentreId(val);
                    setNVillageId('');
                  }}
                  options={db.subcentres.filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))}
                />
                <SearchableSelect
                  label="गाव (निवडल्यास उपकेंद्र आपोआप निवडले जाईल)"
                  required
                  value={nVillageId}
                  onChange={(val) => {
                    setNVillageId(val);
                    const matchedVillage = db.villages.find((v) => v.id === val);
                    if (matchedVillage && !scopedSubcentre) {
                      setNSubcentreId(matchedVillage.subcentreId);
                    }
                  }}
                  options={newFormVillages.map((v) => ({
                    value: v.id,
                    label: v.name,
                    sublabel: v.subcentreName,
                  }))}
                />
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">नोंदणी दिनांक *</label>
                  <input type="date" required value={nRegDate} onChange={(e) => setNRegDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">संपूर्ण पत्ता *</label>
                  <input required value={nAddress} onChange={(e) => setNAddress(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wide">
                २. गर्भधारणा प्रकरण तपशील (Pregnancy Episode)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">MC दिनांक (LMP) *</label>
                  <input
                    type="date"
                    required
                    value={nMcDate}
                    onChange={(e) => {
                      const mc = e.target.value;
                      setNMcDate(mc);
                      setNEddDate(calculateEddFromMcDate(mc));
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">EDD (अपेक्षित प्रसूती दिनांक) *</label>
                  <input type="date" required value={nEddDate} onChange={(e) => setNEddDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">प्रसूती अपेक्षित ठिकाण *</label>
                  <input required value={nDeliveryPlace} onChange={(e) => setNDeliveryPlace(e.target.value)} placeholder="उदा. भादा / लातूर" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">रुग्णालय प्रकार *</label>
                  <select value={nFacilityType} onChange={(e) => setNFacilityType(e.target.value as DeliveryFacilityType)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="Government">शासकीय (Government)</option>
                    <option value="Private">खाजगी (Private)</option>
                    <option value="Other">इतर (Other)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">रुग्णालयाचे नाव</label>
                  <input value={nHospitalName} onChange={(e) => setNHospitalName(e.target.value)} placeholder="उदा. PHC भादा / उपजिल्हा रुग्णालय" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">गर्भधारणा क्रमांक (Gravida/Para)</label>
                  <input value={nGravida} onChange={(e) => setNGravida(e.target.value)} placeholder="उदा. G1 P0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" disabled={busy} onClick={() => setNewModalOpen(false)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">रद्द करा</button>
              <button type="submit" disabled={busy} className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60">
                {busy ? 'जतन होत आहे...' : 'माता व गर्भधारणा नोंदणी जतन करा'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT PERMANENT PROFILE */}
      {editWoman && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveEditWoman} className="app-modal max-w-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                कायमस्वरूपी प्रोफाइल दुरुस्ती ({editWoman.beneficiaryCode})
              </h3>
              <button type="button" onClick={() => setEditWoman(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">पूर्ण नाव *</label>
                <input required value={eFullName} onChange={(e) => setEFullName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">पतीचे नाव *</label>
                <input required value={eHusbandName} onChange={(e) => setEHusbandName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">मोबाईल क्रमांक *</label>
                <input required maxLength={10} value={eMobile} onChange={(e) => setEMobile(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  आधार क्रमांक {aadhaarAuthorized ? '(Admin/MO अधिकार)' : '(संरक्षित — संपादन मर्यादित)'}
                </label>
                {aadhaarAuthorized ? (
                  <input maxLength={12} value={eAadhaar} onChange={(e) => setEAadhaar(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
                ) : (
                  <input disabled value={maskAadhaar(editWoman.aadhaarNumber)} className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm font-mono-tabular text-slate-600" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">जात</label>
                <input value={eCaste} onChange={(e) => setECaste(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">प्रवर्ग</label>
                <select value={eCategory} onChange={(e) => setECategory(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {CASTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">उपकेंद्र *</label>
                <select value={eSubcentreId} onChange={(e) => { setESubcentreId(e.target.value); setEVillageId(''); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {db.subcentres.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">गाव *</label>
                <select required value={eVillageId} onChange={(e) => setEVillageId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">-- गाव निवडा --</option>
                  {editFormVillages.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">संपूर्ण पत्ता</label>
                <input value={eAddress} onChange={(e) => setEAddress(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" disabled={busy} onClick={() => setEditWoman(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">रद्द करा</button>
              <button type="submit" disabled={busy} className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60">
                {busy ? 'जतन होत आहे...' : 'बदल जतन करा'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD NEW PREGNANCY EPISODE FOR EXISTING WOMAN */}
      {newEpisodeForWoman && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveNewEpisode} className="app-modal max-w-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  नवीन गर्भधारणा प्रकरण जोडा ({newEpisodeForWoman.childName})
                </h3>
                <p className="text-xs text-slate-500">
                  मूळ कायमस्वरूपी आयडी ({newEpisodeForWoman.beneficiaryCode}) व जुना इतिहास सुरक्षित राहील
                </p>
              </div>
              <button type="button" onClick={() => setNewEpisodeForWoman(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">MC दिनांक (LMP) *</label>
                <input
                  type="date"
                  required
                  value={epMcDate}
                  onChange={(e) => {
                    const mc = e.target.value;
                    setEpMcDate(mc);
                    setEpEddDate(calculateEddFromMcDate(mc));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">EDD दिनांक *</label>
                <input type="date" required value={epEddDate} onChange={(e) => setEpEddDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">प्रसूती अपेक्षित ठिकाण *</label>
                <input required value={epDeliveryPlace} onChange={(e) => setEpDeliveryPlace(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">रुग्णालय प्रकार *</label>
                <select value={epFacilityType} onChange={(e) => setEpFacilityType(e.target.value as DeliveryFacilityType)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="Government">शासकीय (Government)</option>
                  <option value="Private">खाजगी (Private)</option>
                  <option value="Other">इतर (Other)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">रुग्णालयाचे नाव</label>
                <input value={epHospitalName} onChange={(e) => setEpHospitalName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">गर्भधारणा नोंदणी दिनांक *</label>
                <input type="date" required value={epRegDate} onChange={(e) => setEpRegDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">गर्भधारणा क्रमांक (Gravida/Para)</label>
                <input value={epGravida} onChange={(e) => setEpGravida(e.target.value)} placeholder="उदा. G2 P1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">नोंद / शेरा</label>
                <input value={epNotes} onChange={(e) => setEpNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" disabled={busy} onClick={() => setNewEpisodeForWoman(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">रद्द करा</button>
              <button type="submit" disabled={busy} className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60">
                {busy ? 'जतन होत आहे...' : 'नवीन गर्भधारणा प्रकरण जतन करा'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: UPDATE EXISTING PREGNANCY EPISODE */}
      {editEpisode && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveEditEpisode} className="app-modal max-w-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                गर्भधारणा प्रकरण अद्यतनित करा ({editEpisode.episodeCode})
              </h3>
              <button type="button" onClick={() => setEditEpisode(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">MC दिनांक *</label>
                <input
                  type="date"
                  required
                  value={ueMcDate}
                  onChange={(e) => {
                    setUeMcDate(e.target.value);
                    setUeEddDate(calculateEddFromMcDate(e.target.value));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">EDD दिनांक *</label>
                <input type="date" required value={ueEddDate} onChange={(e) => setUeEddDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">अपेक्षित प्रसूती ठिकाण</label>
                <input value={uePlace} onChange={(e) => setUePlace(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">रुग्णालय प्रकार</label>
                <select value={ueFacility} onChange={(e) => setUeFacility(e.target.value as DeliveryFacilityType)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="Government">शासकीय (Government)</option>
                  <option value="Private">खाजगी (Private)</option>
                  <option value="Other">इतर (Other)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">रुग्णालयाचे नाव</label>
                <input value={ueHospital} onChange={(e) => setUeHospital(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">गर्भधारणा स्थिती *</label>
                <select value={ueStatus} onChange={(e) => setUeStatus(e.target.value as PregnancyStatus)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="सक्रिय">सक्रिय</option>
                  <option value="प्रसूती पूर्ण">प्रसूती पूर्ण</option>
                  <option value="संदर्भित">संदर्भित</option>
                  <option value="बंद">बंद</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">प्रसूती / पूर्ण दिनांक (ऐच्छिक)</label>
                <input type="date" value={ueOutcomeDate} onChange={(e) => setUeOutcomeDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">शेरा</label>
                <input value={ueNotes} onChange={(e) => setUeNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" disabled={busy} onClick={() => setEditEpisode(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">रद्द करा</button>
              <button type="submit" disabled={busy} className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60">
                {busy ? 'जतन होत आहे...' : 'अद्यतन जतन करा'}
              </button>
            </div>
          </form>
        </div>
      )}

      <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: 'success' })} />
    </div>
  );
};
