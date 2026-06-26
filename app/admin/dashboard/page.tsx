// app/admin/dashboard/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDays, FolderOpen, FileText, History,
  Plus, Upload, Settings, Users, TrendingUp
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { useCurrentUser, useSeasons } from '@/hooks/useCalendarData'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { AuditLog } from '@/types'

interface Stats {
  events: number
  categories: number
  documents: number
}

export default function DashboardPage() {
  const { profile, isAdmin, loading } = useCurrentUser()
  const { seasons } = useSeasons()
  const router = useRouter()
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({ events: 0, categories: 0, documents: 0 })
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    if (!loading && !isAdmin) router.push('/')
  }, [loading, isAdmin])

  useEffect(() => {
    if (!isAdmin) return

    const activeSeason = seasons.find(s => s.is_active)
    if (!activeSeason) return

    // Stats
    Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('season_id', activeSeason.id),
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('event_documents').select('id', { count: 'exact', head: true }),
    ]).then(([ev, cat, doc]) => {
      setStats({
        events:     ev.count ?? 0,
        categories: cat.count ?? 0,
        documents:  doc.count ?? 0,
      })
    })

    // Historique récent
    supabase
      .from('audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setRecentLogs(data ?? []))
  }, [isAdmin, seasons])

  if (loading) return null

  const activeSeason = seasons.find(s => s.is_active)

  const ACTION_LABELS: Record<string, string> = {
    CREATE: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
  }
  const ACTION_COLORS: Record<string, string> = {
    CREATE: 'text-green-700 bg-green-50',
    UPDATE: 'text-blue-700 bg-blue-50',
    DELETE: 'text-red-700 bg-red-50',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-slate-500 text-sm mt-1">
            Saison active : <strong>{activeSeason?.name ?? 'Non définie'}</strong>
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Événements', value: stats.events, icon: CalendarDays, color: 'text-blue-600 bg-blue-50' },
            { label: 'Catégories', value: stats.categories, icon: FolderOpen, color: 'text-purple-600 bg-purple-50' },
            { label: 'Documents', value: stats.documents, icon: FileText, color: 'text-green-600 bg-green-50' },
          ].map(s => (
            <div key={s.label} className="card p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-sm text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { href: '/?new=1',          label: 'Nouvel événement', icon: Plus,     color: 'bg-blue-700 text-white hover:bg-blue-800' },
            { href: '/admin/import',     label: 'Importer Excel',  icon: Upload,   color: 'bg-green-700 text-white hover:bg-green-800' },
            { href: '/admin/categories', label: 'Catégories',      icon: Settings, color: 'bg-slate-700 text-white hover:bg-slate-800' },
            { href: '/admin/seasons',    label: 'Saisons',         icon: TrendingUp, color: 'bg-orange-600 text-white hover:bg-orange-700' },
          ].map(a => (
            <Link
              key={a.href}
              href={a.href}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl font-medium text-sm text-center transition-colors ${a.color}`}
            >
              <a.icon className="w-5 h-5" />
              {a.label}
            </Link>
          ))}
        </div>

        {/* Historique */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Dernières modifications</h2>
          </div>
          {recentLogs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400 text-center">Aucune modification enregistrée.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentLogs.map(log => (
                <li key={log.id} className="px-5 py-3 flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600'}`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <span className="text-sm text-slate-700 flex-1 truncate">
                    {(log.new_data as Record<string,unknown> | null)?.title as string ??
                     (log.old_data as Record<string,unknown> | null)?.title as string ??
                     log.record_id}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {format(parseISO(log.changed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
