import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import { formatDDMMYYYY, getTodayIST } from '../utils/dateUtils';
import { evaluateBeneficiaryEligibility } from '../utils/eligibilityEngine';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

export const DueVaccinationPage: React.FC = () => {
  const { db, currentUser } = useSheetData();
  const [targetDate, setTargetDate] = useState(getTodayIST());
  const [subcentreFilter, setSubcentreFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [vaccineFilter, setVaccineFilter] = useState('');

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';
  const effectiveSubcentre = scopedSubcentre || subcentreFilter;

  const filteredVillages = useMemo(() => {
    if (!db) return [];
    return effectiveSubcentre
      ? db.villages.filter((v) => v.subcentreId === effectiveSubcentre)
      : db.villages;
  }, [db, effectiveSubcentre]);

  const dueRows = useMemo(() => {
    if (!db) return [];
    const recMap = new Map<string, typeof db.vaccinationRecords>();
    for (const r of db.vaccinationRecords) {
      const arr = recMap.get(r.beneficiaryId) || [];
      arr.push(r);
      recMap.set(r.beneficiaryId, arr);
    }

    return db.beneficiaries
      .filter(
        (b) =>
          b.status === 'सक्रिय' &&
          (b.beneficiaryType || 'CHILD') !== 'PREGNANT_WOMAN' &&
          (!effectiveSubcentre || b.subcentreId === effectiveSubcentre) &&
          (!villageFilter || b.villageId === villageFilter)
      )
      .map((b) =>
        evaluateBeneficiaryEligibility(
          b,
          targetDate,
          db.vaccineSchedule,
          recMap.get(b.id) || []
        )
      )
      .map((ev) => ({
        ...ev,
        matchingDueDoses: vaccineFilter
          ? ev.dueDoses.filter((d) => d.schedule.vaccineId === vaccineFilter)
          : ev.dueDoses,
      }))
      .filter((ev) => ev.matchingDueDoses.length > 0);
  }, [db, effectiveSubcentre, villageFilter, vaccineFilter, targetDate]);

  if (!db) return null;

  const handleExcel = () => {
    exportToExcel(
      `PHC_Bhada_Due_List_${targetDate}`,
      'देय लसीकरण यादी',
      ['आयडी', 'बाळाचे नाव', 'आईचे नाव', 'मोबाईल', 'उपकेंद्र', 'गाव', 'वय', 'देय डोस'],
      dueRows.map((r) => [
        r.beneficiary.beneficiaryCode,
        r.beneficiary.childName,
        r.beneficiary.motherName,
        r.beneficiary.mobile,
        r.beneficiary.subcentreName,
        r.beneficiary.villageName,
        r.ageOnTargetDateLabel,
        r.matchingDueDoses.map((d) => d.schedule.doseName).join(', '),
      ])
    );
  };

  const handlePDF = () => {
    exportToPDF(
      `PHC_Bhada_Due_List_${targetDate}`,
      'PHC Bhada - Due Vaccination List',
      `Target Date: ${formatDDMMYYYY(targetDate)} | Total Beneficiaries: ${dueRows.length}`,
      ['ID', 'Child Name', 'Mother', 'Mobile', 'Village', 'Due Doses'],
      dueRows.map((r) => [
        r.beneficiary.beneficiaryCode,
        r.beneficiary.childName,
        r.beneficiary.motherName,
        r.beneficiary.mobile,
        r.beneficiary.villageName,
        r.matchingDueDoses.map((d) => d.schedule.doseName).join(', '),
      ])
    );
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">देय लसीकरण यादी</h2>
          <p className="text-xs text-slate-500">
            निवडलेल्या तारखेनुसार प्रलंबित व देय डोस असलेले {dueRows.length} लाभार्थी
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
          <button
            type="button"
            onClick={handlePDF}
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

      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">लक्ष्य दिनांक</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
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
            {filteredVillages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">लस</label>
          <select
            value={vaccineFilter}
            onChange={(e) => setVaccineFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">सर्व लसी</option>
            {db.vaccineMaster.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vaccineName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {dueRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            निवडलेल्या तारखेसाठी कोणतेही देय लसीकरण प्रलंबित नाही.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">लाभार्थी आयडी</th>
                <th className="px-4 py-3 font-semibold">बाळाचे नाव व आई</th>
                <th className="px-4 py-3 font-semibold">मोबाईल</th>
                <th className="px-4 py-3 font-semibold">गाव / उपकेंद्र</th>
                <th className="px-4 py-3 font-semibold">वय ({formatDDMMYYYY(targetDate)})</th>
                <th className="px-4 py-3 font-semibold">देय डोस</th>
                <th className="no-print px-4 py-3 font-semibold text-right">कार्ड</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dueRows.map((r) => (
                <tr key={r.beneficiary.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono-tabular text-xs font-semibold text-teal-800">
                    {r.beneficiary.beneficiaryCode}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-900">{r.beneficiary.childName}</div>
                    <div className="text-xs text-slate-500">आई: {r.beneficiary.motherName}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono-tabular text-xs">{r.beneficiary.mobile}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <div className="font-medium">{r.beneficiary.villageName}</div>
                    <div className="text-slate-500">{r.beneficiary.subcentreName}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{r.ageOnTargetDateLabel}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-amber-800">
                    {r.matchingDueDoses.map((d) => d.schedule.doseName).join(', ')}
                  </td>
                  <td className="no-print px-4 py-2.5 text-right">
                    <Link
                      to={`/history?beneficiaryId=${r.beneficiary.id}`}
                      className="text-xs font-medium text-teal-700 hover:underline"
                    >
                      पहा
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
