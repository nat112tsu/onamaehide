export type EditorTool = 'pan' | 'name' | 'icon'

interface EditToolBarProps {
  tool: EditorTool
  onToolChange: (tool: EditorTool) => void
  canUndo: boolean
  onUndo: () => void
  onDownload: () => void
  downloadLabel: string
  onShare: () => void
  shareLabel: string
  shareSupported: boolean
  exportBusy: boolean
}

const TOOLS: { value: EditorTool; label: string }[] = [
  { value: 'pan', label: '🖐 うごかす' },
  { value: 'name', label: '▭ なまえ' },
  { value: 'icon', label: '⬤ アイコン' },
]

export function EditToolBar({
  tool,
  onToolChange,
  canUndo,
  onUndo,
  onDownload,
  downloadLabel,
  onShare,
  shareLabel,
  shareSupported,
  exportBusy,
}: EditToolBarProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-bg p-1">
          {TOOLS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onToolChange(t.value)}
              aria-pressed={tool === t.value}
              className={`min-h-11 rounded-xl px-3 text-sm transition-colors ${
                tool === t.value
                  ? 'bg-surface font-bold text-primary shadow-sm'
                  : 'text-mut hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="min-h-11 rounded-xl bg-bg px-3 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↩︎ もどす
        </button>
      </div>
      <div className="flex w-full gap-2 sm:hidden">
        {shareSupported && (
          <button
            type="button"
            onClick={onShare}
            disabled={exportBusy}
            className="min-h-11 flex-1 rounded-xl border border-primary px-3 text-sm font-bold text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {shareLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onDownload}
          disabled={exportBusy}
          className="min-h-11 flex-1 rounded-xl bg-primary px-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {downloadLabel}
        </button>
      </div>
    </>
  )
}
