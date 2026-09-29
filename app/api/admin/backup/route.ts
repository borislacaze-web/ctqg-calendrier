// app/api/admin/backup/route.ts
// Déclenchement manuel de la sauvegarde complète, depuis le bouton de
// l'administration. Réservé aux administrateurs. Logique dans lib/backup.ts.
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { runBackup } from '@/lib/backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

export async function POST() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const result = await runBackup()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
