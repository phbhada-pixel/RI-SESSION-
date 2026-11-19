import React, { useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import { getTodayIST } from '../utils/dateUtils';
import { formatNumberIN } from '../utils/localeUtils';
import { evaluateBeneficiaryEligibility } from '../utils/eligibilityEngine';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { Toast } from '../components/Toast';

export const DashboardPage: React.FC = () => {
  const { db, currentUser, uploadExcelToSheet, seedStandardNIS } = useSheetData();

  const [showFilters, setShowFilters] = useState(false);
  const [subcentreFilter, setSubcentreFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [vaccineFilter, setVaccineFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'APPEND' | 'REPLACE'>('APPEND');
  const [confirmSeedOpen, setConfirmSeedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  const today = getTodayIST();
  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId : '';

  const effectiveSubcentre = scopedSubcentre || subcentreFilter;

  const activeFilterCount = [
    fromDate,
    toDate,
    !scopedSubcentre ? subcentreFilter : '',
    villageFilter,
    vaccineFilter,
  ].filter(Boolean).length;

  const filteredVillages = useMemo(() => {
    if (!db) return [];
    return effectiveSubcentre
      ? db.villages.filter((v) => v.subcentreId === effectiveSubcentre)
      : db.villages;
  }, [db, effectiveSubcentre]);

  const stats = useMemo(() => {
    if (!db) {
      return {
        totalBeneficiaries: 0,
        todayPlannedSessions: 0,
        completedSessions: 0,
        pendingSessions: 0,
        totalDosesAdministered: 0,
        dueBeneficiariesCount: 0,
        chartData: [] as Array<{ name: string; doses: number }>,
        validatedScheduleCount: 0,
      };
    }

    const fBeneficiaries = db.beneficiaries.filter(
      (b) =>
        (!effectiveSubcentre || b.subcentreId === effectiveSubcentre) &&
        (!villageFilter || b.villageId === villageFilter)
    );

    const fSessions = db.vaccinationSessions.filter(
      (s) =>
        (!effectiveSubcentre || s.subcentreId === effectiveSubcentre) &&
        (!villageFilter || s.villageId === villageFilter) &&
        (!fromDate || s.sessionDate >= fromDate) &&
        (!toDate || s.sessionDate <= toDate)
    );

    const fRecords = db.vaccinationRecords.filter(
      (r) =>
        (!effectiveSubcentre || r.subcentreId === effectiveSubcentre) &&
        (!villageFilter || r.villageId === villageFilter) &&
        (!vaccineFilter || r.vaccineId === vaccineFilter) &&
        (!fromDate || r.administeredDate >= fromDate) &&
        (!toDate || r.administeredDate <= toDate)
    );

    const recMap = new Map<string, typeof db.vaccinationRecords>();
    for (const r of db.vaccinationRecords) {
      const arr = recMap.get(r.beneficiaryId) || [];
      arr.push(r);
      recMap.set(r.beneficiaryId, arr);
    }

    let dueBeneficiariesCount = 0;
    for (const b of fBeneficiaries.filter(
      (ben) => ben.status === 'सक्रिय' && (ben.beneficiaryType || 'CHILD') !== 'PREGNANT_WOMAN'
    )) {
      const res = evaluateBeneficiaryEligibility(
        b,
        today,
        db.vaccineSchedule,
        recMap.get(b.id) || []
      );
      const hasMatch = vaccineFilter
        ? res.dueDoses.some((d) => d.schedule.vaccineId === vaccineFilter)
        : res.dueDoses.length > 0;
      if (hasMatch) dueBeneficiariesCount += 1;
    }

    const doseChartMap = new Map<string, number>();
    for (const r of fRecords) {
      doseChartMap.set(r.vaccineName, (doseChartMap.get(r.vaccineName) || 0) + 1);
    }

    return {
      totalBeneficiaries: fBeneficiaries.length,
      todayPlannedSessions: fSessions.filter(
        (s) => s.sessionDate === today && s.status !== 'पूर्ण'
      ).length,
      completedSessions: fSessions.filter((s) => s.status === 'पूर्ण').length,
      pendingSessions: fSessions.filter((s) => s.status === 'नियोजित' || s.status === 'सुरू').length,
      totalDosesAdministered: fRecords.length,
      dueBeneficiariesCount,
      chartData: Array.from(doseChartMap.entries()).map(([name, doses]) => ({ name, doses })),
      validatedScheduleCount: db.vaccineSchedule.filter((s) => s.isActive && s.isValidated).length,
    };
  }, [
    db,
    effectiveSubcentre,
    villageFilter,
    vaccineFilter,
    fromDate,
    toDate,
    today,
  ]);

  if (!db) return null;

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    if (!scopedSubcentre) setSubcentreFilter('');
    setVillageFilter('');
    setVaccineFilter('');
  };

  const handleConfirmUpload = async () => {
    if (!pendingUploadFile) return;
    setBusy(true);
    try {
      const res = await uploadExcelToSheet(pendingUploadFile, uploadMode);
      setToast({
        msg: `प्रणालीत ${res.rowCount} ओळी अपलोड झाल्या.`,
        type: 'success',
      });
      setPendingUploadFile(null);
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'अपलोड करताना त्रुटी आली.',
        type: 'error',
      });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmSeedNIS = async () => {
    setBusy(true);
    try {
      await seedStandardNIS();
      setToast({ msg: 'राष्ट्रीय लसीकरण वेळापत्रक (NIS) जतन केले.', type: 'success' });
      setConfirmSeedOpen(false);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-page">
      {/* Compact Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">डॅशबोर्ड</h1>
          <p className="text-xs text-slate-500">दैनिक लसीकरण व लाभार्थी सारांश</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/maternal-dashboard" className="app-btn-soft text-xs">
            माता डॅशबोर्ड
          </Link>
          <Link to="/today-session" className="app-btn-primary text-xs">
            <CalendarCheck className="w-4 h-4 shrink-0" /> आजचे सत्र
          </Link>

          <button
            type="button"
            onClick={() => setShowFilters((p) => !p)}
            className={`app-btn-secondary text-xs ${
              activeFilterCount > 0 ? 'border-teal-700 text-teal-800 bg-teal-50/60' : ''
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            फिल्टर{activeFilterCount > 0 ? ` (${formatNumberIN(activeFilterCount)})` : ''}
            {showFilters ? (
              <ChevronUp className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            )}
          </button>

          {currentUser && ['ADMIN', 'DATA_OPERATOR'].includes(currentUser.role) && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPendingUploadFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="app-btn-soft text-xs"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" /> Excel अपलोड
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapsible Filter Panel */}
      {showFilters && (
        <div className="app-card p-3.5 md:p-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="app-label">पासून दिनांक</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="app-input font-mono-tabular"
              />
            </div>
            <div>
              <label className="app-label">पर्यंत दिनांक</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="app-input font-mono-tabular"
              />
            </div>
            <div>
              <label className="app-label">उपकेंद्र</label>
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
            </div>
            <div>
              <label className="app-label">गाव</label>
              <select
                value={villageFilter}
                onChange={(e) => setVillageFilter(e.target.value)}
                className="app-input"
              >
                <option value="">सर्व गावे</option>
                {filteredVillages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 lg:col-span-1">
              <label className="app-label">लस</label>
              <select
                value={vaccineFilter}
                onChange={(e) => setVaccineFilter(e.target.value)}
                className="app-input"
              >
                <option value="">सर्व लसी</option>
                {db.vaccineMaster.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vaccineName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                फिल्टर रीसेट करा
              </button>
            </div>
          )}
        </div>
      )}

      {/* Critical Setup Alerts (only shown when action is actually missing) */}
      {stats.validatedScheduleCount === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs md:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">लसीकरण वेळापत्रक प्रमाणित नाही:</span> पात्रता तपासणीसाठी
              NIS वेळापत्रक प्रमाणित करा.
            </span>
          </div>
          {currentUser?.role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => setConfirmSeedOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              NIS वेळापत्रक भरा
            </button>
          )}
        </div>
      )}

      {db.subcentres.length === 0 && currentUser?.role === 'ADMIN' && (
        <div className="app-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <FileSpreadsheet className="w-4 h-4 text-teal-700 shrink-0" />
            <span>उपकेंद्रे व गावे सेटअप करण्यासाठी Settings उघडा.</span>
          </div>
          <Link to="/settings" className="app-btn-primary text-xs">
            Settings उघडा
          </Link>
        </div>
      )}

      {/* 4 Focused KPI Cards (2x2 on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          to="/beneficiaries"
          className="app-card p-3.5 md:p-4 hover:border-teal-600/50 transition-colors block"
        >
          <div className="text-xs font-medium text-slate-500">एकूण लाभार्थी</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono-tabular">
            {formatNumberIN(stats.totalBeneficiaries)}
          </div>
        </Link>

        <Link
          to="/sessions"
          className="app-card p-3.5 md:p-4 hover:border-teal-600/50 transition-colors block"
        >
          <div className="text-xs font-medium text-slate-500">आजची नियोजित सत्रे</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono-tabular">
            {formatNumberIN(stats.todayPlannedSessions)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono-tabular">
            पूर्ण: {formatNumberIN(stats.completedSessions)} · प्रलंबित:{' '}
            {formatNumberIN(stats.pendingSessions)}
          </div>
        </Link>

        <div className="app-card p-3.5 md:p-4">
          <div className="text-xs font-medium text-slate-500">दिलेले लसीकरण डोस</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono-tabular">
            {formatNumberIN(stats.totalDosesAdministered)}
          </div>
        </div>

        <Link
          to="/due-vaccinations"
          className="app-card p-3.5 md:p-4 hover:border-teal-600/50 transition-colors block"
        >
          <div className="text-xs font-medium text-slate-500">देय लाभार्थी (Due)</div>
          <div className="text-2xl font-bold text-teal-800 mt-1 font-mono-tabular">
            {formatNumberIN(stats.dueBeneficiariesCount)}
          </div>
        </Link>
      </div>

      {/* Vaccine Dose Chart */}
      <div className="app-card app-card-body">
        <h3 className="app-section-title mb-3">लसनिहाय दिलेले डोस</h3>
        {stats.chartData.length === 0 ? (
          <EmptyState message="अद्याप कोणतेही लसीकरण डोस नोंदवलेले नाहीत." />
        ) : (
          <div className="h-64 md:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="doses" name="दिलेले डोस" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Excel Upload Confirmation */}
      {pendingUploadFile && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <div className="app-modal max-w-md">
            <h3 className="text-base font-bold text-slate-900">प्रणालीत Excel डेटा अपलोड करा</h3>
            <p className="text-sm text-slate-700">
              फाइल: <span className="font-semibold">{pendingUploadFile.name}</span>. कृपया अपलोड
              पद्धत निवडा:
            </p>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={uploadMode === 'APPEND'}
                  onChange={() => setUploadMode('APPEND')}
                />
                <span>नवीन ओळी शेवटी जोडा (Append)</span>
              </label>
              <label className="flex items-center gap-2 text-rose-800 cursor-pointer">
                <input
                  type="radio"
                  checked={uploadMode === 'REPLACE'}
                  onChange={() => setUploadMode('REPLACE')}
                />
                <span>जुना डेटा बदलून नवीन ठेवा (Replace)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPendingUploadFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="app-btn-secondary px-4 py-2 text-sm"
              >
                रद्द करा
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmUpload}
                className="app-btn-primary text-sm"
              >
                {busy ? 'अपलोड होत आहे...' : 'जतन करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmSeedOpen}
        title="NIS वेळापत्रक प्रणालीत भरा?"
        description="हे राष्ट्रीय लसीकरण वेळापत्रक (BCG, OPV, Penta, Rota, fIPV, PCV, MR, DPT, Td) प्रणालीत जतन करेल."
        confirmLabel="होय, वेळापत्रक भरा"
        loading={busy}
        onConfirm={handleConfirmSeedNIS}
        onCancel={() => setConfirmSeedOpen(false)}
      />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
