import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  HeartPulse,
  PlusCircle,
  Share2,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { MaternalServiceConfigItem } from '../types';
import { getMaternalServiceCatalog } from '../utils/maternalUtils';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';

export const SettingsPage: React.FC = () => {
  const {
    db,
    isCentralOwner,
    sharedWithAnyone,
    enableMultiGmailSharing,
    saveSystemSettings,
    saveMaternalServiceCatalog,
    downloadFullWorkbook,
    uploadExcelToSheet,
    seedStandardNIS,
    seedStarterHierarchy,
  } = useSheetData();

  const existing = db?.systemSettings[0];
  const [phcName, setPhcName] = useState(existing?.phcName || 'प्राथमिक आरोग्य केंद्र भादा');
  const [district, setDistrict] = useState(existing?.district || 'लातूर');
  const [stateName, setStateName] = useState(existing?.state || 'महाराष्ट्र');
  const [allowEditDays, setAllowEditDays] = useState(existing?.allowEditDaysAfterSession ?? 2);

  const [maternalCatalog, setMaternalCatalog] = useState<MaternalServiceConfigItem[]>(() =>
    getMaternalServiceCatalog(db?.systemSettings[0])
  );
  const [newAncName, setNewAncName] = useState('');
  const [newAncCode, setNewAncCode] = useState('');
  const [newAncUnit, setNewAncUnit] = useState('');
  const [newAncRequiresBatch, setNewAncRequiresBatch] = useState(false);
  const [newAncRepeatEveryVisit, setNewAncRepeatEveryVisit] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'APPEND' | 'REPLACE'>('APPEND');

  const [confirmAction, setConfirmAction] = useState<
    'SETTINGS' | 'MATERNAL_CATALOG' | 'SEED_NIS' | 'SEED_HIERARCHY' | 'SHARE_ANYONE' | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  if (!db) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      if (confirmAction === 'SETTINGS') {
        await saveSystemSettings({
          phcName: phcName.trim(),
          district: district.trim(),
          state: stateName.trim(),
          timezone: 'Asia/Kolkata',
          allowEditDaysAfterSession: allowEditDays,
        });
        setToast({ msg: 'प्रणाली सेटिंग्ज जतन केली.', type: 'success' });
      } else if (confirmAction === 'MATERNAL_CATALOG') {
        await saveMaternalServiceCatalog(maternalCatalog);
        setToast({ msg: 'माता ANC व लसीकरण सेवा यादी जतन केली.', type: 'success' });
      } else if (confirmAction === 'SEED_NIS') {
        await seedStandardNIS();
        setToast({ msg: 'राष्ट्रीय लसीकरण वेळापत्रक (NIS) जतन केले.', type: 'success' });
      } else if (confirmAction === 'SEED_HIERARCHY') {
        await seedStarterHierarchy();
        setToast({ msg: 'भादा नमुना उपकेंद्रे व गावे जतन केली.', type: 'success' });
      } else if (confirmAction === 'SHARE_ANYONE') {
        await enableMultiGmailSharing();
        setToast({
          msg: 'आता सर्व अधिकृत कर्मचारी त्यांच्या खात्यावरून लॉगिन करून थेट प्रणालीत डेटा जतन करू शकतील.',
          type: 'success',
        });
      }
      setConfirmAction(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!pendingUploadFile) return;
    setBusy(true);
    try {
      const res = await uploadExcelToSheet(pendingUploadFile, uploadMode);
      setToast({
        msg: `${res.rowCount} ओळी प्रणालीत यशस्वीरित्या अपलोड झाल्या.`,
        type: 'success',
      });
      setPendingUploadFile(null);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'त्रुटी आली.', type: 'error' });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="app-page max-w-5xl">
      <PageHeader
        title="सेटिंग्ज व प्रणाली व्यवस्थापन"
        subtitle="प्राथमिक आरोग्य केंद्र मापदंड, ANC सेवा मास्टर आणि डेटा बॅकअप / अपलोड केंद्र"
      />

      {/* Data Backup & Staff Access Card */}
      <div className="app-card app-card-body space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="app-section-title text-slate-900">डेटा बॅकअप व Excel आयात</div>
            <p className="text-xs text-slate-500">
              संपूर्ण पोर्टल डेटाचे Excel बॅकअप डाउनलोड करा किंवा विद्यमान डेटा अपलोड करा.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadFullWorkbook}
              className="app-btn-secondary text-xs"
            >
              <Download className="w-4 h-4" /> संपूर्ण Excel डाउनलोड
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPendingUploadFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="app-btn-primary text-xs"
            >
              <Upload className="w-4 h-4" /> Excel अपलोड करा
            </button>
          </div>
        </div>

        {/* Multi-Staff Central Save Controls */}
        <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            {sharedWithAnyone ? (
              <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
            ) : (
              <Share2 className="w-4 h-4 text-amber-700 shrink-0" />
            )}
            <span>
              कर्मचारी लॉगिन डेटा प्रवेश:{' '}
              {sharedWithAnyone
                ? 'सक्रिय — सर्व अधिकृत कर्मचारी थेट केंद्रीय प्रणालीत डेटा जतन करू शकतात'
                : 'मर्यादित — इतर कर्मचाऱ्यांना थेट संपादन परवानगी देण्यासाठी सक्रिय करा'}
            </span>
          </div>

          {isCentralOwner && !sharedWithAnyone && (
            <button
              type="button"
              onClick={() => setConfirmAction('SHARE_ANYONE')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg whitespace-nowrap shrink-0 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> कर्मचारी डेटा प्रवेश सक्रिय करा
            </button>
          )}
        </div>
      </div>

      {/* Quick Starter Seeds */}
      <div className="app-card app-card-body space-y-3">
        <div className="app-section-title text-slate-900">प्रारंभिक डेटा सेटअप</div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setConfirmAction('SEED_HIERARCHY')}
            className="app-btn-soft text-xs"
          >
            <Sparkles className="w-4 h-4" /> भादा नमुना उपकेंद्रे व गावे भरा
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('SEED_NIS')}
            className="app-btn-soft text-xs"
          >
            <Sparkles className="w-4 h-4" /> राष्ट्रीय लसीकरण वेळापत्रक (NIS) भरा
          </button>
        </div>
      </div>

      {/* PHC Config Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirmAction('SETTINGS');
        }}
        className="app-card app-card-body space-y-4"
      >
        <div className="app-section-title text-slate-900">प्राथमिक आरोग्य केंद्र तपशील</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="app-label">संस्थेचे नाव</label>
            <input
              required
              value={phcName}
              onChange={(e) => setPhcName(e.target.value)}
              className="app-input"
            />
          </div>
          <div>
            <label className="app-label">जिल्हा</label>
            <input
              required
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="app-input"
            />
          </div>
          <div>
            <label className="app-label">राज्य</label>
            <input
              required
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              className="app-input"
            />
          </div>
          <div>
            <label className="app-label">सत्रानंतर संपादन दिवस (IST)</label>
            <input
              type="number"
              min={0}
              max={7}
              value={allowEditDays}
              onChange={(e) => setAllowEditDays(Number(e.target.value))}
              className="app-input font-mono-tabular"
            />
          </div>
        </div>
        <button type="submit" className="app-btn-primary">
          सेटिंग्ज जतन करा
        </button>
      </form>

      {/* Admin Maternal ANC Service Master */}
      <div className="app-card app-card-body space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="app-section-title text-slate-900">
              <HeartPulse className="w-4 h-4 text-teal-700" />
              माता ANC व लसीकरण सेवा मास्टर (Configurable Maternal Services)
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              आजच्या लसीकरण सत्रात गरोदर मातांसाठी उपलब्ध ANC तपासण्या, लस (Td) व औषधे येथून नियंत्रित करा.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmAction('MATERNAL_CATALOG')}
            className="app-btn-primary text-xs"
          >
            ANC सेवा यादी जतन करा
          </button>
        </div>

        <div className="app-table-wrap rounded-lg">
          <table className="app-table text-xs">
            <thead className="app-thead">
              <tr>
                <th className="px-3 py-2 font-semibold">सक्रिय</th>
                <th className="px-3 py-2 font-semibold">सेवा कोड</th>
                <th className="px-3 py-2 font-semibold">सेवेचे नाव (मराठी / इंग्रजी)</th>
                <th className="px-3 py-2 font-semibold">मोजमाप / एकक</th>
                <th className="px-3 py-2 font-semibold text-center">प्रत्येक ANC भेटीत</th>
                <th className="px-3 py-2 font-semibold text-center">बॅच नं. आवश्यक</th>
                <th className="px-3 py-2 font-semibold text-right">काढा</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {maternalCatalog.map((item, idx) => (
                <tr key={item.serviceCode} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={(e) =>
                        setMaternalCatalog((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, isActive: e.target.checked } : m))
                        )
                      }
                      className="w-4 h-4 accent-teal-700"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono-tabular text-slate-700">{item.serviceCode}</td>
                  <td className="px-3 py-2">
                    <input
                      value={item.serviceName}
                      onChange={(e) =>
                        setMaternalCatalog((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, serviceName: e.target.value } : m))
                        )
                      }
                      className="w-full min-w-[200px] border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.unit || ''}
                      onChange={(e) =>
                        setMaternalCatalog((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, unit: e.target.value } : m))
                        )
                      }
                      placeholder="उदा. g/dL, गोळ्या"
                      className="w-32 border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(item.repeatEveryVisit)}
                      onChange={(e) =>
                        setMaternalCatalog((prev) =>
                          prev.map((m, i) =>
                            i === idx ? { ...m, repeatEveryVisit: e.target.checked } : m
                          )
                        )
                      }
                      className="w-4 h-4 accent-teal-700"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(item.requiresBatchNumber)}
                      onChange={(e) =>
                        setMaternalCatalog((prev) =>
                          prev.map((m, i) =>
                            i === idx ? { ...m, requiresBatchNumber: e.target.checked } : m
                          )
                        )
                      }
                      className="w-4 h-4 accent-teal-700"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setMaternalCatalog((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="p-1 text-slate-400 hover:text-rose-700"
                      title="सेवा काढून टाका"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-2 border-t border-slate-100 items-end">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">कोड *</label>
            <input
              value={newAncCode}
              onChange={(e) => setNewAncCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="उदा. ALBENDAZOLE"
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono-tabular"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">सेवेचे नाव *</label>
            <input
              value={newAncName}
              onChange={(e) => setNewAncName(e.target.value)}
              placeholder="उदा. जंतनाशक गोळी (Albendazole)"
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">एकक (Unit)</label>
            <input
              value={newAncUnit}
              onChange={(e) => setNewAncUnit(e.target.value)}
              placeholder="उदा. १ गोळी"
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1 text-xs text-slate-700 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={newAncRepeatEveryVisit}
                  onChange={(e) => setNewAncRepeatEveryVisit(e.target.checked)}
                  className="w-4 h-4 accent-teal-700"
                />
                प्रत्येक भेटीत
              </label>
              <label className="inline-flex items-center gap-1 text-xs text-slate-700 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={newAncRequiresBatch}
                  onChange={(e) => setNewAncRequiresBatch(e.target.checked)}
                  className="w-4 h-4 accent-teal-700"
                />
                बॅच
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                const code = newAncCode.trim();
                const name = newAncName.trim();
                if (!code || !name) {
                  setToast({ msg: 'कृपया सेवा कोड आणि नाव भरा.', type: 'error' });
                  return;
                }
                if (maternalCatalog.some((m) => m.serviceCode === code)) {
                  setToast({ msg: 'हा सेवा कोड आधीच उपलब्ध आहे.', type: 'error' });
                  return;
                }
                setMaternalCatalog((prev) => [
                  ...prev,
                  {
                    serviceCode: code,
                    serviceName: name,
                    inputType: 'TEXT',
                    unit: newAncUnit.trim() || undefined,
                    requiresBatchNumber: newAncRequiresBatch,
                    repeatEveryVisit: newAncRepeatEveryVisit,
                    displayOrder: prev.length + 1,
                    isActive: true,
                  },
                ]);
                setNewAncCode('');
                setNewAncName('');
                setNewAncUnit('');
                setNewAncRequiresBatch(false);
                setNewAncRepeatEveryVisit(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" /> सेवा जोडा
            </button>
          </div>
        </div>
      </div>

      {/* Excel Upload Confirmation */}
      {pendingUploadFile && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <div className="app-modal max-w-md p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">प्रणालीत Excel डेटा अपलोड करा</h3>
            <p className="text-sm text-slate-700">
              फाइल: <span className="font-semibold">{pendingUploadFile.name}</span>. कृपया पद्धत निवडा:
            </p>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={uploadMode === 'APPEND'}
                  onChange={() => setUploadMode('APPEND')}
                  className="accent-teal-700"
                />
                <span>नवीन ओळी जोडा (Append)</span>
              </label>
              <label className="flex items-center gap-2 text-rose-800 cursor-pointer">
                <input
                  type="radio"
                  checked={uploadMode === 'REPLACE'}
                  onChange={() => setUploadMode('REPLACE')}
                  className="accent-rose-700"
                />
                <span>जुना डेटा बदलून नवीन ठेवा (Replace)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPendingUploadFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="app-btn-secondary"
              >
                रद्द करा
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmUpload}
                className="app-btn-primary"
              >
                {busy ? 'अपलोड होत आहे...' : 'अपलोड करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={
          confirmAction === 'SHARE_ANYONE'
            ? 'इतर कर्मचाऱ्यांसाठी डेटा प्रवेश सुरू करायचा का?'
            : 'प्रणालीत बदल जतन करायचे का?'
        }
        description={
          confirmAction === 'SHARE_ANYONE'
            ? 'हे सुरू केल्यास अधिकृत कर्मचारी त्यांच्या खात्याने लॉगिन करून थेट केंद्रीय प्रणालीत डेटा जतन करू शकतील.'
            : 'निवडलेली माहिती प्रणालीत जतन केली जाईल.'
        }
        loading={busy}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
