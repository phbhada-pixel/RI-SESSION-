import React, { useState } from 'react';
import { Edit, PlusCircle } from 'lucide-react';
import { buildNextVillageCode, useSheetData } from '../context/SheetDataContext';
import { Village } from '../types';
import { formatNumberIN } from '../utils/localeUtils';
import { ConfirmModal } from '../components/ConfirmModal';
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
          : `नवीन गाव (${saved.villageCode}) Google Sheet मध्ये नोंदवले.`,
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">गाव व्यवस्थापन</h2>
        <p className="text-xs text-slate-500">प्रत्येक उपकेंद्राशी संलग्न गावे व लोकसंख्या नोंद</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirmOpen(true);
        }}
        className="bg-white p-5 rounded-xl border border-slate-200 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <PlusCircle className="w-4 h-4 text-teal-700" />
            {editItem ? 'गाव माहिती दुरुस्ती' : 'नवीन गाव जोडा'}
          </div>
          {editItem && (
            <button type="button" onClick={resetForm} className="text-xs text-slate-600 hover:underline">
              नवीन नोंदणीकडे जा
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              गाव कोड (स्वयंचलित)
            </label>
            <input
              readOnly
              value={autoVillageCode}
              title="जतन करताना आपोआप तयार होतो"
              className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm font-mono-tabular font-semibold cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">गावाचे नाव *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">उपकेंद्र *</label>
            <select
              required
              value={subcentreId}
              onChange={(e) => setSubcentreId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
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
            <label className="block text-xs font-medium text-slate-700 mb-1">लोकसंख्या (ऐच्छिक)</label>
            <input
              type="number"
              min={0}
              value={population}
              onChange={(e) => setPopulation(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            सक्रिय (Active)
          </label>
        </div>

        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold"
        >
          {editItem ? 'अद्यतनित करा' : 'जतन करा'}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {db.villages.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">अद्याप कोणतेही गाव नोंदवलेले नाही.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">कोड</th>
                <th className="px-4 py-3 font-semibold">गाव नाव</th>
                <th className="px-4 py-3 font-semibold">उपकेंद्र</th>
                <th className="px-4 py-3 font-semibold text-right">लोकसंख्या</th>
                <th className="px-4 py-3 font-semibold">स्थिती</th>
                <th className="px-4 py-3 font-semibold text-right">दुरुस्ती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.villages.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono-tabular text-xs font-semibold">
                    {v.villageCode}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{v.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{v.subcentreName}</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular text-xs">
                    {formatNumberIN(v.population)}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={v.isActive ? 'text-emerald-700 font-semibold' : 'text-rose-700'}>
                      {v.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
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
        title={editItem ? 'गाव माहिती अद्यतनित करायची का?' : 'नवीन गाव Google Sheet मध्ये जोडायचे का?'}
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
