import type { ImageItem } from './types'
import { renderMaskedPngs } from './renderExport'

export type ShareOutcome = 'shared' | 'cancelled' | 'gesture-expired'

let cachedSupport: boolean | null = null

/**
 * 画像ファイルの共有に対応しているかを判定する。
 *
 * navigator.canShare() を引数なし・空配列で呼んでも当てにならない（端末によって
 * 実際には共有できないのにtrueを返す）ため、ダミーのFileを1つ渡して判定する。
 *
 * 注意: navigator.shareはsecure context（HTTPSかlocalhost）でのみ利用できる。
 * `vite --host` でLAN IP（http://192.168.x.x など）から開いた場合は対象外となり
 * 共有ボタンは表示されない。実機確認はVercelのHTTPS URLで行うこと。
 */
export function canShareFiles(): boolean {
  if (cachedSupport !== null) return cachedSupport
  cachedSupport = (() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
    if (!window.isSecureContext) return false
    if (typeof navigator.share !== 'function') return false
    if (typeof navigator.canShare !== 'function') return false
    try {
      const probe = new File([new Uint8Array([0])], 'probe.png', { type: 'image/png' })
      return navigator.canShare({ files: [probe] })
    } catch {
      return false
    }
  })()
  return cachedSupport
}

export async function buildShareFiles(
  images: ImageItem[],
  color: string,
  onProgress?: (done: number, total: number) => void,
): Promise<File[]> {
  const pngs = await renderMaskedPngs(images, color, onProgress)
  return pngs.map((png) => new File([png.blob], png.filename, { type: 'image/png' }))
}

/**
 * 実際に共有シートを開く。iOSのユーザー操作制限があるため、呼び出し側は
 * この関数をクリックハンドラ内でawaitを挟まずに呼べるようにしておくこと。
 */
export async function shareFiles(files: File[]): Promise<ShareOutcome> {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    throw new Error('このブラウザは画像の共有に対応していません。ダウンロードをご利用ください。')
  }
  // 判定用のダミーFileでは実際の枚数・容量まで見られないため、本物の配列で再確認する
  if (!navigator.canShare({ files })) {
    throw new Error(
      'この端末では、この枚数・サイズの画像をまとめて共有できません。ダウンロードをご利用ください。',
    )
  }

  try {
    // textやtitleは付けない。iOSでは共有先によっては本文だけを受け取り画像が落ちるため
    await navigator.share({ files })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException) {
      // ユーザーが共有シートを閉じただけ。エラー扱いにしない
      if (err.name === 'AbortError' || err.name === 'InvalidStateError') return 'cancelled'
      // 画像の準備に時間がかかり、ユーザー操作の有効期間を過ぎた場合
      if (err.name === 'NotAllowedError') return 'gesture-expired'
    }
    throw err
  }
}

export async function shareMaskedImages(
  images: ImageItem[],
  color: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ outcome: ShareOutcome; files: File[] }> {
  const files = await buildShareFiles(images, color, onProgress)
  const outcome = await shareFiles(files)
  // gesture-expiredのときに再タップで使い回せるよう、生成済みのFileを返す
  return { outcome, files }
}
