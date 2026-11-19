import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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

interface NavGroup {
  title: string;
  items: NavItem[];
}

const ALL_ROLES: UserRole[] = ['ADMIN', 'MEDICAL_OFFICER', 'DATA_OPERATOR', 'CHO', 'ANM'];

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'सारांश',
    items: [
      { to: '/', label: 'डॅशबोर्ड', icon: <LayoutDashboard className="w-4 h-4 shrink-0" />, roles: ALL_ROLES },
      { to: '/maternal-dashboard', label: 'माता डॅशबोर्ड', icon: <HeartPulse className="w-4 h-4 shrink-0" />, roles: ALL_ROLES },
    ],
  },
  {
    title: 'दैनिक सत्र व लाभार्थी',
    items: [
      {
        to: '/today-session',
        label: 'आजचे लसीकरण सत्र',
        icon: <ClipboardCheck className="w-4 h-4 shrink-0" />,
        roles: ALL_ROLES,
      },
      {
        to: '/sessions',
        label: 'लसीकरण सत्र व्यवस्थापन',
        icon: <CalendarCheck className="w-4 h-4 shrink-0" />,
        roles: ALL_ROLES,
      },
      {
        to: '/tick-sheet',
        label: 'लसीकरण टिकमार्क शीट',
        icon: <CheckSquare className="w-4 h-4 shrink-0" />,
        roles: ALL_ROLES,
      },
      {
        to: '/ri-checklist',
        label: 'RI सत्र निरीक्षण चेकलिस्ट',
        icon: <ClipboardList className="w-4 h-4 shrink-0" />,
        roles: ALL_ROLES,
      },
      {
        to: '/beneficiaries/register',
        label: 'लाभार्थी नोंदणी',
        icon: <UserPlus className="w-4 h-4 shrink-0" />,
        roles: ['ADMIN', 'DATA_OPERATOR', 'CHO', 'ANM'],
      },
      {
        to: '/beneficiaries',
        label: 'लाभार्थी यादी',
        icon: <Baby className="w-4 h-4 shrink-0" />,
        roles: ALL_ROLES,
      },
      {
        to: '/pregnant-women',
        label: 'गरोदर माता व्यवस्थापन',
        icon: <HeartPulse className="w-4 h-4 shrink-0" />,
        roles: ALL_ROLES,
      },
      {
        to: '/session-search',
        label: 'सत्रनिहाय लाभार्थी शोध',
        icon: <Search className="w-4 h-4 shrink-0" />,
        roles: ALL_ROLES,
      },
    ],
  },
  {
    title: 'पाठपुरावा व अहवाल',
    items: [
      { to: '/due-vaccinations', label: 'देय लसीकरण', icon: <Clock className="w-4 h-4 shrink-0" />, roles: ALL_ROLES },
      { to: '/history', label: 'लसीकरण व ANC इतिहास', icon: <History className="w-4 h-4 shrink-0" />, roles: ALL_ROLES },
      { to: '/reports', label: 'अहवाल', icon: <FileBarChart2 className="w-4 h-4 shrink-0" />, roles: ALL_ROLES },
    ],
  },
  {
    title: 'प्रशासन व मास्टर सेटअप',
    items: [
      { to: '/subcentres', label: 'उपकेंद्र व्यवस्थापन', icon: <Building2 className="w-4 h-4 shrink-0" />, roles: ['ADMIN'] },
      { to: '/villages', label: 'गाव व्यवस्थापन', icon: <MapPin className="w-4 h-4 shrink-0" />, roles: ['ADMIN'] },
      { to: '/staff', label: 'कर्मचारी व्यवस्थापन', icon: <Users className="w-4 h-4 shrink-0" />, roles: ['ADMIN'] },
      {
        to: '/vaccine-master',
        label: 'लस व वेळापत्रक (Master)',
        icon: <Syringe className="w-4 h-4 shrink-0" />,
        roles: ['ADMIN', 'MEDICAL_OFFICER'],
      },
      { to: '/users', label: 'वापरकर्ता व्यवस्थापन', icon: <UserCog className="w-4 h-4 shrink-0" />, roles: ['ADMIN'] },
      {
        to: '/audit-logs',
        label: 'सुरक्षा नोंदवही (Audit Log)',
        icon: <ShieldAlert className="w-4 h-4 shrink-0" />,
        roles: ['ADMIN', 'MEDICAL_OFFICER'],
      },
      { to: '/settings', label: 'सेटिंग्ज (Settings)', icon: <Settings className="w-4 h-4 shrink-0" />, roles: ['ADMIN'] },
    ],
  },
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
  const location = useLocation();
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
      ? 'अद्यतनित होत आहे...'
      : syncStatus === 'OFFLINE'
        ? 'ऑफलाइन'
        : syncStatus === 'FAILED'
          ? 'संपर्क अयशस्वी'
          : `अद्ययावत${lastSyncedIST ? ` · ${lastSyncedIST} IST` : ''}`;

  const syncColorClass =
    syncStatus === 'SYNCING'
      ? 'text-teal-700'
      : syncStatus === 'OFFLINE' || syncStatus === 'FAILED'
        ? 'text-rose-700 font-semibold'
        : 'text-emerald-700 font-medium';

  const visibleGroups = useMemo(() => {
    if (!currentUser) return [];
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.roles.includes(currentUser.role)),
    })).filter((g) => g.items.length > 0);
  }, [currentUser]);

  const currentRouteTitle = useMemo(() => {
    if (location.pathname.startsWith('/pregnant-women/') && location.pathname.length > '/pregnant-women/'.length) {
      return 'माता ३६०° संपूर्ण आरोग्य प्रोफाइल';
    }
    const allItems = NAV_GROUPS.flatMap((g) => g.items);
    const exact = allItems.find((i) => i.to === location.pathname);
    return exact?.label || 'डॅशबोर्ड';
  }, [location.pathname]);

  const handleConfirmShare = async () => {
    setSharingBusy(true);
    try {
      await enableMultiGmailSharing();
      setShareConfirmOpen(false);
      setToast({
        msg: 'आता सर्व अधिकृत कर्मचारी त्यांच्या खात्यावरून लॉगिन करून थेट प्रणालीत डेटा जतन करू शकतील.',
        type: 'success',
      });
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'कर्मचारी प्रवेश परवानगी सक्रिय करताना त्रुटी आली.',
        type: 'error',
      });
    } finally {
      setSharingBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Mobile Header */}
      <header className="no-print md:hidden bg-teal-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-teal-800 sticky top-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-5 h-5 text-teal-200 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate">प्राथमिक आरोग्य केंद्र भादा</div>
            <div className="text-[11px] text-teal-200 truncate">{currentRouteTitle}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen((s) => !s)}
          className="p-2 rounded-lg bg-teal-800 hover:bg-teal-700 text-white shrink-0"
          aria-label="मेनू उघडा"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="no-print fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`no-print fixed md:static inset-y-0 left-0 z-40 w-64 bg-teal-950 text-white flex flex-col shrink-0 transition-transform duration-150 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="hidden md:block px-4 py-4 border-b border-teal-900">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-teal-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold leading-snug truncate">प्राथमिक आरोग्य केंद्र भादा</div>
              <div className="text-[11px] text-teal-200 mt-0.5 truncate">गर्भवती माता व्यवस्थापन प्रणाली</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {visibleGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <div className="px-3 pb-1 text-[11px] font-semibold text-teal-300/80 tracking-wide">
                {group.title}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-teal-700 text-white font-semibold'
                        : 'text-teal-100/90 hover:bg-teal-900/80 hover:text-white'
                    }`
                  }
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-teal-900 bg-teal-950 space-y-2.5">
          <div className="text-xs text-teal-200 space-y-0.5">
            <div className="font-semibold text-white truncate">{currentUser?.name}</div>
            <div className="truncate text-[11px] text-teal-200/90">
              {currentUser?.role}
              {currentUser?.subcentreName ? ` · ${currentUser.subcentreName}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" /> बाहेर पडा
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Workspace Top Bar */}
        <div className="no-print bg-white border-b border-slate-200 px-4 md:px-6 py-2 flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
              <span className="truncate">प्राथमिक आरोग्य केंद्र भादा</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-800 truncate">{currentRouteTitle}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
              <span className={`font-mono-tabular whitespace-nowrap ${syncColorClass}`}>
                {syncLabel}
              </span>
            </div>
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
              className="hidden sm:inline-flex app-btn-secondary py-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Excel डाउनलोड
            </button>
            <button
              type="button"
              onClick={refreshFromSheet}
              disabled={!db || syncing}
              className="app-btn-primary px-2.5 md:px-3 py-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'अद्यतनित होत आहे...' : 'माहिती रीफ्रेश करा'}</span>
              <span className="sm:hidden">{syncing ? 'सिंक...' : 'रीफ्रेश'}</span>
            </button>
          </div>
        </div>

        {/* Multi-Staff Access Prompt for Central Owner */}
        {isCentralOwner && db && !sharedWithAnyone && (
          <div className="no-print bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-amber-900">
              इतर कर्मचाऱ्यांच्या खात्यांवरून लॉगिन केल्यास डेटा थेट केंद्रीय प्रणालीत जतन होण्यासाठी एकदा कर्मचारी प्रवेश परवानगी सक्रिय करा.
            </div>
            <button
              type="button"
              onClick={() => setShareConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" /> कर्मचारी डेटा प्रवेश सक्रिय करा
            </button>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <div className="max-w-[1440px] mx-auto w-full">{children}</div>
        </main>
      </div>

      <ConfirmModal
        open={shareConfirmOpen}
        title="इतर कर्मचाऱ्यांसाठी डेटा प्रवेश सुरू करायचा का?"
        description="ही परवानगी दिल्यास अधिकृत कर्मचारी त्यांच्या खात्याने लॉगिन करून थेट केंद्रीय प्रणालीत डेटा जतन करू शकतील."
        confirmLabel="होय, प्रवेश सुरू करा"
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
