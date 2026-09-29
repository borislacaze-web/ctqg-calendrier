// lib/backup.ts
// Logique de sauvegarde complète (données + documents joints), utilisée à la
// fois par la sauvegarde automatique mensuelle (Cron) et le bouton manuel.
import { createClient as createAdminClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const TABLES = [
  'seasons', 'categories', 'subcategories',
  'events', 'event_documents', 'user_profiles',
] as const

// Marge de sécurité sous la limite d'exécution serverless (60s sur Vercel Hobby) :
// on arrête de récupérer des documents au-delà de ce budget de temps.
const TIME_BUDGET_MS = 42_000
// Taille maximale (avant compression) des documents inclus, pour rester sous
// les limites d'envoi d'email (au-delà, ils sont listés comme non inclus).
const MAX_DOCS_BYTES = 15 * 1024 * 1024

type BackupResult =
  | { ok: true; filename: string; events: number; documentsTotal: number; documentsIncluded: number; documentsSkipped: number }
  | { ok: false; error: string }

export async function runBackup(): Promise<BackupResult> {
  const admin = adminClient()

  const backup: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    app: 'ctqg-calendrier',
  }

  for (const table of TABLES) {
    const { data, error } = await admin.from(table).select('*')
    if (error) return { ok: false, error: `Échec export ${table} : ${error.message}` }
    backup[table] = data
  }

  const zip = new JSZip()
  zip.file('donnees.json', JSON.stringify(backup, null, 2))

  const docs = (Array.isArray(backup.event_documents) ? backup.event_documents : []) as Array<{
    id: string; filename: string; file_url: string
  }>
  const docsFolder = zip.folder('documents')

  const startedAt = Date.now()
  let bytesIncluded = 0
  let included = 0
  const skipped: string[] = []

  for (const doc of docs) {
    const overTime = Date.now() - startedAt > TIME_BUDGET_MS
    const overSize = bytesIncluded > MAX_DOCS_BYTES
    if (overTime || overSize) { skipped.push(doc.filename ?? doc.id); continue }

    try {
      const res = await fetch(doc.file_url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      // Préfixe par l'id : évite les collisions si deux documents portent le même nom
      docsFolder?.file(`${doc.id}_${doc.filename}`, buf)
      bytesIncluded += buf.byteLength
      included++
    } catch {
      skipped.push(doc.filename ?? doc.id)
    }
  }

  if (skipped.length > 0) {
    zip.file(
      'documents_non_recuperes.txt',
      'Ces documents n\'ont pas pu être inclus (taille/temps limités) :\n\n' + skipped.join('\n')
    )
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  const base64Zip = zipBuffer.toString('base64')
  const filename = `backup-ctqg-calendrier-${new Date().toISOString().slice(0, 10)}.zip`

  const resendApiKey = process.env.RESEND_API_KEY
  const backupEmailTo = process.env.BACKUP_EMAIL_TO
  if (!resendApiKey || !backupEmailTo) {
    return { ok: false, error: 'RESEND_API_KEY ou BACKUP_EMAIL_TO manquant' }
  }

  const eventCount = Array.isArray(backup.events) ? backup.events.length : 0

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Sauvegarde CTQG <onboarding@resend.dev>',
      to: [backupEmailTo],
      subject: `Sauvegarde — Calendrier CTQG — ${new Date().toLocaleDateString('fr-FR')}`,
      html: `
        <p>Voici la sauvegarde complète du Calendrier CTQG (données + documents joints).</p>
        <p><strong>${eventCount}</strong> événement(s) · <strong>${included}</strong> document(s) inclus
        ${skipped.length ? ` · ${skipped.length} non récupéré(s) (voir documents_non_recuperes.txt dans l'archive)` : ''}.</p>
        <p>Conservez cette archive (.zip) dans un dossier sûr sur votre PC.</p>
      `,
      attachments: [{ filename, content: base64Zip }],
    }),
  })

  if (!emailRes.ok) {
    const errText = await emailRes.text()
    return { ok: false, error: `Échec envoi email : ${errText}` }
  }

  return {
    ok: true,
    filename,
    events: eventCount,
    documentsTotal: docs.length,
    documentsIncluded: included,
    documentsSkipped: skipped.length,
  }
}
