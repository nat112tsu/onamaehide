export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // click直後に同期でrevokeすると、ダウンロードの開始に間に合わないブラウザがあるため遅延させる
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
