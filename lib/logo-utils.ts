// lib/logo-utils.ts
// Charge le logo du comité en base64 (nécessaire pour jsPDF et pour fiabiliser html2canvas)

let cachedLogo: string | null = null

export async function getLogoBase64(): Promise<string | null> {
  if (cachedLogo) return cachedLogo
  try {
    const res = await fetch('/logo.png')
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    cachedLogo = dataUrl
    return dataUrl
  } catch (e) {
    console.error('Impossible de charger le logo:', e)
    return null
  }
}

// Récupère les dimensions d'une image base64 (pour conserver le ratio dans le PDF)
export function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => resolve({ width: 1, height: 1 })
    img.src = dataUrl
  })
}
