// components/planning/PlanningView.tsx
'use client'
import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { format, isBefore, startOfMonth, parseISO, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { CalendarEvent, Category, Subcategory, Season } from '@/types'
import {
  getSeasonWeeks, assignEventsToWeeks, isSchoolHoliday,
  formatShortDate, getJoursFeriesSaison, getFeriesInWeek
} from '@/lib/week-utils'

function blend(hex: string, a: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgb(${Math.round(r*a+255*(1-a))},${Math.round(g*a+255*(1-a))},${Math.round(b*a+255*(1-a))})`
}

const STATUS_COLOR: Record<string,string> = {
  previsionnel: '#94a3b8', confirme: '#22c55e', annule: '#ef4444', reporte: '#f97316',
}

const W_SEM  = 82
const W_WEND = 96
const W_COL  = 130
const H1 = 28
const H2 = 42

interface Props {
  events: CalendarEvent[]
  categories: Category[]
  subcategories: Subcategory[]
  season: Season
  onEventClick: (event: CalendarEvent) => void
  onEventDoubleClick?: (event: CalendarEvent) => void
  onDuplicateToWeek?: (event: CalendarEvent, targetSaturday: Date) => Promise<void>
  filterCategoryId?: string
  filterMonth?: string
  filterKeyword?: string
  isAdmin?: boolean
}

interface DragState {
  event: CalendarEvent
  ghost: HTMLDivElement
}

export default function PlanningView({
  events, categories, subcategories, season,
  onEventClick, onEventDoubleClick, onDuplicateToWeek,
  filterCategoryId, filterMonth, filterKeyword,
  isAdmin,
}: Props) {
  const startYear = parseInt(season.name.split('/')[0])
  const feriesMap = useMemo(() => getJoursFeriesSaison(startYear), [startYear])
  const weeks = useMemo(() => assignEventsToWeeks(getSeasonWeeks(season.start_date, season.end_date), events), [season, events])

  const defaultCollapsed = useMemo(() => {
    const now = new Date()
    const seen: string[] = []
    const col = new Set<string>()
    weeks.forEach(w => { const k = format(w.saturday, 'yyyy-MM'); if (!seen.includes(k)) seen.push(k) })
    seen.forEach(key => {
      const p = key.split('-'), y = parseInt(p[0]), m = parseInt(p[1])
      if (m === 6 || m === 7 || m === 8) { col.add(key); return }
      if (isBefore(new Date(y, m-1, 1), startOfMonth(now))) col.add(key)
    })
    return col
  }, [weeks])

  const [collapsed, setCollapsed] = useState<Set<string>>(defaultCollapsed)

  /*
    ARCHITECTURE — 4 zones synchronisées :
    ┌──────────────┬─────────────────────────────┐
    │  fixedHeader │       scrollHeader           │  ← jamais de scroll vertical
    ├──────────────┼─────────────────────────────┤
    │  fixedBody   │       scrollBody             │  ← scroll vertical synchronisé
    └──────────────┴─────────────────────────────┘
    fixedHeader/fixedBody : overflow hidden, largeur W_SEM+W_WEND
    scrollHeader : overflow-x hidden (synchronisé par JS avec scrollBody)
    scrollBody   : overflow auto (scroll libre)
    Sync vertical  : scrollBody → fixedBody
    Sync horizontal: scrollBody → scrollHeader
    Aucun td sticky nulle part → zéro conflit de stacking context
  */
  const fixedBodyRef  = useRef<HTMLDivElement>(null)
  const fixedBodyTableRef = useRef<HTMLTableElement>(null)
  const scrollBodyTableRef = useRef<HTMLTableElement>(null)
  const scrollBodyRef = useRef<HTMLDivElement>(null)
  const scrollHeaderRef = useRef<HTMLDivElement>(null)

  // Synchronisation des hauteurs de lignes entre colonne fixe et zone scrollable
  const syncRowHeights = useCallback(() => {
    const fixedTable  = fixedBodyTableRef.current
    const scrollTable = scrollBodyTableRef.current
    if (!fixedTable || !scrollTable) return

    const fixedRows  = Array.from(fixedTable.querySelectorAll('tr'))
    const scrollRows = Array.from(scrollTable.querySelectorAll('tr'))
    const len = Math.min(fixedRows.length, scrollRows.length)

    for (let i = 0; i < len; i++) {
      // Reset d'abord pour mesurer la hauteur naturelle
      ;(fixedRows[i] as HTMLElement).style.height = ''
      ;(scrollRows[i] as HTMLElement).style.height = ''
    }
    for (let i = 0; i < len; i++) {
      const h = Math.ceil(Math.max(
        (fixedRows[i] as HTMLElement).getBoundingClientRect().height,
        (scrollRows[i] as HTMLElement).getBoundingClientRect().height,
      ))
      ;(fixedRows[i] as HTMLElement).style.height = `${h}px`
      ;(scrollRows[i] as HTMLElement).style.height = `${h}px`
    }
  }, [])

  useEffect(() => {
    const sb = scrollBodyRef.current
    const fb = fixedBodyRef.current
    const sh = scrollHeaderRef.current
    if (!sb || !fb || !sh) return
    const onScroll = () => {
      fb.scrollTop   = sb.scrollTop
      sh.scrollLeft  = sb.scrollLeft
    }
    sb.addEventListener('scroll', onScroll, { passive: true })
    return () => sb.removeEventListener('scroll', onScroll)
  }, [])

  // Sync hauteurs après chaque render ET si le contenu change de taille
  useEffect(() => {
    syncRowHeights()
    const scrollTable = scrollBodyTableRef.current
    if (!scrollTable) return
    const ro = new ResizeObserver(syncRowHeights)
    ro.observe(scrollTable)
    return () => ro.disconnect()
  })

  // ── Drag-to-duplicate ──
  const dragRef = useRef<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState(false)

  const createGhost = useCallback((event: CalendarEvent, x: number, y: number) => {
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position:fixed;z-index:9999;pointer-events:none;
      background:#1e3a8a;color:white;
      padding:4px 10px;border-radius:6px;
      font-size:11px;font-weight:600;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);
      display:flex;align-items:center;gap:6px;
      white-space:nowrap;opacity:0.92;
      left:${x+14}px;top:${y-10}px;
    `
    ghost.innerHTML = `<span style="font-size:13px">⎘</span> ${event.title}`
    document.body.appendChild(ghost)
    return ghost
  }, [])

  const handleBadgeMouseDown = useCallback((e: React.MouseEvent, event: CalendarEvent) => {
    if (!e.ctrlKey || !isAdmin || !onDuplicateToWeek) return
    e.preventDefault(); e.stopPropagation()
    const ghost = createGhost(event, e.clientX, e.clientY)
    dragRef.current = { event, ghost }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'copy'
  }, [isAdmin, onDuplicateToWeek, createGhost])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragRef.current; if (!ds) return
      ds.ghost.style.left = `${e.clientX+14}px`
      ds.ghost.style.top  = `${e.clientY-10}px`
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const cell = el?.closest('[data-saturday]') as HTMLElement | null
      setDropTarget(cell?.dataset.saturday ?? null)
    }
    const onUp = async () => {
      const ds = dragRef.current; if (!ds) return
      ds.ghost.remove(); dragRef.current = null
      document.body.style.userSelect = ''; document.body.style.cursor = ''
      const satStr = dropTarget; setDropTarget(null)
      if (!satStr || !onDuplicateToWeek) return
      const targetSaturday = new Date(satStr + 'T12:00:00')
      setDuplicating(true)
      try { await onDuplicateToWeek(ds.event, targetSaturday) }
      finally { setDuplicating(false) }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dropTarget, onDuplicateToWeek])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Control' && dragRef.current) {
        dragRef.current.ghost.remove(); dragRef.current = null
        document.body.style.userSelect = ''; document.body.style.cursor = ''
        setDropTarget(null)
      }
    }
    window.addEventListener('keyup', onKey)
    return () => window.removeEventListener('keyup', onKey)
  }, [])

  const columns = useMemo(() => {
    const cols: { catId: string; catName: string; catColor: string; subId: string|null; subName: string|null; key: string }[] = []
    const cats = filterCategoryId ? categories.filter(c => c.id === filterCategoryId) : categories
    for (const cat of cats) {
      const subs = subcategories.filter(s => s.category_id === cat.id && s.is_active)
      if (subs.length === 0) cols.push({ catId: cat.id, catName: cat.name, catColor: cat.color, subId: null, subName: null, key: `cat-${cat.id}` })
      else subs.forEach(sub => cols.push({ catId: cat.id, catName: cat.name, catColor: cat.color, subId: sub.id, subName: sub.name, key: `sub-${sub.id}` }))
    }
    return cols
  }, [categories, subcategories, filterCategoryId])

  const catGroups = useMemo(() => {
    const groups: { catId: string; catName: string; catColor: string; span: number }[] = []
    columns.forEach(col => { const last = groups[groups.length-1]; if (last?.catId === col.catId) last.span++; else groups.push({ catId: col.catId, catName: col.catName, catColor: col.catColor, span: 1 }) })
    return groups
  }, [columns])

  const weeksByMonth = useMemo(() => {
    const map = new Map<string, typeof weeks>()
    weeks.forEach(w => { const k = format(w.saturday, 'yyyy-MM'); if (!map.has(k)) map.set(k, []); map.get(k)!.push(w) })
    return map
  }, [weeks])

  const matchEv = (ev: CalendarEvent) => {
    if (!filterKeyword) return true
    const kw = filterKeyword.toLowerCase()
    return ev.title.toLowerCase().includes(kw) || (ev.description ?? '').toLowerCase().includes(kw) || (ev.location ?? '').toLowerCase().includes(kw)
  }

  const getColEvs = (weekEvs: CalendarEvent[], col: typeof columns[0]) =>
    weekEvs.filter(e => {
      if (e.category_id !== col.catId) return false
      if (col.subId !== null && e.subcategory_id !== col.subId) return false
      if (col.subId === null && subcategories.some(s => s.category_id === col.catId && s.is_active && e.subcategory_id === s.id)) return false
      if (!matchEv(e)) return false
      if (filterMonth && new Date(e.start_date).getMonth()+1 !== parseInt(filterMonth)) return false
      return true
    })

  const colsW = columns.length * W_COL
  const fixedW = W_SEM + W_WEND

  // ── Styles communs ──
  const semTdStyle = (bg: string, color: string): React.CSSProperties => ({
    background: bg, color,
    border: '1px solid #cbd5e1', borderRight: '2px solid #94a3b8',
    textAlign: 'center', verticalAlign: 'middle', padding: '4px 2px',
    width: W_SEM, minWidth: W_SEM, maxWidth: W_SEM,
  })
  const wendTdStyle = (bg: string): React.CSSProperties => ({
    background: bg,
    border: '1px solid #cbd5e1', borderLeft: '2px solid #bfdbfe', borderRight: '2px solid #94a3b8',
    textAlign: 'center', verticalAlign: 'middle', color: '#64748b',
    fontSize: '10px', lineHeight: '1.8', padding: '4px 5px',
    width: W_WEND, minWidth: W_WEND, maxWidth: W_WEND,
  })
  const semMonthStyle: React.CSSProperties = {
    background: '#374151', color: 'white',
    border: '1px solid #4b5563',
    textAlign: 'center', verticalAlign: 'middle',
    fontWeight: 700, fontSize: '10px', lineHeight: '1.4', padding: '4px 2px',
    width: W_SEM, minWidth: W_SEM, maxWidth: W_SEM,
  }
  const wendMonthStyle: React.CSSProperties = {
    background: '#374151', color: '#9ca3af',
    border: '1px solid #4b5563',
    textAlign: 'center', verticalAlign: 'middle',
    width: W_WEND, minWidth: W_WEND, maxWidth: W_WEND,
  }

  // Rendu des lignes de la colonne fixe (Semaine + W-End)
  const renderFixedRows = () =>
    Array.from(weeksByMonth.entries()).map(([monthKey, monthWeeks]) => {
      if (filterMonth) {
        const fm = parseInt(filterMonth)
        if (!monthWeeks.some(w => w.saturday.getMonth()+1 === fm)) return null
      }
      const isCol = collapsed.has(monthKey)
      const p = monthKey.split('-')
      const monthDate = new Date(parseInt(p[0]), parseInt(p[1])-1, 1)
      return (
        <>
          {/* Ligne mois */}
          <tr key={`mf-${monthKey}`}
            onClick={() => setCollapsed(prev => { const n = new Set(prev); if (n.has(monthKey)) n.delete(monthKey); else n.add(monthKey); return n })}
            style={{ cursor: 'pointer' }}>
            <td style={semMonthStyle}>
              <div>{format(monthDate, 'MMM', { locale: fr }).toUpperCase()}</div>
              <div style={{ fontSize: '9px', fontWeight: 400 }}>{format(monthDate, 'yyyy')}</div>
            </td>
            <td style={wendMonthStyle}>
              {isCol ? <ChevronDown style={{ width: 14, height: 14, margin: '0 auto' }} /> : <ChevronUp style={{ width: 14, height: 14, margin: '0 auto' }} />}
            </td>
          </tr>
          {/* Lignes semaines */}
          {!isCol && monthWeeks.map(week => {
            const isHol = isSchoolHoliday(week.monday, season.name)
            const feries = getFeriesInWeek(week.monday, feriesMap)
            return (
              <tr key={`wf-${week.week_number}`}>
                <td style={semTdStyle(isHol ? '#fef08a' : '#eff6ff', isHol ? '#854d0e' : '#1e40af')}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>S{week.week_number}</div>
                  {isHol && <div style={{ fontSize: '9px', color: '#854d0e' }}>Vacances</div>}
                  {feries.map(f => (
                    <div key={f.date} title={f.nom} style={{ marginTop: '3px', background: '#E0F5EC', color: '#1a6b45', fontSize: '8px', padding: '1px 3px', borderRadius: '2px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      🟢 {f.nom}
                      <div style={{ fontWeight: 400 }}>{format(parseISO(f.date), 'dd/MM')}</div>
                    </div>
                  ))}
                </td>
                <td style={wendTdStyle(isHol ? '#fefce8' : '#f8fafc')}>
                  <div>Sam {format(week.saturday, 'dd/MM')}</div>
                  <div>Dim {format(week.sunday, 'dd/MM')}</div>
                </td>
              </tr>
            )
          })}
        </>
      )
    })

  // Rendu des lignes de la zone scrollable (colonnes événements)
  const renderScrollRows = () =>
    Array.from(weeksByMonth.entries()).map(([monthKey, monthWeeks]) => {
      if (filterMonth) {
        const fm = parseInt(filterMonth)
        if (!monthWeeks.some(w => w.saturday.getMonth()+1 === fm)) return null
      }
      const isCol = collapsed.has(monthKey)
      const hasEvts = monthWeeks.some(w => columns.some(col => getColEvs(w.events, col).length > 0))
      return (
        <>
          {/* Ligne mois */}
          <tr key={`ms-${monthKey}`}
            onClick={() => setCollapsed(prev => { const n = new Set(prev); if (n.has(monthKey)) n.delete(monthKey); else n.add(monthKey); return n })}
            style={{ cursor: 'pointer' }}>
            <td colSpan={columns.length} style={{ background: '#374151', border: '1px solid #4b5563', padding: '4px 12px' }}>
              {!hasEvts && !filterKeyword && <span style={{ fontSize: '10px', color: '#9ca3af' }}>Aucun événement</span>}
            </td>
          </tr>
          {/* Lignes semaines */}
          {!isCol && monthWeeks.map(week => {
            const isHol = isSchoolHoliday(week.monday, season.name)
            const satStr = format(week.saturday, 'yyyy-MM-dd')
            const isDropTarget = dropTarget === satStr
            return (
              <tr key={`ws-${week.week_number}`}>
                {columns.map(col => (
                  <td key={col.key} data-saturday={satStr} style={{
                    border: '1px solid #dde3ec',
                    borderLeft: `2px solid ${col.catColor}44`,
                    padding: '3px', verticalAlign: 'top',
                    background: isDropTarget ? '#dbeafe' : isHol ? '#fef9c3' : 'white',
                    outline: isDropTarget ? '2px dashed #3b82f6' : 'none',
                    outlineOffset: '-2px',
                    transition: 'background 0.1s',
                    width: W_COL, minWidth: W_COL,
                  }}>
                    {getColEvs(week.events, col).map(ev => (
                      <EventBadge
                        key={ev.id}
                        event={ev}
                        onClick={() => onEventClick(ev)}
                        onDoubleClick={isAdmin && onEventDoubleClick ? () => onEventDoubleClick(ev) : undefined}
                        onMouseDown={(e) => handleBadgeMouseDown(e, ev)}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </td>
                ))}
              </tr>
            )
          })}
        </>
      )
    })

  return (
    <div id="planning-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {duplicating && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#1e3a8a', color: 'white', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 10000, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Duplication en cours…
        </div>
      )}

      {/* ══ HEADER ROW ══ */}
      <div style={{ display: 'flex', flexShrink: 0 }}>

        {/* Header fixe gauche : Semaine + W-End */}
        <div style={{ width: fixedW, minWidth: fixedW, overflow: 'hidden', flexShrink: 0 }}>
          <table style={{ tableLayout: 'fixed', width: fixedW, borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px' }}>
            <colgroup>
              <col style={{ width: W_SEM }} />
              <col style={{ width: W_WEND }} />
            </colgroup>
            <thead>
              <tr style={{ height: H1 + H2 }}>
                <th style={{ background: '#1e3a8a', color: 'white', border: '1px solid #2d4fb5', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: '11px', height: H1+H2 }}>Semaine</th>
                <th style={{ background: '#1e3a8a', color: 'white', border: '1px solid #2d4fb5', borderLeft: '2px solid #60a5fa', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontSize: '11px', height: H1+H2 }}>W-End</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Header scrollable droite : catégories + sous-catégories */}
        <div id="scroll-header-ref" ref={scrollHeaderRef} style={{ overflow: 'hidden', flex: 1 }}>
          <table style={{ tableLayout: 'fixed', width: colsW, borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px' }}>
            <colgroup>
              {columns.map(col => <col key={col.key} style={{ width: W_COL }} />)}
            </colgroup>
            <thead>
              <tr style={{ height: H1 }}>
                {catGroups.map(g => (
                  <th key={g.catId} colSpan={g.span} style={{
                    position: 'sticky', top: 0,
                    background: blend(g.catColor, 0.15), color: g.catColor,
                    border: `1px solid ${g.catColor}88`, borderBottom: `2px solid ${g.catColor}`,
                    textAlign: 'center', verticalAlign: 'middle',
                    fontWeight: 700, fontSize: '13px',
                    height: H1, padding: '0 4px', boxSizing: 'border-box', overflow: 'hidden',
                  }}>{g.catName}</th>
                ))}
              </tr>
              <tr style={{ height: H2 }}>
                {columns.map(col => (
                  <th key={col.key} style={{
                    position: 'sticky', top: H1,
                    background: blend(col.catColor, 0.07), color: col.catColor,
                    border: `1px solid ${col.catColor}55`, borderTop: 'none',
                    textAlign: 'center', verticalAlign: 'middle',
                    fontWeight: 500, fontSize: '12px', lineHeight: '1.2', whiteSpace: 'normal',
                    height: H2, padding: '3px', boxSizing: 'border-box',
                  }}>{col.subName ?? ''}</th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* ══ BODY ROW ══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Corps fixe gauche : Semaine + W-End — scroll vertical synchronisé, jamais horizontal */}
        <div id="fixed-body-ref" ref={fixedBodyRef} style={{ width: fixedW, minWidth: fixedW, overflowY: 'hidden', overflowX: 'hidden', flexShrink: 0 }}>
          <table ref={fixedBodyTableRef} style={{ tableLayout: 'fixed', width: fixedW, borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px' }}>
            <colgroup>
              <col style={{ width: W_SEM }} />
              <col style={{ width: W_WEND }} />
            </colgroup>
            <tbody>{renderFixedRows()}</tbody>
          </table>
        </div>

        {/* Corps scrollable droite : colonnes événements */}
        <div id="scroll-body-ref" ref={scrollBodyRef} style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table ref={scrollBodyTableRef} style={{ tableLayout: 'fixed', width: colsW, borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px' }}>
            <colgroup>
              {columns.map(col => <col key={col.key} style={{ width: W_COL }} />)}
            </colgroup>
            <tbody>{renderScrollRows()}</tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function EventBadge({
  event, onClick, onDoubleClick, onMouseDown, isAdmin,
}: {
  event: CalendarEvent
  onClick: () => void
  onDoubleClick?: () => void
  onMouseDown?: (e: React.MouseEvent) => void
  isAdmin?: boolean
}) {
  const color = STATUS_COLOR[event.status] ?? '#94a3b8'
  const title = event.subcategory ? `${event.subcategory.name} — ${event.title}` : event.title
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClick = () => {
    if (!onDoubleClick) { onClick(); return }
    if (clickTimer.current) {
      clearTimeout(clickTimer.current); clickTimer.current = null
      onDoubleClick()
    } else {
      clickTimer.current = setTimeout(() => { clickTimer.current = null; onClick() }, 220)
    }
  }

  return (
    <button
      onClick={handleClick}
      onMouseDown={onMouseDown}
      title={`${title}${event.location ? ` · ${event.location}` : ''}`}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: color+'22', border: `1px solid ${color}55`,
        borderLeft: `3px solid ${color}`, color: '#1e293b',
        padding: '2px 4px', marginBottom: '2px', borderRadius: '2px',
        fontSize: '10px', lineHeight: '1.3',
        cursor: isAdmin ? 'grab' : 'pointer',
        overflow: 'hidden',
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
