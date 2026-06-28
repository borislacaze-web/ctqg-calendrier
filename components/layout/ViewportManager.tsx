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
    const apply = () => {
      const isMobile = window.matchMedia('(max-width: 768px)').matches
      const content = isMobile
        ? 'width=1600, initial-scale=0.5, minimum-scale=0.1, maximum-scale=10, user-scalable=yes'
        : 'width=device-width, minimum-scale=0.2, maximum-scale=10, user-scalable=yes'

      // Firefox mobile ne relit pas initial-scale si on modifie le meta existant.
      // On supprime l'ancienne balise et on en recrée une neuve pour forcer le retraitement.
      const old = document.querySelector('meta[name="viewport"]')
      if (old) old.remove()
      const meta = document.createElement('meta')
      meta.name = 'viewport'
      meta.content = content
      document.head.appendChild(meta)
    }

    apply()
    const mq = window.matchMedia('(max-width: 768px)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return null
}
