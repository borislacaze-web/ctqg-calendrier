// components/layout/ViewportManager.tsx
'use client'
import { useEffect } from 'react'

/**
 * Sur mobile, fixe la largeur du viewport à 1600px (largeur du calendrier)
 * pour permettre de pincer/dézoomer sous la taille de base et avoir une vue d'ensemble.
 * Sur desktop, garde device-width (affichage normal).
 */
export default function ViewportManager() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
    if (!meta) return

    const apply = () => {
      const isMobile = window.matchMedia('(max-width: 768px)').matches
      if (isMobile) {
        // Largeur fixe > écran → permet le dézoom libre par pinch
        meta.setAttribute(
          'content',
          'width=1600, initial-scale=0.5, minimum-scale=0.1, maximum-scale=10, user-scalable=yes'
        )
      } else {
        meta.setAttribute(
          'content',
          'width=device-width, minimum-scale=0.2, maximum-scale=10, user-scalable=yes'
        )
      }
    }

    apply()
    const mq = window.matchMedia('(max-width: 768px)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return null
}
