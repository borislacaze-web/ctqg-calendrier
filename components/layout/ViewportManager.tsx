// components/layout/ViewportManager.tsx
'use client'
import { useEffect } from 'react'

/**
 * Garantit un viewport width=device-width sur tous les appareils.
 * Une largeur fixe (ex. 1600px) casserait le layout à colonnes fixes du planning :
 * la page entière déborderait et scrollerait horizontalement, emportant la navbar
 * et les colonnes Semaine/W-End hors de l'écran.
 * Le pinch-to-zoom reste autorisé (minimum-scale bas + user-scalable=yes).
 */
export default function ViewportManager() {
  useEffect(() => {
    const apply = () => {
      // width=device-width partout : indispensable pour que le layout à colonnes
      // fixes (Semaine / W-End) fonctionne. Avec une largeur de viewport fixe
      // (ex. 1600px), la PAGE elle-même déborde et scrolle horizontalement, ce qui
      // emporte la navbar et les colonnes "fixes" hors de l'écran.
      // Le pinch-to-zoom reste possible grâce à minimum-scale bas + user-scalable=yes.
      const content = 'width=device-width, initial-scale=1, minimum-scale=0.1, maximum-scale=10, user-scalable=yes'

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
