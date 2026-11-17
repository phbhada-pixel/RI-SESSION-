import React, { useState } from 'react';
import { Edit, PlusCircle } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { StaffDesignation, StaffMember } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';

export const StaffManagementPage: React.FC = () => {
  const { db, saveStaff } = useSheetData();
  const [editItem, setEditItem] = useState<StaffMember | null>(null);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState<StaffDesignation>('ANM');
  const [subcentreId, setSubcentreId] = useState('');
  const [mobile, setMobile] = useState('');
  const [linkedUserEmail, setLinkedUserEmail] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  if (!db) return null;

  const startEdit = (s: StaffMember) => {
    setEditItem(s);
    setName(s.name);
    setDesignation(s.designation);
    setSubcentreId(s.subcentreId);
    setMobile(s.mobile);
    setLinkedUserEmail(s.linkedUserEmail || '');
    setIsActive(s.isActive);
  };

  const resetForm = () => {
    setEditItem(null);
    setName('');
    setDesignation('ANM');
    setSubcentreId('');
    setMobile('');
    setLinkedUserEmail('');
    setIsActive(true);
  };

  const handleConfirm = async () => {
    const sc = db.subcentres.find((s) => s.id === subcentreId);
    setBusy(true);
    try {
      await saveStaff({
        id: editItem?.id,
        name: name.trim(),
        designation,
        subcentreId,
        subcentreName: sc?.name || 'सर्व / प्रा. आ. केंद्र',
        mobile: mobile.trim(),
        linkedUserEmail: linkedUserEmail.trim().toLowerCase(),
        isActive,
      });
      setToast({
        msg: editItem ? 'कर्मचारी माहिती अद्यतनित केली.' : 'नवीन कर्मचारी Google Sheet मध्ये नोंदवला.',
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
        <h2 className="text-xl font-bold text-slate-900">कर्मचारी व्यवस्थापन</h2>
        <p className="text-xs text-slate-500">CHO, ANM, MPW, ASHA आणि इतर आरोग्य कर्मचारी नोंद</p>
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
            {editItem ? 'कर्मचारी माहिती दुरुस्ती' : 'नवीन कर्मचारी नोंदवा'}
          </div>
          {editItem && (
            <button type="button" onClick={resetForm} className="text-xs text-slate-600 hover:underline">
              नवीन नोंदणीकडे जा
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">पूर्ण नाव *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">पदनाम *</label>
            <select
              value={designation}
              onChange={(e) => setDesignation(e.target.value as StaffDesignation)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="CHO">CHO</option>
              <option value="ANM">ANM</option>
              <option value="MPW">MPW</option>
              <option value="ASHA">ASHA</option>
              <option value="MEDICAL_OFFICER">MEDICAL_OFFICER</option>
              <option value="DATA_OPERATOR">DATA_OPERATOR</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">उपकेंद्र</label>
            <select
              value={subcentreId}
              onChange={(e) => setSubcentreId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">प्रा. आ. केंद्र (सर्व)</option>
              {db.subcentres.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">मोबाईल क्रमांक *</label>
            <input
              required
              maxLength={10}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">संलग्न Google ईमेल (ऐच्छिक)</label>
            <input
              type="email"
              value={linkedUserEmail}
              onChange={(e) => setLinkedUserEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pt-6">
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
        {db.staff.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">अद्याप कोणताही कर्मचारी नोंदवलेला नाही.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">नाव</th>
                <th className="px-4 py-3 font-semibold">पदनाम</th>
                <th className="px-4 py-3 font-semibold">उपकेंद्र</th>
                <th className="px-4 py-3 font-semibold">मोबाईल</th>
                <th className="px-4 py-3 font-semibold">स्थिती</th>
                <th className="px-4 py-3 font-semibold text-right">दुरुस्ती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.staff.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    <div>{st.name}</div>
                    {st.linkedUserEmail && (
                      <div className="text-xs text-slate-500">{st.linkedUserEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-teal-800">
                    {st.designation}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{st.subcentreName}</td>
                  <td className="px-4 py-2.5 text-xs font-mono-tabular">{st.mobile}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={st.isActive ? 'text-emerald-700 font-semibold' : 'text-rose-700'}>
                      {st.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(st)}
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
        title={editItem ? 'कर्मचारी माहिती अद्यतनित करायची का?' : 'नवीन कर्मचारी Google Sheet मध्ये जोडायचा का?'}
        description={`नाव: ${name} · पदनाम: ${designation}`}
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
