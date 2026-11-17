import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CheckSquare, PlusCircle, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import { Beneficiary } from '../types';
import { formatDDMMYYYY, getSessionEditStatus } from '../utils/dateUtils';
import { evaluateBeneficiaryEligibility } from '../utils/eligibilityEngine';
import { SearchableSelect } from '../components/SearchableSelect';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';

export const SessionBeneficiarySearchPage: React.FC = () => {
  const { db, currentUser, addBeneficiaryToSession } = useSheetData();
  const [params] = useSearchParams();
  const preselectedSessionId = params.get('sessionId') || '';

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';

  const [subcentreId, setSubcentreId] = useState(scopedSubcentre);
  const [villageId, setVillageId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionId, setSessionId] = useState(preselectedSessionId);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllVillageBeneficiaries, setShowAllVillageBeneficiaries] = useState(false);

  const [confirmBen, setConfirmBen] = useState<Beneficiary | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  useEffect(() => {
    if (!db || !preselectedSessionId) return;
    const found = db.vaccinationSessions.find((s) => s.id === preselectedSessionId);
    if (found) {
      setSubcentreId(found.subcentreId);
      setVillageId(found.villageId);
      setSessionDate(found.sessionDate);
      setSessionId(found.id);
    }
  }, [db, preselectedSessionId]);

  const validatedScheduleCount = useMemo(
    () => (db ? db.vaccineSchedule.filter((s) => s.isActive && s.isValidated).length : 0),
    [db]
  );

  const activeSubcentres = useMemo(
    () => (db ? db.subcentres.filter((s) => s.isActive) : []),
    [db]
  );

  const filteredVillages = useMemo(
    () => (db ? db.villages.filter((v) => v.isActive && v.subcentreId === subcentreId) : []),
    [db, subcentreId]
  );

  const availableDates = useMemo(() => {
    if (!db) return [];
    const dates = new Set(
      db.vaccinationSessions
        .filter((s) => s.subcentreId === subcentreId && s.villageId === villageId)
        .map((s) => s.sessionDate)
    );
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [db, subcentreId, villageId]);

  const matchingSessions = useMemo(() => {
    if (!db) return [];
    return db.vaccinationSessions.filter(
      (s) =>
        s.subcentreId === subcentreId &&
        s.villageId === villageId &&
        s.sessionDate === sessionDate
    );
  }, [db, subcentreId, villageId, sessionDate]);

  const selectedSession = useMemo(
    () => matchingSessions.find((s) => s.id === sessionId) || null,
    [matchingSessions, sessionId]
  );

  const sessionEditStatus = selectedSession ? getSessionEditStatus(selectedSession) : null;

  const rosterIds = useMemo(() => {
    if (!db || !selectedSession) return new Set<string>();
    return new Set(
      db.sessionBeneficiaries
        .filter((sb) => sb.sessionId === selectedSession.id)
        .map((sb) => sb.beneficiaryId)
    );
  }, [db, selectedSession]);

  const evaluatedList = useMemo(() => {
    if (!db || !selectedSession) return [];
    const recMap = new Map<string, typeof db.vaccinationRecords>();
    for (const r of db.vaccinationRecords) {
      const arr = recMap.get(r.beneficiaryId) || [];
      arr.push(r);
      recMap.set(r.beneficiaryId, arr);
    }

    const q = searchQuery.trim().toLowerCase();
    return db.beneficiaries
      .filter(
        (b) =>
          b.status === 'सक्रिय' &&
          (b.beneficiaryType || 'CHILD') !== 'PREGNANT_WOMAN' &&
          b.villageId === selectedSession.villageId
      )
      .filter(
        (b) =>
          !q ||
          b.childName.toLowerCase().includes(q) ||
          b.beneficiaryCode.toLowerCase().includes(q) ||
          b.mobile.includes(q)
      )
      .map((b) =>
        evaluateBeneficiaryEligibility(
          b,
          selectedSession.sessionDate,
          db.vaccineSchedule,
          recMap.get(b.id) || []
        )
      )
      .filter((ev) => showAllVillageBeneficiaries || ev.isEligibleForSession);
  }, [db, selectedSession, searchQuery, showAllVillageBeneficiaries]);

  if (!db) return null;

  const handleConfirmAdd = async () => {
    if (!selectedSession || !confirmBen) return;
    setBusy(true);
    try {
      await addBeneficiaryToSession(selectedSession, confirmBen);
      setToast({
        msg: `${confirmBen.childName} सत्रात यशस्वीरित्या जोडले गेले.`,
        type: 'success',
      });
      setConfirmBen(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
      setConfirmBen(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">सत्रनिहाय लाभार्थी शोध</h2>
        <p className="text-xs text-slate-500">
          निवडलेल्या सत्राच्या तारखेनुसार लाभार्थ्याचे वय व देय लसीकरण पात्रता तपासा
        </p>
      </div>

      {validatedScheduleCount === 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <span className="font-semibold">लसीकरण वेळापत्रक प्रमाणित नाही:</span> प्रशासकाने अद्याप
            Vaccine Master मध्ये राष्ट्रीय लसीकरण वेळापत्रक (NIS) नियम प्रमाणित केलेले नाहीत.
          </div>
        </div>
      )}

      {/* 4-Step Filter Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <SearchableSelect
          label="१. उपकेंद्र निवडा"
          disabled={Boolean(scopedSubcentre)}
          value={subcentreId}
          onChange={(v) => {
            setSubcentreId(v);
            setVillageId('');
            setSessionDate('');
            setSessionId('');
          }}
          options={activeSubcentres.map((s) => ({ value: s.id, label: s.name, sublabel: s.code }))}
        />

        <SearchableSelect
          label="२. गाव निवडा"
          disabled={!subcentreId}
          value={villageId}
          onChange={(v) => {
            setVillageId(v);
            setSessionDate('');
            setSessionId('');
          }}
          options={filteredVillages.map((v) => ({ value: v.id, label: v.name }))}
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">३. सत्र दिनांक</label>
          <select
            disabled={!villageId}
            value={sessionDate}
            onChange={(e) => {
              setSessionDate(e.target.value);
              setSessionId('');
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white disabled:bg-slate-100"
          >
            <option value="">दिनांक निवडा...</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {formatDDMMYYYY(d)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">४. लसीकरण सत्र निवडा</label>
          <select
            disabled={!sessionDate}
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white disabled:bg-slate-100"
          >
            <option value="">सत्र निवडा...</option>
            {matchingSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sessionCode} - {s.location} ({s.sessionType})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedSession && sessionEditStatus && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
          <div className="space-y-0.5">
            <div className="font-semibold text-slate-900">
              सत्र: <span className="font-mono-tabular text-teal-800">{selectedSession.sessionCode}</span> ·{' '}
              {selectedSession.villageName} · {formatDDMMYYYY(selectedSession.sessionDate)}
            </div>
            <div className="text-xs text-slate-600">
              ठिकाण: {selectedSession.location} · ANM: {selectedSession.anmName || '-'} · सत्रात{' '}
              <span className="font-mono-tabular font-semibold">{rosterIds.size}</span> लाभार्थी समाविष्ट
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`text-xs font-semibold ${
                sessionEditStatus.isOpen ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {sessionEditStatus.labelMarathi} · {sessionEditStatus.remainingText}
            </span>
            <Link
              to={`/tick-sheet?sessionId=${selectedSession.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap"
            >
              <CheckSquare className="w-4 h-4" /> टिकमार्क शीट उघडा
            </Link>
          </div>
        </div>
      )}

      {/* Step 5: Eligible Beneficiaries List */}
      {selectedSession && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="नाव, आयडी किंवा मोबाईलद्वारे शोधा..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showAllVillageBeneficiaries}
                onChange={(e) => setShowAllVillageBeneficiaries(e.target.checked)}
              />
              गावातील सर्व लाभार्थी दाखवा (पात्र नसलेल्यांसह)
            </label>
          </div>

          <div className="overflow-x-auto">
            {evaluatedList.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                या सत्राच्या तारखेला पात्र असलेले कोणतेही लाभार्थी आढळले नाहीत.
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">लाभार्थी</th>
                    <th className="px-3 py-2.5 font-semibold">जन्मतारीख व सत्र दिनांकाचे वय</th>
                    <th className="px-3 py-2.5 font-semibold">आधी दिलेले डोस</th>
                    <th className="px-3 py-2.5 font-semibold">या सत्रात देय डोस</th>
                    <th className="px-3 py-2.5 font-semibold text-right">सत्रात जोडा</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evaluatedList.map((ev) => {
                    const alreadyAdded = rosterIds.has(ev.beneficiary.id);
                    return (
                      <tr key={ev.beneficiary.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{ev.beneficiary.childName}</div>
                          <div className="text-xs text-slate-500 font-mono-tabular">
                            {ev.beneficiary.beneficiaryCode} · आई: {ev.beneficiary.motherName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <div className="font-mono-tabular">{formatDDMMYYYY(ev.beneficiary.dob)}</div>
                          <div className="text-teal-800 font-semibold">{ev.ageOnTargetDateLabel}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {ev.administeredDoses.length === 0
                            ? 'कोणताही नाही'
                            : ev.administeredDoses.map((d) => d.schedule.doseName).join(', ')}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-amber-800">
                          {ev.dueDoses.length === 0
                            ? 'सध्या कोणताही डोस देय नाही'
                            : ev.dueDoses.map((d) => d.schedule.doseName).join(', ')}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {alreadyAdded ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="w-4 h-4" /> सत्रात समाविष्ट
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={!sessionEditStatus?.isOpen}
                              onClick={() => setConfirmBen(ev.beneficiary)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-40"
                            >
                              <PlusCircle className="w-3.5 h-3.5" /> सत्रात जोडा
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
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmBen)}
        title="लाभार्थी सत्रात समाविष्ट करायचा का?"
        description={`${confirmBen?.childName} (${confirmBen?.beneficiaryCode}) यांना सत्र ${selectedSession?.sessionCode} मध्ये समाविष्ट केले जाईल.`}
        confirmLabel="होय, सत्रात जोडा"
        loading={busy}
        onConfirm={handleConfirmAdd}
        onCancel={() => setConfirmBen(null)}
      />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
