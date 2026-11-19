import React, { useState } from 'react';
import { Edit, UserPlus } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { AppUser, UserRole } from '../types';
import { formatTimestampIST } from '../utils/dateUtils';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
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
        msg: editItem ? 'वापरकर्ता भूमिका अद्यतनित केली.' : 'नवीन वापरकर्ता जोडला.',
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
        title="वापरकर्ता व भूमिका व्यवस्थापन"
        subtitle="प्रवेश करणाऱ्या कर्मचाऱ्यांचे ईमेल, भूमिका आणि उपकेंद्र मर्यादा निश्चित करा"
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
            <UserPlus className="w-4 h-4 text-teal-700" />
            {editItem ? 'वापरकर्ता दुरुस्ती' : 'नवीन वापरकर्ता जोडा'}
          </div>
          {editItem && (
            <button type="button" onClick={resetForm} className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0">
              रद्द करा
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="app-label">नाव *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="app-input"
            />
          </div>
          <div>
            <label className="app-label">अधिकृत ईमेल *</label>
            <input
              type="email"
              required
              disabled={Boolean(editItem)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="app-input disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="app-label">मोबाईल क्रमांक</label>
            <input
              maxLength={10}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="app-input font-mono-tabular"
            />
          </div>
          <div>
            <label className="app-label">भूमिका (Role) *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="app-input"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MEDICAL_OFFICER">MEDICAL_OFFICER</option>
              <option value="DATA_OPERATOR">DATA_OPERATOR</option>
              <option value="CHO">CHO (उपकेंद्र मर्यादित)</option>
              <option value="ANM">ANM (उपकेंद्र मर्यादित)</option>
            </select>
          </div>
          <div>
            <label className="app-label">नेमलेले उपकेंद्र (CHO / ANM साठी)</label>
            <select
              value={subcentreId}
              onChange={(e) => setSubcentreId(e.target.value)}
              className="app-input"
            >
              <option value="">सर्व उपकेंद्रे</option>
              {db.subcentres.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pt-6 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-teal-700"
            />
            सक्रिय खाते (Active)
          </label>
        </div>

        <button type="submit" className="app-btn-primary">
          {editItem ? 'अद्यतनित करा' : 'वापरकर्ता जतन करा'}
        </button>
      </form>

      <div className="app-table-wrap">
        {db.users.length === 0 ? (
          <EmptyState message="अद्याप कोणताही वापरकर्ता नोंदवलेला नाही." />
        ) : (
          <table className="app-table">
            <thead className="app-thead">
              <tr>
                <th className="app-th">नाव व ईमेल</th>
                <th className="app-th">भूमिका</th>
                <th className="app-th">उपकेंद्र</th>
                <th className="app-th">स्थिती</th>
                <th className="app-th">नोंदणी वेळ</th>
                <th className="app-th text-right">दुरुस्ती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="app-td">
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="app-td text-xs font-semibold text-teal-800">{u.role}</td>
                  <td className="app-td text-xs text-slate-600">
                    {u.subcentreName || 'सर्व उपकेंद्रे'}
                  </td>
                  <td className="app-td text-xs">
                    <span className={u.isActive ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-medium'}>
                      {u.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                    </span>
                  </td>
                  <td className="app-td text-xs font-mono-tabular text-slate-500">
                    {formatTimestampIST(u.createdAt)}
                  </td>
                  <td className="app-td text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(u)}
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
        title="वापरकर्ता माहिती जतन करायची का?"
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
