// lib/image-export.ts
import type { Season } from '@/types'

export async function exportToImage(season: Season): Promise<void> {
  const html2canvas = (await import('html2canvas')).default

  const planningContent = document.getElementById('planning-content')
  const scrollBody      = document.getElementById('scroll-body-ref')
  const fixedBody       = document.getElementById('fixed-body-ref')

  if (!planningContent || !scrollBody || !fixedBody) return

  // ── Sauvegarder les styles ──
  const saved = {
    contentMaxH:     planningContent.style.maxHeight,
    contentH:        planningContent.style.height,
    contentFlex:     planningContent.style.flex,
    scrollOverflowX: scrollBody.style.overflowX,
    scrollOverflowY: scrollBody.style.overflowY,
    scrollMaxH:      scrollBody.style.maxHeight,
    scrollH:         scrollBody.style.height,
    fixedOverflowY:  fixedBody.style.overflowY,
    fixedH:          fixedBody.style.height,
  }

  // ── Déplier complètement : on enlève toutes les contraintes de hauteur ──
  planningContent.style.maxHeight = 'none'
  planningContent.style.height    = 'auto'
  planningContent.style.flex      = 'none'
  scrollBody.style.overflowX      = 'visible'
  scrollBody.style.overflowY      = 'visible'
  scrollBody.style.maxHeight      = 'none'
  scrollBody.style.height         = 'auto'
  fixedBody.style.overflowY       = 'visible'
  fixedBody.style.height          = 'auto'

  // Réaligner les hauteurs gauche/droite sur le CONTENU réel (anti-tronquage + anti-décalage)
  const fixedTbl  = fixedBody.querySelector('table') as HTMLTableElement | null
  const scrollTbl = scrollBody.querySelector('table') as HTMLTableElement | null
  const fixedRows  = fixedTbl  ? Array.from(fixedTbl.querySelectorAll('tr')) as HTMLElement[]  : []
  const scrollRows = scrollTbl ? Array.from(scrollTbl.querySelectorAll('tr')) as HTMLElement[] : []
  const savedFixedH  = fixedRows.map(r => r.style.height)
  const savedScrollH = scrollRows.map(r => r.style.height)

  // Forcer les badges (boutons) à afficher tout leur contenu sans coupure
  // + corriger le décalage vertical du texte (bug html2canvas avec line-height en ratio)
  const badges = Array.from(planningContent.querySelectorAll('button')) as HTMLElement[]
  const savedBadge = badges.map(b => ({
    overflow:   b.style.overflow,
    height:     b.style.height,
    maxHeight:  b.style.maxHeight,
    whiteSpace: b.style.whiteSpace,
    minHeight:  b.style.minHeight,
    lineHeight: b.style.lineHeight,
    display:    b.style.display,
  }))
  badges.forEach(b => {
    b.style.overflow   = 'visible'
    b.style.height     = 'auto'
    b.style.maxHeight  = 'none'
    b.style.minHeight  = 'auto'
    b.style.whiteSpace = 'normal'
    // line-height explicite en px (html2canvas gère mal les ratios → texte décalé)
    b.style.lineHeight = '13px'
  })

  // Même correction sur tous les spans/strong à l'intérieur des badges
  const badgeTexts = Array.from(planningContent.querySelectorAll('button span, button strong')) as HTMLElement[]
  const savedTextLH = badgeTexts.map(t => t.style.lineHeight)
  badgeTexts.forEach(t => { t.style.lineHeight = '13px' })

  // 1. Reset à auto pour mesurer la hauteur naturelle
  fixedRows.forEach(r => { r.style.height = 'auto' })
  scrollRows.forEach(r => { r.style.height = 'auto' })
  void planningContent.offsetHeight // forcer reflow

  // 2. Mesurer et appliquer le max(gauche, droite) à chaque paire de lignes
  const len = Math.min(fixedRows.length, scrollRows.length)
  const heights: number[] = []
  for (let i = 0; i < len; i++) {
    heights[i] = Math.ceil(Math.max(
      fixedRows[i].getBoundingClientRect().height,
      scrollRows[i].getBoundingClientRect().height,
    ))
  }
  for (let i = 0; i < len; i++) {
    fixedRows[i].style.height  = `${heights[i]}px`
    scrollRows[i].style.height = `${heights[i]}px`
  }

  // Laisser le layout se stabiliser COMPLÈTEMENT
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 250))

  // Mesurer APRÈS stabilisation
  // Largeur = largeur des tables internes (plus fiable que scrollWidth des conteneurs)
  const fixedTableW  = fixedTbl  ? fixedTbl.getBoundingClientRect().width  : fixedBody.scrollWidth
  const scrollTableW = scrollTbl ? scrollTbl.getBoundingClientRect().width : scrollBody.scrollWidth
  const totalW = Math.ceil(fixedTableW + scrollTableW) + 4 // +4 marge bordure droite
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
    badges.forEach((b, i) => {
      b.style.overflow   = savedBadge[i].overflow
      b.style.height     = savedBadge[i].height
      b.style.maxHeight  = savedBadge[i].maxHeight
      b.style.minHeight  = savedBadge[i].minHeight
      b.style.whiteSpace = savedBadge[i].whiteSpace
      b.style.lineHeight = savedBadge[i].lineHeight
      b.style.display    = savedBadge[i].display
    })
    badgeTexts.forEach((t, i) => { t.style.lineHeight = savedTextLH[i] })
    fixedRows.forEach((r, i) => { r.style.height = savedFixedH[i] })
    scrollRows.forEach((r, i) => { r.style.height = savedScrollH[i] })
    planningContent.style.maxHeight = saved.contentMaxH
    planningContent.style.height    = saved.contentH
    planningContent.style.flex      = saved.contentFlex
    scrollBody.style.overflowX      = saved.scrollOverflowX
    scrollBody.style.overflowY      = saved.scrollOverflowY
    scrollBody.style.maxHeight      = saved.scrollMaxH
    scrollBody.style.height         = saved.scrollH
    fixedBody.style.overflowY       = saved.fixedOverflowY
    fixedBody.style.height          = saved.fixedH
  }
}
