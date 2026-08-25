// components/events/BulkActionsBar.tsx
'use client'
import { Trash2, X } from 'lucide-react'
import type { EventStatus } from '@/types'
import { STATUS_LABELS } from '@/lib/week-utils'

interface Props {
  count: number
  saving?: boolean
  onStatusChange: (status: EventStatus) => void
  onDelete: () => void
  onClear: () => void
}

const STATUSES: EventStatus[] = ['previsionnel', 'confirme', 'annule', 'reporte']

export default function BulkActionsBar({ count, saving, onStatusChange, onDelete, onClear }: Props) {
  if (count === 0) return null

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        background: '#0f172a', color: 'white', borderRadius: 12,
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)', zIndex: 10000, fontSize: 13,
        flexWrap: 'wrap', maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
        {count} événement{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}
      </span>

      <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />

      <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>Statut :</span>
      <select
        disabled={saving}
        defaultValue=""
        onChange={(e) => {
          const value = e.target.value
          if (value) { onStatusChange(value as EventStatus); e.target.value = '' }
        }}
        style={{
          background: '#1e293b', color: 'white', border: '1px solid #334155',
          borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer',
        }}
      >
        <option value="" disabled>Changer vers…</option>
        {STATUSES.map(s => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>

      <button
        onClick={onDelete}
        disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#7f1d1d', color: 'white', border: 'none', borderRadius: 6,
          padding: '5px 10px', fontSize: 12, cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        <Trash2 style={{ width: 14, height: 14 }} />
        Supprimer
      </button>

      {saving && (
        <div style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'bulk-spin 0.7s linear infinite' }} />
      )}

      <button
        onClick={onClear}
        disabled={saving}
        title="Annuler la sélection"
        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: saving ? 'default' : 'pointer', display: 'flex', padding: 2 }}
      >
        <X style={{ width: 16, height: 16 }} />
      </button>

      <style>{`
        @keyframes bulk-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
