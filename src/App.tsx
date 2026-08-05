import { useEffect, useMemo, useRef, useState } from 'react'
import { UploadZone } from './components/UploadZone'
import { ImageCanvas } from './components/ImageCanvas'
import { Toolbar } from './components/Toolbar'
import { NameRegistryPanel } from './components/NameRegistryPanel'
import { HelpModal } from './components/HelpModal'
import { useImageBatch } from './hooks/useImageBatch'
import {
  canvasToPngBlob,
  maskedBaseName,
  releaseCanvas,
  renderImageMasked,
} from './lib/renderExport'
import { downloadBlob } from './lib/exportImage'
import { downloadAllAsZip } from './lib/zipExport'
import { canShareFiles, shareFiles, shareMaskedImages } from './lib/shareImage'
import { detectNameMasks } from './lib/nameDetection'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'onamaehide-theme'

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // プライベートブラウジング等でlocalStorageが使えない場合は端末設定にまかせる
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

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
  const [exportBusy, setExportBusy] = useState<null | 'share' | 'download'>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)
  // 共有の準備が間に合わずiOSに弾かれたとき、生成済みFileを保持して再タップで共有する
  const [shareRetry, setShareRetry] = useState(false)
  const pendingShareRef = useRef<{ files: File[]; signature: string } | null>(null)
  const shareSupported = useMemo(() => canShareFiles(), [])
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // 保存できなくても表示自体は切り替わるので無視する
    }
  }, [theme])

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

  async function runDownload() {
    if (!activeImage) return
    setExportError(null)
    setExportBusy('download')
    try {
      if (images.length > 1) {
        await downloadAllAsZip(images, maskColor, (done, total) =>
          setExportProgress({ done, total }),
        )
      } else {
        const canvas = renderImageMasked(activeImage, maskColor)
        const blob = await canvasToPngBlob(canvas)
        releaseCanvas(canvas)
        downloadBlob(blob, `${maskedBaseName(activeImage)}_masked.png`)
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '画像の書き出しに失敗しました。')
    } finally {
      setExportBusy(null)
      setExportProgress(null)
    }
  }

  function handleDownload() {
    if (exportBusy) return
    void runDownload()
  }

  // 生成済みFileをそのまま使えるかの判定に使う。マスクや色が変わっていたら作り直す
  function currentShareSignature() {
    return `${maskColor}|${JSON.stringify(images.map((img) => [img.id, img.masks]))}`
  }

  async function finishPendingShare(files: File[]) {
    try {
      const outcome = await shareFiles(files)
      if (outcome !== 'gesture-expired') {
        pendingShareRef.current = null
        setShareRetry(false)
      }
    } catch (err) {
      pendingShareRef.current = null
      setShareRetry(false)
      setExportError(err instanceof Error ? err.message : '共有に失敗しました。')
    }
  }

  async function prepareAndShare(signature: string) {
    setExportError(null)
    setExportBusy('share')
    try {
      const { outcome, files } = await shareMaskedImages(images, maskColor, (done, total) =>
        setExportProgress({ done, total }),
      )
      if (outcome === 'gesture-expired') {
        // 準備に時間がかかりiOSに弾かれた。エラーではなく「もう一度タップ」に誘導する
        pendingShareRef.current = { files, signature }
        setShareRetry(true)
      } else {
        pendingShareRef.current = null
        setShareRetry(false)
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '共有に失敗しました。')
    } finally {
      setExportBusy(null)
      setExportProgress(null)
    }
  }

  // iOSはユーザー操作から一定時間内にnavigator.shareを呼ぶ必要があるため、
  // 再タップ時はawaitを挟まず同期的にshareFilesへ入る
  function handleShare() {
    if (exportBusy) return
    const signature = currentShareSignature()
    const pending = pendingShareRef.current
    if (pending && pending.signature === signature) {
      void finishPendingShare(pending.files)
      return
    }
    pendingShareRef.current = null
    setShareRetry(false)
    void prepareAndShare(signature)
  }

  const downloadLabel =
    exportBusy === 'download'
      ? exportProgress
        ? `書き出し中… (${exportProgress.done}/${exportProgress.total})`
        : '書き出し中…'
      : images.length > 1
        ? 'ZIPで一括ダウンロード'
        : 'PNGをダウンロード'

  const shareLabel =
    exportBusy === 'share'
      ? exportProgress
        ? `準備中… (${exportProgress.done}/${exportProgress.total})`
        : '準備中…'
      : shareRetry
        ? '📤 もう一度タップして共有'
        : images.length > 1
          ? `📤 ${images.length}枚を共有`
          : '📤 共有'

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex items-start justify-between border-b border-line bg-surface px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">おなまえかくし</h1>
          <p className="text-sm text-mut">
            画像は一切サーバーに送信されません。すべての処理はこのブラウザ内で完結します。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            className="min-h-11 min-w-11 rounded-xl border border-line text-sm text-ink hover:bg-bg"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {(images.length > 0 || registeredNames.length > 0 || uploadErrors.length > 0) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="min-h-11 rounded-xl border border-line px-3 text-sm text-ink hover:bg-bg"
            >
              すべてクリア
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="min-h-11 rounded-xl border border-line px-3 text-sm text-ink hover:bg-bg"
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
          <div className="rounded-2xl border border-line bg-primary-soft px-3 py-2 text-sm text-ink">
            文字を検出中です…画像サイズや端末によっては1分以上かかることがあります。
            ページを閉じずにそのままお待ちください。
          </div>
        )}

        {!isOcrRunning && hasUnmatchedNames && (
          <div className="rounded-2xl border border-line bg-primary-soft px-3 py-2 text-sm text-ink">
            登録した名前に一致する文字列が見つかりませんでした。OCR検出枠を表示して実際に
            検出された文字と登録名の表記が一致しているか確認するか、手動でマスクを追加して
            ください。
          </div>
        )}

        {exportError && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {exportError}
          </div>
        )}

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className={`flex items-stretch overflow-hidden rounded border text-sm ${
                  (activeImage?.id ?? images[0]?.id) === img.id
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-line bg-surface text-ink'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(img.id)}
                  className="flex min-h-11 items-center gap-2 px-3"
                >
                  <span className="max-w-[10rem] truncate">{img.file.name}</span>
                  {img.ocrStatus === 'running' && (
                    <span className="text-xs text-mut">OCR中…</span>
                  )}
                  {img.ocrStatus === 'error' && (
                    <span className="text-xs text-danger">OCR失敗</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeImage(img.id)
                    if (activeId === img.id) setActiveId(null)
                  }}
                  aria-label={`${img.file.name} を削除`}
                  className="flex min-w-11 items-center justify-center text-mut hover:text-danger"
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
              downloadLabel={downloadLabel}
              onShare={handleShare}
              shareLabel={shareLabel}
              shareSupported={shareSupported}
              exportBusy={exportBusy !== null}
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
              downloadLabel={downloadLabel}
              onShare={handleShare}
              shareLabel={shareLabel}
              shareSupported={shareSupported}
              exportBusy={exportBusy !== null}
              exportError={exportError}
            />
          </>
        ) : (
          <p className="text-sm text-mut">
            画像をアップロードすると、ここに編集画面が表示されます。
          </p>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-mut">
        <p>
          <a
            href="https://marshmallow-qa.com/lz48smbin5dkc2b?t=DiRKR6&utm_medium=url_text&utm_source=promotion"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-ink"
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
