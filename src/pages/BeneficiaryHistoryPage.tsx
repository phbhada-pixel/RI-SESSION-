import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useSheetData } from '../context/SheetDataContext';
import { SearchableSelect } from '../components/SearchableSelect';
import { formatDDMMYYYY, getTodayIST } from '../utils/dateUtils';
import { evaluateBeneficiaryEligibility } from '../utils/eligibilityEngine';
import { maskAadhaar } from '../utils/privacyUtils';
import { formatDeliveryFacilityTypeMarathi, groupMaternalVisitsByDate } from '../utils/maternalUtils';

export const BeneficiaryHistoryPage: React.FC = () => {
  const { db, currentUser } = useSheetData();
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(params.get('beneficiaryId') || '');

  const scopedSubcentre =
    currentUser && ['CHO', 'ANM'].includes(currentUser.role) ? currentUser.subcentreId || '' : '';

  const beneficiaries = useMemo(() => {
    if (!db) return [];
    return scopedSubcentre
      ? db.beneficiaries.filter((b) => b.subcentreId === scopedSubcentre)
      : db.beneficiaries;
  }, [db, scopedSubcentre]);

  const selectedBeneficiary = useMemo(
    () => beneficiaries.find((b) => b.id === selectedId) || null,
    [beneficiaries, selectedId]
  );

  const isPW = selectedBeneficiary?.beneficiaryType === 'PREGNANT_WOMAN';
  const today = getTodayIST();

  const summary = useMemo(() => {
    if (!db || !selectedBeneficiary || isPW) return null;
    const records = db.vaccinationRecords.filter((r) => r.beneficiaryId === selectedBeneficiary.id);
    return evaluateBeneficiaryEligibility(
      selectedBeneficiary,
      today,
      db.vaccineSchedule,
      records
    );
  }, [db, selectedBeneficiary, isPW, today]);

  const pwEpisodes = useMemo(() => {
    if (!db || !selectedBeneficiary || !isPW) return [];
    return db.pregnancyEpisodes.filter((ep) => ep.beneficiaryId === selectedBeneficiary.id);
  }, [db, selectedBeneficiary, isPW]);

  const pwRecords = useMemo(() => {
    if (!db || !selectedBeneficiary || !isPW) return [];
    return db.maternalServiceRecords.filter((r) => r.beneficiaryId === selectedBeneficiary.id);
  }, [db, selectedBeneficiary, isPW]);

  if (!db) return null;

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">लसीकरण व ANC इतिहास</h2>
          <p className="text-xs text-slate-500">लाभार्थ्याचे संपूर्ण लसीकरण कार्ड / गरोदर माता ANC इतिहास</p>
        </div>
        {selectedBeneficiary && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" /> कार्ड प्रिंट करा
          </button>
        )}
      </div>

      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 max-w-xl">
        <SearchableSelect
          label="लाभार्थी निवडा (नाव किंवा आयडीद्वारे शोधा)"
          value={selectedId}
          onChange={(val) => {
            setSelectedId(val);
            setParams({ beneficiaryId: val });
          }}
          options={beneficiaries.map((b) => ({
            value: b.id,
            label: `${b.childName} (${b.beneficiaryCode}) · ${b.beneficiaryType === 'PREGNANT_WOMAN' ? 'गरोदर माता' : 'बालक'}`,
            sublabel:
              b.beneficiaryType === 'PREGNANT_WOMAN'
                ? `${b.villageName} · पती: ${b.guardianName || '-'}`
                : `${b.villageName} · आई: ${b.motherName || b.guardianName || '-'}`,
          }))}
        />
      </div>

      {selectedBeneficiary ? (
        <div className="space-y-5">
          {/* Profile Banner */}
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="hidden print:block text-center border-b border-slate-300 pb-2 mb-3">
              <div className="text-base font-bold">
                प्राथमिक आरोग्य केंद्र भादा — {isPW ? 'गरोदर माता ANC कार्ड' : 'बालक लसीकरण कार्ड'}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">
                  {isPW ? 'गरोदर मातेचे नाव' : 'बाळाचे नाव'}
                </div>
                <div className="font-bold text-slate-900">{selectedBeneficiary.childName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">लाभार्थी आयडी</div>
                <div className="font-mono-tabular font-semibold text-teal-800">
                  {selectedBeneficiary.beneficiaryCode}
                </div>
              </div>
              {!isPW && summary ? (
                <div>
                  <div className="text-xs text-slate-500">जन्मतारीख व वय</div>
                  <div className="font-mono-tabular">
                    {formatDDMMYYYY(selectedBeneficiary.dob)} ({summary.ageOnTargetDateLabel})
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-slate-500">नोंदणी दिनांक</div>
                  <div className="font-mono-tabular">
                    {formatDDMMYYYY(selectedBeneficiary.registrationDate || selectedBeneficiary.createdAt)}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-slate-500">
                  {isPW ? 'पतीचे नाव · मोबाईल' : 'आई / वडील / पालक · मोबाईल'}
                </div>
                <div>
                  {isPW
                    ? selectedBeneficiary.guardianName || '-'
                    : `${selectedBeneficiary.motherName || '-'} / ${selectedBeneficiary.fatherName || selectedBeneficiary.guardianName || '-'}`}{' '}
                  · <span className="font-mono-tabular">{selectedBeneficiary.mobile}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">उपकेंद्र / गाव</div>
                <div>
                  {selectedBeneficiary.subcentreName} · {selectedBeneficiary.villageName}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">आधार (Masked)</div>
                <div className="font-mono-tabular">
                  {selectedBeneficiary.aadhaarNumber ? maskAadhaar(selectedBeneficiary.aadhaarNumber) : '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">जात व प्रवर्ग</div>
                <div>
                  {selectedBeneficiary.caste || '-'} · {selectedBeneficiary.category || '-'}
                </div>
              </div>
              {!isPW && summary ? (
                <div>
                  <div className="text-xs text-slate-500">दिलेले डोस / देय डोस</div>
                  <div className="font-mono-tabular font-semibold">
                    {summary.administeredDoses.length} दिलेले · {summary.dueDoses.length} देय
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-slate-500">एकूण गर्भधारणा / ANC नोंदी</div>
                  <div className="font-mono-tabular font-semibold">
                    {pwEpisodes.length} गर्भधारणा · {pwRecords.length} ANC नोंदी
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isPW && summary && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">डोस</th>
                    <th className="px-4 py-3 font-semibold">लस</th>
                    <th className="px-4 py-3 font-semibold">शिफारस वय / नियम</th>
                    <th className="px-4 py-3 font-semibold">देय तारीख</th>
                    <th className="px-4 py-3 font-semibold">स्थिती</th>
                    <th className="px-4 py-3 font-semibold">दिलेली तारीख व बॅच</th>
                    <th className="px-4 py-3 font-semibold">कर्मचारी</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.allDoseResults.map((res) => (
                    <tr key={res.schedule.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {res.schedule.doseName}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{res.schedule.vaccineName}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {res.schedule.recommendedDueRuleText || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono-tabular">
                        {formatDDMMYYYY(res.dueDateISO)}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {res.status === 'ADMINISTERED' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> दिलेला
                          </span>
                        )}
                        {res.status === 'DUE' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <Clock className="w-3.5 h-3.5" /> देय (DUE)
                          </span>
                        )}
                        {res.status !== 'ADMINISTERED' && res.status !== 'DUE' && (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <AlertCircle className="w-3.5 h-3.5" /> {res.reasonMarathi}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono-tabular">
                        {res.administeredRecord ? (
                          <div>
                            <div>{formatDDMMYYYY(res.administeredRecord.administeredDate)}</div>
                            {res.administeredRecord.batchNumber && (
                              <div className="text-slate-500">
                                बॅच: {res.administeredRecord.batchNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">
                        {res.administeredRecord?.staffName || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isPW && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
                  गर्भधारणा नोंदी (Pregnancy Episodes)
                </div>
                {pwEpisodes.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">गर्भधारणा नोंद उपलब्ध नाही.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">गर्भधारणा ID</th>
                        <th className="px-4 py-2.5 font-semibold">MC दिनांक</th>
                        <th className="px-4 py-2.5 font-semibold">EDD</th>
                        <th className="px-4 py-2.5 font-semibold">अपेक्षित प्रसूती ठिकाण</th>
                        <th className="px-4 py-2.5 font-semibold">संस्था प्रकार / रुग्णालय</th>
                        <th className="px-4 py-2.5 font-semibold">स्थिती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pwEpisodes.map((ep) => (
                        <tr key={ep.id}>
                          <td className="px-4 py-2.5 font-mono-tabular font-semibold text-teal-800">
                            {ep.episodeCode}
                          </td>
                          <td className="px-4 py-2.5 font-mono-tabular">{formatDDMMYYYY(ep.mcDate)}</td>
                          <td className="px-4 py-2.5 font-mono-tabular font-semibold">{formatDDMMYYYY(ep.eddDate)}</td>
                          <td className="px-4 py-2.5">{ep.expectedDeliveryPlace || '-'}</td>
                          <td className="px-4 py-2.5">
                            {formatDeliveryFacilityTypeMarathi(ep.deliveryFacilityType)} · {ep.hospitalName || '-'}
                          </td>
                          <td className="px-4 py-2.5 font-semibold">{ep.pregnancyStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
                  भेटनिहाय नियमित ANC तपासण्या व लसीकरण तक्ता (Every Visit Checkups)
                </div>
                {pwRecords.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">अद्याप कोणतीही ANC सेवा नोंदवलेली नाही.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">भेट दिनांक</th>
                        <th className="px-3 py-2.5 font-semibold">प्रकरण</th>
                        <th className="px-3 py-2.5 font-semibold">ANC तपासणी</th>
                        <th className="px-3 py-2.5 font-semibold">BP</th>
                        <th className="px-3 py-2.5 font-semibold">वजन</th>
                        <th className="px-3 py-2.5 font-semibold">Hb</th>
                        <th className="px-3 py-2.5 font-semibold">रक्त व लघवी</th>
                        <th className="px-3 py-2.5 font-semibold">Td लस</th>
                        <th className="px-3 py-2.5 font-semibold">IFA / कॅल्शियम</th>
                        <th className="px-3 py-2.5 font-semibold">कर्मचारी</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupMaternalVisitsByDate(pwRecords).map((vr) => (
                        <tr key={vr.visitKey}>
                          <td className="px-3 py-2.5 font-mono-tabular font-semibold whitespace-nowrap">
                            {formatDDMMYYYY(vr.visitDate)}
                          </td>
                          <td className="px-3 py-2.5 font-mono-tabular text-teal-800">
                            {vr.episodeCode}
                          </td>
                          <td className="px-3 py-2.5">{vr.ancExam}</td>
                          <td className="px-3 py-2.5 font-mono-tabular">{vr.bp}</td>
                          <td className="px-3 py-2.5 font-mono-tabular">{vr.weight}</td>
                          <td className="px-3 py-2.5 font-mono-tabular">{vr.hb}</td>
                          <td className="px-3 py-2.5">{vr.bloodUrine}</td>
                          <td className="px-3 py-2.5">{vr.tdDoses}</td>
                          <td className="px-3 py-2.5">{vr.supplements}</td>
                          <td className="px-3 py-2.5">{vr.staffNames}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
                  माता ANC व लसीकरण सेवा तपशील (सर्व नोंदी)
                </div>
                {pwRecords.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">अद्याप कोणतीही ANC सेवा नोंदवलेली नाही.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">दिनांक</th>
                        <th className="px-4 py-2.5 font-semibold">सेवा</th>
                        <th className="px-4 py-2.5 font-semibold">नोंद / प्रमाण / बॅच</th>
                        <th className="px-4 py-2.5 font-semibold">सत्र</th>
                        <th className="px-4 py-2.5 font-semibold">कर्मचारी</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pwRecords.map((rec) => {
                        const sess = db.vaccinationSessions.find((s) => s.id === rec.sessionId);
                        return (
                          <tr key={rec.id}>
                            <td className="px-4 py-2.5 font-mono-tabular">
                              {formatDDMMYYYY(rec.visitDate || rec.sessionDate)}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">{rec.serviceName}</td>
                            <td className="px-4 py-2.5 font-mono-tabular">
                              {rec.serviceValue || 'दिली'}
                              {rec.batchNumber ? ` · बॅच: ${rec.batchNumber}` : ''}
                            </td>
                            <td className="px-4 py-2.5 font-mono-tabular">
                              {sess?.sessionCode || formatDDMMYYYY(rec.sessionDate)}
                            </td>
                            <td className="px-4 py-2.5">{rec.staffName}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-sm text-slate-500">
          लसीकरण इतिहास पाहण्यासाठी वरील शोध बॉक्समधून लाभार्थी निवडा.
        </div>
      )}
    </div>
  );
};
