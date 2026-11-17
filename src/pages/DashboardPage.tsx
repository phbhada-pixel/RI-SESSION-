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
import { Download, Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import { getTodayIST } from '../utils/dateUtils';
import { formatNumberIN } from '../utils/localeUtils';
import { evaluateBeneficiaryEligibility } from '../utils/eligibilityEngine';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';

export const DashboardPage: React.FC = () => {
  const { db, currentUser, downloadFullWorkbook, uploadExcelToSheet, seedStandardNIS } =
    useSheetData();

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
        totalSubcentres: 0,
        totalVillages: 0,
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
      totalSubcentres: effectiveSubcentre
        ? 1
        : db.subcentres.filter((s) => s.isActive).length,
      totalVillages: villageFilter ? 1 : filteredVillages.filter((v) => v.isActive).length,
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
    filteredVillages,
    today,
  ]);

  if (!db) return null;

  const cards = [
    { label: 'एकूण लाभार्थी', value: stats.totalBeneficiaries },
    { label: 'एकूण उपकेंद्रे', value: stats.totalSubcentres },
    { label: 'एकूण गावे', value: stats.totalVillages },
    { label: 'आजची नियोजित लसीकरण सत्रे', value: stats.todayPlannedSessions },
    { label: 'पूर्ण झालेली सत्रे', value: stats.completedSessions },
    { label: 'प्रलंबित लसीकरण सत्रे', value: stats.pendingSessions },
    { label: 'एकूण दिलेले लसीकरण डोस', value: stats.totalDosesAdministered },
    { label: 'देय लसीकरण असलेले लाभार्थी', value: stats.dueBeneficiariesCount },
  ];

  const handleConfirmUpload = async () => {
    if (!pendingUploadFile) return;
    setBusy(true);
    try {
      const res = await uploadExcelToSheet(pendingUploadFile, uploadMode);
      setToast({
        msg: `Google Sheet मध्ये ${res.rowCount} ओळी अपलोड झाल्या (${res.tabsUpdated.join(', ')}).`,
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
      setToast({ msg: 'राष्ट्रीय लसीकरण वेळापत्रक (NIS) Google Sheet मध्ये जतन केले.', type: 'success' });
      setConfirmSeedOpen(false);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">डॅशबोर्ड (Dashboard)</h2>
          <p className="text-xs text-slate-500">
            प्राथमिक आरोग्य केंद्र भादा · Google Sheet मधील थेट आकडेवारी
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" /> Excel ते Google Sheet अपलोड
          </button>
          <button
            type="button"
            onClick={downloadFullWorkbook}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4" /> संपूर्ण Sheet डाउनलोड (.xlsx)
          </button>
        </div>
      </div>

      {stats.validatedScheduleCount === 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">लसीकरण वेळापत्रक अद्याप प्रमाणित नाही:</span>{' '}
              पात्रता तपासणीसाठी Vaccine Master मध्ये किमान एक लस वेळापत्रक प्रमाणित करणे आवश्यक आहे.
            </div>
          </div>
          {currentUser?.role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => setConfirmSeedOpen(true)}
              className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              NIS वेळापत्रक Sheet मध्ये भरा
            </button>
          )}
        </div>
      )}

      {db.subcentres.length === 0 && currentUser?.role === 'ADMIN' && (
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5 text-slate-700">
            <FileSpreadsheet className="w-5 h-5 text-teal-700 shrink-0" />
            <span>
              तुमच्या Google Sheet मध्ये अद्याप उपकेंद्रे व गावे नोंदलेली नाहीत. पुढे जाण्यासाठी मास्टर माहिती भरा.
            </span>
          </div>
          <Link
            to="/settings"
            className="px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Settings मध्ये सेटअप करा
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">पासून दिनांक</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">पर्यंत दिनांक</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">उपकेंद्र</label>
          <select
            disabled={Boolean(scopedSubcentre)}
            value={effectiveSubcentre}
            onChange={(e) => {
              setSubcentreFilter(e.target.value);
              setVillageFilter('');
            }}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white disabled:bg-slate-100"
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
          <label className="text-xs font-medium text-slate-600 block mb-1">गाव</label>
          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white"
          >
            <option value="">सर्व गावे</option>
            {filteredVillages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">लस</label>
          <select
            value={vaccineFilter}
            onChange={(e) => setVaccineFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white"
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

      {/* 8 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">{c.label}</div>
            <div className="text-2xl font-bold text-slate-900 mt-1.5 font-mono-tabular">
              {formatNumberIN(c.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">लसनिहाय दिलेले डोस</h3>
        {stats.chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-slate-500">
            अद्याप कोणतेही लसीकरण डोस नोंदवलेले नाहीत.
          </div>
        ) : (
          <div className="h-72 w-full">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Google Sheet मध्ये Excel अपलोड करा</h3>
            <p className="text-sm text-slate-700">
              फाइल: <span className="font-semibold">{pendingUploadFile.name}</span>. कृपया अपलोड
              पद्धत निवडा:
            </p>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={uploadMode === 'APPEND'}
                  onChange={() => setUploadMode('APPEND')}
                />
                <span>नवीन ओळी शेवटी जोडा (Append)</span>
              </label>
              <label className="flex items-center gap-2 text-rose-800">
                <input
                  type="radio"
                  checked={uploadMode === 'REPLACE'}
                  onChange={() => setUploadMode('REPLACE')}
                />
                <span>संबधित टॅबमधील जुना डेटा बदलून नवीन ठेवा (Replace)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPendingUploadFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
              >
                रद्द करा
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmUpload}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60"
              >
                {busy ? 'अपलोड होत आहे...' : 'Google Sheet मध्ये जतन करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmSeedOpen}
        title="NIS वेळापत्रक Google Sheet मध्ये भरा?"
        description="हे राष्ट्रीय लसीकरण वेळापत्रक (BCG, OPV, Penta, Rota, fIPV, PCV, MR, DPT, Td) थेट तुमच्या Google Sheet मधील vaccineMaster आणि vaccineSchedule टॅबमध्ये जतन करेल."
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
