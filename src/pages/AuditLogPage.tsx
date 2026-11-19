import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { formatTimestampIST, getTodayIST } from '../utils/dateUtils';
import { exportToExcel } from '../utils/exportUtils';
import { fuzzyFilterAndRank } from '../utils/fuzzySearch';
import { FuzzyAutocomplete } from '../components/FuzzyAutocomplete';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

export const AuditLogPage: React.FC = () => {
  const { db } = useSheetData();
  const [entityFilter, setEntityFilter] = useState('');
  const [search, setSearch] = useState('');

  const entityFiltered = useMemo(() => {
    if (!db) return [];
    return entityFilter
      ? db.auditLogs.filter((log) => log.entityType === entityFilter)
      : db.auditLogs;
  }, [db, entityFilter]);

  const filtered = useMemo(() => {
    return fuzzyFilterAndRank(entityFiltered, search, (log) => [
      log.action,
      log.userName,
      log.recordId,
      log.reason,
      log.entityType,
      log.userRole,
    ]);
  }, [entityFiltered, search]);

  if (!db) return null;

  return (
    <div className="app-page">
      <PageHeader
        title="Audit Log (सुरक्षा व कृती नोंदवही)"
        subtitle="प्रत्येक नोंदणी, टिकमार्क लसीकरण, दुरुस्ती व सत्र लॉक/अनलॉक कृतींची अपरिवर्तनीय नोंद"
        actions={
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
            className="app-btn-secondary text-xs"
          >
            <Download className="w-4 h-4" /> Excel डाउनलोड
          </button>
        }
      />

      <div className="app-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <FuzzyAutocomplete
          className="md:col-span-2"
          value={search}
          onChange={setSearch}
          items={entityFiltered}
          getSearchFields={(log) => [
            log.action,
            log.userName,
            log.recordId,
            log.reason,
            log.entityType,
            log.userRole,
          ]}
          getOptionKey={(log) => log.id}
          getOptionLabel={(log) => log.action}
          getOptionSublabel={(log) =>
            `${log.userName} (${log.userRole})${log.reason ? ` · कारण: ${log.reason}` : ''}`
          }
          getOptionMeta={(log) => log.recordId || log.entityType}
          onSelectItem={(log) => setSearch(log.recordId || log.action)}
          placeholder="कृती, वापरकर्ता, आयडी किंवा कारण शोधा..."
        />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="app-input"
        >
          <option value="">सर्व घटक</option>
          <option value="BENEFICIARY">BENEFICIARY</option>
          <option value="PREGNANCY_EPISODE">PREGNANCY_EPISODE</option>
          <option value="SESSION">SESSION</option>
          <option value="VACCINATION">VACCINATION</option>
          <option value="MATERNAL_SERVICE">MATERNAL_SERVICE</option>
          <option value="RI_CHECKLIST">RI_CHECKLIST</option>
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

      <div className="app-table-wrap">
        {filtered.length === 0 ? (
          <EmptyState message="कोणत्याही Audit नोंदी आढळल्या नाहीत." />
        ) : (
          <table className="app-table">
            <thead className="app-thead">
              <tr>
                <th className="app-th">वेळ (IST)</th>
                <th className="app-th">वापरकर्ता</th>
                <th className="app-th">घटक</th>
                <th className="app-th">कृती</th>
                <th className="app-th">तपशील व कारण</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="app-td text-xs font-mono-tabular whitespace-nowrap text-slate-600">
                    {formatTimestampIST(log.createdAt)}
                  </td>
                  <td className="app-td text-xs">
                    <div className="font-semibold text-slate-900">{log.userName}</div>
                    <div className="text-slate-500">{log.userRole}</div>
                  </td>
                  <td className="app-td text-xs font-mono-tabular text-teal-800 font-semibold">
                    {log.entityType}
                  </td>
                  <td className="app-td text-xs font-medium text-slate-900">
                    <div>{log.action}</div>
                    <div className="font-mono-tabular text-[11px] text-slate-500">{log.recordId}</div>
                  </td>
                  <td className="app-td text-xs text-slate-600 max-w-md">
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
