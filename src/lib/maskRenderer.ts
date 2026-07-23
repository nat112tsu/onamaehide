import type { MaskBox, Rect } from './types'

export interface RenderOptions {
  color: string
}

function clampRect(rect: Rect, canvasWidth: number, canvasHeight: number): Rect {
  const x = Math.max(0, Math.min(Math.round(rect.x), canvasWidth))
  const y = Math.max(0, Math.min(Math.round(rect.y), canvasHeight))
  const width = Math.max(0, Math.min(Math.round(rect.width), canvasWidth - x))
  const height = Math.max(0, Math.min(Math.round(rect.height), canvasHeight - y))
  return { x, y, width, height }
}

export function applyMask(
  ctx: CanvasRenderingContext2D,
  mask: MaskBox,
  options: RenderOptions,
) {
  const rect = clampRect(mask.rect, ctx.canvas.width, ctx.canvas.height)
  if (rect.width <= 0 || rect.height <= 0) return

  ctx.fillStyle = options.color
  if (mask.shape === 'circle') {
    ctx.beginPath()
    ctx.ellipse(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width / 2,
      rect.height / 2,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  } else {
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  }
}

export function renderMasked(
  sourceCanvas: HTMLCanvasElement,
  masks: MaskBox[],
  options: RenderOptions,
): HTMLCanvasElement {
  const output = document.createElement('canvas')
  output.width = sourceCanvas.width
  output.height = sourceCanvas.height
  const ctx = output.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context を取得できませんでした')
  ctx.drawImage(sourceCanvas, 0, 0)

  for (const mask of masks) {
    if (!mask.enabled) continue
    applyMask(ctx, mask, options)
  }
  return output
}
