import React, { useState } from 'react';
import {
  AlertCircle,
  FileSpreadsheet,
  FolderOpen,
  LogOut,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { CENTRAL_OWNER_EMAIL, DEFAULT_SPREADSHEET_TITLE } from '../services/googleSheetsService';

export const LoginPage: React.FC = () => {
  const {
    needsAuth,
    fbUser,
    db,
    currentUser,
    isCentralOwner,
    centralSheetMissing,
    sheetLoading,
    sheetError,
    availableSheets,
    signIn,
    logout,
    createNewSheet,
    connectSheet,
  } = useSheetData();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sheetInput, setSheetInput] = useState('');
  const [customTitle, setCustomTitle] = useState(DEFAULT_SPREADSHEET_TITLE);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google लॉगिन करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createNewSheet(customTitle.trim() || DEFAULT_SPREADSHEET_TITLE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sheet तयार करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInput = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await connectSheet(sheetInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sheet जोडताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // Case 1: Needs Google OAuth sign-in
  if (needsAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-xl bg-teal-50 text-teal-700">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">प्राथमिक आरोग्य केंद्र भादा</h1>
            <p className="text-sm text-slate-600">डिजिटल लसीकरण व्यवस्थापन प्रणाली</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              कोणत्याही Gmail खात्याने लॉगिन केल्यास सर्व डेटा थेट{' '}
              <span className="font-mono-tabular font-semibold text-slate-700">
                {CENTRAL_OWNER_EMAIL}
              </span>{' '}
              च्या Google Sheet मध्ये सुरक्षितपणे जतन होतो.
            </p>
          </div>

          {(error || sheetError) && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              {error || sheetError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="gsi-material-button"
          >
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {loading ? 'लॉगिन होत आहे...' : 'Sign in with Google'}
              </span>
            </div>
          </button>

          <div className="text-center text-xs text-slate-500">
            Google Sheets आणि Google Drive परवानगी आवश्यक आहे
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Signed in, waiting on Drive check / sheet creation / loading
  if (sheetLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2 max-w-sm w-full">
          <FileSpreadsheet className="w-8 h-8 text-teal-700 mx-auto animate-pulse" />
          <div className="text-sm font-semibold text-slate-900">
            {isCentralOwner
              ? 'PHC Bhada मुख्य Google Sheet तपासत / तयार करत आहे...'
              : 'केंद्रीय Google Sheet सिंक होत आहे...'}
          </div>
          <div className="text-xs text-slate-500">
            सर्व १२ टॅब्स, कॉलम्स आणि राष्ट्रीय लसीकरण वेळापत्रक लोड होत आहे. कृपया प्रतीक्षा करा.
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Signed in, sheet loaded, but user is explicitly marked inactive in users tab
  if (db && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-6 space-y-4 text-center">
          <h2 className="text-lg font-bold text-rose-700">प्रवेश निष्क्रिय आहे (Account Inactive)</h2>
          <p className="text-sm text-slate-700">
            तुमचे खाते (<span className="font-mono-tabular font-semibold">{fbUser?.email}</span>) केंद्रीय
            Google Sheet मधील वापरकर्ता यादीत निष्क्रिय केलेले आहे. कृपया{' '}
            <span className="font-mono-tabular font-semibold">{CENTRAL_OWNER_EMAIL}</span> प्रशासकाशी
            संपर्क साधा.
          </p>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" /> दुसऱ्या खात्याने लॉगिन करा
          </button>
        </div>
      </div>
    );
  }

  // Case 4A: Non-owner Gmail signed in, but phbhada@gmail.com hasn't initialized the central Sheet yet (or permission missing)
  if (!isCentralOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h1 className="text-lg font-bold text-slate-900">केंद्रीय Google Sheet प्रतीक्षा</h1>
              <p className="text-xs text-slate-600 mt-1">
                लॉगिन खाते: <span className="font-mono-tabular font-medium text-slate-800">{fbUser?.email}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1 text-xs text-rose-700 hover:underline shrink-0 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" /> बाहेर पडा
            </button>
          </div>

          {(error || sheetError) && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              {error || sheetError}
            </div>
          )}

          {centralSheetMissing && !sheetError && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                मुख्य Google Sheet अद्याप तयार झालेले नाही
              </div>
              <p className="text-xs leading-relaxed">
                या प्रणालीचा सर्व डेटा केवळ{' '}
                <span className="font-mono-tabular font-semibold">{CENTRAL_OWNER_EMAIL}</span> च्या केंद्रीय
                Google Sheet मध्ये जतन केला जातो. कृपया{' '}
                <span className="font-mono-tabular font-semibold">{CENTRAL_OWNER_EMAIL}</span> यांना एकदा
                Sign in with Google करून मुख्य Google Sheet तयार व शेअर करण्यास सांगा.
              </p>
            </div>
          )}

          <form onSubmit={handleConnectInput} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <FolderOpen className="w-4 h-4 text-teal-700" />
              {CENTRAL_OWNER_EMAIL} चे शेअर केलेले Google Sheet जोडा
            </div>
            <p className="text-xs text-slate-600">
              तुमच्याकडे <span className="font-mono-tabular">{CENTRAL_OWNER_EMAIL}</span> ने शेअर केलेली
              Google Sheet लिंक किंवा Spreadsheet ID असल्यास खाली पेस्ट करा:
            </p>
            <input
              required
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60"
              >
                {loading ? 'जोडत आहे...' : 'केंद्रीय Sheet जोडा'}
              </button>
              <button
                type="button"
                onClick={logout}
                className="py-2 px-4 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium whitespace-nowrap"
              >
                दुसऱ्या Gmail ने लॉगिन करा
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Case 4B: Central owner (phbhada@gmail.com) fallback panel if manual creation/selection is needed
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">PHC भादा मुख्य Google Sheet सेटअप</h1>
            <p className="text-xs text-slate-600 mt-1">
              मुख्य प्रशासक खाते:{' '}
              <span className="font-mono-tabular font-semibold text-slate-800">{fbUser?.email}</span> · सर्व
              लॉगिनचा डेटा याच Google Sheet मध्ये जतन होईल.
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-xs text-rose-700 hover:underline shrink-0 whitespace-nowrap"
          >
            बाहेर पडा
          </button>
        </div>

        {(error || sheetError) && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            {error || sheetError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form onSubmit={handleCreateSheet} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-sm">
              <PlusCircle className="w-4 h-4" /> नवीन मुख्य Google Sheet तयार करा
            </div>
            <p className="text-xs text-slate-600">
              तुमच्या Google Drive मध्ये सर्व १२ आवश्यक टॅब्स, कॉलम्स आणि NIS वेळापत्रकासह नवीन शीट तयार होईल.
            </p>
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Sheet चे नाव"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60"
            >
              {loading ? 'तयार करत आहे...' : 'नवीन Sheet तयार करा'}
            </button>
          </form>

          <form onSubmit={handleConnectInput} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <FolderOpen className="w-4 h-4" /> विद्यमान Google Sheet जोडा
            </div>
            <p className="text-xs text-slate-600">
              तुमच्याकडे आधीच Google Sheet असल्यास त्याची लिंक (URL) किंवा Spreadsheet ID पेस्ट करा.
            </p>
            <input
              required
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60"
            >
              {loading ? 'जोडत आहे...' : 'Sheet जोडा'}
            </button>
          </form>
        </div>

        {availableSheets.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700">तुमच्या Drive मधील उपलब्ध Sheets:</div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-44 overflow-y-auto">
              {availableSheets.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="truncate font-medium text-slate-800">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => connectSheet(s.id)}
                    className="px-3 py-1 rounded bg-teal-50 text-teal-800 hover:bg-teal-100 text-xs font-semibold shrink-0 whitespace-nowrap"
                  >
                    निवडा
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
