export const MAX_IMAGE_COUNT = 10
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const LONG_EDGE_WARNING_THRESHOLD = 8000

export interface LoadedImage {
  bitmap: ImageBitmap
  width: number
  height: number
  isLong: boolean
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file)
  const isLong =
    Math.max(bitmap.width, bitmap.height) > LONG_EDGE_WARNING_THRESHOLD
  return { bitmap, width: bitmap.width, height: bitmap.height, isLong }
}

export function validateFiles(
  files: File[],
  currentCount: number,
): { accepted: File[]; errors: string[] } {
  const errors: string[] = []
  const accepted: File[] = []

  for (const file of files) {
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      errors.push(`${file.name}: PNG/JPEG形式のみ対応しています`)
      continue
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`${file.name}: ファイルサイズが10MBを超えています`)
      continue
    }
    accepted.push(file)
  }

  const remainingSlots = MAX_IMAGE_COUNT - currentCount
  if (accepted.length > remainingSlots) {
    if (remainingSlots <= 0) {
      errors.push(`アップロードできる画像は最大${MAX_IMAGE_COUNT}枚までです`)
      return { accepted: [], errors }
    }
    errors.push(
      `アップロードできる画像は最大${MAX_IMAGE_COUNT}枚までです。先頭${remainingSlots}枚のみ受け付けました`,
    )
    return { accepted: accepted.slice(0, remainingSlots), errors }
  }

  return { accepted, errors }
}
