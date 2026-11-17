import jsPDF from 'jspdf';
import {
  Beneficiary,
  MaternalServiceConfigItem,
  MaternalServiceRecord,
  PregnancyEpisode,
  SheetDatabase,
  VaccinationRecord,
  VaccinationSession,
} from '../types';
import { calculateAgeAsOf, formatDDMMYYYY } from './dateUtils';
import { DoseEligibilityResult, evaluateBeneficiaryEligibility } from './eligibilityEngine';
import { exportMultiSheetExcel } from './exportUtils';
import { formatDateTimeIST, formatNumberIN } from './localeUtils';
import {
  calculateGestationalAgeLabel,
  formatDeliveryFacilityTypeMarathi,
  getMaternalServiceCatalog,
  isEveryVisitAncService,
} from './maternalUtils';
import { maskAadhaar } from './privacyUtils';

export interface SessionReportBeneficiaryRow {
  serialNo: number;
  beneficiary: Beneficiary;
  enrollmentType: 'NEW' | 'EXISTING';
  enrollmentLabel: string;
  ageOnSessionDate: string;
  maskedAadhaar: string;
  previousDoses: VaccinationRecord[];
  todayDoses: VaccinationRecord[];
  dueNotAdministered: DoseEligibilityResult[];
  notDueDoses: DoseEligibilityResult[];
  remarks: string;
}

export interface VaccineDoseSummaryRow {
  vaccineName: string;
  doseName: string;
  doseOrder: number;
  count: number;
}

export interface DetailedSessionReportData {
  session: VaccinationSession;
  preparedBy: string;
  generatedAtIST: string;
  beneficiaryRows: SessionReportBeneficiaryRow[];
  summary: {
    totalBeneficiaries: number;
    newBeneficiaries: number;
    existingBeneficiaries: number;
    vaccinatedCount: number;
    unvaccinatedCount: number;
    totalDosesToday: number;
    dueRemainingCount: number;
  };
  vaccineDoseCounts: VaccineDoseSummaryRow[];
}

export interface MaternalSessionReportRow {
  serialNo: number;
  beneficiary: Beneficiary;
  episode: PregnancyEpisode | null;
  enrollmentType: 'NEW' | 'EXISTING';
  enrollmentLabel: string;
  maskedAadhaar: string;
  gestationalAgeOnSession: string;
  todayServices: MaternalServiceRecord[];
  previousServices: MaternalServiceRecord[];
  pendingCatalogServices: MaternalServiceConfigItem[];
  remarks: string;
}

export interface MaternalServiceSummaryRow {
  serviceCode: string;
  serviceName: string;
  count: number;
}

export interface DetailedMaternalSessionReportData {
  session: VaccinationSession;
  preparedBy: string;
  generatedAtIST: string;
  womanRows: MaternalSessionReportRow[];
  summary: {
    totalWomen: number;
    newWomen: number;
    existingWomen: number;
    servedCount: number;
    unservedCount: number;
    totalServicesToday: number;
  };
  serviceCounts: MaternalServiceSummaryRow[];
}

export function buildDetailedSessionReportData(
  db: SheetDatabase,
  session: VaccinationSession,
  preparedBy: string,
  generatedAtISO: string = new Date().toISOString()
): DetailedSessionReportData {
  const validatedSchedules = db.vaccineSchedule
    .filter((s) => s.isActive && s.isValidated)
    .sort((a, b) => a.doseOrder - b.doseOrder);

  const scheduleOrderMap = new Map<string, number>();
  for (const s of db.vaccineSchedule) {
    scheduleOrderMap.set(s.id, s.doseOrder);
  }

  const recordsByBen = new Map<string, VaccinationRecord[]>();
  for (const rec of db.vaccinationRecords) {
    const arr = recordsByBen.get(rec.beneficiaryId) || [];
    arr.push(rec);
    recordsByBen.set(rec.beneficiaryId, arr);
  }

  const sessionRoster = db.sessionBeneficiaries.filter((sb) => sb.sessionId === session.id);

  const beneficiaryRows: SessionReportBeneficiaryRow[] = [];
  const doseCounter = new Map<string, VaccineDoseSummaryRow>();

  let serial = 0;
  for (const sb of sessionRoster) {
    const ben = db.beneficiaries.find((b) => b.id === sb.beneficiaryId);
    if (!ben) continue;
    if ((ben.beneficiaryType || 'CHILD') === 'PREGNANT_WOMAN') continue;
    serial += 1;

    const enrollmentType: 'NEW' | 'EXISTING' =
      sb.enrollmentType === 'NEW'
        ? 'NEW'
        : sb.enrollmentType === 'EXISTING'
          ? 'EXISTING'
          : ben.registrationDate === session.sessionDate && ben.createdAt >= session.createdAt
            ? 'NEW'
            : 'EXISTING';

    const benRecords = recordsByBen.get(ben.id) || [];
    const todayDoses = benRecords
      .filter((r) => r.sessionId === session.id)
      .sort(
        (a, b) =>
          (scheduleOrderMap.get(a.scheduleId) ?? 999) -
          (scheduleOrderMap.get(b.scheduleId) ?? 999)
      );

    const previousDoses = benRecords
      .filter((r) => r.sessionId !== session.id)
      .sort((a, b) => a.administeredDate.localeCompare(b.administeredDate));

    const evalSummary = evaluateBeneficiaryEligibility(
      ben,
      session.sessionDate,
      validatedSchedules,
      benRecords
    );

    const dueNotAdministered = evalSummary.dueDoses;
    const notDueDoses = evalSummary.allDoseResults.filter(
      (r) =>
        r.status === 'NOT_YET_ELIGIBLE' ||
        r.status === 'INTERVAL_PENDING' ||
        r.status === 'OVER_MAX_AGE'
    );

    const remarkParts: string[] = [];
    if (sb.remarks?.trim()) remarkParts.push(sb.remarks.trim());
    for (const td of todayDoses) {
      if (td.remarks?.trim() && !remarkParts.includes(td.remarks.trim())) {
        remarkParts.push(td.remarks.trim());
      }
    }

    for (const td of todayDoses) {
      const key = `${td.vaccineName}__${td.doseName}`;
      const existing = doseCounter.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        doseCounter.set(key, {
          vaccineName: td.vaccineName,
          doseName: td.doseName,
          doseOrder: scheduleOrderMap.get(td.scheduleId) ?? 999,
          count: 1,
        });
      }
    }

    beneficiaryRows.push({
      serialNo: serial,
      beneficiary: ben,
      enrollmentType,
      enrollmentLabel: enrollmentType === 'NEW' ? 'नवीन नोंदणी' : 'मागील नोंदणीकृत',
      ageOnSessionDate: calculateAgeAsOf(ben.dob, session.sessionDate).labelMarathi,
      maskedAadhaar: maskAadhaar(ben.aadhaarNumber),
      previousDoses,
      todayDoses,
      dueNotAdministered,
      notDueDoses,
      remarks: remarkParts.join('; '),
    });
  }

  const newBeneficiaries = beneficiaryRows.filter((r) => r.enrollmentType === 'NEW').length;
  const existingBeneficiaries = beneficiaryRows.filter((r) => r.enrollmentType === 'EXISTING').length;
  const vaccinatedCount = beneficiaryRows.filter((r) => r.todayDoses.length > 0).length;
  const unvaccinatedCount = beneficiaryRows.length - vaccinatedCount;
  const totalDosesToday = beneficiaryRows.reduce((acc, r) => acc + r.todayDoses.length, 0);
  const dueRemainingCount = beneficiaryRows.reduce(
    (acc, r) => acc + r.dueNotAdministered.length,
    0
  );

  const vaccineDoseCounts = Array.from(doseCounter.values()).sort(
    (a, b) => a.doseOrder - b.doseOrder || a.doseName.localeCompare(b.doseName)
  );

  return {
    session,
    preparedBy,
    generatedAtIST: formatDateTimeIST(generatedAtISO),
    beneficiaryRows,
    summary: {
      totalBeneficiaries: beneficiaryRows.length,
      newBeneficiaries,
      existingBeneficiaries,
      vaccinatedCount,
      unvaccinatedCount,
      totalDosesToday,
      dueRemainingCount,
    },
    vaccineDoseCounts,
  };
}

