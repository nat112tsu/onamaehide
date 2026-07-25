import { useCallback, useRef, useState } from 'react'
import type { ImageItem, MaskBox } from '../lib/types'
import { loadImageFile, validateFiles } from '../lib/imageResize'
import { recognizeImage } from '../lib/ocr'

let nextImageId = 0

export function useImageBatch() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const imagesRef = useRef<ImageItem[]>([])
  imagesRef.current = images
  // 「すべてクリア」のたびに増える世代カウンタ。クリアをまたいだ非同期処理
  // （読み込み中のaddFiles）が古い結果を反映しないようにするためのガード。
  const batchEpochRef = useRef(0)
  // 現在有効な画像ID。imagesRefはレンダー時にしか更新されず、追加直後の
  // 非同期処理から参照すると古い内容が見えるため、追加/削除と同時に
  // 命令的に更新するこのセットを生存判定に使う。
  const aliveIdsRef = useRef<Set<string>>(new Set())

  const runOcr = useCallback(async (id: string, bitmap: ImageBitmap) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ocrStatus: 'running' } : img)),
    )

    // クリア/削除で画像が破棄済みかどうか。破棄済みならOCRをスキップし、
    // このrunOcrだけが保持しているビットマップをここで解放する。
    const stillExists = () => aliveIdsRef.current.has(id)

    try {
      const words = await recognizeImage(bitmap, undefined, stillExists)
      if (words === null || !stillExists()) {
        bitmap.close()
        return
      }
      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, ocrWords: words, ocrStatus: 'done' } : img,
        ),
      )
    } catch (err) {
      console.error('OCR failed', err)
      if (!stillExists()) {
        bitmap.close()
        return
      }
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ocrStatus: 'error' } : img)),
      )
    }
  }, [])

  const addFiles = useCallback(
    async (files: File[]) => {
      const epoch = batchEpochRef.current
      const { accepted, errors } = validateFiles(files, imagesRef.current.length)
      setUploadErrors(errors)
      if (accepted.length === 0) return

      const loadErrors: string[] = []
      const longImageNames: string[] = []
      const newItems: ImageItem[] = []
      for (const file of accepted) {
        try {
          const loaded = await loadImageFile(file)
          if (loaded.isLong) longImageNames.push(file.name)
          newItems.push({
            id: `image-${nextImageId++}`,
            file,
            imageBitmap: loaded.bitmap,
            width: loaded.width,
            height: loaded.height,
            ocrWords: [],
            ocrStatus: 'pending',
            masks: [],
          })
        } catch {
          loadErrors.push(`${file.name}: 画像の読み込みに失敗しました`)
        }
      }

      // 読み込み待ちの間に「すべてクリア」されていたら、このバッチは反映せず破棄する
      if (epoch !== batchEpochRef.current) {
        for (const item of newItems) {
          item.imageBitmap.close()
        }
        return
      }

      if (longImageNames.length > 0) {
        loadErrors.push(
          `${longImageNames.join(', ')}: 非常に縦長の画像です。処理に時間がかかったり、表示が崩れる場合があります`,
        )
      }
      if (loadErrors.length > 0) {
        setUploadErrors((prev) => [...prev, ...loadErrors])
      }

      for (const item of newItems) {
        aliveIdsRef.current.add(item.id)
      }
      setImages((prev) => [...prev, ...newItems])
      for (const item of newItems) {
        void runOcr(item.id, item.imageBitmap)
      }
    },
    [runOcr],
  )

  const updateMasks = useCallback((id: string, masks: MaskBox[]) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, masks } : img)))
  }, [])

  // OCR完了/失敗済みの画像はrunOcrがもう触らないので、ここでビットマップを解放できる。
  // pending/running中の画像はrunOcr側が完了時に解放する（推論中のcloseを避けるため）。
  const closeBitmapIfIdle = (img: ImageItem) => {
    if (img.ocrStatus === 'done' || img.ocrStatus === 'error') {
      img.imageBitmap.close()
    }
  }

  const removeImage = useCallback((id: string) => {
    aliveIdsRef.current.delete(id)
    const target = imagesRef.current.find((img) => img.id === id)
    if (target) closeBitmapIfIdle(target)
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    batchEpochRef.current++
    aliveIdsRef.current.clear()
    for (const img of imagesRef.current) {
      closeBitmapIfIdle(img)
    }
    setImages([])
    setUploadErrors([])
  }, [])

  return {
    images,
    uploadErrors,
    addFiles,
    updateMasks,
    removeImage,
    clearAll,
  }
}
