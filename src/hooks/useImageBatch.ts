import { useCallback, useRef, useState } from 'react'
import type { ImageItem, MaskBox } from '../lib/types'
import { loadImageFile, validateFiles } from '../lib/imageResize'
import { recognizeImage } from '../lib/ocr'

let nextImageId = 0

const MAX_HISTORY = 20

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
  // Undo履歴: 画像IDごとに「編集直前のマスク配列」のスナップショットを積む。
  // マスク配列は全編集箇所でイミュータブルに置き換えられるため、参照のまま保存できる。
  // 履歴に積むのはbeginMaskEditを明示的に呼んだユーザー操作のみで、
  // App.tsxの名前自動検出effectによるupdateMasksは履歴に入らない。
  const historyRef = useRef<Map<string, MaskBox[][]>>(new Map())
  // historyRefの変更でcanUndoの表示を更新するための再レンダートリガー
  const [, setHistoryVersion] = useState(0)

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

  // 自動検出が走らなかった・失敗した場合に、ユーザー操作でOCRをやり直すための入口。
  // 既存の手動マスクはApp側のeffectが source!=='name' として保持するため消えない。
  const rerunOcr = useCallback(
    (id: string) => {
      const img = imagesRef.current.find((i) => i.id === id)
      if (!img || img.ocrStatus === 'running') return
      void runOcr(id, img.imageBitmap)
    },
    [runOcr],
  )

  const updateMasks = useCallback((id: string, masks: MaskBox[]) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, masks } : img)))
  }, [])

  // ユーザー操作（作成/移動/リサイズ/削除）の開始時に呼び、編集前の状態を履歴に積む。
  // 移動/リサイズはpointermoveごとにupdateMasksが走るため、ジェスチャ開始時の
  // 1回だけ記録する（updateMasks内で記録すると1ドラッグで数十件積まれてしまう）。
  const beginMaskEdit = useCallback((id: string) => {
    const img = imagesRef.current.find((i) => i.id === id)
    if (!img) return
    const stack = historyRef.current.get(id) ?? []
    // タップ選択だけで編集しなかった場合などの重複スナップショットは積まない
    if (stack[stack.length - 1] === img.masks) return
    stack.push(img.masks)
    if (stack.length > MAX_HISTORY) stack.shift()
    historyRef.current.set(id, stack)
    setHistoryVersion((v) => v + 1)
  }, [])

  const undoMasks = useCallback((id: string) => {
    const stack = historyRef.current.get(id)
    if (!stack || stack.length === 0) return
    const img = imagesRef.current.find((i) => i.id === id)
    // 「記録したが実際には編集されなかった」no-opスナップショットを飛ばす
    let snapshot = stack.pop()
    while (snapshot !== undefined && img && snapshot === img.masks) {
      snapshot = stack.pop()
    }
    if (snapshot === undefined) {
      setHistoryVersion((v) => v + 1)
      return
    }
    const restored = snapshot
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, masks: restored } : i)))
    setHistoryVersion((v) => v + 1)
  }, [])

  const canUndo = useCallback((id: string) => {
    return (historyRef.current.get(id)?.length ?? 0) > 0
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
    historyRef.current.delete(id)
    const target = imagesRef.current.find((img) => img.id === id)
    if (target) closeBitmapIfIdle(target)
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    batchEpochRef.current++
    aliveIdsRef.current.clear()
    historyRef.current.clear()
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
    rerunOcr,
    updateMasks,
    beginMaskEdit,
    undoMasks,
    canUndo,
    removeImage,
    clearAll,
  }
}
