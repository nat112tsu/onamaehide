import JSZip from 'jszip'
import type { ImageItem } from './types'
import { renderMaskedPngs } from './renderExport'
import { downloadBlob } from './exportImage'

export async function downloadAllAsZip(
  images: ImageItem[],
  color: string,
  onProgress?: (done: number, total: number) => void,
) {
  const zip = new JSZip()
  const pngs = await renderMaskedPngs(images, color, onProgress)
  for (const png of pngs) {
    zip.file(png.filename, png.blob)
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, 'masked_images.zip')
}
