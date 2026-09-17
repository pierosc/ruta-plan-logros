export const isVideoMedia = (file) => file?.type?.startsWith('video/')
  || /\.(mp4|mov|m4v|webm|ogv|ogg)$/i.test(file?.name || '')

export const actionMediaError = (file) => {
  if (isVideoMedia(file)) return file.size > 50 * 1024 * 1024 ? 'Usa videos de hasta 50 MB.' : ''
  if (!file.type?.startsWith('image/')) return 'Selecciona una imagen o un video.'
  return file.size > 8 * 1024 * 1024 ? 'Usa imágenes de hasta 8 MB.' : ''
}

// A video contributes a still frame to the PDF; its original stays in local storage.
export const mediaToPdfImage = async (blob, attachment = {}) => {
  const video = isVideoMedia(blob) || isVideoMedia(attachment)
  const media = video ? document.createElement('video') : new Image()
  const url = URL.createObjectURL(blob)
  const canvas = document.createElement('canvas')
  let timer
  try {
    await new Promise((resolve, reject) => {
      timer = window.setTimeout(() => reject(new Error('No se pudo preparar la evidencia a tiempo.')), 20000)
      media.onerror = () => reject(new Error('Este formato no se puede leer en tu navegador.'))
      if (video) {
        media.muted = true
        media.playsInline = true
        media.preload = 'auto'
        media.onloadeddata = () => {
          media.onloadeddata = null
          // Avoid an opening black frame and stay inside even very short videos.
          const time = Number.isFinite(media.duration) ? Math.min(1, media.duration / 4) : 0
          if (time > 0) {
            media.onseeked = resolve
            media.currentTime = time
          } else resolve()
        }
      } else media.onload = resolve
      media.src = url
    })
    const width = video ? media.videoWidth : media.naturalWidth
    const height = video ? media.videoHeight : media.naturalHeight
    if (!width || !height) throw new Error('La evidencia está vacía.')
    const scale = Math.min(1, 2000 / Math.max(width, height))
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la evidencia.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(media, 0, 0, canvas.width, canvas.height)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width, height }
  } finally {
    window.clearTimeout(timer)
    media.onload = null
    media.onerror = null
    if (video) {
      media.onloadeddata = null
      media.onseeked = null
      media.pause()
      media.removeAttribute('src')
      media.load()
    } else media.src = ''
    URL.revokeObjectURL(url)
    canvas.width = 0
    canvas.height = 0
  }
}
