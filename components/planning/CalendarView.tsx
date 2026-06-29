// components/planning/CalendarView.tsx
'use client'
import { useState, useMemo } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent, Category, Season } from '@/types'
import { getJoursFeriesSaison, isSchoolHoliday } from '@/lib/week-utils'
import { cn } from '@/lib/utils'

interface Props {
  events: CalendarEvent[]
  categories: Category[]
  season: Season
  onEventClick: (event: CalendarEvent) => void
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function CalendarView({ events, categories, season, onEventClick }: Props) {
  const startYear = parseInt(season.name.split('/')[0])
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    // Si on est dans la saison, afficher le mois courant, sinon juillet de la saison
    const seasonStart = parseISO(season.start_date)
    const seasonEnd = parseISO(season.end_date)
    if (now >= seasonStart && now <= seasonEnd) return now
    return seasonStart
  })

  const feriesMap = useMemo(() => getJoursFeriesSaison(startYear), [startYear])
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: fr })
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  const prevMonth = () => {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() - 1)
    setCurrentDate(d)
  }
  const nextMonth = () => {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + 1)
    setCurrentDate(d)
  }

  const getEventsForDay = (day: Date) => {
    const ds = format(day, 'yyyy-MM-dd')
    return events.filter(ev => {
      const start = ev.start_date
      const end = ev.end_date
      return ds >= start && ds <= end
    })
  }

  return (
    <div style={{ fontFamily: 'var(--font-sans)', padding: '0 0 1rem' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <button
          onClick={prevMonth}
          style={{ border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'none', padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}
        >
          <ChevronLeft style={{ width: 16, height: 16 }} />
        </button>
        <span style={{ fontSize: '19px', fontWeight: 600, minWidth: '190px', textAlign: 'center', color: 'var(--text-primary)' }}>
          {monthLabelCap}
        </span>
        <button
          onClick={nextMonth}
          style={{ border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'none', padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}
        >
          <ChevronRight style={{ width: 16, height: 16 }} />
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          style={{ border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'none', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}
        >
          Aujourd'hui
        </button>
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <div style={{ width: 13, height: 13, borderRadius: 2, background: '#E0F5EC', border: '1px solid #1a6b4560' }} />
          Jour férié
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <div style={{ width: 13, height: 13, borderRadius: 2, background: '#fef08a', border: '1px solid #854d0e60' }} />
          Vacances Zone C
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <div style={{ width: 13, height: 13, borderRadius: 2, background: '#eef2f7', border: '1px solid #94a3b860' }} />
          Week-end
        </div>
      </div>

      {/* Grille */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
        {/* En-tête jours */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#1e3a8a' }}>
          {JOURS.map(j => (
            <div key={j} style={{ padding: '9px 4px', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: 'white', borderRight: '1px solid #2d4fb5' }}>
              {j}
            </div>
          ))}
        </div>

        {/* Jours */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(96px, auto)' }}>
          {days.map((day, idx) => {
            const ds = format(day, 'yyyy-MM-dd')
            const ferie = feriesMap[ds]
            const dow = day.getDay()
            const isWeekend = dow === 0 || dow === 6
            const isVac = isSchoolHoliday(
              startOfWeek(day, { weekStartsOn: 1 }),
              season.name
            )
            const isCurrentMonth = isSameMonth(day, currentDate)
            const todayDay = isToday(day)
            const dayEvents = getEventsForDay(day)
            // Premier jour de la semaine (lundi) → on y affiche le badge "Vacances"
            const isMonday = dow === 1

            // Couleurs de fond : vacances en jaune franc (comme la vue planning)
            let bg = 'white'
            if (ferie) bg = '#E0F5EC'
            else if (isVac) bg = '#fef9c3'
            else if (isWeekend) bg = '#eef2f7'

            return (
              <div
                key={ds}
                style={{
                  background: bg,
                  border: '1px solid #d8dee9',
                  padding: '5px',
                  opacity: isCurrentMonth ? 1 : 0.45,
                  minHeight: '96px',
                }}
              >
                {/* Numéro du jour + badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '3px' }}>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: todayDay ? 700 : 500,
                    color: todayDay ? 'white' : isWeekend ? '#475569' : 'var(--text-primary)',
                    background: todayDay ? '#1e3a8a' : 'transparent',
                    borderRadius: '50%',
                    width: todayDay ? '24px' : 'auto',
                    height: todayDay ? '24px' : 'auto',
                    minWidth: todayDay ? '24px' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {format(day, 'd')}
                  </span>
                  {ferie && (
                    <span style={{
                      fontSize: '10px',
                      background: '#E0F5EC',
                      color: '#1a6b45',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      fontWeight: 600,
                      maxWidth: '80px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }} title={ferie}>
                      {ferie}
                    </span>
                  )}
                </div>

                {/* Badge Vacances (uniquement le lundi de chaque semaine de vacances) */}
                {isVac && isMonday && !ferie && (
                  <div style={{
                    fontSize: '10px', fontWeight: 700, color: '#854d0e',
                    background: '#fef08a', border: '1px solid #facc15',
                    borderRadius: '3px', padding: '1px 5px', marginBottom: '3px',
                    display: 'inline-block',
                  }}>
                    🏖 Vacances
                  </div>
                )}

                {/* Événements */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayEvents.slice(0, 3).map(ev => {
                    const cat = catMap.get(ev.category_id)
                    const color = ev.color ?? cat?.color ?? '#3B82F6'
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onEventClick(ev)}
                        title={ev.title}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          background: color + '22',
                          borderLeft: `3px solid ${color}`,
                          color: color,
                          padding: '2px 5px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          lineHeight: '1.35',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 600,
                          border: `1px solid ${color}30`,
                          borderLeftWidth: '3px',
                          borderLeftColor: color,
                        }}
                      >
                        {ev.title}
                      </button>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '2px', fontWeight: 500 }}>
                      +{dayEvents.length - 3} autres
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
