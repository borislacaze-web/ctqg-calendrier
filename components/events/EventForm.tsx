// components/events/EventForm.tsx
'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Upload, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent, Category, Subcategory, Season } from '@/types'

const schema = z.object({
  title:           z.string().min(1, 'Le titre est obligatoire'),
  category_id:     z.string().min(1, 'La catégorie est obligatoire'),
  subcategory_id:  z.string().optional(),
  start_date:      z.string().min(1, 'La date de début est obligatoire'),
  end_date:        z.string().min(1, 'La date de fin est obligatoire'),
  description:     z.string().optional(),
  location:        z.string().optional(),
  target_audience: z.string().optional(),
  status:          z.enum(['previsionnel','confirme','annule','reporte']),
  color:           z.string().optional(),
  season_id:       z.string().min(1),
})

type FormData = z.infer<typeof schema>

interface Props {
  event?: CalendarEvent | null
  season: Season
  categories: Category[]
  subcategories: Subcategory[]
  onSaved: () => void
  onClose: () => void
}

export default function EventForm({ event, season, categories, subcategories, onSaved, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [showOutOfSeasonWarning, setShowOutOfSeasonWarning] = useState(false)
  const [pendingData, setPendingData] = useState<FormData | null>(null)
  const [filteredSubs, setFilteredSubs] = useState<Subcategory[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:           event?.title ?? '',
      category_id:     event?.category_id ?? '',
      subcategory_id:  event?.subcategory_id ?? '',
      start_date:      event?.start_date ?? '',
      end_date:        event?.end_date ?? event?.start_date ?? '',
      description:     event?.description ?? '',
      location:        event?.location ?? '',
      target_audience: event?.target_audience ?? '',
      status:          event?.status ?? 'previsionnel',
      color:           event?.color ?? '',
      season_id:       season.id,
    }
  })

  const watchedCategoryId = watch('category_id')
  const watchedStartDate = watch('start_date')

  // Mise à jour des sous-catégories quand la catégorie change
  useEffect(() => {
    setFilteredSubs(subcategories.filter(s => s.category_id === watchedCategoryId))
    if (!event?.subcategory_id) setValue('subcategory_id', '')
  }, [watchedCategoryId, subcategories])

  // Date de fin = date de début par défaut
  useEffect(() => {
    if (!event && watchedStartDate) {
      setValue('end_date', watchedStartDate)
    }
  }, [watchedStartDate])

  const isOutOfSeason = (data: FormData) => {
    const start = new Date(data.start_date)
    const end   = new Date(data.end_date)
    const sStart = new Date(season.start_date)
    const sEnd   = new Date(season.end_date)
    return start < sStart || start > sEnd || end < sStart || end > sEnd
  }

  const onSubmit = async (data: FormData) => {
    // Vérification hors saison : on bloque et demande confirmation
    if (isOutOfSeason(data) && !showOutOfSeasonWarning) {
      setPendingData(data)
      setShowOutOfSeasonWarning(true)
      return
    }
    setShowOutOfSeasonWarning(false)
    setPendingData(null)
    setSaving(true)
    try {
      const payload = {
        ...data,
        subcategory_id: data.subcategory_id || null,
        description:    data.description || null,
        location:       data.location || null,
        target_audience: data.target_audience || null,
        color:          data.color || null,
      }

      let eventId = event?.id

      if (event?.id) {
        const { error } = await supabase.from('events').update(payload).eq('id', event.id)
        if (error) throw error
        toast.success('Événement modifié')
      } else {
        const { data: created, error } = await supabase
          .from('events')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        eventId = created.id
        toast.success(event?.title?.startsWith('Copie') ? 'Événement dupliqué' : 'Événement créé')
      }

      // Upload des fichiers
      if (files.length > 0 && eventId) {
        setUploading(true)
        for (const file of files) {
          const path = `${eventId}/${Date.now()}-${file.name}`
          const { error: uploadErr } = await supabase.storage
            .from('event-documents')
            .upload(path, file)

          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from('event-documents')
              .getPublicUrl(path)

            await supabase.from('event_documents').insert({
              event_id: eventId,
              filename: file.name,
              file_url: urlData.publicUrl,
              file_size: file.size,
            })
          }
        }
        setUploading(false)
      }

      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const statuses = [
    { value: 'previsionnel', label: 'Prévisionnel' },
    { value: 'confirme',     label: 'Confirmé' },
    { value: 'annule',       label: 'Annulé' },
    { value: 'reporte',      label: 'Reporté' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {event?.id
              ? 'Modifier l\'événement'
              : event
                ? 'Dupliquer l\'événement'
                : 'Nouvel événement'
            }
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
          {/* Titre */}
          <div>
            <label className="label">Titre *</label>
            <input {...register('title')} className="input" placeholder="Nom de l'événement" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          {/* Catégorie + Sous-catégorie */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Catégorie *</label>
              <select {...register('category_id')} className="input">
                <option value="">Sélectionner...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.category_id && <p className="text-red-500 text-xs mt-1">{errors.category_id.message}</p>}
            </div>
            <div>
              <label className="label">Sous-catégorie</label>
              <select {...register('subcategory_id')} className="input" disabled={filteredSubs.length === 0}>
                <option value="">Aucune</option>
                {filteredSubs.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date de début *</label>
              <input {...register('start_date')} type="date" className="input" />
              {errors.start_date && <p className="text-red-500 text-xs mt-1">{errors.start_date.message}</p>}
            </div>
            <div>
              <label className="label">Date de fin *</label>
              <input {...register('end_date')} type="date" className="input" />
              {errors.end_date && <p className="text-red-500 text-xs mt-1">{errors.end_date.message}</p>}
            </div>
          </div>

          {/* Lieu */}
          <div>
            <label className="label">Lieu</label>
            <input {...register('location')} className="input" placeholder="Salle, ville..." />
          </div>

          {/* Public concerné */}
          <div>
            <label className="label">Public concerné</label>
            <input {...register('target_audience')} className="input" placeholder="Ex: clubs du secteur Nord" />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              {...register('description')}
              className="input resize-none"
              rows={3}
              placeholder="Informations complémentaires..."
            />
          </div>

          {/* Statut + Couleur */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Statut</label>
              <select {...register('status')} className="input">
                {statuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Couleur personnalisée</label>
              <div className="flex gap-2 items-center">
                <input {...register('color')} type="color" className="h-9 w-12 rounded border border-slate-300 cursor-pointer p-0.5" />
                <button
                  type="button"
                  onClick={() => setValue('color', '')}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Par défaut
                </button>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <label className="label">Documents joints</label>
            {event?.event_documents && event.event_documents.length > 0 && (
              <ul className="mb-2 space-y-1">
                {event.event_documents.map(doc => (
                  <li key={doc.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="flex-1 truncate">{doc.filename}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.from('event_documents').delete().eq('id', doc.id)
                        toast.success('Document supprimé')
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-300 rounded-lg p-3 hover:border-blue-400 transition-colors">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">
                {files.length > 0 ? `${files.length} fichier(s) sélectionné(s)` : 'Ajouter des fichiers (PDF, etc.)'}
              </span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={e => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {files.map(f => (
                  <li key={f.name} className="text-xs text-slate-600 truncate">• {f.name}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={saving || uploading} className="btn-primary">
              {(saving || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
              {event?.id ? 'Enregistrer' : event ? 'Créer la copie' : 'Créer l\'événement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
