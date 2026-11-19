import React, { useState } from 'react';
import { Edit, PlusCircle } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { StaffDesignation, StaffMember } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
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
        msg: editItem ? 'कर्मचारी माहिती अद्यतनित केली.' : 'नवीन कर्मचारी नोंदवला.',
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
        title="कर्मचारी व्यवस्थापन"
        subtitle="CHO, ANM, MPW, ASHA आणि इतर आरोग्य कर्मचारी नोंद"
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
            {editItem ? 'कर्मचारी माहिती दुरुस्ती' : 'नवीन कर्मचारी नोंदवा'}
          </div>
          {editItem && (
            <button type="button" onClick={resetForm} className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0">
              नवीन नोंदणीकडे जा
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="app-label">पूर्ण नाव *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="app-input"
            />
          </div>
          <div>
            <label className="app-label">पदनाम *</label>
            <select
              value={designation}
              onChange={(e) => setDesignation(e.target.value as StaffDesignation)}
              className="app-input"
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
            <label className="app-label">उपकेंद्र</label>
            <select
              value={subcentreId}
              onChange={(e) => setSubcentreId(e.target.value)}
              className="app-input"
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
            <label className="app-label">मोबाईल क्रमांक *</label>
            <input
              required
              maxLength={10}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="app-input font-mono-tabular"
            />
          </div>
          <div>
            <label className="app-label">संलग्न ईमेल (ऐच्छिक)</label>
            <input
              type="email"
              value={linkedUserEmail}
              onChange={(e) => setLinkedUserEmail(e.target.value)}
              className="app-input"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pt-6 cursor-pointer">
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
        {db.staff.length === 0 ? (
          <EmptyState message="अद्याप कोणताही कर्मचारी नोंदवलेला नाही." />
        ) : (
          <table className="app-table">
            <thead className="app-thead">
              <tr>
                <th className="app-th">नाव</th>
                <th className="app-th">पदनाम</th>
                <th className="app-th">उपकेंद्र</th>
                <th className="app-th">मोबाईल</th>
                <th className="app-th">स्थिती</th>
                <th className="app-th text-right">दुरुस्ती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.staff.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="app-td font-medium text-slate-900">
                    <div>{st.name}</div>
                    {st.linkedUserEmail && (
                      <div className="text-xs text-slate-500">{st.linkedUserEmail}</div>
                    )}
                  </td>
                  <td className="app-td text-xs font-semibold text-teal-800">
                    {st.designation}
                  </td>
                  <td className="app-td text-xs text-slate-600">{st.subcentreName}</td>
                  <td className="app-td text-xs font-mono-tabular">{st.mobile}</td>
                  <td className="app-td text-xs">
                    <span className={st.isActive ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-medium'}>
                      {st.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                    </span>
                  </td>
                  <td className="app-td text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(st)}
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
        title={editItem ? 'कर्मचारी माहिती अद्यतनित करायची का?' : 'नवीन कर्मचारी जोडायचा का?'}
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
