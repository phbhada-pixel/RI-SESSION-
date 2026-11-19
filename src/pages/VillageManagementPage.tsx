import React, { useState } from 'react';
import { Edit, PlusCircle } from 'lucide-react';
import { buildNextVillageCode, useSheetData } from '../context/SheetDataContext';
import { Village } from '../types';
import { formatNumberIN } from '../utils/localeUtils';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';

export const VillageManagementPage: React.FC = () => {
  const { db, saveVillage } = useSheetData();
  const [editItem, setEditItem] = useState<Village | null>(null);
  const [name, setName] = useState('');
  const [subcentreId, setSubcentreId] = useState('');
  const [population, setPopulation] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  if (!db) return null;

  const autoVillageCode = editItem
    ? editItem.villageCode?.trim() || buildNextVillageCode(db.villages)
    : buildNextVillageCode(db.villages);

  const startEdit = (v: Village) => {
    setEditItem(v);
    setName(v.name);
    setSubcentreId(v.subcentreId);
    setPopulation(v.population ? String(v.population) : '');
    setIsActive(v.isActive);
  };

  const resetForm = () => {
    setEditItem(null);
    setName('');
    setSubcentreId('');
    setPopulation('');
    setIsActive(true);
  };

  const handleConfirm = async () => {
    const sc = db.subcentres.find((s) => s.id === subcentreId);
    if (!sc) return;
    setBusy(true);
    try {
      const saved = await saveVillage({
        id: editItem?.id,
        name,
        subcentreId,
        subcentreName: sc.name,
        population: population ? Number(population) : null,
        isActive,
      });
      setToast({
        msg: editItem
          ? `गाव माहिती (${saved.villageCode}) अद्यतनित केली.`
          : `नवीन गाव (${saved.villageCode}) नोंदवले.`,
        type: 'success',
      });
      resetForm();
      setConfirmOpen(false);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-page">
      <PageHeader
        title="गाव व्यवस्थापन"
        subtitle="प्रत्येक उपकेंद्राशी संलग्न गावे व लोकसंख्या नोंद"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirmOpen(true);
        }}
        className="app-card app-card-body space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="app-section-title">
            <PlusCircle className="w-4 h-4 text-teal-700" />
            {editItem ? 'गाव माहिती दुरुस्ती' : 'नवीन गाव जोडा'}
          </div>
          {editItem && (
            <button type="button" onClick={resetForm} className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0">
              नवीन नोंदणीकडे जा
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="app-label">गाव कोड (स्वयंचलित)</label>
            <input
              readOnly
              value={autoVillageCode}
              title="जतन करताना आपोआप तयार होतो"
              className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm font-mono-tabular font-semibold cursor-not-allowed"
            />
          </div>
          <div>
            <label className="app-label">गावाचे नाव *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="app-input"
            />
          </div>
          <div>
            <label className="app-label">उपकेंद्र *</label>
            <select
              required
              value={subcentreId}
              onChange={(e) => setSubcentreId(e.target.value)}
              className="app-input"
            >
              <option value="">निवडा...</option>
              {db.subcentres.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="app-label">लोकसंख्या (ऐच्छिक)</label>
            <input
              type="number"
              min={0}
              value={population}
              onChange={(e) => setPopulation(e.target.value)}
              className="app-input font-mono-tabular"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-teal-700"
            />
            सक्रिय (Active)
          </label>
        </div>

        <button type="submit" className="app-btn-primary">
          {editItem ? 'अद्यतनित करा' : 'जतन करा'}
        </button>
      </form>

      <div className="app-table-wrap">
        {db.villages.length === 0 ? (
          <EmptyState message="अद्याप कोणतेही गाव नोंदवलेले नाही." />
        ) : (
          <table className="app-table">
            <thead className="app-thead">
              <tr>
                <th className="app-th">कोड</th>
                <th className="app-th">गाव नाव</th>
                <th className="app-th">उपकेंद्र</th>
                <th className="app-th text-right">लोकसंख्या</th>
                <th className="app-th">स्थिती</th>
                <th className="app-th text-right">दुरुस्ती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.villages.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="app-td font-mono-tabular text-xs font-semibold">
                    {v.villageCode}
                  </td>
                  <td className="app-td font-medium text-slate-900">{v.name}</td>
                  <td className="app-td text-xs text-slate-600">{v.subcentreName}</td>
                  <td className="app-td text-right font-mono-tabular text-xs">
                    {formatNumberIN(v.population)}
                  </td>
                  <td className="app-td text-xs">
                    <span className={v.isActive ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-medium'}>
                      {v.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                    </span>
                  </td>
                  <td className="app-td text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
                    >
                      <Edit className="w-3.5 h-3.5" /> दुरुस्ती
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={editItem ? 'गाव माहिती अद्यतनित करायची का?' : 'नवीन गाव जोडायचे का?'}
        description={`कोड: ${autoVillageCode} · गाव: ${name}`}
        loading={busy}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
