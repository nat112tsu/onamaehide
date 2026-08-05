interface ToolbarProps {
  maskColor: string
  onMaskColorChange: (color: string) => void
  showOcrOverlay: boolean
  onShowOcrOverlayChange: (show: boolean) => void
  showMaskPreview: boolean
  onShowMaskPreviewChange: (show: boolean) => void
  onDownload: () => void
  downloadLabel: string
  onShare: () => void
  shareLabel: string
  shareSupported: boolean
  exportBusy: boolean
  onRerunOcr: () => void
  ocrRunning: boolean
}

export function Toolbar({
  maskColor,
  onMaskColorChange,
  showOcrOverlay,
  onShowOcrOverlayChange,
  showMaskPreview,
  onShowMaskPreviewChange,
  onDownload,
  downloadLabel,
  onShare,
  shareLabel,
  shareSupported,
  exportBusy,
  onRerunOcr,
  ocrRunning,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-3">
      <label className="flex min-h-11 items-center gap-2 text-sm text-mut">
        塗りつぶし色
        <input
          type="color"
          value={maskColor}
          onChange={(e) => onMaskColorChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-line"
        />
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm text-mut">
        <input
          type="checkbox"
          checked={showOcrOverlay}
          onChange={(e) => onShowOcrOverlayChange(e.target.checked)}
          className="size-5 accent-primary"
        />
        OCR検出枠を表示
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm text-mut">
        <input
          type="checkbox"
          checked={showMaskPreview}
          onChange={(e) => onShowMaskPreviewChange(e.target.checked)}
          className="size-5 accent-primary"
        />
        マスク適用プレビュー（Before/After）
      </label>

      <button
        type="button"
        onClick={onRerunOcr}
        disabled={ocrRunning}
        className="min-h-11 rounded-xl border border-line px-3 text-sm text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
      >
        {ocrRunning ? '検出中…' : '🔄 文字を再検出'}
      </button>

      {/* モバイルでは操作バー側（ImageCanvas）のボタンを使うため非表示 */}
      <div className="hidden items-center gap-2 sm:ml-auto sm:flex">
        {shareSupported && (
          <button
            type="button"
            onClick={onShare}
            disabled={exportBusy}
            className="min-h-11 rounded-xl border border-primary px-4 text-sm font-medium text-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {shareLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onDownload}
          disabled={exportBusy}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {downloadLabel}
        </button>
      </div>
    </div>
  )
}
