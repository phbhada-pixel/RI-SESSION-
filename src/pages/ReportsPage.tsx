import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { formatDDMMYYYY, getTodayIST } from '../utils/dateUtils';
import { evaluateBeneficiaryEligibility } from '../utils/eligibilityEngine';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

type ReportTab =
  | 'DATE'
  | 'SESSION'
  | 'VILLAGE'
  | 'SUBCENTRE'
  | 'VACCINE'
  | 'DUE'
  | 'MISSED'
  | 'BENEFICIARY'
  | 'MONTHLY';

export const ReportsPage: React.FC = () => {
  const { db, currentUser } = useSheetData();
  const [tab, setTab] = useState<ReportTab>('VILLAGE');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [subcentreFilter, setSubcentreFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';
  const effectiveSubcentre = scopedSubcentre || subcentreFilter;
  const today = getTodayIST();

  const filteredVillages = useMemo(() => {
    if (!db) return [];
    return db.villages.filter(
      (v) =>
        (!effectiveSubcentre || v.subcentreId === effectiveSubcentre) &&
        (!villageFilter || v.id === villageFilter)
    );
  }, [db, effectiveSubcentre, villageFilter]);

  const reportData = useMemo(() => {
    if (!db) return { headers: [] as string[], rows: [] as (string | number)[][] };

    const recInRange = db.vaccinationRecords.filter(
      (r) =>
        (!effectiveSubcentre || r.subcentreId === effectiveSubcentre) &&
        (!villageFilter || r.villageId === villageFilter) &&
        (!fromDate || r.administeredDate >= fromDate) &&
        (!toDate || r.administeredDate <= toDate)
    );

    if (tab === 'DATE') {
      const headers = ['दिनांक', 'दिलेले एकूण डोस', 'लाभार्थी संख्या', 'लस प्रकार'];
      const byDate = new Map<string, typeof recInRange>();
      for (const r of recInRange) {
        const arr = byDate.get(r.administeredDate) || [];
        arr.push(r);
        byDate.set(r.administeredDate, arr);
      }
      const rows = Array.from(byDate.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([dt, list]) => [
          formatDDMMYYYY(dt),
          list.length,
          new Set(list.map((r) => r.beneficiaryId)).size,
          Array.from(new Set(list.map((r) => r.vaccineName))).join(', '),
        ]);
      return { headers, rows };
    }

    if (tab === 'SUBCENTRE') {
      const headers = ['उपकेंद्र कोड', 'उपकेंद्र नाव', 'गावे', 'नोंदवलेले लाभार्थी', 'झालेली सत्रे', 'दिलेले एकूण डोस'];
      const rows = db.subcentres
        .filter((sc) => !effectiveSubcentre || sc.id === effectiveSubcentre)
        .map((sc) => [
          sc.code,
          sc.name,
          db.villages.filter((v) => v.subcentreId === sc.id).length,
          db.beneficiaries.filter((b) => b.subcentreId === sc.id).length,
          db.vaccinationSessions.filter(
            (s) =>
              s.subcentreId === sc.id &&
              (!fromDate || s.sessionDate >= fromDate) &&
              (!toDate || s.sessionDate <= toDate)
          ).length,
          recInRange.filter((r) => r.subcentreId === sc.id).length,
        ]);
      return { headers, rows };
    }

    if (tab === 'VILLAGE') {
      const headers = ['गाव कोड', 'गाव नाव', 'उपकेंद्र', 'नोंदवलेले लाभार्थी', 'झालेली सत्रे', 'दिलेले एकूण डोस'];
      const rows = filteredVillages.map((v) => [
        v.villageCode,
        v.name,
        v.subcentreName,
        db.beneficiaries.filter((b) => b.villageId === v.id).length,
        db.vaccinationSessions.filter(
          (s) =>
            s.villageId === v.id &&
            (!fromDate || s.sessionDate >= fromDate) &&
            (!toDate || s.sessionDate <= toDate)
        ).length,
        recInRange.filter((r) => r.villageId === v.id).length,
      ]);
      return { headers, rows };
    }

    if (tab === 'VACCINE') {
      const headers = ['डोस क्रम', 'लस', 'डोस नाव', 'दिलेले एकूण डोस'];
      const rows = db.vaccineSchedule.map((sch) => [
        sch.doseOrder,
        sch.vaccineName,
        sch.doseName,
        recInRange.filter((r) => r.scheduleId === sch.id).length,
      ]);
      return { headers, rows };
    }

    if (tab === 'BENEFICIARY') {
      const headers = ['आयडी', 'प्रकार', 'लाभार्थी नाव', 'आई / पती / पालक', 'जन्मतारीख', 'गाव', 'मोबाईल', 'स्थिती', 'दिलेले डोस', 'लसीकरण तपशील'];
      const benList = db.beneficiaries.filter(
        (b) =>
          (!effectiveSubcentre || b.subcentreId === effectiveSubcentre) &&
          (!villageFilter || b.villageId === villageFilter)
      );
      const rows = benList.map((b) => {
        const benRecs = recInRange.filter((r) => r.beneficiaryId === b.id);
        const isPW = b.beneficiaryType === 'PREGNANT_WOMAN';
        return [
          b.beneficiaryCode,
          isPW ? 'गरोदर माता' : 'बालक',
          b.childName,
          isPW ? b.guardianName || '-' : b.motherName || b.guardianName || '-',
          b.dob ? formatDDMMYYYY(b.dob) : '-',
          b.villageName,
          b.mobile,
          b.status,
          benRecs.length,
          benRecs.map((r) => `${r.doseName} (${formatDDMMYYYY(r.administeredDate)})`).join(', ') || '-',
        ];
      });
      return { headers, rows };
    }

    if (tab === 'SESSION') {
      const headers = ['सत्र कोड', 'दिनांक', 'गाव', 'ठिकाण', 'प्रकार', 'ANM', 'स्थिती', 'सत्रातील डोस'];
      const sesList = db.vaccinationSessions.filter(
        (s) =>
          (!effectiveSubcentre || s.subcentreId === effectiveSubcentre) &&
          (!villageFilter || s.villageId === villageFilter) &&
          (!fromDate || s.sessionDate >= fromDate) &&
          (!toDate || s.sessionDate <= toDate)
      );
      const rows = sesList.map((s) => [
        s.sessionCode,
        formatDDMMYYYY(s.sessionDate),
        s.villageName,
        s.location,
        s.sessionType,
        s.anmName,
        s.status,
        db.vaccinationRecords.filter((r) => r.sessionId === s.id).length,
      ]);
      return { headers, rows };
    }

    if (tab === 'MONTHLY') {
      const headers = ['महिना (YYYY-MM)', 'झालेली सत्रे', 'दिलेले एकूण डोस', 'लसीकरण झालेले लाभार्थी'];
      const monthStats = new Map<string, { sessions: number; doses: number; bens: Set<string> }>();
      for (const s of db.vaccinationSessions) {
        if (
          (!effectiveSubcentre || s.subcentreId === effectiveSubcentre) &&
          (!villageFilter || s.villageId === villageFilter) &&
          (!fromDate || s.sessionDate >= fromDate) &&
          (!toDate || s.sessionDate <= toDate)
        ) {
          const m = s.sessionDate.slice(0, 7);
          const curr = monthStats.get(m) || { sessions: 0, doses: 0, bens: new Set<string>() };
          curr.sessions += 1;
          monthStats.set(m, curr);
        }
      }
      for (const r of recInRange) {
        const m = r.administeredDate.slice(0, 7);
        const curr = monthStats.get(m) || { sessions: 0, doses: 0, bens: new Set<string>() };
        curr.doses += 1;
        curr.bens.add(r.beneficiaryId);
        monthStats.set(m, curr);
      }
      const rows = Array.from(monthStats.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, st]) => [month, st.sessions, st.doses, st.bens.size]);
      return { headers, rows };
    }

    // DUE or MISSED
    const recMap = new Map<string, typeof db.vaccinationRecords>();
    for (const r of db.vaccinationRecords) {
      const arr = recMap.get(r.beneficiaryId) || [];
      arr.push(r);
      recMap.set(r.beneficiaryId, arr);
    }
    const headers = ['आयडी', 'बाळाचे नाव', 'गाव', 'मोबाईल', 'देय डोस संख्या', 'देय डोस यादी'];
    const rows: (string | number)[][] = [];
    for (const b of db.beneficiaries.filter(
      (ben) =>
        ben.status === 'सक्रिय' &&
        (ben.beneficiaryType || 'CHILD') !== 'PREGNANT_WOMAN' &&
        (!effectiveSubcentre || ben.subcentreId === effectiveSubcentre) &&
        (!villageFilter || ben.villageId === villageFilter)
    )) {
      const ev = evaluateBeneficiaryEligibility(
        b,
        today,
        db.vaccineSchedule,
        recMap.get(b.id) || []
      );
      if (tab === 'MISSED') {
        const overdue = ev.dueDoses.filter((d) => d.isOverdue);
        if (overdue.length > 0) {
          rows.push([
            b.beneficiaryCode,
            b.childName,
            b.villageName,
            b.mobile,
            overdue.length,
            overdue.map((d) => d.schedule.doseName).join(', '),
          ]);
        }
      } else if (ev.dueDoses.length > 0) {
        rows.push([
          b.beneficiaryCode,
          b.childName,
          b.villageName,
          b.mobile,
          ev.dueDoses.length,
          ev.dueDoses.map((d) => d.schedule.doseName).join(', '),
        ]);
      }
    }
    return { headers, rows };
  }, [db, tab, effectiveSubcentre, villageFilter, fromDate, toDate, filteredVillages, today]);

  if (!db) return null;

  const tabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'DATE', label: 'दिनांकनिहाय अहवाल' },
    { id: 'SESSION', label: 'सत्रनिहाय अहवाल' },
    { id: 'VILLAGE', label: 'गावनिहाय कव्हरेज' },
    { id: 'SUBCENTRE', label: 'उपकेंद्रनिहाय प्रगती' },
    { id: 'VACCINE', label: 'लसनिहाय सारांश' },
    { id: 'DUE', label: 'देय लाभार्थी' },
    { id: 'MISSED', label: 'चुकलेले / ओव्हरड्यू' },
    { id: 'BENEFICIARY', label: 'लाभार्थी इतिहास' },
    { id: 'MONTHLY', label: 'मासिक सारांश' },
  ];

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">अहवाल (Reports)</h2>
          <p className="text-xs text-slate-500">Excel, PDF आणि प्रिंट स्वरूपात सर्वसमावेशक अहवाल</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToExcel(
                `PHC_Bhada_Report_${tab}_${today}`,
                tab,
                reportData.headers,
                reportData.rows
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
          <button
            type="button"
            onClick={() =>
              exportToPDF(
                `PHC_Bhada_Report_${tab}_${today}`,
                `PHC Bhada Report - ${tab}`,
                `Generated on ${formatDDMMYYYY(today)}`,
                reportData.headers,
                reportData.rows
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800"
          >
            <Printer className="w-4 h-4" /> प्रिंट
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="no-print flex flex-wrap gap-1.5 p-1 bg-slate-200/70 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'bg-white text-teal-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">पासून दिनांक</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">पर्यंत दिनांक</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono-tabular"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">उपकेंद्र</label>
          <select
            disabled={Boolean(scopedSubcentre)}
            value={effectiveSubcentre}
            onChange={(e) => {
              setSubcentreFilter(e.target.value);
              setVillageFilter('');
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-100"
          >
            <option value="">सर्व उपकेंद्रे</option>
            {db.subcentres.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">गाव</label>
          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">सर्व गावे</option>
            {db.villages
              .filter((v) => !effectiveSubcentre || v.subcentreId === effectiveSubcentre)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {reportData.rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">निवडलेल्या निकषांसाठी माहिती उपलब्ध नाही.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 text-xs border-b border-slate-200">
              <tr>
                {reportData.headers.map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 text-xs font-mono-tabular">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
