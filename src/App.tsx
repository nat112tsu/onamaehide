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
  const {
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
  } = useImageBatch()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [maskColor, setMaskColor] = useState('#ffffff')
  const [showOcrOverlay, setShowOcrOverlay] = useState(true)
  const [showMaskPreview, setShowMaskPreview] = useState(true)
  const [registeredNames, setRegisteredNames] = useState<string[]>([])
  const [showHelp, setShowHelp] = useState(false)
  // 「すべてクリア」のたびに増やしてNameRegistryPanelをkeyで再マウントし、
  // パネル内部の入力途中テキストも確実に消す
  const [clearCount, setClearCount] = useState(0)

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

  function handleClearAll() {
    if (!window.confirm('登録した名前とアップロードした画像をすべて消去します。よろしいですか？')) {
      return
    }
    clearAll()
    setRegisteredNames([])
    setActiveId(null)
    setClearCount((c) => c + 1)
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
        <div className="flex shrink-0 items-center gap-2">
          {(images.length > 0 || registeredNames.length > 0 || uploadErrors.length > 0) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="min-h-11 rounded border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              すべてクリア
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="min-h-11 rounded border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            使い方
          </button>
        </div>
      </header>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
        <NameRegistryPanel
          key={clearCount}
          names={registeredNames}
          onNamesChange={setRegisteredNames}
        />

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
              <div
                key={img.id}
                className={`flex items-stretch overflow-hidden rounded border text-sm ${
                  (activeImage?.id ?? images[0]?.id) === img.id
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(img.id)}
                  className="flex min-h-11 items-center gap-2 px-3"
                >
                  <span className="max-w-[10rem] truncate">{img.file.name}</span>
                  {img.ocrStatus === 'running' && (
                    <span className="text-xs text-slate-400">OCR中…</span>
                  )}
                  {img.ocrStatus === 'error' && (
                    <span className="text-xs text-red-500">OCR失敗</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeImage(img.id)
                    if (activeId === img.id) setActiveId(null)
                  }}
                  aria-label={`${img.file.name} を削除`}
                  className="flex min-w-11 items-center justify-center text-slate-400 hover:text-red-500"
                >
                  ×
                </button>
              </div>
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
              onRerunOcr={() => rerunOcr(activeImage.id)}
              ocrRunning={activeImage.ocrStatus === 'running'}
            />
            <ImageCanvas
              image={activeImage}
              maskColor={maskColor}
              showOcrOverlay={showOcrOverlay}
              showMaskPreview={showMaskPreview}
              registeredNames={registeredNames}
              onMasksChange={(masks) => updateMasks(activeImage.id, masks)}
              onBeforeEdit={() => beginMaskEdit(activeImage.id)}
              onUndo={() => undoMasks(activeImage.id)}
              canUndo={canUndo(activeImage.id)}
              onDownload={handleDownload}
              downloadLabel={images.length > 1 ? 'ZIPで一括ダウンロード' : 'PNGをダウンロード'}
            />
          </>
        ) : (
          <p className="text-sm text-slate-400">
            画像をアップロードすると、ここに編集画面が表示されます。
          </p>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-slate-400">
        <p>
          <a
            href="https://marshmallow-qa.com/lz48smbin5dkc2b?t=DiRKR6&utm_medium=url_text&utm_source=promotion"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-600"
          >
            お問い合わせ・ご要望はこちら（マシュマロ）
          </a>
        </p>
        <p className="mt-1">Built with Claude Code</p>
      </footer>
    </div>
  )
}

export default App
