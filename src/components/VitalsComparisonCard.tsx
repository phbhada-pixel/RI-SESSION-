import React from 'react';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { MaternalServiceRecord, VaccinationSession, Village } from '../types';
import { formatDDMMYYYY } from '../utils/dateUtils';
import { buildVitalsComparisonSummary, groupMaternalVisitsByDate } from '../utils/maternalUtils';

interface VitalsComparisonCardProps {
  records: MaternalServiceRecord[];
  sessions?: VaccinationSession[];
  villages?: Village[];
  title?: string;
  compact?: boolean;
}

export const VitalsComparisonCard: React.FC<VitalsComparisonCardProps> = ({
  records,
  sessions = [],
  villages = [],
  title = 'मागील तपासणी नोंदी व वाढ तुलना (वजन · उंची · Hb · BP · BSL)',
  compact = false,
}) => {
  const vitals = buildVitalsComparisonSummary(records);
  const visits = groupMaternalVisitsByDate(records).filter(
    (v) =>
      v.weight !== '-' ||
      v.height !== '-' ||
      v.hb !== '-' ||
      v.bp !== '-' ||
      v.bsl !== '-'
  );

  const hasAnyVital = vitals.some((v) => Boolean(v.latestValue));

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const villageMap = new Map(villages.map((v) => [v.id, v.name]));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-teal-700 shrink-0" />
          <span>{title}</span>
        </div>
        <span className="text-[11px] font-mono-tabular text-slate-500">
          {hasAnyVital ? `${visits.length} तपासणी भेटी` : 'मागील नोंद उपलब्ध नाही'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
        {vitals.map((v) => (
          <div
            key={v.code}
            className={`p-2.5 rounded-lg border ${
              v.latestValue ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-slate-200/70'
            }`}
          >
            <div className="text-[11px] font-medium text-slate-600">{v.label}</div>
            {v.latestValue ? (
              <>
                <div className="mt-1 flex items-baseline gap-1 font-mono-tabular font-bold text-slate-900 text-sm">
                  <span>{v.latestValue}</span>
                  {v.unit && <span className="text-[11px] font-normal text-slate-500">{v.unit}</span>}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500">
                  शेवटची दि. {formatDDMMYYYY(v.latestDate)}
                </div>
                {v.previousValue && (
                  <div className="mt-1 pt-1 border-t border-slate-200/80 text-[11px] space-y-0.5">
                    <div className="text-slate-600 font-mono-tabular">
                      आधीची: {v.previousValue} {v.unit} ({formatDDMMYYYY(v.previousDate)})
                    </div>
                    {v.deltaText && (
                      <div
                        className={`inline-flex items-center gap-1 font-semibold ${
                          v.trend === 'up'
                            ? 'text-emerald-700'
                            : v.trend === 'down'
                              ? 'text-amber-800'
                              : 'text-slate-600'
                        }`}
                      >
                        {v.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                        {v.trend === 'down' && <TrendingDown className="w-3 h-3" />}
                        <span>{v.deltaText}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-1 text-[11px] text-slate-400">नोंद नाही</div>
            )}
          </div>
        ))}
      </div>

      {!compact && visits.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-[11px] text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-2.5 py-1.5 font-semibold whitespace-nowrap">तपासणी दि.</th>
                <th className="px-2.5 py-1.5 font-semibold whitespace-nowrap">ठिकाण / सत्र</th>
                <th className="px-2.5 py-1.5 font-semibold whitespace-nowrap">वजन (kg)</th>
                <th className="px-2.5 py-1.5 font-semibold whitespace-nowrap">उंची (cm)</th>
                <th className="px-2.5 py-1.5 font-semibold whitespace-nowrap">Hb (g/dL)</th>
                <th className="px-2.5 py-1.5 font-semibold whitespace-nowrap">BP (mmHg)</th>
                <th className="px-2.5 py-1.5 font-semibold whitespace-nowrap">BSL (mg/dL)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visits.slice(0, 6).map((vr) => {
                const ses = sessionMap.get(vr.sessionId);
                const locName =
                  ses?.villageName || villageMap.get(vr.villageId) || '-';
                return (
                  <tr key={vr.visitKey} className="hover:bg-slate-50">
                    <td className="px-2.5 py-1.5 font-mono-tabular font-semibold whitespace-nowrap">
                      {formatDDMMYYYY(vr.visitDate)}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-700 whitespace-nowrap">
                      {locName}
                      {ses?.sessionCode ? ` (${ses.sessionCode})` : ''}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono-tabular font-medium">{vr.weight}</td>
                    <td className="px-2.5 py-1.5 font-mono-tabular font-medium">{vr.height}</td>
                    <td className="px-2.5 py-1.5 font-mono-tabular font-medium">{vr.hb}</td>
                    <td className="px-2.5 py-1.5 font-mono-tabular font-medium">{vr.bp}</td>
                    <td className="px-2.5 py-1.5 font-mono-tabular font-medium">{vr.bsl}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
