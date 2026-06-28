// lib/image-export.ts
import type { Season } from '@/types'

export async function exportToImage(season: Season): Promise<void> {
  const html2canvas = (await import('html2canvas')).default

  const planningContent = document.getElementById('planning-content')
  const scrollBody      = document.getElementById('scroll-body-ref')
  const fixedBody       = document.getElementById('fixed-body-ref')

  if (!planningContent || !scrollBody || !fixedBody) return

  const fixedTable  = fixedBody.querySelector('table') as HTMLTableElement | null
  const scrollTable = scrollBody.querySelector('table') as HTMLTableElement | null
  if (!fixedTable || !scrollTable) return

  // ── Sauvegarder les styles ──
  const saved = {
    contentMaxH:     planningContent.style.maxHeight,
    contentH:        planningContent.style.height,
    scrollOverflowX: scrollBody.style.overflowX,
    scrollOverflowY: scrollBody.style.overflowY,
    scrollMaxH:      scrollBody.style.maxHeight,
    scrollH:         scrollBody.style.height,
    fixedOverflowY:  fixedBody.style.overflowY,
    fixedH:          fixedBody.style.height,
  }

  // Sauvegarder les hauteurs de lignes actuelles
  const fixedRows  = Array.from(fixedTable.querySelectorAll('tr')) as HTMLElement[]
  const scrollRows = Array.from(scrollTable.querySelectorAll('tr')) as HTMLElement[]
  const savedFixedH  = fixedRows.map(r => r.style.height)
  const savedScrollH = scrollRows.map(r => r.style.height)

  // ── Déplier les conteneurs ──
  planningContent.style.maxHeight = 'none'
  planningContent.style.height    = 'auto'
  scrollBody.style.overflowX      = 'visible'
  scrollBody.style.overflowY      = 'visible'
  scrollBody.style.maxHeight      = 'none'
  scrollBody.style.height         = 'auto'
  fixedBody.style.overflowY       = 'visible'
  fixedBody.style.height          = 'auto'

  // ── Recalculer les hauteurs sur le CONTENU réel (scrollHeight) ──
  // Reset d'abord pour mesurer la hauteur naturelle complète
  const len = Math.min(fixedRows.length, scrollRows.length)
  for (let i = 0; i < len; i++) {
    fixedRows[i].style.height = 'auto'
    scrollRows[i].style.height = 'auto'
  }
  // Forcer reflow
  void planningContent.offsetHeight
  // Mesurer le contenu réel de chaque ligne (scrollHeight des cellules) et aligner sur le max
  for (let i = 0; i < len; i++) {
    const fCells = Array.from(fixedRows[i].querySelectorAll('td, th')) as HTMLElement[]
    const sCells = Array.from(scrollRows[i].querySelectorAll('td, th')) as HTMLElement[]
    let maxH = 0
    ;[...fCells, ...sCells].forEach(c => { maxH = Math.max(maxH, c.scrollHeight) })
    maxH = Math.ceil(maxH) + 4 // petite marge anti-tronquage
    fixedRows[i].style.height = `${maxH}px`
    scrollRows[i].style.height = `${maxH}px`
  }

  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 100))

  const totalW = fixedBody.scrollWidth + scrollBody.scrollWidth
  const totalH = planningContent.scrollHeight

  try {
    const canvas = await html2canvas(planningContent, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width:  totalW,
      height: totalH,
      windowWidth:  totalW,
      windowHeight: totalH,
      scrollX: 0,
      scrollY: 0,
    })

    const link = document.createElement('a')
    link.download = `Calendrier_CTQG_${season.name.replace('/', '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    console.error('Erreur export image:', e)
  } finally {
    // ── Restaurer hauteurs de lignes ──
    fixedRows.forEach((r, i) => { r.style.height = savedFixedH[i] })
    scrollRows.forEach((r, i) => { r.style.height = savedScrollH[i] })
    // ── Restaurer conteneurs ──
    planningContent.style.maxHeight = saved.contentMaxH
    planningContent.style.height    = saved.contentH
    scrollBody.style.overflowX      = saved.scrollOverflowX
    scrollBody.style.overflowY      = saved.scrollOverflowY
    scrollBody.style.maxHeight      = saved.scrollMaxH
    scrollBody.style.height         = saved.scrollH
    fixedBody.style.overflowY       = saved.fixedOverflowY
    fixedBody.style.height          = saved.fixedH
  }
}
