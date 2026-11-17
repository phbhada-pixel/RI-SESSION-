import React, { useState } from 'react';
import { Edit, PlusCircle } from 'lucide-react';
import { buildNextSubcentreCode, useSheetData } from '../context/SheetDataContext';
import { Subcentre } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';

export const SubcentreManagementPage: React.FC = () => {
  const { db, saveSubcentre } = useSheetData();
  const [editItem, setEditItem] = useState<Subcentre | null>(null);
  const [name, setName] = useState('');
  const [phcName, setPhcName] = useState('प्राथमिक आरोग्य केंद्र भादा');
  const [isActive, setIsActive] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  if (!db) return null;

  const autoSubcentreCode = editItem
    ? editItem.code?.trim() || buildNextSubcentreCode(db.subcentres)
    : buildNextSubcentreCode(db.subcentres);

  const startEdit = (s: Subcentre) => {
    setEditItem(s);
    setName(s.name);
    setPhcName(s.phcName);
    setIsActive(s.isActive);
  };

  const resetForm = () => {
    setEditItem(null);
    setName('');
    setPhcName('प्राथमिक आरोग्य केंद्र भादा');
    setIsActive(true);
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const saved = await saveSubcentre({
        id: editItem?.id,
        name,
        phcName,
        isActive,
      });
      setToast({
        msg: editItem
          ? `उपकेंद्र माहिती (${saved.code}) अद्यतनित केली.`
          : `नवीन उपकेंद्र (${saved.code}) Google Sheet मध्ये नोंदवले.`,
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
        <h2 className="text-xl font-bold text-slate-900">उपकेंद्र व्यवस्थापन</h2>
        <p className="text-xs text-slate-500">प्राथमिक आरोग्य केंद्र भादा अंतर्गत सर्व उपकेंद्रे</p>
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
            {editItem ? 'उपकेंद्र माहिती दुरुस्ती' : 'नवीन उपकेंद्र जोडा'}
          </div>
          {editItem && (
            <button type="button" onClick={resetForm} className="text-xs text-slate-600 hover:underline">
              नवीन नोंदणीकडे जा
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              उपकेंद्र कोड (स्वयंचलित)
            </label>
            <input
              readOnly
              value={autoSubcentreCode}
              title="जतन करताना आपोआप तयार होतो"
              className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm font-mono-tabular font-semibold cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">उपकेंद्राचे नाव *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="उदा. भादा (Bhada)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">प्राथमिक आरोग्य केंद्र</label>
            <input
              required
              value={phcName}
              onChange={(e) => setPhcName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
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
        {db.subcentres.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">अद्याप कोणतेही उपकेंद्र नोंदवलेले नाही.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">कोड</th>
                <th className="px-4 py-3 font-semibold">उपकेंद्र नाव</th>
                <th className="px-4 py-3 font-semibold">प्रा. आ. केंद्र</th>
                <th className="px-4 py-3 font-semibold">स्थिती</th>
                <th className="px-4 py-3 font-semibold text-right">दुरुस्ती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.subcentres.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono-tabular text-xs font-semibold">{s.code}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{s.phcName}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={s.isActive ? 'text-emerald-700 font-semibold' : 'text-rose-700'}>
                      {s.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
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
        title={editItem ? 'उपकेंद्र माहिती अद्यतनित करायची का?' : 'नवीन उपकेंद्र Google Sheet मध्ये जोडायचे का?'}
        description={`कोड: ${autoSubcentreCode} · नाव: ${name}`}
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
