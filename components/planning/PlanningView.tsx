// components/planning/PlanningView.tsx
'use client'
import { useMemo, useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { CalendarEvent, Category, Subcategory, Season } from '@/types'
import {
  getSeasonWeeks, assignEventsToWeeks, isSchoolHoliday,
  formatShortDate, getJoursFeriesSaison, getFeriesInWeek
} from '@/lib/week-utils'

// Mélange couleur hex avec blanc pour un fond opaque
function blendWithWhite(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `rgb(${Math.round(r*alpha+255*(1-alpha))},${Math.round(g*alpha+255*(1-alpha))},${Math.round(b*alpha+255*(1-alpha))})`
}

const COL_SEM  = 82   // px colonne Semaine
const COL_WEND = 92   // px colonne W-End
const COL_DATA = 130  // px colonnes données

interface Props {
  events: CalendarEvent[]
  categories: Category[]
  subcategories: Subcategory[]
  season: Season
  onEventClick: (event: CalendarEvent) => void
  filterCategoryId?: string
  filterMonth?: string
  filterKeyword?: string
}

export default function PlanningView({
  events, categories, subcategories, season, onEventClick,
  filterCategoryId, filterMonth, filterKeyword
}: Props) {
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const startYear = parseInt(season.name.split('/')[0])
  const feriesMap = useMemo(() => getJoursFeriesSaison(startYear), [startYear])

  const weeks = useMemo(() => {
    const allWeeks = getSeasonWeeks(season.start_date, season.end_date)
    return assignEventsToWeeks(allWeeks, events)
  }, [season, events])

  // Colonnes de données
  const columns = useMemo(() => {
    const cols: {
      catId: string; catName: string; catColor: string
      subId: string | null; subName: string | null; key: string
    }[] = []
    const visibleCats = filterCategoryId
      ? categories.filter(c => c.id === filterCategoryId)
      : categories
    for (const cat of visibleCats) {
      const subs = subcategories.filter(s => s.category_id === cat.id && s.is_active)
      if (subs.length === 0) {
        cols.push({ catId: cat.id, catName: cat.name, catColor: cat.color, subId: null, subName: null, key: `cat-${cat.id}` })
      } else {
        for (const sub of subs) {
          cols.push({ catId: cat.id, catName: cat.name, catColor: cat.color, subId: sub.id, subName: sub.name, key: `sub-${sub.id}` })
        }
      }
    }
    return cols
  }, [categories, subcategories, filterCategoryId])

  // Groupes catégories pour colspan
  const catGroups = useMemo(() => {
    const groups: { catId: string; catName: string; catColor: string; span: number }[] = []
    for (const col of columns) {
      const last = groups[groups.length - 1]
      if (last && last.catId === col.catId) { last.span++ }
      else { groups.push({ catId: col.catId, catName: col.catName, catColor: col.catColor, span: 1 }) }
    }
    return groups
  }, [columns])

  // Semaines par mois
  const weeksByMonth = useMemo(() => {
    const map = new Map<string, typeof weeks>()
    for (const week of weeks) {
      const monthKey = format(week.monday, 'yyyy-MM')
      if (!map.has(monthKey)) map.set(monthKey, [])
      map.get(monthKey)!.push(week)
    }
    return map
  }, [weeks])

  const matchesKeyword = (ev: CalendarEvent) => {
    if (!filterKeyword) return true
    const kw = filterKeyword.toLowerCase()
    return ev.title.toLowerCase().includes(kw) ||
      (ev.description ?? '').toLowerCase().includes(kw) ||
      (ev.location ?? '').toLowerCase().includes(kw)
  }

  const getColEvents = (weekEvents: CalendarEvent[], col: typeof columns[0]) =>
    weekEvents.filter(e => {
      if (e.category_id !== col.catId) return false
      if (col.subId !== null && e.subcategory_id !== col.subId) return false
      if (col.subId === null && subcategories.some(s => s.category_id === col.catId && s.is_active && e.subcategory_id === s.id)) return false
      if (!matchesKeyword(e)) return false
      if (filterMonth && new Date(e.start_date).getMonth() + 1 !== parseInt(filterMonth)) return false
      return true
    })

  const tableWidth = COL_SEM + COL_WEND + columns.length * COL_DATA

  return (
    <div
      ref={scrollRef}
      style={{
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 110px)',
        width: '100%',
      }}
    >
      <table style={{
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontSize: '11px',
        tableLayout: 'fixed',
        width: `${tableWidth}px`,
      }}>
        <colgroup>
          <col style={{ width: `${COL_SEM}px` }} />
          <col style={{ width: `${COL_WEND}px` }} />
          {columns.map(col => <col key={col.key} style={{ width: `${COL_DATA}px` }} />)}
        </colgroup>

        {/* ── EN-TÊTES STICKY ── */}
        <thead>
          {/* Ligne 1 : catégories */}
          <tr>
            <th rowSpan={2} style={{
              position: 'sticky', left: 0, top: 0, zIndex: 50,
              background: '#1e3a8a', color: 'white',
              border: '1px solid #2d4fb5',
              padding: '6px 4px', textAlign: 'center', fontWeight: 700,
              verticalAlign: 'middle', fontSize: '11px',
            }}>Semaine</th>

            <th rowSpan={2} style={{
              position: 'sticky', left: `${COL_SEM}px`, top: 0, zIndex: 50,
              background: '#1e3a8a', color: 'white',
              border: '1px solid #2d4fb5', borderLeft: '2px solid #60a5fa',
              padding: '6px 4px', textAlign: 'center', fontWeight: 700,
              verticalAlign: 'middle', fontSize: '11px',
            }}>W-End</th>

            {catGroups.map(g => (
              <th key={g.catId} colSpan={g.span} style={{
                position: 'sticky', top: 0, zIndex: 30,
                background: blendWithWhite(g.catColor, 0.15),
                color: g.catColor,
                border: `1px solid ${g.catColor}88`,
                borderBottom: `2px solid ${g.catColor}`,
                padding: '5px 4px', textAlign: 'center',
                fontWeight: 700, fontSize: '11px',
              }}>{g.catName}</th>
            ))}
          </tr>

          {/* Ligne 2 : sous-catégories */}
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{
                position: 'sticky', top: '29px', zIndex: 30,
                background: blendWithWhite(col.catColor, 0.07),
                color: col.catColor,
                border: `1px solid ${col.catColor}55`,
                borderTop: 'none',
                padding: '3px', textAlign: 'center',
                fontWeight: 500, fontSize: '10px',
                lineHeight: '1.2', whiteSpace: 'normal',
              }}>{col.subName ?? ''}</th>
            ))}
          </tr>
        </thead>

        {/* ── BODY ── */}
        <tbody>
          {Array.from(weeksByMonth.entries()).map(([monthKey, monthWeeks]) => {
            const isCollapsed = collapsedMonths.has(monthKey)
            const label = format(monthWeeks[0].monday, 'MMMM yyyy', { locale: fr })
            const labelCap = label.charAt(0).toUpperCase() + label.slice(1)
            const hasEvents = monthWeeks.some(w => columns.some(col => getColEvents(w.events, col).length > 0))

            if (filterMonth) {
              const m = parseInt(filterMonth)
              if (!monthWeeks.some(w => w.monday.getMonth() + 1 === m)) return null
            }

            return (
              <>
                {/* ── LIGNE MOIS : colonne Semaine + W-End sticky, puis cellule fond gris ── */}
                <tr key={`month-${monthKey}`} style={{ cursor: 'pointer' }} onClick={() => {
                  setCollapsedMonths(prev => {
                    const next = new Set(prev)
                    if (next.has(monthKey)) next.delete(monthKey); else next.add(monthKey)
                    return next
                  })
                }}>
                  {/* Cellule sticky Semaine dans la ligne mois */}
                  <td style={{
                    position: 'sticky', left: 0, top: '58px', zIndex: 25,
                    background: '#374151', color: 'white',
                    border: '1px solid #4b5563',
                    padding: '5px 4px', textAlign: 'center',
                    fontWeight: 700, fontSize: '11px',
                  }}>
                    {isCollapsed
                      ? <ChevronDown style={{ width: 14, height: 14, margin: '0 auto', color: '#9ca3af' }} />
                      : <ChevronUp style={{ width: 14, height: 14, margin: '0 auto', color: '#9ca3af' }} />
                    }
                  </td>

                  {/* Cellule sticky W-End dans la ligne mois */}
                  <td style={{
                    position: 'sticky', left: `${COL_SEM}px`, top: '58px', zIndex: 25,
                    background: '#374151', color: 'white',
                    border: '1px solid #4b5563', borderLeft: '2px solid #60a5fa',
                    padding: '5px 4px',
                  }} />

                  {/* Cellule étendue avec le nom du mois */}
                  <td colSpan={columns.length} style={{
                    position: 'sticky', top: '58px', zIndex: 20,
                    background: '#374151', color: 'white',
                    border: '1px solid #4b5563',
                    padding: '5px 12px',
                    fontWeight: 700, fontSize: '12px',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{labelCap}</span>
                      {!hasEvents && !filterKeyword && (
                        <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 400 }}>Aucun événement</span>
                      )}
                    </div>
                  </td>
                </tr>

                {/* ── LIGNES SEMAINES ── */}
                {!isCollapsed && monthWeeks.map(week => {
                  const isHoliday = isSchoolHoliday(week.monday, season.name)
                  const feries = getFeriesInWeek(week.monday, feriesMap)
                  const semBg  = isHoliday ? '#fef08a' : '#eff6ff'
                  const semClr = isHoliday ? '#854d0e' : '#1e40af'
                  const wendBg = isHoliday ? '#fefce8' : '#f8fafc'
                  const rowBg  = isHoliday ? '#fef9c3' : 'white'

                  return (
                    <tr key={`week-${week.week_number}`}>
                      {/* Semaine sticky */}
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 10,
                        background: semBg, color: semClr,
                        border: '1px solid #cbd5e1', borderRight: '2px solid #94a3b8',
                        padding: '4px 2px', textAlign: 'center', verticalAlign: 'top',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>S{week.week_number}</div>
                        {isHoliday && <div style={{ fontSize: '9px', color: '#854d0e' }}>Vacances</div>}
                        {feries.map(f => (
                          <span key={f.date} title={f.nom} style={{
                            display: 'block', marginTop: '2px',
                            background: '#E0F5EC', color: '#1a6b45',
                            fontSize: '8px', padding: '1px 3px', borderRadius: '2px',
                            fontWeight: 600, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>🟢 {f.nom}</span>
                        ))}
                      </td>

                      {/* W-End sticky */}
                      <td style={{
                        position: 'sticky', left: `${COL_SEM}px`, zIndex: 10,
                        background: wendBg,
                        border: '1px solid #cbd5e1', borderRight: '2px solid #94a3b8',
                        borderLeft: '2px solid #60a5fa44',
                        padding: '4px 5px', verticalAlign: 'top',
                        color: '#64748b', fontSize: '10px', lineHeight: '1.8',
                      }}>
                        <div>Sam {format(week.saturday, 'dd/MM')}</div>
                        <div>Dim {format(week.sunday, 'dd/MM')}</div>
                      </td>

                      {/* Cellules données */}
                      {columns.map(col => {
                        const colEvents = getColEvents(week.events, col)
                        return (
                          <td key={col.key} style={{
                            border: '1px solid #dde3ec',
                            borderLeft: `2px solid ${col.catColor}44`,
                            padding: '3px', verticalAlign: 'top',
                            background: rowBg,
                          }}>
                            {colEvents.map(ev => (
                              <EventBadge key={ev.id} event={ev}
                                categoryColor={ev.color ?? col.catColor}
                                onClick={() => onEventClick(ev)} />
                            ))}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EventBadge({ event, categoryColor, onClick }: {
  event: CalendarEvent; categoryColor: string; onClick: () => void
}) {
  const opacity = { previsionnel: '0.8', confirme: '1', annule: '0.5', reporte: '0.85' }[event.status] ?? '1'
  const subTitle = event.subcategory ? `${event.subcategory.name} — ${event.title}` : event.title
  return (
    <button onClick={onClick}
      title={`${subTitle}${event.location ? ` · ${event.location}` : ''}`}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: categoryColor + '18',
        border: `1px solid ${categoryColor}40`,
        borderLeft: `2px solid ${categoryColor}`,
        color: categoryColor,
        padding: '2px 4px', marginBottom: '2px', borderRadius: '2px',
        fontSize: '10px', lineHeight: '1.3', cursor: 'pointer',
        opacity, overflow: 'hidden',
        textDecoration: event.status === 'annule' ? 'line-through' : 'none',
      }}
    >
      <span style={{ opacity: 0.65 }}>{formatShortDate(event.start_date)}</span>
      {' '}<strong style={{ fontWeight: 500 }}>{subTitle}</strong>
      {event.location && <span style={{ opacity: 0.6 }}> · {event.location}</span>}
    </button>
  )
}
