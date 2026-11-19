export type UserRole =
  | 'ADMIN'
  | 'MEDICAL_OFFICER'
  | 'DATA_OPERATOR'
  | 'CHO'
  | 'ANM';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  subcentreId?: string;
  subcentreName?: string;
  isActive: boolean;
  createdAt: string; // ISO string
}

export interface Subcentre {
  id: string;
  code: string;
  name: string;
  phcName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Village {
  id: string;
  villageCode: string;
  name: string;
  subcentreId: string;
  subcentreName: string;
  population?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StaffDesignation =
  | 'CHO'
  | 'ANM'
  | 'MPW'
  | 'ASHA'
  | 'MEDICAL_OFFICER'
  | 'DATA_OPERATOR'
  | 'OTHER';

export interface StaffMember {
  id: string;
  name: string;
  designation: StaffDesignation;
  subcentreId: string;
  subcentreName: string;
  mobile: string;
  linkedUserEmail?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BeneficiaryType = 'CHILD' | 'PREGNANT_WOMAN';
export type BeneficiaryGender = 'मुलगा' | 'मुलगी' | 'स्त्री' | 'इतर';
export type BeneficiaryStatus = 'सक्रिय' | 'स्थलांतरित' | 'पूर्ण' | 'निष्क्रिय';

export interface Beneficiary {
  id: string;
  beneficiaryCode: string; // e.g., PHCB-BEN-2026-0001 or PHCB-PW-2026-0001
  beneficiaryType: BeneficiaryType;
  childName: string; // Permanent Full Name (Child Full Name or Woman Full Name Marathi)
  fullNameEnglish?: string; // Woman Full Name in English
  motherName: string;
  fatherName: string;
  guardianName?: string; // Parent/Guardian Name (Child) or Husband Name (Pregnant Woman)
  husbandMobile?: string;
  dob: string; // ISO YYYY-MM-DD (required for Child, optional for Pregnant Woman)
  gender: BeneficiaryGender;
  mobile: string;
  aadhaarNumber?: string; // Optional 12-digit Aadhaar (masked in ordinary UI & PDF reports)
  caste?: string;
  category?: string;
  bloodGroup?: string;
  rhFactor?: string;
  plannedDeliveryPlace?: string;
  plannedHospitalName?: string;
  address: string;
  subcentreId: string;
  subcentreName: string;
  villageId: string;
  villageName: string;
  anganwadi?: string;
  registrationDate: string; // ISO YYYY-MM-DD
  status: BeneficiaryStatus;
  dedupeKey: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryFacilityType = 'Government' | 'Private' | 'Other';
export type PregnancyStatus = 'सक्रिय' | 'प्रसूती पूर्ण' | 'संदर्भित' | 'बंद';

export interface EddHistoryEntry {
  previousEddDate: string;
  newEddDate: string;
  changedAt: string;
  changedBy: string;
  reason?: string;
}

export interface PregnancyEpisode {
  id: string;
  episodeCode: string; // e.g., PHCB-PRG-2026-0001
  beneficiaryId: string;
  beneficiaryCode: string;
  mcDate: string; // ISO YYYY-MM-DD (LMP / MC Date)
  eddDate: string; // ISO YYYY-MM-DD (Expected Delivery Date)
  expectedDeliveryPlace: string;
  deliveryFacilityType: DeliveryFacilityType;
  hospitalName: string;
  pregnancyRegistrationDate: string; // ISO YYYY-MM-DD
  pregnancyStatus: PregnancyStatus;
  gravidaPara?: string;
  gravida?: number | null;
  para?: number | null;
  abortions?: number | null;
  livingChildren?: number | null;
  previousPregnancyHistory?: string;
  previousCaesarean?: 'Yes' | 'No' | '';
  previousComplications?: string;
  bloodGroup?: string;
  rhFactor?: string;
  eddHistoryJson?: string;
  isHighRisk?: boolean;
  highRiskReasonsJson?: string;
  currentHrpStatus?: string;
  outcomeDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AncVisitRecord {
  id: string;
  visitNumber: number; // 1, 2, 3, 4, 5...
  visitLabel: string; // e.g., ANC-1, ANC-2, ANC-3, ANC-4, Extra ANC-5
  beneficiaryId: string;
  beneficiaryCode: string;
  pregnancyEpisodeId: string;
  episodeCode: string;
  sessionId?: string;
  subcentreId: string;
  subcentreName: string;
  villageId: string;
  villageName: string;
  visitDate: string; // ISO YYYY-MM-DD
  gestationalWeeks: number;
  gestationalDays: number;
  gestationalAgeText: string;
  weightKg?: string;
  heightCm?: string;
  bp?: string; // e.g., 120/80
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  hb?: string; // g/dL
  bloodSugar?: string; // mg/dL
  urineAlbumin?: string;
  urineSugar?: string;
  bloodTests?: string;
  otherTests?: string;
  doctorObservation?: string;
  treatmentAdvice?: string;
  nextVisitDate?: string;
  staffId: string;
  staffName: string;
  staffDesignation?: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HrpHistoryEntry {
  status: 'YES' | 'NO';
  reasons: string[];
  otherReasonText?: string;
  currentStatus: string;
  changedAt: string;
  changedBy: string;
  note?: string;
}

export interface HighRiskRecord {
  id: string;
  beneficiaryId: string;
  beneficiaryCode: string;
  pregnancyEpisodeId: string;
  episodeCode: string;
  isHighRisk: 'YES' | 'NO';
  identificationDate: string;
  reasonsJson: string; // JSON array of selected HRP reasons
  otherReasonText?: string;
  doctorAdvice?: string;
  treatmentInfo?: string;
  referralRequired?: 'Yes' | 'No' | '';
  referralDate?: string;
  referralHospital?: string;
  referralReason?: string;
  followUpDate?: string;
  followUpStatus?: string;
  currentStatus?: string; // e.g., 'निरीक्षणाखाली', 'संदर्भित', 'स्थिर', 'प्रसूती पूर्ण'
  statusHistoryJson?: string; // JSON array of HrpHistoryEntry
  approvedByMO?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaternalReferralRecord {
  id: string;
  beneficiaryId: string;
  beneficiaryCode: string;
  pregnancyEpisodeId: string;
  episodeCode: string;
  highRiskRecordId?: string;
  referralDate: string;
  referredFrom: string;
  referredToHospital: string;
  referralReason: string;
  transportArrangement?: string;
  followUpDate?: string;
  followUpStatus: 'प्रलंबित' | 'भेट पूर्ण' | 'दाखल' | 'बंद';
  outcomeNotes?: string;
  referredByStaff: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryTypeOption = 'Normal Delivery' | 'LSCS' | 'Assisted Delivery' | 'Other';
export type BabyBirthOutcome = 'Live Birth' | 'Stillbirth' | 'Other';

export interface DeliveryRecord {
  id: string;
  beneficiaryId: string;
  beneficiaryCode: string;
  pregnancyEpisodeId: string;
  episodeCode: string;
  plannedEddDate?: string;
  plannedDeliveryPlace?: string;
  plannedHospitalName?: string;
  deliveryPlanNotes?: string;
  referralRequiredBeforeDelivery?: 'Yes' | 'No' | '';
  actualDeliveryDate: string;
  actualDeliveryPlace: string;
  actualHospitalName?: string;
  deliveryType: DeliveryTypeOption;
  deliveryTypeOther?: string;
  numberOfBabies: number;
  motherCondition: string;
  deliveryComplications?: string;
  referralDetails?: string;
  attendedByStaff: string;
  isCompleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BabyRecord {
  id: string;
  babyCode: string; // e.g., PHCB-BABY-2026-0001
  motherBeneficiaryId: string;
  motherBeneficiaryCode: string;
  pregnancyEpisodeId: string;
  episodeCode: string;
  deliveryRecordId: string;
  babyNumber: number;
  babyName: string;
  gender: 'मुलगा' | 'मुलगी' | 'इतर';
  birthWeightGrams?: number | null;
  birthOutcome: BabyBirthOutcome;
  birthOutcomeOther?: string;
  babyCondition: string;
  dob: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PncRecord {
  id: string;
  visitNumber: number; // 1 = PNC-1, 2 = PNC-2, 3+ Extra
  visitLabel: string; // e.g., PNC-1, PNC-2, Extra PNC-3
  beneficiaryId: string;
  beneficiaryCode: string;
  pregnancyEpisodeId: string;
  episodeCode: string;
  deliveryRecordId?: string;
  pncDate: string; // ISO YYYY-MM-DD
  motherBp?: string;
  motherHealthStatus: string;
  bleedingStatus: string;
  breastfeedingStatus: string;
  babyWeightGrams?: number | null;
  babyHealthStatus: string;
  breastfeedingCounselling: 'Yes' | 'No' | '';
  treatmentGiven?: string;
  nextFollowUpDate?: string;
  staffId: string;
  staffName: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaternalServiceConfigItem {
  serviceCode: string;
  serviceName: string;
  inputType: 'CHECKBOX' | 'TEXT' | 'NUMBER';
  unit?: string;
  requiresBatchNumber?: boolean;
  repeatEveryVisit?: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface MaternalServiceRecord {
  id: string;
  sessionId: string;
  sessionDate: string;
  beneficiaryId: string;
  beneficiaryCode: string;
  pregnancyEpisodeId: string;
  episodeCode: string;
  subcentreId: string;
  villageId: string;
  visitDate: string; // ISO YYYY-MM-DD
  serviceCode: string;
  serviceName: string;
  serviceValue: string;
  batchNumber?: string;
  staffId: string;
  staffName: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus = 'नियोजित' | 'सुरू' | 'पूर्ण' | 'लॉक' | 'रद्द';
export type SessionType = 'नियमित' | 'विशेष';
export type SessionCategory = 'COMBINED' | 'CHILD' | 'PREGNANT_WOMAN';

export interface VaccinationSession {
  id: string;
  sessionCode: string; // e.g., PHCB-SES-20261118-001
  phcName: string;
  subcentreId: string;
  subcentreName: string;
  villageId: string;
  villageName: string;
  sessionDate: string; // ISO YYYY-MM-DD
  location: string;
  sessionType: SessionType;
  sessionCategory?: SessionCategory;
  choName: string;
  anmName: string;
  otherStaff?: string;
  status: SessionStatus;
  editDeadlineAt: string; // ISO timestamp (sessionDate + 2 days 23:59:59.999 IST)
  reopenedUntil?: string | null;
  reopenedBy?: string | null;
  reopenReason?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionBeneficiary {
  id: string; // `${sessionId}_${beneficiaryId}`
  sessionId: string;
  beneficiaryId: string;
  beneficiaryCode: string;
  beneficiaryType?: BeneficiaryType;
  pregnancyEpisodeId?: string;
  childName: string;
  dob: string;
  gender: BeneficiaryGender;
  subcentreId: string;
  villageId: string;
  addedBy: string;
  addedAt: string;
  enrollmentType?: 'NEW' | 'EXISTING';
  remarks?: string;
}

export type ApplicableCategory = 'Child' | 'Pregnant_Woman' | 'Adolescent' | 'All';

export interface VaccineMaster {
  id: string;
  vaccineName: string;
  shortCode: string;
  applicableCategory: ApplicableCategory;
  requiresBatchNumber: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AgeUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

export interface VaccineSchedule {
  id: string;
  vaccineId: string;
  vaccineName: string;
  doseName: string;
  doseOrder: number;
  previousDoseId?: string | null;
  minAgeValue: number;
  minAgeUnit: AgeUnit;
  recommendedAgeValue: number;
  recommendedAgeUnit: AgeUnit;
  maxAgeValue?: number | null;
  maxAgeUnit?: AgeUnit | null;
  minIntervalDays?: number | null;
  recommendedDueRuleText: string;
  isBooster: boolean;
  boosterInfo?: string;
  applicableCategory: ApplicableCategory;
  isValidated: boolean;
  validatedBy?: string;
  validatedAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VaccinationRecord {
  id: string; // `${beneficiaryId}_${scheduleId}`
  beneficiaryId: string;
  beneficiaryCode: string;
  sessionId: string;
  sessionDate: string;
  subcentreId: string;
  villageId: string;
  vaccineId: string;
  vaccineName: string;
  scheduleId: string;
  doseName: string;
  administeredDate: string;
  batchNumber?: string;
  staffId: string;
  staffName: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditEntityType =
  | 'BENEFICIARY'
  | 'PREGNANCY_EPISODE'
  | 'ANC_VISIT'
  | 'HIGH_RISK'
  | 'REFERRAL'
  | 'DELIVERY'
  | 'BABY'
  | 'PNC'
  | 'SESSION'
  | 'VACCINATION'
  | 'MATERNAL_SERVICE'
  | 'RI_CHECKLIST'
  | 'SUBCENTRE'
  | 'VILLAGE'
  | 'STAFF'
  | 'VACCINE_MASTER'
  | 'VACCINE_SCHEDULE'
  | 'USER'
  | 'SETTINGS'
  | 'SHEET_IMPORT';

export interface RiVaccineStatusEntry {
  availability: 'NA' | 'No' | 'Inadequate' | 'Adequate' | '';
  openVialReissued?: 'Yes' | 'No' | '';
}

export type RiLogisticAvailability = 'No' | 'Inadequate' | 'Adequate' | '';

export interface RiChecklist {
  id: string;
  checklistCode: string; // e.g., PHCB-RI-20261117-001
  sessionId?: string;
  sessionCode?: string;
  checklistStaffName: string;
  monitorName: string;
  organization: 'WHO' | 'Govt' | 'UNICEF' | 'IPE' | 'Others';
  organizationOther?: string;
  designation: string;
  monitoringDate: string; // ISO YYYY-MM-DD
  state: string;
  district: string;
  blockUlb: string;
  planningUnit: string;
  setting: 'Rural' | 'Urban';
  subcentreId: string;
  subcentreName: string;
  villageId: string;
  sessionSiteName: string;
  monitoringReasons: string[];
  monitoringReasonOther?: string;
  hraType: string;
  sessionSiteLocation:
    | 'Distt. Hospital'
    | 'CHC'
    | 'PHC'
    | 'Sub Centre'
    | 'ICDS Centre'
    | 'Others';
  sessionSiteLocationOther?: string;
  // Q1
  isSessionHeld: 'Yes' | 'No';
  sessionNotHeldReason?: string;
  sessionNotHeldReasonOther?: string;
  // Q2-Q7
  dueListAvailable: 'No list' | 'List not updated' | 'Updated list' | '';
  mobilizersAssigned: string[];
  dueListWithMobiliser: 'Yes' | 'No' | 'Not Observed' | 'Not Applicable' | '';
  mobilizerMobilizing: 'Yes' | 'No' | 'Not Applicable' | '';
  polioHraTagged: 'Yes' | 'No' | 'Not Applicable' | '';
  vaccineDeliveredBy: 'ANM' | 'AVD' | 'Teeka Express' | 'Others' | '';
  vaccineCarrierName: string;
  // Q8 & Q9
  vaccines: Record<string, RiVaccineStatusEntry>;
  logistics: Record<string, RiLogisticAvailability>;
  // Q10-Q15
  cuttingWithHubCutter: 'Yes' | 'No' | 'Not Observed' | '';
  hubCutterNoReason?: string;
  markingVialsDateTime: 'Yes' | 'No' | '';
  reconstitutedVialAfterLapsed: string[];
  delivering4KeyMessages: 'Yes' | 'No' | 'Not Observed' | '';
  advisingWait30Mins: 'Yes' | 'No' | 'Not Observed' | '';
  caregiverInterviewNotObserved: boolean;
  caregiver1Mobilizer: string[];
  caregiver2Mobilizer: string[];
  caregiver3Mobilizer: string[];
  // Q16-Q20
  minAge2ndMeasles: '9-12m' | '16-24m' | 'any other age' | '';
  mctsRegisterMaintained: 'Yes' | 'No' | 'Not Observed' | '';
  supervisorVisitedToday: 'Health Supervisor' | 'MO' | 'None' | 'Others' | '';
  supervisorVisitedOther?: string;
  ashaPaymentPreviousSession: 'Yes' | 'No' | 'Not applicable' | '';
  ashaPaymentFI: 'Yes' | 'No' | 'Partial' | 'NA' | '';
  ashaPaymentCI: 'Yes' | 'No' | 'Partial' | 'NA' | '';
  // Q21-Q22
  vaccineNotAvailableReason: 'Stock out' | 'No AVD' | 'Others' | '';
  vaccineNotAvailableOther?: string;
  anmAbsentReason: 'Post got vacant' | 'On leave' | 'Others' | '';
  anmAbsentOther?: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: AuditEntityType;
  recordId: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason?: string;
  createdAt: string;
}

export interface SystemSettings {
  id: string; // 'phc_bhada_config'
  phcName: string;
  district: string;
  state: string;
  timezone: 'Asia/Kolkata';
  allowEditDaysAfterSession: number;
  maternalServiceCatalogJson?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface SheetDatabase {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  users: AppUser[];
  subcentres: Subcentre[];
  villages: Village[];
  staff: StaffMember[];
  beneficiaries: Beneficiary[];
  pregnancyEpisodes: PregnancyEpisode[];
  ancVisits: AncVisitRecord[];
  highRiskRecords: HighRiskRecord[];
  maternalReferrals: MaternalReferralRecord[];
  deliveryRecords: DeliveryRecord[];
  babyRecords: BabyRecord[];
  pncRecords: PncRecord[];
  vaccinationSessions: VaccinationSession[];
  sessionBeneficiaries: SessionBeneficiary[];
  vaccineMaster: VaccineMaster[];
  vaccineSchedule: VaccineSchedule[];
  vaccinationRecords: VaccinationRecord[];
  maternalServiceRecords: MaternalServiceRecord[];
  riChecklists: RiChecklist[];
  auditLogs: AuditLog[];
  systemSettings: SystemSettings[];
}
