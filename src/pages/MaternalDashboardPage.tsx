import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Baby,
  CalendarClock,
  HeartPulse,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { formatDDMMYYYY, getTodayIST } from '../utils/dateUtils';
import { formatNumberIN } from '../utils/localeUtils';
import {
  computeMaternalDashboardMetricsAndAlerts,
  MaternalAlertItem,
} from '../utils/maternalUtils';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';

const AlertPanel: React.FC<{
  title: string;
  items: MaternalAlertItem[];
  emptyText: string;
  accentBorderClass: string;
  icon: React.ReactNode;
}> = ({ title, items, emptyText, accentBorderClass, icon }) => (
  <div className={`app-card overflow-hidden border-l-4 ${accentBorderClass}`}>
    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
      <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-slate-900">
        {icon}
        <span>{title}</span>
      </div>
      <span className="font-mono-tabular text-xs font-bold text-slate-700">
        {formatNumberIN(items.length)}
      </span>
    </div>
    {items.length === 0 ? (
      <div className="p-4 text-xs text-slate-500">{emptyText}</div>
    ) : (
      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/pregnant-women/${item.beneficiary.id}`}
            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">{item.title}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">{item.detailText}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {item.beneficiary.villageName} · {item.beneficiary.subcentreName} ·{' '}
                <span className="font-mono-tabular">{item.beneficiary.mobile}</span>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-teal-800 whitespace-nowrap">
              <span className="font-mono-tabular text-[11px] text-slate-500">
                {formatDDMMYYYY(item.dueDate)}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>
    )}
  </div>
);

export const MaternalDashboardPage: React.FC = () => {
  const { db, currentUser, seedDemoPregnancyRecord } = useSheetData();
  const navigate = useNavigate();

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [subcentreFilter, setSubcentreFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  const today = getTodayIST();
  const effectiveSubcentre = scopedSubcentre || subcentreFilter;

  const filteredVillages = useMemo(() => {
    if (!db) return [];
    return effectiveSubcentre
      ? db.villages.filter((v) => v.isActive && v.subcentreId === effectiveSubcentre)
      : db.villages.filter((v) => v.isActive);
  }, [db, effectiveSubcentre]);

  const analytics = useMemo(() => {
    if (!db) return null;
    return computeMaternalDashboardMetricsAndAlerts(db, {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      subcentreId: effectiveSubcentre || undefined,
      villageId: villageFilter || undefined,
      todayISO: today,
    });
  }, [db, fromDate, toDate, effectiveSubcentre, villageFilter, today]);

  if (!db || !analytics) return null;

  const canSeedDemo = Boolean(
    currentUser && ['ADMIN', 'MEDICAL_OFFICER'].includes(currentUser.role)
  );

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      const res = await seedDemoPregnancyRecord();
      setToast({
        msg: `चाचणी Demo गरोदर माता (${res.beneficiary.beneficiaryCode}) तयार झाली!`,
        type: 'success',
      });
      setTimeout(() => navigate(`/pregnant-women/${res.beneficiary.id}`), 500);
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'Demo नोंद तयार करताना त्रुटी आली.',
        type: 'error',
      });
    } finally {
      setSeedingDemo(false);
    }
  };

  return (
    <div className="app-page space-y-5">
      <PageHeader
        title="माता डॅशबोर्ड व स्वयंचलित अलर्ट्स (Maternal Dashboard)"
        subtitle="ANC-1 ते ANC-4 प्रगती, High Risk निगराणी, प्रसूती नियोजन, PNC व गावनिहाय विश्लेषण"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canSeedDemo && (
              <button
                type="button"
                disabled={seedingDemo}
                onClick={handleSeedDemo}
                className="app-btn-soft text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                {seedingDemo ? 'तयार होत आहे...' : 'चाचणी Demo गरोदर माता रेकॉर्ड तयार करा'}
              </button>
            )}
            <Link to="/pregnant-women" className="app-btn-primary text-xs">
              <HeartPulse className="w-3.5 h-3.5 shrink-0" /> गरोदर माता यादी
            </Link>
          </div>
        }
      />

      {/* Clinical Decision Safety Disclaimer */}
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <span>
          <strong>वैद्यकीय पडताळणी सूचना:</strong> प्रणालीतील High Risk Pregnancy (HRP) अलर्ट्स व देय तारखा प्राथमिक आरोग्य तपासणीच्या मदतीसाठी आहेत. अंतिम वैद्यकीय निदान, जोखीम निश्चिती व उपचार वैद्यकीय अधिकाऱ्यांच्या (MO) तपासणीनंतरच ग्राह्य धरले जातात.
        </span>
      </div>

      {/* Filters Bar: Date-wise, Subcentre-wise, Village-wise */}
      <div className="app-card p-3.5 md:p-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="app-label">पासून दिनांक</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="app-input font-mono-tabular"
            />
          </div>
          <div>
            <label className="app-label">पर्यंत दिनांक</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="app-input font-mono-tabular"
            />
          </div>
          <div>
            <label className="app-label">उपकेंद्र</label>
            <select
              disabled={Boolean(scopedSubcentre)}
              value={effectiveSubcentre}
              onChange={(e) => {
                setSubcentreFilter(e.target.value);
                setVillageFilter('');
              }}
              className="app-input"
            >
              <option value="">सर्व उपकेंद्रे</option>
              {db.subcentres.filter((s) => s.isActive).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="app-label">गाव</label>
            <select
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              className="app-input"
            >
              <option value="">सर्व गावे</option>
              {filteredVillages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
                if (!scopedSubcentre) setSubcentreFilter('');
                setVillageFilter('');
              }}
              className="w-full app-btn-secondary text-xs py-2"
            >
              फिल्टर रीसेट करा
            </button>
          </div>
        </div>
      </div>

      {/* KPI Grid (12 Maternal Lifecycle Indicators) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'एकूण नोंदणीकृत माता', value: analytics.totalPregnantWomen, tone: 'text-slate-900' },
          { label: 'सक्रिय गर्भधारणा', value: analytics.activePregnancies, tone: 'text-teal-800' },
          { label: 'ANC-1 पूर्ण', value: analytics.anc1Count, tone: 'text-slate-900' },
          { label: 'ANC-2 पूर्ण', value: analytics.anc2Count, tone: 'text-slate-900' },
          { label: 'ANC-3 पूर्ण', value: analytics.anc3Count, tone: 'text-slate-900' },
          { label: 'ANC-4 पूर्ण', value: analytics.anc4Count, tone: 'text-emerald-700' },
          { label: 'ANC तपासणी प्रलंबित', value: analytics.ancPendingCount, tone: 'text-amber-700' },
          { label: 'High Risk माता (HRP)', value: analytics.highRiskCount, tone: 'text-rose-700' },
          { label: 'संदर्भित (Referred)', value: analytics.referredCount, tone: 'text-rose-700' },
          { label: 'EDD जवळ (<= ३० दिवस)', value: analytics.nearEddCount, tone: 'text-amber-700' },
          { label: 'प्रसूती पूर्ण', value: analytics.deliveriesCompletedCount, tone: 'text-emerald-700' },
          { label: 'PNC तपासणी प्रलंबित', value: analytics.pncPendingCount, tone: 'text-amber-700' },
        ].map((kpi) => (
          <div key={kpi.label} className="app-card p-3.5">
            <div className="text-[11px] font-medium text-slate-500">{kpi.label}</div>
            <div className={`text-2xl font-bold mt-1 font-mono-tabular ${kpi.tone}`}>
              {formatNumberIN(kpi.value)}
            </div>
          </div>
        ))}
      </div>

      {/* 6 Automatic Alerts Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertPanel
          title="पुढील ANC भेट देय (पुढील ७ दिवस)"
          items={analytics.alerts.nextAncDue}
          emptyText="पुढील ७ दिवसांत नियोजित ANC भेट नाही."
          accentBorderClass="border-l-teal-600"
          icon={<CalendarClock className="w-4 h-4 text-teal-700" />}
        />
        <AlertPanel
          title="EDD जवळ आलेल्या माता (<= ३० दिवस / उलटलेले)"
          items={analytics.alerts.nearEdd}
          emptyText="सध्या जवळच्या EDD असलेल्या माता नाहीत."
          accentBorderClass="border-l-amber-600"
          icon={<Baby className="w-4 h-4 text-amber-700" />}
        />
        <AlertPanel
          title="ANC तपासणी प्रलंबित यादी (Pending / Overdue)"
          items={analytics.alerts.pendingAnc}
          emptyText="सर्व सक्रिय मातांच्या ANC तपासण्या वेळेवर आहेत."
          accentBorderClass="border-l-rose-600"
          icon={<Stethoscope className="w-4 h-4 text-rose-700" />}
        />
        <AlertPanel
          title="High Risk माता पाठपुरावा प्रलंबित (HRP Follow-up)"
          items={analytics.alerts.pendingHrpFollowUp}
          emptyText="सध्या प्रलंबित HRP पाठपुरावा नाही."
          accentBorderClass="border-l-rose-700"
          icon={<ShieldAlert className="w-4 h-4 text-rose-700" />}
        />
        <AlertPanel
          title="संदर्भित माता पाठपुरावा प्रलंबित (Referral Follow-up)"
          items={analytics.alerts.pendingReferralFollowUp}
          emptyText="सध्या प्रलंबित संदर्भित पाठपुरावा नाही."
          accentBorderClass="border-l-amber-700"
          icon={<AlertTriangle className="w-4 h-4 text-amber-700" />}
        />
        <AlertPanel
          title="प्रसूतीनंतर PNC-1 / PNC-2 प्रलंबित (Pending PNC)"
          items={analytics.alerts.pendingPnc}
          emptyText="प्रसूती झालेल्या सर्व मातांच्या PNC भेटी पूर्ण आहेत."
          accentBorderClass="border-l-teal-700"
          icon={<HeartPulse className="w-4 h-4 text-teal-700" />}
        />
      </div>

      {/* Subcentre-wise & Village-wise Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="app-card overflow-x-auto">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
            उपकेंद्रनिहाय गरोदर माता संख्या (Subcentre-wise)
          </div>
          {analytics.subcentreBreakdown.length === 0 ? (
            <div className="p-4"><EmptyState message="माहिती उपलब्ध नाही." /></div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">उपकेंद्र</th>
                  <th className="px-4 py-2.5 text-right">नोंदणीकृत माता</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.subcentreBreakdown.map((sc) => (
                  <tr key={sc.subcentreId}>
                    <td className="px-4 py-2 font-medium text-slate-800">{sc.subcentreName}</td>
                    <td className="px-4 py-2 text-right font-mono-tabular font-bold">
                      {formatNumberIN(sc.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="app-card overflow-x-auto">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
            गावनिहाय गरोदर माता संख्या (Village-wise)
          </div>
          {analytics.villageBreakdown.length === 0 ? (
            <div className="p-4"><EmptyState message="माहिती उपलब्ध नाही." /></div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">गाव</th>
                  <th className="px-4 py-2.5">उपकेंद्र</th>
                  <th className="px-4 py-2.5 text-right">माता संख्या</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.villageBreakdown.map((vl) => (
                  <tr key={vl.villageId}>
                    <td className="px-4 py-2 font-medium text-slate-800">{vl.villageName}</td>
                    <td className="px-4 py-2 text-slate-600">{vl.subcentreName}</td>
                    <td className="px-4 py-2 text-right font-mono-tabular font-bold">
                      {formatNumberIN(vl.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: 'success' })} />
    </div>
  );
};
