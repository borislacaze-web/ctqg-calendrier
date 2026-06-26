// components/filters/FilterBar.tsx
'use client'
import { useState } from 'react'
import { Search, X, Filter } from 'lucide-react'
import type { Category } from '@/types'

interface Filters {
  keyword: string
  categoryId: string
  month: string
}

interface Props {
  categories: Category[]
  filters: Filters
  onChange: (filters: Filters) => void
}

export default function FilterBar({ categories, filters, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const hasActiveFilters = filters.categoryId || filters.month

  const clear = () => onChange({ keyword: '', categoryId: '', month: '' })

  const months = [
    { value: '7',  label: 'Juillet' },
    { value: '8',  label: 'Août' },
    { value: '9',  label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
    { value: '1',  label: 'Janvier' },
    { value: '2',  label: 'Février' },
    { value: '3',  label: 'Mars' },
    { value: '4',  label: 'Avril' },
    { value: '5',  label: 'Mai' },
    { value: '6',  label: 'Juin' },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* Recherche texte */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Rechercher..."
          value={filters.keyword}
          onChange={e => onChange({ ...filters, keyword: e.target.value })}
          className="pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-300 bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
        />
      </div>

      {/* Bouton filtres */}
      <button
        onClick={() => setOpen(!open)}
        className={`btn-secondary text-sm gap-1.5 ${hasActiveFilters ? 'border-blue-500 text-blue-700' : ''}`}
      >
        <Filter className="w-4 h-4" />
        Filtres
        {hasActiveFilters && (
          <span className="ml-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
            {[filters.categoryId, filters.month].filter(Boolean).length}
          </span>
        )}
      </button>

      {/* Réinitialiser */}
      {(hasActiveFilters || filters.keyword) && (
        <button onClick={clear} className="btn-secondary text-sm text-red-600 border-red-200">
          <X className="w-4 h-4" />
          Effacer
        </button>
      )}

      {/* Panel de filtres avancés */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg p-4 flex gap-4 flex-wrap min-w-[320px]">
          <div className="flex-1 min-w-[140px]">
            <label className="label">Catégorie</label>
            <select
              value={filters.categoryId}
              onChange={e => onChange({ ...filters, categoryId: e.target.value })}
              className="input text-sm"
            >
              <option value="">Toutes</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="label">Mois</label>
            <select
              value={filters.month}
              onChange={e => onChange({ ...filters, month: e.target.value })}
              className="input text-sm"
            >
              <option value="">Tous</option>
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="self-end btn-primary text-sm"
          >
            Appliquer
          </button>
        </div>
      )}
    </div>
  )
}