export const buildChildSessionReportData = buildDetailedSessionReportData;

export function buildMaternalSessionReportData(
  db: SheetDatabase,
  session: VaccinationSession,
  preparedBy: string,
  generatedAtISO: string = new Date().toISOString()
): DetailedMaternalSessionReportData {
  const catalog = getMaternalServiceCatalog(db.systemSettings[0]).filter((s) => s.isActive);
  const sessionRoster = db.sessionBeneficiaries.filter((sb) => sb.sessionId === session.id);

  const womanRows: MaternalSessionReportRow[] = [];
  const serviceCounter = new Map<string, MaternalServiceSummaryRow>();

  let serial = 0;
  for (const sb of sessionRoster) {
    const ben = db.beneficiaries.find((b) => b.id === sb.beneficiaryId);
    if (!ben) continue;
    if ((ben.beneficiaryType || 'CHILD') !== 'PREGNANT_WOMAN') continue;
    serial += 1;

    const enrollmentType: 'NEW' | 'EXISTING' =
      sb.enrollmentType === 'NEW'
        ? 'NEW'
        : sb.enrollmentType === 'EXISTING'
          ? 'EXISTING'
          : ben.registrationDate === session.sessionDate && ben.createdAt >= session.createdAt
            ? 'NEW'
            : 'EXISTING';

    const benEpisodes = db.pregnancyEpisodes
      .filter((ep) => ep.beneficiaryId === ben.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const episode =
      (sb.pregnancyEpisodeId
        ? benEpisodes.find((ep) => ep.id === sb.pregnancyEpisodeId)
        : undefined) ||
      benEpisodes.find((ep) => ep.pregnancyStatus === 'सक्रिय') ||
      benEpisodes[0] ||
      null;

    const benServiceRecords = db.maternalServiceRecords.filter(
      (r) =>
        r.beneficiaryId === ben.id &&
        (!episode || !r.pregnancyEpisodeId || r.pregnancyEpisodeId === episode.id)
    );

    const todayServices = benServiceRecords.filter((r) => r.sessionId === session.id);
    const previousServices = benServiceRecords
      .filter((r) => r.sessionId !== session.id)
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate));

    const providedCodesToday = new Set(todayServices.map((s) => s.serviceCode));
    const episodeTdGivenEarlier = new Set(
      previousServices.filter((s) => s.serviceCode.startsWith('TD_')).map((s) => s.serviceCode)
    );
    const pendingCatalogServices = catalog.filter((c) => {
      if (providedCodesToday.has(c.serviceCode)) return false;
      if (isEveryVisitAncService(c)) return true; // Mandatory at every ANC visit!
      if (c.serviceCode.startsWith('TD_') && episodeTdGivenEarlier.has(c.serviceCode)) {
        return false; // Already administered earlier in this pregnancy episode
      }
      return true;
    });

    const remarkParts: string[] = [];
    if (sb.remarks?.trim()) remarkParts.push(sb.remarks.trim());
    for (const ts of todayServices) {
      if (ts.remarks?.trim() && !remarkParts.includes(ts.remarks.trim())) {
        remarkParts.push(ts.remarks.trim());
      }
    }

    for (const ts of todayServices) {
      const existing = serviceCounter.get(ts.serviceCode);
      if (existing) {
        existing.count += 1;
      } else {
        serviceCounter.set(ts.serviceCode, {
          serviceCode: ts.serviceCode,
          serviceName: ts.serviceName,
          count: 1,
        });
      }
    }

    womanRows.push({
      serialNo: serial,
      beneficiary: ben,
      episode,
      enrollmentType,
      enrollmentLabel: enrollmentType === 'NEW' ? 'नवीन नोंदणी' : 'मागील नोंदणीकृत',
      maskedAadhaar: maskAadhaar(ben.aadhaarNumber),
      gestationalAgeOnSession: episode
        ? calculateGestationalAgeLabel(episode.mcDate, session.sessionDate)
        : '-',
      todayServices,
      previousServices,
      pendingCatalogServices,
      remarks: remarkParts.join('; '),
    });
  }

  const newWomen = womanRows.filter((r) => r.enrollmentType === 'NEW').length;
  const existingWomen = womanRows.filter((r) => r.enrollmentType === 'EXISTING').length;
  const servedCount = womanRows.filter((r) => r.todayServices.length > 0).length;
  const unservedCount = womanRows.length - servedCount;
  const totalServicesToday = womanRows.reduce((acc, r) => acc + r.todayServices.length, 0);

  const catalogOrder = new Map(catalog.map((c) => [c.serviceCode, c.displayOrder]));
  const serviceCounts = Array.from(serviceCounter.values()).sort(
    (a, b) => (catalogOrder.get(a.serviceCode) ?? 999) - (catalogOrder.get(b.serviceCode) ?? 999)
  );

  return {
    session,
    preparedBy,
    generatedAtIST: formatDateTimeIST(generatedAtISO),
    womanRows,
    summary: {
      totalWomen: womanRows.length,
      newWomen,
      existingWomen,
      servedCount,
      unservedCount,
      totalServicesToday,
    },
    serviceCounts,
  };
}

