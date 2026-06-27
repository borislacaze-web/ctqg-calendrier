// components/planning/PlanningView.tsx
'use client'
import { useMemo, useState } from 'react'
import { format, isBefore, startOfMonth, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { CalendarEvent, Category, Subcategory, Season } from '@/types'
import {
  getSeasonWeeks, assignEventsToWeeks, isSchoolHoliday,
  formatShortDate, getJoursFeriesSaison, getFeriesInWeek
} from '@/lib/week-utils'

function blendWithWhite(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `rgb(${Math.round(r*alpha+255*(1-alpha))},${Math.round(g*alpha+255*(1-alpha))},${Math.round(b*alpha+255*(1-alpha))})`
}

// Couleurs par statut
const STATUS_BG: Record<string, string> = {
  previsionnel: '#94a3b8',
  confirme:     '#22c55e',
  annule:       '#ef4444',
  reporte:      '#f97316',
}

const W_SEM   = 82
const W_WEND  = 96
const W_COL   = 130
const H_ROW1  = 28
const H_ROW2  = 42
const H_THEAD = H_ROW1 + H_ROW2

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
  const startYear = parseInt(season.name.split('/')[0])
  const feriesMap = useMemo(() => getJoursFeriesSaison(startYear), [startYear])

  const weeks = useMemo(() => {
    const allWeeks = getSeasonWeeks(season.start_date, season.end_date)
    return assignEventsToWeeks(allWeeks, events)
  }, [season, events])

  // Calcul des mois rétractés par défaut
  const defaultCollapsed = useMemo(() => {
    const now = new Date()
    const collapsed = new Set<string>()
    const allMonthKeys: string[] = []
    for (const week of weeks) {
      const key = format(week.monday, 'yyyy-MM')
      if (!allMonthKeys.includes(key)) allMonthKeys.push(key)
    }
    allMonthKeys.forEach(key => {
      const parts = key.split('-')
      const y = parseInt(parts[0])
      const m = parseInt(parts[1])
      if (m === 6 || m === 7 || m === 8) { collapsed.add(key); return }
      const monthStart = new Date(y, m - 1, 1)
      if (isBefore(monthStart, startOfMonth(now))) {
        collapsed.add(key)
      }
    })
    return collapsed
  }, [weeks])

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(defaultCollapsed)

  const columns = useMemo(() => {
    const cols: { catId: string; catName: string; catColor: string; subId: string|null; subName: string|null; key: string }[] = []
    const visibleCats = filterCategoryId ? categories.filter(c => c.id === filterCategoryId) : categories
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

  const catGroups = useMemo(() => {
    const groups: { catId: string; catName: string; catColor: string; span: number }[] = []
    for (const col of columns) {
      const last = groups[groups.length - 1]
      if (last && last.catId === col.catId) { last.span++ }
      else { groups.push({ catId: col.catId, catName: col.catName, catColor: col.catColor, span: 1 }) }
    }
    return groups
  }, [columns])

  // Regrouper les semaines par mois (clé = yyyy-MM du premier lundi de la semaine)
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

  const toggleMonth = (key: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const tableW = W_SEM + W_WEND + columns.length * W_COL

  const stickyLeft0: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 10 }
  const stickyLeft1: React.CSSProperties = { position: 'sticky', left: W_SEM, zIndex: 10 }

  return (
    <div
      id="body-scroll"
      style={{ position: 'relative', width: '100%', overflowX: 'scroll', overflowY: 'auto', maxHeight: `calc(100vh - ${H_THEAD + 112}px)` }}
      onScroll={e => {
        const hs = document.getElementById('header-scroll')
        if (hs) hs.scrollLeft = (e.target as HTMLDivElement).scrollLeft
      }}
    >
      {/* ══ EN-TÊTES STICKY ══ */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        height: H_THEAD, width: tableW,
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      }}>
        <div id="header-scroll" style={{ overflowX: 'hidden', width: tableW }}>
          <table style={{ tableLayout: 'fixed', width: tableW, borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px' }}>
            <colgroup>
              <col style={{ width: W_SEM }} />
              <col style={{ width: W_WEND }} />
              {columns.map(col => <col key={col.key} style={{ width: W_COL }} />)}
            </colgroup>
            <thead>
              <tr style={{ height: H_ROW1 }}>
                {/* Semaine — sticky dans l'en-tête */}
                <th rowSpan={2} style={{
                  position: 'sticky', left: 0, top: 0, zIndex: 50,
                  background: '#1e3a8a', color: 'white',
                  border: '1px solid #2d4fb5', height: H_THEAD,
                  textAlign: 'center', fontWeight: 700, fontSize: '11px',
                  verticalAlign: 'middle', lineHeight: '1',
                }}>Semaine</th>
                {/* W-End — sticky dans l'en-tête */}
                <th rowSpan={2} style={{
                  position: 'sticky', left: W_SEM, top: 0, zIndex: 50,
                  background: '#1e3a8a', color: 'white',
                  border: '1px solid #2d4fb5', borderLeft: '2px solid #60a5fa', height: H_THEAD,
                  textAlign: 'center', fontWeight: 700, fontSize: '11px',
                  verticalAlign: 'middle', lineHeight: '1',
                }}>W-End</th>
                {catGroups.map(g => (
                  <th key={g.catId} colSpan={g.span} style={{
                    background: blendWithWhite(g.catColor, 0.15),
                    color: g.catColor,
                    border: `1px solid ${g.catColor}88`,
                    borderBottom: `2px solid ${g.catColor}`,
                    padding: '4px', textAlign: 'center',
                    fontWeight: 700, fontSize: '11px', height: H_ROW1,
                  }}>{g.catName}</th>
                ))}
              </tr>
              {/* Ligne 2 : sous-catégories — centrées verticalement */}
              <tr style={{ height: H_ROW2 }}>
                {columns.map(col => (
                  <th key={col.key} style={{
                    background: blendWithWhite(col.catColor, 0.07),
                    color: col.catColor,
                    border: `1px solid ${col.catColor}55`, borderTop: 'none',
                    padding: '4px 3px', textAlign: 'center', verticalAlign: 'middle',
                    fontWeight: 500, fontSize: '10px',
                    lineHeight: '1.2', whiteSpace: 'normal', height: H_ROW2,
                  }}>{col.subName ?? ''}</th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* ══ CORPS ══ */}
      <table style={{ tableLayout: 'fixed', width: tableW, borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px' }}>
        <colgroup>
          <col style={{ width: W_SEM }} />
          <col style={{ width: W_WEND }} />
          {columns.map(col => <col key={col.key} style={{ width: W_COL }} />)}
        </colgroup>
        <tbody>
          {Array.from(weeksByMonth.entries()).map(([monthKey, monthWeeks]) => {
            const isCollapsed = collapsedMonths.has(monthKey)
            const [y, m] = monthKey.split('-').map(Number)
            const monthDate = new Date(y, m - 1, 1)
            const monthLabel = format(monthDate, 'MMMM yyyy', { locale: fr })
            const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
            const hasEvents = monthWeeks.some(w => columns.some(col => getColEvents(w.events, col).length > 0))

            if (filterMonth) {
              const fm = parseInt(filterMonth)
              if (!monthWeeks.some(w => w.monday.getMonth() + 1 === fm)) return null
            }

            return (
              <>
                {/* ── LIGNE MOIS (avant les semaines du mois) ── */}
                <tr key={`month-${monthKey}`} onClick={() => toggleMonth(monthKey)} style={{ cursor: 'pointer' }}>
                  {/* Semaine : nom du mois abrégé — sticky */}
                  <td style={{
                    ...stickyLeft0,
                    background: '#374151', color: 'white',
                    border: '1px solid #4b5563',
                    padding: '4px 3px', textAlign: 'center', verticalAlign: 'middle',
                    fontWeight: 700, fontSize: '10px', lineHeight: '1.4',
                  }}>
                    <div>{format(monthDate, 'MMM', { locale: fr }).toUpperCase()}</div>
                    <div>{format(monthDate, 'yyyy')}</div>
                  </td>
                  {/* W-End : flèche — sticky */}
                  <td style={{
                    ...stickyLeft1,
                    background: '#374151', color: '#9ca3af',
                    border: '1px solid #4b5563',
                    textAlign: 'center', verticalAlign: 'middle',
                  }}>
                    {isCollapsed
                      ? <ChevronDown style={{ width: 14, height: 14, margin: '0 auto' }} />
                      : <ChevronUp style={{ width: 14, height: 14, margin: '0 auto' }} />
                    }
                  </td>
                  {/* Cellule grise étendue — fond uniquement, sans texte */}
                  <td colSpan={columns.length} style={{
                    background: '#374151',
                    border: '1px solid #4b5563',
                    padding: '4px 12px',
                  }}>
                    {!hasEvents && !filterKeyword && (
                      <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 400 }}>Aucun événement</span>
                    )}
                  </td>
                </tr>

                {/* ── LIGNES SEMAINES (affichées seulement si non rétracté) ── */}
                {!isCollapsed && monthWeeks.map(week => {
                  const isHoliday = isSchoolHoliday(week.monday, season.name)
                  const feries = getFeriesInWeek(week.monday, feriesMap)
                  const semBg  = isHoliday ? '#fef08a' : '#eff6ff'
                  const semClr = isHoliday ? '#854d0e' : '#1e40af'
                  const wendBg = isHoliday ? '#fefce8' : '#f8fafc'
                  const rowBg  = isHoliday ? '#fef9c3' : 'white'

                  return (
                    <tr key={`week-${week.week_number}`}>
                      {/* Semaine — sticky, centré verticalement */}
                      <td style={{
                        ...stickyLeft0,
                        background: semBg, color: semClr,
                        border: '1px solid #cbd5e1', borderRight: '2px solid #94a3b8',
                        padding: '4px 2px', textAlign: 'center', verticalAlign: 'middle',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>S{week.week_number}</div>
                        {isHoliday && <div style={{ fontSize: '9px', color: '#854d0e', marginTop: '1px' }}>Vacances</div>}
                        {feries.map(f => (
                          <div key={f.date} title={f.nom} style={{
                            marginTop: '3px',
                            background: '#E0F5EC', color: '#1a6b45',
                            fontSize: '8px', padding: '1px 3px', borderRadius: '2px',
                            fontWeight: 600, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            🟢 {f.nom}
                            <div style={{ fontSize: '8px', fontWeight: 400, opacity: 0.8 }}>
                              {format(parseISO(f.date), 'dd/MM')}
                            </div>
                          </div>
                        ))}
                      </td>

                      {/* W-End — sticky, centré V et H */}
                      <td style={{
                        ...stickyLeft1,
                        background: wendBg,
                        border: '1px solid #cbd5e1', borderRight: '2px solid #94a3b8',
                        borderLeft: '2px solid #bfdbfe',
                        padding: '4px 5px', verticalAlign: 'middle', textAlign: 'center',
                        color: '#64748b', fontSize: '10px', lineHeight: '1.8',
                      }}>
                        <div>Sam {format(week.saturday, 'dd/MM')}</div>
                        <div>Dim {format(week.sunday, 'dd/MM')}</div>
                      </td>

                      {/* Cellules événements */}
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

function EventBadge({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const statusColor = STATUS_BG[event.status] ?? '#94a3b8'
  const subTitle = event.subcategory ? `${event.subcategory.name} — ${event.title}` : event.title

  return (
    <button
      onClick={onClick}
      title={`${subTitle}${event.location ? ` · ${event.location}` : ''}`}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: statusColor + '22',
        border: `1px solid ${statusColor}55`,
        borderLeft: `3px solid ${statusColor}`,
        color: '#1e293b',
        padding: '2px 4px', marginBottom: '2px', borderRadius: '2px',
        fontSize: '10px', lineHeight: '1.3', cursor: 'pointer',
        overflow: 'hidden',
        textDecoration: event.status === 'annule' ? 'line-through' : 'none',
        opacity: event.status === 'annule' ? 0.6 : 1,
      }}
    >
      <span style={{ color: statusColor, fontWeight: 600, fontSize: '9px', marginRight: '3px' }}>
        {formatShortDate(event.start_date)}
      </span>
      <strong style={{ fontWeight: 500 }}>{subTitle}</strong>
      {event.location && <span style={{ color: '#64748b' }}> · {event.location}</span>}
    </button>
  )
}
