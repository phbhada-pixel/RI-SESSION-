import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit,
  FileSpreadsheet,
  Lock,
  PlusCircle,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import {
  RiChecklist,
  RiLogisticAvailability,
  RiVaccineStatusEntry,
} from '../types';
import { formatDDMMYYYY, getSessionEditStatus, getTodayIST } from '../utils/dateUtils';
import { formatNumberIN } from '../utils/localeUtils';
import {
  RI_4_KEY_MESSAGES,
  RI_CAREGIVER_MOBILIZERS,
  RI_HRA_TYPES,
  RI_HUB_CUTTER_NO_REASONS,
  RI_LOGISTIC_ITEMS,
  RI_MOBILIZER_OPTIONS,
  RI_MONITORING_REASONS,
  RI_RECONSTITUTED_VIALS,
  RI_SESSION_NOT_HELD_REASONS,
  RI_VACCINE_ITEMS,
  buildDefaultRiLogistics,
  buildDefaultRiVaccines,
  computeRiChecklistCounts,
  downloadRiChecklistPDF,
  exportRiChecklistExcel,
} from '../utils/riChecklistUtils';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';

type ViewTab = 'FORM' | 'HISTORY';

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export const RiChecklistPage: React.FC = () => {
  const { db, currentUser, saveRiChecklist } = useSheetData();
  const [params] = useSearchParams();
  const preselectedSessionId = params.get('sessionId') || '';

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';

  const [viewTab, setViewTab] = useState<ViewTab>('FORM');
  const [editItem, setEditItem] = useState<RiChecklist | null>(null);

  // Header & Site Metadata
  const [sessionId, setSessionId] = useState(preselectedSessionId);
  const [checklistStaffName, setChecklistStaffName] = useState(currentUser?.name || '');
  const [monitorName, setMonitorName] = useState(currentUser?.name || '');
  const [organization, setOrganization] = useState<RiChecklist['organization']>('Govt');
  const [organizationOther, setOrganizationOther] = useState('');
  const [designation, setDesignation] = useState(currentUser?.role || '');
  const [monitoringDate, setMonitoringDate] = useState(getTodayIST());
  const [stateName, setStateName] = useState('महाराष्ट्र');
  const [district, setDistrict] = useState('लातूर');
  const [blockUlb, setBlockUlb] = useState('औसा');
  const [planningUnit, setPlanningUnit] = useState('प्राथमिक आरोग्य केंद्र भादा');
  const [setting, setSetting] = useState<RiChecklist['setting']>('Rural');
  const [subcentreId, setSubcentreId] = useState(scopedSubcentre);
  const [villageId, setVillageId] = useState('');
  const [sessionSiteName, setSessionSiteName] = useState('');
  const [monitoringReasons, setMonitoringReasons] = useState<string[]>([]);
  const [monitoringReasonOther, setMonitoringReasonOther] = useState('');
  const [hraType, setHraType] = useState('');
  const [sessionSiteLocation, setSessionSiteLocation] =
    useState<RiChecklist['sessionSiteLocation']>('ICDS Centre');
  const [sessionSiteLocationOther, setSessionSiteLocationOther] = useState('');

  // Q1
  const [isSessionHeld, setIsSessionHeld] = useState<'Yes' | 'No'>('Yes');
  const [sessionNotHeldReason, setSessionNotHeldReason] = useState('');
  const [sessionNotHeldReasonOther, setSessionNotHeldReasonOther] = useState('');

  // Q2-Q7
  const [dueListAvailable, setDueListAvailable] =
    useState<RiChecklist['dueListAvailable']>('Updated list');
  const [mobilizersAssigned, setMobilizersAssigned] = useState<string[]>(['ASHA']);
  const [dueListWithMobiliser, setDueListWithMobiliser] =
    useState<RiChecklist['dueListWithMobiliser']>('Yes');
  const [mobilizerMobilizing, setMobilizerMobilizing] =
    useState<RiChecklist['mobilizerMobilizing']>('Yes');
  const [polioHraTagged, setPolioHraTagged] = useState<RiChecklist['polioHraTagged']>('No');
  const [vaccineDeliveredBy, setVaccineDeliveredBy] =
    useState<RiChecklist['vaccineDeliveredBy']>('ANM');
  const [vaccineCarrierName, setVaccineCarrierName] = useState('');

  // Q8 & Q9
  const [vaccines, setVaccines] = useState<Record<string, RiVaccineStatusEntry>>(() =>
    buildDefaultRiVaccines()
  );
  const [logistics, setLogistics] = useState<Record<string, RiLogisticAvailability>>(() =>
    buildDefaultRiLogistics()
  );

  // Q10-Q15
  const [cuttingWithHubCutter, setCuttingWithHubCutter] =
    useState<RiChecklist['cuttingWithHubCutter']>('Yes');
  const [hubCutterNoReason, setHubCutterNoReason] = useState('');
  const [markingVialsDateTime, setMarkingVialsDateTime] =
    useState<RiChecklist['markingVialsDateTime']>('Yes');
  const [reconstitutedVialAfterLapsed, setReconstitutedVialAfterLapsed] = useState<string[]>([
    'None',
  ]);
  const [delivering4KeyMessages, setDelivering4KeyMessages] =
    useState<RiChecklist['delivering4KeyMessages']>('Yes');
  const [advisingWait30Mins, setAdvisingWait30Mins] =
    useState<RiChecklist['advisingWait30Mins']>('Yes');
  const [caregiverInterviewNotObserved, setCaregiverInterviewNotObserved] = useState(false);
  const [caregiver1Mobilizer, setCaregiver1Mobilizer] = useState<string[]>(['ASHA']);
  const [caregiver2Mobilizer, setCaregiver2Mobilizer] = useState<string[]>(['ASHA']);
  const [caregiver3Mobilizer, setCaregiver3Mobilizer] = useState<string[]>(['ASHA']);

  // Q16-Q20
  const [minAge2ndMeasles, setMinAge2ndMeasles] =
    useState<RiChecklist['minAge2ndMeasles']>('16-24m');
  const [mctsRegisterMaintained, setMctsRegisterMaintained] =
    useState<RiChecklist['mctsRegisterMaintained']>('Yes');
  const [supervisorVisitedToday, setSupervisorVisitedToday] =
    useState<RiChecklist['supervisorVisitedToday']>('None');
  const [supervisorVisitedOther, setSupervisorVisitedOther] = useState('');
  const [ashaPaymentPreviousSession, setAshaPaymentPreviousSession] =
    useState<RiChecklist['ashaPaymentPreviousSession']>('Yes');
  const [ashaPaymentFI, setAshaPaymentFI] = useState<RiChecklist['ashaPaymentFI']>('Yes');
  const [ashaPaymentCI, setAshaPaymentCI] = useState<RiChecklist['ashaPaymentCI']>('Yes');

  // Q21-Q22
  const [vaccineNotAvailableReason, setVaccineNotAvailableReason] =
    useState<RiChecklist['vaccineNotAvailableReason']>('');
  const [vaccineNotAvailableOther, setVaccineNotAvailableOther] = useState('');
  const [anmAbsentReason, setAnmAbsentReason] = useState<RiChecklist['anmAbsentReason']>('');
  const [anmAbsentOther, setAnmAbsentOther] = useState('');
  const [remarks, setRemarks] = useState('');

  // History filters & UI feedback
  const [historyFilterSc, setHistoryFilterSc] = useState('');
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  // Sync defaults from SystemSettings when loaded
  useEffect(() => {
    if (!db || editItem) return;
    const cfg = db.systemSettings[0];
    if (cfg) {
      setStateName(cfg.state || 'महाराष्ट्र');
      setDistrict(cfg.district || 'लातूर');
      setPlanningUnit(cfg.phcName || 'प्राथमिक आरोग्य केंद्र भादा');
    }
  }, [db, editItem]);

  // Apply sessionId auto-fill if preselected or changed
  const applySessionPrefill = (sid: string) => {
    setSessionId(sid);
    if (!db || !sid) return;
    const ses = db.vaccinationSessions.find((s) => s.id === sid);
    if (!ses) return;
    setMonitoringDate(ses.sessionDate);
    setSubcentreId(ses.subcentreId);
    setVillageId(ses.villageId);
    setSessionSiteName(`${ses.villageName} (${ses.location})`);
    if (ses.location.toLowerCase().includes('sub') || ses.location.includes('उपकेंद्र')) {
      setSessionSiteLocation('Sub Centre');
    } else if (ses.location.includes('अंगणवाडी') || ses.location.toLowerCase().includes('icds')) {
      setSessionSiteLocation('ICDS Centre');
    }
    if (ses.anmName) {
      setVaccineDeliveredBy('ANM');
      setVaccineCarrierName(ses.anmName);
    }
    if (!checklistStaffName.trim()) {
      setChecklistStaffName(currentUser?.name || ses.choName || ses.anmName || '');
    }
  };

  useEffect(() => {
    if (preselectedSessionId && db && !editItem) {
      applySessionPrefill(preselectedSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedSessionId, db]);

  const visibleSessions = useMemo(() => {
    if (!db) return [];
    return scopedSubcentre
      ? db.vaccinationSessions.filter((s) => s.subcentreId === scopedSubcentre)
      : db.vaccinationSessions;
  }, [db, scopedSubcentre]);

  const filteredVillages = useMemo(() => {
    if (!db) return [];
    return subcentreId
      ? db.villages.filter((v) => v.isActive && v.subcentreId === subcentreId)
      : db.villages.filter((v) => v.isActive);
  }, [db, subcentreId]);

  const visibleChecklists = useMemo(() => {
    if (!db) return [];
    return db.riChecklists
      .filter((c) => !scopedSubcentre || c.subcentreId === scopedSubcentre)
      .filter((c) => !historyFilterSc || c.subcentreId === historyFilterSc);
  }, [db, scopedSubcentre, historyFilterSc]);

  const activeStaffOptions = useMemo(() => {
    if (!db) return [];
    const active = db.staff.filter((s) => s.isActive);
    if (!subcentreId) return active;
    return [
      ...active.filter((s) => s.subcentreId === subcentreId),
      ...active.filter((s) => s.subcentreId !== subcentreId),
    ];
  }, [db, subcentreId]);

  const checklistBySessionId = useMemo(() => {
    const map = new Map<string, RiChecklist>();
    if (!db) return map;
    for (const c of db.riChecklists) {
      if (c.sessionId && !map.has(c.sessionId)) {
        map.set(c.sessionId, c);
      }
    }
    return map;
  }, [db]);

  const existingChecklistForSelectedSession = useMemo(() => {
    if (editItem || !sessionId) return null;
    return checklistBySessionId.get(sessionId) || null;
  }, [editItem, sessionId, checklistBySessionId]);

  const selectedLinkedSession = useMemo(() => {
    if (!db || !sessionId) return null;
    return db.vaccinationSessions.find((s) => s.id === sessionId) || null;
  }, [db, sessionId]);

  const isLinkedSessionClosed = Boolean(
    selectedLinkedSession && !getSessionEditStatus(selectedLinkedSession).isOpen
  );

  if (!db) return null;

  const resetForm = () => {
    setEditItem(null);
    setSessionId('');
    setChecklistStaffName(currentUser?.name || '');
    setMonitorName(currentUser?.name || '');
    setOrganization('Govt');
    setOrganizationOther('');
    setDesignation(currentUser?.role || '');
    setMonitoringDate(getTodayIST());
    setSetting('Rural');
    setSubcentreId(scopedSubcentre);
    setVillageId('');
    setSessionSiteName('');
    setMonitoringReasons([]);
    setMonitoringReasonOther('');
    setHraType('');
    setSessionSiteLocation('ICDS Centre');
    setSessionSiteLocationOther('');
    setIsSessionHeld('Yes');
    setSessionNotHeldReason('');
    setSessionNotHeldReasonOther('');
    setDueListAvailable('Updated list');
    setMobilizersAssigned(['ASHA']);
    setDueListWithMobiliser('Yes');
    setMobilizerMobilizing('Yes');
    setPolioHraTagged('No');
    setVaccineDeliveredBy('ANM');
    setVaccineCarrierName('');
    setVaccines(buildDefaultRiVaccines());
    setLogistics(buildDefaultRiLogistics());
    setCuttingWithHubCutter('Yes');
    setHubCutterNoReason('');
    setMarkingVialsDateTime('Yes');
    setReconstitutedVialAfterLapsed(['None']);
    setDelivering4KeyMessages('Yes');
    setAdvisingWait30Mins('Yes');
    setCaregiverInterviewNotObserved(false);
    setCaregiver1Mobilizer(['ASHA']);
    setCaregiver2Mobilizer(['ASHA']);
    setCaregiver3Mobilizer(['ASHA']);
    setMinAge2ndMeasles('16-24m');
    setMctsRegisterMaintained('Yes');
    setSupervisorVisitedToday('None');
    setSupervisorVisitedOther('');
    setAshaPaymentPreviousSession('Yes');
    setAshaPaymentFI('Yes');
    setAshaPaymentCI('Yes');
    setVaccineNotAvailableReason('');
    setVaccineNotAvailableOther('');
    setAnmAbsentReason('');
    setAnmAbsentOther('');
    setRemarks('');
  };

  const loadForEdit = (c: RiChecklist) => {
    const linked = c.sessionId
      ? db.vaccinationSessions.find((s) => s.id === c.sessionId) || null
      : null;
    if (linked && !getSessionEditStatus(linked).isOpen) {
      setToast({
        msg: `संलग्न सत्र (${linked.sessionCode}) बंद/पूर्ण झाल्यामुळे या चेकलिस्टमध्ये संपादन बंद आहे.`,
        type: 'error',
      });
      return;
    }
    setEditItem(c);
    setSessionId(c.sessionId || '');
    setChecklistStaffName(c.checklistStaffName || c.monitorName || c.createdBy || '');
    setMonitorName(c.monitorName);
    setOrganization(c.organization);
    setOrganizationOther(c.organizationOther || '');
    setDesignation(c.designation);
    setMonitoringDate(c.monitoringDate);
    setStateName(c.state);
    setDistrict(c.district);
    setBlockUlb(c.blockUlb);
    setPlanningUnit(c.planningUnit);
    setSetting(c.setting);
    setSubcentreId(c.subcentreId);
    setVillageId(c.villageId);
    setSessionSiteName(c.sessionSiteName);
    setMonitoringReasons(c.monitoringReasons || []);
    setMonitoringReasonOther(c.monitoringReasonOther || '');
    setHraType(c.hraType || '');
    setSessionSiteLocation(c.sessionSiteLocation);
    setSessionSiteLocationOther(c.sessionSiteLocationOther || '');
    setIsSessionHeld(c.isSessionHeld);
    setSessionNotHeldReason(c.sessionNotHeldReason || '');
    setSessionNotHeldReasonOther(c.sessionNotHeldReasonOther || '');
    setDueListAvailable(c.dueListAvailable);
    setMobilizersAssigned(c.mobilizersAssigned || []);
    setDueListWithMobiliser(c.dueListWithMobiliser);
    setMobilizerMobilizing(c.mobilizerMobilizing);
    setPolioHraTagged(c.polioHraTagged);
    setVaccineDeliveredBy(c.vaccineDeliveredBy);
    setVaccineCarrierName(c.vaccineCarrierName || '');
    setVaccines({ ...buildDefaultRiVaccines(), ...(c.vaccines || {}) });
    setLogistics({ ...buildDefaultRiLogistics(), ...(c.logistics || {}) });
    setCuttingWithHubCutter(c.cuttingWithHubCutter);
    setHubCutterNoReason(c.hubCutterNoReason || '');
    setMarkingVialsDateTime(c.markingVialsDateTime);
    setReconstitutedVialAfterLapsed(
      c.reconstitutedVialAfterLapsed?.length ? c.reconstitutedVialAfterLapsed : ['None']
    );
    setDelivering4KeyMessages(c.delivering4KeyMessages);
    setAdvisingWait30Mins(c.advisingWait30Mins);
    setCaregiverInterviewNotObserved(c.caregiverInterviewNotObserved);
    setCaregiver1Mobilizer(c.caregiver1Mobilizer || []);
    setCaregiver2Mobilizer(c.caregiver2Mobilizer || []);
    setCaregiver3Mobilizer(c.caregiver3Mobilizer || []);
    setMinAge2ndMeasles(c.minAge2ndMeasles);
    setMctsRegisterMaintained(c.mctsRegisterMaintained);
    setSupervisorVisitedToday(c.supervisorVisitedToday);
    setSupervisorVisitedOther(c.supervisorVisitedOther || '');
    setAshaPaymentPreviousSession(c.ashaPaymentPreviousSession);
    setAshaPaymentFI(c.ashaPaymentFI);
    setAshaPaymentCI(c.ashaPaymentCI);
    setVaccineNotAvailableReason(c.vaccineNotAvailableReason);
    setVaccineNotAvailableOther(c.vaccineNotAvailableOther || '');
    setAnmAbsentReason(c.anmAbsentReason);
    setAnmAbsentOther(c.anmAbsentOther || '');
    setRemarks(c.remarks || '');
    setViewTab('FORM');
  };

  const markAllVaccinesAdequate = () => {
    setVaccines((prev) => {
      const next = { ...prev };
      for (const v of RI_VACCINE_ITEMS) {
        next[v.code] = {
          availability: 'Adequate',
          ...(v.supportsOpenVial
            ? { openVialReissued: prev[v.code]?.openVialReissued || 'No' }
            : {}),
        };
      }
      return next;
    });
  };

  const markAllLogisticsAdequate = () => {
    setLogistics(() => {
      const next: Record<string, RiLogisticAvailability> = {};
      for (const l of RI_LOGISTIC_ITEMS) {
        next[l.code] = 'Adequate';
      }
      return next;
    });
  };

  const handleConfirmSave = async () => {
    const sc = db.subcentres.find((s) => s.id === subcentreId);
    const ses = db.vaccinationSessions.find((s) => s.id === sessionId);
    setBusy(true);
    try {
      const saved = await saveRiChecklist({
        id: editItem?.id,
        sessionId: ses?.id || '',
        sessionCode: ses?.sessionCode || '',
        checklistStaffName: checklistStaffName.trim(),
        monitorName: monitorName.trim(),
        organization,
        organizationOther: organizationOther.trim(),
        designation: designation.trim(),
        monitoringDate,
        state: stateName.trim(),
        district: district.trim(),
        blockUlb: blockUlb.trim(),
        planningUnit: planningUnit.trim(),
        setting,
        subcentreId,
        subcentreName: sc?.name || '',
        villageId,
        sessionSiteName: sessionSiteName.trim(),
        monitoringReasons,
        monitoringReasonOther: monitoringReasonOther.trim(),
        hraType,
        sessionSiteLocation,
        sessionSiteLocationOther: sessionSiteLocationOther.trim(),
        isSessionHeld,
        sessionNotHeldReason: isSessionHeld === 'No' ? sessionNotHeldReason : '',
        sessionNotHeldReasonOther: isSessionHeld === 'No' ? sessionNotHeldReasonOther.trim() : '',
        dueListAvailable,
        mobilizersAssigned,
        dueListWithMobiliser,
        mobilizerMobilizing,
        polioHraTagged,
        vaccineDeliveredBy,
        vaccineCarrierName: vaccineCarrierName.trim(),
        vaccines,
        logistics,
        cuttingWithHubCutter,
        hubCutterNoReason: cuttingWithHubCutter === 'No' ? hubCutterNoReason : '',
        markingVialsDateTime,
        reconstitutedVialAfterLapsed,
        delivering4KeyMessages,
        advisingWait30Mins,
        caregiverInterviewNotObserved,
        caregiver1Mobilizer: caregiverInterviewNotObserved ? [] : caregiver1Mobilizer,
        caregiver2Mobilizer: caregiverInterviewNotObserved ? [] : caregiver2Mobilizer,
        caregiver3Mobilizer: caregiverInterviewNotObserved ? [] : caregiver3Mobilizer,
        minAge2ndMeasles,
        mctsRegisterMaintained,
        supervisorVisitedToday,
        supervisorVisitedOther:
          supervisorVisitedToday === 'Others' ? supervisorVisitedOther.trim() : '',
        ashaPaymentPreviousSession,
        ashaPaymentFI,
        ashaPaymentCI,
        vaccineNotAvailableReason,
        vaccineNotAvailableOther:
          vaccineNotAvailableReason === 'Others' ? vaccineNotAvailableOther.trim() : '',
        anmAbsentReason,
        anmAbsentOther: anmAbsentReason === 'Others' ? anmAbsentOther.trim() : '',
        remarks: remarks.trim(),
      });
      setToast({
        msg: editItem
          ? `RI चेकलिस्ट (${saved.checklistCode}) अद्यतनित झाली.`
          : `नवीन RI चेकलिस्ट (${saved.checklistCode}) जतन झाली.`,
        type: 'success',
      });
      setConfirmSaveOpen(false);
      resetForm();
      setViewTab('HISTORY');
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
      setConfirmSaveOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPdf = async (c: RiChecklist) => {
    setPdfBusyId(c.id);
    try {
      await downloadRiChecklistPDF(c);
      setToast({ msg: `RI Checklist PDF (${c.checklistCode}) डाउनलोड झाला.`, type: 'success' });
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
        title="नियमित लसीकरण सत्र निरीक्षण तपासणी यादी (RI Checklist)"
        subtitle="Session Monitoring Format · सुधारित आवृत्ती: JE Diluent काढलेला (JE विना-डायल्युएंट उपलब्ध) · PCV आणि IPV लसींचा समावेश"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setViewTab('FORM');
              }}
              className={viewTab === 'FORM' ? 'app-btn-primary text-xs' : 'app-btn-secondary text-xs'}
            >
              <PlusCircle className="w-4 h-4" />
              {editItem ? `संपादन: ${editItem.checklistCode}` : 'नवीन चेकलिस्ट भरा'}
            </button>
            <button
              type="button"
              onClick={() => setViewTab('HISTORY')}
              className={viewTab === 'HISTORY' ? 'app-btn-primary text-xs' : 'app-btn-secondary text-xs'}
            >
              <ClipboardCheck className="w-4 h-4" />
              जतन केलेल्या याद्या ({formatNumberIN(visibleChecklists.length)})
            </button>
          </div>
        }
      />

      {viewTab === 'FORM' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isLinkedSessionClosed) {
              setToast({
                msg: `हे लसीकरण सत्र बंद/पूर्ण (${selectedLinkedSession?.status}) असल्यामुळे नवीन चेकलिस्ट भरता किंवा संपादित करता येणार नाही.`,
                type: 'error',
              });
              return;
            }
            if (existingChecklistForSelectedSession) {
              setToast({
                msg: `या लसीकरण सत्रासाठी आधीच RI चेकलिस्ट (${existingChecklistForSelectedSession.checklistCode}) भरलेली आहे. एका सत्रासाठी फक्त एकच चेकलिस्ट भरता येते.`,
                type: 'error',
              });
              return;
            }
            if (
              !checklistStaffName.trim() ||
              !monitorName.trim() ||
              !subcentreId ||
              !sessionSiteName.trim()
            ) {
              setToast({
                msg: 'कृपया चेकलिस्ट करणाऱ्या कर्मचाऱ्याचे नाव, निरीक्षकाचे नाव, उपकेंद्र आणि सत्र ठिकाण (गाव) भरा.',
                type: 'error',
              });
              return;
            }
            if (isSessionHeld === 'Yes' && !vaccineCarrierName.trim()) {
              setToast({
                msg: 'कृपया प्र. ७ ब मध्ये लस वाहतूक करणाऱ्या व्यक्तीचे / कर्मचाऱ्याचे नाव भरा.',
                type: 'error',
              });
              return;
            }
            setConfirmSaveOpen(true);
          }}
          className="space-y-6"
        >
          {/* Section A: Monitor & Session Identification */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  १. निरीक्षक व सत्र केंद्र माहिती (Header & Site Identification)
                </h3>
                <p className="text-xs text-slate-500">
                  खालील सत्राशी संलग्न केल्यास उपकेंद्र, गाव व दिनांक स्वयंचलित भरले जातील.
                </p>
              </div>
              {editItem && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-teal-700 font-semibold hover:underline"
                >
                  + नवीन चेकलिस्ट सुरू करा
                </button>
              )}
            </div>

            <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-lg space-y-2">
              <label className="block text-xs font-bold text-teal-900">
                लसीकरण सत्राशी जोडा (एका सत्रासाठी फक्त १ चेकलिस्ट परवानगी)
              </label>
              <select
                value={sessionId}
                disabled={Boolean(editItem)}
                onChange={(e) => applySessionPrefill(e.target.value)}
                className="w-full md:max-w-2xl bg-white border border-teal-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">-- स्वतंत्र सत्र केंद्र / सत्र निवडलेले नाही --</option>
                {visibleSessions.map((s) => {
                  const existingRi = checklistBySessionId.get(s.id);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.sessionCode} · {formatDDMMYYYY(s.sessionDate)} · {s.subcentreName} ·{' '}
                      {s.villageName} ({s.location}) —{' '}
                      {existingRi ? `चेकलिस्ट पूर्ण (${existingRi.checklistCode})` : 'प्रलंबित'}
                    </option>
                  );
                })}
              </select>

              {existingChecklistForSelectedSession && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <div className="text-sm font-bold text-amber-900">
                        या लसीकरण सत्रासाठी आधीच RI चेकलिस्ट भरलेली आहे (कोड:{' '}
                        {existingChecklistForSelectedSession.checklistCode})
                      </div>
                      <p className="text-amber-900">
                        <strong>नियम:</strong> एका लसीकरण सत्रासाठी फक्त एकच RI चेकलिस्ट भरण्याची परवानगी आहे. नवीन दुसरी चेकलिस्ट नोंदवता येणार नाही.
                      </p>
                      <div className="text-amber-800 pt-0.5">
                        दिनांक: {formatDDMMYYYY(existingChecklistForSelectedSession.monitoringDate)} ·
                        चेकलिस्ट कर्मचारी:{' '}
                        {existingChecklistForSelectedSession.checklistStaffName ||
                          existingChecklistForSelectedSession.monitorName}{' '}
                        · निरीक्षक: {existingChecklistForSelectedSession.monitorName} · लस वाहतूक:{' '}
                        {existingChecklistForSelectedSession.vaccineDeliveredBy}
                        {existingChecklistForSelectedSession.vaccineCarrierName
                          ? ` (${existingChecklistForSelectedSession.vaccineCarrierName})`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {!isLinkedSessionClosed && (
                      <button
                        type="button"
                        onClick={() => loadForEdit(existingChecklistForSelectedSession)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
                      >
                        <Edit className="w-3.5 h-3.5" /> विद्यमान चेकलिस्ट पहा / संपादित करा
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pdfBusyId === existingChecklistForSelectedSession.id}
                      onClick={() => handleDownloadPdf(existingChecklistForSelectedSession)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF डाउनलोड
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportRiChecklistExcel(existingChecklistForSelectedSession);
                        setToast({
                          msg: `RI Checklist Excel (${existingChecklistForSelectedSession.checklistCode}) डाउनलोड झाला.`,
                          type: 'success',
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-emerald-800 text-xs font-semibold"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel डाउनलोड
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-400 text-amber-900 hover:bg-amber-100 text-xs font-medium"
                    >
                      दुसरे सत्र निवडा
                    </button>
                  </div>
                </div>
              )}

              {isLinkedSessionClosed && !existingChecklistForSelectedSession && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start gap-2.5 text-xs">
                  <Lock className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-rose-900">
                      हे लसीकरण सत्र बंद / पूर्ण ({selectedLinkedSession?.status}) झालेले आहे
                    </div>
                    <p>
                      सत्र बंद केल्यानंतर त्या सत्रासाठी नवीन RI चेकलिस्ट भरता किंवा बदलता येणार नाही. फक्त जतन केलेल्या याद्या पाहता व डाउनलोड करता येतील.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!existingChecklistForSelectedSession && !isLinkedSessionClosed && (
              <>
            <datalist id="ri-active-staff-list">
              {activeStaffOptions.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} ({s.designation}
                  {s.subcentreName ? ` · ${s.subcentreName}` : ''})
                </option>
              ))}
            </datalist>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  चेकलिस्ट करणारा कर्मचारी नाव *
                </label>
                <input
                  required
                  list="ri-active-staff-list"
                  value={checklistStaffName}
                  onChange={(e) => setChecklistStaffName(e.target.value)}
                  placeholder="कर्मचाऱ्याचे नाव निवडा किंवा लिहा"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  निरीक्षकाचे नाव (Name of Monitor) *
                </label>
                <input
                  required
                  list="ri-active-staff-list"
                  value={monitorName}
                  onChange={(e) => setMonitorName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  संस्था (Organization) *
                </label>
                <select
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value as RiChecklist['organization'])}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="Govt">Govt</option>
                  <option value="WHO">WHO</option>
                  <option value="UNICEF">UNICEF</option>
                  <option value="IPE">IPE</option>
                  <option value="Others">Others</option>
                </select>
                {organization === 'Others' && (
                  <input
                    value={organizationOther}
                    onChange={(e) => setOrganizationOther(e.target.value)}
                    placeholder="संस्थेचे नाव लिहा"
                    className="mt-1.5 w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  पदनाम (Designation) *
                </label>
                <input
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="उदा. MO / CHO / Supervisor"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  निरीक्षण दिनांक (Date) *
                </label>
                <input
                  type="date"
                  required
                  value={monitoringDate}
                  onChange={(e) => setMonitoringDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">राज्य (State)</label>
                <input
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">जिल्हा (District)</label>
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">तालुका / ULB (Block)</label>
                <input
                  value={blockUlb}
                  onChange={(e) => setBlockUlb(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  नियोजन घटक (Planning Unit)
                </label>
                <input
                  value={planningUnit}
                  onChange={(e) => setPlanningUnit(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">विभाग (Setting)</label>
                <select
                  value={setting}
                  onChange={(e) => setSetting(e.target.value as RiChecklist['setting'])}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="Rural">Rural (ग्रामीण)</option>
                  <option value="Urban">Urban (शहरी)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  उपकेंद्र (Sub centre) *
                </label>
                <select
                  required
                  disabled={Boolean(scopedSubcentre)}
                  value={subcentreId}
                  onChange={(e) => {
                    setSubcentreId(e.target.value);
                    setVillageId('');
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-100"
                >
                  <option value="">उपकेंद्र निवडा...</option>
                  {db.subcentres
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">गाव (निवडा)</label>
                <select
                  value={villageId}
                  onChange={(e) => {
                    const vid = e.target.value;
                    setVillageId(vid);
                    const vl = db.villages.find((v) => v.id === vid);
                    if (vl) setSessionSiteName(vl.name);
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">गाव निवडा / खाली टाइप करा</option>
                  {filteredVillages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.villageCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  सत्र ठिकाण व गाव/मोहल्ला *
                </label>
                <input
                  required
                  value={sessionSiteName}
                  onChange={(e) => setSessionSiteName(e.target.value)}
                  placeholder="उदा. भादा · अंगणवाडी क्र. १"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
              <div>
                <div className="font-semibold text-slate-800 mb-1.5">
                  सत्र निरीक्षणाचे कारण (Reason for monitoring this session site)*
                </div>
                <div className="space-y-1">
                  {RI_MONITORING_REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={monitoringReasons.includes(r)}
                        onChange={() => setMonitoringReasons((prev) => toggleInList(prev, r))}
                        className="accent-teal-700"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                  {monitoringReasons.includes('Others') && (
                    <input
                      value={monitoringReasonOther}
                      onChange={(e) => setMonitoringReasonOther(e.target.value)}
                      placeholder="इतर कारण लिहा"
                      className="mt-1 w-full border border-slate-300 rounded px-2.5 py-1 text-xs"
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-800 mb-1.5">
                  Polio HRA असल्यास HRA प्रकार (If Polio HRA, type of HRA)
                </div>
                <select
                  value={hraType}
                  onChange={(e) => setHraType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                >
                  <option value="">-- लागू नाही --</option>
                  {RI_HRA_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="font-semibold text-slate-800 mb-1.5">
                  सत्र ठिकाणाचा प्रकार (Location of Session Site)
                </div>
                <select
                  value={sessionSiteLocation}
                  onChange={(e) =>
                    setSessionSiteLocation(e.target.value as RiChecklist['sessionSiteLocation'])
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                >
                  <option value="Distt. Hospital">Distt. Hospital</option>
                  <option value="CHC">CHC</option>
                  <option value="PHC">PHC</option>
                  <option value="Sub Centre">Sub Centre</option>
                  <option value="ICDS Centre">ICDS Centre (अंगणवाडी)</option>
                  <option value="Others">Others</option>
                </select>
                {sessionSiteLocation === 'Others' && (
                  <input
                    value={sessionSiteLocationOther}
                    onChange={(e) => setSessionSiteLocationOther(e.target.value)}
                    placeholder="ठिकाण नमूद करा"
                    className="mt-1.5 w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                )}
              </div>
            </div>
              </>
            )}
          </div>

          {!existingChecklistForSelectedSession && !isLinkedSessionClosed && (
            <>
          {/* Section B: Q1 Session Held */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              प्र. १. सत्र सुरू आहे का? (Session Held Status)
            </h3>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-4">
                <span className="font-medium text-slate-700">1a. Is session held?</span>
                {(['Yes', 'No'] as const).map((opt) => (
                  <label key={opt} className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="isSessionHeld"
                      checked={isSessionHeld === opt}
                      onChange={() => setIsSessionHeld(opt)}
                      className="accent-teal-700"
                    />
                    <span>{opt === 'Yes' ? 'Yes (होय)' : 'No (नाही)'}</span>
                  </label>
                ))}
              </div>
            </div>

            {isSessionHeld === 'No' && (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 space-y-2 text-xs">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  1b. सत्र बंद असल्यास कारण (If session is not held, reason):
                </div>
                <div className="space-y-1.5">
                  {RI_SESSION_NOT_HELD_REASONS.map((reason) => (
                    <label key={reason} className="flex items-start gap-2 cursor-pointer text-slate-800">
                      <input
                        type="radio"
                        name="sessionNotHeldReason"
                        checked={sessionNotHeldReason === reason}
                        onChange={() => setSessionNotHeldReason(reason)}
                        className="mt-0.5 accent-amber-700"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                  {sessionNotHeldReason === 'D- Others' && (
                    <input
                      value={sessionNotHeldReasonOther}
                      onChange={(e) => setSessionNotHeldReasonOther(e.target.value)}
                      placeholder="इतर कारण लिहा"
                      className="w-full max-w-md bg-white border border-amber-300 rounded px-2.5 py-1.5 text-xs"
                    />
                  )}
                </div>
                <p className="text-amber-900 font-medium pt-1">
                  टीप: सत्र सुरू नसल्यास सत्र निरीक्षण थांबवून घर-भेट (House-to-House) निरीक्षण करा आणि खाली प्र. २१–२२ (PHC कारणे) नोंदवा.
                </p>
              </div>
            )}
          </div>

          {isSessionHeld === 'Yes' && (
            <>
              {/* Section C: Q2-Q7 Mobilization & Logistics Delivery */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  प्र. २ ते ७: देय यादी (Due List), मोबिलायझर आणि लस पुरवठा
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      2. Is due list available with the ANM?
                    </label>
                    <select
                      value={dueListAvailable}
                      onChange={(e) =>
                        setDueListAvailable(e.target.value as RiChecklist['dueListAvailable'])
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="No list">No list (यादी नाही)</option>
                      <option value="List not updated">List not updated (यादी अद्ययावत नाही)</option>
                      <option value="Updated list">Updated list (अद्ययावत यादी उपलब्ध)</option>
                    </select>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-800 mb-1">
                      3*. Is any mobilizer assigned to the session site?
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
                      {RI_MOBILIZER_OPTIONS.map((m) => (
                        <label key={m} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mobilizersAssigned.includes(m)}
                            onChange={() => setMobilizersAssigned((prev) => toggleInList(prev, m))}
                            className="accent-teal-700"
                          />
                          <span>{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      4. If due list available, is it with the mobiliser?
                    </label>
                    <select
                      value={dueListWithMobiliser}
                      onChange={(e) =>
                        setDueListWithMobiliser(
                          e.target.value as RiChecklist['dueListWithMobiliser']
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Not Observed">Not Observed</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      5. Is mobilizer mobilizing the children to session site?
                    </label>
                    <select
                      value={mobilizerMobilizing}
                      onChange={(e) =>
                        setMobilizerMobilizing(
                          e.target.value as RiChecklist['mobilizerMobilizing']
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      6. Is any polio HRA tagged to this site?
                    </label>
                    <select
                      value={polioHraTagged}
                      onChange={(e) =>
                        setPolioHraTagged(e.target.value as RiChecklist['polioHraTagged'])
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      7. लस व लॉजिस्टिक्स वाहतूक कोणी केली? (Delivery Mode)
                    </label>
                    <select
                      value={vaccineDeliveredBy}
                      onChange={(e) => {
                        const mode = e.target.value as RiChecklist['vaccineDeliveredBy'];
                        setVaccineDeliveredBy(mode);
                        if (mode === 'ANM' && !vaccineCarrierName.trim()) {
                          const ses = db.vaccinationSessions.find((s) => s.id === sessionId);
                          const scAnm = db.staff.find(
                            (st) =>
                              st.isActive &&
                              st.subcentreId === subcentreId &&
                              st.designation === 'ANM'
                          );
                          const suggested = ses?.anmName || scAnm?.name || '';
                          if (suggested) setVaccineCarrierName(suggested);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="ANM">ANM</option>
                      <option value="AVD">AVD</option>
                      <option value="Teeka Express">Teeka Express</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-800 mb-1">
                      7b. लस वाहतूक करणाऱ्याचे नाव ({vaccineDeliveredBy} कर्मचारी / व्यक्तीचे पूर्ण नाव) *
                    </label>
                    <input
                      required={isSessionHeld === 'Yes'}
                      list="ri-active-staff-list"
                      value={vaccineCarrierName}
                      onChange={(e) => setVaccineCarrierName(e.target.value)}
                      placeholder="उदा. ANM / AVD / लस वाहतूक करणाऱ्या व्यक्तीचे पूर्ण नाव"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section D: Q8* Vaccines/Diluents Availability & Open Vial Re-issued */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      प्र. ८*. सत्र स्थळावर उपलब्ध लसी / डायल्युएंट व Open Vial स्थिती
                    </h3>
                    <p className="text-xs text-slate-600">
                      टीप: <strong>JE लस</strong> आता डायल्युएंटशिवाय (Ready-to-Use) येत असल्याने JE Diluent काढला आहे; <strong>PCV</strong> आणि <strong>IPV</strong> लसी नव्याने समाविष्ट केल्या आहेत.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={markAllVaccinesAdequate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-700 text-teal-800 bg-teal-50 hover:bg-teal-100 text-xs font-semibold whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> सर्व लसी Adequate चिन्हांकित करा
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">अ.क्र.</th>
                        <th className="px-4 py-2.5 font-semibold">Vaccine / Diluent</th>
                        <th className="px-4 py-2.5 font-semibold">
                          उपलब्धता (No / Inadequate / Adequate)
                        </th>
                        <th className="px-4 py-2.5 font-semibold">
                          Any Open Vial Re-issued? (Yes / No)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {RI_VACCINE_ITEMS.map((v, idx) => {
                        const entry = vaccines[v.code] || { availability: '', openVialReissued: '' };
                        const avOptions: Array<RiVaccineStatusEntry['availability']> = v.allowNa
                          ? ['NA', 'No', 'Inadequate', 'Adequate']
                          : ['No', 'Inadequate', 'Adequate'];
                        const isNewOrUpdated =
                          v.code === 'JE' || v.code === 'PCV' || v.code === 'IPV';

                        return (
                          <tr key={v.code} className={isNewOrUpdated ? 'bg-teal-50/30' : 'hover:bg-slate-50'}>
                            <td className="px-4 py-2.5 font-mono-tabular text-slate-500">
                              {formatNumberIN(idx + 1)}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-slate-900">{v.label}</div>
                              <div className="text-[11px] text-slate-500">{v.sublabel}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-3">
                                {avOptions.map((opt) => (
                                  <label
                                    key={opt}
                                    className="inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <input
                                      type="radio"
                                      name={`vac_av_${v.code}`}
                                      checked={entry.availability === opt}
                                      onChange={() =>
                                        setVaccines((prev) => ({
                                          ...prev,
                                          [v.code]: { ...prev[v.code], availability: opt },
                                        }))
                                      }
                                      className="accent-teal-700"
                                    />
                                    <span
                                      className={
                                        opt === 'No' && entry.availability === 'No'
                                          ? 'text-rose-700 font-semibold'
                                          : opt === 'Inadequate' &&
                                              entry.availability === 'Inadequate'
                                            ? 'text-amber-700 font-semibold'
                                            : opt === 'Adequate' &&
                                                entry.availability === 'Adequate'
                                              ? 'text-emerald-700 font-semibold'
                                              : 'text-slate-700'
                                      }
                                    >
                                      {opt}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {v.supportsOpenVial ? (
                                <div className="flex items-center gap-4">
                                  {(['Yes', 'No'] as const).map((yn) => (
                                    <label
                                      key={yn}
                                      className="inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <input
                                        type="radio"
                                        name={`vac_ov_${v.code}`}
                                        checked={entry.openVialReissued === yn}
                                        onChange={() =>
                                          setVaccines((prev) => ({
                                            ...prev,
                                            [v.code]: {
                                              ...prev[v.code],
                                              openVialReissued: yn,
                                            },
                                          }))
                                        }
                                        className="accent-teal-700"
                                      />
                                      <span>{yn}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">लागू नाही</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section E: Q9* Logistics Availability */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      प्र. ९*. सत्र स्थळावर लॉजिस्टिक्स उपलब्धता (Logistics Available at Session Site)
                    </h3>
                    <p className="text-xs text-slate-500">
                      सिरींज, MCP कार्ड, व्हिटॅमिन-ए, पॅरासिटामॉल, ORS, IFA, झिंक व लाल-काळ्या पिशव्या
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={markAllLogisticsAdequate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-700 text-teal-800 bg-teal-50 hover:bg-teal-100 text-xs font-semibold whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> सर्व लॉजिस्टिक्स Adequate चिन्हांकित करा
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 text-xs">
                  {RI_LOGISTIC_ITEMS.map((item, idx) => {
                    const val = logistics[item.code] || '';
                    return (
                      <div
                        key={item.code}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {formatNumberIN(idx + 1)}. {item.label}
                          </div>
                          <div className="text-[11px] text-slate-500">{item.sublabel}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          {(['No', 'Inadequate', 'Adequate'] as const).map((opt) => (
                            <label key={opt} className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`log_${item.code}`}
                                checked={val === opt}
                                onChange={() =>
                                  setLogistics((prev) => ({ ...prev, [item.code]: opt }))
                                }
                                className="accent-teal-700"
                              />
                              <span
                                className={
                                  opt === 'No' && val === 'No'
                                    ? 'text-rose-700 font-semibold'
                                    : opt === 'Inadequate' && val === 'Inadequate'
                                      ? 'text-amber-700 font-semibold'
                                      : opt === 'Adequate' && val === 'Adequate'
                                        ? 'text-emerald-700 font-semibold'
                                        : 'text-slate-700'
                                }
                              >
                                {opt}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section F: Q10-Q15* Safe Injection, 4 Key Messages & Caregiver Interviews */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-5">
                <h3 className="text-sm font-bold text-slate-900">
                  प्र. १० ते १५*: सुरक्षित इंजेक्शन, ४ मुख्य संदेश व पालक संवाद (Caregiver Interviews)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800">
                      10. Is ANM cutting each syringe with hub cutter just after use?
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {(['Yes', 'No', 'Not Observed'] as const).map((opt) => (
                        <label key={opt} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="hubCutter"
                            checked={cuttingWithHubCutter === opt}
                            onChange={() => setCuttingWithHubCutter(opt)}
                            className="accent-teal-700"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                    {cuttingWithHubCutter === 'No' && (
                      <div className="pt-1">
                        <label className="block font-medium text-rose-800 mb-1">If No, why:</label>
                        <select
                          value={hubCutterNoReason}
                          onChange={(e) => setHubCutterNoReason(e.target.value)}
                          className="w-full border border-rose-300 rounded px-2.5 py-1.5 bg-white"
                        >
                          <option value="">कारण निवडा...</option>
                          {RI_HUB_CUTTER_NO_REASONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800">
                      11. Is ANM marking ALL vials with date/time before first use?
                    </div>
                    <div className="flex gap-4">
                      {(['Yes', 'No'] as const).map((opt) => (
                        <label key={opt} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="markingVials"
                            checked={markingVialsDateTime === opt}
                            onChange={() => setMarkingVialsDateTime(opt)}
                            className="accent-teal-700"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800">
                      12*. Is any reconstituted vial in use after the specified time has lapsed?
                    </div>
                    <div className="text-[11px] text-slate-500">
                      (JE लस डायल्युएंटशिवाय येत असल्याने JE पुनर्मिश्रण लागू नाही)
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {RI_RECONSTITUTED_VIALS.map((opt) => (
                        <label key={opt} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={reconstitutedVialAfterLapsed.includes(opt)}
                            onChange={() => {
                              setReconstitutedVialAfterLapsed((prev) => {
                                if (opt === 'None') return ['None'];
                                const cleaned = prev.filter((x) => x !== 'None');
                                const next = toggleInList(cleaned, opt);
                                return next.length === 0 ? ['None'] : next;
                              });
                            }}
                            className="accent-teal-700"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800">
                      13. Is ANM delivering all 4 Key Messages to the care-givers?
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {(['Yes', 'No', 'Not Observed'] as const).map((opt) => (
                        <label key={opt} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="keyMessages"
                            checked={delivering4KeyMessages === opt}
                            onChange={() => setDelivering4KeyMessages(opt)}
                            className="accent-teal-700"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>

                    <div className="font-semibold text-slate-800 pt-2 border-t border-slate-100">
                      14. Is ANM advising the care-givers to wait for 30 mins after vaccination?
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {(['Yes', 'No', 'Not Observed'] as const).map((opt) => (
                        <label key={opt} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="wait30Mins"
                            checked={advisingWait30Mins === opt}
                            onChange={() => setAdvisingWait30Mins(opt)}
                            className="accent-teal-700"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4 Key Messages Reference Box */}
                <div className="p-3.5 rounded-lg bg-teal-50/60 border border-teal-200 text-xs space-y-1.5">
                  <div className="font-bold text-teal-900">४ मुख्य संदेश (4 Key Messages Reference):</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-800">
                    {RI_4_KEY_MESSAGES.map((km) => (
                      <div key={km.num}>
                        <strong>Message {km.num}:</strong> {km.en}{' '}
                        <span className="text-slate-600">({km.mr})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Q15 Caregiver Interviews */}
                <div className="p-3.5 rounded-lg border border-slate-200 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">
                      15*. Who has mobilized you to this session site? (Interview Three Caregivers)
                    </span>
                    <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={caregiverInterviewNotObserved}
                        onChange={(e) => setCaregiverInterviewNotObserved(e.target.checked)}
                        className="accent-teal-700"
                      />
                      <span>Not Observed (निरीक्षण केले नाही)</span>
                    </label>
                  </div>

                  {!caregiverInterviewNotObserved && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        {
                          label: 'Caregiver 1 (पालक १)',
                          state: caregiver1Mobilizer,
                          setter: setCaregiver1Mobilizer,
                        },
                        {
                          label: 'Caregiver 2 (पालक २)',
                          state: caregiver2Mobilizer,
                          setter: setCaregiver2Mobilizer,
                        },
                        {
                          label: 'Caregiver 3 (पालक ३)',
                          state: caregiver3Mobilizer,
                          setter: setCaregiver3Mobilizer,
                        },
                      ].map((cg) => (
                        <div key={cg.label} className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-1.5">
                          <div className="font-semibold text-slate-800">{cg.label}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {RI_CAREGIVER_MOBILIZERS.map((mob) => (
                              <label key={mob} className="inline-flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cg.state.includes(mob)}
                                  onChange={() => cg.setter((prev) => toggleInList(prev, mob))}
                                  className="accent-teal-700"
                                />
                                <span>{mob}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Section G: Q16-Q20 Ask & Verify Records with ANM / ASHA */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  प्र. १६ ते २०: ANM / लसीकरण कर्मचारी / ASHA रेकॉर्ड पडताळणी (Ask & Verify Records)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      16. At which minimum age will you (ANM) give 2nd Measles dose?
                    </label>
                    <select
                      value={minAge2ndMeasles}
                      onChange={(e) =>
                        setMinAge2ndMeasles(e.target.value as RiChecklist['minAge2ndMeasles'])
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="9-12m">9-12m</option>
                      <option value="16-24m">16-24m</option>
                      <option value="any other age">any other age</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      17. Is the MCTS / RCH register maintained?
                    </label>
                    <select
                      value={mctsRegisterMaintained}
                      onChange={(e) =>
                        setMctsRegisterMaintained(
                          e.target.value as RiChecklist['mctsRegisterMaintained']
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Not Observed">Not Observed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      18. Has any supervisor visited this session today?
                    </label>
                    <select
                      value={supervisorVisitedToday}
                      onChange={(e) =>
                        setSupervisorVisitedToday(
                          e.target.value as RiChecklist['supervisorVisitedToday']
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="Health Supervisor">Health Supervisor</option>
                      <option value="MO">MO</option>
                      <option value="None">None</option>
                      <option value="Others">Others</option>
                    </select>
                    {supervisorVisitedToday === 'Others' && (
                      <input
                        value={supervisorVisitedOther}
                        onChange={(e) => setSupervisorVisitedOther(e.target.value)}
                        placeholder="तपशील लिहा"
                        className="mt-1.5 w-full border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      19. Has ASHA received payment for previous RI Session?
                    </label>
                    <select
                      value={ashaPaymentPreviousSession}
                      onChange={(e) =>
                        setAshaPaymentPreviousSession(
                          e.target.value as RiChecklist['ashaPaymentPreviousSession']
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="Not applicable">Not applicable</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800">
                      20. Has ASHA received payment for all Fully Immunized (FI) & Completely Immunized (CI) children upto last month?
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          For FI (BCG + OPV3 + DPT3 + HepB3 + MCV1):
                        </label>
                        <select
                          value={ashaPaymentFI}
                          onChange={(e) =>
                            setAshaPaymentFI(e.target.value as RiChecklist['ashaPaymentFI'])
                          }
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Partial">Partial</option>
                          <option value="NA">NA</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          For CI (FI + OPV booster + DPT booster + MCV2):
                        </label>
                        <select
                          value={ashaPaymentCI}
                          onChange={(e) =>
                            setAshaPaymentCI(e.target.value as RiChecklist['ashaPaymentCI'])
                          }
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Partial">Partial</option>
                          <option value="NA">NA</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Section H: Q21-Q22 PHC Ascertainment & Remarks */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                प्र. २१ व २२: कोणतीही लस / लॉजिस्टिक उपलब्ध नसल्यास किंवा ANM अनुपस्थित असल्यास (PHC येथे कारण पडताळणी)
              </h3>
              <p className="text-xs text-slate-500">
                If any Vaccine or logistic is not available or ANM has been absent, ascertain reason at PHC
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  21. Why Vaccine or logistic has not been available
                </label>
                <select
                  value={vaccineNotAvailableReason}
                  onChange={(e) =>
                    setVaccineNotAvailableReason(
                      e.target.value as RiChecklist['vaccineNotAvailableReason']
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">-- लागू नाही / सर्व उपलब्ध --</option>
                  <option value="Stock out">Stock out</option>
                  <option value="No AVD">No AVD</option>
                  <option value="Others">Others</option>
                </select>
                {vaccineNotAvailableReason === 'Others' && (
                  <input
                    value={vaccineNotAvailableOther}
                    onChange={(e) => setVaccineNotAvailableOther(e.target.value)}
                    placeholder="इतर कारण लिहा"
                    className="mt-1.5 w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  22. Why ANM has been absent
                </label>
                <select
                  value={anmAbsentReason}
                  onChange={(e) =>
                    setAnmAbsentReason(e.target.value as RiChecklist['anmAbsentReason'])
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">-- लागू नाही / ANM उपस्थित --</option>
                  <option value="Post got vacant">Post got vacant</option>
                  <option value="On leave">On leave</option>
                  <option value="Others">Others</option>
                </select>
                {anmAbsentReason === 'Others' && (
                  <input
                    value={anmAbsentOther}
                    onChange={(e) => setAnmAbsentOther(e.target.value)}
                    placeholder="इतर कारण लिहा"
                    className="mt-1.5 w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-800 mb-1">
                  निरीक्षकाचा अभिप्राय / शेरा (Remarks - ऐच्छिक)
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="सुधारणा सूचना किंवा विशेष निरीक्षणे..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-100">
              {editItem && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  रद्द करा
                </button>
              )}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {editItem ? 'RI चेकलिस्ट अद्यतनित करा' : 'RI चेकलिस्ट जतन करा'}
              </button>
            </div>
          </div>
            </>
          )}
        </form>
      ) : (
        /* Saved RI Checklists History Table */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              जतन केलेल्या RI सत्र निरीक्षण याद्या ({formatNumberIN(visibleChecklists.length)})
            </div>
            {!scopedSubcentre && (
              <select
                value={historyFilterSc}
                onChange={(e) => setHistoryFilterSc(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white"
              >
                <option value="">सर्व उपकेंद्रे</option>
                {db.subcentres.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {visibleChecklists.length === 0 ? (
            <EmptyState message='अद्याप एकही RI सत्र निरीक्षण यादी नोंदवलेली नाही. "नवीन चेकलिस्ट भरा" वर क्लिक करून पहिली नोंद करा.' />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">कोड व दिनांक</th>
                    <th className="px-4 py-3 font-semibold">उपकेंद्र व सत्र ठिकाण</th>
                    <th className="px-4 py-3 font-semibold">चेकलिस्ट कर्मचारी व निरीक्षक</th>
                    <th className="px-4 py-3 font-semibold">लस वाहतूक</th>
                    <th className="px-4 py-3 font-semibold">सत्र स्थिती</th>
                    <th className="px-4 py-3 font-semibold">लस (PCV/IPV सह)</th>
                    <th className="px-4 py-3 font-semibold">लॉजिस्टिक्स</th>
                    <th className="px-4 py-3 font-semibold text-right">कृती / अहवाल</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleChecklists.map((c) => {
                    const stats = computeRiChecklistCounts(c);
                    const linkedSes = c.sessionId
                      ? db.vaccinationSessions.find((s) => s.id === c.sessionId) || null
                      : null;
                    const linkedClosed = Boolean(linkedSes && !getSessionEditStatus(linkedSes).isOpen);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono-tabular font-semibold text-teal-800">
                            {c.checklistCode}
                          </div>
                          <div className="text-slate-500 font-mono-tabular">
                            {formatDDMMYYYY(c.monitoringDate)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{c.sessionSiteName || '-'}</div>
                          <div className="text-slate-500">
                            {c.subcentreName} · {c.sessionSiteLocation}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            कर्मचारी: {c.checklistStaffName || c.monitorName || '-'}
                          </div>
                          <div className="text-slate-500">
                            निरीक्षक: {c.monitorName} ({c.designation} · {c.organization})
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {c.vaccineCarrierName || '-'}
                          </div>
                          <div className="text-slate-500">{c.vaccineDeliveredBy || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              c.isSessionHeld === 'Yes'
                                ? 'text-emerald-700 font-semibold'
                                : 'text-rose-700 font-semibold'
                            }
                          >
                            {c.isSessionHeld === 'Yes' ? 'सुरू (Held)' : 'बंद (Not Held)'}
                          </span>
                          {c.isSessionHeld === 'Yes' && c.cuttingWithHubCutter && (
                            <div className="text-[11px] text-slate-500">
                              Hub Cutter: {c.cuttingWithHubCutter}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular">
                          <span className="text-emerald-700 font-semibold">
                            Adequate: {formatNumberIN(stats.adequateVaccines)}/{formatNumberIN(stats.totalVaccines)}
                          </span>
                          {stats.issueVaccines > 0 && (
                            <div className="text-rose-700">
                              No/Inadequate: {formatNumberIN(stats.issueVaccines)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular">
                          <span className="text-emerald-700 font-semibold">
                            Adequate: {formatNumberIN(stats.adequateLogistics)}/{formatNumberIN(stats.totalLogistics)}
                          </span>
                          {stats.issueLogistics > 0 && (
                            <div className="text-rose-700">
                              No/Inadequate: {formatNumberIN(stats.issueLogistics)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                          {linkedClosed ? (
                            <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                              <Lock className="w-3 h-3" /> सत्र बंद
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => loadForEdit(c)}
                              className="inline-flex items-center gap-1 text-teal-700 font-medium hover:underline"
                            >
                              <Edit className="w-3.5 h-3.5" /> संपादन
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={pdfBusyId === c.id}
                            onClick={() => handleDownloadPdf(c)}
                            className="inline-flex items-center gap-1 text-teal-800 font-semibold hover:underline disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />{' '}
                            {pdfBusyId === c.id ? 'तयार होत आहे...' : 'PDF'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              exportRiChecklistExcel(c);
                              setToast({
                                msg: `RI Checklist Excel (${c.checklistCode}) डाउनलोड झाला.`,
                                type: 'success',
                              });
                            }}
                            className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmSaveOpen}
        title={
          editItem
            ? `RI चेकलिस्ट (${editItem.checklistCode}) अद्यतनित करायची का?`
            : 'नवीन RI चेकलिस्ट जतन करायची का?'
        }
        description={`चेकलिस्ट कर्मचारी: ${checklistStaffName} · निरीक्षक: ${monitorName} · लस वाहतूक: ${vaccineDeliveredBy}${vaccineCarrierName ? ` (${vaccineCarrierName})` : ''} · दिनांक: ${formatDDMMYYYY(monitoringDate)} · ठिकाण: ${sessionSiteName} · सत्र स्थिती: ${isSessionHeld}`}
        confirmLabel="होय, जतन करा"
        loading={busy}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmSaveOpen(false)}
      />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