export function downloadDetailedSessionExcel(report: DetailedSessionReportData) {
  const { session, summary, beneficiaryRows, vaccineDoseCounts } = report;

  const summarySheet = {
    name: 'Child_Session_Summary',
    headers: ['तपशील', 'माहिती'],
    rows: [
      ['प्राथमिक आरोग्य केंद्र', session.phcName || 'प्राथमिक आरोग्य केंद्र भादा'],
      ['अहवाल प्रकार', 'बालक लसीकरण सत्र अहवाल'],
      ['सत्र कोड', session.sessionCode],
      ['उपकेंद्र', session.subcentreName],
      ['गाव', session.villageName],
      ['सत्र दिनांक', formatDDMMYYYY(session.sessionDate)],
      ['सत्र ठिकाण', session.location],
      ['सत्र प्रकार', session.sessionType],
      ['CHO नाव', session.choName || '-'],
      ['ANM नाव', session.anmName || '-'],
      ['स्थिती', session.status],
      ['सत्र पूर्ण वेळ', session.completedAt ? formatDateTimeIST(session.completedAt) : '-'],
      ['सत्रात समाविष्ट एकूण बालक लाभार्थी', summary.totalBeneficiaries],
      ['नवीन नोंदणीकृत बालके', summary.newBeneficiaries],
      ['मागील नोंदणीकृत बालके', summary.existingBeneficiaries],
      ['आज लसीकरण झालेली बालके', summary.vaccinatedCount],
      ['आज लसीकरण न झालेली बालके', summary.unvaccinatedCount],
      ['आज दिलेले एकूण लस डोस', summary.totalDosesToday],
      ['अहवाल निर्मिती वेळ (IST)', report.generatedAtIST],
      ['अहवाल तयार करणारे', report.preparedBy],
    ],
  };

  const benSheet = {
    name: 'Child_Beneficiaries',
    headers: [
      'अ.क्र.',
      'लाभार्थी आयडी',
      'बालकाचे पूर्ण नाव',
      'पालक / आई-वडिलांचे नाव',
      'जन्मतारीख',
      'सत्र दिनांकाचे वय',
      'लिंग',
      'जात / प्रवर्ग',
      'पालक आधार (Masked)',
      'गाव व पत्ता',
      'मोबाईल',
      'नोंदणी प्रकार',
    ],
    rows: beneficiaryRows.map((r) => [
      r.serialNo,
      r.beneficiary.beneficiaryCode,
      r.beneficiary.childName,
      `${r.beneficiary.guardianName || r.beneficiary.fatherName || '-'} (आई: ${r.beneficiary.motherName || '-'})`,
      formatDDMMYYYY(r.beneficiary.dob),
      r.ageOnSessionDate,
      r.beneficiary.gender,
      `${r.beneficiary.caste || '-'} / ${r.beneficiary.category || '-'}`,
      r.maskedAadhaar,
      `${r.beneficiary.villageName}${r.beneficiary.address ? ` (${r.beneficiary.address})` : ''}`,
      r.beneficiary.mobile,
      r.enrollmentLabel,
    ]),
  };

  const servicesSheet = {
    name: 'Child_Vaccination_Services',
    headers: [
      'अ.क्र.',
      'लाभार्थी आयडी',
      'बालकाचे नाव',
      'आज दिलेल्या लसी व डोस (दिनांक, बॅच, लसीकरण करणारे)',
      'देय परंतु आज न दिलेल्या लसी',
      'अद्याप देय नसलेल्या लसी',
      'मागील लसीकरण इतिहास',
      'शेरा',
    ],
    rows: beneficiaryRows.map((r) => [
      r.serialNo,
      r.beneficiary.beneficiaryCode,
      r.beneficiary.childName,
      r.todayDoses.length === 0
        ? 'आज कोणतीही लस दिलेली नाही'
        : r.todayDoses
            .map(
              (d) =>
                `${d.vaccineName} - ${d.doseName} (${formatDDMMYYYY(d.administeredDate)}${
                  d.batchNumber ? `, बॅच: ${d.batchNumber}` : ''
                }, ${d.staffName || '-'})`
            )
            .join(' | '),
      r.dueNotAdministered.length === 0
        ? 'कोणतीही नाही'
        : r.dueNotAdministered.map((d) => `${d.schedule.vaccineName} (${d.schedule.doseName})`).join(', '),
      r.notDueDoses.length === 0
        ? 'कोणतीही नाही'
        : r.notDueDoses.map((d) => d.schedule.doseName).join(', '),
      r.previousDoses.length === 0
        ? 'मागील लस नाही'
        : r.previousDoses
            .map((d) => `${d.doseName} (${formatDDMMYYYY(d.administeredDate)})`)
            .join(', '),
      r.remarks || '-',
    ]),
  };

  const countSheet = {
    name: 'Vaccine_Counts',
    headers: ['लसीचे नाव', 'डोस', 'आज दिलेल्या एकूण मात्रा'],
    rows:
      vaccineDoseCounts.length > 0
        ? vaccineDoseCounts.map((v) => [v.vaccineName, v.doseName, v.count])
        : [['आज कोणतीही लस दिलेली नाही', '-', 0]],
  };

  exportMultiSheetExcel(`PHC_Bhada_Child_Session_Report_${session.sessionCode}`, [
    summarySheet,
    benSheet,
    servicesSheet,
    countSheet,
  ]);
}

export function downloadMaternalSessionExcel(report: DetailedMaternalSessionReportData) {
  const { session, summary, womanRows, serviceCounts } = report;

  const summarySheet = {
    name: 'ANC_Session_Summary',
    headers: ['तपशील', 'माहिती'],
    rows: [
      ['प्राथमिक आरोग्य केंद्र', session.phcName || 'प्राथमिक आरोग्य केंद्र भादा'],
      ['अहवाल प्रकार', 'गरोदर माता ANC व लसीकरण सत्र अहवाल'],
      ['सत्र कोड', session.sessionCode],
      ['उपकेंद्र', session.subcentreName],
      ['गाव', session.villageName],
      ['सत्र दिनांक', formatDDMMYYYY(session.sessionDate)],
      ['सत्र ठिकाण', session.location],
      ['CHO नाव', session.choName || '-'],
      ['ANM नाव', session.anmName || '-'],
      ['स्थिती', session.status],
      ['सत्रात समाविष्ट एकूण गरोदर माता', summary.totalWomen],
      ['नवीन नोंदणीकृत गरोदर माता', summary.newWomen],
      ['मागील नोंदणीकृत गरोदर माता', summary.existingWomen],
      ['आज ANC सेवा दिलेल्या माता', summary.servedCount],
      ['आज सेवा न नोंदवलेल्या माता', summary.unservedCount],
      ['आज दिलेल्या एकूण ANC सेवा', summary.totalServicesToday],
      ['अहवाल निर्मिती वेळ (IST)', report.generatedAtIST],
      ['अहवाल तयार करणारे', report.preparedBy],
    ],
  };

  const womenSheet = {
    name: 'Pregnant_Women',
    headers: [
      'अ.क्र.',
      'माता आयडी',
      'मातेचे पूर्ण नाव',
      'पतीचे नाव',
      'मोबाईल',
      'आधार (Masked)',
      'जात / प्रवर्ग',
      'गाव व पत्ता',
      'गर्भधारणा प्रकरण आयडी',
      'MC दिनांक',
      'EDD दिनांक',
      'प्रसूती अपेक्षित ठिकाण व संस्था',
      'नोंदणी प्रकार',
    ],
    rows: womanRows.map((r) => [
      r.serialNo,
      r.beneficiary.beneficiaryCode,
      r.beneficiary.childName,
      r.beneficiary.guardianName || r.beneficiary.fatherName || '-',
      r.beneficiary.mobile,
      r.maskedAadhaar,
      `${r.beneficiary.caste || '-'} / ${r.beneficiary.category || '-'}`,
      `${r.beneficiary.villageName}${r.beneficiary.address ? ` (${r.beneficiary.address})` : ''}`,
      r.episode?.episodeCode || '-',
      r.episode?.mcDate ? formatDDMMYYYY(r.episode.mcDate) : '-',
      r.episode?.eddDate ? formatDDMMYYYY(r.episode.eddDate) : '-',
      r.episode
        ? `${r.episode.expectedDeliveryPlace || '-'} (${formatDeliveryFacilityTypeMarathi(
            r.episode.deliveryFacilityType
          )}${r.episode.hospitalName ? ` - ${r.episode.hospitalName}` : ''})`
        : '-',
      r.enrollmentLabel,
    ]),
  };

  const serviceSheet = {
    name: 'ANC_Services',
    headers: [
      'अ.क्र.',
      'माता आयडी',
      'मातेचे नाव',
      'गर्भधारणा आयडी',
      'आज दिलेल्या ANC सेवा',
      'आज न नोंदवलेल्या / प्रलंबित सेवा',
      'या गर्भधारणेतील मागील ANC भेटी',
      'शेरा',
    ],
    rows: womanRows.map((r) => [
      r.serialNo,
      r.beneficiary.beneficiaryCode,
      r.beneficiary.childName,
      r.episode?.episodeCode || '-',
      r.todayServices.length === 0
        ? 'आज कोणतीही ANC सेवा नोंदवलेली नाही'
        : r.todayServices
            .map(
              (s) =>
                `${s.serviceName}${s.serviceValue ? `: ${s.serviceValue}` : ''}${
                  s.batchNumber ? ` (बॅच: ${s.batchNumber})` : ''
                } - ${s.staffName || '-'}`
            )
            .join(' | '),
      r.pendingCatalogServices.length === 0
        ? 'सर्व सक्रिय सेवा आज दिल्या आहेत'
        : r.pendingCatalogServices.map((p) => p.serviceName).join(', '),
      r.previousServices.length === 0
        ? 'मागील भेट नाही'
        : r.previousServices
            .map(
              (p) =>
                `${p.serviceName}${p.serviceValue ? ` (${p.serviceValue})` : ''} - ${formatDDMMYYYY(
                  p.visitDate
                )}`
            )
            .join(' | '),
      r.remarks || '-',
    ]),
  };

  const countSheet = {
    name: 'ANC_Service_Counts',
    headers: ['सेवेचे नाव', 'आज दिलेल्या एकूण सेवा'],
    rows:
      serviceCounts.length > 0
        ? serviceCounts.map((s) => [s.serviceName, s.count])
        : [['आज कोणतीही सेवा नोंदवलेली नाही', 0]],
  };

  exportMultiSheetExcel(`PHC_Bhada_Maternal_ANC_Report_${session.sessionCode}`, [
    summarySheet,
    womenSheet,
    serviceSheet,
    countSheet,
  ]);
}

