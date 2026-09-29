// components/events/EventForm.tsx
'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
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
  rdv_time:        z.string().optional(),
  link_label:      z.string().optional(),
  link_url:        z.string().optional(),
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
  // Pré-remplissage à la création (ex: double-clic sur une case du planning)
  defaultDate?: string
  defaultCategoryId?: string
  defaultSubcategoryId?: string | null
  onSaved: () => void
  onClose: () => void
}

export default function EventForm({
  event, season, categories, subcategories,
  defaultDate, defaultCategoryId, defaultSubcategoryId,
  onSaved, onClose,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [showOutOfSeasonWarning, setShowOutOfSeasonWarning] = useState(false)
  const [pendingData, setPendingData] = useState<FormData | null>(null)
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
      category_id:     event?.category_id ?? defaultCategoryId ?? '',
      subcategory_id:  event?.subcategory_id ?? defaultSubcategoryId ?? '',
      start_date:      event?.start_date ?? defaultDate ?? '',
      end_date:        event?.end_date ?? event?.start_date ?? defaultDate ?? '',
      rdv_time:        event?.rdv_time ?? '00:00',
      link_label:      event?.link_label ?? '',
      link_url:        event?.link_url ?? '',
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

  // Calculée directement au rendu (et non via useEffect) : la liste doit déjà
  // contenir la bonne sous-catégorie dès le tout premier rendu, sinon le <select>
  // non contrôlé de react-hook-form ne trouve pas l'option correspondante au montage
  // et retombe sur "Aucune" sans jamais se corriger ensuite.
  const filteredSubs = useMemo(
    () => subcategories.filter(s => s.category_id === watchedCategoryId),
    [watchedCategoryId, subcategories]
  )

  // Réinitialise la sous-catégorie quand l'utilisateur change la catégorie lui-même —
  // mais jamais au tout premier rendu (elle vient alors soit de l'événement édité,
  // soit de la case double-cliquée dans le planning).
  const isFirstCategoryRun = useRef(true)
  useEffect(() => {
    if (isFirstCategoryRun.current) {
      isFirstCategoryRun.current = false
      return
    }
    setValue('subcategory_id', '')
  }, [watchedCategoryId])

  // Date de fin = date de début tant que l'utilisateur n'a pas modifié la date
  // de fin lui-même (création ET modification). Ça évite le cas où la date de
  // fin reste antérieure à la nouvelle date de début après un changement.
  const endDateTouched = useRef(false)
  useEffect(() => {
    if (!endDateTouched.current && watchedStartDate) {
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
    // Filet de sécurité : la date de fin ne peut jamais être antérieure à la date de début
    if (new Date(data.end_date) < new Date(data.start_date)) {
      data.end_date = data.start_date
    }

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
      // Lien facultatif : si une URL est fournie sans http(s)://, on l'ajoute.
      // Si le libellé est vide mais l'URL renseignée, on retombe sur "Lien".
      let linkUrl = data.link_url?.trim() || null
      let linkLabel = data.link_label?.trim() || null
      if (linkUrl && !/^https?:\/\//i.test(linkUrl)) linkUrl = `https://${linkUrl}`
      if (linkUrl && !linkLabel) linkLabel = 'Lien'
      if (!linkUrl) linkLabel = null

      const payload = {
        ...data,
        subcategory_id: data.subcategory_id || null,
        description:    data.description || null,
        location:       data.location || null,
        target_audience: data.target_audience || null,
        color:          data.color || null,
        rdv_time:       data.rdv_time || '00:00',
        link_label:     linkLabel,
        link_url:       linkUrl,
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
              <input
                {...register('end_date')}
                type="date"
                className="input"
                onChange={(e) => { endDateTouched.current = true; register('end_date').onChange(e) }}
              />
              {errors.end_date && <p className="text-red-500 text-xs mt-1">{errors.end_date.message}</p>}
              <p className="text-[11px] text-slate-400 mt-1">
                Se cale automatiquement sur la date de début tant qu'elle n'est pas modifiée manuellement.
              </p>
            </div>
          </div>

          {/* Heure de RDV */}
          <div>
            <label className="label">Heure de RDV</label>
            <input {...register('rdv_time')} type="time" className="input max-w-[140px]" />
            <p className="text-[11px] text-slate-400 mt-1">
              Facultatif — laissée à 00:00 si non renseignée.
            </p>
          </div>

          {/* Lien (ex: inscription, règlement…) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Texte du lien</label>
              <input
                {...register('link_label')}
                type="text"
                placeholder="Ex : Inscription"
                className="input"
              />
            </div>
            <div>
              <label className="label">Adresse du lien</label>
              <input
                {...register('link_url')}
                type="text"
                placeholder="https://..."
                className="input"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">
            Facultatif — s'affiche comme un bouton cliquable sur la fiche de l'événement.
          </p>

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
