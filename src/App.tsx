import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SheetDataProvider, useSheetData } from './context/SheetDataContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BeneficiaryRegistrationPage } from './pages/BeneficiaryRegistrationPage';
import { BeneficiaryListPage } from './pages/BeneficiaryListPage';
import { PregnantWomenPage } from './pages/PregnantWomenPage';
import { MaternalProfilePage } from './pages/MaternalProfilePage';
import { MaternalDashboardPage } from './pages/MaternalDashboardPage';
import { BeneficiaryHistoryPage } from './pages/BeneficiaryHistoryPage';
import { DueVaccinationPage } from './pages/DueVaccinationPage';
import { SessionManagementPage } from './pages/SessionManagementPage';
import { TodaySessionPage } from './pages/TodaySessionPage';
import { SessionBeneficiarySearchPage } from './pages/SessionBeneficiarySearchPage';
import { VaccinationTickMarkSheetPage } from './pages/VaccinationTickMarkSheetPage';
import { RiChecklistPage } from './pages/RiChecklistPage';
import { ReportsPage } from './pages/ReportsPage';
import { SubcentreManagementPage } from './pages/SubcentreManagementPage';
import { VillageManagementPage } from './pages/VillageManagementPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { VaccineMasterPage } from './pages/VaccineMasterPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SettingsPage } from './pages/SettingsPage';
import { UserRole } from './types';

const RoleGuard: React.FC<{ roles: UserRole[]; children: React.ReactNode }> = ({
  roles,
  children,
}) => {
  const { currentUser } = useSheetData();
  if (!currentUser || !roles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AppShell: React.FC = () => {
  const { authLoading, needsAuth, db, currentUser } = useSheetData();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-600">
        प्रणाली लोड होत आहे...
      </div>
    );
  }

  if (needsAuth || !db || !currentUser) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/maternal-dashboard" element={<MaternalDashboardPage />} />
        <Route
          path="/beneficiaries/register"
          element={
            <RoleGuard roles={['ADMIN', 'DATA_OPERATOR', 'CHO', 'ANM']}>
              <BeneficiaryRegistrationPage />
            </RoleGuard>
          }
        />
        <Route path="/beneficiaries" element={<BeneficiaryListPage />} />
        <Route path="/pregnant-women" element={<PregnantWomenPage />} />
        <Route path="/pregnant-women/:beneficiaryId" element={<MaternalProfilePage />} />
        <Route path="/sessions" element={<SessionManagementPage />} />
        <Route path="/today-session" element={<TodaySessionPage />} />
        <Route path="/session-search" element={<SessionBeneficiarySearchPage />} />
        <Route path="/tick-sheet" element={<VaccinationTickMarkSheetPage />} />
        <Route path="/ri-checklist" element={<RiChecklistPage />} />
        <Route path="/history" element={<BeneficiaryHistoryPage />} />
        <Route path="/due-vaccinations" element={<DueVaccinationPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/subcentres"
          element={
            <RoleGuard roles={['ADMIN']}>
              <SubcentreManagementPage />
            </RoleGuard>
          }
        />
        <Route
          path="/villages"
          element={
            <RoleGuard roles={['ADMIN']}>
              <VillageManagementPage />
            </RoleGuard>
          }
        />
        <Route
          path="/staff"
          element={
            <RoleGuard roles={['ADMIN']}>
              <StaffManagementPage />
            </RoleGuard>
          }
        />
        <Route
          path="/vaccine-master"
          element={
            <RoleGuard roles={['ADMIN', 'MEDICAL_OFFICER']}>
              <VaccineMasterPage />
            </RoleGuard>
          }
        />
        <Route
          path="/users"
          element={
            <RoleGuard roles={['ADMIN']}>
              <UserManagementPage />
            </RoleGuard>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <RoleGuard roles={['ADMIN', 'MEDICAL_OFFICER']}>
              <AuditLogPage />
            </RoleGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <RoleGuard roles={['ADMIN']}>
              <SettingsPage />
            </RoleGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl p-6 shadow-sm space-y-3">
            <h1 className="text-base font-bold text-rose-800">
              प्रणाली लोड करताना तांत्रिक अडचण आली
            </h1>
            <p className="text-xs text-slate-600 break-words">
              {this.state.error.message || 'अपेक्षित नसलेली त्रुटी आली आहे.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800"
            >
              पृष्ठ पुन्हा लोड करा
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <HashRouter>
        <SheetDataProvider>
          <AppShell />
        </SheetDataProvider>
      </HashRouter>
    </AppErrorBoundary>
  );
}
