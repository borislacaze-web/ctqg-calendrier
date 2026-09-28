// app/admin/users/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, KeyRound, Loader2, ShieldCheck, PencilLine, Eye } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { useCurrentUser } from '@/hooks/useCalendarData'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

type Role = 'admin' | 'editeur' | 'club'

interface AppUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  role: Role
  club_name: string | null
}

const ROLE_INFO: Record<Role, { label: string; desc: string; className: string; Icon: typeof ShieldCheck }> = {
  admin: {
    label: 'Administrateur',
    desc: 'Accès total : événements, saisons, catégories, import, comptes.',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    Icon: ShieldCheck,
  },
  editeur: {
    label: 'Éditeur',
    desc: 'Peut créer, modifier et supprimer des événements. Pas d\u2019accès au reste de l\u2019administration.',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Icon: PencilLine,
  },
  club: {
    label: 'Lecture seule',
    desc: 'Consultation du calendrier uniquement.',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    Icon: Eye,
  },
}

export default function UsersPage() {
  const { profile, isAdmin, loading } = useCurrentUser()
  const router = useRouter()

  const [users, setUsers] = useState<AppUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [busy, setBusy] = useState(false)

  const [showNew, setShowNew] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('editeur')

  useEffect(() => {
    if (!loading && !isAdmin) router.push('/')
  }, [loading, isAdmin, router])

  const load = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur de chargement')
      setUsers(json.users)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const createUser = async () => {
    if (!email.trim() || !password) { toast.error('Email et mot de passe obligatoires'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success('Compte créé')
      setEmail(''); setPassword(''); setRole('editeur'); setShowNew(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (u: AppUser, newRole: Role) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success('Rôle mis à jour')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async (u: AppUser) => {
    const pwd = window.prompt(`Nouveau mot de passe pour ${u.email} (8 caractères minimum) :`)
    if (!pwd) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, password: pwd }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success('Mot de passe modifié')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const removeUser = async (u: AppUser) => {
    if (!window.confirm(`Supprimer définitivement le compte ${u.email} ?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(u.id)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success('Compte supprimé')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Comptes utilisateurs</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Créez des accès restreints pour laisser d&apos;autres personnes gérer les événements.
            </p>
          </div>
          <button onClick={() => setShowNew(v => !v)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Nouveau compte
          </button>
        </div>

        {/* Rappel des rôles */}
        <div className="grid sm:grid-cols-3 gap-2 mb-5">
          {(Object.keys(ROLE_INFO) as Role[]).map(r => {
            const { label, desc, className, Icon } = ROLE_INFO[r]
            return (
              <div key={r} className={`rounded-lg border p-2.5 ${className}`}>
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </p>
                <p className="text-[11px] mt-1 opacity-80 leading-snug">{desc}</p>
              </div>
            )
          })}
        </div>

        {/* Formulaire de création */}
        {showNew && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Adresse email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label">Mot de passe (8 caractères min.)</label>
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div>
              <label className="label">Rôle</label>
              <select value={role} onChange={e => setRole(e.target.value as Role)} className="input sm:max-w-xs">
                <option value="editeur">Éditeur — gère les événements</option>
                <option value="club">Lecture seule</option>
                <option value="admin">Administrateur — accès total</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">{ROLE_INFO[role].desc}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowNew(false)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={createUser} disabled={busy} className="btn-primary text-sm">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer le compte
              </button>
            </div>
          </div>
        )}

        {/* Liste */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-14 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-14">Aucun compte</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {users.map(u => {
                const isSelf = u.id === profile?.id
                return (
                  <li key={u.id} className="p-3 flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {u.email}
                        {isSelf && <span className="ml-2 text-[11px] text-slate-400">(vous)</span>}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Créé le {format(parseISO(u.created_at), 'dd/MM/yyyy', { locale: fr })}
                        {u.last_sign_in_at
                          ? ` · dernière connexion le ${format(parseISO(u.last_sign_in_at), 'dd/MM/yyyy', { locale: fr })}`
                          : ' · jamais connecté'}
                      </p>
                    </div>

                    <select
                      value={u.role}
                      onChange={e => changeRole(u, e.target.value as Role)}
                      disabled={busy || isSelf}
                      title={isSelf ? 'Vous ne pouvez pas modifier votre propre rôle' : 'Changer le rôle'}
                      className="input text-xs py-1 w-auto"
                    >
                      <option value="admin">Administrateur</option>
                      <option value="editeur">Éditeur</option>
                      <option value="club">Lecture seule</option>
                    </select>

                    <button
                      onClick={() => resetPassword(u)}
                      disabled={busy}
                      title="Définir un nouveau mot de passe"
                      className="btn-secondary text-xs py-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => removeUser(u)}
                      disabled={busy || isSelf}
                      title={isSelf ? 'Vous ne pouvez pas supprimer votre compte' : 'Supprimer le compte'}
                      className="btn-secondary text-xs py-1 text-red-600 border-red-200 disabled:text-slate-300 disabled:border-slate-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
