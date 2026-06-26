// components/planning/PlanningView.tsx
'use client'
import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { CalendarEvent, Category, Season } from '@/types'
import { getSeasonWeeks, assignEventsToWeeks } from '@/lib/week-utils'
import { cn } from '@/lib/utils'

interface Props {
  events: CalendarEvent[]
  categories: Category[]
  season: Season
  onEventClick: (event: CalendarEvent) => void
  filterCategoryId?: string
  filterMonth?: string
  filterKeyword?: string
}

export default function PlanningView({
  events, categories, season, onEventClick,
  filterCategoryId, filterMonth, filterKeyword
}: Props) {
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())

  const weeks = useMemo(() => {
    const allWeeks = getSeasonWeeks(season.start_date, season.end_date)
    return assignEventsToWeeks(allWeeks, events)
  }, [season, events])

  // Catégories visibles (filtre actif ou toutes)
  const visibleCats = filterCategoryId
    ? categories.filter(c => c.id === filterCategoryId)
    : categories

  // Regrouper semaines par mois (selon le lundi)
  const weeksByMonth = useMemo(() => {
    const map = new Map<string, typeof weeks>()
    for (const week of weeks) {
      const monthKey = format(week.monday, 'yyyy-MM')
      if (!map.has(monthKey)) map.set(monthKey, [])
      map.get(monthKey)!.push(week)
    }
    return map
  }, [weeks])

  const toggleMonth = (key: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const matchesKeyword = (ev: CalendarEvent) => {
    if (!filterKeyword) return true
    const kw = filterKeyword.toLowerCase()
    return (
      ev.title.toLowerCase().includes(kw) ||
      (ev.description ?? '').toLowerCase().includes(kw) ||
      (ev.location ?? '').toLowerCase().includes(kw)
    )
  }

  const getWeekEvents = (weekEvents: CalendarEvent[], catId: string) =>
    weekEvents.filter(e =>
      e.category_id === catId &&
      (!filterCategoryId || e.category_id === filterCategoryId) &&
      (!filterMonth || new Date(e.start_date).getMonth() + 1 === parseInt(filterMonth)) &&
      matchesKeyword(e)
    )

  return (
    <div className="planning-scroll">
      <table className="planning-table w-full border-collapse text-xs">
        {/* En-tête fixe : catégories */}
        <thead className="sticky top-0 z-20 bg-white">
          <tr>
            <th className="border border-slate-300 bg-blue-800 text-white px-2 py-2 text-left min-w-[80px] w-20 font-semibold">
              Semaine
            </th>
            <th className="border border-slate-300 bg-blue-800 text-white px-2 py-2 text-center min-w-[70px] w-20 font-semibold text-[11px]">
              Ven–Dim
            </th>
            {visibleCats.map(cat => (
              <th
                key={cat.id}
                className="border border-slate-300 px-2 py-2 text-center font-semibold text-[11px] min-w-[110px]"
                style={{ backgroundColor: cat.color + '22', color: cat.color }}
              >
                {cat.name}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from(weeksByMonth.entries()).map(([monthKey, monthWeeks]) => {
            const isCollapsed = collapsedMonths.has(monthKey)
            const monthLabel = format(monthWeeks[0].monday, 'MMMM yyyy', { locale: fr })
            const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

            // Vérifier si ce mois a des événements visibles
            const hasEvents = monthWeeks.some(w =>
              visibleCats.some(cat => getWeekEvents(w.events, cat.id).length > 0)
            )

            // Filtrer par mois si filtre actif
            if (filterMonth) {
              const monthNum = parseInt(filterMonth)
              const weekMonths = monthWeeks.map(w => w.monday.getMonth() + 1)
              if (!weekMonths.some(m => m === monthNum)) return null
            }

            return (
              <>
                {/* Ligne mois */}
                <tr key={`month-${monthKey}`}>
                  <td
                    colSpan={2 + visibleCats.length}
                    className="bg-slate-700 text-white font-bold px-3 py-1.5 cursor-pointer select-none hover:bg-slate-600 transition-colors"
                    onClick={() => toggleMonth(monthKey)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] tracking-wide uppercase">{monthLabelCap}</span>
                      <div className="flex items-center gap-2">
                        {!hasEvents && !filterKeyword && (
                          <span className="text-[10px] text-slate-400 font-normal">Aucun événement</span>
                        )}
                        {isCollapsed
                          ? <ChevronDown className="w-4 h-4 text-slate-300" />
                          : <ChevronUp className="w-4 h-4 text-slate-300" />
                        }
                      </div>
                    </div>
                  </td>
                </tr>

                {/* Lignes semaines du mois */}
                {!isCollapsed && monthWeeks.map(week => (
                  <tr key={`week-${week.week_number}`} className="week-row">
                    {/* Numéro semaine */}
                    <td className="border border-slate-200 bg-blue-50 text-center font-bold text-blue-800 px-1 py-1 align-top">
                      <span className="text-[13px]">S{week.week_number}</span>
                    </td>

                    {/* Dates Ven/Sam/Dim */}
                    <td className="border border-slate-200 bg-slate-50 text-slate-500 px-1 py-1 align-top text-[10px] leading-relaxed">
                      <div>{format(week.friday,   'dd/MM')}</div>
                      <div>{format(week.saturday, 'dd/MM')}</div>
                      <div>{format(week.sunday,   'dd/MM')}</div>
                    </td>

                    {/* Cellules événements par catégorie */}
                    {visibleCats.map(cat => {
                      const catEvents = getWeekEvents(week.events, cat.id)
                      return (
                        <td
                          key={cat.id}
                          className="planning-cell"
                          style={{ borderLeftColor: cat.color + '66' }}
                        >
                          {catEvents.map(ev => (
                            <EventBadge
                              key={ev.id}
                              event={ev}
                              categoryColor={ev.color ?? cat.color}
                              onClick={() => onEventClick(ev)}
                            />
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EventBadge({
  event, categoryColor, onClick
}: {
  event: CalendarEvent
  categoryColor: string
  onClick: () => void
}) {
  const statusOpacity = {
    previsionnel: 'opacity-70',
    confirme:     'opacity-100',
    annule:       'opacity-50 line-through',
    reporte:      'opacity-80',
  }[event.status]

  const title = event.subcategory
    ? `${event.subcategory.name} — ${event.title}`
    : event.title

  return (
    <button
      onClick={onClick}
      className={cn('event-badge w-full text-left', statusOpacity)}
      style={{
        backgroundColor: categoryColor + '20',
        borderLeftColor: categoryColor,
        color: categoryColor,
      }}
      title={`${title}${event.location ? ` · ${event.location}` : ''}`}
    >
      {event.location
        ? <><strong>{title}</strong> <span className="opacity-70">· {event.location}</span></>
        : title
      }
    </button>
  )
}