// ---------- High-DPI Devanagari Unicode Canvas -> A4 Multi-Page PDF Engine ----------

const FONT_FAMILY = "'Noto Sans Devanagari', 'Plus Jakarta Sans', system-ui, sans-serif";
const PDF_SCALE = 2; // 2x high-DPI rendering
const A4_PORTRAIT_PX = { w: 794, h: 1123 }; // Logical CSS px at 96dpi
const A4_LANDSCAPE_PX = { w: 1123, h: 794 };
const MARGIN_X = 34;
const MARGIN_TOP = 32;
const MARGIN_BOTTOM = 42;

interface PageSurface {
  orientation: 'portrait' | 'landscape';
  logicalW: number;
  logicalH: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  y: number;
}

interface TableColumnSpec {
  header: string;
  widthWeight: number;
  align?: 'left' | 'center' | 'right';
}

function createSurface(orientation: 'portrait' | 'landscape'): PageSurface {
  const dims = orientation === 'portrait' ? A4_PORTRAIT_PX : A4_LANDSCAPE_PX;
  const canvas = document.createElement('canvas');
  canvas.width = dims.w * PDF_SCALE;
  canvas.height = dims.h * PDF_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('PDF तयार करण्यासाठी Canvas संदर्भ उपलब्ध नाही.');
  }
  ctx.scale(PDF_SCALE, PDF_SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dims.w, dims.h);
  ctx.textBaseline = 'top';
  return {
    orientation,
    logicalW: dims.w,
    logicalH: dims.h,
    canvas,
    ctx,
    y: MARGIN_TOP,
  };
}

function wrapCellText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const safeText = (text || '-').replace(/\r\n/g, '\n');
  const paragraphs = safeText.split('\n');
  const result: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      result.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          result.push(currentLine);
          currentLine = '';
        }
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const ch of Array.from(word)) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              result.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          currentLine = chunk;
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) result.push(currentLine);
  }

  return result.length > 0 ? result : ['-'];
}

function drawRunningHeader(page: PageSurface, session: VaccinationSession, reportLabel: string) {
  const { ctx, logicalW } = page;
  ctx.save();
  ctx.font = `600 9px ${FONT_FAMILY}`;
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText(
    `प्राथमिक आरोग्य केंद्र भादा · ${reportLabel} (${session.sessionCode})`,
    MARGIN_X,
    14
  );
  ctx.textAlign = 'right';
  ctx.fillText(
    `${session.subcentreName} · ${session.villageName} · ${formatDDMMYYYY(session.sessionDate)}`,
    logicalW - MARGIN_X,
    14
  );
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, 27);
  ctx.lineTo(logicalW - MARGIN_X, 27);
  ctx.stroke();
  ctx.restore();
  page.y = 35;
}

