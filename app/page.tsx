// app/page.tsx
'use client'
import { useState, useEffect, useMemo } from 'react'
import { Plus, Download, FileSpreadsheet, LayoutList, Table2, CalendarDays } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import SeasonSelector from '@/components/layout/SeasonSelector'
import FilterBar from '@/components/filters/FilterBar'
import PlanningView from '@/components/planning/PlanningView'
import ListView from '@/components/planning/ListView'
import CalendarView from '@/components/planning/CalendarView'
import EventModal from '@/components/events/EventModal'
import EventForm from '@/components/events/EventForm'
import {
  useSeasons, useCategories, useSubcategories,
  useEvents, useCurrentUser
} from '@/hooks/useCalendarData'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/excel-utils'
import { exportToPDF } from '@/lib/pdf-utils'
import { addDays, format } from 'date-fns'
import type { CalendarEvent, Season } from '@/types'
import toast from 'react-hot-toast'

type View = 'planning' | 'list' | 'calendar'

export default function HomePage() {
  const { seasons, loading: loadingSeasons } = useSeasons()
  const { categories, loading: loadingCats } = useCategories()
  const { subcategories } = useSubcategories()
  const { profile, isAdmin } = useCurrentUser()
  const supabase = createClient()

  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [view, setView] = useState<View>('planning')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null | undefined>(undefined)
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ keyword: '', categoryId: '', month: '' })

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

  const handleDuplicate = (event: CalendarEvent) => {
    const copy = {
      ...event,
      id: undefined,
      title: `Copie — ${event.title}`,
      created_at: undefined,
      updated_at: undefined,
      category: undefined,
      subcategory: undefined,
      event_documents: undefined,
    } as unknown as CalendarEvent
    setEditingEvent(copy)
    setShowForm(true)
  }


  // Duplication silencieuse par Ctrl+drag depuis PlanningView
  const handleDuplicateToWeek = async (event: CalendarEvent, targetSaturday: Date) => {
    const origStart = new Date(event.start_date)
    const origEnd   = new Date(event.end_date)
    const duration  = Math.round((origEnd.getTime() - origStart.getTime()) / 86400000)

    // Même jour de semaine que l'original, ancré sur le samedi cible
    // Semaine sportive : sam=+0, dim=+1, lun=+2, mar=+3, mer=+4, jeu=+5, ven=+6
    const origDow = origStart.getDay() // 0=dim, 1=lun, ..., 6=sam
    let offsetFromSat: number
    if (origDow === 6) offsetFromSat = 0
    else if (origDow === 0) offsetFromSat = 1
    else offsetFromSat = origDow + 1  // lun=2, mar=3, mer=4, jeu=5, ven=6

    const newStart = addDays(targetSaturday, offsetFromSat)
    const newEnd   = addDays(newStart, duration)
    const toISO = (d: Date) => d.toISOString().slice(0, 10)

    const { error } = await supabase.from('events').insert({
      season_id:        event.season_id,
      category_id:      event.category_id,
      subcategory_id:   event.subcategory_id,
      title:            event.title,
      description:      event.description,
      location:         event.location,
      target_audience:  event.target_audience,
      start_date:       toISO(newStart),
      end_date:         toISO(newEnd),
      week_number:      event.week_number,
      sport_week_start: toISO(targetSaturday),
      status:           event.status,
      color:            event.color,
    })

    if (error) {
      toast.error('Erreur lors de la duplication')
    } else {
      toast.success(`✔ Dupliqué → sem. du ${format(targetSaturday, 'dd/MM/yyyy')}`)
      refresh()
    }
  }

  const isLoading = loadingSeasons || loadingCats || loadingEvents

  const viewButtons: { key: View; label: string; icon: typeof Table2 }[] = [
    { key: 'planning',  label: 'Planning',   icon: Table2 },
    { key: 'calendar',  label: 'Calendrier', icon: CalendarDays },
    { key: 'list',      label: 'Liste',      icon: LayoutList },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
          {activeSeason && (
            <SeasonSelector
              seasons={seasons}
              activeSeason={activeSeason}
              onChange={setActiveSeason}
            />
          )}
          <div className="w-px h-5 bg-slate-200 hidden sm:block" />

          {/* Sélecteur de vue */}
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            {viewButtons.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-r border-slate-300 last:border-r-0 ${
                  view === key
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0 relative">
            <FilterBar categories={categories} filters={filters} onChange={setFilters} />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="relative group">
              <button className="btn-secondary text-sm">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exporter</span>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[160px]">
                <button
                  onClick={() => { if (!activeSeason) return; exportToPDF(filteredEvents, categories, activeSeason) }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                >
                  PDF
                </button>
                <button
                  onClick={() => { if (!activeSeason) return; exportToExcel(filteredEvents, categories, subcategories, activeSeason) }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-t border-slate-100 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  Excel
                </button>
              </div>
            </div>

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
      <main className="flex-1 w-full" style={view === 'planning' ? { padding: '8px', overflowX: 'hidden' } : { maxWidth: '1600px', margin: '0 auto', padding: '16px' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
            subcategories={subcategories}
            season={activeSeason}
            onEventClick={setSelectedEvent}
            isAdmin={isAdmin}
            onDuplicateToWeek={isAdmin ? handleDuplicateToWeek : undefined}
            filterCategoryId={filters.categoryId}
            filterMonth={filters.month}
            filterKeyword={filters.keyword}
          />
        ) : view === 'calendar' ? (
          <CalendarView
            events={filteredEvents}
            categories={categories}
            season={activeSeason}
            onEventClick={setSelectedEvent}
          />
        ) : (
          <ListView
            events={filteredEvents}
            onEventClick={setSelectedEvent}
          />
        )}
      </main>

      {/* Légende statuts */}
      {view === 'planning' && (
        <footer className="bg-white border-t border-slate-200 px-4 py-2">
          <div className="max-w-[1600px] mx-auto flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
            <span className="font-medium text-slate-600">Statuts des évènements :</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#94a3b8'}}/> Prévisionnel</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#22c55e'}}/> Confirmé</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#ef4444'}}/> Annulé</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#f97316'}}/> Reporté</span>
            <span className="ml-auto">{filteredEvents.length} événement{filteredEvents.length !== 1 ? 's' : ''}</span>
          </div>
        </footer>
      )}

      <EventModal
        event={selectedEvent}
        isAdmin={isAdmin}
        onClose={() => setSelectedEvent(null)}
        onEdit={(ev) => { setEditingEvent(ev); setShowForm(true) }}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />

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
