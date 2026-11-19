import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, Lock, Unlock, CheckSquare, Search, ClipboardCheck, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import { RiChecklist, SessionCategory, SessionStatus, SessionType, VaccinationSession } from '../types';
import { formatDDMMYYYY, getSessionEditStatus, getTodayIST } from '../utils/dateUtils';
import { formatDateTimeIST } from '../utils/localeUtils';
import { SearchableSelect } from '../components/SearchableSelect';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';

export const SessionManagementPage: React.FC = () => {
  const { db, currentUser, createSession, updateSession, completeSession, reopenLockedSession } = useSheetData();

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';

  const [subcentreId, setSubcentreId] = useState(scopedSubcentre);
  const [villageId, setVillageId] = useState('');
  const [sessionDate, setSessionDate] = useState(getTodayIST());
  const [location, setLocation] = useState('अंगणवाडी केंद्र');
  const [sessionType, setSessionType] = useState<SessionType>('नियमित');
  const [sessionCategory, setSessionCategory] = useState<SessionCategory>('COMBINED');
  const [choName, setChoName] = useState('');
  const [anmName, setAnmName] = useState('');
  const [otherStaff, setOtherStaff] = useState('');
  const [choCustomMode, setChoCustomMode] = useState(false);
  const [anmCustomMode, setAnmCustomMode] = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<VaccinationSession | null>(null);
  const [reopenHours, setReopenHours] = useState(24);
  const [reopenReason, setReopenReason] = useState('');
  const [statusTarget, setStatusTarget] = useState<{
    session: VaccinationSession;
    nextStatus: SessionStatus;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  const activeSubcentres = useMemo(
    () => (db ? db.subcentres.filter((s) => s.isActive) : []),
    [db]
  );

  const filteredVillages = useMemo(
    () => (db ? db.villages.filter((v) => v.isActive && v.subcentreId === subcentreId) : []),
    [db, subcentreId]
  );

  // Staff attached to the selected Subcentre (Active staff matched by subcentreId or subcentreName)
  const attachedSubcentreStaff = useMemo(() => {
    if (!db || !subcentreId) return [];
    const sc = db.subcentres.find((s) => s.id === subcentreId);
    return db.staff.filter(
      (st) =>
        st.isActive &&
        (st.subcentreId === subcentreId ||
          (Boolean(sc) && Boolean(st.subcentreName) && st.subcentreName === sc?.name))
    );
  }, [db, subcentreId]);

  const attachedChos = useMemo(
    () => attachedSubcentreStaff.filter((st) => st.designation === 'CHO'),
    [attachedSubcentreStaff]
  );

  const attachedAnms = useMemo(
    () => attachedSubcentreStaff.filter((st) => st.designation === 'ANM'),
    [attachedSubcentreStaff]
  );

  const attachedHealthWorkers = useMemo(
    () =>
      attachedSubcentreStaff.filter(
        (st) => st.designation !== 'CHO' && st.designation !== 'ANM'
      ),
    [attachedSubcentreStaff]
  );

  // Automatically populate CHO, ANM (आरोग्य सेविका) & Health Workers (आरोग्य कर्मचारी) from attached Subcentre staff
  useEffect(() => {
    if (!subcentreId) {
      setChoCustomMode(false);
      setAnmCustomMode(false);
      setChoName('');
      setAnmName('');
      setSelectedWorkerIds([]);
      setOtherStaff('');
      return;
    }

    setChoCustomMode(false);
    setAnmCustomMode(false);
    setChoName(attachedChos[0]?.name || '');
    setAnmName(attachedAnms[0]?.name || '');
    const workerIds = attachedHealthWorkers.map((w) => w.id);
    setSelectedWorkerIds(workerIds);
    setOtherStaff(
      attachedHealthWorkers.map((w) => `${w.name} (${w.designation})`).join(', ')
    );
  }, [subcentreId, attachedChos, attachedAnms, attachedHealthWorkers]);

  const visibleSessions = useMemo(() => {
    if (!db) return [];
    return scopedSubcentre
      ? db.vaccinationSessions.filter((s) => s.subcentreId === scopedSubcentre)
      : db.vaccinationSessions;
  }, [db, scopedSubcentre]);

  const riChecklistBySessionId = useMemo(() => {
    const map = new Map<string, RiChecklist>();
    if (!db) return map;
    for (const c of db.riChecklists) {
      if (c.sessionId && !map.has(c.sessionId)) {
        map.set(c.sessionId, c);
      }
    }
    return map;
  }, [db]);

  if (!db) return null;

  const canCreate = Boolean(
    currentUser && ['ADMIN', 'DATA_OPERATOR', 'CHO'].includes(currentUser.role)
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcentreId || !villageId) {
      setToast({ msg: 'कृपया उपकेंद्र आणि गाव निवडा.', type: 'error' });
      return;
    }
    setConfirmCreateOpen(true);
  };

  const handleConfirmCreate = async () => {
    const sc = db.subcentres.find((s) => s.id === subcentreId);
    const vl = db.villages.find((v) => v.id === villageId);
    if (!sc || !vl) return;
    setBusy(true);
    try {
      const created = await createSession({
        phcName: sc.phcName || 'प्राथमिक आरोग्य केंद्र भादा',
        subcentreId,
        subcentreName: sc.name,
        villageId,
        villageName: vl.name,
        sessionDate,
        location: location.trim(),
        sessionType,
        sessionCategory,
        choName: choName.trim(),
        anmName: anmName.trim(),
        otherStaff: otherStaff.trim(),
        status: 'नियोजित',
      });
      setToast({
        msg: `लसीकरण सत्र तयार झाले: ${created.sessionCode}`,
        type: 'success',
      });
      setConfirmCreateOpen(false);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    setBusy(true);
    try {
      if (statusTarget.nextStatus === 'पूर्ण') {
        await completeSession(statusTarget.session.id);
      } else {
        await updateSession(statusTarget.session.id, { status: statusTarget.nextStatus });
      }
      setToast({ msg: 'सत्राची स्थिती अद्यतनित केली.', type: 'success' });
      setStatusTarget(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenTarget) return;
    setBusy(true);
    try {
      await reopenLockedSession(reopenTarget.id, reopenHours, reopenReason);
      setToast({ msg: 'लॉक केलेले सत्र तात्पुरते पुन्हा उघडले गेले.', type: 'success' });
      setReopenTarget(null);
      setReopenReason('');
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const rosterCountMap = new Map<string, number>();
  for (const sb of db.sessionBeneficiaries) {
    rosterCountMap.set(sb.sessionId, (rosterCountMap.get(sb.sessionId) || 0) + 1);
  }

  return (
    <div className="app-page">
      <PageHeader
        title="लसीकरण सत्र व्यवस्थापन"
        subtitle="सत्र तारखेनंतर २ दिवसांपर्यंत (IST रात्री ११:५९ पर्यंत) अद्यतने सुरू राहतात; त्यानंतर सत्र स्वयंचलित लॉक होते."
      />

      {canCreate && (
        <form
          onSubmit={handleCreateSubmit}
          className="app-card app-card-body space-y-4"
        >
          <div className="app-section-title">
            <CalendarPlus className="w-4 h-4 text-teal-700" /> नवीन लसीकरण सत्र तयार करा
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SearchableSelect
              label="उपकेंद्र"
              required
              disabled={Boolean(scopedSubcentre)}
              value={subcentreId}
              onChange={(v) => {
                setSubcentreId(v);
                setVillageId('');
              }}
              options={activeSubcentres.map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: s.code,
              }))}
            />
            <SearchableSelect
              label="गाव"
              required
              disabled={!subcentreId}
              value={villageId}
              onChange={setVillageId}
              options={filteredVillages.map((v) => ({ value: v.id, label: v.name }))}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">सत्र दिनांक *</label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">सत्र प्रकार *</label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as SessionType)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="नियमित">नियमित</option>
                <option value="विशेष">विशेष</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">सत्र ठिकाण *</label>
              <input
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                सी.एच.ओ. (CHO) नाव
              </label>
              {attachedChos.length > 0 && !choCustomMode ? (
                <select
                  value={choName}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setChoCustomMode(true);
                      setChoName('');
                    } else {
                      setChoName(e.target.value);
                    }
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {attachedChos.map((st) => (
                    <option key={st.id} value={st.name}>
                      {st.name} (CHO)
                    </option>
                  ))}
                  <option value="">-- कोणीही नाही / रिक्त --</option>
                  <option value="__CUSTOM__">इतर नाव टाइप करा...</option>
                </select>
              ) : (
                <div className="space-y-1">
                  <input
                    value={choName}
                    onChange={(e) => setChoName(e.target.value)}
                    placeholder={subcentreId ? 'CHO नाव टाइप करा' : 'आधी उपकेंद्र निवडा'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {attachedChos.length > 0 && choCustomMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setChoCustomMode(false);
                        setChoName(attachedChos[0]?.name || '');
                      }}
                      className="text-[11px] text-teal-700 hover:underline"
                    >
                      संलग्न CHO यादीतून निवडा
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                आरोग्य सेविका (ANM) नाव *
              </label>
              {attachedAnms.length > 0 && !anmCustomMode ? (
                <select
                  required
                  value={anmName}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setAnmCustomMode(true);
                      setAnmName('');
                    } else {
                      setAnmName(e.target.value);
                    }
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {attachedAnms.map((st) => (
                    <option key={st.id} value={st.name}>
                      {st.name} (ANM)
                    </option>
                  ))}
                  <option value="__CUSTOM__">इतर नाव टाइप करा...</option>
                </select>
              ) : (
                <div className="space-y-1">
                  <input
                    required
                    value={anmName}
                    onChange={(e) => setAnmName(e.target.value)}
                    placeholder={subcentreId ? 'ANM नाव टाइप करा' : 'आधी उपकेंद्र निवडा'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {attachedAnms.length > 0 && anmCustomMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnmCustomMode(false);
                        setAnmName(attachedAnms[0]?.name || '');
                      }}
                      className="text-[11px] text-teal-700 hover:underline"
                    >
                      संलग्न आरोग्य सेविका यादीतून निवडा
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                आरोग्य कर्मचारी (MPW / ASHA / इतर)
              </label>
              <input
                value={otherStaff}
                onChange={(e) => setOtherStaff(e.target.value)}
                placeholder={
                  subcentreId
                    ? attachedHealthWorkers.length > 0
                      ? 'संलग्न कर्मचारी स्वयंचलित भरले'
                      : 'इतर आरोग्य कर्मचारी नाव'
                    : 'आधी उपकेंद्र निवडा'
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              {attachedHealthWorkers.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {attachedHealthWorkers.map((w) => {
                    const checked = selectedWorkerIds.includes(w.id);
                    return (
                      <label
                        key={w.id}
                        className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const nextIds = checked
                              ? selectedWorkerIds.filter((id) => id !== w.id)
                              : [...selectedWorkerIds, w.id];
                            setSelectedWorkerIds(nextIds);
                            const nextNames = attachedHealthWorkers
                              .filter((hw) => nextIds.includes(hw.id))
                              .map((hw) => `${hw.name} (${hw.designation})`)
                              .join(', ');
                            setOtherStaff(nextNames);
                          }}
                          className="w-3.5 h-3.5 accent-teal-700"
                        />
                        <span>
                          {w.name} ({w.designation})
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">सत्र श्रेणी (Category) *</label>
              <select
                value={sessionCategory}
                onChange={(e) => setSessionCategory(e.target.value as SessionCategory)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="COMBINED">संयुक्त (बालक + गरोदर माता)</option>
                <option value="CHILD">फक्त बालक लसीकरण</option>
                <option value="PREGNANT_WOMAN">फक्त गरोदर माता ANC</option>
              </select>
            </div>
          </div>
          {subcentreId && (
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              {attachedSubcentreStaff.length > 0 ? (
                <span>
                  निवडलेल्या उपकेंद्राशी संलग्न{' '}
                  <strong className="text-teal-800">{attachedSubcentreStaff.length}</strong> कर्मचारी
                  (CHO: {attachedChos.length} · आरोग्य सेविका/ANM: {attachedAnms.length} · आरोग्य कर्मचारी:{' '}
                  {attachedHealthWorkers.length}) स्वयंचलित दिसत आहेत.
                </span>
              ) : (
                <span>
                  या उपकेंद्राशी संलग्न सक्रिय कर्मचारी अद्याप{' '}
                  <Link to="/staff" className="text-teal-700 font-semibold hover:underline">
                    कर्मचारी व्यवस्थापन
                  </Link>{' '}
                  मध्ये नोंदवलेले नाहीत — आपण वरील रकान्यात नाव टाइप करू शकता.
                </span>
              )}
            </div>
          )}
          <div>
            <button type="submit" className="app-btn-primary py-2.5">
              सत्र तयार करा
            </button>
          </div>
        </form>
      )}

      {/* Sessions Table */}
      <div className="app-table-wrap">
        {visibleSessions.length === 0 ? (
          <EmptyState message="कोणतेही लसीकरण सत्र नोंदवलेले नाही. वरील फॉर्मद्वारे नवीन सत्र तयार करा." />
        ) : (
          <table className="app-table">
            <thead className="app-thead">
              <tr>
                <th className="app-th">सत्र कोड</th>
                <th className="app-th">दिनांक व ठिकाण</th>
                <th className="app-th">उपकेंद्र / गाव</th>
                <th className="app-th">ANM / CHO</th>
                <th className="app-th text-right">लाभार्थी</th>
                <th className="app-th">स्थिती व २-दिवस मुदत</th>
                <th className="app-th text-right">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSessions.map((s) => {
                const win = getSessionEditStatus(s);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-teal-800 whitespace-nowrap">
                      {s.sessionCode}
                      <div className="text-slate-500 font-sans font-normal">
                        {s.sessionType} ·{' '}
                        {s.sessionCategory === 'CHILD'
                          ? 'फक्त बालक'
                          : s.sessionCategory === 'PREGNANT_WOMAN'
                            ? 'फक्त गरोदर माता'
                            : 'संयुक्त'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono-tabular font-semibold">{formatDDMMYYYY(s.sessionDate)}</div>
                      <div className="text-slate-600">{s.location}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-slate-900">{s.villageName}</div>
                      <div className="text-slate-500">{s.subcentreName}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div>ANM: {s.anmName || '-'}</div>
                      <div className="text-slate-500">CHO: {s.choName || '-'}</div>
                      {s.otherStaff && (
                        <div className="text-slate-500">कर्मचारी: {s.otherStaff}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold">
                      {rosterCountMap.get(s.id) || 0}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        {win.isOpen ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <Unlock className="w-3.5 h-3.5" /> {win.labelMarathi}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                            <Lock className="w-3.5 h-3.5" /> {win.labelMarathi}
                          </span>
                        )}
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-700">{s.status}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{win.remainingText}</div>
                      {s.completedAt && (
                        <div className="text-[11px] text-emerald-700 font-mono-tabular mt-0.5">
                          पूर्ण: {formatDateTimeIST(s.completedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/today-session?sessionId=${s.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" /> आजचे सत्र उघडा
                      </Link>
                      <Link
                        to={`/session-search?sessionId=${s.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
                      >
                        <Search className="w-3.5 h-3.5" /> लाभार्थी जोडा
                      </Link>
                      <Link
                        to={`/tick-sheet?sessionId=${s.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-800 hover:underline"
                      >
                        <CheckSquare className="w-3.5 h-3.5" /> टिकमार्क शीट
                      </Link>
                      {(() => {
                        const existingRi = riChecklistBySessionId.get(s.id);
                        return existingRi ? (
                          <Link
                            to={`/ri-checklist?sessionId=${s.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                            title="या सत्राची RI चेकलिस्ट आधीच भरलेली आहे (पहा / संपादित करा)"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> RI पूर्ण ({existingRi.checklistCode})
                          </Link>
                        ) : (
                          <Link
                            to={`/ri-checklist?sessionId=${s.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
                          >
                            <ClipboardList className="w-3.5 h-3.5" /> RI चेकलिस्ट भरा
                          </Link>
                        );
                      })()}
                      {win.isOpen && s.status === 'नियोजित' && (
                        <button
                          type="button"
                          onClick={() => setStatusTarget({ session: s, nextStatus: 'सुरू' })}
                          className="text-xs font-medium text-teal-700 hover:underline"
                        >
                          सुरू करा
                        </button>
                      )}
                      {win.isOpen && s.status !== 'पूर्ण' && s.status !== 'रद्द' && (
                        <button
                          type="button"
                          onClick={() => setStatusTarget({ session: s, nextStatus: 'पूर्ण' })}
                          className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                          पूर्ण करा
                        </button>
                      )}
                      {win.isOpen && s.status !== 'पूर्ण' && s.status !== 'रद्द' && (
                        <button
                          type="button"
                          onClick={() => setStatusTarget({ session: s, nextStatus: 'रद्द' })}
                          className="text-xs font-medium text-rose-700 hover:underline"
                        >
                          रद्द करा
                        </button>
                      )}
                      {!win.isOpen && currentUser?.role === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => setReopenTarget(s)}
                          className="text-xs font-semibold text-amber-700 hover:underline"
                        >
                          पुन्हा उघडा
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

      <ConfirmModal
        open={confirmCreateOpen}
        title="नवीन लसीकरण सत्र जतन करायचे का?"
        description={`दिनांक: ${formatDDMMYYYY(sessionDate)} · ठिकाण: ${location} · आरोग्य सेविका (ANM): ${anmName}${
          choName ? ` · CHO: ${choName}` : ''
        }${otherStaff ? ` · आरोग्य कर्मचारी: ${otherStaff}` : ''}`}
        confirmLabel="होय, सत्र तयार करा"
        loading={busy}
        onConfirm={handleConfirmCreate}
        onCancel={() => setConfirmCreateOpen(false)}
      />

      <ConfirmModal
        open={Boolean(statusTarget)}
        title="सत्राची स्थिती बदलायची का?"
        description={`सत्र ${statusTarget?.session.sessionCode} ची स्थिती '${statusTarget?.nextStatus}' म्हणून नोंदवली जाईल.`}
        confirmLabel="होय, अद्यतनित करा"
        loading={busy}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusTarget(null)}
      />

      {reopenTarget && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <form onSubmit={handleConfirmReopen} className="app-modal max-w-md p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              लॉक केलेले सत्र पुन्हा उघडा ({reopenTarget.sessionCode})
            </h3>
            <div>
              <label className="app-label">किती तासांसाठी उघडे ठेवायचे?</label>
              <select
                value={reopenHours}
                onChange={(e) => setReopenHours(Number(e.target.value))}
                className="app-input"
              >
                <option value={12}>१२ तास</option>
                <option value={24}>२४ तास</option>
                <option value={48}>४८ तास</option>
              </select>
            </div>
            <div>
              <label className="app-label">
                पुन्हा उघडण्याचे कारण (Audit Log साठी अनिवार्य) *
              </label>
              <textarea
                required
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="app-input"
                placeholder="कारण लिहा..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={busy}
                onClick={() => setReopenTarget(null)}
                className="app-btn-secondary"
              >
                रद्द करा
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg whitespace-nowrap shrink-0 transition-colors"
              >
                {busy ? 'उघडत आहे...' : 'सत्र पुन्हा उघडा'}
              </button>
            </div>
          </form>
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
