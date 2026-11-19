import { AgeUnit, VaccinationSession } from '../types';
import { formatDateIST, formatDateTimeIST } from './localeUtils';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getTodayIST(): string {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  return nowIst.toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function formatDDMMYYYY(isoDate?: string | null): string {
  return formatDateIST(isoDate);
}

export function formatTimestampIST(isoString?: string | null): string {
  return formatDateTimeIST(isoString);
}

/**
 * Computes deadline = sessionDate + extraDays calendar days at 23:59:59.999 IST
 */
export function computeSessionEditDeadlineISO(sessionDateISO: string, extraDays = 2): string {
  const [y, m, d] = sessionDateISO.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d + extraDays, 23, 59, 59, 999) - IST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

export interface SessionWindowStatus {
  isOpen: boolean;
  labelMarathi: string;
  remainingText: string;
  isReopened: boolean;
}

export function getSessionEditStatus(
  session: VaccinationSession,
  nowMs: number = Date.now()
): SessionWindowStatus {
  if (session.status === 'पूर्ण') {
    return {
      isOpen: false,
      labelMarathi: 'LOCKED (बंद / पूर्ण)',
      remainingText: 'सत्र पूर्ण (बंद) केलेले आहे — डेटा एन्ट्री बंद आहे',
      isReopened: false,
    };
  }

  if (session.status === 'लॉक') {
    return {
      isOpen: false,
      labelMarathi: 'LOCKED (लॉक)',
      remainingText: 'सत्र लॉक केलेले आहे — डेटा एन्ट्री बंद आहे',
      isReopened: false,
    };
  }

  if (session.status === 'रद्द') {
    return {
      isOpen: false,
      labelMarathi: 'LOCKED (रद्द)',
      remainingText: 'सत्र रद्द केलेले आहे — डेटा एन्ट्री बंद आहे',
      isReopened: false,
    };
  }

  const reopenedMs = session.reopenedUntil ? Date.parse(session.reopenedUntil) : 0;
  if (reopenedMs > nowMs) {
    return {
      isOpen: true,
      labelMarathi: 'OPEN (सुरू)',
      remainingText: `प्रशासकाद्वारे पुन्हा उघडलेले: ${formatRemainingMs(reopenedMs - nowMs)} शिल्लक`,
      isReopened: true,
    };
  }

  const deadlineMs = Date.parse(session.editDeadlineAt);
  if (!Number.isNaN(deadlineMs) && nowMs <= deadlineMs) {
    return {
      isOpen: true,
      labelMarathi: 'OPEN (सुरू)',
      remainingText: `संपादनासाठी ${formatRemainingMs(deadlineMs - nowMs)} शिल्लक`,
      isReopened: false,
    };
  }

  return {
    isOpen: false,
    labelMarathi: 'LOCKED (लॉक)',
    remainingText: 'दोन दिवसांची मुदत समाप्त झाली (स्वयंचलित लॉक)',
    isReopened: false,
  };
}

function formatRemainingMs(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const mins = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} दिवस`);
  if (hours > 0) parts.push(`${hours} तास`);
  parts.push(`${mins} मिनिटे`);
  return parts.join(' ');
}

export interface AgeBreakdown {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  labelMarathi: string;
}

export function calculateAgeAsOf(dobISO: string, asOfISO: string): AgeBreakdown {
  const [by, bm, bd] = dobISO.split('-').map(Number);
  const [ay, am, ad] = asOfISO.split('-').map(Number);

  if (!by || !bm || !bd || !ay || !am || !ad) {
    return {
      years: 0,
      months: 0,
      days: 0,
      totalDays: -1,
      totalWeeks: -1,
      totalMonths: -1,
      labelMarathi: '-',
    };
  }

  const dobDate = new Date(Date.UTC(by, bm - 1, bd));
  const asOfDate = new Date(Date.UTC(ay, am - 1, ad));

  if (asOfDate < dobDate) {
    return {
      years: 0,
      months: 0,
      days: 0,
      totalDays: -1,
      totalWeeks: -1,
      totalMonths: -1,
      labelMarathi: 'अवैध तारीख',
    };
  }

  const totalDays = Math.floor((asOfDate.getTime() - dobDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.floor(totalDays / 7);

  let years = ay - by;
  let months = am - bm;
  let days = ad - bd;

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(Date.UTC(ay, am - 1, 0)).getUTCDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} वर्षे`);
  if (months > 0) parts.push(`${months} महिने`);
  if (years === 0 && days >= 0) parts.push(`${days} दिवस`);

  return {
    years,
    months,
    days,
    totalDays,
    totalWeeks,
    totalMonths,
    labelMarathi: parts.join(' ') || '0 दिवस',
  };
}

export function addAgeToDate(dobISO: string, value: number, unit: AgeUnit): string {
  const [y, m, d] = dobISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (unit === 'DAYS') dt.setUTCDate(dt.getUTCDate() + value);
  if (unit === 'WEEKS') dt.setUTCDate(dt.getUTCDate() + value * 7);
  if (unit === 'MONTHS') dt.setUTCMonth(dt.getUTCMonth() + value);
  if (unit === 'YEARS') dt.setUTCFullYear(dt.getUTCFullYear() + value);
  return dt.toISOString().slice(0, 10);
}

export function diffDaysISO(startISO: string, endISO: string): number {
  const [sy, sm, sd] = startISO.split('-').map(Number);
  const [ey, em, ed] = endISO.split('-').map(Number);
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  return Math.floor((e - s) / (1000 * 60 * 60 * 24));
}
