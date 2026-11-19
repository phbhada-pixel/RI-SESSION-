import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CheckSquare, PlusCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import { Beneficiary } from '../types';
import { formatDDMMYYYY, getSessionEditStatus } from '../utils/dateUtils';
import { evaluateBeneficiaryEligibility } from '../utils/eligibilityEngine';
import { fuzzyFilterAndRank } from '../utils/fuzzySearch';
import { FuzzyAutocomplete } from '../components/FuzzyAutocomplete';
import { SearchableSelect } from '../components/SearchableSelect';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
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

  const baseEvaluatedList = useMemo(() => {
    if (!db || !selectedSession) return [];
    const recMap = new Map<string, typeof db.vaccinationRecords>();
    for (const r of db.vaccinationRecords) {
      const arr = recMap.get(r.beneficiaryId) || [];
      arr.push(r);
      recMap.set(r.beneficiaryId, arr);
    }

    return db.beneficiaries
      .filter(
        (b) =>
          b.status === 'सक्रिय' &&
          (b.beneficiaryType || 'CHILD') !== 'PREGNANT_WOMAN' &&
          b.villageId === selectedSession.villageId
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
  }, [db, selectedSession, showAllVillageBeneficiaries]);

  const evaluatedList = useMemo(() => {
    return fuzzyFilterAndRank(baseEvaluatedList, searchQuery, (ev) => [
      ev.beneficiary.childName,
      ev.beneficiary.beneficiaryCode,
      ev.beneficiary.motherName,
      ev.beneficiary.guardianName || ev.beneficiary.fatherName,
      ev.beneficiary.mobile,
      formatDDMMYYYY(ev.beneficiary.dob),
    ]);
  }, [baseEvaluatedList, searchQuery]);

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
    <div className="app-page">
      <PageHeader
        title="सत्रनिहाय लाभार्थी शोध"
        subtitle="निवडलेल्या सत्राच्या तारखेनुसार लाभार्थ्याचे वय व देय लसीकरण पात्रता तपासा"
      />

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
      <div className="app-card app-card-body grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <label className="app-label">३. सत्र दिनांक</label>
          <select
            disabled={!villageId}
            value={sessionDate}
            onChange={(e) => {
              setSessionDate(e.target.value);
              setSessionId('');
            }}
            className="app-input font-mono-tabular"
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
          <label className="app-label">४. लसीकरण सत्र निवडा</label>
          <select
            disabled={!sessionDate}
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="app-input"
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
        <div className="app-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
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
            <Link to={`/tick-sheet?sessionId=${selectedSession.id}`} className="app-btn-primary">
              <CheckSquare className="w-4 h-4" /> टिकमार्क शीट उघडा
            </Link>
          </div>
        </div>
      )}

      {/* Step 5: Eligible Beneficiaries List */}
      {selectedSession && (
        <div className="app-card app-card-body space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <FuzzyAutocomplete
              className="flex-1 max-w-md"
              value={searchQuery}
              onChange={setSearchQuery}
              items={baseEvaluatedList}
              getSearchFields={(ev) => [
                ev.beneficiary.childName,
                ev.beneficiary.beneficiaryCode,
                ev.beneficiary.motherName,
                ev.beneficiary.guardianName || ev.beneficiary.fatherName,
                ev.beneficiary.mobile,
                formatDDMMYYYY(ev.beneficiary.dob),
              ]}
              getOptionKey={(ev) => ev.beneficiary.id}
              getOptionLabel={(ev) => ev.beneficiary.childName}
              getOptionSublabel={(ev) =>
                `आई: ${ev.beneficiary.motherName || '-'} · ${ev.ageOnTargetDateLabel} · ${ev.beneficiary.mobile}`
              }
              getOptionMeta={(ev) => ev.beneficiary.beneficiaryCode}
              onSelectItem={(ev) => setSearchQuery(ev.beneficiary.beneficiaryCode)}
              placeholder="नाव, आयडी किंवा मोबाईलद्वारे शोधा..."
            />
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showAllVillageBeneficiaries}
                onChange={(e) => setShowAllVillageBeneficiaries(e.target.checked)}
                className="accent-teal-700"
              />
              गावातील सर्व लाभार्थी दाखवा (पात्र नसलेल्यांसह)
            </label>
          </div>

          <div className="overflow-x-auto">
            {evaluatedList.length === 0 ? (
              <EmptyState message="या सत्राच्या तारखेला पात्र असलेले कोणतेही लाभार्थी आढळले नाहीत." />
            ) : (
              <table className="app-table">
                <thead className="app-thead">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">लाभार्थी</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">जन्मतारीख व सत्र दिनांकाचे वय</th>
                    <th className="px-3 py-2.5 font-semibold">आधी दिलेले डोस</th>
                    <th className="px-3 py-2.5 font-semibold">या सत्रात देय डोस</th>
                    <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap">सत्रात जोडा</th>
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
                              className="app-btn-primary px-3 py-1.5"
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
