interface ToolbarProps {
  maskColor: string
  onMaskColorChange: (color: string) => void
  showOcrOverlay: boolean
  onShowOcrOverlayChange: (show: boolean) => void
  showMaskPreview: boolean
  onShowMaskPreviewChange: (show: boolean) => void
  onDownload: () => void
  downloadLabel: string
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
  onRerunOcr,
  ocrRunning,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded border border-slate-200 bg-white p-3">
      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-500">
        塗りつぶし色
        <input
          type="color"
          value={maskColor}
          onChange={(e) => onMaskColorChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-slate-200"
        />
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-500">
        <input
          type="checkbox"
          checked={showOcrOverlay}
          onChange={(e) => onShowOcrOverlayChange(e.target.checked)}
          className="size-5 accent-indigo-600"
        />
        OCR検出枠を表示
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-500">
        <input
          type="checkbox"
          checked={showMaskPreview}
          onChange={(e) => onShowMaskPreviewChange(e.target.checked)}
          className="size-5 accent-indigo-600"
        />
        マスク適用プレビュー（Before/After）
      </label>

      <button
        type="button"
        onClick={onRerunOcr}
        disabled={ocrRunning}
        className="min-h-11 rounded border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {ocrRunning ? '検出中…' : '🔄 文字を再検出'}
      </button>

      {/* モバイルでは操作バー側（ImageCanvas）のダウンロードボタンを使うため非表示 */}
      <button
        type="button"
        onClick={onDownload}
        className="hidden min-h-11 rounded bg-indigo-600 px-4 text-sm font-medium text-white sm:ml-auto sm:block"
      >
        {downloadLabel}
      </button>
    </div>
  )
}
