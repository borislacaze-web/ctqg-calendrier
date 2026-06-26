// app/admin/import/page.tsx
'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, AlertTriangle, CheckCircle, FileSpreadsheet, Loader2 } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { useCurrentUser, useSeasons, useCategories, useSubcategories } from '@/hooks/useCalendarData'
import { createClient } from '@/lib/supabase/client'
import { parseImportFile } from '@/lib/excel-utils'
import type { CalendarEvent } from '@/types'
import toast from 'react-hot-toast'

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'done'

export default function ImportPage() {
  const { isAdmin, loading } = useCurrentUser()
  const { seasons } = useSeasons()
  const { categories } = useCategories()
  const { subcategories } = useSubcategories()
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [status, setStatus] = useState<ImportStatus>('idle')
  const [errors, setErrors] = useState<string[]>([])
  const [rows, setRows] = useState<Partial<CalendarEvent>[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [importedCount, setImportedCount] = useState(0)

  if (loading) return null
  if (!isAdmin) { router.push('/'); return null }

  const activeSeason = seasons.find(s => s.is_active)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('parsing')
    const buffer = await file.arrayBuffer()

    const { rows: parsed, errors: errs } = parseImportFile(buffer, categories, subcategories)
    setRows(parsed)
    setErrors(errs)
    setStatus('preview')
  }

  const runImport = async () => {
    const seasonId = selectedSeasonId || activeSeason?.id
    if (!seasonId) { toast.error('Aucune saison sélectionnée'); return }

    setStatus('importing')
    let count = 0

    for (const row of rows) {
      const { error } = await supabase.from('events').insert({
        ...row,
        season_id: seasonId,
      })
      if (!error) count++
    }

    setImportedCount(count)
    setStatus('done')
    toast.success(`${count} événement(s) importé(s)`)
  }

  const reset = () => {
    setStatus('idle')
    setErrors([])
    setRows([])
    setImportedCount(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Importer un calendrier</h1>
          <p className="text-slate-500 text-sm mt-1">
            Importez un fichier Excel au format d'export CTQG (sauvegarde → réimport).
          </p>
        </div>

        {/* Sélection de saison */}
        <div className="card p-4 mb-4">
          <label className="label">Saison cible</label>
          <select
            value={selectedSeasonId || activeSeason?.id || ''}
            onChange={e => setSelectedSeasonId(e.target.value)}
            className="input max-w-xs"
          >
            {seasons.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.is_active ? ' (active)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Zone de dépôt */}
        {status === 'idle' && (
          <label className="card flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-slate-300 cursor-pointer hover:border-blue-400 transition-colors bg-white">
            <FileSpreadsheet className="w-12 h-12 text-green-600" />
            <div className="text-center">
              <p className="font-semibold text-slate-700">Glissez votre fichier Excel ici</p>
              <p className="text-sm text-slate-500 mt-1">ou cliquez pour sélectionner</p>
              <p className="text-xs text-slate-400 mt-2">Format : export CTQG (.xlsx)</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        )}

        {/* Parsing */}
        {status === 'parsing' && (
          <div className="card p-8 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Analyse du fichier...
          </div>
        )}

        {/* Preview */}
        {status === 'preview' && (
          <div className="space-y-4">
            {/* Résumé */}
            <div className="card p-4 flex items-center gap-4">
              <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">
                  {rows.length} événement(s) prêt(s) à importer
                </p>
                {errors.length > 0 && (
                  <p className="text-sm text-amber-600">{errors.length} ligne(s) ignorée(s)</p>
                )}
              </div>
            </div>

            {/* Erreurs */}
            {errors.length > 0 && (
              <div className="card p-4 bg-amber-50 border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-800 text-sm">Lignes ignorées</span>
                </div>
                <ul className="text-xs text-amber-700 space-y-1">
                  {errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}

            {/* Aperçu */}
            {rows.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
                  Aperçu des 10 premiers événements
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">Date</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">Titre</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">Statut</th>
                        <th className="px-3 py-2 text-left text-slate-600 font-medium">Lieu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2">{row.start_date}</td>
                          <td className="px-3 py-2 font-medium max-w-[200px] truncate">{row.title}</td>
                          <td className="px-3 py-2">{row.status}</td>
                          <td className="px-3 py-2 text-slate-500">{row.location || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={runImport} disabled={rows.length === 0} className="btn-primary">
                <Upload className="w-4 h-4" />
                Importer {rows.length} événement(s)
              </button>
              <button onClick={reset} className="btn-secondary">Annuler</button>
            </div>
          </div>
        )}

        {/* Import en cours */}
        {status === 'importing' && (
          <div className="card p-8 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Import en cours...
          </div>
        )}

        {/* Résultat */}
        {status === 'done' && (
          <div className="card p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-xl font-bold text-slate-900">{importedCount} événement(s) importé(s)</p>
            <p className="text-slate-500 text-sm mt-2">Le calendrier a été mis à jour.</p>
            <div className="flex gap-3 justify-center mt-6">
              <button onClick={() => router.push('/')} className="btn-primary">Voir le calendrier</button>
              <button onClick={reset} className="btn-secondary">Nouvel import</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
