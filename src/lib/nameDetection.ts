import { findFuzzySubstringMatch, isFuzzyMatch } from './fuzzyMatch'
import type { MaskBox, OcrWord, Rect } from './types'

// OCRのバウンディングボックスは文字の実際の見た目より一回り小さく出ることが多く、
// マスクの縁から文字がわずかにはみ出すことがあるため、余白を持たせて安全側に倒す。
function padRect(rect: Rect): Rect {
  const padX = Math.max(2, rect.width * 0.08)
  const padY = Math.max(2, rect.height * 0.15)
  return {
    x: rect.x - padX,
    y: rect.y - padY,
    width: rect.width + padX * 2,
    height: rect.height + padY * 2,
  }
}

// 行全体の検出領域のうち、名前がマッチした範囲だけを文字数比率から絞り込む。
// 日本語フォントは文字幅がほぼ均等なため、文字位置の比率をそのままx座標の比率に
// 換算する近似で十分実用的な精度が得られる（記号等で多少ズレる可能性はある）。
function narrowRectToMatch(rect: Rect, start: number, end: number, totalLength: number): Rect {
  const startRatio = start / totalLength
  const endRatio = end / totalLength
  return {
    x: rect.x + rect.width * startRatio,
    y: rect.y,
    width: rect.width * (endRatio - startRatio),
    height: rect.height,
  }
}

export function detectNameMasks(ocrWords: OcrWord[], names: string[]): MaskBox[] {
  const trimmedNames = names.map((n) => n.trim()).filter(Boolean)
  if (trimmedNames.length === 0) return []

  const masks: MaskBox[] = []
  for (const word of ocrWords) {
    const text = word.text.trim()
    if (!text) continue

    for (const name of trimmedNames) {
      if (isFuzzyMatch(name, text)) {
        masks.push({
          id: `name-${word.id}`,
          rect: padRect(word.bbox),
          shape: 'rect',
          source: 'name',
          label: name,
          enabled: true,
        })
        break
      }

      const match = findFuzzySubstringMatch(name, text)
      if (match) {
        const narrowed = narrowRectToMatch(word.bbox, match.start, match.end, match.totalLength)
        masks.push({
          id: `name-${word.id}`,
          rect: padRect(narrowed),
          shape: 'rect',
          source: 'name',
          label: name,
          enabled: true,
        })
        break
      }
    }
  }
  return masks
}
