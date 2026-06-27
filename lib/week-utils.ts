// lib/week-utils.ts
import {
  startOfWeek, endOfWeek, addWeeks, eachWeekOfInterval,
  getISOWeek, format, parseISO, isWithinInterval, addDays,
  isWithinInterval as dateInInterval
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { SportWeek, CalendarEvent } from '@/types'

// ============================================================
// VACANCES SCOLAIRES ZONE C
// Format : { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
// Générées automatiquement pour chaque saison connue.
// Ajouter les saisons futures ici au fur et à mesure.
// ============================================================
const VACANCES_ZONE_C: Record<string, { start: string; end: string }[]> = {
  '2025/2026': [
    { start: '2025-10-18', end: '2025-11-03' }, // Toussaint
    { start: '2025-12-20', end: '2026-01-05' }, // Noël
    { start: '2026-02-14', end: '2026-03-02' }, // Hiver
    { start: '2026-04-11', end: '2026-04-27' }, // Printemps
    { start: '2026-07-04', end: '2026-08-31' }, // Été
  ],
  '2026/2027': [
    { start: '2026-07-04', end: '2026-08-31' }, // Grandes vacances été 2026
    { start: '2026-10-17', end: '2026-11-01' }, // Toussaint (fin sam 17/10, reprise lun 2/11)
    { start: '2026-12-19', end: '2027-01-03' }, // Noël (fin sam 19/12, reprise lun 4/01)
    { start: '2027-02-06', end: '2027-02-21' }, // Hiver Zone C (fin sam 6/02, reprise lun 22/02)
    { start: '2027-04-03', end: '2027-04-18' }, // Printemps Zone C (fin sam 3/04, reprise lun 19/04)
    { start: '2027-07-03', end: '2027-08-31' }, // Grandes vacances été 2027
  ],
  '2027/2028': [
    { start: '2027-07-03', end: '2027-08-31' }, // Grandes vacances été 2027
    { start: '2027-10-23', end: '2027-11-08' }, // Toussaint
    { start: '2027-12-18', end: '2028-01-03' }, // Noël
    { start: '2028-02-19', end: '2028-03-06' }, // Hiver Zone C
    { start: '2028-04-15', end: '2028-05-01' }, // Printemps Zone C
    { start: '2028-07-01', end: '2028-08-31' }, // Grandes vacances été 2028
  ],
}

// ============================================================
// JOURS FÉRIÉS FRANCE
// ============================================================

function getPaquesDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDaysToDate(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function dateStrFr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function getJoursFeries(year: number): Record<string, string> {
  const paques = getPaquesDate(year)
  return {
    [`${year}-01-01`]: 'Jour de l\'An',
    [dateStrFr(paques)]: 'Pâques',
    [dateStrFr(addDaysToDate(paques, 1))]: 'Lundi de Pâques',
    [`${year}-05-01`]: 'Fête du Travail',
    [`${year}-05-08`]: 'Victoire 1945',
    [dateStrFr(addDaysToDate(paques, 39))]: 'Ascension',
    [dateStrFr(addDaysToDate(paques, 50))]: 'Lundi de Pentecôte',
    [`${year}-07-14`]: 'Fête Nationale',
    [`${year}-08-15`]: 'Assomption',
    [`${year}-11-01`]: 'Toussaint',
    [`${year}-11-11`]: 'Armistice',
    [`${year}-12-25`]: 'Noël',
  }
}

/**
 * Retourne les jours fériés d'une saison (juillet N → juin N+1).
 */
export function getJoursFeriesSaison(startYear: number): Record<string, string> {
  return {
    ...getJoursFeries(startYear),
    ...getJoursFeries(startYear + 1),
  }
}

/**
 * Retourne les jours fériés présents dans une semaine donnée.
 */
export function getFeriesInWeek(monday: Date, feriesMap: Record<string, string>): { date: string; nom: string }[] {
  const result: { date: string; nom: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = addDaysToDate(monday, i)
    const ds = format(d, 'yyyy-MM-dd')
    if (feriesMap[ds]) result.push({ date: ds, nom: feriesMap[ds] })
  }
  return result
}

/**
 * Retourne true si la semaine (lundi→dimanche) chevauche des vacances scolaires Zone C.
 */
export function isSchoolHoliday(monday: Date, seasonName: string): boolean {
  const periods = VACANCES_ZONE_C[seasonName] ?? []
  const sunday = addDays(monday, 6)
  return periods.some(p => {
    const pStart = parseISO(p.start)
    const pEnd   = parseISO(p.end)
    return monday <= pEnd && sunday >= pStart
  })
}

/**
 * Formate la date de début d'un événement en "Ven 24/07".
 */
export function formatShortDate(dateStr: string): string {
  const d = parseISO(dateStr)
  const jour = format(d, 'EEE', { locale: fr })
  const jouCap = jour.charAt(0).toUpperCase() + jour.slice(1, 3)
  return `${jouCap} ${format(d, 'dd/MM')}`
}

/**
 * Retourne le lundi de la semaine contenant une date donnée.
 */
export function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/**
 * Retourne toutes les semaines sportives d'une saison.
 * Une saison débute le 01/07 et se termine le 30/06.
 */
export function getSeasonWeeks(startDate: string, endDate: string): SportWeek[] {
  const start = parseISO(startDate)
  const end = parseISO(endDate)

  // Premier lundi à partir du début de saison
  const firstMonday = getMondayOfWeek(start)

  const weeks: SportWeek[] = []
  const mondays = eachWeekOfInterval({ start: firstMonday, end }, { weekStartsOn: 1 })

  for (const monday of mondays) {
    const weekEnd = endOfWeek(monday, { weekStartsOn: 1 })
    weeks.push({
      week_number: getISOWeek(monday),
      monday,
      friday: addDays(monday, 4),
      saturday: addDays(monday, 5),
      sunday: addDays(monday, 6),
      events: [],
    })
  }

  return weeks
}

/**
 * Distribue les événements dans les semaines correspondantes.
 */
export function assignEventsToWeeks(
  weeks: SportWeek[],
  events: CalendarEvent[]
): SportWeek[] {
  return weeks.map(week => {
    const weekStart = week.monday
    const weekEnd = week.sunday

    const weekEvents = events.filter(event => {
      const evStart = parseISO(event.start_date)
      const evEnd = parseISO(event.end_date)
      // L'événement chevauche la semaine
      return evStart <= weekEnd && evEnd >= weekStart
    })

    return { ...week, events: weekEvents }
  })
}

/**
 * Formate une date en français.
 */
export function formatDateFr(date: Date | string, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: fr })
}

/**
 * Retourne le libellé du mois+année d'une semaine.
 */
export function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6)
  const mMonth = format(monday, 'MMM', { locale: fr })
  const sMonth = format(sunday, 'MMM', { locale: fr })

  if (mMonth === sMonth) {
    return format(monday, 'MMMM yyyy', { locale: fr })
  }
  return `${mMonth}–${sMonth} ${format(sunday, 'yyyy')}`
}

/**
 * Nom court du statut d'un événement.
 */
export const STATUS_LABELS: Record<string, string> = {
  previsionnel: 'Prévisionnel',
  confirme:     'Confirmé',
  annule:       'Annulé',
  reporte:      'Reporté',
}

export const STATUS_COLORS: Record<string, string> = {
  previsionnel: 'bg-gray-100 text-gray-700 border-gray-300',
  confirme:     'bg-green-100 text-green-800 border-green-300',
  annule:       'bg-red-100 text-red-700 border-red-300 line-through',
  reporte:      'bg-orange-100 text-orange-700 border-orange-300',
}
