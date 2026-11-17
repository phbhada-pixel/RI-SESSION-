import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, Lock, Printer, Save, Search, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import { Beneficiary, VaccineSchedule } from '../types';
import { formatDDMMYYYY, getSessionEditStatus } from '../utils/dateUtils';
import { evaluateBeneficiaryEligibility } from '../utils/eligibilityEngine';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';

interface PendingTickSelection {
  beneficiary: Beneficiary;
  schedule: VaccineSchedule;
  batchNumber: string;
}

export const VaccinationTickMarkSheetPage: React.FC = () => {
  const { db, currentUser, administerVaccineDoses, removeBeneficiaryFromSession } = useSheetData();
  const [params, setParams] = useSearchParams();
  const initialSessionId = params.get('sessionId') || '';

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';

  const [sessionId, setSessionId] = useState(initialSessionId);
  const [selectedTicks, setSelectedTicks] = useState<Record<string, boolean>>({});
  const [batchByKey, setBatchByKey] = useState<Record<string, string>>({});
  const [defaultBatchBySchedule, setDefaultBatchBySchedule] = useState<Record<string, string>>({});

  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ sbId: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  useEffect(() => {
    if (initialSessionId) setSessionId(initialSessionId);
  }, [initialSessionId]);

  const availableSessions = useMemo(() => {
    if (!db) return [];
    return scopedSubcentre
      ? db.vaccinationSessions.filter((s) => s.subcentreId === scopedSubcentre)
      : db.vaccinationSessions;
  }, [db, scopedSubcentre]);

  const selectedSession = useMemo(
    () => availableSessions.find((s) => s.id === sessionId) || null,
    [availableSessions, sessionId]
  );

  const editStatus = selectedSession ? getSessionEditStatus(selectedSession) : null;

  const validatedSchedules = useMemo(() => {
    if (!db) return [];
    return db.vaccineSchedule
      .filter((s) => s.isActive && s.isValidated)
      .sort((a, b) => a.doseOrder - b.doseOrder);
  }, [db]);

  const rosterRows = useMemo(() => {
    if (!db || !selectedSession) return [];
    const rosterEntries = db.sessionBeneficiaries.filter(
      (sb) => sb.sessionId === selectedSession.id
    );

    const recMap = new Map<string, typeof db.vaccinationRecords>();
    for (const r of db.vaccinationRecords) {
      const arr = recMap.get(r.beneficiaryId) || [];
      arr.push(r);
      recMap.set(r.beneficiaryId, arr);
    }

    return rosterEntries
      .map((sb) => {
        const ben = db.beneficiaries.find((b) => b.id === sb.beneficiaryId);
        if (!ben || (ben.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN') return null;
        const evalSummary = evaluateBeneficiaryEligibility(
          ben,
          selectedSession.sessionDate,
          validatedSchedules,
          recMap.get(ben.id) || []
        );
        return { sb, ben, evalSummary };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [db, selectedSession, validatedSchedules]);

  const pendingEntries = useMemo<PendingTickSelection[]>(() => {
    const list: PendingTickSelection[] = [];
    for (const row of rosterRows) {
      for (const res of row.evalSummary.allDoseResults) {
        const key = `${row.ben.id}_${res.schedule.id}`;
        if (selectedTicks[key] && res.status === 'DUE') {
          const batch = batchByKey[key] ?? defaultBatchBySchedule[res.schedule.id] ?? '';
          list.push({
            beneficiary: row.ben,
            schedule: res.schedule,
            batchNumber: batch,
          });
        }
      }
    }
    return list;
  }, [rosterRows, selectedTicks, batchByKey, defaultBatchBySchedule]);

  if (!db) return null;

  const toggleTick = (benId: string, scheduleId: string) => {
    const key = `${benId}_${scheduleId}`;
    setSelectedTicks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirmSave = async () => {
    if (!selectedSession || pendingEntries.length === 0) return;
    setBusy(true);
    try {
      await administerVaccineDoses(
        selectedSession,
        pendingEntries.map((item) => ({
          beneficiary: item.beneficiary,
          schedule: item.schedule,
          administeredDate: selectedSession.sessionDate,
          batchNumber: item.batchNumber,
        }))
      );
      setSelectedTicks({});
      setConfirmSaveOpen(false);
      setToast({
        msg: `${pendingEntries.length} लसीकरण डोस Google Sheet मध्ये यशस्वीरित्या नोंदवले गेले.`,
        type: 'success',
      });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
      setConfirmSaveOpen(false);
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
      setToast({ msg: 'लाभार्थी सत्रातून काढला गेला.', type: 'success' });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const buildExportMatrix = () => {
    const headers = [
      'अ.क्र.',
      'लाभार्थी आयडी',
      'बाळाचे नाव',
      'जन्मतारीख',
      'वय',
      ...validatedSchedules.map((s) => s.doseName),
      'शेरा / स्वाक्षरी',
    ];
    const rows = rosterRows.map(({ ben, evalSummary }, idx) => [
      idx + 1,
      ben.beneficiaryCode,
      ben.childName,
      formatDDMMYYYY(ben.dob),
      evalSummary.ageOnTargetDateLabel,
      ...evalSummary.allDoseResults.map((res) =>
        res.status === 'ADMINISTERED'
          ? `✓ ${formatDDMMYYYY(res.administeredRecord?.administeredDate)}`
          : res.status === 'DUE'
            ? 'देय (Due)'
            : '-'
      ),
      '',
    ]);
    return { headers, rows };
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">लसीकरण टिकमार्क शीट</h2>
          <p className="text-xs text-slate-500">
            सत्रातील समाविष्ट लाभार्थ्यांना देय डोसवर टिकमार्क करून थेट Google Sheet मध्ये नोंदवा
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedSession && (
            <>
              <button
                type="button"
                onClick={() => {
                  const { headers, rows } = buildExportMatrix();
                  exportToExcel(
                    `PHC_Bhada_TickSheet_${selectedSession.sessionCode}`,
                    'TickSheet',
                    headers,
                    rows
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="w-4 h-4" /> Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { headers, rows } = buildExportMatrix();
                  exportToPDF(
                    `PHC_Bhada_TickSheet_${selectedSession.sessionCode}`,
                    `PHC Bhada Tick-Mark Sheet (${selectedSession.sessionCode})`,
                    `Subcenter: ${selectedSession.subcentreName} | Village: ${selectedSession.villageName} | Date: ${formatDDMMYYYY(selectedSession.sessionDate)} | Location: ${selectedSession.location}`,
                    headers,
                    rows
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="w-4 h-4" /> PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
              >
                <Printer className="w-4 h-4" /> प्रिंट रजिस्टर
              </button>
              <button
                type="button"
                disabled={!editStatus?.isOpen || pendingEntries.length === 0}
                onClick={() => setConfirmSaveOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-40 whitespace-nowrap"
              >
                <Save className="w-4 h-4" /> निवडलेले डोस जतन करा ({pendingEntries.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Session Selector */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1 max-w-xl">
          <label className="block text-xs font-medium text-slate-700 mb-1">लसीकरण सत्र निवडा</label>
          <select
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              setParams(e.target.value ? { sessionId: e.target.value } : {});
              setSelectedTicks({});
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white"
          >
            <option value="">-- सत्र निवडा --</option>
            {availableSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sessionCode} · {formatDDMMYYYY(s.sessionDate)} · {s.villageName} ({s.location})
              </option>
            ))}
          </select>
        </div>

        {selectedSession && (
          <Link
            to={`/session-search?sessionId=${selectedSession.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap"
          >
            <Search className="w-4 h-4" /> सत्रात आणखी लाभार्थी जोडा
          </Link>
        )}
      </div>

      {selectedSession && editStatus && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2 text-sm">
          <div>
            <span className="font-bold text-slate-900">प्राथमिक आरोग्य केंद्र भादा</span> · उपकेंद्र:{' '}
            {selectedSession.subcentreName} · गाव: {selectedSession.villageName} · दिनांक:{' '}
            <span className="font-mono-tabular font-semibold">
              {formatDDMMYYYY(selectedSession.sessionDate)}
            </span>{' '}
            · ठिकाण: {selectedSession.location} · ANM: {selectedSession.anmName || '-'} · CHO:{' '}
            {selectedSession.choName || '-'}
          </div>
          {!editStatus.isOpen && (
            <div className="no-print inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
              <Lock className="w-4 h-4" /> सत्र लॉक आहे (फक्त वाचन मोड)
            </div>
          )}
        </div>
      )}

      {/* Default Batch Number Bar */}
      {selectedSession && rosterRows.length > 0 && editStatus?.isOpen && (
        <div className="no-print bg-white p-3 rounded-xl border border-slate-200 space-y-2">
          <div className="text-xs font-semibold text-slate-700">
            डोसनुसार बॅच क्रमांक (ऐच्छिक — सर्व निवडलेल्या लाभार्थ्यांसाठी लागू):
          </div>
          <div className="flex flex-wrap gap-2">
            {validatedSchedules.map((sch) => (
              <div key={sch.id} className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                <span className="text-[11px] font-medium text-slate-700">{sch.doseName}:</span>
                <input
                  value={defaultBatchBySchedule[sch.id] || ''}
                  onChange={(e) =>
                    setDefaultBatchBySchedule((p) => ({ ...p, [sch.id]: e.target.value }))
                  }
                  placeholder="Batch"
                  className="w-20 text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono-tabular"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tick-Mark Matrix */}
      {selectedSession && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          {rosterRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 space-y-3">
              <div>या सत्रात अद्याप कोणताही लाभार्थी जोडलेला नाही.</div>
              <Link
                to={`/session-search?sessionId=${selectedSession.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold"
              >
                <Search className="w-4 h-4" /> सत्रनिहाय लाभार्थी शोध मधून जोडा
              </Link>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-2.5 font-semibold text-center border-r border-slate-200">
                    अ.क्र.
                  </th>
                  <th className="px-3 py-2.5 font-semibold sticky left-0 bg-slate-50 z-10 min-w-[190px] border-r border-slate-200">
                    लाभार्थी / जन्मतारीख / वय
                  </th>
                  {validatedSchedules.map((sch) => (
                    <th
                      key={sch.id}
                      className="px-2 py-2 font-semibold text-center min-w-[78px] border-r border-slate-100"
                    >
                      <div>{sch.doseName}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 font-semibold text-center min-w-[96px] border-r border-slate-100">
                    शेरा / स्वाक्षरी
                  </th>
                  <th className="no-print px-2 py-2 text-center">काढा</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rosterRows.map(({ sb, ben, evalSummary }, idx) => (
                  <tr key={ben.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2 text-center font-mono-tabular text-slate-600 border-r border-slate-200">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r border-slate-200">
                      <div className="font-semibold text-slate-900">{ben.childName}</div>
                      <div className="text-[11px] text-slate-500 font-mono-tabular">
                        {ben.beneficiaryCode} · {formatDDMMYYYY(ben.dob)} ({evalSummary.ageOnTargetDateLabel})
                      </div>
                    </td>
                    {evalSummary.allDoseResults.map((res) => {
                      const key = `${ben.id}_${res.schedule.id}`;
                      if (res.status === 'ADMINISTERED') {
                        return (
                          <td
                            key={res.schedule.id}
                            className="px-2 py-2 text-center bg-emerald-50/70 text-emerald-800 border-r border-slate-100"
                            title={res.reasonMarathi}
                          >
                            <Check className="w-3.5 h-3.5 mx-auto" />
                            <div className="text-[10px] font-mono-tabular">
                              {formatDDMMYYYY(res.administeredRecord?.administeredDate)}
                            </div>
                          </td>
                        );
                      }
                      if (res.status === 'DUE') {
                        const checked = Boolean(selectedTicks[key]);
                        return (
                          <td
                            key={res.schedule.id}
                            className={`px-2 py-2 text-center border-r border-slate-100 ${
                              checked ? 'bg-teal-50' : 'bg-amber-50/40'
                            }`}
                          >
                            <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!editStatus?.isOpen}
                                checked={checked}
                                onChange={() => toggleTick(ben.id, res.schedule.id)}
                                className="w-4 h-4 accent-teal-700"
                              />
                              <span className="text-[10px] font-semibold text-amber-800">देय</span>
                            </label>
                            {checked && (
                              <input
                                value={batchByKey[key] ?? defaultBatchBySchedule[res.schedule.id] ?? ''}
                                onChange={(e) =>
                                  setBatchByKey((p) => ({ ...p, [key]: e.target.value }))
                                }
                                placeholder="बॅच"
                                className="mt-1 w-16 text-[10px] border border-slate-300 rounded px-1 py-0.5 font-mono-tabular bg-white"
                              />
                            )}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={res.schedule.id}
                          className="px-2 py-2 text-center text-slate-300 border-r border-slate-100"
                          title={res.reasonMarathi}
                        >
                          —
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center text-[11px] text-slate-400 border-r border-slate-100">
                      {' '}
                    </td>
                    <td className="no-print px-2 py-2 text-center">
                      {editStatus?.isOpen && (
                        <button
                          type="button"
                          onClick={() => setRemoveTarget({ sbId: sb.id, name: ben.childName })}
                          className="p-1 text-slate-400 hover:text-rose-700"
                          title="सत्रातून काढा"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmSaveOpen}
        title="निवडलेले लसीकरण डोस Google Sheet मध्ये नोंदवायचे का?"
        description={`दिनांक ${formatDDMMYYYY(selectedSession?.sessionDate)} रोजी दिलेले खालील ${pendingEntries.length} डोस कायमस्वरूपी नोंदवले जातील:`}
        details={pendingEntries.map(
          (e) =>
            `${e.beneficiary.childName} (${e.beneficiary.beneficiaryCode}) → ${e.schedule.doseName}${
              e.batchNumber ? ` [बॅच: ${e.batchNumber}]` : ''
            }`
        )}
        confirmLabel="होय, डोस जतन करा"
        loading={busy}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmSaveOpen(false)}
      />

      <ConfirmModal
        open={Boolean(removeTarget)}
        title="लाभार्थी सत्रातून काढायचा का?"
        description={`${removeTarget?.name} यांना या सत्राच्या यादीतून काढले जाईल (त्यांचे मागील लसीकरण रेकॉर्ड सुरक्षित राहतील).`}
        confirmLabel="होय, काढा"
        variant="danger"
        loading={busy}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
