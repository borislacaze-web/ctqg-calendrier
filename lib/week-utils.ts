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
    { start: '2026-10-17', end: '2026-11-01' }, // Toussaint
    { start: '2026-12-19', end: '2027-01-03' }, // Noël
    { start: '2027-02-06', end: '2027-02-21' }, // Hiver Zone C
    { start: '2027-04-03', end: '2027-04-18' }, // Printemps Zone C
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
