import React, { useState } from 'react';
import { Edit, UserPlus } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { AppUser, UserRole } from '../types';
import { formatTimestampIST } from '../utils/dateUtils';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';

export const UserManagementPage: React.FC = () => {
  const { db, saveUser } = useSheetData();
  const [editItem, setEditItem] = useState<AppUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<UserRole>('ANM');
  const [subcentreId, setSubcentreId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  if (!db) return null;

  const startEdit = (u: AppUser) => {
    setEditItem(u);
    setName(u.name);
    setEmail(u.email);
    setMobile(u.mobile);
    setRole(u.role);
    setSubcentreId(u.subcentreId || '');
    setIsActive(u.isActive);
  };

  const resetForm = () => {
    setEditItem(null);
    setName('');
    setEmail('');
    setMobile('');
    setRole('ANM');
    setSubcentreId('');
    setIsActive(true);
  };

  const handleConfirm = async () => {
    const sc = db.subcentres.find((s) => s.id === subcentreId);
    setBusy(true);
    try {
      await saveUser({
        id: editItem?.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        role,
        subcentreId: subcentreId || '',
        subcentreName: sc?.name || '',
        isActive,
      });
      setToast({
        msg: editItem ? 'वापरकर्ता भूमिका अद्यतनित केली.' : 'नवीन वापरकर्ता Google Sheet मध्ये जोडला.',
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
        <h2 className="text-xl font-bold text-slate-900">User Management (वापरकर्ता व भूमिका व्यवस्थापन)</h2>
        <p className="text-xs text-slate-500">
          Google Sign-In द्वारे प्रवेश करणाऱ्या कर्मचाऱ्यांचे ईमेल, भूमिका आणि उपकेंद्र मर्यादा निश्चित करा
        </p>
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
            <UserPlus className="w-4 h-4 text-teal-700" />
            {editItem ? 'वापरकर्ता दुरुस्ती' : 'नवीन वापरकर्ता जोडा'}
          </div>
          {editItem && (
            <button type="button" onClick={resetForm} className="text-xs text-slate-600 hover:underline">
              रद्द करा
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">नाव *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Google ईमेल *</label>
            <input
              type="email"
              required
              disabled={Boolean(editItem)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">मोबाईल क्रमांक</label>
            <input
              maxLength={10}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">भूमिका (Role) *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MEDICAL_OFFICER">MEDICAL_OFFICER</option>
              <option value="DATA_OPERATOR">DATA_OPERATOR</option>
              <option value="CHO">CHO (उपकेंद्र मर्यादित)</option>
              <option value="ANM">ANM (उपकेंद्र मर्यादित)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              नेमलेले उपकेंद्र (CHO / ANM साठी)
            </label>
            <select
              value={subcentreId}
              onChange={(e) => setSubcentreId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">सर्व उपकेंद्रे</option>
              {db.subcentres.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pt-6">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            सक्रिय खाते (Active)
          </label>
        </div>

        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold"
        >
          {editItem ? 'अद्यतनित करा' : 'वापरकर्ता जतन करा'}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold">नाव व ईमेल</th>
              <th className="px-4 py-3 font-semibold">भूमिका</th>
              <th className="px-4 py-3 font-semibold">उपकेंद्र</th>
              <th className="px-4 py-3 font-semibold">स्थिती</th>
              <th className="px-4 py-3 font-semibold">नोंदणी वेळ</th>
              <th className="px-4 py-3 font-semibold text-right">दुरुस्ती</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {db.users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-2.5 text-xs font-semibold text-teal-800">{u.role}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {u.subcentreName || 'सर्व उपकेंद्रे'}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  <span className={u.isActive ? 'text-emerald-700 font-semibold' : 'text-rose-700'}>
                    {u.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs font-mono-tabular text-slate-500">
                  {formatTimestampIST(u.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(u)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
                  >
                    <Edit className="w-3.5 h-3.5" /> दुरुस्ती
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="वापरकर्ता माहिती Google Sheet मध्ये जतन करायची का?"
        description={`ईमेल: ${email} · भूमिका: ${role}`}
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
