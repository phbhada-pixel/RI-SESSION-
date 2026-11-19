import React, { useState } from 'react';
import { Edit, PlusCircle } from 'lucide-react';
import { buildNextSubcentreCode, useSheetData } from '../context/SheetDataContext';
import { Subcentre } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
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
          : `नवीन उपकेंद्र (${saved.code}) नोंदवले.`,
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
        title="उपकेंद्र व्यवस्थापन"
        subtitle="प्राथमिक आरोग्य केंद्र भादा अंतर्गत सर्व उपकेंद्रे"
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
            {editItem ? 'उपकेंद्र माहिती दुरुस्ती' : 'नवीन उपकेंद्र जोडा'}
          </div>
          {editItem && (
            <button type="button" onClick={resetForm} className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0">
              नवीन नोंदणीकडे जा
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="app-label">उपकेंद्र कोड (स्वयंचलित)</label>
            <input
              readOnly
              value={autoSubcentreCode}
              title="जतन करताना आपोआप तयार होतो"
              className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-sm font-mono-tabular font-semibold cursor-not-allowed"
            />
          </div>
          <div>
            <label className="app-label">उपकेंद्राचे नाव *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="उदा. भादा (Bhada)"
              className="app-input"
            />
          </div>
          <div>
            <label className="app-label">प्राथमिक आरोग्य केंद्र</label>
            <input
              required
              value={phcName}
              onChange={(e) => setPhcName(e.target.value)}
              className="app-input"
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
        {db.subcentres.length === 0 ? (
          <EmptyState message="अद्याप कोणतेही उपकेंद्र नोंदवलेले नाही." />
        ) : (
          <table className="app-table">
            <thead className="app-thead">
              <tr>
                <th className="app-th">कोड</th>
                <th className="app-th">उपकेंद्र नाव</th>
                <th className="app-th">प्रा. आ. केंद्र</th>
                <th className="app-th">स्थिती</th>
                <th className="app-th text-right">दुरुस्ती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.subcentres.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="app-td font-mono-tabular text-xs font-semibold">{s.code}</td>
                  <td className="app-td font-medium text-slate-900">{s.name}</td>
                  <td className="app-td text-xs text-slate-600">{s.phcName}</td>
                  <td className="app-td text-xs">
                    <span className={s.isActive ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-medium'}>
                      {s.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                    </span>
                  </td>
                  <td className="app-td text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
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
        title={editItem ? 'उपकेंद्र माहिती अद्यतनित करायची का?' : 'नवीन उपकेंद्र जोडायचे का?'}
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
