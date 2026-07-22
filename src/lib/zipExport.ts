import JSZip from 'jszip'
import type { ImageItem } from './types'
import { renderMasked } from './maskRenderer'

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNGへの変換に失敗しました'))
    }, 'image/png')
  })
}

function renderImageMasked(image: ImageItem, color: string): HTMLCanvasElement {
  const base = document.createElement('canvas')
  base.width = image.width
  base.height = image.height
  const ctx = base.getContext('2d')
  ctx?.drawImage(image.imageBitmap, 0, 0)
  return renderMasked(base, image.masks, { color })
}

export async function downloadAllAsZip(images: ImageItem[], color: string) {
  const zip = new JSZip()
  const usedNames = new Set<string>()

  for (const image of images) {
    const rendered = renderImageMasked(image, color)
    const blob = await canvasToPngBlob(rendered)
    const baseName = image.file.name.replace(/\.[^.]+$/, '')
    let filename = `${baseName}_masked.png`
    let suffix = 1
    while (usedNames.has(filename)) {
      filename = `${baseName}_masked_${suffix}.png`
      suffix++
    }
    usedNames.add(filename)
    zip.file(filename, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'masked_images.zip'
  a.click()
  URL.revokeObjectURL(url)
}
