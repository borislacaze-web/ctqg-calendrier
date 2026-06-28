// lib/image-export.ts
import type { Season } from '@/types'

export async function exportToImage(season: Season): Promise<void> {
  const html2canvas = (await import('html2canvas')).default

  const planningContent = document.getElementById('planning-content')
  const scrollBody      = document.getElementById('scroll-body-ref')
  const fixedBody       = document.getElementById('fixed-body-ref')
  const scrollHeader    = document.getElementById('scroll-header-ref')

  if (!planningContent || !scrollBody || !fixedBody) return

  // ── 1. Mémoriser les styles actuels ──
  const saved = {
    contentMaxH:   planningContent.style.maxHeight,
    contentH:      planningContent.style.height,
    scrollOverflowX: scrollBody.style.overflowX,
    scrollOverflowY: scrollBody.style.overflowY,
    scrollMaxH:    scrollBody.style.maxHeight,
    fixedOverflowY: fixedBody.style.overflowY,
    fixedH:        fixedBody.style.height,
  }

  // ── 2. Expand tout pour que html2canvas voie le contenu complet ──
  planningContent.style.maxHeight = 'none'
  planningContent.style.height    = 'auto'

  // Zone scroll droite : montrer tout le contenu
  scrollBody.style.overflowX = 'visible'
  scrollBody.style.overflowY = 'visible'
  scrollBody.style.maxHeight = 'none'

  // Zone fixe gauche : aligner la hauteur sur la zone droite
  fixedBody.style.overflowY = 'visible'
  fixedBody.style.height    = 'auto'

  // Laisser le navigateur recalculer le layout
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))

  // ── 3. Calculer la largeur totale réelle (fixe + scrollable) ──
  const fixedW  = fixedBody.scrollWidth
  const scrollW = scrollBody.scrollWidth
  const totalW  = fixedW + scrollW
  const totalH  = planningContent.scrollHeight

  try {
    const canvas = await html2canvas(planningContent, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth:  totalW,
      windowHeight: totalH,
      width:  totalW,
      height: totalH,
    })

    const link = document.createElement('a')
    link.download = `Calendrier_CTQG_${season.name.replace('/', '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } finally {
    // ── 4. Restaurer tous les styles ──
    planningContent.style.maxHeight = saved.contentMaxH
    planningContent.style.height    = saved.contentH
    scrollBody.style.overflowX      = saved.scrollOverflowX
    scrollBody.style.overflowY      = saved.scrollOverflowY
    scrollBody.style.maxHeight      = saved.scrollMaxH
    fixedBody.style.overflowY       = saved.fixedOverflowY
    fixedBody.style.height          = saved.fixedH
  }
}
