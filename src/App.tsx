import { useEffect, useState } from 'react'
import { UploadZone } from './components/UploadZone'
import { ImageCanvas } from './components/ImageCanvas'
import { Toolbar } from './components/Toolbar'
import { NameRegistryPanel } from './components/NameRegistryPanel'
import { HelpModal } from './components/HelpModal'
import { useImageBatch } from './hooks/useImageBatch'
import { renderMasked } from './lib/maskRenderer'
import { downloadCanvasAsPng } from './lib/exportImage'
import { downloadAllAsZip } from './lib/zipExport'
import { detectNameMasks } from './lib/nameDetection'

function App() {
  const { images, uploadErrors, addFiles, updateMasks, removeImage } = useImageBatch()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [maskColor, setMaskColor] = useState('#000000')
  const [showOcrOverlay, setShowOcrOverlay] = useState(true)
  const [showMaskPreview, setShowMaskPreview] = useState(true)
  const [registeredNames, setRegisteredNames] = useState<string[]>([])
  const [showHelp, setShowHelp] = useState(false)

  const activeImage = images.find((img) => img.id === activeId) ?? images[0] ?? null
  const isOcrRunning = images.some((img) => img.ocrStatus === 'running')
  const hasUnmatchedNames =
    registeredNames.length > 0 &&
    images.length > 0 &&
    images.every(
      (img) => img.ocrStatus === 'done' && !img.masks.some((m) => m.source === 'name'),
    )

  useEffect(() => {
    for (const image of images) {
      if (image.ocrStatus !== 'done') continue

      const nameMasks = detectNameMasks(image.ocrWords, registeredNames)
      const keptMasks = image.masks.filter((m) => m.source !== 'name')
      const nextMasks = [...keptMasks, ...nameMasks]

      const currentAutoIds = image.masks
        .filter((m) => m.source === 'name')
        .map((m) => m.id)
        .sort()
        .join(',')
      const nextAutoIds = nameMasks
        .map((m) => m.id)
        .sort()
        .join(',')

      if (currentAutoIds !== nextAutoIds) {
        updateMasks(image.id, nextMasks)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, registeredNames])

  function handleFilesSelected(files: File[]) {
    addFiles(files)
  }

  function handleDownload() {
    if (!activeImage) return
    if (images.length > 1) {
      void downloadAllAsZip(images, maskColor)
      return
    }
    const base = document.createElement('canvas')
    base.width = activeImage.width
    base.height = activeImage.height
    const ctx = base.getContext('2d')
    ctx?.drawImage(activeImage.imageBitmap, 0, 0)
    const rendered = renderMasked(base, activeImage.masks, { color: maskColor })
    const baseName = activeImage.file.name.replace(/\.[^.]+$/, '')
    downloadCanvasAsPng(rendered, `${baseName}_masked.png`)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-start justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">おなまえかくし</h1>
          <p className="text-sm text-slate-500">
            画像は一切サーバーに送信されません。すべての処理はこのブラウザ内で完結します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          使い方
        </button>
      </header>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
        <NameRegistryPanel names={registeredNames} onNamesChange={setRegisteredNames} />

        <UploadZone onFilesSelected={handleFilesSelected} errors={uploadErrors} />

        {isOcrRunning && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            文字を検出中です…画像サイズや端末によっては1分以上かかることがあります。
            ページを閉じずにそのままお待ちください。
          </div>
        )}

        {!isOcrRunning && hasUnmatchedNames && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            登録した名前に一致する文字列が見つかりませんでした。OCR検出枠を表示して実際に
            検出された文字と登録名の表記が一致しているか確認するか、手動でマスクを追加して
            ください。
          </div>
        )}

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveId(img.id)}
                className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm ${
                  (activeImage?.id ?? images[0]?.id) === img.id
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span className="max-w-[10rem] truncate">{img.file.name}</span>
                {img.ocrStatus === 'running' && (
                  <span className="text-xs text-slate-400">OCR中…</span>
                )}
                {img.ocrStatus === 'error' && (
                  <span className="text-xs text-red-500">OCR失敗</span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeImage(img.id)
                    if (activeId === img.id) setActiveId(null)
                  }}
                  className="text-slate-400 hover:text-red-500"
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        )}

        {activeImage ? (
          <>
            <Toolbar
              maskColor={maskColor}
              onMaskColorChange={setMaskColor}
              showOcrOverlay={showOcrOverlay}
              onShowOcrOverlayChange={setShowOcrOverlay}
              showMaskPreview={showMaskPreview}
              onShowMaskPreviewChange={setShowMaskPreview}
              onDownload={handleDownload}
              downloadLabel={images.length > 1 ? 'ZIPで一括ダウンロード' : 'PNGをダウンロード'}
            />
            <ImageCanvas
              image={activeImage}
              maskColor={maskColor}
              showOcrOverlay={showOcrOverlay}
              showMaskPreview={showMaskPreview}
              onMasksChange={(masks) => updateMasks(activeImage.id, masks)}
            />
          </>
        ) : (
          <p className="text-sm text-slate-400">
            画像をアップロードすると、ここに編集画面が表示されます。
          </p>
        )}
      </main>
    </div>
  )
}

export default App
