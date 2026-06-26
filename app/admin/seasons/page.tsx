// app/admin/seasons/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle, Trash2 } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { useCurrentUser, useSeasons } from '@/hooks/useCalendarData'
import { createClient } from '@/lib/supabase/client'
import type { Season } from '@/types'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function SeasonsPage() {
  const { isAdmin, loading } = useCurrentUser()
  const { seasons, loading: loadingSeasons } = useSeasons()
  const router = useRouter()
  const supabase = createClient()
  const [showNew, setShowNew] = useState(false)
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1)
  const [allSeasons, setAllSeasons] = useState<Season[]>([])

  useEffect(() => {
    if (!loading && !isAdmin) router.push('/')
  }, [loading, isAdmin])

  useEffect(() => {
    setAllSeasons(seasons)
  }, [seasons])

  const createSeason = async () => {
    const startYear = newYear
    const endYear = newYear + 1
    const name = `${startYear}/${endYear}`
    const start_date = `${startYear}-07-01`
    const end_date = `${endYear}-06-30`

    const exists = allSeasons.some(s => s.name === name)
    if (exists) { toast.error('Cette saison existe déjà'); return }

    const { error } = await supabase.from('seasons').insert({
      name, start_date, end_date, is_active: false
    })
    if (error) { toast.error('Erreur lors de la création'); return }
    toast.success(`Saison ${name} créée`)
    setShowNew(false)
    router.refresh()
  }

  const setActive = async (season: Season) => {
    // Désactiver toutes les saisons, puis activer celle-ci
    await supabase.from('seasons').update({ is_active: false }).neq('id', season.id)
    const { error } = await supabase.from('seasons').update({ is_active: true }).eq('id', season.id)
    if (error) { toast.error('Erreur'); return }
    toast.success(`Saison ${season.name} définie comme active`)
    router.refresh()
  }

  const deleteSeason = async (season: Season) => {
    if (season.is_active) { toast.error('Impossible de supprimer la saison active'); return }
    if (!confirm(`Supprimer la saison ${season.name} et tous ses événements ?`)) return
    const { error } = await supabase.from('seasons').delete().eq('id', season.id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Saison supprimée')
    router.refresh()
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Saisons</h1>
          <button onClick={() => setShowNew(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Nouvelle saison
          </button>
        </div>

        {/* Formulaire nouvelle saison */}
        {showNew && (
          <div className="card p-4 mb-4">
            <h3 className="font-semibold text-slate-800 mb-3">Créer une nouvelle saison</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="label">Année de début</label>
                <input
                  type="number"
                  min={2024}
                  max={2050}
                  value={newYear}
                  onChange={e => setNewYear(parseInt(e.target.value))}
                  className="input"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Saison {newYear}/{newYear + 1} · du 01/07/{newYear} au 30/06/{newYear + 1}
                </p>
              </div>
              <button onClick={createSeason} className="btn-primary">Créer</button>
              <button onClick={() => setShowNew(false)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        )}

        {/* Liste des saisons */}
        <div className="space-y-3">
          {allSeasons.map(season => (
            <div key={season.id} className="card p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-lg">Saison {season.name}</span>
                  {season.is_active && (
                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {format(parseISO(season.start_date), 'dd MMMM yyyy', { locale: fr })} →{' '}
                  {format(parseISO(season.end_date), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!season.is_active && (
                  <button
                    onClick={() => setActive(season)}
                    className="btn-secondary text-sm"
                  >
                    Définir active
                  </button>
                )}
                <button
                  onClick={() => deleteSeason(season)}
                  disabled={season.is_active}
                  className="btn-danger text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
