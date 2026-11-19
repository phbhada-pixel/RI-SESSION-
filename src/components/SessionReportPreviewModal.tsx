import React, { useEffect, useState } from 'react';
import { Baby, Download, FileSpreadsheet, HeartPulse, Printer, X } from 'lucide-react';
import { formatDDMMYYYY } from '../utils/dateUtils';
import { formatDateTimeIST, formatNumberIN } from '../utils/localeUtils';
import { formatDeliveryFacilityTypeMarathi } from '../utils/maternalUtils';
import {
  DetailedMaternalSessionReportData,
  DetailedSessionReportData,
  downloadDetailedSessionExcel,
  downloadDetailedSessionPDF,
  downloadMaternalSessionExcel,
  downloadMaternalSessionPDF,
  generateDetailedSessionPDFBlob,
  generateMaternalSessionPDFBlob,
} from '../utils/sessionPdfReport';

interface SessionReportPreviewModalProps {
  open: boolean;
  report: DetailedSessionReportData | null;
  maternalReport?: DetailedMaternalSessionReportData | null;
  initialCategory?: 'CHILD' | 'PREGNANT_WOMAN';
  onClose: () => void;
  onError?: (message: string) => void;
}

export const SessionReportPreviewModal: React.FC<SessionReportPreviewModalProps> = ({
  open,
  report,
  maternalReport = null,
  initialCategory = 'CHILD',
  onClose,
  onError,
}) => {
  const [activeTab, setActiveTab] = useState<'CHILD' | 'PREGNANT_WOMAN'>(initialCategory);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab(initialCategory);
    }
  }, [open, initialCategory]);

  if (!open || (!report && !maternalReport)) return null;

  const session = report?.session || maternalReport?.session;
  if (!session) return null;

  const showingMaternal = activeTab === 'PREGNANT_WOMAN' && maternalReport;

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      if (showingMaternal && maternalReport) {
        await downloadMaternalSessionPDF(maternalReport);
      } else if (report) {
        await downloadDetailedSessionPDF(report);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'PDF तयार करताना त्रुटी आली.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePrintPdf = async () => {
    setPdfBusy(true);
    try {
      const blob =
        showingMaternal && maternalReport
          ? await generateMaternalSessionPDFBlob(maternalReport)
          : report
            ? await generateDetailedSessionPDFBlob(report)
            : null;
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.print();
        }
        setTimeout(() => {
          URL.revokeObjectURL(url);
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 60000);
      };
      document.body.appendChild(iframe);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'प्रिंट तयार करताना त्रुटी आली.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadExcel = () => {
    if (showingMaternal && maternalReport) {
      downloadMaternalSessionExcel(maternalReport);
    } else if (report) {
      downloadDetailedSessionExcel(report);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="लसीकरण सत्र सविस्तर अहवाल पूर्वावलोकन"
    >
      <div className="w-full max-w-6xl max-h-[92vh] bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col overflow-hidden">
        {/* Top Action Bar */}
        <div className="px-4 md:px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {showingMaternal
                ? `गरोदर माता ANC सत्र अहवाल पूर्वावलोकन (${session.sessionCode})`
                : `बालक लसीकरण सत्र अहवाल पूर्वावलोकन (${session.sessionCode})`}
            </h3>
            <p className="text-xs text-slate-500">
              A4 आकार · मराठी युनिकोड फॉन्ट · संकलित सत्र अहवाल (आधार संरक्षित)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="app-btn-secondary"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> Excel डाउनलोड करा
            </button>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={handlePrintPdf}
              className="app-btn-secondary"
            >
              <Printer className="w-4 h-4" /> प्रिंट करा (Print PDF)
            </button>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={handleDownloadPdf}
              className="app-btn-primary"
            >
              <Download className="w-4 h-4" />
              {pdfBusy
                ? 'PDF तयार होत आहे...'
                : showingMaternal
                  ? 'गरोदर माता ANC अहवाल PDF डाउनलोड'
                  : 'बालक लसीकरण अहवाल PDF डाउनलोड'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60"
              aria-label="बंद करा"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Switcher Tabs */}
        <div className="px-4 md:px-6 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('CHILD')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap ${
              activeTab === 'CHILD'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Baby className="w-4 h-4" /> अ. बालक लसीकरण अहवाल ({report?.summary.totalBeneficiaries ?? 0})
          </button>
          {maternalReport && (
            <button
              type="button"
              onClick={() => setActiveTab('PREGNANT_WOMAN')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap ${
                activeTab === 'PREGNANT_WOMAN'
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <HeartPulse className="w-4 h-4" /> ब. गरोदर माता ANC अहवाल ({maternalReport.summary.totalWomen})
            </button>
          )}
        </div>

        {/* Body */}
        {showingMaternal && maternalReport ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-white">
            {/* Letterhead */}
            <div className="border-2 border-teal-700 bg-teal-50/50 rounded-lg p-4 text-center space-y-1">
              <h1 className="text-lg font-bold text-teal-900">प्राथमिक आरोग्य केंद्र भादा</h1>
              <h2 className="text-base font-bold text-slate-900">
                गरोदर माता ANC व लसीकरण सत्राचा सविस्तर अहवाल
              </h2>
              <p className="text-xs text-slate-600 font-mono-tabular">
                सत्र कोड: {session.sessionCode} · दिनांक: {formatDDMMYYYY(session.sessionDate)} · स्थिती:{' '}
                {session.status}
              </p>
            </div>

            {/* Maternal Women & Pregnancy Episode Details */}
            <section className="space-y-2">
              <h4 className="text-sm font-bold text-white bg-teal-700 px-3 py-1.5 rounded">
                ब. सत्रातील गरोदर माता व गर्भधारणा प्रकरण तपशील ({formatNumberIN(maternalReport.womanRows.length)} माता)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-2.5 py-2 font-semibold text-center">अ.क्र.</th>
                      <th className="px-2.5 py-2 font-semibold">माता आयडी</th>
                      <th className="px-2.5 py-2 font-semibold">मातेचे नाव व पती</th>
                      <th className="px-2.5 py-2 font-semibold">मोबाईल व आधार</th>
                      <th className="px-2.5 py-2 font-semibold">जात / प्रवर्ग · गाव</th>
                      <th className="px-2.5 py-2 font-semibold">गर्भधारणा आयडी</th>
                      <th className="px-2.5 py-2 font-semibold">MC दिनांक / आठवडे</th>
                      <th className="px-2.5 py-2 font-semibold">EDD दिनांक</th>
                      <th className="px-2.5 py-2 font-semibold">अपेक्षित प्रसूती ठिकाण</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {maternalReport.womanRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                          या सत्रात कोणतीही गरोदर माता समाविष्ट नाही.
                        </td>
                      </tr>
                    ) : (
                      maternalReport.womanRows.map((r) => (
                        <tr key={r.beneficiary.id} className="hover:bg-slate-50 align-top">
                          <td className="px-2.5 py-2 text-center font-mono-tabular">{r.serialNo}</td>
                          <td className="px-2.5 py-2">
                            <div className="font-mono-tabular font-semibold text-teal-800 whitespace-nowrap">
                              {r.beneficiary.beneficiaryCode}
                            </div>
                            <div className="text-[11px] text-slate-500">{r.enrollmentLabel}</div>
                          </td>
                          <td className="px-2.5 py-2">
                            <div className="font-semibold text-slate-900">{r.beneficiary.childName}</div>
                            <div className="text-slate-600">
                              पती: {r.beneficiary.guardianName || r.beneficiary.fatherName || '-'}
                            </div>
                          </td>
                          <td className="px-2.5 py-2 font-mono-tabular">
                            <div>{r.beneficiary.mobile || '-'}</div>
                            <div className="text-[11px] text-slate-500">{r.maskedAadhaar}</div>
                          </td>
                          <td className="px-2.5 py-2">
                            <div>
                              {r.beneficiary.caste || '-'} · {r.beneficiary.category || '-'}
                            </div>
                            <div className="text-slate-600">{r.beneficiary.villageName}</div>
                          </td>
                          <td className="px-2.5 py-2 font-mono-tabular font-semibold text-slate-800">
                            {r.episode?.episodeCode || '-'}
                          </td>
                          <td className="px-2.5 py-2 font-mono-tabular">
                            <div>{r.episode?.mcDate ? formatDDMMYYYY(r.episode.mcDate) : '-'}</div>
                            <div className="text-[11px] font-sans text-teal-800">
                              {r.gestationalAgeOnSession}
                            </div>
                          </td>
                          <td className="px-2.5 py-2 font-mono-tabular font-semibold text-slate-900">
                            {r.episode?.eddDate ? formatDDMMYYYY(r.episode.eddDate) : '-'}
                          </td>
                          <td className="px-2.5 py-2">
                            <div>{r.episode?.expectedDeliveryPlace || '-'}</div>
                            <div className="text-[11px] text-slate-500">
                              {r.episode
                                ? `${formatDeliveryFacilityTypeMarathi(r.episode.deliveryFacilityType)}${
                                    r.episode.hospitalName ? ` · ${r.episode.hospitalName}` : ''
                                  }`
                                : '-'}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Maternal Services Provided Today */}
            <section className="space-y-2">
              <h4 className="text-sm font-bold text-white bg-teal-700 px-3 py-1.5 rounded">
                क. आज दिलेल्या ANC व लसीकरण सेवा आणि प्रलंबित सेवा
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-2.5 py-2 font-semibold text-center">अ.क्र.</th>
                      <th className="px-2.5 py-2 font-semibold">मातेचे नाव व प्रकरण आयडी</th>
                      <th className="px-2.5 py-2 font-semibold">आज प्रत्यक्ष दिलेल्या सेवा</th>
                      <th className="px-2.5 py-2 font-semibold">आज न नोंदवलेल्या / अपेक्षित सेवा</th>
                      <th className="px-2.5 py-2 font-semibold">मागील ANC भेटी / शेरा</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {maternalReport.womanRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                          ANC सेवा नोंद उपलब्ध नाही.
                        </td>
                      </tr>
                    ) : (
                      maternalReport.womanRows.map((r) => (
                        <tr key={r.beneficiary.id} className="align-top hover:bg-slate-50">
                          <td className="px-2.5 py-2 text-center font-mono-tabular">{r.serialNo}</td>
                          <td className="px-2.5 py-2">
                            <div className="font-semibold text-slate-900">{r.beneficiary.childName}</div>
                            <div className="text-[11px] font-mono-tabular text-teal-800">
                              {r.beneficiary.beneficiaryCode} · {r.episode?.episodeCode || '-'}
                            </div>
                          </td>
                          <td className="px-2.5 py-2">
                            {r.todayServices.length === 0 ? (
                              <span className="text-slate-500">आज कोणतीही ANC सेवा नोंदवलेली नाही</span>
                            ) : (
                              <ul className="space-y-1">
                                {r.todayServices.map((s) => (
                                  <li key={s.id} className="text-emerald-900">
                                    <span className="font-semibold">✓ {s.serviceName}</span>
                                    {s.serviceValue ? `: ${s.serviceValue}` : ''}
                                    {s.batchNumber ? ` · बॅच: ${s.batchNumber}` : ''} · {s.staffName || '-'}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-amber-900">
                            {r.pendingCatalogServices.length === 0
                              ? 'सर्व सक्रिय सेवा आज दिल्या आहेत'
                              : r.pendingCatalogServices.map((p) => p.serviceName).join(', ')}
                          </td>
                          <td className="px-2.5 py-2 text-slate-700 space-y-1">
                            <div>
                              {r.previousServices.length === 0
                                ? 'मागील भेट नाही'
                                : r.previousServices
                                    .slice(0, 6)
                                    .map(
                                      (p) =>
                                        `${p.serviceName}${p.serviceValue ? ` (${p.serviceValue})` : ''} [${formatDDMMYYYY(
                                          p.visitDate
                                        )}]`
                                    )
                                    .join(', ')}
                            </div>
                            {r.remarks && (
                              <div className="font-medium text-slate-900">शेरा: {r.remarks}</div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Maternal Summary */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white bg-teal-700 px-3 py-1.5 rounded">
                  ड. गरोदर माता ANC सत्र सारांश
                </h4>
                <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="px-3 py-2">सत्रात समाविष्ट एकूण गरोदर माता</td>
                      <td className="px-3 py-2 text-right font-mono-tabular font-bold">
                        {formatNumberIN(maternalReport.summary.totalWomen)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">नवीन नोंदणीकृत गरोदर माता</td>
                      <td className="px-3 py-2 text-right font-mono-tabular font-bold">
                        {formatNumberIN(maternalReport.summary.newWomen)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">मागील नोंदणीकृत गरोदर माता</td>
                      <td className="px-3 py-2 text-right font-mono-tabular font-bold">
                        {formatNumberIN(maternalReport.summary.existingWomen)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">आज ANC सेवा दिलेल्या माता</td>
                      <td className="px-3 py-2 text-right font-mono-tabular font-bold text-emerald-700">
                        {formatNumberIN(maternalReport.summary.servedCount)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">आज नोंदवलेल्या एकूण ANC सेवा</td>
                      <td className="px-3 py-2 text-right font-mono-tabular font-bold text-teal-800">
                        {formatNumberIN(maternalReport.summary.totalServicesToday)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white bg-teal-700 px-3 py-1.5 rounded">
                  ANC सेवानिहाय संख्या गोषवारा
                </h4>
                <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-left">ANC सेवा</th>
                      <th className="px-3 py-2 font-semibold text-right">संख्या</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {maternalReport.serviceCounts.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-center text-slate-500">
                          आजच्या सत्रात कोणतीही ANC सेवा नोंदवलेली नाही.
                        </td>
                      </tr>
                    ) : (
                      maternalReport.serviceCounts.map((s) => (
                        <tr key={s.serviceCode}>
                          <td className="px-3 py-2 font-medium">{s.serviceName}</td>
                          <td className="px-3 py-2 text-right font-mono-tabular font-bold">
                            {formatNumberIN(s.count)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          report && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-white">
              {/* Letterhead */}
              <div className="border-2 border-teal-700 bg-teal-50/50 rounded-lg p-4 text-center space-y-1">
                <h1 className="text-lg font-bold text-teal-900">प्राथमिक आरोग्य केंद्र भादा</h1>
                <h2 className="text-base font-bold text-slate-900">
                  बालक लसीकरण सत्राचा सविस्तर अहवाल
                </h2>
                <p className="text-xs text-slate-600 font-mono-tabular">
                  सत्र कोड: {session.sessionCode} · दिनांक: {formatDDMMYYYY(session.sessionDate)} · स्थिती:{' '}
                  {session.status}
                </p>
              </div>

              {/* Section A: Session Details */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white bg-teal-700 px-3 py-1.5 rounded">
                  अ. लसीकरण सत्राचा तपशील (Session Details)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <div>
                    <span className="text-slate-500">प्राथमिक आरोग्य केंद्र:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {session.phcName || 'प्राथमिक आरोग्य केंद्र भादा'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">उपकेंद्र:</span>{' '}
                    <span className="font-semibold text-slate-900">{session.subcentreName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">गाव:</span>{' '}
                    <span className="font-semibold text-slate-900">{session.villageName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">सत्र दिनांक:</span>{' '}
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {formatDDMMYYYY(session.sessionDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">सत्र ठिकाण:</span>{' '}
                    <span className="font-semibold text-slate-900">{session.location}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">सत्र प्रकार:</span>{' '}
                    <span className="font-semibold text-slate-900">{session.sessionType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">CHO नाव:</span>{' '}
                    <span className="font-semibold text-slate-900">{session.choName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ANM नाव:</span>{' '}
                    <span className="font-semibold text-slate-900">{session.anmName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">सत्र पूर्ण स्थिती / वेळ:</span>{' '}
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {session.status}
                      {session.completedAt ? ` · ${formatDateTimeIST(session.completedAt)}` : ''}
                    </span>
                  </div>
                </div>
              </section>

              {/* Section B: Child Beneficiary Details */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white bg-teal-700 px-3 py-1.5 rounded">
                  ब. सत्रातील सर्व बालक लाभार्थ्यांचा तपशील ({formatNumberIN(report.beneficiaryRows.length)} बालके)
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-2.5 py-2 font-semibold text-center">अ.क्र.</th>
                        <th className="px-2.5 py-2 font-semibold">लाभार्थी आयडी</th>
                        <th className="px-2.5 py-2 font-semibold">बालकाचे नाव</th>
                        <th className="px-2.5 py-2 font-semibold">पालक / आई-वडील</th>
                        <th className="px-2.5 py-2 font-semibold">जन्मतारीख / वय</th>
                        <th className="px-2.5 py-2 font-semibold text-center">लिंग</th>
                        <th className="px-2.5 py-2 font-semibold">जात / प्रवर्ग</th>
                        <th className="px-2.5 py-2 font-semibold">आधार (Masked)</th>
                        <th className="px-2.5 py-2 font-semibold">गाव व मोबाईल</th>
                        <th className="px-2.5 py-2 font-semibold">नोंदणी प्रकार</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.beneficiaryRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                            या सत्रात कोणताही बालक लाभार्थी समाविष्ट नाही.
                          </td>
                        </tr>
                      ) : (
                        report.beneficiaryRows.map((r) => (
                          <tr key={r.beneficiary.id} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 text-center font-mono-tabular">{r.serialNo}</td>
                            <td className="px-2.5 py-2 font-mono-tabular font-semibold text-teal-800 whitespace-nowrap">
                              {r.beneficiary.beneficiaryCode}
                            </td>
                            <td className="px-2.5 py-2 font-semibold text-slate-900">
                              {r.beneficiary.childName}
                            </td>
                            <td className="px-2.5 py-2">
                              <div>{r.beneficiary.guardianName || r.beneficiary.fatherName || '-'}</div>
                              <div className="text-[11px] text-slate-500">
                                आई: {r.beneficiary.motherName || '-'}
                              </div>
                            </td>
                            <td className="px-2.5 py-2 font-mono-tabular">
                              <div>{formatDDMMYYYY(r.beneficiary.dob)}</div>
                              <div className="text-[11px] text-slate-500 font-sans">
                                {r.ageOnSessionDate}
                              </div>
                            </td>
                            <td className="px-2.5 py-2 text-center">{r.beneficiary.gender}</td>
                            <td className="px-2.5 py-2">
                              <div>{r.beneficiary.caste || '-'}</div>
                              <div className="text-[11px] text-slate-500">
                                {r.beneficiary.category || '-'}
                              </div>
                            </td>
                            <td className="px-2.5 py-2 font-mono-tabular text-[11px] text-slate-700">
                              {r.maskedAadhaar}
                            </td>
                            <td className="px-2.5 py-2">
                              <div>{r.beneficiary.villageName}</div>
                              <div className="font-mono-tabular text-slate-500">
                                {r.beneficiary.mobile || '-'}
                              </div>
                            </td>
                            <td className="px-2.5 py-2 font-medium">{r.enrollmentLabel}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section C: Child Vaccination Services */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white bg-teal-700 px-3 py-1.5 rounded">
                  क. आज दिलेले लसीकरण व देय/न देय सेवांचा तपशील
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-2.5 py-2 font-semibold text-center">अ.क्र.</th>
                        <th className="px-2.5 py-2 font-semibold">लाभार्थी नाव व आयडी</th>
                        <th className="px-2.5 py-2 font-semibold">आज दिलेल्या लसी (दिनांक, बॅच, कर्मचारी)</th>
                        <th className="px-2.5 py-2 font-semibold">देय परंतु आज न दिलेल्या लसी</th>
                        <th className="px-2.5 py-2 font-semibold">अद्याप देय नसलेल्या लसी</th>
                        <th className="px-2.5 py-2 font-semibold">मागील लसीकरण / शेरा</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.beneficiaryRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                            लसीकरण सेवा नोंद उपलब्ध नाही.
                          </td>
                        </tr>
                      ) : (
                        report.beneficiaryRows.map((r) => (
                          <tr key={r.beneficiary.id} className="align-top hover:bg-slate-50">
                            <td className="px-2.5 py-2 text-center font-mono-tabular">{r.serialNo}</td>
                            <td className="px-2.5 py-2">
                              <div className="font-semibold text-slate-900">{r.beneficiary.childName}</div>
                              <div className="text-[11px] font-mono-tabular text-teal-800">
                                {r.beneficiary.beneficiaryCode}
                              </div>
                            </td>
                            <td className="px-2.5 py-2">
                              {r.todayDoses.length === 0 ? (
                                <span className="text-slate-500">आज लसीकरण दिलेले नाही</span>
                              ) : (
                                <ul className="space-y-1">
                                  {r.todayDoses.map((d) => (
                                    <li key={d.id} className="text-emerald-900">
                                      <span className="font-semibold">
                                        ✓ {d.vaccineName} ({d.doseName})
                                      </span>{' '}
                                      · दि.{' '}
                                      <span className="font-mono-tabular">
                                        {formatDDMMYYYY(d.administeredDate)}
                                      </span>
                                      {d.batchNumber ? ` · बॅच: ${d.batchNumber}` : ''} ·{' '}
                                      {d.staffName || '-'}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="px-2.5 py-2 text-amber-800">
                              {r.dueNotAdministered.length === 0
                                ? 'कोणतीही नाही'
                                : r.dueNotAdministered
                                    .map((d) => `${d.schedule.vaccineName} (${d.schedule.doseName})`)
                                    .join(', ')}
                            </td>
                            <td className="px-2.5 py-2 text-slate-600">
                              {r.notDueDoses.length === 0
                                ? 'कोणतीही नाही'
                                : r.notDueDoses.map((d) => d.schedule.doseName).join(', ')}
                            </td>
                            <td className="px-2.5 py-2 text-slate-700 space-y-1">
                              <div>
                                {r.previousDoses.length === 0
                                  ? 'मागील लस नाही'
                                  : `मागील: ${r.previousDoses
                                      .map(
                                        (p) => `${p.doseName} (${formatDDMMYYYY(p.administeredDate)})`
                                      )
                                      .join(', ')}`}
                              </div>
                              {r.remarks && (
                                <div className="text-slate-900 font-medium">शेरा: {r.remarks}</div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section D: Child Summary & Counts */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white bg-teal-700 px-3 py-1.5 rounded">
                    ड. बालक लसीकरण सत्र सारांश
                  </h4>
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="px-3 py-2">सत्रात समाविष्ट एकूण बालके</td>
                        <td className="px-3 py-2 text-right font-mono-tabular font-bold">
                          {formatNumberIN(report.summary.totalBeneficiaries)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">नवीन नोंदणीकृत बालके</td>
                        <td className="px-3 py-2 text-right font-mono-tabular font-bold">
                          {formatNumberIN(report.summary.newBeneficiaries)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">मागील नोंदणीकृत बालके</td>
                        <td className="px-3 py-2 text-right font-mono-tabular font-bold">
                          {formatNumberIN(report.summary.existingBeneficiaries)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">आज लसीकरण झालेली बालके</td>
                        <td className="px-3 py-2 text-right font-mono-tabular font-bold text-emerald-700">
                          {formatNumberIN(report.summary.vaccinatedCount)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">आज दिलेले एकूण लस डोस</td>
                        <td className="px-3 py-2 text-right font-mono-tabular font-bold text-teal-800">
                          {formatNumberIN(report.summary.totalDosesToday)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white bg-teal-700 px-3 py-1.5 rounded">
                    लस व डोसनिहाय गोषवारा
                  </h4>
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-left">लसीचे नाव</th>
                        <th className="px-3 py-2 font-semibold text-left">डोस</th>
                        <th className="px-3 py-2 font-semibold text-right">दिलेल्या मात्रा</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.vaccineDoseCounts.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                            आजच्या सत्रात कोणतीही लस दिलेली नाही.
                          </td>
                        </tr>
                      ) : (
                        report.vaccineDoseCounts.map((v) => (
                          <tr key={`${v.vaccineName}_${v.doseName}`}>
                            <td className="px-3 py-2 font-medium">{v.vaccineName}</td>
                            <td className="px-3 py-2">{v.doseName}</td>
                            <td className="px-3 py-2 text-right font-mono-tabular font-bold">
                              {formatNumberIN(v.count)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )
        )}
      </div>
    </div>
  );
};
