// app/api/cron/backup/route.ts
// Sauvegarde automatique hebdomadaire de toutes les données du calendrier.
// Déclenchée par Vercel Cron (voir vercel.json), sans aucune action manuelle.
// Exporte les tables clés en un seul fichier JSON, envoyé par email en pièce
// jointe via Resend (aucune dépendance npm supplémentaire : simple appel HTTP).
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: Request) {
  // Vercel envoie automatiquement ce header quand CRON_SECRET est configuré :
  // ça empêche n'importe qui de déclencher la sauvegarde en devinant l'URL.
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = adminClient()

  // ── Export de toutes les tables utiles à une restauration complète ──
  const tables = [
    'seasons', 'categories', 'subcategories',
    'events', 'event_documents', 'user_profiles',
  ] as const

  const backup: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    app: 'ctqg-calendrier',
  }

  for (const table of tables) {
    const { data, error } = await admin.from(table).select('*')
    if (error) {
      return NextResponse.json({ error: `Échec export ${table} : ${error.message}` }, { status: 500 })
    }
    backup[table] = data
  }

  const filename = `backup-ctqg-calendrier-${new Date().toISOString().slice(0, 10)}.json`
  const jsonContent = JSON.stringify(backup, null, 2)
  const base64Content = Buffer.from(jsonContent, 'utf-8').toString('base64')

  // ── Envoi par email via l'API HTTP de Resend (pas de SDK à installer) ──
  const resendApiKey = process.env.RESEND_API_KEY
  const backupEmailTo = process.env.BACKUP_EMAIL_TO
  if (!resendApiKey || !backupEmailTo) {
    return NextResponse.json({ error: 'RESEND_API_KEY ou BACKUP_EMAIL_TO manquant' }, { status: 500 })
  }

  const eventCount = Array.isArray(backup.events) ? backup.events.length : 0
  const docCount = Array.isArray(backup.event_documents) ? backup.event_documents.length : 0

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Sauvegarde CTQG <onboarding@resend.dev>',
      to: [backupEmailTo],
      subject: `Sauvegarde hebdomadaire — Calendrier CTQG — ${new Date().toLocaleDateString('fr-FR')}`,
      html: `
        <p>Voici la sauvegarde automatique hebdomadaire du Calendrier CTQG.</p>
        <p><strong>${eventCount}</strong> événement(s) et <strong>${docCount}</strong> document(s) référencé(s).</p>
        <p>Conservez cette pièce jointe (fichier .json) dans un dossier sûr sur votre PC.
        En cas de besoin, transmettez-la pour une restauration.</p>
      `,
      attachments: [
        { filename, content: base64Content },
      ],
    }),
  })

  if (!emailRes.ok) {
    const errText = await emailRes.text()
    return NextResponse.json({ error: `Échec envoi email : ${errText}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    filename,
    events: eventCount,
    documents: docCount,
  })
}
