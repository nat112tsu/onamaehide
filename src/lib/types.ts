export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface OcrWord {
  id: string
  text: string
  bbox: Rect
}

export type MaskShape = 'rect' | 'circle'

export interface MaskBox {
  id: string
  rect: Rect
  shape: MaskShape
  source: 'manual' | 'name'
  label?: string
  enabled: boolean
}

export interface ImageItem {
  id: string
  file: File
  imageBitmap: ImageBitmap
  width: number
  height: number
  ocrWords: OcrWord[]
  ocrStatus: 'pending' | 'running' | 'done' | 'error'
  masks: MaskBox[]
}
