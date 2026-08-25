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
      const isFirefox = /firefox|fxios/i.test(navigator.userAgent)

      let content: string
      if (isMobile) {
        if (isFirefox) {
          // Firefox ignore initial-scale avec width fixe et fait du "fit-to-width".
          // On réduit donc la largeur du viewport pour obtenir un zoom de départ ~0.5
          // (≈ moitié de 1600). L'utilisateur peut toujours pincer librement ensuite.
          content = 'width=800, minimum-scale=0.1, maximum-scale=10, user-scalable=yes'
        } else {
          content = 'width=1600, initial-scale=0.5, minimum-scale=0.1, maximum-scale=10, user-scalable=yes'
        }
      } else {
        content = 'width=device-width, minimum-scale=0.2, maximum-scale=10, user-scalable=yes'
      }

      // On modifie l'attribut de la balise existante (gérée par Next.js) au lieu de la
      // supprimer/recréer : la supprimer casse la référence que React garde vers ce nœud
      // et provoque un crash "removeChild / parentNode is null" au prochain nettoyage React
      // (typiquement juste après l'hydratation, dès le premier chargement d'une page).
      const existing = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
      if (existing) {
        existing.content = content
      } else {
        const meta = document.createElement('meta')
        meta.name = 'viewport'
        meta.content = content
        document.head.appendChild(meta)
      }
    }

    apply()
    const mq = window.matchMedia('(max-width: 768px)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return null
}
