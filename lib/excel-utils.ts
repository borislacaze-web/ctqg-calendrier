// lib/excel-utils.ts
import * as XLSX from 'xlsx'
import { format, parseISO } from 'date-fns'
import type { CalendarEvent, Category, Subcategory, Season, ExportRow } from '@/types'

const EXPORT_COLUMNS = [
  'saison', 'date_debut', 'date_fin', 'semaine',
  'categorie', 'sous_categorie', 'titre', 'description',
  'lieu', 'public_concerne', 'statut', 'couleur'
]

/**
 * Exporte les événements au format Excel normalisé CTQG.
 * Ce format sert aussi de base pour la réimportation.
 */
export function exportToExcel(
  events: CalendarEvent[],
  categories: Category[],
  subcategories: Subcategory[],
  season: Season,
  filename?: string
): void {
  const catMap = new Map(categories.map(c => [c.id, c.name]))
  const subMap = new Map(subcategories.map(s => [s.id, s.name]))

  const rows: ExportRow[] = events.map(ev => ({
    saison:          season.name,
    date_debut:      format(parseISO(ev.start_date), 'dd/MM/yyyy'),
    date_fin:        format(parseISO(ev.end_date), 'dd/MM/yyyy'),
    semaine:         ev.week_number,
    categorie:       catMap.get(ev.category_id) ?? '',
    sous_categorie:  ev.subcategory_id ? (subMap.get(ev.subcategory_id) ?? '') : '',
    titre:           ev.title,
    description:     ev.description ?? '',
    lieu:            ev.location ?? '',
    public_concerne: ev.target_audience ?? '',
    statut:          ev.status,
    couleur:         ev.color ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS })

  // En-têtes lisibles
  ws['A1'] = { v: 'Saison' }
  ws['B1'] = { v: 'Date début' }
  ws['C1'] = { v: 'Date fin' }
  ws['D1'] = { v: 'Semaine' }
  ws['E1'] = { v: 'Catégorie' }
  ws['F1'] = { v: 'Sous-catégorie' }
  ws['G1'] = { v: 'Titre' }
  ws['H1'] = { v: 'Description' }
  ws['I1'] = { v: 'Lieu' }
  ws['J1'] = { v: 'Public concerné' }
  ws['K1'] = { v: 'Statut' }
  ws['L1'] = { v: 'Couleur' }

  // Largeurs de colonnes
  ws['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 9 },
    { wch: 22 }, { wch: 22 }, { wch: 40 }, { wch: 40 },
    { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 10 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Calendrier')

  const name = filename ?? `CTQG-Calendrier-${season.name.replace('/', '-')}.xlsx`
  XLSX.writeFile(wb, name)
}

/**
 * Parse un fichier Excel au format d'export CTQG.
 * Retourne les lignes validées, prêtes à être insérées.
 */
export function parseImportFile(
  file: ArrayBuffer,
  categories: Category[],
  subcategories: Subcategory[]
): { rows: Partial<CalendarEvent>[]; errors: string[] } {
  const wb = XLSX.read(file, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

  const catMap = new Map(categories.map(c => [c.name.toLowerCase().trim(), c.id]))
  const subMap = new Map(subcategories.map(s => [s.name.toLowerCase().trim(), s]))

  const rows: Partial<CalendarEvent>[] = []
  const errors: string[] = []

  // Détecte la ligne d'en-tête (clé normalisée)
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')

  raw.forEach((rawRow, idx) => {
    const row: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawRow)) {
      row[normalize(k)] = String(v).trim()
    }

    const lineNum = idx + 2
    const catName = (row['cat_gorie'] || row['categorie'] || '').toLowerCase().trim()
    const subName = (row['sous_cat_gorie'] || row['sous_categorie'] || '').toLowerCase().trim()
    const dateDebut = row['date_d_but'] || row['date_debut'] || ''
    const dateFin = row['date_fin'] || ''
    const titre = row['titre'] || ''
    const statut = (row['statut'] || 'previsionnel').toLowerCase()

    if (!titre) {
      errors.push(`Ligne ${lineNum} : titre manquant, ligne ignorée.`)
      return
    }

    // Parse dates DD/MM/YYYY
    const parseDate = (s: string): string | null => {
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (!m) return null
      return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }

    const startISO = parseDate(dateDebut)
    const endISO = parseDate(dateFin) || startISO

    if (!startISO) {
      errors.push(`Ligne ${lineNum} "${titre}" : date de début invalide ("${dateDebut}").`)
      return
    }

    const categoryId = catMap.get(catName)
    if (!categoryId) {
      errors.push(`Ligne ${lineNum} "${titre}" : catégorie "${catName}" inconnue.`)
      return
    }

    const sub = subMap.get(subName)
    const subcategoryId = sub?.id ?? null

    const validStatuses = ['previsionnel', 'confirme', 'annule', 'reporte']
    const finalStatus = validStatuses.includes(statut) ? statut : 'previsionnel'

    rows.push({
      category_id:    categoryId,
      subcategory_id: subcategoryId,
      title:          titre,
      description:    row['description'] || null,
      location:       row['lieu'] || null,
      target_audience: row['public_concern_'] || row['public_concerne'] || null,
      start_date:     startISO,
      end_date:       endISO!,
      status:         finalStatus as CalendarEvent['status'],
      color:          row['couleur'] || null,
    })
  })

  return { rows, errors }
}
