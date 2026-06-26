// components/planning/ListView.tsx
'use client'
import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { MapPin, Calendar } from 'lucide-react'
import type { CalendarEvent } from '@/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/week-utils'
import { cn } from '@/lib/utils'

interface Props {
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

export default function ListView({ events, onEventClick }: Props) {
  // Regrouper par date de début
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const key = ev.start_date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [events])

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Aucun événement trouvé</p>
        <p className="text-sm mt-1">Modifiez vos filtres ou ajoutez un événement.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {grouped.map(([date, dayEvents]) => {
        const d = parseISO(date)
        const dayLabel = format(d, 'EEEE dd MMMM yyyy', { locale: fr })
        const dayLabelCap = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)

        return (
          <div key={date}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <h3 className="font-semibold text-slate-700 text-sm">{dayLabelCap}</h3>
              <div className="flex-1 border-t border-slate-200" />
            </div>
            <div className="space-y-2 pl-5">
              {dayEvents.map(ev => {
                const color = ev.color ?? ev.category?.color ?? '#3B82F6'
                const multiDay = ev.start_date !== ev.end_date
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="w-full text-left card hover:shadow-md transition-shadow p-3 flex items-start gap-3 group"
                  >
                    <div
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {ev.category?.name}
                        </span>
                        {ev.subcategory && (
                          <span className="text-[11px] text-slate-500">{ev.subcategory.name}</span>
                        )}
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded border font-medium ml-auto',
                          STATUS_COLORS[ev.status]
                        )}>
                          {STATUS_LABELS[ev.status]}
                        </span>
                      </div>
                      <p className="font-medium text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                        {ev.title}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                        {multiDay && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            jusqu&apos;au {format(parseISO(ev.end_date), 'dd/MM/yyyy')}
                          </span>
                        )}
                        {ev.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {ev.location}
                          </span>
                        )}
                        <span className="text-blue-500">S{ev.week_number}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
