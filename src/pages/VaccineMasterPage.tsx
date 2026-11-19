import React, { useState } from 'react';
import { CheckCircle2, Edit, PlusCircle, Sparkles } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { AgeUnit, ApplicableCategory, VaccineMaster, VaccineSchedule } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';

export const VaccineMasterPage: React.FC = () => {
  const { db, currentUser, saveVaccineMaster, saveVaccineSchedule, seedStandardNIS } = useSheetData();
  const [activeTab, setActiveTab] = useState<'SCHEDULE' | 'MASTER'>('SCHEDULE');

  // Master Form
  const [editMaster, setEditMaster] = useState<VaccineMaster | null>(null);
  const [vaccineName, setVaccineName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [category, setCategory] = useState<ApplicableCategory>('Child');
  const [requiresBatchNumber, setRequiresBatchNumber] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [masterActive, setMasterActive] = useState(true);

  // Schedule Form
  const [editSchedule, setEditSchedule] = useState<VaccineSchedule | null>(null);
  const [schVaccineId, setSchVaccineId] = useState('');
  const [doseName, setDoseName] = useState('');
  const [doseOrder, setDoseOrder] = useState(1);
  const [previousDoseId, setPreviousDoseId] = useState('');
  const [minAgeValue, setMinAgeValue] = useState(0);
  const [minAgeUnit, setMinAgeUnit] = useState<AgeUnit>('DAYS');
  const [recommendedAgeValue, setRecommendedAgeValue] = useState(0);
  const [recommendedAgeUnit, setRecommendedAgeUnit] = useState<AgeUnit>('DAYS');
  const [maxAgeValue, setMaxAgeValue] = useState('');
  const [maxAgeUnit, setMaxAgeUnit] = useState<AgeUnit>('YEARS');
  const [minIntervalDays, setMinIntervalDays] = useState('');
  const [recommendedDueRuleText, setRecommendedDueRuleText] = useState('');
  const [isBooster, setIsBooster] = useState(false);
  const [isValidated, setIsValidated] = useState(true);
  const [schActive, setSchActive] = useState(true);

  const [confirmAction, setConfirmAction] = useState<'MASTER' | 'SCHEDULE' | 'SEED_NIS' | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  if (!db) return null;

  const isAdmin = currentUser?.role === 'ADMIN';

  const startEditMaster = (m: VaccineMaster) => {
    setEditMaster(m);
    setVaccineName(m.vaccineName);
    setShortCode(m.shortCode);
    setCategory(m.applicableCategory);
    setRequiresBatchNumber(m.requiresBatchNumber);
    setDisplayOrder(m.displayOrder);
    setMasterActive(m.isActive);
  };

  const resetMaster = () => {
    setEditMaster(null);
    setVaccineName('');
    setShortCode('');
    setCategory('Child');
    setRequiresBatchNumber(true);
    setDisplayOrder(db.vaccineMaster.length + 1);
    setMasterActive(true);
  };

  const startEditSchedule = (s: VaccineSchedule) => {
    setEditSchedule(s);
    setSchVaccineId(s.vaccineId);
    setDoseName(s.doseName);
    setDoseOrder(s.doseOrder);
    setPreviousDoseId(s.previousDoseId || '');
    setMinAgeValue(s.minAgeValue);
    setMinAgeUnit(s.minAgeUnit);
    setRecommendedAgeValue(s.recommendedAgeValue);
    setRecommendedAgeUnit(s.recommendedAgeUnit);
    setMaxAgeValue(s.maxAgeValue !== null && s.maxAgeValue !== undefined ? String(s.maxAgeValue) : '');
    setMaxAgeUnit(s.maxAgeUnit || 'YEARS');
    setMinIntervalDays(
      s.minIntervalDays !== null && s.minIntervalDays !== undefined ? String(s.minIntervalDays) : ''
    );
    setRecommendedDueRuleText(s.recommendedDueRuleText);
    setIsBooster(s.isBooster);
    setIsValidated(s.isValidated);
    setSchActive(s.isActive);
  };

  const resetSchedule = () => {
    setEditSchedule(null);
    setSchVaccineId('');
    setDoseName('');
    setDoseOrder(db.vaccineSchedule.length + 1);
    setPreviousDoseId('');
    setMinAgeValue(0);
    setMinAgeUnit('DAYS');
    setRecommendedAgeValue(0);
    setRecommendedAgeUnit('DAYS');
    setMaxAgeValue('');
    setMaxAgeUnit('YEARS');
    setMinIntervalDays('');
    setRecommendedDueRuleText('');
    setIsBooster(false);
    setIsValidated(true);
    setSchActive(true);
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      if (confirmAction === 'MASTER') {
        await saveVaccineMaster({
          id: editMaster?.id,
          vaccineName: vaccineName.trim(),
          shortCode: shortCode.trim(),
          applicableCategory: category,
          requiresBatchNumber,
          displayOrder,
          isActive: masterActive,
        });
        resetMaster();
        setToast({ msg: 'लस मास्टर जतन केले.', type: 'success' });
      } else if (confirmAction === 'SCHEDULE') {
        const vac = db.vaccineMaster.find((v) => v.id === schVaccineId);
        if (!vac) throw new Error('कृपया लस निवडा.');
        await saveVaccineSchedule({
          id: editSchedule?.id,
          vaccineId: vac.id,
          vaccineName: vac.vaccineName,
          doseName: doseName.trim(),
          doseOrder,
          previousDoseId: previousDoseId || null,
          minAgeValue,
          minAgeUnit,
          recommendedAgeValue,
          recommendedAgeUnit,
          maxAgeValue: maxAgeValue ? Number(maxAgeValue) : null,
          maxAgeUnit: maxAgeValue ? maxAgeUnit : null,
          minIntervalDays: minIntervalDays ? Number(minIntervalDays) : null,
          recommendedDueRuleText: recommendedDueRuleText.trim(),
          isBooster,
          boosterInfo: '',
          applicableCategory: vac.applicableCategory,
          isValidated,
          isActive: schActive,
        });
        resetSchedule();
        setToast({ msg: 'लसीकरण वेळापत्रक जतन केले.', type: 'success' });
      } else if (confirmAction === 'SEED_NIS') {
        await seedStandardNIS();
        setToast({
          msg: 'राष्ट्रीय लसीकरण वेळापत्रक (NIS) यशस्वीरित्या भरले गेले.',
          type: 'success',
        });
      }
      setConfirmAction(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-page">
      <PageHeader
        title="Vaccine Master व वेळापत्रक प्रमाणीकरण"
        subtitle="पात्रता इंजिन केवळ प्रमाणित (Validated) व सक्रिय लस वेळापत्रक नियमांवर चालते"
        actions={
          isAdmin ? (
            <button
              type="button"
              onClick={() => setConfirmAction('SEED_NIS')}
              className="app-btn-primary text-xs"
            >
              <Sparkles className="w-4 h-4" /> राष्ट्रीय लसीकरण वेळापत्रक (NIS) भरा
            </button>
          ) : undefined
        }
      />

      <div className="flex gap-1.5 p-1 bg-slate-200/70 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('SCHEDULE')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'SCHEDULE' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          डोस वेळापत्रक (Vaccine Schedule)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('MASTER')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'MASTER' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          मूळ लस यादी (Vaccine Master)
        </button>
      </div>

      {activeTab === 'MASTER' ? (
        <div className="space-y-5">
          {isAdmin && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmAction('MASTER');
              }}
              className="app-card app-card-body space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="app-section-title">
                  <PlusCircle className="w-4 h-4 text-teal-700" />
                  {editMaster ? 'लस माहिती दुरुस्ती' : 'नवीन लस जोडा'}
                </div>
                {editMaster && (
                  <button
                    type="button"
                    onClick={resetMaster}
                    className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0"
                  >
                    रद्द करा
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="app-label">लसीचे नाव *</label>
                  <input
                    required
                    value={vaccineName}
                    onChange={(e) => setVaccineName(e.target.value)}
                    className="app-input"
                  />
                </div>
                <div>
                  <label className="app-label">संक्षिप्त कोड *</label>
                  <input
                    required
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value)}
                    className="app-input font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="app-label">प्रवर्ग</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ApplicableCategory)}
                    className="app-input"
                  >
                    <option value="Child">Child</option>
                    <option value="Pregnant_Woman">Pregnant_Woman</option>
                    <option value="Adolescent">Adolescent</option>
                    <option value="All">All</option>
                  </select>
                </div>
                <div>
                  <label className="app-label">क्रम</label>
                  <input
                    type="number"
                    min={1}
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    className="app-input font-mono-tabular"
                  />
                </div>
                <div className="flex flex-col gap-1.5 pb-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresBatchNumber}
                      onChange={(e) => setRequiresBatchNumber(e.target.checked)}
                      className="w-4 h-4 accent-teal-700"
                    />
                    बॅच क्रमांक आवश्यक
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={masterActive}
                      onChange={(e) => setMasterActive(e.target.checked)}
                      className="w-4 h-4 accent-teal-700"
                    />
                    सक्रिय (Active)
                  </label>
                </div>
              </div>

              <button type="submit" className="app-btn-primary">
                {editMaster ? 'अद्यतनित करा' : 'जतन करा'}
              </button>
            </form>
          )}

          <div className="app-table-wrap">
            {db.vaccineMaster.length === 0 ? (
              <EmptyState message="अद्याप कोणतीही लस नोंदवलेली नाही." />
            ) : (
              <table className="app-table">
                <thead className="app-thead">
                  <tr>
                    <th className="app-th">क्रम</th>
                    <th className="app-th">लस नाव</th>
                    <th className="app-th">कोड</th>
                    <th className="app-th">प्रवर्ग</th>
                    <th className="app-th">स्थिती</th>
                    {isAdmin && <th className="app-th text-right">दुरुस्ती</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.vaccineMaster.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="app-td font-mono-tabular text-xs">{m.displayOrder}</td>
                      <td className="app-td font-semibold text-slate-900">{m.vaccineName}</td>
                      <td className="app-td font-mono-tabular text-xs">{m.shortCode}</td>
                      <td className="app-td text-xs text-slate-600">{m.applicableCategory}</td>
                      <td className="app-td text-xs">
                        <span className={m.isActive ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-medium'}>
                          {m.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="app-td text-right">
                          <button
                            type="button"
                            onClick={() => startEditMaster(m)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
                          >
                            <Edit className="w-3.5 h-3.5" /> दुरुस्ती
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {isAdmin && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmAction('SCHEDULE');
              }}
              className="app-card app-card-body space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="app-section-title">
                  <PlusCircle className="w-4 h-4 text-teal-700" />
                  {editSchedule ? 'वेळापत्रक नियम दुरुस्ती' : 'नवीन डोस वेळापत्रक जोडा'}
                </div>
                {editSchedule && (
                  <button
                    type="button"
                    onClick={resetSchedule}
                    className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0"
                  >
                    रद्द करा
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="app-label">लस *</label>
                  <select
                    required
                    value={schVaccineId}
                    onChange={(e) => setSchVaccineId(e.target.value)}
                    className="app-input"
                  >
                    <option value="">निवडा...</option>
                    {db.vaccineMaster.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vaccineName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="app-label">डोस नाव *</label>
                  <input
                    required
                    value={doseName}
                    onChange={(e) => setDoseName(e.target.value)}
                    placeholder="उदा. Penta-1"
                    className="app-input"
                  />
                </div>
                <div>
                  <label className="app-label">डोस क्रम *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={doseOrder}
                    onChange={(e) => setDoseOrder(Number(e.target.value))}
                    className="app-input font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="app-label">मागील डोस (ऐच्छिक)</label>
                  <select
                    value={previousDoseId}
                    onChange={(e) => setPreviousDoseId(e.target.value)}
                    className="app-input"
                  >
                    <option value="">काहीही नाही</option>
                    {db.vaccineSchedule.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.doseName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="app-label">किमान वय</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={minAgeValue}
                      onChange={(e) => setMinAgeValue(Number(e.target.value))}
                      className="app-input w-20 px-2 font-mono-tabular"
                    />
                    <select
                      value={minAgeUnit}
                      onChange={(e) => setMinAgeUnit(e.target.value as AgeUnit)}
                      className="app-input flex-1 px-2"
                    >
                      <option value="DAYS">DAYS</option>
                      <option value="WEEKS">WEEKS</option>
                      <option value="MONTHS">MONTHS</option>
                      <option value="YEARS">YEARS</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="app-label">शिफारस वय</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={recommendedAgeValue}
                      onChange={(e) => setRecommendedAgeValue(Number(e.target.value))}
                      className="app-input w-20 px-2 font-mono-tabular"
                    />
                    <select
                      value={recommendedAgeUnit}
                      onChange={(e) => setRecommendedAgeUnit(e.target.value as AgeUnit)}
                      className="app-input flex-1 px-2"
                    >
                      <option value="DAYS">DAYS</option>
                      <option value="WEEKS">WEEKS</option>
                      <option value="MONTHS">MONTHS</option>
                      <option value="YEARS">YEARS</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="app-label">कमाल वय (ऐच्छिक)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={maxAgeValue}
                      onChange={(e) => setMaxAgeValue(e.target.value)}
                      className="app-input w-20 px-2 font-mono-tabular"
                    />
                    <select
                      value={maxAgeUnit}
                      onChange={(e) => setMaxAgeUnit(e.target.value as AgeUnit)}
                      className="app-input flex-1 px-2"
                    >
                      <option value="DAYS">DAYS</option>
                      <option value="WEEKS">WEEKS</option>
                      <option value="MONTHS">MONTHS</option>
                      <option value="YEARS">YEARS</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="app-label">किमान अंतर (दिवस)</label>
                  <input
                    type="number"
                    min={0}
                    value={minIntervalDays}
                    onChange={(e) => setMinIntervalDays(e.target.value)}
                    placeholder="उदा. 28"
                    className="app-input font-mono-tabular"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="app-label">मराठी नियम वर्णन *</label>
                  <input
                    required
                    value={recommendedDueRuleText}
                    onChange={(e) => setRecommendedDueRuleText(e.target.value)}
                    placeholder="उदा. ६ आठवडे"
                    className="app-input"
                  />
                </div>

                <div className="md:col-span-2 flex flex-wrap items-center gap-4 pt-5 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isBooster}
                      onChange={(e) => setIsBooster(e.target.checked)}
                      className="w-4 h-4 accent-teal-700"
                    />
                    बूस्टर डोस
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-emerald-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isValidated}
                      onChange={(e) => setIsValidated(e.target.checked)}
                      className="w-4 h-4 accent-teal-700"
                    />
                    प्रशासकाद्वारे प्रमाणित (Validated)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schActive}
                      onChange={(e) => setSchActive(e.target.checked)}
                      className="w-4 h-4 accent-teal-700"
                    />
                    सक्रिय
                  </label>
                </div>
              </div>

              <button type="submit" className="app-btn-primary">
                {editSchedule ? 'वेळापत्रक अद्यतनित करा' : 'वेळापत्रक जतन करा'}
              </button>
            </form>
          )}

          <div className="app-table-wrap">
            {db.vaccineSchedule.length === 0 ? (
              <EmptyState message='कोणतेही वेळापत्रक नोंदवलेले नाही. वरून "राष्ट्रीय लसीकरण वेळापत्रक (NIS) भरा" बटण वापरा.' />
            ) : (
              <table className="app-table">
                <thead className="app-thead">
                  <tr>
                    <th className="app-th">क्रम</th>
                    <th className="app-th">डोस</th>
                    <th className="app-th">किमान / शिफारस वय</th>
                    <th className="app-th">अंतर (दिवस)</th>
                    <th className="app-th">नियम</th>
                    <th className="app-th">प्रमाणित</th>
                    {isAdmin && <th className="app-th text-right">दुरुस्ती</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.vaccineSchedule.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="app-td font-mono-tabular text-xs">{s.doseOrder}</td>
                      <td className="app-td">
                        <div className="font-semibold text-slate-900">{s.doseName}</div>
                        <div className="text-xs text-slate-500">{s.vaccineName}</div>
                      </td>
                      <td className="app-td text-xs font-mono-tabular">
                        {s.minAgeValue} {s.minAgeUnit} · {s.recommendedAgeValue} {s.recommendedAgeUnit}
                      </td>
                      <td className="app-td text-xs font-mono-tabular">
                        {s.minIntervalDays ? `${s.minIntervalDays} दिवस` : '-'}
                      </td>
                      <td className="app-td text-xs text-slate-700">{s.recommendedDueRuleText}</td>
                      <td className="app-td text-xs">
                        {s.isValidated && s.isActive ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> प्रमाणित
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold">अप्रमाणित / निष्क्रिय</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="app-td text-right">
                          <button
                            type="button"
                            onClick={() => startEditSchedule(s)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
                          >
                            <Edit className="w-3.5 h-3.5" /> दुरुस्ती
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmAction)}
        title="प्रणालीत बदल जतन करायचे का?"
        description={
          confirmAction === 'SEED_NIS'
            ? 'राष्ट्रीय लसीकरण वेळापत्रक (BCG, OPV, Penta, Rota, fIPV, PCV, MR, DPT, Td) प्रणालीत जोडले जाईल.'
            : 'तुम्ही केलेले बदल प्रणालीत नोंदवले जातील.'
        }
        loading={busy}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
