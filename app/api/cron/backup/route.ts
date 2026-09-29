// app/api/cron/backup/route.ts
// Sauvegarde automatique mensuelle (voir vercel.json) — déclenchée par Vercel
// Cron, sans aucune action manuelle. Logique complète dans lib/backup.ts.
import { NextResponse } from 'next/server'
import { runBackup } from '@/lib/backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  // Vercel envoie automatiquement ce header quand CRON_SECRET est configuré :
  // ça empêche n'importe qui de déclencher la sauvegarde en devinant l'URL.
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const result = await runBackup()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
