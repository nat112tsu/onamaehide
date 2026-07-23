interface ToolbarProps {
  maskColor: string
  onMaskColorChange: (color: string) => void
  showOcrOverlay: boolean
  onShowOcrOverlayChange: (show: boolean) => void
  showMaskPreview: boolean
  onShowMaskPreviewChange: (show: boolean) => void
  onDownload: () => void
  downloadLabel: string
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
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded border border-slate-200 bg-white p-3">
      <label className="flex items-center gap-2 text-sm text-slate-500">
        塗りつぶし色
        <input
          type="color"
          value={maskColor}
          onChange={(e) => onMaskColorChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-slate-200"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-500">
        <input
          type="checkbox"
          checked={showOcrOverlay}
          onChange={(e) => onShowOcrOverlayChange(e.target.checked)}
        />
        OCR検出枠を表示
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-500">
        <input
          type="checkbox"
          checked={showMaskPreview}
          onChange={(e) => onShowMaskPreviewChange(e.target.checked)}
        />
        マスク適用プレビュー（Before/After）
      </label>

      <button
        type="button"
        onClick={onDownload}
        className="ml-auto rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white"
      >
        {downloadLabel}
      </button>
    </div>
  )
}
