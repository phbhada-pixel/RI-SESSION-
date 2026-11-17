import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { formatTimestampIST, getTodayIST } from '../utils/dateUtils';
import { exportToExcel } from '../utils/exportUtils';

export const AuditLogPage: React.FC = () => {
  const { db } = useSheetData();
  const [entityFilter, setEntityFilter] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!db) return [];
    const q = search.trim().toLowerCase();
    return db.auditLogs.filter((log) => {
      if (entityFilter && log.entityType !== entityFilter) return false;
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.recordId.toLowerCase().includes(q) ||
        (log.reason && log.reason.toLowerCase().includes(q))
      );
    });
  }, [db, entityFilter, search]);

  if (!db) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Audit Log (सुरक्षा व कृती नोंदवही)</h2>
          <p className="text-xs text-slate-500">
            प्रत्येक नोंदणी, टिकमार्क लसीकरण, दुरुस्ती व सत्र लॉक/अनलॉक कृतींची अपरिवर्तनीय नोंद
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportToExcel(
              `PHC_Bhada_AuditLogs_${getTodayIST()}`,
              'AuditLogs',
              ['वेळ (IST)', 'वापरकर्ता', 'भूमिका', 'घटक', 'कृती', 'रेकॉर्ड आयडी', 'कारण', 'नवीन मूल्य'],
              filtered.map((l) => [
                formatTimestampIST(l.createdAt),
                l.userName,
                l.userRole,
                l.entityType,
                l.action,
                l.recordId,
                l.reason || '',
                l.newValue ? JSON.stringify(l.newValue) : '',
              ])
            )
          }
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <Download className="w-4 h-4" /> Excel डाउनलोड
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="कृती, वापरकर्ता, आयडी किंवा कारण शोधा..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">सर्व घटक</option>
          <option value="BENEFICIARY">BENEFICIARY</option>
          <option value="SESSION">SESSION</option>
          <option value="VACCINATION">VACCINATION</option>
          <option value="SUBCENTRE">SUBCENTRE</option>
          <option value="VILLAGE">VILLAGE</option>
          <option value="STAFF">STAFF</option>
          <option value="VACCINE_MASTER">VACCINE_MASTER</option>
          <option value="VACCINE_SCHEDULE">VACCINE_SCHEDULE</option>
          <option value="USER">USER</option>
          <option value="SETTINGS">SETTINGS</option>
          <option value="SHEET_IMPORT">SHEET_IMPORT</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">कोणत्याही Audit नोंदी आढळल्या नाहीत.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">वेळ (IST)</th>
                <th className="px-4 py-3 font-semibold">वापरकर्ता</th>
                <th className="px-4 py-3 font-semibold">घटक</th>
                <th className="px-4 py-3 font-semibold">कृती</th>
                <th className="px-4 py-3 font-semibold">तपशील व कारण</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-xs font-mono-tabular whitespace-nowrap text-slate-600">
                    {formatTimestampIST(log.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <div className="font-semibold text-slate-900">{log.userName}</div>
                    <div className="text-slate-500">{log.userRole}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono-tabular text-teal-800 font-semibold">
                    {log.entityType}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-900">
                    <div>{log.action}</div>
                    <div className="font-mono-tabular text-[11px] text-slate-500">{log.recordId}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 max-w-md">
                    {log.reason && <div className="font-semibold text-amber-800">कारण: {log.reason}</div>}
                    {log.newValue && (
                      <div className="font-mono-tabular text-[11px] truncate">
                        {JSON.stringify(log.newValue)}
                      </div>
                    )}
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
