// components/events/EventModal.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import {
  X, MapPin, Calendar, Tag, FileText, FileImage, FileSpreadsheet,
  AlertCircle, CheckCircle, Clock, RotateCcw, Pencil, Trash2, Copy,
  Download, ZoomIn, ExternalLink
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CalendarEvent, EventDocument } from '@/types'
import { STATUS_LABELS } from '@/lib/week-utils'
import { cn } from '@/lib/utils'

const STATUS_ICONS = {
  previsionnel: Clock,
  confirme:     CheckCircle,
  annule:       AlertCircle,
  reporte:      RotateCcw,
}

type DocKind = 'image' | 'pdf' | 'spreadsheet' | 'other'

function getDocKind(filename: string): DocKind {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet'
  return 'other'
}

/** Petite vignette d'aperçu pour un document : image réelle en miniature,
 *  ou icône représentative selon le type de fichier (pdf, tableur, autre). */
function DocumentThumbnail({ doc, onOpen }: { doc: EventDocument; onOpen: () => void }) {
  const kind = getDocKind(doc.filename)

  return (
    <button
      onClick={onOpen}
      title={doc.filename}
      className="group relative flex flex-col w-28 shrink-0 rounded-lg border border-slate-200
                 overflow-hidden bg-white hover:border-blue-400 hover:shadow-sm transition"
    >
      <div className="w-28 h-28 flex items-center justify-center bg-slate-50 overflow-hidden">
        {kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.file_url}
            alt={doc.filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : kind === 'pdf' ? (
          <FileText className="w-9 h-9 text-red-500" />
        ) : kind === 'spreadsheet' ? (
          <FileSpreadsheet className="w-9 h-9 text-emerald-600" />
        ) : (
          <FileText className="w-9 h-9 text-slate-400" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0
                          group-hover:bg-black/25 transition-colors">
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
      </div>
      <span className="px-1.5 py-1 text-[10px] leading-tight text-slate-600 text-left truncate">
        {doc.filename}
      </span>
    </button>
  )
}

/** Visionneuse plein écran : affiche l'image ou le PDF en grand ; pour les
 *  autres formats (Word, Excel non pris en charge en aperçu…), propose le
 *  téléchargement direct car le navigateur ne peut pas les afficher inline. */
function DocumentViewer({ doc, onClose }: { doc: EventDocument; onClose: () => void }) {
  const kind = getDocKind(doc.filename)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-[92vw] max-h-[92vh] w-full flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
          <p className="text-sm font-medium text-slate-700 truncate pr-3">{doc.filename}</p>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={doc.file_url}
              download={doc.filename}
              target="_blank"
              rel="noreferrer"
              title="Télécharger"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <Download className="w-4 h-4" />
            </a>
            <button onClick={onClose} title="Fermer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-50 overflow-auto">
          {kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.file_url}
              alt={doc.filename}
              className="max-w-full max-h-[80vh] object-contain"
            />
          ) : kind === 'pdf' ? (
            <iframe
              src={doc.file_url}
              title={doc.filename}
              className="w-[85vw] h-[80vh] max-w-full bg-white"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-14 px-6 text-center">
              <FileText className="w-12 h-12 text-slate-300" />
              <p className="text-sm text-slate-500">
                Aperçu non disponible pour ce type de fichier.
              </p>
              <a
                href={doc.file_url}
                download={doc.filename}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-sm"
              >
                <Download className="w-4 h-4" />
                Télécharger {doc.filename}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Transforme les URL présentes dans un texte libre en liens cliquables.
 * Reconnaît les adresses commençant par http:// ou https:// ainsi que
 * celles commençant par www. (auxquelles on ajoute https:// à l'ouverture).
 * Le reste du texte (retours à la ligne inclus) est préservé tel quel.
 */
function Linkify({ text }: { text: string }) {
  const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
  const parts = text.split(URL_RE)

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        const isUrl = /^(https?:\/\/|www\.)/i.test(part)
        if (!isUrl) return <span key={i}>{part}</span>

        // On retire la ponctuation finale collée à l'URL (point, virgule,
        // parenthèse fermante…) pour ne pas l'inclure dans le lien.
        const trailing = part.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
        const url = trailing ? part.slice(0, -trailing.length) : part
        const href = url.startsWith('www.') ? `https://${url}` : url

        return (
          <span key={i}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline underline-offset-2 break-all hover:text-blue-800"
            >
              {url}
            </a>
            {trailing}
          </span>
        )
      })}
    </>
  )
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
  const [viewerDoc, setViewerDoc] = useState<EventDocument | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (viewerDoc) setViewerDoc(null)
      else onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, viewerDoc])

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
                {event.rdv_time && event.rdv_time !== '00:00' && (
                  <span className="text-slate-500 font-normal"> — RDV à {event.rdv_time}</span>
                )}
              </p>
              <p className="text-xs text-slate-500">Semaine {event.week_number}</p>
            </div>
          </div>

          {/* Lieu */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700">
                {/^(https?:\/\/|www\.)/i.test(event.location.trim())
                  // Le lieu est déjà une URL (lien Maps collé, etc.) : on la rend cliquable telle quelle
                  ? <Linkify text={event.location} />
                  // Sinon : lien vers la recherche Google Maps de ce lieu
                  : (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
                      title="Ouvrir dans Google Maps"
                    >
                      {event.location}
                    </a>
                  )}
              </p>
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
              <Linkify text={event.description} />
            </div>
          )}

          {/* Lien avec libellé personnalisé (ex: Inscription, Règlement…) */}
          {event.link_url && (
            <a
              href={event.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600
                         text-white text-sm font-medium hover:bg-blue-700 transition self-start w-fit"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              {event.link_label || 'Lien'}
            </a>
          )}

          {/* Documents */}
          {event.event_documents && event.event_documents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Documents
              </p>
              <div className="flex flex-wrap gap-2">
                {event.event_documents.map(doc => (
                  <DocumentThumbnail key={doc.id} doc={doc} onOpen={() => setViewerDoc(doc)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {viewerDoc && (
          <DocumentViewer doc={viewerDoc} onClose={() => setViewerDoc(null)} />
        )}

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
