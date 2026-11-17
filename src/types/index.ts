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
  childName: string; // Permanent Full Name (Child Full Name or Woman Full Name)
  motherName: string;
  fatherName: string;
  guardianName?: string; // Parent/Guardian Name (Child) or Husband Name (Pregnant Woman)
  dob: string; // ISO YYYY-MM-DD (required for Child, optional for Pregnant Woman)
  gender: BeneficiaryGender;
  mobile: string;
  aadhaarNumber?: string; // Optional 12-digit Aadhaar (masked in ordinary UI & PDF reports)
  caste?: string;
  category?: string;
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
  outcomeDate?: string;
  notes?: string;
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
  | 'SESSION'
  | 'VACCINATION'
  | 'MATERNAL_SERVICE'
  | 'SUBCENTRE'
  | 'VILLAGE'
  | 'STAFF'
  | 'VACCINE_MASTER'
  | 'VACCINE_SCHEDULE'
  | 'USER'
  | 'SETTINGS'
  | 'SHEET_IMPORT';

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
  vaccinationSessions: VaccinationSession[];
  sessionBeneficiaries: SessionBeneficiary[];
  vaccineMaster: VaccineMaster[];
  vaccineSchedule: VaccineSchedule[];
  vaccinationRecords: VaccinationRecord[];
  maternalServiceRecords: MaternalServiceRecord[];
  auditLogs: AuditLog[];
  systemSettings: SystemSettings[];
}
