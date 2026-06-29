// lib/pdf-utils.ts
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CalendarEvent, Category, Season } from '@/types'
import { STATUS_LABELS } from './week-utils'
import { getLogoBase64, getImageSize } from './logo-utils'

export async function exportToPDF(
  events: CalendarEvent[],
  categories: Category[],
  season: Season,
  title?: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const catMap = new Map(categories.map(c => [c.id, c]))

  // Logo du comité en haut à gauche
  let textX = 14
  const logo = await getLogoBase64()
  if (logo) {
    try {
      const { width, height } = await getImageSize(logo)
      const logoH = 14            // hauteur fixe 14mm
      const logoW = (width / height) * logoH
      doc.addImage(logo, 'PNG', 14, 8, logoW, logoH)
      textX = 14 + logoW + 4      // décaler le texte après le logo
    } catch (e) {
      console.error('Erreur ajout logo PDF:', e)
    }
  }

  // En-tête
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title ?? `Calendrier CTQG — Saison ${season.name}`, textX, 16)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Exporté le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`,
    textX,
    22
  )

  // Tableau
  const rows = events.map(ev => {
    const cat = catMap.get(ev.category_id)
    return [
      format(parseISO(ev.start_date), 'dd/MM/yyyy'),
      format(parseISO(ev.end_date), 'dd/MM/yyyy'),
      `S${ev.week_number}`,
      cat?.name ?? '',
      ev.title,
      ev.location ?? '',
      STATUS_LABELS[ev.status] ?? ev.status,
    ]
  })

  autoTable(doc, {
    startY: 26,
    head: [['Début', 'Fin', 'Semaine', 'Catégorie', 'Événement', 'Lieu', 'Statut']],
    body: rows,
    headStyles: {
      fillColor: [30, 64, 175],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 16 },
      3: { cellWidth: 38 },
      4: { cellWidth: 70 },
      5: { cellWidth: 35 },
      6: { cellWidth: 24 },
    },
    didParseCell: (data) => {
      // Colorer les lignes selon statut
      if (data.section === 'body' && data.column.index === 6) {
        const statut = events[data.row.index]?.status
        if (statut === 'annule') data.cell.styles.textColor = [220, 38, 38]
        if (statut === 'reporte') data.cell.styles.textColor = [234, 88, 12]
        if (statut === 'confirme') data.cell.styles.textColor = [22, 163, 74]
      }
    },
  })

  doc.save(`CTQG-Calendrier-${season.name.replace('/', '-')}.pdf`)
}
