import React, { useEffect, useMemo, useState } from 'react';
import { Baby, CheckCircle2, Eye, EyeOff, HeartPulse, Syringe, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import {
  Beneficiary,
  BeneficiaryGender,
  BeneficiaryStatus,
  BeneficiaryType,
  DeliveryFacilityType,
} from '../types';
import { calculateAgeAsOf, getSessionEditStatus, getTodayIST } from '../utils/dateUtils';
import {
  BLOOD_GROUPS,
  calculateEddFromMcDate,
  calculateWomanAgeFromDob,
  CASTE_CATEGORIES,
  PLANNED_DELIVERY_PLACES,
  RH_FACTORS,
} from '../utils/maternalUtils';
import { canViewFullAadhaar, maskAadhaar, sanitizeOptionalAadhaar } from '../utils/privacyUtils';
import { SearchableSelect } from '../components/SearchableSelect';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';

export const BeneficiaryRegistrationPage: React.FC = () => {
  const { db, currentUser, registerBeneficiary, updateBeneficiary } = useSheetData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const initialTypeParam =
    params.get('type') === 'PREGNANT_WOMAN' ? 'PREGNANT_WOMAN' : 'CHILD';

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';

  const [beneficiaryType, setBeneficiaryType] = useState<BeneficiaryType>(initialTypeParam);
  const [childName, setChildName] = useState('');
  const [fullNameEnglish, setFullNameEnglish] = useState('');
  const [motherName, setMotherName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [husbandMobile, setHusbandMobile] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<BeneficiaryGender>(
    initialTypeParam === 'PREGNANT_WOMAN' ? 'स्त्री' : 'मुलगा'
  );
  const [mobile, setMobile] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [revealEditAadhaar, setRevealEditAadhaar] = useState(false);
  const [existingMaskedAadhaar, setExistingMaskedAadhaar] = useState('');
  const [caste, setCaste] = useState('');
  const [category, setCategory] = useState<string>(CASTE_CATEGORIES[0]);
  const [bloodGroup, setBloodGroup] = useState('');
  const [rhFactor, setRhFactor] = useState('');
  const [plannedDeliveryPlace, setPlannedDeliveryPlace] = useState('');
  const [address, setAddress] = useState('');
  const [subcentreId, setSubcentreId] = useState(scopedSubcentre);
  const [villageId, setVillageId] = useState('');
  const [anganwadi, setAnganwadi] = useState('');
  const [registrationDate, setRegistrationDate] = useState(getTodayIST());
  const [status, setStatus] = useState<BeneficiaryStatus>('सक्रिय');

  // Pregnancy Episode fields (when registering a new Pregnant Woman)
  const [mcDate, setMcDate] = useState('');
  const [eddDate, setEddDate] = useState('');
  const [expectedDeliveryPlace, setExpectedDeliveryPlace] = useState('');
  const [deliveryFacilityType, setDeliveryFacilityType] =
    useState<DeliveryFacilityType>('Government');
  const [hospitalName, setHospitalName] = useState('');
  const [gravidaPara, setGravidaPara] = useState('');
  const [gravida, setGravida] = useState('');
  const [para, setPara] = useState('');
  const [abortions, setAbortions] = useState('');
  const [livingChildren, setLivingChildren] = useState('');
  const [previousPregnancyHistory, setPreviousPregnancyHistory] = useState('');
  const [previousCaesarean, setPreviousCaesarean] = useState<'Yes' | 'No' | ''>('No');
  const [previousComplications, setPreviousComplications] = useState('');

  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justRegisteredBen, setJustRegisteredBen] = useState<Beneficiary | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  const aadhaarAuthorized = canViewFullAadhaar(currentUser?.role);

  useEffect(() => {
    if (!db || !editId) return;
    const found = db.beneficiaries.find((b) => b.id === editId);
    if (found) {
      setBeneficiaryType(found.beneficiaryType || 'CHILD');
      setChildName(found.childName);
      setFullNameEnglish(found.fullNameEnglish || '');
      setMotherName(found.motherName);
      setFatherName(found.fatherName);
      setGuardianName(found.guardianName || found.fatherName || '');
      setHusbandMobile(found.husbandMobile || '');
      setDob(found.dob);
      setGender(found.gender);
      setMobile(found.mobile);
      setAadhaarNumber(aadhaarAuthorized ? found.aadhaarNumber || '' : '');
      setExistingMaskedAadhaar(maskAadhaar(found.aadhaarNumber));
      setCaste(found.caste || '');
      setCategory(found.category || CASTE_CATEGORIES[0]);
      setBloodGroup(found.bloodGroup || '');
      setRhFactor(found.rhFactor || '');
      setPlannedDeliveryPlace(found.plannedDeliveryPlace || '');
      setAddress(found.address);
      setSubcentreId(found.subcentreId);
      setVillageId(found.villageId);
      setAnganwadi(found.anganwadi || '');
      setRegistrationDate(found.registrationDate);
      setStatus(found.status);
    }
  }, [db, editId, aadhaarAuthorized]);

  const activeSubcentres = useMemo(
    () => (db ? db.subcentres.filter((s) => s.isActive) : []),
    [db]
  );

  const filteredVillages = useMemo(
    () =>
      db
        ? db.villages.filter(
            (v) =>
              v.isActive &&
              (scopedSubcentre
                ? v.subcentreId === scopedSubcentre
                : !subcentreId || v.subcentreId === subcentreId)
          )
        : [],
    [db, subcentreId, scopedSubcentre]
  );

  const currentAge = useMemo(
    () =>
      dob
        ? beneficiaryType === 'PREGNANT_WOMAN'
          ? calculateWomanAgeFromDob(dob, getTodayIST())
          : calculateAgeAsOf(dob, getTodayIST()).labelMarathi
        : '-',
    [dob, beneficiaryType]
  );

  const handleSwitchType = (nextType: BeneficiaryType) => {
    if (editId) return;
    setBeneficiaryType(nextType);
    setGender(nextType === 'PREGNANT_WOMAN' ? 'स्त्री' : 'मुलगा');
    setError('');
  };

  const handleValidateAndAskConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!subcentreId || !villageId) {
      setError('कृपया उपकेंद्र आणि गाव निवडा.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      setError('कृपया वैध १० अंकी मोबाईल क्रमांक प्रविष्ट करा.');
      return;
    }
    if (beneficiaryType === 'CHILD' && !dob) {
      setError('बालक लाभार्थ्यासाठी जन्मतारीख अनिवार्य आहे.');
      return;
    }
    if (beneficiaryType === 'PREGNANT_WOMAN' && !editId && (!mcDate || !eddDate)) {
      setError('गरोदर मातेसाठी MC दिनांक आणि EDD दिनांक अनिवार्य आहेत.');
      return;
    }
    try {
      if (!editId || aadhaarAuthorized) {
        sanitizeOptionalAadhaar(aadhaarNumber);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'आधार क्रमांक अवैध आहे.');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!db) return;
    const sc = db.subcentres.find((s) => s.id === subcentreId);
    const vl = db.villages.find((v) => v.id === villageId);
    if (!sc || !vl) return;

    setSaving(true);
    try {
      const effectiveGuardian =
        beneficiaryType === 'PREGNANT_WOMAN'
          ? guardianName.trim()
          : guardianName.trim() || fatherName.trim() || motherName.trim();

      if (editId) {
        await updateBeneficiary(editId, {
          beneficiaryType,
          childName: childName.trim(),
          fullNameEnglish: fullNameEnglish.trim(),
          motherName:
            beneficiaryType === 'PREGNANT_WOMAN' ? childName.trim() : motherName.trim(),
          fatherName:
            beneficiaryType === 'PREGNANT_WOMAN'
              ? effectiveGuardian
              : fatherName.trim() || effectiveGuardian,
          guardianName: effectiveGuardian,
          husbandMobile: husbandMobile.trim(),
          dob,
          gender: beneficiaryType === 'PREGNANT_WOMAN' ? 'स्त्री' : gender,
          mobile: mobile.trim(),
          ...(aadhaarAuthorized ? { aadhaarNumber: aadhaarNumber.trim() } : {}),
          caste: caste.trim(),
          category,
          bloodGroup,
          rhFactor,
          plannedDeliveryPlace: plannedDeliveryPlace.trim(),
          address: address.trim(),
          subcentreId,
          subcentreName: sc.name,
          villageId,
          villageName: vl.name,
          anganwadi: anganwadi.trim(),
          registrationDate,
          status,
        });
        setToast({
          msg: 'लाभार्थी कायमस्वरूपी प्रोफाइल अद्यतनित केली.',
          type: 'success',
        });
      } else {
        const res = await registerBeneficiary(
          {
            beneficiaryType,
            childName: childName.trim(),
            fullNameEnglish: fullNameEnglish.trim(),
            motherName:
              beneficiaryType === 'PREGNANT_WOMAN' ? childName.trim() : motherName.trim(),
            fatherName:
              beneficiaryType === 'PREGNANT_WOMAN'
                ? effectiveGuardian
                : fatherName.trim() || effectiveGuardian,
            guardianName: effectiveGuardian,
            husbandMobile: husbandMobile.trim(),
            dob,
            gender: beneficiaryType === 'PREGNANT_WOMAN' ? 'स्त्री' : gender,
            mobile: mobile.trim(),
            aadhaarNumber: aadhaarNumber.trim(),
            caste: caste.trim(),
            category,
            bloodGroup,
            rhFactor,
            plannedDeliveryPlace: plannedDeliveryPlace.trim() || expectedDeliveryPlace.trim(),
            plannedHospitalName: hospitalName.trim(),
            address: address.trim() || vl.name,
            subcentreId,
            subcentreName: sc.name,
            villageId,
            villageName: vl.name,
            anganwadi: anganwadi.trim(),
            registrationDate,
            status,
          },
          beneficiaryType === 'PREGNANT_WOMAN'
            ? {
                mcDate,
                eddDate: eddDate || calculateEddFromMcDate(mcDate),
                expectedDeliveryPlace:
                  expectedDeliveryPlace.trim() || plannedDeliveryPlace.trim() || vl.name,
                deliveryFacilityType,
                hospitalName: hospitalName.trim(),
                pregnancyRegistrationDate: registrationDate,
                pregnancyStatus: 'सक्रिय',
                gravidaPara: gravidaPara.trim(),
                gravida: gravida ? Number(gravida) : null,
                para: para ? Number(para) : null,
                abortions: abortions ? Number(abortions) : null,
                livingChildren: livingChildren ? Number(livingChildren) : null,
                previousPregnancyHistory: previousPregnancyHistory.trim(),
                previousCaesarean,
                previousComplications: previousComplications.trim(),
                bloodGroup,
                rhFactor,
              }
            : undefined
        );
        setToast({
          msg:
            beneficiaryType === 'PREGNANT_WOMAN'
              ? `गरोदर माता नोंदवली! माता आयडी: ${res.beneficiary.beneficiaryCode} · प्रकरण: ${res.episode?.episodeCode || '-'}`
              : `नवीन बालक लाभार्थी नोंदवला! आयडी: ${res.beneficiary.beneficiaryCode}`,
          type: 'success',
        });
        setJustRegisteredBen(res.beneficiary);
        setChildName('');
        setFullNameEnglish('');
        setMotherName('');
        setFatherName('');
        setGuardianName('');
        setHusbandMobile('');
        setDob('');
        setMobile('');
        setAadhaarNumber('');
        setCaste('');
        setBloodGroup('');
        setRhFactor('');
        setPlannedDeliveryPlace('');
        setAddress('');
        setAnganwadi('');
        setMcDate('');
        setEddDate('');
        setExpectedDeliveryPlace('');
        setHospitalName('');
        setGravidaPara('');
        setGravida('');
        setPara('');
        setAbortions('');
        setLivingChildren('');
        setPreviousPregnancyHistory('');
        setPreviousComplications('');
      }
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'नोंदणी करताना त्रुटी आली.');
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const todayMatchingSessions = useMemo(() => {
    if (!db || !justRegisteredBen) return [];
    const todayIST = getTodayIST();
    const open = db.vaccinationSessions.filter(
      (s) => s.sessionDate === todayIST && getSessionEditStatus(s).isOpen
    );
    const sameVillage = open.filter((s) => s.villageId === justRegisteredBen.villageId);
    if (sameVillage.length > 0) return sameVillage;
    const sameSc = open.filter((s) => s.subcentreId === justRegisteredBen.subcentreId);
    return sameSc.length > 0 ? sameSc : open;
  }, [db, justRegisteredBen]);

  return (
    <div className="app-page max-w-4xl">
      <PageHeader
        title={editId ? 'लाभार्थी कायमस्वरूपी प्रोफाइल दुरुस्ती' : 'नवीन लाभार्थी नोंदणी'}
        subtitle="कायमस्वरूपी माहिती एकदाच जतन होईल"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {beneficiaryType === 'PREGNANT_WOMAN' && (
              <button
                type="button"
                onClick={() => navigate('/pregnant-women')}
                className="app-btn-secondary text-xs"
              >
                गरोदर माता यादी पहा →
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/beneficiaries')}
              className="app-btn-secondary text-xs"
            >
              लाभार्थी यादी पहा →
            </button>
          </div>
        }
      />

      <div className="app-card app-card-body space-y-5">

      {/* Category Switch */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600 mr-1">लाभार्थी प्रकार:</span>
        <button
          type="button"
          disabled={Boolean(editId)}
          onClick={() => handleSwitchType('CHILD')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap disabled:opacity-75 ${
            beneficiaryType === 'CHILD'
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Baby className="w-4 h-4" /> बालक लाभार्थी (Child)
        </button>
        <button
          type="button"
          disabled={Boolean(editId)}
          onClick={() => handleSwitchType('PREGNANT_WOMAN')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap disabled:opacity-75 ${
            beneficiaryType === 'PREGNANT_WOMAN'
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <HeartPulse className="w-4 h-4" /> गरोदर माता (Pregnant Woman)
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleValidateAndAskConfirm} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {beneficiaryType === 'PREGNANT_WOMAN' ? 'मातेचे पूर्ण नाव *' : 'बालकाचे पूर्ण नाव *'}
            </label>
            <input
              required
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {beneficiaryType === 'CHILD' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  पालक / अभिभावकाचे पूर्ण नाव *
                </label>
                <input
                  required
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">आईचे नाव *</label>
                <input
                  required
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  वडिलांचे नाव (ऐच्छिक)
                </label>
                <input
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  जन्मतारीख * <span className="text-xs text-teal-700">(सध्याचे वय: {currentAge})</span>
                </label>
                <input
                  type="date"
                  required
                  max={getTodayIST()}
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">लिंग *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as BeneficiaryGender)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="मुलगा">मुलगा</option>
                  <option value="मुलगी">मुलगी</option>
                  <option value="इतर">इतर</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  मातेचे पूर्ण नाव (English)
                </label>
                <input
                  value={fullNameEnglish}
                  onChange={(e) => setFullNameEnglish(e.target.value)}
                  placeholder="Full Name in English"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">पतीचे पूर्ण नाव *</label>
                <input
                  required
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  पतीचा मोबाईल क्रमांक
                </label>
                <input
                  maxLength={10}
                  value={husbandMobile}
                  onChange={(e) => setHusbandMobile(e.target.value)}
                  placeholder="१० अंकी मोबाईल (ऐच्छिक)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  मातेची जन्मतारीख{' '}
                  <span className="text-xs text-teal-700">(वय: {currentAge})</span>
                </label>
                <input
                  type="date"
                  max={getTodayIST()}
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">रक्तगट व Rh Factor</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">रक्तगट</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                  <select
                    value={rhFactor}
                    onChange={(e) => setRhFactor(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Rh Factor</option>
                    {RH_FACTORS.map((rh) => (
                      <option key={rh} value={rh}>{rh}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  नियोजित प्रसूती ठिकाण (कायमस्वरूपी)
                </label>
                <input
                  list="planned-delivery-places"
                  value={plannedDeliveryPlace}
                  onChange={(e) => {
                    setPlannedDeliveryPlace(e.target.value);
                    if (!expectedDeliveryPlace) setExpectedDeliveryPlace(e.target.value);
                  }}
                  placeholder="उदा. प्राथमिक आरोग्य केंद्र भादा"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <datalist id="planned-delivery-places">
                  {PLANNED_DELIVERY_PLACES.map((pl) => (
                    <option key={pl} value={pl} />
                  ))}
                </datalist>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {beneficiaryType === 'PREGNANT_WOMAN' ? 'मोबाईल क्रमांक *' : 'पालकांचा मोबाईल क्रमांक *'}
            </label>
            <input
              required
              maxLength={10}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="१० अंकी मोबाईल क्रमांक"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {beneficiaryType === 'PREGNANT_WOMAN'
                ? 'आधार क्रमांक (ऐच्छिक — संरक्षित)'
                : 'पालकांचा आधार क्रमांक (ऐच्छिक — संरक्षित)'}
            </label>
            {editId && !aadhaarAuthorized ? (
              <input
                disabled
                value={existingMaskedAadhaar || 'नोंदवलेला नाही'}
                className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm font-mono-tabular text-slate-600"
              />
            ) : (
              <div className="flex gap-2">
                <input
                  type={!editId || revealEditAadhaar ? 'text' : 'password'}
                  maxLength={12}
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  placeholder="१२ अंकी आधार क्रमांक (गरज असल्यासच)"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
                {editId && aadhaarAuthorized && (
                  <button
                    type="button"
                    onClick={() => setRevealEditAadhaar((p) => !p)}
                    className="px-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                    title="आधार पहा / लपवा"
                  >
                    {revealEditAadhaar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">जात (Caste)</label>
            <input
              value={caste}
              onChange={(e) => setCaste(e.target.value)}
              placeholder="उदा. मराठा, महार, मातंग..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">प्रवर्ग (Category)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
            label="गाव (निवडल्यास उपकेंद्र आपोआप निवडले जाईल)"
            required
            value={villageId}
            onChange={(val) => {
              setVillageId(val);
              const matched = db?.villages.find((v) => v.id === val);
              if (matched && !scopedSubcentre) {
                setSubcentreId(matched.subcentreId);
              }
            }}
            options={filteredVillages.map((v) => ({
              value: v.id,
              label: v.name,
              sublabel: `${v.subcentreName} · ${v.villageCode}`,
            }))}
          />

          <SearchableSelect
            label="उपकेंद्र"
            required
            disabled={Boolean(scopedSubcentre)}
            value={subcentreId}
            onChange={(val) => {
              setSubcentreId(val);
              const currentVil = db?.villages.find((v) => v.id === villageId);
              if (currentVil && currentVil.subcentreId !== val) {
                setVillageId('');
              }
            }}
            options={activeSubcentres.map((s) => ({ value: s.id, label: s.name, sublabel: s.code }))}
          />

          {beneficiaryType === 'CHILD' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">अंगणवाडी (ऐच्छिक)</label>
              <input
                value={anganwadi}
                onChange={(e) => setAnganwadi(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">नोंदणी तारीख *</label>
            <input
              type="date"
              required
              value={registrationDate}
              onChange={(e) => setRegistrationDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">संपूर्ण पत्ता *</label>
            <input
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">लाभार्थी स्थिती</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BeneficiaryStatus)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="सक्रिय">सक्रिय</option>
              <option value="स्थलांतरित">स्थलांतरित</option>
              <option value="पूर्ण">पूर्ण</option>
              <option value="निष्क्रिय">निष्क्रिय</option>
            </select>
          </div>
        </div>

        {/* Pregnancy Episode fields on new Pregnant Woman registration */}
        {beneficiaryType === 'PREGNANT_WOMAN' && !editId && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-teal-800">
              गर्भधारणा प्रकरण तपशील (Pregnancy Episode Details)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  MC दिनांक (LMP) *
                </label>
                <input
                  type="date"
                  required
                  value={mcDate}
                  onChange={(e) => {
                    const mc = e.target.value;
                    setMcDate(mc);
                    setEddDate(calculateEddFromMcDate(mc));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  EDD (अपेक्षित प्रसूती दिनांक) *
                </label>
                <input
                  type="date"
                  required
                  value={eddDate}
                  onChange={(e) => setEddDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  अपेक्षित प्रसूती ठिकाण *
                </label>
                <input
                  required
                  list="planned-delivery-places"
                  value={expectedDeliveryPlace}
                  onChange={(e) => {
                    setExpectedDeliveryPlace(e.target.value);
                    setPlannedDeliveryPlace(e.target.value);
                  }}
                  placeholder="उदा. प्राथमिक आरोग्य केंद्र भादा"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  प्रसूती रुग्णालय प्रकार *
                </label>
                <select
                  value={deliveryFacilityType}
                  onChange={(e) =>
                    setDeliveryFacilityType(e.target.value as DeliveryFacilityType)
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="Government">शासकीय (Government)</option>
                  <option value="Private">खाजगी (Private)</option>
                  <option value="Other">इतर (Other)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  रुग्णालयाचे नाव
                </label>
                <input
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="रुग्णालय / केंद्राचे नाव"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  G / P / A / L (Gravida, Para, Abortions, Living)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <input type="number" min={0} placeholder="G" value={gravida} onChange={(e) => setGravida(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm font-mono-tabular" />
                  <input type="number" min={0} placeholder="P" value={para} onChange={(e) => setPara(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm font-mono-tabular" />
                  <input type="number" min={0} placeholder="A" value={abortions} onChange={(e) => setAbortions(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm font-mono-tabular" />
                  <input type="number" min={0} placeholder="L" value={livingChildren} onChange={(e) => setLivingChildren(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm font-mono-tabular" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  मागील सिझेरियन (Previous LSCS)
                </label>
                <select
                  value={previousCaesarean}
                  onChange={(e) => setPreviousCaesarean(e.target.value as 'Yes' | 'No')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="No">नाही (No)</option>
                  <option value="Yes">होय (Yes)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  मागील गर्भधारणा इतिहास
                </label>
                <input
                  value={previousPregnancyHistory}
                  onChange={(e) => setPreviousPregnancyHistory(e.target.value)}
                  placeholder="मागील प्रसूती तपशील"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  मागील गर्भधारणेतील गुंतागुंत (Previous Complications — असल्यास)
                </label>
                <input
                  value={previousComplications}
                  onChange={(e) => setPreviousComplications(e.target.value)}
                  placeholder="उदा. Pre-eclampsia, PPH, गर्भपात..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="app-btn-primary px-6 py-2.5"
          >
            {editId
              ? 'कायमस्वरूपी प्रोफाइल अद्यतनित करा'
              : beneficiaryType === 'PREGNANT_WOMAN'
                ? 'गरोदर माता व गर्भधारणा नोंदणी करा'
                : 'बालक लाभार्थी नोंदणी करा'}
          </button>
        </div>
      </form>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={
          editId
            ? 'लाभार्थी माहिती अद्यतनित करायची का?'
            : 'नवीन लाभार्थी नोंदवायचा का?'
        }
        description={`नाव: ${childName} · मोबाईल: ${mobile} · प्रकार: ${
          beneficiaryType === 'PREGNANT_WOMAN' ? 'गरोदर माता' : 'बालक'
        }`}
        confirmLabel={editId ? 'होय, अद्यतनित करा' : 'होय, नोंदणी करा'}
        loading={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Post-Registration Modal to jump to Today's Session Dose Screen */}
      {justRegisteredBen && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <div className="app-modal max-w-lg p-0 overflow-hidden space-y-0">
            <div className="px-5 py-3.5 bg-teal-800 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                <h3 className="text-base font-bold">लाभार्थी नोंदणी यशस्वी झाली!</h3>
              </div>
              <button
                type="button"
                onClick={() => setJustRegisteredBen(null)}
                className="p-1.5 rounded text-teal-100 hover:text-white"
                aria-label="बंद करा"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="p-3.5 rounded-lg bg-teal-50/70 border border-teal-200 space-y-1">
                <div className="font-bold text-slate-900">{justRegisteredBen.childName}</div>
                <div className="text-xs text-slate-700 font-mono-tabular">
                  आयडी: {justRegisteredBen.beneficiaryCode} · गाव: {justRegisteredBen.villageName} · मोबाईल: {justRegisteredBen.mobile}
                </div>
              </div>
              {todayMatchingSessions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-700">
                    आजच्या सत्रात या लाभार्थ्याला द्यावयाचे लसीकरण डोस / सेवा नोंदवण्यासाठी खालील बटणावर क्लिक करा:
                  </p>
                  <div className="space-y-2">
                    {todayMatchingSessions.slice(0, 3).map((ses) => (
                      <button
                        key={ses.id}
                        type="button"
                        onClick={() =>
                          navigate(`/today-session?sessionId=${ses.id}&recordBenId=${justRegisteredBen.id}`)
                        }
                        className="w-full app-btn-primary justify-between py-2.5 px-4 text-xs"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Syringe className="w-4 h-4" /> आजचे डोस नोंदवा ({ses.villageName} · {ses.sessionCode})
                        </span>
                        <span>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  आजच्या दिनांकासाठी खुले लसीकरण सत्र आढळले नाही. आपण 'आजचे लसीकरण सत्र' पानावरून सत्र निवडून डोस नोंदवू शकता.
                </p>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setJustRegisteredBen(null)}
                className="app-btn-secondary"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
