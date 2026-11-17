import { Beneficiary, VaccinationRecord, VaccineSchedule } from '../types';
import { addAgeToDate, calculateAgeAsOf, diffDaysISO, formatDDMMYYYY } from './dateUtils';

export interface DoseEligibilityResult {
  schedule: VaccineSchedule;
  status: 'ADMINISTERED' | 'DUE' | 'NOT_YET_ELIGIBLE' | 'OVER_MAX_AGE' | 'INTERVAL_PENDING';
  dueDateISO: string;
  isOverdue?: boolean;
  administeredRecord?: VaccinationRecord;
  reasonMarathi: string;
}

export interface BeneficiaryEligibilitySummary {
  beneficiary: Beneficiary;
  ageOnTargetDateLabel: string;
  totalDaysOnTargetDate: number;
  administeredDoses: DoseEligibilityResult[];
  dueDoses: DoseEligibilityResult[];
  allDoseResults: DoseEligibilityResult[];
  isEligibleForSession: boolean;
}

export function evaluateBeneficiaryEligibility(
  beneficiary: Beneficiary,
  targetDateISO: string,
  validatedSchedules: VaccineSchedule[],
  existingRecords: VaccinationRecord[]
): BeneficiaryEligibilitySummary {
  const age = calculateAgeAsOf(beneficiary.dob, targetDateISO);
  const recordBySchedule = new Map<string, VaccinationRecord>();
  for (const rec of existingRecords) {
    recordBySchedule.set(rec.scheduleId, rec);
  }

  const activeValidated = validatedSchedules
    .filter((s) => s.isActive && s.isValidated)
    .sort((a, b) => a.doseOrder - b.doseOrder);

  const allDoseResults: DoseEligibilityResult[] = [];

  for (const sch of activeValidated) {
    const existing = recordBySchedule.get(sch.id);
    const minEligibleDate = addAgeToDate(beneficiary.dob, sch.minAgeValue, sch.minAgeUnit);
    const recommendedDueDate = addAgeToDate(
      beneficiary.dob,
      sch.recommendedAgeValue,
      sch.recommendedAgeUnit
    );

    if (existing) {
      allDoseResults.push({
        schedule: sch,
        status: 'ADMINISTERED',
        dueDateISO: recommendedDueDate,
        administeredRecord: existing,
        reasonMarathi: `दिनांक ${formatDDMMYYYY(existing.administeredDate)} रोजी दिलेला`,
      });
      continue;
    }

    if (age.totalDays < 0) {
      allDoseResults.push({
        schedule: sch,
        status: 'NOT_YET_ELIGIBLE',
        dueDateISO: recommendedDueDate,
        reasonMarathi: 'जन्मतारीख सत्राच्या तारखेनंतर आहे',
      });
      continue;
    }

    if (targetDateISO < minEligibleDate) {
      allDoseResults.push({
        schedule: sch,
        status: 'NOT_YET_ELIGIBLE',
        dueDateISO: recommendedDueDate,
        reasonMarathi: `किमान वय पूर्ण नाही (पात्र: ${formatDDMMYYYY(minEligibleDate)})`,
      });
      continue;
    }

    if (sch.maxAgeValue && sch.maxAgeUnit) {
      const maxEligibleDate = addAgeToDate(beneficiary.dob, sch.maxAgeValue, sch.maxAgeUnit);
      if (targetDateISO > maxEligibleDate) {
        allDoseResults.push({
          schedule: sch,
          status: 'OVER_MAX_AGE',
          dueDateISO: recommendedDueDate,
          reasonMarathi: 'कमाल वयोमर्यादा ओलांडली आहे',
        });
        continue;
      }
    }

    if (sch.previousDoseId) {
      const prevRec = recordBySchedule.get(sch.previousDoseId);
      if (!prevRec) {
        allDoseResults.push({
          schedule: sch,
          status: 'INTERVAL_PENDING',
          dueDateISO: recommendedDueDate,
          reasonMarathi: 'मागील डोस अद्याप बाकी आहे',
        });
        continue;
      }

      if (sch.minIntervalDays && sch.minIntervalDays > 0) {
        const elapsed = diffDaysISO(prevRec.administeredDate, targetDateISO);
        if (elapsed < sch.minIntervalDays) {
          allDoseResults.push({
            schedule: sch,
            status: 'INTERVAL_PENDING',
            dueDateISO: addAgeToDate(prevRec.administeredDate, sch.minIntervalDays, 'DAYS'),
            reasonMarathi: `मागील डोसनंतर ${sch.minIntervalDays} दिवसांचे अंतर आवश्यक आहे`,
          });
          continue;
        }
      }
    }

    const overdue = targetDateISO > recommendedDueDate;
    allDoseResults.push({
      schedule: sch,
      status: 'DUE',
      dueDateISO: recommendedDueDate,
      isOverdue: overdue,
      reasonMarathi: overdue ? 'मुदत उलटलेला डोस (Overdue)' : 'देय डोस',
    });
  }

  const administeredDoses = allDoseResults.filter((r) => r.status === 'ADMINISTERED');
  const dueDoses = allDoseResults.filter((r) => r.status === 'DUE');

  return {
    beneficiary,
    ageOnTargetDateLabel: age.labelMarathi,
    totalDaysOnTargetDate: age.totalDays,
    administeredDoses,
    dueDoses,
    allDoseResults,
    isEligibleForSession: dueDoses.length > 0,
  };
}