function drawSectionBanner(
  page: PageSurface,
  title: string,
  pages: PageSurface[],
  session: VaccinationSession,
  reportLabel: string,
  accentColor = '#0f766e'
): PageSurface {
  let active = page;
  if (active.y + 36 > active.logicalH - MARGIN_BOTTOM) {
    active = createSurface(active.orientation);
    pages.push(active);
    drawRunningHeader(active, session, reportLabel);
  }
  const { ctx, logicalW } = active;
  ctx.save();
  ctx.fillStyle = accentColor;
  ctx.fillRect(MARGIN_X, active.y, logicalW - MARGIN_X * 2, 22);
  ctx.font = `700 11px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(title, MARGIN_X + 8, active.y + 5);
  ctx.restore();
  active.y += 26;
  return active;
}

function drawPaginatedTable(
  startPage: PageSurface,
  pages: PageSurface[],
  session: VaccinationSession,
  reportLabel: string,
  columns: TableColumnSpec[],
  rows: string[][],
  options: {
    fontSize?: number;
    headerFontSize?: number;
    repeatBannerTitle?: string;
    accentColor?: string;
  } = {}
): PageSurface {
  const fontSize = options.fontSize ?? 9.5;
  const headerFontSize = options.headerFontSize ?? 9.5;
  const lineHeight = fontSize * 1.38;
  const headerLineHeight = headerFontSize * 1.35;
  const padX = 5;
  const padY = 4.5;

  let active = startPage;
  const totalWeight = columns.reduce((s, c) => s + c.widthWeight, 0);

  const computeColWidths = (logicalW: number) => {
    const usableW = logicalW - MARGIN_X * 2;
    return columns.map((c) => (c.widthWeight / totalWeight) * usableW);
  };

  const renderTableHeader = (target: PageSurface, colWidths: number[]) => {
    const { ctx } = target;
    ctx.font = `700 ${headerFontSize}px ${FONT_FAMILY}`;
    const wrappedHeaders = columns.map((c, idx) =>
      wrapCellText(ctx, c.header, Math.max(20, colWidths[idx] - padX * 2))
    );
    const maxLines = Math.max(1, ...wrappedHeaders.map((h) => h.length));
    const headerH = maxLines * headerLineHeight + padY * 2;

    if (target.y + headerH + 24 > target.logicalH - MARGIN_BOTTOM) {
      const next = createSurface(target.orientation);
      pages.push(next);
      drawRunningHeader(next, session, reportLabel);
      if (options.repeatBannerTitle) {
        drawSectionBanner(
          next,
          `${options.repeatBannerTitle} (पुढे सुरू)`,
          pages,
          session,
          reportLabel,
          options.accentColor
        );
      }
      target = next;
    }

    let x = MARGIN_X;
    for (let i = 0; i < columns.length; i++) {
      const w = colWidths[i];
      target.ctx.fillStyle = '#f1f5f9';
      target.ctx.fillRect(x, target.y, w, headerH);
      target.ctx.strokeStyle = '#94a3b8';
      target.ctx.lineWidth = 0.75;
      target.ctx.strokeRect(x, target.y, w, headerH);

      target.ctx.fillStyle = '#0f172a';
      target.ctx.font = `700 ${headerFontSize}px ${FONT_FAMILY}`;
      const lines = wrappedHeaders[i];
      lines.forEach((line, li) => {
        const align = columns[i].align || 'left';
        target.ctx.textAlign = align;
        const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - padX : x + padX;
        target.ctx.fillText(line, tx, target.y + padY + li * headerLineHeight);
      });
      x += w;
    }
    target.y += headerH;
    return target;
  };

  let colWidths = computeColWidths(active.logicalW);
  active = renderTableHeader(active, colWidths);

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    active.ctx.font = `400 ${fontSize}px ${FONT_FAMILY}`;
    const wrappedCells = columns.map((_, cIdx) =>
      wrapCellText(active.ctx, row[cIdx] ?? '-', Math.max(20, colWidths[cIdx] - padX * 2))
    );
    const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
    const rowH = maxLines * lineHeight + padY * 2;

    if (active.y + rowH > active.logicalH - MARGIN_BOTTOM) {
      const next = createSurface(active.orientation);
      pages.push(next);
      drawRunningHeader(next, session, reportLabel);
      if (options.repeatBannerTitle) {
        drawSectionBanner(
          next,
          `${options.repeatBannerTitle} (पुढे सुरू)`,
          pages,
          session,
          reportLabel,
          options.accentColor
        );
      }
      colWidths = computeColWidths(next.logicalW);
      active = renderTableHeader(next, colWidths);
    }

    let x = MARGIN_X;
    const isAlt = rIdx % 2 === 1;
    for (let cIdx = 0; cIdx < columns.length; cIdx++) {
      const w = colWidths[cIdx];
      active.ctx.fillStyle = isAlt ? '#f8fafc' : '#ffffff';
      active.ctx.fillRect(x, active.y, w, rowH);
      active.ctx.strokeStyle = '#cbd5e1';
      active.ctx.lineWidth = 0.65;
      active.ctx.strokeRect(x, active.y, w, rowH);

      active.ctx.fillStyle = '#0f172a';
      active.ctx.font = `${cIdx <= 1 ? '600' : '400'} ${fontSize}px ${FONT_FAMILY}`;
      const align = columns[cIdx].align || 'left';
      active.ctx.textAlign = align;
      const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - padX : x + padX;
      wrappedCells[cIdx].forEach((line, li) => {
        active.ctx.fillText(line, tx, active.y + padY + li * lineHeight);
      });
      x += w;
    }
    active.y += rowH;
  }

  active.y += 10;
  return active;
}

async function ensureDevanagariFontsLoaded() {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.load(`400 12px "Noto Sans Devanagari"`);
      await document.fonts.load(`700 14px "Noto Sans Devanagari"`);
      await document.fonts.ready;
    } catch {
      // Proceed cleanly
    }
  }
}

function finalizePagesToPDFBlob(
  pages: PageSurface[],
  session: VaccinationSession,
  generatedAtIST: string,
  footerLabel: string
): Blob {
  const totalPages = pages.length;
  pages.forEach((pg, idx) => {
    const { ctx, logicalW, logicalH } = pg;
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, logicalH - 30);
    ctx.lineTo(logicalW - MARGIN_X, logicalH - 30);
    ctx.stroke();

    ctx.font = `500 8.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText(
      `प्राथमिक आरोग्य केंद्र भादा · ${footerLabel} · सत्र ${session.sessionCode} · निर्मिती: ${generatedAtIST}`,
      MARGIN_X,
      logicalH - 22
    );
    ctx.textAlign = 'right';
    ctx.font = `700 9px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`पृष्ठ ${idx + 1} / ${totalPages}`, logicalW - MARGIN_X, logicalH - 22);
    ctx.restore();
  });

  const first = pages[0];
  const doc = new jsPDF({
    orientation: first.orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((pg, idx) => {
    if (idx > 0) {
      doc.addPage('a4', pg.orientation);
    }
    const mmW = pg.orientation === 'portrait' ? 210 : 297;
    const mmH = pg.orientation === 'portrait' ? 297 : 210;
    const imgData = pg.canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, mmW, mmH, undefined, 'FAST');
  });

  return doc.output('blob');
}

function drawSignatureFooterPage(
  pages: PageSurface[],
  session: VaccinationSession,
  generatedAtIST: string,
  preparedBy: string,
  reportLabel: string,
  accentColor = '#0f766e'
) {
  let fPage = createSurface('portrait');
  pages.push(fPage);
  drawRunningHeader(fPage, session, reportLabel);
  fPage = drawSectionBanner(
    fPage,
    'इ. अहवाल प्रमाणन व स्वाक्षरी (Report Footer & Signatures)',
    pages,
    session,
    reportLabel,
    accentColor
  );

  const { ctx, logicalW } = fPage;
  const boxW = logicalW - MARGIN_X * 2;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(MARGIN_X, fPage.y, boxW, 74);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 0.85;
  ctx.strokeRect(MARGIN_X, fPage.y, boxW, 74);

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  ctx.font = `600 10px ${FONT_FAMILY}`;
  ctx.fillText(`अहवाल निर्मिती दिनांक व वेळ (IST): ${generatedAtIST}`, MARGIN_X + 12, fPage.y + 12);
  ctx.fillText(`अहवाल तयार करणारे: ${preparedBy}`, MARGIN_X + 12, fPage.y + 32);
  ctx.font = `400 9px ${FONT_FAMILY}`;
  ctx.fillStyle = '#475569';
  ctx.fillText(
    'टीप: गोपनीयतेसाठी सर्व आधार क्रमांक अहवालात संरक्षित (XXXX-XXXX-1234) स्वरूपात प्रदर्शित केले आहेत.',
    MARGIN_X + 12,
    fPage.y + 52
  );
  fPage.y += 104;

  const gap = 18;
  const sigW = (boxW - gap * 2) / 3;
  const sigTitles = ['ANM स्वाक्षरी व नाव', 'CHO स्वाक्षरी व नाव', 'वैद्यकीय अधिकारी स्वाक्षरी व शिक्का'];
  const sigNames = [session.anmName || '', session.choName || '', 'प्राथमिक आरोग्य केंद्र भादा'];

  sigTitles.forEach((title, idx) => {
    const sx = MARGIN_X + idx * (sigW + gap);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.85;
    ctx.strokeRect(sx, fPage.y, sigW, 96);

    ctx.beginPath();
    ctx.moveTo(sx + 14, fPage.y + 60);
    ctx.lineTo(sx + sigW - 14, fPage.y + 60);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 9.5px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, sx + sigW / 2, fPage.y + 67);

    ctx.fillStyle = '#475569';
    ctx.font = `400 8.5px ${FONT_FAMILY}`;
    ctx.fillText(sigNames[idx], sx + sigW / 2, fPage.y + 81);
  });
}

// ==================== A. CHILD VACCINATION SESSION PDF ====================

export async function generateDetailedSessionPDFBlob(
  report: DetailedSessionReportData
): Promise<Blob> {
  await ensureDevanagariFontsLoaded();

  const { session, summary, beneficiaryRows, vaccineDoseCounts } = report;
  const reportLabel = 'बालक लसीकरण सत्र अहवाल';
  const pages: PageSurface[] = [];

  // Page 1: Portrait Title + Session Details + Child Summary + Vaccine Breakdown
  let pPage = createSurface('portrait');
  pages.push(pPage);

  {
    const { ctx, logicalW } = pPage;
    const boxW = logicalW - MARGIN_X * 2;
    ctx.fillStyle = '#f0fdfa';
    ctx.fillRect(MARGIN_X, pPage.y, boxW, 64);
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(MARGIN_X, pPage.y, boxW, 64);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f766e';
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText('प्राथमिक आरोग्य केंद्र भादा', logicalW / 2, pPage.y + 11);

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 13.5px ${FONT_FAMILY}`;
    ctx.fillText('बालक लसीकरण सत्राचा सविस्तर अहवाल', logicalW / 2, pPage.y + 36);

    ctx.fillStyle = '#475569';
    ctx.font = `500 9.5px ${FONT_FAMILY}`;
    ctx.fillText(
      `सत्र कोड: ${session.sessionCode} · दिनांक: ${formatDDMMYYYY(session.sessionDate)} · स्थिती: ${session.status}`,
      logicalW / 2,
      pPage.y + 52
    );
    pPage.y += 76;
  }

  pPage = drawSectionBanner(pPage, 'अ. लसीकरण सत्राचा तपशील (Session Details)', pages, session, reportLabel);
  pPage = drawPaginatedTable(
    pPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'तपशील', widthWeight: 22 },
      { header: 'नोंदवलेली माहिती', widthWeight: 28 },
      { header: 'तपशील', widthWeight: 22 },
      { header: 'नोंदवलेली माहिती', widthWeight: 28 },
    ],
    [
      ['प्राथमिक आरोग्य केंद्र', session.phcName || 'प्राथमिक आरोग्य केंद्र भादा', 'सत्र कोड', session.sessionCode],
      ['उपकेंद्र', session.subcentreName, 'गाव', session.villageName],
      ['सत्र दिनांक', formatDDMMYYYY(session.sessionDate), 'सत्र ठिकाण', session.location],
      ['सत्र प्रकार', session.sessionType, 'सत्राची स्थिती', session.status],
      ['CHO नाव', session.choName || '-', 'ANM नाव', session.anmName || '-'],
      [
        'इतर कर्मचारी',
        session.otherStaff || '-',
        'सत्र पूर्ण वेळ',
        session.completedAt ? formatDateTimeIST(session.completedAt) : 'प्रगतीपथावर',
      ],
    ],
    { fontSize: 9.5, headerFontSize: 9.5, repeatBannerTitle: 'अ. लसीकरण सत्राचा तपशील' }
  );

  pPage = drawSectionBanner(pPage, 'ड. बालक लसीकरण सत्र सारांश (Session Summary)', pages, session, reportLabel);
  pPage = drawPaginatedTable(
    pPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'सारांश घटक', widthWeight: 70 },
      { header: 'संख्या', widthWeight: 30, align: 'right' },
    ],
    [
      ['सत्रात समाविष्ट एकूण बालक लाभार्थी', formatNumberIN(summary.totalBeneficiaries)],
      ['नवीन नोंदणीकृत बालके (आजच्या सत्रात)', formatNumberIN(summary.newBeneficiaries)],
      ['मागील नोंदणीकृत बालके (सत्रात समाविष्ट)', formatNumberIN(summary.existingBeneficiaries)],
      ['आज लसीकरण झालेली बालके', formatNumberIN(summary.vaccinatedCount)],
      ['आज लसीकरण न झालेली बालके', formatNumberIN(summary.unvaccinatedCount)],
      ['आज दिलेले एकूण लस डोस', formatNumberIN(summary.totalDosesToday)],
      ['अद्याप देय राहिलेले डोस (दिलेले नाहीत)', formatNumberIN(summary.dueRemainingCount)],
    ],
    { fontSize: 9.5, headerFontSize: 9.5, repeatBannerTitle: 'ड. बालक लसीकरण सत्र सारांश' }
  );

  pPage = drawSectionBanner(pPage, 'लस व डोसनिहाय गोषवारा (Vaccine-Wise Summary)', pages, session, reportLabel);
  pPage = drawPaginatedTable(
    pPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'अ.क्र.', widthWeight: 10, align: 'center' },
      { header: 'लसीचे नाव', widthWeight: 40 },
      { header: 'डोस', widthWeight: 30 },
      { header: 'दिलेल्या मात्रा', widthWeight: 20, align: 'right' },
    ],
    vaccineDoseCounts.length > 0
      ? vaccineDoseCounts.map((v, i) => [
          String(i + 1),
          v.vaccineName,
          v.doseName,
          formatNumberIN(v.count),
        ])
      : [['-', 'आजच्या सत्रात कोणतीही बालक लस दिलेली नाही', '-', '0']],
    { fontSize: 9.5, headerFontSize: 9.5, repeatBannerTitle: 'लस व डोसनिहाय गोषवारा' }
  );

  // Landscape: Child Beneficiaries & Vaccination Services
  let lPage = createSurface('landscape');
  pages.push(lPage);
  drawRunningHeader(lPage, session, reportLabel);

  lPage = drawSectionBanner(
    lPage,
    'ब. सत्रातील सर्व बालक लाभार्थ्यांचा कायमस्वरूपी तपशील (Child Beneficiaries)',
    pages,
    session,
    reportLabel
  );
  lPage = drawPaginatedTable(
    lPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'अ.क्र.', widthWeight: 4, align: 'center' },
      { header: 'लाभार्थी आयडी', widthWeight: 11 },
      { header: 'बालकाचे पूर्ण नाव', widthWeight: 13 },
      { header: 'पालक / आईचे नाव', widthWeight: 13 },
      { header: 'जन्मतारीख / वय', widthWeight: 12 },
      { header: 'लिंग', widthWeight: 6, align: 'center' },
      { header: 'जात / प्रवर्ग', widthWeight: 10 },
      { header: 'आधार (Masked)', widthWeight: 11 },
      { header: 'गाव व मोबाईल', widthWeight: 11 },
      { header: 'नोंदणी', widthWeight: 9 },
    ],
    beneficiaryRows.length > 0
      ? beneficiaryRows.map((r) => [
          String(r.serialNo),
          r.beneficiary.beneficiaryCode,
          r.beneficiary.childName,
          `${r.beneficiary.guardianName || r.beneficiary.fatherName || '-'}\nआई: ${r.beneficiary.motherName || '-'}`,
          `${formatDDMMYYYY(r.beneficiary.dob)}\n(${r.ageOnSessionDate})`,
          r.beneficiary.gender,
          `${r.beneficiary.caste || '-'}\n${r.beneficiary.category || '-'}`,
          r.maskedAadhaar,
          `${r.beneficiary.villageName}\n${r.beneficiary.mobile || '-'}`,
          r.enrollmentLabel,
        ])
      : [['-', '-', 'या सत्रात कोणताही बालक लाभार्थी समाविष्ट नाही', '-', '-', '-', '-', '-', '-', '-']],
    {
      fontSize: 8.5,
      headerFontSize: 8.8,
      repeatBannerTitle: 'ब. सत्रातील बालक लाभार्थ्यांचा तपशील',
    }
  );

  if (lPage.y + 90 > lPage.logicalH - MARGIN_BOTTOM) {
    lPage = createSurface('landscape');
    pages.push(lPage);
    drawRunningHeader(lPage, session, reportLabel);
  }

  lPage = drawSectionBanner(
    lPage,
    'क. आज दिलेले लसीकरण व मागील/प्रलंबित डोस तपशील (Vaccination Services)',
    pages,
    session,
    reportLabel
  );
  lPage = drawPaginatedTable(
    lPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'अ.क्र.', widthWeight: 5, align: 'center' },
      { header: 'बालकाचे नाव व आयडी', widthWeight: 16 },
      { header: 'आज दिलेल्या लसी (लस, डोस, दिनांक, बॅच, कर्मचारी)', widthWeight: 32 },
      { header: 'देय परंतु आज न दिलेल्या लसी', widthWeight: 17 },
      { header: 'अद्याप देय नसलेल्या लसी', widthWeight: 15 },
      { header: 'मागील लसीकरण इतिहास / शेरा', widthWeight: 15 },
    ],
    beneficiaryRows.length > 0
      ? beneficiaryRows.map((r) => [
          String(r.serialNo),
          `${r.beneficiary.childName}\n${r.beneficiary.beneficiaryCode}`,
          r.todayDoses.length === 0
            ? 'आज लसीकरण दिलेले नाही'
            : r.todayDoses
                .map(
                  (d) =>
                    `• ${d.vaccineName} (${d.doseName}) — दि. ${formatDDMMYYYY(d.administeredDate)}${
                      d.batchNumber ? `, बॅच: ${d.batchNumber}` : ''
                    } | ${d.staffName || '-'}`
                )
                .join('\n'),
          r.dueNotAdministered.length === 0
            ? 'कोणतीही नाही'
            : r.dueNotAdministered.map((d) => `${d.schedule.vaccineName} (${d.schedule.doseName})`).join(', '),
          r.notDueDoses.length === 0
            ? 'कोणतीही नाही'
            : r.notDueDoses.map((d) => d.schedule.doseName).join(', '),
          [
            r.previousDoses.length > 0
              ? `मागील: ${r.previousDoses.map((p) => `${p.doseName} (${formatDDMMYYYY(p.administeredDate)})`).join(', ')}`
              : 'मागील लस नाही',
            r.remarks ? `शेरा: ${r.remarks}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        ])
      : [['-', '-', 'बालक लसीकरण सेवा नोंद उपलब्ध नाही', '-', '-', '-']],
    {
      fontSize: 8.5,
      headerFontSize: 9,
      repeatBannerTitle: 'क. आज दिलेले लसीकरण तपशील',
    }
  );

  drawSignatureFooterPage(pages, session, report.generatedAtIST, report.preparedBy, reportLabel);
  return finalizePagesToPDFBlob(pages, session, report.generatedAtIST, 'बालक लसीकरण अहवाल');
}

export async function downloadDetailedSessionPDF(report: DetailedSessionReportData): Promise<void> {
  const blob = await generateDetailedSessionPDFBlob(report);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PHC_Bhada_Child_Session_Report_${report.session.sessionCode}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ==================== B. PREGNANT WOMAN ANC SESSION PDF ====================

export async function generateMaternalSessionPDFBlob(
  report: DetailedMaternalSessionReportData
): Promise<Blob> {
  await ensureDevanagariFontsLoaded();

  const { session, summary, womanRows, serviceCounts } = report;
  const reportLabel = 'गरोदर माता ANC सत्र अहवाल';
  const accent = '#0f766e';
  const pages: PageSurface[] = [];

  // Page 1: Portrait Title + Session Details + ANC Summary + Service Counts
  let pPage = createSurface('portrait');
  pages.push(pPage);

  {
    const { ctx, logicalW } = pPage;
    const boxW = logicalW - MARGIN_X * 2;
    ctx.fillStyle = '#f0fdfa';
    ctx.fillRect(MARGIN_X, pPage.y, boxW, 64);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(MARGIN_X, pPage.y, boxW, 64);

    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText('प्राथमिक आरोग्य केंद्र भादा', logicalW / 2, pPage.y + 11);

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 13.5px ${FONT_FAMILY}`;
    ctx.fillText('गरोदर माता ANC व लसीकरण सत्राचा सविस्तर अहवाल', logicalW / 2, pPage.y + 36);

    ctx.fillStyle = '#475569';
    ctx.font = `500 9.5px ${FONT_FAMILY}`;
    ctx.fillText(
      `सत्र कोड: ${session.sessionCode} · दिनांक: ${formatDDMMYYYY(session.sessionDate)} · स्थिती: ${session.status}`,
      logicalW / 2,
      pPage.y + 52
    );
    pPage.y += 76;
  }

  pPage = drawSectionBanner(pPage, 'अ. सत्राचा तपशील (Session Details)', pages, session, reportLabel, accent);
  pPage = drawPaginatedTable(
    pPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'तपशील', widthWeight: 22 },
      { header: 'नोंदवलेली माहिती', widthWeight: 28 },
      { header: 'तपशील', widthWeight: 22 },
      { header: 'नोंदवलेली माहिती', widthWeight: 28 },
    ],
    [
      ['प्राथमिक आरोग्य केंद्र', session.phcName || 'प्राथमिक आरोग्य केंद्र भादा', 'सत्र कोड', session.sessionCode],
      ['उपकेंद्र', session.subcentreName, 'गाव', session.villageName],
      ['सत्र दिनांक', formatDDMMYYYY(session.sessionDate), 'सत्र ठिकाण', session.location],
      ['CHO नाव', session.choName || '-', 'ANM नाव', session.anmName || '-'],
    ],
    { fontSize: 9.5, headerFontSize: 9.5, repeatBannerTitle: 'अ. सत्राचा तपशील', accentColor: accent }
  );

  pPage = drawSectionBanner(pPage, 'ड. गरोदर माता ANC सत्र सारांश (Session Summary)', pages, session, reportLabel, accent);
  pPage = drawPaginatedTable(
    pPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'सारांश घटक', widthWeight: 70 },
      { header: 'संख्या', widthWeight: 30, align: 'right' },
    ],
    [
      ['सत्रात समाविष्ट एकूण गरोदर माता', formatNumberIN(summary.totalWomen)],
      ['नवीन नोंदणीकृत गरोदर माता', formatNumberIN(summary.newWomen)],
      ['मागील नोंदणीकृत गरोदर माता', formatNumberIN(summary.existingWomen)],
      ['आज ANC / लसीकरण सेवा दिलेल्या माता', formatNumberIN(summary.servedCount)],
      ['आज सेवा न नोंदवलेल्या माता', formatNumberIN(summary.unservedCount)],
      ['आज नोंदवलेल्या एकूण ANC सेवा', formatNumberIN(summary.totalServicesToday)],
    ],
    { fontSize: 9.5, headerFontSize: 9.5, repeatBannerTitle: 'ड. गरोदर माता ANC सत्र सारांश', accentColor: accent }
  );

  pPage = drawSectionBanner(pPage, 'ANC सेवानिहाय गोषवारा (Service Summary)', pages, session, reportLabel, accent);
  pPage = drawPaginatedTable(
    pPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'अ.क्र.', widthWeight: 10, align: 'center' },
      { header: 'ANC सेवेचे नाव', widthWeight: 70 },
      { header: 'एकूण लाभार्थी संख्या', widthWeight: 20, align: 'right' },
    ],
    serviceCounts.length > 0
      ? serviceCounts.map((s, i) => [String(i + 1), s.serviceName, formatNumberIN(s.count)])
      : [['-', 'आजच्या सत्रात कोणतीही ANC सेवा नोंदवलेली नाही', '0']],
    { fontSize: 9.5, headerFontSize: 9.5, repeatBannerTitle: 'ANC सेवानिहाय गोषवारा', accentColor: accent }
  );

  // Landscape: Pregnant Women Permanent + Pregnancy Episode Details + Services Provided
  let lPage = createSurface('landscape');
  pages.push(lPage);
  drawRunningHeader(lPage, session, reportLabel);

  lPage = drawSectionBanner(
    lPage,
    'ब. सत्रातील गरोदर माता व गर्भधारणा प्रकरण तपशील (Pregnant Women & Pregnancy Episodes)',
    pages,
    session,
    reportLabel,
    accent
  );
  lPage = drawPaginatedTable(
    lPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'अ.क्र.', widthWeight: 4, align: 'center' },
      { header: 'माता आयडी', widthWeight: 11 },
      { header: 'मातेचे पूर्ण नाव व पतीचे नाव', widthWeight: 15 },
      { header: 'मोबाईल व आधार (Masked)', widthWeight: 13 },
      { header: 'जात / प्रवर्ग व गाव', widthWeight: 12 },
      { header: 'गर्भधारणा आयडी', widthWeight: 11 },
      { header: 'MC दिनांक व आठवडे', widthWeight: 11 },
      { header: 'EDD (अपेक्षित प्रसूती)', widthWeight: 9 },
      { header: 'प्रसूती ठिकाण व संस्था', widthWeight: 14 },
    ],
    womanRows.length > 0
      ? womanRows.map((r) => [
          String(r.serialNo),
          `${r.beneficiary.beneficiaryCode}\n(${r.enrollmentLabel})`,
          `${r.beneficiary.childName}\nपती: ${r.beneficiary.guardianName || r.beneficiary.fatherName || '-'}`,
          `${r.beneficiary.mobile || '-'}\n${r.maskedAadhaar}`,
          `${r.beneficiary.caste || '-'} (${r.beneficiary.category || '-'})\n${r.beneficiary.villageName}`,
          r.episode?.episodeCode || '-',
          r.episode?.mcDate
            ? `${formatDDMMYYYY(r.episode.mcDate)}\n(${r.gestationalAgeOnSession})`
            : '-',
          r.episode?.eddDate ? formatDDMMYYYY(r.episode.eddDate) : '-',
          r.episode
            ? `${r.episode.expectedDeliveryPlace || '-'}\n${formatDeliveryFacilityTypeMarathi(
                r.episode.deliveryFacilityType
              )}${r.episode.hospitalName ? `: ${r.episode.hospitalName}` : ''}`
            : '-',
        ])
      : [['-', '-', 'या सत्रात कोणतीही गरोदर माता समाविष्ट नाही', '-', '-', '-', '-', '-', '-']],
    {
      fontSize: 8.3,
      headerFontSize: 8.8,
      repeatBannerTitle: 'ब. सत्रातील गरोदर माता तपशील',
      accentColor: accent,
    }
  );

  if (lPage.y + 90 > lPage.logicalH - MARGIN_BOTTOM) {
    lPage = createSurface('landscape');
    pages.push(lPage);
    drawRunningHeader(lPage, session, reportLabel);
  }

  lPage = drawSectionBanner(
    lPage,
    'क. आज दिलेल्या ANC / लसीकरण सेवा व प्रलंबित सेवा तपशील (ANC Services)',
    pages,
    session,
    reportLabel,
    accent
  );
  lPage = drawPaginatedTable(
    lPage,
    pages,
    session,
    reportLabel,
    [
      { header: 'अ.क्र.', widthWeight: 5, align: 'center' },
      { header: 'मातेचे नाव व गर्भधारणा आयडी', widthWeight: 18 },
      { header: 'आज प्रत्यक्ष दिलेल्या ANC व लसीकरण सेवा', widthWeight: 33 },
      { header: 'आज न नोंदवलेल्या / अपेक्षित सेवा', widthWeight: 22 },
      { header: 'मागील ANC भेटी इतिहास / शेरा', widthWeight: 22 },
    ],
    womanRows.length > 0
      ? womanRows.map((r) => [
          String(r.serialNo),
          `${r.beneficiary.childName}\n${r.beneficiary.beneficiaryCode}\n(${r.episode?.episodeCode || '-'})`,
          r.todayServices.length === 0
            ? 'आज कोणतीही ANC सेवा नोंदवलेली नाही'
            : r.todayServices
                .map(
                  (s) =>
                    `• ${s.serviceName}${s.serviceValue ? `: ${s.serviceValue}` : ''}${
                      s.batchNumber ? ` [बॅच: ${s.batchNumber}]` : ''
                    } (${s.staffName || '-'})`
                )
                .join('\n'),
          r.pendingCatalogServices.length === 0
            ? 'सर्व सक्रिय सेवा पूर्ण'
            : r.pendingCatalogServices.map((p) => p.serviceName).join(', '),
          [
            r.previousServices.length > 0
              ? `मागील: ${r.previousServices
                  .slice(0, 6)
                  .map(
                    (p) =>
                      `${p.serviceName}${p.serviceValue ? ` (${p.serviceValue})` : ''} [${formatDDMMYYYY(
                        p.visitDate
                      )}]`
                  )
                  .join(', ')}`
              : 'मागील ANC भेट नाही',
            r.remarks ? `शेरा: ${r.remarks}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        ])
      : [['-', '-', 'गरोदर माता ANC सेवा नोंद उपलब्ध नाही', '-', '-']],
    {
      fontSize: 8.4,
      headerFontSize: 8.8,
      repeatBannerTitle: 'क. आज दिलेल्या ANC व लसीकरण सेवा',
      accentColor: accent,
    }
  );

  drawSignatureFooterPage(pages, session, report.generatedAtIST, report.preparedBy, reportLabel, accent);
  return finalizePagesToPDFBlob(pages, session, report.generatedAtIST, 'गरोदर माता ANC अहवाल');
}

export async function downloadMaternalSessionPDF(
  report: DetailedMaternalSessionReportData
): Promise<void> {
  const blob = await generateMaternalSessionPDFBlob(report);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PHC_Bhada_Maternal_ANC_Report_${report.session.sessionCode}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
