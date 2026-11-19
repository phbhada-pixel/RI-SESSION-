import React, { useState } from 'react';
import { AlertCircle, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { DEFAULT_SPREADSHEET_TITLE } from '../services/googleSheetsService';

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
    signIn,
    logout,
    createNewSheet,
  } = useSheetData();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async (switchAccount = false) => {
    setError('');
    setLoading(true);
    try {
      await signIn(
        switchAccount
          ? { switchAccount: true }
          : fbUser?.email
            ? { loginHint: fbUser.email }
            : undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'लॉगिन करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializePortalData = async () => {
    setError('');
    setLoading(true);
    try {
      await createNewSheet(DEFAULT_SPREADSHEET_TITLE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'प्रणाली डेटाबेस सुरू करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // Case 1: Needs authentication or 1-click session resume
  if (needsAuth) {
    const alreadySignedInEmail = fbUser?.email || '';
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md app-card p-6 md:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-xl bg-teal-50 text-teal-700">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">प्राथमिक आरोग्य केंद्र भादा</h1>
            <p className="text-sm text-slate-600">गर्भवती माता व्यवस्थापन व डिजिटल लसीकरण प्रणाली</p>
            {alreadySignedInEmail ? (
              <div className="p-3 rounded-lg bg-teal-50/70 border border-teal-200 text-xs text-teal-900 space-y-1 text-left">
                <div className="font-semibold">
                  लॉगिन खाते सक्रिय आहे: <span className="font-mono-tabular">{alreadySignedInEmail}</span>
                </div>
                <p className="text-teal-800 leading-relaxed">
                  सत्राची सुरक्षा मुदत संपल्यास खालील बटनावर १ क्लिक करून सत्र पुढे सुरू ठेवा.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                एकदा लॉगिन केल्यास लॉग आउट करेपर्यंत तुमचे सत्र ब्राउझर रिफ्रेशवरही सुरक्षित सुरू राहील.
              </p>
            )}
          </div>

          {(error || sheetError) && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              {error || sheetError}
            </div>
          )}

          {alreadySignedInEmail ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleGoogleSignIn(false)}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold disabled:opacity-60"
              >
                {loading
                  ? 'सत्र सुरू होत आहे...'
                  : `सत्र पुढे सुरू ठेवा (${alreadySignedInEmail})`}
              </button>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn(true)}
                  disabled={loading}
                  className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50"
                >
                  दुसऱ्या खात्याने लॉगिन करा
                </button>
                <button
                  type="button"
                  onClick={logout}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:underline disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" /> लॉग आउट करा
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleGoogleSignIn(false)}
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
                  {loading ? 'लॉगिन होत आहे...' : 'अधिकृत खात्याने साइन इन करा'}
                </span>
              </div>
            </button>
          )}

          <div className="text-center text-xs text-slate-500">
            प्राथमिक आरोग्य केंद्र भादा · अधिकृत कर्मचारी प्रवेश
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Signed in, loading portal data
  if (sheetLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="app-card p-6 text-center space-y-3 max-w-sm w-full">
          <div className="inline-flex p-2.5 rounded-xl bg-teal-50 text-teal-700 mx-auto">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div className="text-sm font-semibold text-slate-900">प्रणाली डेटा लोड होत आहे...</div>
          <div className="text-xs text-slate-500">
            सर्व नोंदणी, सत्रे आणि राष्ट्रीय लसीकरण वेळापत्रक अद्ययावत होत आहे. कृपया प्रतीक्षा करा.
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Signed in, data loaded, but user is marked inactive
  if (db && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md app-card p-6 space-y-4 text-center">
          <h2 className="text-lg font-bold text-rose-700">प्रवेश निष्क्रिय आहे (Account Inactive)</h2>
          <p className="text-sm text-slate-700">
            तुमचे खाते (<span className="font-mono-tabular font-semibold">{fbUser?.email}</span>) वापरकर्ता
            यादीत निष्क्रिय केलेले आहे. कृपया PHC भादा प्रशासकाशी संपर्क साधा.
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

  // Case 4A: Non-owner signed in, awaiting central initialization
  if (!isCentralOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md app-card p-6 md:p-8 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h1 className="text-lg font-bold text-slate-900">प्रणाली प्रवेश प्रतीक्षा</h1>
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
                प्रणाली डेटाबेस अद्याप सक्रिय झालेला नाही
              </div>
              <p className="text-xs leading-relaxed">
                कृपया PHC भादा मुख्य प्रशासकांना एकदा लॉगिन करून प्रणाली डेटाबेस सक्रिय करण्यास सांगा.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleGoogleSignIn(false)}
              disabled={loading}
              className="flex-1 py-2 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60"
            >
              {loading ? 'तपासत आहे...' : 'पुन्हा तपासा'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="py-2 px-4 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium whitespace-nowrap"
            >
              दुसऱ्या खात्याने लॉगिन करा
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 4B: Central owner fallback setup if automatic initialization did not complete
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md app-card p-6 md:p-8 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">PHC भादा प्रणाली प्रारंभ</h1>
            <p className="text-xs text-slate-600 mt-1">
              प्रशासक खाते: <span className="font-mono-tabular font-semibold text-slate-800">{fbUser?.email}</span>
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

        <p className="text-xs text-slate-600 leading-relaxed">
          सर्व लसीकरण सत्रे, लाभार्थी नोंदी आणि राष्ट्रीय लसीकरण वेळापत्रकासह प्रणाली सुरू करण्यासाठी खालील बटणावर क्लिक करा.
        </p>

        <button
          type="button"
          onClick={handleInitializePortalData}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60"
        >
          {loading ? 'प्रणाली सुरू होत आहे...' : 'प्रणाली डेटाबेस सुरू करा'}
        </button>
      </div>
    </div>
  );
};
