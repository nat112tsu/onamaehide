import { PaddleOcrService } from 'ppu-paddle-ocr/web'
import * as ort from 'onnxruntime-web'
import type { OcrWord } from './types'

// onnxruntime-webはwasmPaths未設定だと既定でjsDelivr CDNから読み込む仕様のため、
// 「画像は一切サーバーに送信されない」という前提を保つには自己ホストパスを明示する必要がある。
// ppu-paddle-ocr側のインポート時に既定値が設定されるより後に実行されるよう、
// モジュール読み込み時点で上書きする。
// 注意: `npm run dev`（Vite開発サーバー）では、public/配下のファイルをESM importで
// 読み込むことをVite側が拒否するため、OCR初期化時にエラーが出ることがある
// （`npm run build` && `vite preview`や実際の本番デプロイでは問題なく動作する）。
ort.env.wasm.wasmPaths = '/ort/'

let servicePromise: Promise<PaddleOcrService> | null = null

function getService(): Promise<PaddleOcrService> {
  if (!servicePromise) {
    servicePromise = (async () => {
      const service = new PaddleOcrService({
        model: {
          detection: '/paddle-ocr/models/det.ort',
          recognition: '/paddle-ocr/models/rec.ort',
          charactersDictionary: '/paddle-ocr/models/dict.txt',
        },
        // OpenCV.js（重量級のWASM）を追加で読み込まずに済むcanvas-nativeエンジンでも
        // 検出精度は同等だったため、こちらを採用している。
        processing: { engine: 'canvas-native' },
      })
      await service.initialize()
      return service
    })()
  }
  return servicePromise
}

let nextWordId = 0

// PaddleOcrServiceの推論セッションは同時実行に対応していないため、
// 複数画像を並行アップロードしても1件ずつ順番に処理されるようキューで直列化する。
let queue: Promise<unknown> = Promise.resolve()

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task)
  queue = result.catch(() => {})
  return result
}

// 検出モデルは内部的に長辺640px程度まで縮小して処理するため、
// それ以上の解像度を渡してもCanvas処理のオーバーヘッドが増えるだけで精度は上がらない。
// スマホ実機の実際のスクリーンショット解像度でも数十秒〜処理が長引かないよう、
// 認識用クロップの画質は保ちつつ上限を設けて縮小する。
const MAX_INPUT_DIMENSION = 1600

// shouldRunは直列キューの順番が回ってきた時点で呼ばれ、falseを返すと推論せずnullを返す。
// 「すべてクリア」などで対象画像が破棄済みの場合に、待機中の無駄な推論をスキップするために使う。
export async function recognizeImage(
  image: ImageBitmap,
  onProgress?: (progress: number) => void,
  shouldRun?: () => boolean,
): Promise<OcrWord[] | null> {
  onProgress?.(0)

  return runExclusive(async () => {
    if (shouldRun && !shouldRun()) return null

    const service = await getService()

    const scale = Math.min(1, MAX_INPUT_DIMENSION / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context を取得できませんでした')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    const result = await service.recognize(canvas, { flatten: true })
    onProgress?.(1)

    return result.results.map((item) => ({
      id: `word-${nextWordId++}`,
      text: item.text,
      bbox: {
        x: item.box.x / scale,
        y: item.box.y / scale,
        width: item.box.width / scale,
        height: item.box.height / scale,
      },
    }))
  })
}
