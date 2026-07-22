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

  const runOcr = useCallback(async (id: string, bitmap: ImageBitmap) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ocrStatus: 'running' } : img)),
    )

    try {
      const words = await recognizeImage(bitmap)
      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, ocrWords: words, ocrStatus: 'done' } : img,
        ),
      )
    } catch (err) {
      console.error('OCR failed', err)
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ocrStatus: 'error' } : img)),
      )
    }
  }, [])

  const addFiles = useCallback(
    async (files: File[]) => {
      const { accepted, errors } = validateFiles(files, imagesRef.current.length)
      setUploadErrors(errors)
      if (accepted.length === 0) return

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
          setUploadErrors((prev) => [...prev, `${file.name}: 画像の読み込みに失敗しました`])
        }
      }

      if (longImageNames.length > 0) {
        setUploadErrors((prev) => [
          ...prev,
          `${longImageNames.join(', ')}: 非常に縦長の画像です。処理に時間がかかったり、表示が崩れる場合があります`,
        ])
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

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  return {
    images,
    uploadErrors,
    addFiles,
    updateMasks,
    removeImage,
    rerunOcr: runOcr,
  }
}
