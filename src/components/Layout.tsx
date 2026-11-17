import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Baby,
  Building2,
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  FileBarChart2,
  HeartPulse,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldAlert,
  Syringe,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { CENTRAL_OWNER_EMAIL } from '../services/googleSheetsService';
import { formatTime12hIST } from '../utils/localeUtils';
import { ConfirmModal } from './ConfirmModal';
import { Toast } from './Toast';
import { UserRole } from '../types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const ALL_ROLES: UserRole[] = ['ADMIN', 'MEDICAL_OFFICER', 'DATA_OPERATOR', 'CHO', 'ANM'];

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, roles: ALL_ROLES },
  {
    to: '/beneficiaries/register',
    label: 'लाभार्थी नोंदणी',
    icon: <UserPlus className="w-4 h-4" />,
    roles: ['ADMIN', 'DATA_OPERATOR', 'CHO', 'ANM'],
  },
  { to: '/beneficiaries', label: 'लाभार्थी यादी', icon: <Baby className="w-4 h-4" />, roles: ALL_ROLES },
  {
    to: '/pregnant-women',
    label: 'गरोदर माता व्यवस्थापन',
    icon: <HeartPulse className="w-4 h-4" />,
    roles: ALL_ROLES,
  },
  {
    to: '/sessions',
    label: 'लसीकरण सत्र व्यवस्थापन',
    icon: <CalendarCheck className="w-4 h-4" />,
    roles: ALL_ROLES,
  },
  {
    to: '/today-session',
    label: 'आजचे लसीकरण सत्र',
    icon: <ClipboardCheck className="w-4 h-4" />,
    roles: ALL_ROLES,
  },
  {
    to: '/session-search',
    label: 'सत्रनिहाय लाभार्थी शोध',
    icon: <Search className="w-4 h-4" />,
    roles: ALL_ROLES,
  },
  {
    to: '/tick-sheet',
    label: 'लसीकरण टिकमार्क शीट',
    icon: <CheckSquare className="w-4 h-4" />,
    roles: ALL_ROLES,
  },
  {
    to: '/ri-checklist',
    label: 'RI सत्र निरीक्षण चेकलिस्ट',
    icon: <ClipboardList className="w-4 h-4" />,
    roles: ALL_ROLES,
  },
  { to: '/history', label: 'लसीकरण इतिहास', icon: <History className="w-4 h-4" />, roles: ALL_ROLES },
  { to: '/due-vaccinations', label: 'देय लसीकरण', icon: <Clock className="w-4 h-4" />, roles: ALL_ROLES },
  { to: '/reports', label: 'अहवाल', icon: <FileBarChart2 className="w-4 h-4" />, roles: ALL_ROLES },
  { to: '/subcentres', label: 'उपकेंद्र व्यवस्थापन', icon: <Building2 className="w-4 h-4" />, roles: ['ADMIN'] },
  { to: '/villages', label: 'गाव व्यवस्थापन', icon: <MapPin className="w-4 h-4" />, roles: ['ADMIN'] },
  { to: '/staff', label: 'कर्मचारी व्यवस्थापन', icon: <Users className="w-4 h-4" />, roles: ['ADMIN'] },
  {
    to: '/vaccine-master',
    label: 'Vaccine Master',
    icon: <Syringe className="w-4 h-4" />,
    roles: ['ADMIN', 'MEDICAL_OFFICER'],
  },
  { to: '/users', label: 'User Management', icon: <UserCog className="w-4 h-4" />, roles: ['ADMIN'] },
  {
    to: '/audit-logs',
    label: 'Audit Log',
    icon: <ShieldAlert className="w-4 h-4" />,
    roles: ['ADMIN', 'MEDICAL_OFFICER'],
  },
  { to: '/settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, roles: ['ADMIN'] },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    fbUser,
    db,
    isCentralOwner,
    sharedWithAnyone,
    syncing,
    syncStatus,
    lastSyncedAt,
    refreshFromSheet,
    downloadFullWorkbook,
    enableMultiGmailSharing,
    logout,
  } = useSheetData();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  const lastSyncedIST = lastSyncedAt ? formatTime12hIST(lastSyncedAt, true) : null;

  const syncLabel =
    syncStatus === 'SYNCING'
      ? 'Syncing (सिंक होत आहे...)'
      : syncStatus === 'OFFLINE'
        ? 'Offline (इंटरनेट नाही — डेटा जतन होणार नाही)'
        : syncStatus === 'FAILED'
          ? 'Failed (सिंक अयशस्वी)'
          : `Synced${lastSyncedIST ? ` · ${lastSyncedIST} IST` : ''}`;

  const syncColorClass =
    syncStatus === 'SYNCING'
      ? 'text-teal-700'
      : syncStatus === 'OFFLINE' || syncStatus === 'FAILED'
        ? 'text-rose-700 font-semibold'
        : 'text-emerald-700 font-medium';

  const allowedItems = NAV_ITEMS.filter((i) => currentUser && i.roles.includes(currentUser.role));

  const handleConfirmShare = async () => {
    setSharingBusy(true);
    try {
      await enableMultiGmailSharing();
      setShareConfirmOpen(false);
      setToast({
        msg: 'आता कोणत्याही Gmail खात्याने लॉगिन केल्यास डेटा phbhada@gmail.com च्या Google Sheet मध्ये जतन होईल.',
        type: 'success',
      });
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'Google Sheet शेअर करताना त्रुटी आली.',
        type: 'error',
      });
    } finally {
      setSharingBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Mobile Header */}
      <header className="no-print md:hidden bg-teal-900 text-white px-4 py-3 flex items-center justify-between border-b border-teal-800">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-5 h-5 text-teal-200 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate">प्राथमिक आरोग्य केंद्र भादा</div>
            <div className="text-[11px] text-teal-200 truncate">डिजिटल लसीकरण व्यवस्थापन प्रणाली</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen((s) => !s)}
          className="p-2 rounded-lg bg-teal-800 text-white shrink-0"
          aria-label="मेनू उघडा"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`no-print fixed md:static inset-y-0 left-0 z-40 w-64 bg-teal-950 text-white flex flex-col shrink-0 transition-transform duration-150 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="hidden md:block px-4 py-4 border-b border-teal-900">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-teal-300 shrink-0" />
            <div>
              <div className="text-sm font-bold leading-snug">प्राथमिक आरोग्य केंद्र भादा</div>
              <div className="text-xs text-teal-200 mt-0.5">डिजिटल लसीकरण प्रणाली</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {allowedItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-700 text-white font-semibold'
                    : 'text-teal-100 hover:bg-teal-900/80'
                }`
              }
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-teal-900 bg-teal-950 space-y-2">
          <div className="text-xs text-teal-200 space-y-0.5">
            <div className="font-semibold text-white truncate">{currentUser?.name}</div>
            <div className="truncate">
              {currentUser?.role}
              {currentUser?.subcentreName ? ` · ${currentUser.subcentreName}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-xs font-medium text-white whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" /> बाहेर पडा
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Workspace Top Bar */}
        <div className="no-print bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 min-w-0">
            <span className="font-semibold text-slate-800 truncate">
              {db?.spreadsheetTitle || 'Google Sheet'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">
              केंद्रीय डेटा: <span className="font-mono-tabular">{CENTRAL_OWNER_EMAIL}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className={`font-mono-tabular ${syncColorClass}`}>{syncLabel}</span>
            {db?.spreadsheetUrl && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={db.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-teal-700 hover:underline font-medium whitespace-nowrap"
                >
                  Sheet उघडा <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isCentralOwner && fbUser?.email && (
              <span className="hidden lg:inline text-[11px] text-slate-500 font-mono-tabular">
                लॉगिन: {fbUser.email}
              </span>
            )}
            <button
              type="button"
              onClick={downloadFullWorkbook}
              disabled={!db}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Excel डाउनलोड
            </button>
            <button
              type="button"
              onClick={refreshFromSheet}
              disabled={!db || syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'सिंक होत आहे...' : 'Sheet रीफ्रेश करा'}
            </button>
          </div>
        </div>

        {/* Multi-Gmail Sharing Prompt for Central Owner */}
        {isCentralOwner && db && !sharedWithAnyone && (
          <div className="no-print bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-amber-900">
              इतर कर्मचाऱ्यांच्या Gmail खात्यावरून लॉगिन केल्यास डेटा थेट तुमच्या या Sheet मध्ये जतन होण्यासाठी एकदा शेअरिंग सुरू करा.
            </div>
            <button
              type="button"
              onClick={() => setShareConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" /> इतर Gmail लॉगिनसाठी Sheet शेअर करा
            </button>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>

      <ConfirmModal
        open={shareConfirmOpen}
        title="इतर Gmail लॉगिनसाठी Google Sheet शेअर करायचे का?"
        description={`ही परवानगी दिल्यास कोणतेही कर्मचारी इतर Gmail खात्याने लॉगिन करून थेट ${CENTRAL_OWNER_EMAIL} च्या याच Google Sheet मध्ये डेटा जतन करू शकतील.`}
        confirmLabel="होय, शेअरिंग सुरू करा"
        loading={sharingBusy}
        onConfirm={handleConfirmShare}
        onCancel={() => setShareConfirmOpen(false)}
      />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
};
