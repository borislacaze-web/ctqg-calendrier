// components/layout/SeasonSelector.tsx
'use client'
import { ChevronDown } from 'lucide-react'
import type { Season } from '@/types'

interface Props {
  seasons: Season[]
  activeSeason: Season | null
  onChange: (season: Season) => void
}

export default function SeasonSelector({ seasons, activeSeason, onChange }: Props) {
  if (seasons.length === 0) return null

  return (
    <div className="relative inline-block">
      <select
        value={activeSeason?.id ?? ''}
        onChange={e => {
          const s = seasons.find(s => s.id === e.target.value)
          if (s) onChange(s)
        }}
        className="appearance-none pl-3 pr-8 py-1.5 text-sm font-medium rounded-lg
                   border border-slate-300 bg-white text-slate-700
                   focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        {seasons.map(s => (
          <option key={s.id} value={s.id}>
            Saison {s.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  )
}
