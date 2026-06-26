// lib/week-utils.ts
import {
  startOfWeek, endOfWeek, addWeeks, eachWeekOfInterval,
  getISOWeek, format, parseISO, isWithinInterval, addDays
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { SportWeek, CalendarEvent } from '@/types'

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
