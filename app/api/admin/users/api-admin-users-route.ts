// app/api/admin/users/route.ts
// Gestion des comptes utilisateurs — réservée aux administrateurs.
// Utilise la clé "service_role" de Supabase, qui ne doit JAMAIS être exposée
// côté navigateur : ce fichier s'exécute uniquement sur le serveur.
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Vérifie que l'appelant est bien connecté ET administrateur. */
async function requireAdmin() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté', status: 401 as const }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Accès réservé aux administrateurs', status: 403 as const }
  }
  return { user }
}

// ── Liste des comptes ──
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const admin = adminClient()
  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const { data: profiles } = await admin.from('user_profiles').select('*')
  const roleById = new Map((profiles ?? []).map(p => [p.id, p]))

  const users = authUsers.users.map(u => ({
    id:         u.id,
    email:      u.email ?? '',
    role:       roleById.get(u.id)?.role ?? 'club',
    club_name:  roleById.get(u.id)?.club_name ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
  }))
  // Les plus récents d'abord
  users.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  return NextResponse.json({ users })
}

// ── Création d'un compte ──
export async function POST(request: Request) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { email, password, role, club_name } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email et mot de passe obligatoires' }, { status: 400 })
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit faire au moins 8 caractères' }, { status: 400 })
  }
  if (!['admin', 'editeur', 'club'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  const admin = adminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // compte utilisable immédiatement, sans email de confirmation
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Le trigger de la base crée le profil avec le rôle par défaut : on le met à jour.
  const { error: profileError } = await admin
    .from('user_profiles')
    .upsert({ id: data.user.id, role, club_name: club_name || null })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.user.id })
}

// ── Changement de rôle ──
export async function PATCH(request: Request) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id, role, club_name } = await request.json()
  if (!id || !['admin', 'editeur', 'club'].includes(role)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const admin = adminClient()
  const { error } = await admin
    .from('user_profiles')
    .upsert({ id, role, club_name: club_name ?? null })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ── Suppression d'un compte ──
export async function DELETE(request: Request) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 })

  // Sécurité : on ne peut pas supprimer son propre compte
  if (id === check.user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 })
  }

  const admin = adminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
