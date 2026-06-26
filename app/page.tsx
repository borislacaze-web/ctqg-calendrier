// app/page.tsx
'use client'
import { useState, useEffect, useMemo } from 'react'
import { Plus, Download, FileSpreadsheet, LayoutList, Table2 } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import SeasonSelector from '@/components/layout/SeasonSelector'
import FilterBar from '@/components/filters/FilterBar'
import PlanningView from '@/components/planning/PlanningView'
import ListView from '@/components/planning/ListView'
import EventModal from '@/components/events/EventModal'
import EventForm from '@/components/events/EventForm'
import {
  useSeasons, useCategories, useSubcategories,
  useEvents, useCurrentUser
} from '@/hooks/useCalendarData'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/excel-utils'
import { exportToPDF } from '@/lib/pdf-utils'
import type { CalendarEvent, Season } from '@/types'
import toast from 'react-hot-toast'

type View = 'planning' | 'list'

export default function HomePage() {
  const { seasons, loading: loadingSeasons } = useSeasons()
  const { categories, loading: loadingCats } = useCategories()
  const { subcategories } = useSubcategories()
  const { profile, isAdmin } = useCurrentUser()
  const supabase = createClient()

  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [view, setView] = useState<View>('planning')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null | undefined>(undefined) // undefined = fermé, null = nouveau
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ keyword: '', categoryId: '', month: '' })

  // Saison active par défaut
  useEffect(() => {
    if (seasons.length > 0 && !activeSeason) {
      const active = seasons.find(s => s.is_active) ?? seasons[0]
      setActiveSeason(active)
    }
  }, [seasons])

  const { events, loading: loadingEvents, refresh } = useEvents(
    activeSeason?.id,
    {
      categoryId: filters.categoryId || undefined,
      keyword:    filters.keyword || undefined,
    }
  )

  // Filtrage mois côté client
  const filteredEvents = useMemo(() => {
    if (!filters.month) return events
    const m = parseInt(filters.month)
    return events.filter(ev => new Date(ev.start_date).getMonth() + 1 === m)
  }, [events, filters.month])

  const handleDelete = async (event: CalendarEvent) => {
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Événement supprimé')
      refresh()
    }
  }

  const isLoading = loadingSeasons || loadingCats || loadingEvents

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
          {/* Sélecteur saison */}
          {activeSeason && (
            <SeasonSelector
              seasons={seasons}
              activeSeason={activeSeason}
              onChange={setActiveSeason}
            />
          )}

          {/* Séparateur */}
          <div className="w-px h-5 bg-slate-200 hidden sm:block" />

          {/* Vue */}
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => setView('planning')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'planning'
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Table2 className="w-4 h-4" />
              <span className="hidden sm:inline">Planning</span>
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-l border-slate-300 ${
                view === 'list'
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>

          {/* Filtres */}
          <div className="flex-1 min-w-0 relative">
            <FilterBar categories={categories} filters={filters} onChange={setFilters} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Export */}
            <div className="relative group">
              <button className="btn-secondary text-sm">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exporter</span>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[160px]">
                <button
                  onClick={() => {
                    if (!activeSeason) return
                    exportToPDF(filteredEvents, categories, activeSeason)
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  PDF
                </button>
                <button
                  onClick={() => {
                    if (!activeSeason) return
                    exportToExcel(filteredEvents, categories, subcategories, activeSeason)
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  Excel
                </button>
              </div>
            </div>

            {/* Nouvel événement (admin) */}
            {isAdmin && (
              <button
                onClick={() => { setEditingEvent(null); setShowForm(true) }}
                className="btn-primary text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Événement</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !activeSeason ? (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg font-medium">Aucune saison configurée</p>
            {isAdmin && (
              <p className="text-sm mt-2">
                Rendez-vous dans <a href="/admin/seasons" className="text-blue-600 hover:underline">l'administration</a> pour créer une saison.
              </p>
            )}
          </div>
        ) : view === 'planning' ? (
          <PlanningView
            events={filteredEvents}
            categories={categories}
            season={activeSeason}
            onEventClick={setSelectedEvent}
            filterCategoryId={filters.categoryId}
            filterMonth={filters.month}
            filterKeyword={filters.keyword}
          />
        ) : (
          <ListView
            events={filteredEvents}
            onEventClick={setSelectedEvent}
          />
        )}
      </main>

      {/* Légende statuts */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2">
        <div className="max-w-[1600px] mx-auto flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
          <span className="font-medium text-slate-600">Statuts :</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block"/> Prévisionnel</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/> Confirmé</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/> Annulé</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"/> Reporté</span>
          <span className="ml-auto">
            {filteredEvents.length} événement{filteredEvents.length !== 1 ? 's' : ''}
          </span>
        </div>
      </footer>

      {/* Modal détail */}
      <EventModal
        event={selectedEvent}
        isAdmin={isAdmin}
        onClose={() => setSelectedEvent(null)}
        onEdit={(ev) => { setEditingEvent(ev); setShowForm(true) }}
        onDelete={handleDelete}
      />

      {/* Formulaire création/édition */}
      {showForm && activeSeason && (
        <EventForm
          event={editingEvent}
          season={activeSeason}
          categories={categories}
          subcategories={subcategories}
          onSaved={refresh}
          onClose={() => { setShowForm(false); setEditingEvent(undefined) }}
        />
      )}
    </div>
  )
}
