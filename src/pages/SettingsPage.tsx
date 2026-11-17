import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  HeartPulse,
  PlusCircle,
  Share2,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { CENTRAL_OWNER_EMAIL } from '../services/googleSheetsService';
import { MaternalServiceConfigItem } from '../types';
import { getMaternalServiceCatalog } from '../utils/maternalUtils';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';

export const SettingsPage: React.FC = () => {
  const {
    db,
    isCentralOwner,
    sharedWithAnyone,
    enableMultiGmailSharing,
    saveSystemSettings,
    saveMaternalServiceCatalog,
    connectSheet,
    createNewSheet,
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

  const [switchInput, setSwitchInput] = useState('');
  const [newSheetTitle, setNewSheetTitle] = useState('PHC_Bhada_Vaccination_Database_New');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'APPEND' | 'REPLACE'>('APPEND');

  const [confirmAction, setConfirmAction] = useState<
    'SETTINGS' | 'MATERNAL_CATALOG' | 'SEED_NIS' | 'SEED_HIERARCHY' | 'NEW_SHEET' | 'SHARE_ANYONE' | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  if (!db) return null;

  const staffAppUrl = `${window.location.origin}/?sheetId=${db.spreadsheetId}`;

  const handleCopyStaffLink = async () => {
    try {
      await navigator.clipboard.writeText(staffAppUrl);
      setToast({ msg: 'कर्मचारी अ‍ॅप लिंक कॉपी झाली.', type: 'success' });
    } catch {
      setToast({ msg: 'लिंक कॉपी करता आली नाही.', type: 'error' });
    }
  };

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
        setToast({ msg: 'प्रणाली सेटिंग्ज Google Sheet मध्ये जतन केली.', type: 'success' });
      } else if (confirmAction === 'MATERNAL_CATALOG') {
        await saveMaternalServiceCatalog(maternalCatalog);
        setToast({ msg: 'माता ANC व लसीकरण सेवा यादी Google Sheet मध्ये जतन केली.', type: 'success' });
      } else if (confirmAction === 'SEED_NIS') {
        await seedStandardNIS();
        setToast({ msg: 'राष्ट्रीय लसीकरण वेळापत्रक (NIS) जतन केले.', type: 'success' });
      } else if (confirmAction === 'SEED_HIERARCHY') {
        await seedStarterHierarchy();
        setToast({ msg: 'भादा नमुना उपकेंद्रे व गावे Google Sheet मध्ये जतन केली.', type: 'success' });
      } else if (confirmAction === 'NEW_SHEET') {
        await createNewSheet(newSheetTitle.trim() || 'PHC_Bhada_Vaccination_Database');
        setToast({ msg: 'नवीन Google Sheet तयार करून जोडले.', type: 'success' });
      } else if (confirmAction === 'SHARE_ANYONE') {
        await enableMultiGmailSharing();
        setToast({
          msg: 'आता इतर कोणत्याही Gmail लॉगिनद्वारे डेटा थेट या Sheet मध्ये जतन होईल.',
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
        msg: `${res.rowCount} ओळी Google Sheet मध्ये अपलोड झाल्या (${res.tabsUpdated.join(', ')}).`,
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
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Settings व Google Sheet व्यवस्थापन</h2>
        <p className="text-xs text-slate-500">
          प्रणाली मापदंड, केंद्रीय Google Sheet ({CENTRAL_OWNER_EMAIL}), आणि संपूर्ण डेटा अपलोड / डाउनलोड केंद्र
        </p>
      </div>

      {/* Connected Google Sheet Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <FileSpreadsheet className="w-4 h-4 text-teal-700" />
              सध्या जोडलेले Google Sheet: {db.spreadsheetTitle}
            </div>
            <div className="text-xs text-slate-500 font-mono-tabular break-all">
              Spreadsheet ID: {db.spreadsheetId} · मालक खाते: {CENTRAL_OWNER_EMAIL}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={db.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap"
            >
              Google Sheet उघडा <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={downloadFullWorkbook}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" /> Excel अपलोड करा
            </button>
          </div>
        </div>

        {/* Multi-Gmail Central Save Controls */}
        <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              {sharedWithAnyone ? (
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
              ) : (
                <Share2 className="w-4 h-4 text-amber-700 shrink-0" />
              )}
              <span>
                सर्व Gmail लॉगिन स्थिती:{' '}
                {sharedWithAnyone
                  ? `सक्रिय — कोणतेही Gmail खाते थेट ${CENTRAL_OWNER_EMAIL} च्या या Sheet मध्ये डेटा जतन करू शकते`
                  : 'मर्यादित — इतर Gmail खात्यांना थेट संपादन परवानगी देण्यासाठी खालील बटण दाबा'}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono-tabular break-all">
              कर्मचारी लिंक: {staffAppUrl}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyStaffLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <Copy className="w-3.5 h-3.5" /> कर्मचारी लिंक कॉपी करा
            </button>
            {isCentralOwner && !sharedWithAnyone && (
              <button
                type="button"
                onClick={() => setConfirmAction('SHARE_ANYONE')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" /> सर्व Gmail साठी शेअर सुरू करा
              </button>
            )}
          </div>
        </div>

        {isCentralOwner ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                दुसरे विद्यमान Google Sheet जोडा (URL किंवा ID)
              </label>
              <div className="flex gap-2">
                <input
                  value={switchInput}
                  onChange={(e) => setSwitchInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await connectSheet(switchInput);
                      setSwitchInput('');
                      setToast({ msg: 'नवीन Google Sheet यशस्वीरित्या जोडले.', type: 'success' });
                    } catch (err) {
                      setToast({
                        msg: err instanceof Error ? err.message : 'त्रुटी आली.',
                        type: 'error',
                      });
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold whitespace-nowrap"
                >
                  जोडा
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">नवीन कोरे Google Sheet तयार करा</label>
              <div className="flex gap-2">
                <input
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setConfirmAction('NEW_SHEET')}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> तयार करा
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
            मुख्य Google Sheet बदलण्याचा किंवा नवीन तयार करण्याचा अधिकार फक्त{' '}
            <span className="font-mono-tabular font-semibold">{CENTRAL_OWNER_EMAIL}</span> यांना आहे.
          </div>
        )}
      </div>

      {/* Quick Starter Seeds */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="text-sm font-bold text-slate-900">प्रारंभिक डेटा सेटअप (Google Sheet मध्ये भरा)</div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setConfirmAction('SEED_HIERARCHY')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" /> भादा नमुना उपकेंद्रे व गावे भरा
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('SEED_NIS')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap"
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
        className="bg-white p-5 rounded-xl border border-slate-200 space-y-4"
      >
        <div className="text-sm font-bold text-slate-900">प्राथमिक आरोग्य केंद्र तपशील</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">संस्थेचे नाव</label>
            <input
              required
              value={phcName}
              onChange={(e) => setPhcName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">जिल्हा</label>
            <input
              required
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">राज्य</label>
            <input
              required
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              सत्रानंतर संपादन दिवस (IST)
            </label>
            <input
              type="number"
              min={0}
              max={7}
              value={allowEditDays}
              onChange={(e) => setAllowEditDays(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold whitespace-nowrap"
        >
          सेटिंग्ज जतन करा
        </button>
      </form>

      {/* Admin Maternal ANC Service Master */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
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
            className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            ANC सेवा यादी Google Sheet मध्ये जतन करा
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Google Sheet मध्ये Excel अपलोड करा</h3>
            <p className="text-sm text-slate-700">
              फाइल: <span className="font-semibold">{pendingUploadFile.name}</span>. कृपया पद्धत निवडा:
            </p>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={uploadMode === 'APPEND'}
                  onChange={() => setUploadMode('APPEND')}
                />
                <span>नवीन ओळी जोडा (Append)</span>
              </label>
              <label className="flex items-center gap-2 text-rose-800">
                <input
                  type="radio"
                  checked={uploadMode === 'REPLACE'}
                  onChange={() => setUploadMode('REPLACE')}
                />
                <span>जुना डेटा बदलून नवीन ठेवा (Replace)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPendingUploadFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg whitespace-nowrap"
              >
                रद्द करा
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmUpload}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap"
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
            ? 'इतर Gmail लॉगिनसाठी Sheet शेअर करायचे का?'
            : 'Google Sheet मध्ये बदल करायचे का?'
        }
        description={
          confirmAction === 'SHARE_ANYONE'
            ? `हे सुरू केल्यास कोणतेही कर्मचारी इतर Gmail ने लॉगिन करून थेट ${CENTRAL_OWNER_EMAIL} च्या या Google Sheet मध्ये डेटा जतन करू शकतील.`
            : 'निवडलेली माहिती थेट तुमच्या Google Sheet मध्ये जतन केली जाईल.'
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
