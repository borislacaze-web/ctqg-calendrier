// components/events/EventModal.tsx
'use client'
import { useEffect, useRef } from 'react'
import {
  X, MapPin, Calendar, Tag, FileText,
  AlertCircle, CheckCircle, Clock, RotateCcw, Pencil, Trash2, Copy
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CalendarEvent } from '@/types'
import { STATUS_LABELS } from '@/lib/week-utils'
import { cn } from '@/lib/utils'

const STATUS_ICONS = {
  previsionnel: Clock,
  confirme:     CheckCircle,
  annule:       AlertCircle,
  reporte:      RotateCcw,
}

const STATUS_STYLES = {
  previsionnel: 'bg-gray-100 text-gray-700',
  confirme:     'bg-green-100 text-green-800',
  annule:       'bg-red-100 text-red-700',
  reporte:      'bg-orange-100 text-orange-700',
}

interface Props {
  event: CalendarEvent | null
  isAdmin?: boolean
  onClose: () => void
  onEdit?: (event: CalendarEvent) => void
  onDelete?: (event: CalendarEvent) => void
  onDuplicate?: (event: CalendarEvent) => void
}

export default function EventModal({ event, isAdmin, onClose, onEdit, onDelete, onDuplicate }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!event) return null

  const StatusIcon = STATUS_ICONS[event.status]
  const sameDay = event.start_date === event.end_date
  const color = event.color ?? event.category?.color ?? '#3B82F6'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={ref}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up"
      >
        {/* En-tête coloré */}
        <div
          className="rounded-t-2xl px-6 py-4 flex items-start justify-between gap-2"
          style={{ backgroundColor: color + '20', borderBottom: `3px solid ${color}` }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: color }}
              >
                {event.category?.name}
              </span>
              {event.subcategory && (
                <span className="text-xs text-slate-600">{event.subcategory.name}</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{event.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10 shrink-0">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Corps */}
        <div className="px-6 py-4 space-y-3">
          {/* Statut */}
          <div className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
            STATUS_STYLES[event.status]
          )}>
            <StatusIcon className="w-4 h-4" />
            {STATUS_LABELS[event.status]}
          </div>

          {/* Date */}
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800">
                {sameDay
                  ? format(parseISO(event.start_date), 'EEEE dd MMMM yyyy', { locale: fr })
                  : `${format(parseISO(event.start_date), 'dd/MM/yyyy')} → ${format(parseISO(event.end_date), 'dd/MM/yyyy')}`
                }
              </p>
              <p className="text-xs text-slate-500">Semaine {event.week_number}</p>
            </div>
          </div>

          {/* Lieu */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">{event.location}</p>
            </div>
          )}

          {/* Public concerné */}
          {event.target_audience && (
            <div className="flex items-start gap-3">
              <Tag className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">{event.target_audience}</p>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-line">
              {event.description}
            </div>
          )}

          {/* Documents */}
          {event.event_documents && event.event_documents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Documents
              </p>
              <ul className="space-y-1">
                {event.event_documents.map(doc => (
                  <li key={doc.id}>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-700 hover:underline"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      {doc.filename}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Pied de page (admin) */}
        {isAdmin && (
          <div className="px-6 pb-4 flex gap-2 justify-end border-t border-slate-100 pt-3 flex-wrap">
            <button
              onClick={() => { onDuplicate?.(event); onClose() }}
              className="btn-secondary text-sm"
              title="Créer une copie de cet événement"
            >
              <Copy className="w-4 h-4" />
              Dupliquer
            </button>
            <button
              onClick={() => { onEdit?.(event); onClose() }}
              className="btn-secondary text-sm"
            >
              <Pencil className="w-4 h-4" />
              Modifier
            </button>
            <button
              onClick={() => {
                if (confirm(`Supprimer "${event.title}" ?`)) {
                  onDelete?.(event)
                  onClose()
                }
              }}
              className="btn-danger text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
