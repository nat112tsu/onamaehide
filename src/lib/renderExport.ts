import type { ImageItem } from './types'
import { renderMasked } from './maskRenderer'

export interface MaskedPng {
  filename: string
  blob: Blob
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNGへの変換に失敗しました'))
    }, 'image/png')
  })
}

export function renderImageMasked(image: ImageItem, color: string): HTMLCanvasElement {
  const base = document.createElement('canvas')
  base.width = image.width
  base.height = image.height
  const ctx = base.getContext('2d')
  ctx?.drawImage(image.imageBitmap, 0, 0)
  const rendered = renderMasked(base, image.masks, { color })
  // renderMaskedは新しいcanvasを返すため、下地は即座に解放してよい
  releaseCanvas(base)
  return rendered
}

// canvasのバッキングストアを手放す。大きなスクリーンショットを10枚扱うと
// GC待ちのcanvasだけで数百MBになり、スマホではタブごと落ちることがある。
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

export function maskedBaseName(image: ImageItem): string {
  return image.file.name.replace(/\.[^.]+$/, '')
}

/**
 * 全画像をマスク適用済みPNGに変換する。ZIPダウンロードと共有の両方がこれを使うため、
 * ファイル名の重複回避ルールは常に一致する。
 * 逐次処理なのは意図的（並列エンコードはメモリのピークが跳ね上がる）。
 */
export async function renderMaskedPngs(
  images: ImageItem[],
  color: string,
  onProgress?: (done: number, total: number) => void,
): Promise<MaskedPng[]> {
  const results: MaskedPng[] = []
  const usedNames = new Set<string>()

  for (const [index, image] of images.entries()) {
    const rendered = renderImageMasked(image, color)
    const blob = await canvasToPngBlob(rendered)
    releaseCanvas(rendered)

    const baseName = maskedBaseName(image)
    let filename = `${baseName}_masked.png`
    let suffix = 1
    while (usedNames.has(filename)) {
      filename = `${baseName}_masked_${suffix}.png`
      suffix++
    }
    usedNames.add(filename)

    results.push({ filename, blob })
    onProgress?.(index + 1, images.length)
  }

  return results
}
