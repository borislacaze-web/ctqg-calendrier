// lib/image-export.ts
import html2canvas from 'html2canvas'
import type { Season } from '@/types'

export async function exportToImage(season: Season): Promise<void> {
  // On cible le contenu principal de la page (hors navbar)
  const target = document.getElementById('planning-content')
  if (!target) return

  // Avant la capture : on expand temporairement les divs overflow:hidden
  // pour que html2canvas voie tout le contenu
  const scrollBody = document.getElementById('scroll-body-ref')
  const fixedBody  = document.getElementById('fixed-body-ref')

  const prevScrollBodyOverflow = scrollBody?.style.overflow ?? ''
  const prevScrollBodyMaxH     = scrollBody?.style.maxHeight ?? ''
  const prevFixedBodyOverflow  = fixedBody?.style.overflow ?? ''
  const prevContainerMaxH      = target.style.maxHeight ?? ''

  if (scrollBody) { scrollBody.style.overflow = 'visible'; scrollBody.style.maxHeight = 'none' }
  if (fixedBody)  { fixedBody.style.overflow  = 'visible'; fixedBody.style.maxHeight  = 'none' }
  target.style.maxHeight = 'none'

  try {
    const canvas = await html2canvas(target, {
      scale: 2,           // haute définition (2×)
      useCORS: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth:  target.scrollWidth,
      windowHeight: target.scrollHeight,
      width:  target.scrollWidth,
      height: target.scrollHeight,
    })

    const link = document.createElement('a')
    link.download = `Calendrier_CTQG_${season.name.replace('/', '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } finally {
    // Restaurer les styles d'origine
    if (scrollBody) { scrollBody.style.overflow = prevScrollBodyOverflow; scrollBody.style.maxHeight = prevScrollBodyMaxH }
    if (fixedBody)  { fixedBody.style.overflow  = prevFixedBodyOverflow }
    target.style.maxHeight = prevContainerMaxH
  }
}
