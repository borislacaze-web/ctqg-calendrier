// lib/image-export.ts
import type { Season } from '@/types'

export async function exportToImage(season: Season): Promise<void> {
  const html2canvas = (await import('html2canvas')).default

  const planningContent = document.getElementById('planning-content')
  const scrollBody      = document.getElementById('scroll-body-ref')
  const fixedBody       = document.getElementById('fixed-body-ref')

  if (!planningContent || !scrollBody || !fixedBody) return

  // Largeur totale réelle (zone fixe + zone scrollable)
  const totalW = fixedBody.scrollWidth + scrollBody.scrollWidth
  const totalH = planningContent.scrollHeight + 40 // marge de sécurité

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
      // onclone : html2canvas capture une COPIE du DOM. On modifie cette copie
      // pour tout déplier sans toucher l'affichage réel de l'utilisateur.
      onclone: (clonedDoc) => {
        const content = clonedDoc.getElementById('planning-content')
        const sBody   = clonedDoc.getElementById('scroll-body-ref')
        const fBody   = clonedDoc.getElementById('fixed-body-ref')

        if (content) {
          content.style.maxHeight = 'none'
          content.style.height    = 'auto'
        }
        if (sBody) {
          sBody.style.overflow  = 'visible'
          sBody.style.maxHeight = 'none'
          sBody.style.height    = 'auto'
        }
        if (fBody) {
          fBody.style.overflow  = 'visible'
          fBody.style.maxHeight = 'none'
          fBody.style.height    = 'auto'
        }

        // Supprimer les hauteurs de lignes forcées par la sync JS
        // pour que chaque ligne reprenne sa hauteur naturelle (= tout le contenu visible)
        clonedDoc.querySelectorAll('#planning-content tr').forEach(tr => {
          ;(tr as HTMLElement).style.height = 'auto'
        })
        // Donner un peu d'air aux cellules
        clonedDoc.querySelectorAll('#planning-content td').forEach(td => {
          ;(td as HTMLElement).style.paddingBottom = '8px'
        })
      },
    })

    const link = document.createElement('a')
    link.download = `Calendrier_CTQG_${season.name.replace('/', '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    console.error('Erreur export image:', e)
  }
}
