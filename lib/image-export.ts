// lib/image-export.ts
import type { Season } from '@/types'
import { getLogoBase64 } from './logo-utils'

// Charge une image base64/URL en élément <img> prêt pour canvas.drawImage
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function exportToImage(season: Season): Promise<void> {
  // html2canvas-pro corrige le bug de décalage vertical du texte de html2canvas 1.x
  const html2canvas = (await import('html2canvas-pro')).default

  const planningContent = document.getElementById('planning-content')
  const scrollBody      = document.getElementById('scroll-body-ref')
  const fixedBody       = document.getElementById('fixed-body-ref')

  if (!planningContent || !scrollBody || !fixedBody) return

  const fixedTbl  = fixedBody.querySelector('table') as HTMLTableElement | null
  const scrollTbl = scrollBody.querySelector('table') as HTMLTableElement | null

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

  // ── Déplier complètement ──
  planningContent.style.maxHeight = 'none'
  planningContent.style.height    = 'auto'
  planningContent.style.flex      = 'none'
  scrollBody.style.overflowX      = 'visible'
  scrollBody.style.overflowY      = 'visible'
  scrollBody.style.maxHeight      = 'none'
  scrollBody.style.height         = 'auto'
  fixedBody.style.overflowY       = 'visible'
  fixedBody.style.height          = 'auto'

  // ── Aligner les hauteurs gauche/droite ──
  const fixedRows  = fixedTbl  ? Array.from(fixedTbl.querySelectorAll('tr')) as HTMLElement[]  : []
  const scrollRows = scrollTbl ? Array.from(scrollTbl.querySelectorAll('tr')) as HTMLElement[] : []
  const savedFixedH  = fixedRows.map(r => r.style.height)
  const savedScrollH = scrollRows.map(r => r.style.height)

  fixedRows.forEach(r => { r.style.height = 'auto' })
  scrollRows.forEach(r => { r.style.height = 'auto' })
  void planningContent.offsetHeight

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

  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 200))

  // Largeur = scrollWidth des tables internes (capture toute la largeur, même hors viewport)
  const fixedTableW  = fixedTbl  ? fixedTbl.scrollWidth  : fixedBody.scrollWidth
  const scrollTableW = scrollTbl ? scrollTbl.scrollWidth : scrollBody.scrollWidth
  const totalW = Math.ceil(fixedTableW + scrollTableW) + 20  // marge anti-crop (validée sans coupure)
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

    // ── Composer une image finale : bande d'en-tête (logo + saison) + planning ──
    const scale = 2
    const headerH = 70 * scale          // hauteur de la bande d'en-tête
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width  = canvas.width
    finalCanvas.height = canvas.height + headerH
    const ctx = finalCanvas.getContext('2d')!

    // Fond blanc
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height)

    // Logo à gauche
    const logo = await getLogoBase64()
    let textStartX = 24 * scale
    if (logo) {
      try {
        const logoImg = await loadImage(logo)
        const logoH = 54 * scale
        const logoW = (logoImg.width / logoImg.height) * logoH
        const logoY = (headerH - logoH) / 2
        ctx.drawImage(logoImg, 24 * scale, logoY, logoW, logoH)
        textStartX = 24 * scale + logoW + 16 * scale
      } catch (e) {
        console.error('Erreur logo image:', e)
      }
    }

    // Titre : nom de la saison
    ctx.fillStyle = '#1e3a8a'
    ctx.font = `bold ${26 * scale}px Inter, Arial, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(`Calendrier Général CTQG — Saison ${season.name}`, textStartX, headerH * 0.42)

    // Sous-titre : date d'export
    ctx.fillStyle = '#64748b'
    ctx.font = `${15 * scale}px Inter, Arial, sans-serif`
    const exportDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    ctx.fillText(`Exporté le ${exportDate}`, textStartX, headerH * 0.72)

    // Dessiner le planning sous l'en-tête
    ctx.drawImage(canvas, 0, headerH)

    const link = document.createElement('a')
    link.download = `Calendrier_CTQG_${season.name.replace('/', '-')}.png`
    link.href = finalCanvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    console.error('Erreur export image:', e)
  } finally {
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
