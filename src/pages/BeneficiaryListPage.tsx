import React, { useMemo, useState } from 'react';
import { Baby, Download, Edit, HeartPulse, History, Search, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSheetData } from '../context/SheetDataContext';
import { BeneficiaryType } from '../types';
import { calculateAgeAsOf, formatDDMMYYYY, getTodayIST } from '../utils/dateUtils';
import { exportToExcel } from '../utils/exportUtils';
import { maskAadhaar } from '../utils/privacyUtils';

export const BeneficiaryListPage: React.FC = () => {
  const { db, currentUser } = useSheetData();
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | BeneficiaryType>('ALL');
  const [search, setSearch] = useState('');
  const [subcentreFilter, setSubcentreFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';
  const effectiveSubcentre = scopedSubcentre || subcentreFilter;
  const today = getTodayIST();

  const filteredVillages = useMemo(() => {
    if (!db) return [];
    return effectiveSubcentre
      ? db.villages.filter((v) => v.subcentreId === effectiveSubcentre)
      : db.villages;
  }, [db, effectiveSubcentre]);

  const activeEpisodeByBen = useMemo(() => {
    const map = new Map<string, NonNullable<typeof db>['pregnancyEpisodes'][number]>();
    if (!db) return map;
    for (const ep of db.pregnancyEpisodes) {
      const existing = map.get(ep.beneficiaryId);
      if (!existing || (ep.pregnancyStatus === 'सक्रिय' && existing.pregnancyStatus !== 'सक्रिय')) {
        map.set(ep.beneficiaryId, ep);
      }
    }
    return map;
  }, [db]);

  const filtered = useMemo(() => {
    if (!db) return [];
    const q = search.trim().toLowerCase();
    return db.beneficiaries.filter((b) => {
      const bType = b.beneficiaryType || 'CHILD';
      if (categoryFilter !== 'ALL' && bType !== categoryFilter) return false;
      if (effectiveSubcentre && b.subcentreId !== effectiveSubcentre) return false;
      if (villageFilter && b.villageId !== villageFilter) return false;
      if (statusFilter && b.status !== statusFilter) return false;
      if (!q) return true;
      const ep = activeEpisodeByBen.get(b.id);
      return (
        b.childName.toLowerCase().includes(q) ||
        b.motherName.toLowerCase().includes(q) ||
        (b.guardianName || b.fatherName || '').toLowerCase().includes(q) ||
        b.beneficiaryCode.toLowerCase().includes(q) ||
        b.mobile.includes(q) ||
        (ep?.mcDate || '').includes(q) ||
        (ep?.eddDate || '').includes(q)
      );
    });
  }, [db, categoryFilter, effectiveSubcentre, villageFilter, statusFilter, search, activeEpisodeByBen]);

  if (!db) return null;

  const doseCountByBen = new Map<string, number>();
  for (const r of db.vaccinationRecords) {
    doseCountByBen.set(r.beneficiaryId, (doseCountByBen.get(r.beneficiaryId) || 0) + 1);
  }
  const maternalCountByBen = new Map<string, number>();
  for (const r of db.maternalServiceRecords) {
    maternalCountByBen.set(r.beneficiaryId, (maternalCountByBen.get(r.beneficiaryId) || 0) + 1);
  }

  const handleExport = () => {
    exportToExcel(
      `PHC_Bhada_Beneficiaries_${today}`,
      'लाभार्थी यादी',
      [
        'प्रकार',
        'आयडी',
        'पूर्ण नाव',
        'पालक / आई / पती',
        'जन्मतारीख / MC-EDD',
        'लिंग',
        'जात / प्रवर्ग',
        'आधार (Masked)',
        'मोबाईल',
        'उपकेंद्र',
        'गाव',
        'स्थिती',
        'सेवा संख्या',
      ],
      filtered.map((b) => {
        const isWoman = (b.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN';
        const ep = isWoman ? activeEpisodeByBen.get(b.id) : undefined;
        return [
          isWoman ? 'गरोदर माता' : 'बालक',
          b.beneficiaryCode,
          b.childName,
          isWoman
            ? `पती: ${b.guardianName || b.fatherName || '-'}`
            : `${b.guardianName || b.fatherName || '-'} (आई: ${b.motherName})`,
          isWoman
            ? ep
              ? `MC: ${formatDDMMYYYY(ep.mcDate)} | EDD: ${formatDDMMYYYY(ep.eddDate)}`
              : '-'
            : formatDDMMYYYY(b.dob),
          b.gender,
          `${b.caste || '-'} / ${b.category || '-'}`,
          maskAadhaar(b.aadhaarNumber),
          b.mobile,
          b.subcentreName,
          b.villageName,
          b.status,
          isWoman ? maternalCountByBen.get(b.id) || 0 : doseCountByBen.get(b.id) || 0,
        ];
      })
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">लाभार्थी यादी (कायमस्वरूपी प्रोफाइल)</h2>
          <p className="text-xs text-slate-500">
            एकूण {filtered.length} लाभार्थी · Google Sheet मधून थेट प्रदर्शित (आधार संरक्षित)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4" /> Excel डाउनलोड
          </button>
          <Link
            to="/pregnant-women"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap"
          >
            <HeartPulse className="w-4 h-4" /> गरोदर माता विभाग
          </Link>
          <Link
            to="/beneficiaries/register"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" /> नवीन लाभार्थी नोंदणी
          </Link>
        </div>
      </div>

      {/* Category Switch Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${
            categoryFilter === 'ALL'
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          सर्व लाभार्थी ({db.beneficiaries.length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('CHILD')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${
            categoryFilter === 'CHILD'
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Baby className="w-3.5 h-3.5" /> बालक ({db.beneficiaries.filter((b) => (b.beneficiaryType || 'CHILD') === 'CHILD').length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('PREGNANT_WOMAN')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${
            categoryFilter === 'PREGNANT_WOMAN'
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5" /> गरोदर माता ({db.beneficiaries.filter((b) => b.beneficiaryType === 'PREGNANT_WOMAN').length})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="नाव, आयडी, पालक/पती किंवा मोबाईल..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <select
          disabled={Boolean(scopedSubcentre)}
          value={effectiveSubcentre}
          onChange={(e) => {
            setSubcentreFilter(e.target.value);
            setVillageFilter('');
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-100"
        >
          <option value="">सर्व उपकेंद्रे</option>
          {db.subcentres.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={villageFilter}
          onChange={(e) => setVillageFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">सर्व गावे</option>
          {filteredVillages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">सर्व स्थिती</option>
          <option value="सक्रिय">सक्रिय</option>
          <option value="स्थलांतरित">स्थलांतरित</option>
          <option value="पूर्ण">पूर्ण</option>
          <option value="निष्क्रिय">निष्क्रिय</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            कोणतेही लाभार्थी आढळले नाहीत. कृपया नवीन लाभार्थी नोंदवा किंवा फिल्टर बदला.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">लाभार्थी आयडी व प्रकार</th>
                <th className="px-4 py-3 font-semibold">पूर्ण नाव</th>
                <th className="px-4 py-3 font-semibold">पालक / आई / पती</th>
                <th className="px-4 py-3 font-semibold">जन्मतारीख किंवा MC / EDD</th>
                <th className="px-4 py-3 font-semibold">आधार (Masked) / जात</th>
                <th className="px-4 py-3 font-semibold">गाव / उपकेंद्र</th>
                <th className="px-4 py-3 font-semibold">मोबाईल</th>
                <th className="px-4 py-3 font-semibold text-right">नोंदी</th>
                <th className="px-4 py-3 font-semibold text-right">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((b) => {
                const isWoman = (b.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN';
                const ep = isWoman ? activeEpisodeByBen.get(b.id) : undefined;
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="font-mono-tabular text-xs font-semibold text-teal-800">
                        {b.beneficiaryCode}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isWoman ? 'गरोदर माता' : 'बालक'} · {b.status}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <div>{b.childName}</div>
                      <div className="text-xs text-slate-500">{b.gender}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-700">
                      {isWoman ? (
                        <div>पती: {b.guardianName || b.fatherName || '-'}</div>
                      ) : (
                        <>
                          <div>पालक: {b.guardianName || b.fatherName || '-'}</div>
                          <div className="text-slate-500">आई: {b.motherName}</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono-tabular">
                      {isWoman ? (
                        ep ? (
                          <div>
                            <div>MC: {formatDDMMYYYY(ep.mcDate)}</div>
                            <div className="text-teal-800 font-semibold">
                              EDD: {formatDDMMYYYY(ep.eddDate)}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )
                      ) : (
                        <>
                          <div>{formatDDMMYYYY(b.dob)}</div>
                          <div className="text-slate-500 font-sans">
                            {calculateAgeAsOf(b.dob, today).labelMarathi}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="font-mono-tabular text-slate-700">
                        {maskAadhaar(b.aadhaarNumber)}
                      </div>
                      <div className="text-slate-500">
                        {b.caste || '-'} · {b.category || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="font-medium text-slate-800">{b.villageName}</div>
                      <div className="text-slate-500">{b.subcentreName}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono-tabular">{b.mobile}</td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold">
                      {isWoman ? maternalCountByBen.get(b.id) || 0 : doseCountByBen.get(b.id) || 0}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                      {isWoman ? (
                        <Link
                          to="/pregnant-women"
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
                        >
                          <HeartPulse className="w-3.5 h-3.5" /> गर्भधारणा
                        </Link>
                      ) : (
                        <Link
                          to={`/history?beneficiaryId=${b.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
                        >
                          <History className="w-3.5 h-3.5" /> इतिहास
                        </Link>
                      )}
                      <Link
                        to={`/beneficiaries/register?edit=${b.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:underline"
                      >
                        <Edit className="w-3.5 h-3.5" /> दुरुस्ती
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
