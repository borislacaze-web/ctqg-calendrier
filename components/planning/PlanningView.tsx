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

function blend(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgb(${Math.round(r*alpha+255*(1-alpha))},${Math.round(g*alpha+255*(1-alpha))},${Math.round(b*alpha+255*(1-alpha))})`
}

const STATUS_COLOR: Record<string, string> = {
  previsionnel: '#94a3b8',
  confirme:     '#22c55e',
  annule:       '#ef4444',
  reporte:      '#f97316',
}

const W_SEM  = 82
const W_WEND = 96
const W_COL  = 130
const H1     = 28   // hauteur ligne catégories
const H2     = 42   // hauteur ligne sous-catégories

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

export default function PlanningView({ events, categories, subcategories, season, onEventClick, filterCategoryId, filterMonth, filterKeyword }: Props) {
  const startYear = parseInt(season.name.split('/')[0])
  const feriesMap = useMemo(() => getJoursFeriesSaison(startYear), [startYear])

  const weeks = useMemo(() => assignEventsToWeeks(getSeasonWeeks(season.start_date, season.end_date), events), [season, events])

  // Mois rétractés par défaut : juin/juil/août + mois passés
  const defaultCollapsed = useMemo(() => {
    const now = new Date()
    const seen: string[] = []
    const collapsed = new Set<string>()
    weeks.forEach(w => {
      const key = format(w.monday, 'yyyy-MM')
      if (!seen.includes(key)) seen.push(key)
    })
    seen.forEach(key => {
      const p = key.split('-')
      const y = parseInt(p[0]), m = parseInt(p[1])
      if (m === 6 || m === 7 || m === 8) { collapsed.add(key); return }
      if (isBefore(new Date(y, m-1, 1), startOfMonth(now))) collapsed.add(key)
    })
    return collapsed
  }, [weeks])

  const [collapsed, setCollapsed] = useState<Set<string>>(defaultCollapsed)

  const columns = useMemo(() => {
    const cols: { catId: string; catName: string; catColor: string; subId: string|null; subName: string|null; key: string }[] = []
    const cats = filterCategoryId ? categories.filter(c => c.id === filterCategoryId) : categories
    for (const cat of cats) {
      const subs = subcategories.filter(s => s.category_id === cat.id && s.is_active)
      if (subs.length === 0) {
        cols.push({ catId: cat.id, catName: cat.name, catColor: cat.color, subId: null, subName: null, key: `cat-${cat.id}` })
      } else {
        subs.forEach(sub => cols.push({ catId: cat.id, catName: cat.name, catColor: cat.color, subId: sub.id, subName: sub.name, key: `sub-${sub.id}` }))
      }
    }
    return cols
  }, [categories, subcategories, filterCategoryId])

  const catGroups = useMemo(() => {
    const groups: { catId: string; catName: string; catColor: string; span: number }[] = []
    columns.forEach(col => {
      const last = groups[groups.length - 1]
      if (last?.catId === col.catId) last.span++
      else groups.push({ catId: col.catId, catName: col.catName, catColor: col.catColor, span: 1 })
    })
    return groups
  }, [columns])

  const weeksByMonth = useMemo(() => {
    const map = new Map<string, typeof weeks>()
    weeks.forEach(w => {
      const k = format(w.monday, 'yyyy-MM')
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(w)
    })
    return map
  }, [weeks])

  const match = (ev: CalendarEvent) => {
    if (!filterKeyword) return true
    const kw = filterKeyword.toLowerCase()
    return ev.title.toLowerCase().includes(kw) || (ev.description ?? '').toLowerCase().includes(kw) || (ev.location ?? '').toLowerCase().includes(kw)
  }

  const colEvents = (weekEvs: CalendarEvent[], col: typeof columns[0]) =>
    weekEvs.filter(e => {
      if (e.category_id !== col.catId) return false
      if (col.subId !== null && e.subcategory_id !== col.subId) return false
      if (col.subId === null && subcategories.some(s => s.category_id === col.catId && s.is_active && e.subcategory_id === s.id)) return false
      if (!match(e)) return false
      if (filterMonth && new Date(e.start_date).getMonth()+1 !== parseInt(filterMonth)) return false
      return true
    })

  const tableW = W_SEM + W_WEND + columns.length * W_COL

  // Styles sticky réutilisables
  const TH_SEM: React.CSSProperties = {
    position: 'sticky', left: 0, zIndex: 50,
    background: '#1e3a8a', color: 'white',
    border: '1px solid #2d4fb5',
    textAlign: 'center', verticalAlign: 'middle',
    fontWeight: 700, fontSize: '11px',
    width: W_SEM, minWidth: W_SEM,
  }
  const TH_WEND: React.CSSProperties = {
    position: 'sticky', left: W_SEM, zIndex: 50,
    background: '#1e3a8a', color: 'white',
    border: '1px solid #2d4fb5', borderLeft: '2px solid #60a5fa',
    textAlign: 'center', verticalAlign: 'middle',
    fontWeight: 700, fontSize: '11px',
    width: W_WEND, minWidth: W_WEND,
  }
  const TD_SEM_MONTH: React.CSSProperties = {
    position: 'sticky', left: 0, zIndex: 10,
    background: '#374151', color: 'white',
    border: '1px solid #4b5563',
    textAlign: 'center', verticalAlign: 'middle',
    fontWeight: 700, fontSize: '10px', lineHeight: '1.4',
    width: W_SEM,
  }
  const TD_WEND_MONTH: React.CSSProperties = {
    position: 'sticky', left: W_SEM, zIndex: 10,
    background: '#374151', color: '#9ca3af',
    border: '1px solid #4b5563',
    textAlign: 'center', verticalAlign: 'middle',
    width: W_WEND,
  }

  return (
    <div
      id="body-scroll"
      style={{ width: '100%', overflowX: 'scroll', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)', position: 'relative' }}
      onScroll={e => {
        const hs = document.getElementById('header-scroll')
        if (hs) hs.scrollLeft = (e.target as HTMLDivElement).scrollLeft
      }}
    >
      {/* ══ EN-TÊTES (sticky top, scroll horizontal synchronisé) ══ */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, height: H1+H2, width: tableW, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
        <div id="header-scroll" style={{ overflowX: 'hidden', width: tableW }}>
          <table style={{ tableLayout: 'fixed', width: tableW, borderCollapse: 'separate', borderSpacing: 0 }}>
            <colgroup>
              <col style={{ width: W_SEM }} />
              <col style={{ width: W_WEND }} />
              {columns.map(col => <col key={col.key} style={{ width: W_COL }} />)}
            </colgroup>
            <tbody>
              {/* Ligne 1 : Semaine (rowspan) | W-End (rowspan) | Catégories */}
              <tr style={{ height: H1 }}>
                <td rowSpan={2} style={{ ...TH_SEM, height: H1+H2 }}>Semaine</td>
                <td rowSpan={2} style={{ ...TH_WEND, height: H1+H2 }}>W-End</td>
                {catGroups.map(g => (
                  <td key={g.catId} colSpan={g.span} style={{
                    background: blend(g.catColor, 0.15), color: g.catColor,
                    border: `1px solid ${g.catColor}88`, borderBottom: `2px solid ${g.catColor}`,
                    textAlign: 'center', verticalAlign: 'middle',
                    fontWeight: 700, fontSize: '11px', height: H1,
                  }}>{g.catName}</td>
                ))}
              </tr>
              {/* Ligne 2 : sous-catégories */}
              <tr style={{ height: H2 }}>
                {columns.map(col => (
                  <td key={col.key} style={{
                    background: blend(col.catColor, 0.07), color: col.catColor,
                    border: `1px solid ${col.catColor}55`, borderTop: 'none',
                    textAlign: 'center', verticalAlign: 'middle',
                    fontWeight: 500, fontSize: '10px', lineHeight: '1.2',
                    whiteSpace: 'normal', padding: '3px', height: H2,
                  }}>{col.subName ?? ''}</td>
                ))}
              </tr>
            </tbody>
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
            const isCollapsed = collapsed.has(monthKey)
            const p = monthKey.split('-')
            const monthDate = new Date(parseInt(p[0]), parseInt(p[1])-1, 1)
            const monthLabel = format(monthDate, 'MMMM yyyy', { locale: fr })
            const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
            const hasEvts = monthWeeks.some(w => columns.some(col => colEvents(w.events, col).length > 0))

            if (filterMonth) {
              const fm = parseInt(filterMonth)
              if (!monthWeeks.some(w => w.monday.getMonth()+1 === fm)) return null
            }

            return (
              <>
                {/* Ligne mois */}
                <tr key={`m-${monthKey}`} onClick={() => setCollapsed(prev => { const n = new Set(prev); if (n.has(monthKey)) n.delete(monthKey); else n.add(monthKey); return n })} style={{ cursor: 'pointer' }}>
                  {/* Semaine : nom abrégé du mois */}
                  <td style={TD_SEM_MONTH}>
                    <div>{format(monthDate, 'MMM', { locale: fr }).toUpperCase()}</div>
                    <div>{format(monthDate, 'yyyy')}</div>
                  </td>
                  {/* W-End : flèche */}
                  <td style={TD_WEND_MONTH}>
                    {isCollapsed
                      ? <ChevronDown style={{ width: 14, height: 14, margin: '0 auto' }} />
                      : <ChevronUp style={{ width: 14, height: 14, margin: '0 auto' }} />
                    }
                  </td>
                  {/* Reste : fond gris + "aucun événement" si besoin */}
                  <td colSpan={columns.length} style={{ background: '#374151', border: '1px solid #4b5563', padding: '4px 12px' }}>
                    {!hasEvts && !filterKeyword && (
                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>Aucun événement</span>
                    )}
                  </td>
                </tr>

                {/* Lignes semaines */}
                {!isCollapsed && monthWeeks.map(week => {
                  const isHoliday = isSchoolHoliday(week.monday, season.name)
                  const feries = getFeriesInWeek(week.monday, feriesMap)
                  const semBg  = isHoliday ? '#fef08a' : '#eff6ff'
                  const semClr = isHoliday ? '#854d0e' : '#1e40af'
                  const wendBg = isHoliday ? '#fefce8' : '#f8fafc'
                  const rowBg  = isHoliday ? '#fef9c3' : 'white'

                  return (
                    <tr key={`w-${week.week_number}`}>
                      {/* Semaine — sticky, centré H+V */}
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 10,
                        background: semBg, color: semClr,
                        border: '1px solid #cbd5e1', borderRight: '2px solid #94a3b8',
                        textAlign: 'center', verticalAlign: 'middle',
                        padding: '4px 2px',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>S{week.week_number}</div>
                        {isHoliday && <div style={{ fontSize: '9px', color: '#854d0e' }}>Vacances</div>}
                        {feries.map(f => (
                          <div key={f.date} title={f.nom} style={{
                            marginTop: '3px', background: '#E0F5EC', color: '#1a6b45',
                            fontSize: '8px', padding: '1px 3px', borderRadius: '2px',
                            fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            🟢 {f.nom}
                            <div style={{ fontWeight: 400, opacity: 0.8 }}>{format(parseISO(f.date), 'dd/MM')}</div>
                          </div>
                        ))}
                      </td>

                      {/* W-End — sticky, centré H+V */}
                      <td style={{
                        position: 'sticky', left: W_SEM, zIndex: 10,
                        background: wendBg,
                        border: '1px solid #cbd5e1', borderRight: '2px solid #94a3b8', borderLeft: '2px solid #bfdbfe',
                        textAlign: 'center', verticalAlign: 'middle',
                        color: '#64748b', fontSize: '10px', lineHeight: '1.8', padding: '4px 5px',
                      }}>
                        <div>Sam {format(week.saturday, 'dd/MM')}</div>
                        <div>Dim {format(week.sunday, 'dd/MM')}</div>
                      </td>

                      {/* Cellules données */}
                      {columns.map(col => (
                        <td key={col.key} style={{
                          border: '1px solid #dde3ec', borderLeft: `2px solid ${col.catColor}44`,
                          padding: '3px', verticalAlign: 'top', background: rowBg,
                        }}>
                          {colEvents(week.events, col).map(ev => (
                            <EventBadge key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
                          ))}
                        </td>
                      ))}
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
  const color = STATUS_COLOR[event.status] ?? '#94a3b8'
  const title = event.subcategory ? `${event.subcategory.name} — ${event.title}` : event.title
  return (
    <button onClick={onClick}
      title={`${title}${event.location ? ` · ${event.location}` : ''}`}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: color + '22', border: `1px solid ${color}55`, borderLeft: `3px solid ${color}`,
        color: '#1e293b', padding: '2px 4px', marginBottom: '2px', borderRadius: '2px',
        fontSize: '10px', lineHeight: '1.3', cursor: 'pointer', overflow: 'hidden',
        textDecoration: event.status === 'annule' ? 'line-through' : 'none',
        opacity: event.status === 'annule' ? 0.6 : 1,
      }}
    >
      <span style={{ color, fontWeight: 600, fontSize: '9px', marginRight: '3px' }}>{formatShortDate(event.start_date)}</span>
      <strong style={{ fontWeight: 500 }}>{title}</strong>
      {event.location && <span style={{ color: '#64748b' }}> · {event.location}</span>}
    </button>
  )
}
