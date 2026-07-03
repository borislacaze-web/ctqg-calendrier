// components/filters/FilterBar.tsx
'use client'
import { useState, useMemo } from 'react'
import { Search, X, Filter, ChevronDown, ChevronRight } from 'lucide-react'
import type { Category, Subcategory } from '@/types'

export interface Filters {
  keyword: string
  excludedKeys: string[]   // clés décochées : 'cat-{id}' ou 'sub-{id}'
  month: string
}

interface Props {
  categories: Category[]
  subcategories: Subcategory[]
  filters: Filters
  onChange: (filters: Filters) => void
}

export default function FilterBar({ categories, subcategories, filters, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Regroupe les sous-catégories actives par catégorie, avec le même système
  // de clés que PlanningView (cat-{id} pour les catégories sans sous-cat, sub-{id} sinon)
  const tree = useMemo(() => {
    return categories.map(cat => {
      const subs = subcategories.filter(s => s.category_id === cat.id && s.is_active)
      const items = subs.length > 0
        ? subs.map(s => ({ key: `sub-${s.id}`, label: s.name }))
        : [{ key: `cat-${cat.id}`, label: cat.name }]
      return { cat, items }
    })
  }, [categories, subcategories])

  const excludedSet = useMemo(() => new Set(filters.excludedKeys), [filters.excludedKeys])
  const totalItems = useMemo(() => tree.reduce((n, g) => n + g.items.length, 0), [tree])
  const hasActiveFilters = filters.excludedKeys.length > 0 || filters.month

  const clear = () => onChange({ keyword: filters.keyword, excludedKeys: [], month: '' })

  const toggleItem = (key: string) => {
    const next = new Set(excludedSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange({ ...filters, excludedKeys: Array.from(next) })
  }

  const toggleCategory = (catKeys: string[], allChecked: boolean) => {
    const next = new Set(excludedSet)
    if (allChecked) {
      // tout coché → décoche tout le groupe
      catKeys.forEach(k => next.add(k))
    } else {
      // pas tout coché → coche tout le groupe
      catKeys.forEach(k => next.delete(k))
    }
    onChange({ ...filters, excludedKeys: Array.from(next) })
  }

  const toggleExpand = (catId: string) => {
    const next = new Set(expanded)
    if (next.has(catId)) next.delete(catId)
    else next.add(catId)
    setExpanded(next)
  }

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
    <div className="relative flex flex-col sm:flex-row gap-2">
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
            {(filters.excludedKeys.length > 0 ? 1 : 0) + (filters.month ? 1 : 0)}
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
        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg p-4 flex flex-col gap-4 min-w-[320px] max-w-[420px]">
          {/* Mois */}
          <div>
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

          {/* Arbre catégories / sous-catégories */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Catégories</label>
              <div className="flex gap-2">
                <button
                  onClick={() => onChange({ ...filters, excludedKeys: [] })}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  Tout cocher
                </button>
                <button
                  onClick={() => onChange({ ...filters, excludedKeys: tree.flatMap(g => g.items.map(i => i.key)) })}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  Tout décocher
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {tree.map(({ cat, items }) => {
                const keys = items.map(i => i.key)
                const checkedCount = keys.filter(k => !excludedSet.has(k)).length
                const allChecked = checkedCount === keys.length
                const noneChecked = checkedCount === 0
                const isMulti = items.length > 1 || items[0]?.key !== `cat-${cat.id}`
                const isExpanded = expanded.has(cat.id)

                return (
                  <div key={cat.id}>
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                      onClick={() => isMulti && toggleExpand(cat.id)}
                    >
                      {isMulti ? (
                        isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = !allChecked && !noneChecked }}
                        onChange={(e) => { e.stopPropagation(); toggleCategory(keys, allChecked) }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded accent-blue-600 shrink-0"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: cat.color }}
                      />
                      <span className="text-sm font-medium text-slate-700 truncate">{cat.name}</span>
                    </div>

                    {isMulti && isExpanded && (
                      <div className="pl-9 pb-1">
                        {items.map(item => (
                          <label
                            key={item.key}
                            className="flex items-center gap-2 py-1 text-sm text-slate-600 cursor-pointer hover:text-slate-900"
                          >
                            <input
                              type="checkbox"
                              checked={!excludedSet.has(item.key)}
                              onChange={() => toggleItem(item.key)}
                              className="w-3.5 h-3.5 rounded accent-blue-600"
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
